/**
 * Tipos del CONTRATO PÚBLICO `/api/v1` — PRD v1.4, secciones 7 y 8.
 *
 * Fuente de verdad real: modelos Pydantic de `apps/api` (ADR-006). Este archivo
 * es su reflejo tipado para el cliente; si algo diverge, manda Pydantic y estos
 * tipos se corrigen (no al revés).
 *
 * Regla dura: la web NO deriva estado de negocio de estos datos. Renderiza lo
 * que llega. Ningún cálculo de reconciliación vive acá.
 */

/* ------------------------------------------------------------------ */
/* Máquina de estados (PRD 7)                                          */
/* ------------------------------------------------------------------ */

/** Estados canónicos. No crear sinónimos. No existe `verifying`. */
export type ReceptionStatus =
	| 'draft'
	| 'processing_document'
	| 'failed'
	| 'needs_document_review'
	| 'receiving'
	| 'ready_to_claim'
	| 'closed';

export const RECEPTION_STATUSES: readonly ReceptionStatus[] = [
	'draft',
	'processing_document',
	'failed',
	'needs_document_review',
	'receiving',
	'ready_to_claim',
	'closed'
] as const;

/** PRD 8.4 — `match.status`. */
export type MatchStatus = 'matched' | 'ambiguous' | 'unmatched' | 'unresolved';

/** PRD 8.4 — `discrepancy.type`. */
export type DiscrepancyType = 'ok' | 'missing' | 'over';

/** P0 admite solo selección de candidato (PRD 8.5). `text` es P1. */
export type AnswerMode = 'choice';

/* ------------------------------------------------------------------ */
/* Salud (PRD 8.1)                                                     */
/* ------------------------------------------------------------------ */

export type ServiceStatus = 'starting' | 'ready' | 'degraded';

export interface HealthModel {
	capability: string;
	name: string;
	loaded: boolean;
}

export interface QvacHealth {
	status: ServiceStatus;
	local: boolean;
	models: HealthModel[];
}

export interface HealthView {
	status: ServiceStatus;
	api: ServiceStatus;
	database: ServiceStatus;
	qvac: QvacHealth;
}

/* ------------------------------------------------------------------ */
/* Catálogo (PRD 8.2 / 15.1)                                           */
/* ------------------------------------------------------------------ */

export type AttributeValue = string | number | boolean | null;

export interface CatalogProduct {
	sku: string;
	barcode: string | null;
	name: string;
	unit: string;
	aliases?: string[];
	attributes: Record<string, AttributeValue>;
	created_during_reception?: boolean;
}

export interface Catalog {
	catalog_id: string;
	products: CatalogProduct[];
}

/* ------------------------------------------------------------------ */
/* ReceptionView (PRD 8.4) — la vista canónica que consume la web      */
/* ------------------------------------------------------------------ */

export interface MatchCandidate {
	sku: string;
	name: string;
	attributes?: Record<string, AttributeValue>;
}

export interface ClarificationQuestion {
	question_id: string;
	text: string;
	answer_mode: AnswerMode;
}

export interface LineMatch {
	status: MatchStatus;
	selected_sku: string | null;
	/** Score lexical calculado por la API (ADR-010). Nunca lo declara el LLM. */
	score: number | null;
	candidates: MatchCandidate[];
	question: ClarificationQuestion | null;
	reason: string | null;
}

export interface LineEvidence {
	block_ids: string[];
	confidence: number | null;
}

export interface Discrepancy {
	type: DiscrepancyType;
	missing_quantity?: number;
	over_quantity?: number;
}

export interface ReceptionLine {
	line_id: string;
	source_text: string;
	evidence: LineEvidence | null;
	expected_quantity: number | null;
	unit: string | null;
	match: LineMatch;
	counted_quantity: number;
	discrepancy: Discrepancy | null;
}

/**
 * PRD 8.7 — SKU escaneado que no estaba en el remito. La forma exacta la fija
 * Rachid en Pydantic; se tipa de forma tolerante hasta el freeze de Gate 0.
 */
export interface UnexpectedItem {
	sku: string | null;
	name: string | null;
	barcode_or_sku?: string;
	counted_quantity: number;
}

export interface ReceptionSummary {
	expected_lines: number;
	resolved_lines: number;
	units_expected: number;
	units_counted: number;
	missing_units: number;
	unexpected_units: number;
}

export interface ReceptionDocument {
	filename: string;
	/** Ruta relativa servida por la API (PRD 8.10). Nunca un path del cliente. */
	preview_url: string;
	provider_name: string | null;
	remit_number: string | null;
	ocr_quality: number | null;
	warnings: string[];
}

/* ------------------------------------------------------------------ */
/* Reclamo (PRD 8.9)                                                   */
/* ------------------------------------------------------------------ */

export interface ClaimFact {
	sku: string;
	description: string;
	expected_quantity: number;
	counted_quantity: number;
	missing_quantity: number;
}

export type ClaimGroundingStatus = 'validated' | 'safe_fallback';

export interface Claim {
	claim_id: string;
	/** La UI dice "borrador listo", nunca "enviado" (PRD 17). */
	status: 'draft';
	subject: string;
	body: string;
	facts: ClaimFact[];
	grounding_status: ClaimGroundingStatus;
	generated_by: string;
	trace_id: string;
}

export interface ReceptionView {
	id: string;
	status: ReceptionStatus;
	created_at: string;
	document: ReceptionDocument | null;
	lines: ReceptionLine[];
	unexpected_items: UnexpectedItem[];
	summary: ReceptionSummary;
	claim: Claim | null;
	latest_trace_id: string | null;
}

/* ------------------------------------------------------------------ */
/* Requests (PRD 8.3, 8.5, 8.6, 8.7)                                   */
/* ------------------------------------------------------------------ */

/** PRD 8.3 — respuesta `202` de `POST /receptions`. */
export interface CreateReceptionAccepted {
	reception_id: string;
	status: ReceptionStatus;
	poll_url: string;
}

/** PRD 8.5 — flujo (b): solo selección de candidato. */
export interface AnswerRequest {
	question_id: string;
	selected_sku: string;
}

/** PRD 8.6 — flujo (c): exactamente una de las tres formas. */
export type AssignRequest =
	| { sku: string }
	| { new_product: { sku: string; name: string } }
	| { mark_unresolved: true };

/** PRD 8.7 — escaneo idempotente por `client_event_id`. */
export interface ScanRequest {
	client_event_id: string;
	barcode_or_sku: string;
	quantity: number;
}

/* ------------------------------------------------------------------ */
/* Envelope de error (PRD 8.11)                                        */
/* ------------------------------------------------------------------ */

/** Códigos mínimos del PRD + los sintéticos que produce el cliente. */
export type ApiErrorCode =
	| 'INVALID_FILE'
	| 'DOCUMENT_LOW_QUALITY'
	| 'QVAC_NOT_READY'
	| 'QVAC_TIMEOUT'
	| 'INVALID_MODEL_OUTPUT'
	| 'INVALID_STATE_TRANSITION'
	| 'UNKNOWN_BARCODE'
	| 'QUESTION_ALREADY_RESOLVED'
	| 'SKU_ALREADY_EXISTS'
	| 'RECEPTION_NOT_FOUND'
	/* sintéticos del cliente — no vienen del backend */
	| 'NETWORK_ERROR'
	| 'CLIENT_TIMEOUT'
	| 'MALFORMED_RESPONSE'
	| 'UNKNOWN_ERROR';

export type UserAction =
	| 'take_another_photo'
	| 'retry'
	| 'contact_support'
	| 'start_over'
	| string;

export interface ApiErrorBody {
	code: ApiErrorCode | string;
	message: string;
	retryable: boolean;
	user_action?: UserAction | null;
	trace_id?: string | null;
	details?: Record<string, unknown>;
}

export interface ApiErrorEnvelope {
	error: ApiErrorBody;
}
