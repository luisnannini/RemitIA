/**
 * Envelope de error común (PRD 8.11) normalizado a una sola clase.
 *
 * La web muestra `message` y una acción humana; nunca stack traces (PRD 8.11).
 */

import type { ApiErrorBody, ApiErrorCode, UserAction } from './types';

export class ApiError extends Error {
	readonly code: ApiErrorCode | string;
	readonly retryable: boolean;
	readonly userAction: UserAction | null;
	readonly traceId: string | null;
	readonly details: Record<string, unknown>;
	/** Status HTTP cuando lo hubo; `0` para fallos de red o timeout del cliente. */
	readonly httpStatus: number;

	constructor(body: ApiErrorBody, httpStatus = 0) {
		super(body.message);
		this.name = 'ApiError';
		this.code = body.code;
		this.retryable = body.retryable;
		this.userAction = body.user_action ?? null;
		this.traceId = body.trace_id ?? null;
		this.details = body.details ?? {};
		this.httpStatus = httpStatus;
	}
}

export function isApiError(value: unknown): value is ApiError {
	return value instanceof ApiError;
}

/** Valida la forma del envelope antes de confiar en él. */
export function parseErrorEnvelope(payload: unknown): ApiErrorBody | null {
	if (typeof payload !== 'object' || payload === null) return null;
	const envelope = payload as { error?: unknown };
	if (typeof envelope.error !== 'object' || envelope.error === null) return null;

	const error = envelope.error as Partial<ApiErrorBody>;
	if (typeof error.code !== 'string' || typeof error.message !== 'string') return null;

	return {
		code: error.code,
		message: error.message,
		retryable: typeof error.retryable === 'boolean' ? error.retryable : false,
		user_action: typeof error.user_action === 'string' ? error.user_action : null,
		trace_id: typeof error.trace_id === 'string' ? error.trace_id : null,
		details:
			typeof error.details === 'object' && error.details !== null
				? (error.details as Record<string, unknown>)
				: {}
	};
}

/** Errores sintéticos del cliente: mismo envelope, sin inventar códigos del backend. */
export function networkError(cause?: unknown): ApiError {
	return new ApiError({
		code: 'NETWORK_ERROR',
		message: 'No pude conectarme con el servidor local. Verificá que RemitIA esté corriendo.',
		retryable: true,
		user_action: 'retry',
		details: cause instanceof Error ? { reason: cause.message } : {}
	});
}

export function timeoutError(timeoutMs: number): ApiError {
	return new ApiError({
		code: 'CLIENT_TIMEOUT',
		message: `La operación superó los ${Math.round(timeoutMs / 1000)} segundos y se canceló.`,
		retryable: true,
		user_action: 'retry',
		details: { timeout_ms: timeoutMs }
	});
}

export function malformedResponseError(httpStatus: number): ApiError {
	return new ApiError(
		{
			code: 'MALFORMED_RESPONSE',
			message: 'El servidor respondió algo que no pude interpretar.',
			retryable: true,
			user_action: 'retry',
			details: {}
		},
		httpStatus
	);
}

/**
 * ¿El envelope habilita alguna acción para la persona? (PRD 8.11)
 *
 * `retryable: true` → reintentar sirve. `user_action` no nulo → hay una acción
 * humana concreta ("sacar otra foto", "empezar de nuevo"…). Con
 * `retryable: false` + `user_action: null` no hay nada que ofrecer: mostrar un
 * botón ahí contradice el propio texto "No se puede reintentar automáticamente".
 */
export function hasUserAction(error: ApiError): boolean {
	return error.retryable || error.userAction !== null;
}

/** Texto del botón de acción según `user_action` del envelope. */
export function userActionLabel(action: UserAction | null): string {
	switch (action) {
		case 'take_another_photo':
			return 'Sacar otra foto';
		case 'start_over':
			return 'Empezar de nuevo';
		case 'contact_support':
			return 'Ver detalle';
		case 'retry':
		default:
			return 'Reintentar';
	}
}
