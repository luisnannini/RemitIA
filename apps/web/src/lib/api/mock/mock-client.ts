/**
 * ⚠️ ADAPTER FAKE — SOLO DESARROLLO (PRD ADR-006, 12.1 FE-01).
 *
 * Este módulo es un DOBLE DEL BACKEND, no lógica de la app web: implementa
 * `ApiClient` y simula del lado "servidor" la máquina de estados del PRD 7 y la
 * reconciliación del PRD 10.3, para que la historia completa se navegue de punta
 * a punta antes de que exista `apps/api` (Gate 1).
 *
 * Por eso la aritmética que hay acá NO viola el criterio "sin aritmética de
 * reconciliación en el cliente": vive detrás de la frontera del contrato, en el
 * lugar que ocupará FastAPI, y desaparece por completo del build de producción.
 * Ninguna pantalla, componente o store calcula nada: renderizan `summary` y
 * `discrepancy` tal como llegan.
 *
 * Carga: únicamente vía `import()` dinámico dentro de `if (import.meta.env.DEV)`
 * en `src/lib/api/index.ts`.
 */

import { ApiError } from '../errors';
import type { ApiClient } from '../contract';
import type {
	AnswerRequest,
	AssignRequest,
	Catalog,
	Claim,
	ClaimFact,
	CreateReceptionAccepted,
	Discrepancy,
	HealthView,
	ReceptionLine,
	ReceptionStatus,
	ReceptionSummary,
	ReceptionView,
	ScanRequest,
	UnexpectedItem
} from '../types';
import {
	MOCK_CATALOG,
	MOCK_CLAIM_PROSE,
	MOCK_DOCUMENT,
	MOCK_EMPTY_SUMMARY,
	MOCK_FIXTURE_MARKER,
	MOCK_HEALTH_READY,
	mockInitialLines
} from './fixtures';

/** Latencias simuladas para que el spinner y el polling se vean reales. */
const LATENCY_MS = 220;
const EXTRACTION_MS = 3_200;
const CLAIM_MS = 2_400;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface MockState {
	id: string;
	status: ReceptionStatus;
	created_at: string;
	filename: string;
	extractedAt: number | null;
	lines: ReceptionLine[];
	unexpected: UnexpectedItem[];
	claim: Claim | null;
	/** Snapshot congelado por `/finalize` (PRD 8.8): no cambia después. */
	frozenFacts: ClaimFact[] | null;
	seenScanEvents: Set<string>;
	extraProducts: Catalog['products'];
}

let state: MockState | null = null;
let sequence = 0;

const nextId = (prefix: string) => `${prefix}_${(++sequence).toString().padStart(4, '0')}`;

function notFound(): ApiError {
	return new ApiError(
		{
			code: 'RECEPTION_NOT_FOUND',
			message: 'No encontré esa recepción. Puede haberse reiniciado la demo.',
			retryable: false,
			user_action: 'start_over',
			trace_id: `trace_${MOCK_FIXTURE_MARKER}`,
			details: {}
		},
		404
	);
}

function invalidTransition(current: ReceptionStatus): ApiError {
	return new ApiError(
		{
			code: 'INVALID_STATE_TRANSITION',
			message: `Esa acción no es válida en el estado "${current}".`,
			retryable: false,
			user_action: null,
			trace_id: `trace_${MOCK_FIXTURE_MARKER}`,
			details: { status: current }
		},
		409
	);
}

/* ---------------------------------------------------------------- */
/* Simulación del motor determinístico del backend (PRD 10.3)        */
/* ---------------------------------------------------------------- */

const isBlocking = (line: ReceptionLine) =>
	line.match.status === 'ambiguous' || line.match.status === 'unmatched';

const countsTowardTotals = (line: ReceptionLine) => line.match.status === 'matched';

function computeDiscrepancy(line: ReceptionLine): Discrepancy | null {
	if (!countsTowardTotals(line) || line.expected_quantity === null) return null;
	const delta = line.counted_quantity - line.expected_quantity;
	if (delta === 0) return { type: 'ok' };
	if (delta < 0) return { type: 'missing', missing_quantity: Math.abs(delta) };
	return { type: 'over', over_quantity: delta };
}

function computeSummary(current: MockState): ReceptionSummary {
	const active = current.lines.filter(countsTowardTotals);
	const unitsExpected = active.reduce((total, line) => total + (line.expected_quantity ?? 0), 0);
	const unitsCounted = active.reduce((total, line) => total + line.counted_quantity, 0);
	const missing = active.reduce((total, line) => {
		const gap = (line.expected_quantity ?? 0) - line.counted_quantity;
		return total + (gap > 0 ? gap : 0);
	}, 0);
	const over = active.reduce((total, line) => {
		const extra = line.counted_quantity - (line.expected_quantity ?? 0);
		return total + (extra > 0 ? extra : 0);
	}, 0);
	const unexpectedUnits = current.unexpected.reduce((total, item) => total + item.counted_quantity, 0);

	return {
		expected_lines: current.lines.length,
		resolved_lines: current.lines.filter((line) => !isBlocking(line)).length,
		units_expected: unitsExpected,
		units_counted: unitsCounted,
		missing_units: missing,
		unexpected_units: over + unexpectedUnits
	};
}

/** PRD 7: sin líneas bloqueantes, `needs_document_review` → `receiving`. */
function advanceIfUnblocked(current: MockState) {
	if (current.status !== 'needs_document_review') return;
	if (current.lines.some(isBlocking)) return;
	current.status = 'receiving';
}

function productName(current: MockState, sku: string): string {
	const all = [...MOCK_CATALOG.products, ...current.extraProducts];
	return all.find((product) => product.sku === sku)?.name ?? sku;
}

function toView(current: MockState): ReceptionView {
	const lines = current.lines.map((line) => ({
		...line,
		discrepancy: computeDiscrepancy(line)
	}));

	return {
		id: current.id,
		status: current.status,
		created_at: current.created_at,
		document:
			current.status === 'draft'
				? null
				: {
						...MOCK_DOCUMENT,
						filename: current.filename,
						preview_url: `/api/v1/receptions/${current.id}/document`
					},
		lines: current.status === 'processing_document' ? [] : lines,
		unexpected_items: current.unexpected,
		summary: current.status === 'processing_document' ? MOCK_EMPTY_SUMMARY : computeSummary(current),
		claim: current.claim,
		latest_trace_id: `trace_${MOCK_FIXTURE_MARKER}`
	};
}

/** El "worker" de extracción: tras `EXTRACTION_MS` la recepción queda revisable. */
function tickExtraction(current: MockState) {
	if (current.status !== 'processing_document' || current.extractedAt === null) return;
	if (Date.now() < current.extractedAt) return;
	current.status = 'needs_document_review';
	current.lines = mockInitialLines();
	advanceIfUnblocked(current);
}

function requireState(receptionId: string): MockState {
	if (!state || state.id !== receptionId) throw notFound();
	tickExtraction(state);
	return state;
}

/* ---------------------------------------------------------------- */

export function createMockClient(): ApiClient {
	return {
		kind: 'mock',

		async getHealth(): Promise<HealthView> {
			await delay(LATENCY_MS);
			return structuredClone(MOCK_HEALTH_READY);
		},

		async getCatalog(): Promise<Catalog> {
			await delay(LATENCY_MS);
			const extra = state?.extraProducts ?? [];
			return {
				catalog_id: MOCK_CATALOG.catalog_id,
				products: [...MOCK_CATALOG.products, ...extra]
			};
		},

		async createReception(document: File): Promise<CreateReceptionAccepted> {
			await delay(LATENCY_MS * 2);

			const type = document.type.toLowerCase();
			if (type && !['image/jpeg', 'image/jpg', 'image/png'].includes(type)) {
				throw new ApiError(
					{
						code: 'INVALID_FILE',
						message: 'Solo puedo leer fotos JPG o PNG. Probá con otra imagen.',
						retryable: false,
						user_action: 'take_another_photo',
						trace_id: `trace_${MOCK_FIXTURE_MARKER}`,
						details: { received_type: document.type }
					},
					415
				);
			}

			const id = nextId('rec');
			state = {
				id,
				status: 'processing_document',
				created_at: new Date().toISOString(),
				filename: document.name || 'remito.jpg',
				extractedAt: Date.now() + EXTRACTION_MS,
				lines: [],
				unexpected: [],
				claim: null,
				frozenFacts: null,
				seenScanEvents: new Set<string>(),
				extraProducts: []
			};

			return {
				reception_id: id,
				status: 'processing_document',
				poll_url: `/api/v1/receptions/${id}`
			};
		},

		async getReception(receptionId: string): Promise<ReceptionView> {
			await delay(LATENCY_MS / 2);
			return toView(requireState(receptionId));
		},

		async answerQuestion(receptionId: string, payload: AnswerRequest): Promise<ReceptionView> {
			await delay(LATENCY_MS);
			const current = requireState(receptionId);

			const line = current.lines.find(
				(candidate) => candidate.match.question?.question_id === payload.question_id
			);
			if (!line || !line.match.question) {
				throw new ApiError(
					{
						code: 'QUESTION_ALREADY_RESOLVED',
						message: 'Esa pregunta ya fue respondida.',
						retryable: false,
						user_action: null,
						trace_id: `trace_${MOCK_FIXTURE_MARKER}`,
						details: {}
					},
					409
				);
			}

			// Whitelist: el SKU debe estar entre los candidatos de esa pregunta (PRD 8.5).
			const candidate = line.match.candidates.find((item) => item.sku === payload.selected_sku);
			if (!candidate) {
				throw new ApiError(
					{
						code: 'INVALID_MODEL_OUTPUT',
						message: 'Ese producto no está entre los candidatos de la pregunta.',
						retryable: false,
						user_action: null,
						trace_id: `trace_${MOCK_FIXTURE_MARKER}`,
						details: { selected_sku: payload.selected_sku }
					},
					422
				);
			}

			line.match = {
				...line.match,
				status: 'matched',
				selected_sku: candidate.sku,
				question: null,
				reason: 'Resuelto por la persona que recibe.'
			};

			advanceIfUnblocked(current);
			return toView(current);
		},

		async assignLine(
			receptionId: string,
			lineId: string,
			payload: AssignRequest
		): Promise<ReceptionView> {
			await delay(LATENCY_MS);
			const current = requireState(receptionId);

			const line = current.lines.find((item) => item.line_id === lineId);
			if (!line) throw notFound();

			if ('mark_unresolved' in payload) {
				line.match = {
					...line.match,
					status: 'unresolved',
					selected_sku: null,
					question: null,
					reason: 'Descartada por la persona que recibe.'
				};
			} else if ('new_product' in payload) {
				const { sku, name } = payload.new_product;
				const exists = [...MOCK_CATALOG.products, ...current.extraProducts].some(
					(product) => product.sku === sku
				);
				if (exists) {
					throw new ApiError(
						{
							code: 'SKU_ALREADY_EXISTS',
							message: `El SKU ${sku} ya existe en el catálogo.`,
							retryable: false,
							user_action: null,
							trace_id: `trace_${MOCK_FIXTURE_MARKER}`,
							details: { sku }
						},
						409
					);
				}
				current.extraProducts.push({
					sku,
					barcode: null,
					name,
					unit: 'unidad',
					attributes: {},
					created_during_reception: true
				});
				line.match = {
					...line.match,
					status: 'matched',
					selected_sku: sku,
					question: null,
					reason: 'Producto dado de alta durante la recepción.'
				};
			} else {
				const known = [...MOCK_CATALOG.products, ...current.extraProducts].some(
					(product) => product.sku === payload.sku
				);
				if (!known) throw notFound();
				line.match = {
					...line.match,
					status: 'matched',
					selected_sku: payload.sku,
					question: null,
					reason: 'Asignado manualmente desde el catálogo.'
				};
			}

			advanceIfUnblocked(current);
			return toView(current);
		},

		async registerScan(receptionId: string, payload: ScanRequest): Promise<ReceptionView> {
			await delay(LATENCY_MS / 2);
			const current = requireState(receptionId);

			if (current.status !== 'receiving') throw invalidTransition(current.status);

			// Idempotencia por `client_event_id` (PRD 8.7).
			if (current.seenScanEvents.has(payload.client_event_id)) return toView(current);
			current.seenScanEvents.add(payload.client_event_id);

			const raw = payload.barcode_or_sku.trim();
			const all = [...MOCK_CATALOG.products, ...current.extraProducts];
			const product = all.find((item) => item.sku === raw || item.barcode === raw);

			if (!product) {
				throw new ApiError(
					{
						code: 'UNKNOWN_BARCODE',
						message: `No reconozco el código "${raw}".`,
						retryable: false,
						user_action: null,
						trace_id: `trace_${MOCK_FIXTURE_MARKER}`,
						details: { barcode_or_sku: raw }
					},
					404
				);
			}

			const line = current.lines.find(
				(item) => item.match.status === 'matched' && item.match.selected_sku === product.sku
			);

			if (line) {
				line.counted_quantity += payload.quantity;
			} else {
				const existing = current.unexpected.find((item) => item.sku === product.sku);
				if (existing) existing.counted_quantity += payload.quantity;
				else
					current.unexpected.push({
						sku: product.sku,
						name: product.name,
						barcode_or_sku: raw,
						counted_quantity: payload.quantity
					});
			}

			return toView(current);
		},

		async finalize(receptionId: string): Promise<ReceptionView> {
			await delay(LATENCY_MS);
			const current = requireState(receptionId);
			if (current.status !== 'receiving') throw invalidTransition(current.status);

			const view = toView(current);
			current.frozenFacts = view.lines
				.filter((line) => line.discrepancy?.type === 'missing')
				.map((line) => ({
					sku: line.match.selected_sku ?? '',
					description: productName(current, line.match.selected_sku ?? ''),
					expected_quantity: line.expected_quantity ?? 0,
					counted_quantity: line.counted_quantity,
					missing_quantity: line.discrepancy?.missing_quantity ?? 0
				}));

			const hasDiscrepancies =
				current.frozenFacts.length > 0 ||
				view.summary.unexpected_units > 0 ||
				view.summary.missing_units > 0;

			current.status = hasDiscrepancies ? 'ready_to_claim' : 'closed';
			return toView(current);
		},

		async generateClaim(receptionId: string): Promise<Claim> {
			await delay(CLAIM_MS);
			const current = requireState(receptionId);
			if (current.status !== 'ready_to_claim') throw invalidTransition(current.status);

			const facts = current.frozenFacts ?? [];
			const table = facts
				.map(
					(fact) =>
						`- ${fact.description} (${fact.sku}): esperado ${fact.expected_quantity}, recibido ${fact.counted_quantity}, faltan ${fact.missing_quantity}.`
				)
				.join('\n');

			const claim: Claim = {
				claim_id: nextId('claim'),
				status: 'draft',
				subject: `Reclamo por faltante — Remito ${MOCK_DOCUMENT.remit_number}`,
				body: `${MOCK_CLAIM_PROSE.opening}\n\n${table}\n\n${MOCK_CLAIM_PROSE.closing}`,
				facts,
				grounding_status: 'validated',
				generated_by: 'mock_dev_adapter',
				trace_id: `trace_${MOCK_FIXTURE_MARKER}`
			};

			current.claim = claim;
			return claim;
		},

		async closeReception(receptionId: string): Promise<ReceptionView> {
			await delay(LATENCY_MS);
			const current = requireState(receptionId);
			if (current.status !== 'ready_to_claim') throw invalidTransition(current.status);
			current.status = 'closed';
			return toView(current);
		},

		async resetDemo(): Promise<void> {
			await delay(LATENCY_MS);
			state = null;
		},

		documentUrl(receptionId: string): string {
			return `/api/v1/receptions/${encodeURIComponent(receptionId)}/document`;
		}
	};
}
