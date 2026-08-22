/**
 * Transporte HTTP único de la app.
 *
 * ADR-003 — mismo origen siempre: TODAS las rutas son relativas a `/api/v1`.
 * Este archivo es el único lugar del proyecto donde se llama a `fetch`.
 * No hay URLs absolutas, no hay CORS, no hay variables de entorno de host.
 */

import {
	ApiError,
	malformedResponseError,
	networkError,
	parseErrorEnvelope,
	timeoutError
} from './errors';

/** Prefijo del contrato público (PRD 8). Relativo: lo resuelve el origen actual. */
export const API_PREFIX = '/api/v1';

/** PRD 16.3 — UI no inferencial < 300 ms; este es el techo, no el objetivo. */
export const DEFAULT_TIMEOUT_MS = 15_000;

/** PRD 8.9 — endpoints con inferencia síncrona: timeout ≥ 60 s. */
export const INFERENCE_TIMEOUT_MS = 90_000;

export interface RequestOptions {
	method?: 'GET' | 'POST' | 'DELETE';
	/** JSON serializable, o `FormData` para `multipart/form-data` (PRD 8.3). */
	body?: unknown;
	signal?: AbortSignal;
	timeoutMs?: number;
	/** Reintentos automáticos ante error retryable. 0 = ninguno. */
	retries?: number;
	retryDelayMs?: number;
}

function joinPath(path: string): string {
	if (path.startsWith(API_PREFIX)) return path;
	return `${API_PREFIX}${path.startsWith('/') ? path : `/${path}`}`;
}

function linkSignals(external: AbortSignal | undefined, timeoutMs: number) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
	let detach = () => clearTimeout(timer);

	if (external) {
		if (external.aborted) controller.abort(external.reason);
		const onAbort = () => controller.abort(external.reason);
		external.addEventListener('abort', onAbort, { once: true });
		detach = () => {
			clearTimeout(timer);
			external.removeEventListener('abort', onAbort);
		};
	}

	return { signal: controller.signal, detach, timedOut: () => controller.signal.reason === 'timeout' };
}

async function readError(response: Response): Promise<ApiError> {
	let payload: unknown = null;
	try {
		payload = await response.json();
	} catch {
		payload = null;
	}

	const body = parseErrorEnvelope(payload);
	if (body) return new ApiError(body, response.status);

	// El backend siempre debería usar el envelope; si no, no inventamos un código suyo.
	return new ApiError(
		{
			code: 'UNKNOWN_ERROR',
			message: `El servidor respondió ${response.status}.`,
			retryable: response.status >= 500,
			user_action: response.status >= 500 ? 'retry' : null,
			details: {}
		},
		response.status
	);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function requestOnce<T>(path: string, options: RequestOptions): Promise<T> {
	const { method = 'GET', body, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
	const link = linkSignals(signal, timeoutMs);

	const init: RequestInit = { method, signal: link.signal };

	if (body instanceof FormData) {
		// Sin Content-Type manual: el browser pone el boundary del multipart.
		init.body = body;
	} else if (body !== undefined) {
		init.headers = { 'content-type': 'application/json' };
		init.body = JSON.stringify(body);
	}

	let response: Response;
	try {
		response = await fetch(joinPath(path), init);
	} catch (cause) {
		if (link.timedOut()) throw timeoutError(timeoutMs);
		if (signal?.aborted) throw cause;
		throw networkError(cause);
	} finally {
		link.detach();
	}

	if (!response.ok) throw await readError(response);

	if (response.status === 204) return undefined as T;

	const contentType = response.headers.get('content-type') ?? '';
	if (!contentType.includes('application/json')) {
		throw malformedResponseError(response.status);
	}

	try {
		return (await response.json()) as T;
	} catch {
		throw malformedResponseError(response.status);
	}
}

/**
 * Request con retry acotado. Solo reintenta errores marcados `retryable` por el
 * envelope del PRD (o fallos de red/timeout del cliente). Sin retry infinito
 * ni llamadas paralelas (PRD 10.5).
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
	const retries = options.retries ?? 0;
	const retryDelayMs = options.retryDelayMs ?? 600;

	let attempt = 0;
	for (;;) {
		try {
			return await requestOnce<T>(path, options);
		} catch (error) {
			const canRetry =
				attempt < retries && error instanceof ApiError && error.retryable && !options.signal?.aborted;
			if (!canRetry) throw error;
			attempt += 1;
			await sleep(retryDelayMs * attempt);
		}
	}
}
