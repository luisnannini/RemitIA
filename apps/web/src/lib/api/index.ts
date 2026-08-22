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

import { API_PREFIX } from './http';
import { createHttpClient } from './http-client';
import type { ApiClient } from './contract';
import type { ReceptionView } from './types';

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
/* Polling (ADR-004) — helper preparado para FE-02                     */
/* ------------------------------------------------------------------ */

/** ADR-004: la web consulta cada 750 ms. Sin WebSockets ni SSE. */
export const POLL_INTERVAL_MS = 750;

export interface PollOptions {
	intervalMs?: number;
	signal?: AbortSignal;
	/** Se llama con cada vista recibida, incluida la última. */
	onView?: (view: ReceptionView) => void;
	/** Corte por defecto: cualquier estado distinto de `processing_document`. */
	isDone?: (view: ReceptionView) => boolean;
	/** Errores retryables tolerados antes de abandonar. */
	maxTransientErrors?: number;
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
		isDone = (view: ReceptionView) => view.status !== 'processing_document',
		maxTransientErrors = 4
	} = options;

	const client = await getApiClient();
	let transientErrors = 0;

	for (;;) {
		if (signal?.aborted) throw new DOMException('Polling cancelado', 'AbortError');

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
