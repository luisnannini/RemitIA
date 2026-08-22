/**
 * Interfaz del cliente de contrato. La implementan exactamente dos módulos:
 *   - `http-client.ts`  → FastAPI real, rutas relativas `/api/v1` (PRD 8).
 *   - `mock/mock-client.ts` → adapter fake, SOLO desarrollo (PRD ADR-006).
 *
 * Cualquier pantalla depende de esta interfaz, nunca de una implementación.
 */

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

export interface CallOptions {
	signal?: AbortSignal;
}

export interface ApiClient {
	/** Identifica el origen de los datos para el badge de la UI. */
	readonly kind: 'http' | 'mock';

	/** PRD 8.1 */
	getHealth(options?: CallOptions): Promise<HealthView>;
	/** PRD 8.2 — la web lo carga una vez y filtra client-side. */
	getCatalog(options?: CallOptions): Promise<Catalog>;
	/** PRD 8.3 — multipart, responde 202. */
	createReception(document: File, options?: CallOptions): Promise<CreateReceptionAccepted>;
	/** PRD 8.4 — vista canónica. */
	getReception(receptionId: string, options?: CallOptions): Promise<ReceptionView>;
	/** PRD 8.5 — flujo (b). */
	answerQuestion(
		receptionId: string,
		payload: AnswerRequest,
		options?: CallOptions
	): Promise<ReceptionView>;
	/** PRD 8.6 — flujo (c). */
	assignLine(
		receptionId: string,
		lineId: string,
		payload: AssignRequest,
		options?: CallOptions
	): Promise<ReceptionView>;
	/** PRD 8.7 */
	registerScan(
		receptionId: string,
		payload: ScanRequest,
		options?: CallOptions
	): Promise<ReceptionView>;
	/** PRD 8.8 — congela el snapshot en el servidor. */
	finalize(receptionId: string, options?: CallOptions): Promise<ReceptionView>;
	/** PRD 8.9 — inferencia síncrona, puede tardar decenas de segundos. */
	generateClaim(receptionId: string, options?: CallOptions): Promise<Claim>;
	/** PRD 8.9 */
	closeReception(receptionId: string, options?: CallOptions): Promise<ReceptionView>;
	/** PRD 8.10 — 204. */
	resetDemo(options?: CallOptions): Promise<void>;
	/** PRD 8.10 — URL relativa del binario original. */
	documentUrl(receptionId: string): string;
}
