/**
 * Punto de entrada ÚNICO de la capa cliente.
 *
 * Toda la app importa desde acá y nunca desde `http-client.ts` ni desde `mock/`.
 * El switch mock/real se resuelve una sola vez, en este archivo.
 *
 * Guard de build estricto (criterio FE-01):
 *   - `import.meta.env.DEV` es `false` en `vite build` → Vite lo reemplaza por
 *     una constante y Rollup elimina la rama completa, incluido el `import()`
 *     dinámico. El chunk del mock no se emite ni se referencia.
 *   - `VITE_REMITIA_API` solo se lee dentro de esa rama: definirla en producción
 *     no habilita nada.
 */

import { ApiError } from './errors';
import { API_PREFIX } from './http';
import { createHttpClient } from './http-client';
import type { ApiClient } from './contract';
import type { ReceptionStatus, ReceptionView } from './types';

export * from './types';
export { ApiError, hasUserAction, isApiError, userActionLabel } from './errors';
export { API_PREFIX, DEFAULT_TIMEOUT_MS, INFERENCE_TIMEOUT_MS } from './http';
export type { ApiClient, CallOptions } from './contract';

/** ¿Este bundle puede usar el adapter fake? Siempre `false` fuera de dev. */
export function isMockEnabled(): boolean {
	return import.meta.env.DEV && import.meta.env.VITE_REMITIA_API === 'mock';
}

let clientPromise: Promise<ApiClient> | null = null;

/** Resuelve (y memoiza) la implementación del contrato para toda la sesión. */
export function getApiClient(): Promise<ApiClient> {
	if (!clientPromise) {
		clientPromise = (async (): Promise<ApiClient> => {
			if (import.meta.env.DEV && import.meta.env.VITE_REMITIA_API === 'mock') {
				const { createMockClient } = await import('./mock/mock-client');
				return createMockClient();
			}
			return createHttpClient();
		})();
	}
	return clientPromise;
}

/** Solo para tests manuales en dev: fuerza recrear el cliente. */
export function resetApiClient(): void {
	clientPromise = null;
}

/** PRD 8.10 — ruta relativa del binario original; idéntica en ambos adapters. */
export function receptionDocumentUrl(receptionId: string): string {
	return `${API_PREFIX}/receptions/${encodeURIComponent(receptionId)}/document`;
}

/* ------------------------------------------------------------------ */
/* Polling (ADR-004)                                                   */
/* ------------------------------------------------------------------ */

/** ADR-004: la web consulta cada 750 ms. Sin WebSockets ni SSE. */
export const POLL_INTERVAL_MS = 750;

/**
 * Estados en los que todavía no hay nada que hacer más que esperar (PRD 7).
 * Mientras el `status` sea uno de estos, la web sigue consultando.
 */
export const TRANSIENT_STATUSES: readonly ReceptionStatus[] = ['draft', 'processing_document'];

/**
 * ¿El estado corta el polling? Corta en TERMINAL (`failed`, `closed`) y en
 * INTERACTIVO (`needs_document_review`, `receiving`, `ready_to_claim`): en todos
 * ellos la pantalla cambia y la siguiente novedad la produce la persona.
 *
 * La web solo OBSERVA el `status` publicado por la API; no infiere transiciones.
 */
export function stopsPolling(status: ReceptionStatus): boolean {
	return !TRANSIENT_STATUSES.includes(status);
}

/**
 * Techo de espera del cliente. No es una transición ni un cutoff de negocio: el
 * server sigue trabajando y su estado no cambia. Es el punto en el que la web
 * deja de preguntar sola y le ofrece a la persona volver a consultar, en vez de
 * dejar un spinner infinito. Muy por encima del cutoff de 60 s del PRD 16.3.
 */
export const POLL_MAX_WAIT_MS = 180_000;

/** Envelope del techo de espera. Dice la verdad: el servidor no se canceló. */
function pollGaveUpError(waitedMs: number): ApiError {
	const minutes = Math.round(waitedMs / 60_000);
	return new ApiError({
		code: 'CLIENT_TIMEOUT',
		message: `Dejé de consultar después de ${minutes} min. El servidor sigue procesando: podés volver a consultar.`,
		retryable: true,
		user_action: 'retry',
		details: { waited_ms: waitedMs }
	});
}

export interface PollOptions {
	intervalMs?: number;
	signal?: AbortSignal;
	/** Se llama con cada vista recibida, incluida la última. */
	onView?: (view: ReceptionView) => void;
	/** Corte por defecto: cualquier estado que no sea `draft` ni `processing_document`. */
	isDone?: (view: ReceptionView) => boolean;
	/** Errores retryables tolerados antes de abandonar. */
	maxTransientErrors?: number;
	/** Techo de espera del cliente; `0` lo desactiva. */
	maxWaitMs?: number;
}

const sleep = (ms: number, signal?: AbortSignal) =>
	new Promise<void>((resolve) => {
		const timer = setTimeout(resolve, ms);
		signal?.addEventListener(
			'abort',
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true }
		);
	});

/**
 * Consulta `GET /receptions/{id}` hasta que el estado deja de ser transitorio.
 * No decide transiciones: solo observa el `status` que publica la API.
 */
export async function pollReception(
	receptionId: string,
	options: PollOptions = {}
): Promise<ReceptionView> {
	const {
		intervalMs = POLL_INTERVAL_MS,
		signal,
		onView,
		isDone = (view: ReceptionView) => stopsPolling(view.status),
		maxTransientErrors = 4,
		maxWaitMs = POLL_MAX_WAIT_MS
	} = options;

	const client = await getApiClient();
	const startedAt = Date.now();
	let transientErrors = 0;

	for (;;) {
		if (signal?.aborted) throw new DOMException('Polling cancelado', 'AbortError');
		if (maxWaitMs > 0 && Date.now() - startedAt > maxWaitMs) throw pollGaveUpError(maxWaitMs);

		try {
			const view = await client.getReception(receptionId, { signal });
			onView?.(view);
			if (isDone(view)) return view;
			transientErrors = 0;
		} catch (error) {
			const retryable =
				typeof error === 'object' &&
				error !== null &&
				'retryable' in error &&
				(error as { retryable: boolean }).retryable;
			if (!retryable || transientErrors >= maxTransientErrors) throw error;
			transientErrors += 1;
		}

		await sleep(intervalMs, signal);
	}
}
