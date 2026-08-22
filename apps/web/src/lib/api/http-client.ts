/**
 * Cliente real del contrato público. Todas las rutas son relativas (ADR-003).
 */

import { API_PREFIX, apiFetch, DEFAULT_TIMEOUT_MS, INFERENCE_TIMEOUT_MS } from './http';
import type { ApiClient, CallOptions } from './contract';
import type {
	AnswerRequest,
	AssignRequest,
	Catalog,
	Claim,
	CreateReceptionAccepted,
	HealthView,
	ReceptionView,
	ScanRequest
} from './types';

const receptionPath = (receptionId: string) =>
	`/receptions/${encodeURIComponent(receptionId)}`;

export function createHttpClient(): ApiClient {
	return {
		kind: 'http',

		getHealth(options: CallOptions = {}) {
			return apiFetch<HealthView>('/health', {
				signal: options.signal,
				timeoutMs: 8_000,
				retries: 1
			});
		},

		getCatalog(options: CallOptions = {}) {
			return apiFetch<Catalog>('/catalog', {
				signal: options.signal,
				retries: 1
			});
		},

		createReception(document: File, options: CallOptions = {}) {
			const form = new FormData();
			form.append('document', document, document.name);
			// Sin Idempotency-Key: la web deshabilita el botón tras el primer toque (PRD 8.3).
			return apiFetch<CreateReceptionAccepted>('/receptions', {
				method: 'POST',
				body: form,
				signal: options.signal,
				timeoutMs: 60_000,
				retries: 0
			});
		},

		getReception(receptionId: string, options: CallOptions = {}) {
			return apiFetch<ReceptionView>(receptionPath(receptionId), {
				signal: options.signal,
				timeoutMs: DEFAULT_TIMEOUT_MS,
				retries: 1
			});
		},

		answerQuestion(receptionId: string, payload: AnswerRequest, options: CallOptions = {}) {
			return apiFetch<ReceptionView>(`${receptionPath(receptionId)}/answers`, {
				method: 'POST',
				body: payload,
				signal: options.signal,
				retries: 0
			});
		},

		assignLine(
			receptionId: string,
			lineId: string,
			payload: AssignRequest,
			options: CallOptions = {}
		) {
			return apiFetch<ReceptionView>(
				`${receptionPath(receptionId)}/lines/${encodeURIComponent(lineId)}/assign`,
				{
					method: 'POST',
					body: payload,
					signal: options.signal,
					retries: 0
				}
			);
		},

		registerScan(receptionId: string, payload: ScanRequest, options: CallOptions = {}) {
			// Idempotente por `client_event_id`: reintentar es seguro (PRD 8.7).
			return apiFetch<ReceptionView>(`${receptionPath(receptionId)}/scans`, {
				method: 'POST',
				body: payload,
				signal: options.signal,
				retries: 1
			});
		},

		finalize(receptionId: string, options: CallOptions = {}) {
			return apiFetch<ReceptionView>(`${receptionPath(receptionId)}/finalize`, {
				method: 'POST',
				body: {},
				signal: options.signal,
				retries: 0
			});
		},

		generateClaim(receptionId: string, options: CallOptions = {}) {
			return apiFetch<Claim>(`${receptionPath(receptionId)}/claim`, {
				method: 'POST',
				body: {},
				signal: options.signal,
				timeoutMs: INFERENCE_TIMEOUT_MS,
				retries: 0
			});
		},

		closeReception(receptionId: string, options: CallOptions = {}) {
			return apiFetch<ReceptionView>(`${receptionPath(receptionId)}/close`, {
				method: 'POST',
				body: {},
				signal: options.signal,
				retries: 0
			});
		},

		async resetDemo(options: CallOptions = {}) {
			await apiFetch<void>('/demo/reset', {
				method: 'POST',
				signal: options.signal,
				retries: 0
			});
		},

		documentUrl(receptionId: string) {
			return `${API_PREFIX}${receptionPath(receptionId)}/document`;
		}
	};
}
