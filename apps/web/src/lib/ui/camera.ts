/**
 * Problemas LOCALES de la cámara (FE-05).
 *
 * Nada de esto sale del backend: son fallas del navegador, del permiso del
 * dispositivo o del contexto no seguro. Por eso NO usan el envelope de error
 * del PRD 8.11 ni el `ErrorPanel` global — se muestran adentro del overlay,
 * con texto humano y una salida concreta. Nunca un stack trace.
 *
 * Mismo criterio que `$lib/ui/document-file`: la validación local es UX, no
 * negocio, y se distingue a propósito de un rechazo del servidor.
 */

export interface CameraProblem {
	/** Qué pasó, en una línea. */
	title: string;
	/** Qué puede hacer la persona ahora. */
	hint: string;
	/** `true` si volver a pedir la cámara puede cambiar el resultado. */
	retry: boolean;
}

/** Salida siempre disponible: el input de teclado sigue vivo detrás del overlay. */
const FALLBACK = 'Podés cerrar y escribir el código a mano.';

/** El navegador no expone `BarcodeDetector` (Firefox, Safari). */
export const CAMERA_UNSUPPORTED: CameraProblem = {
	title: 'Este navegador no sabe leer códigos de barras',
	hint: `El escaneo por cámara necesita Chrome en Android o en escritorio. ${FALLBACK}`,
	retry: false
};

/**
 * `navigator.mediaDevices` no existe: la página no está en un contexto seguro
 * (HTTP en una IP de la LAN es el caso típico al probar desde el celular).
 */
export const CAMERA_INSECURE: CameraProblem = {
	title: 'La cámara no está disponible en esta dirección',
	hint: `El navegador solo la habilita en HTTPS o en localhost. ${FALLBACK}`,
	retry: false
};

/** Lee `name` de un rechazo desconocido sin asumir que sea una `DOMException`. */
function errorName(cause: unknown): string {
	if (typeof cause === 'object' && cause !== null && 'name' in cause) {
		const name = (cause as { name?: unknown }).name;
		if (typeof name === 'string') return name;
	}
	return '';
}

/**
 * Traduce el rechazo de `getUserMedia` a algo accionable.
 * Nombres según la especificación de `MediaDevices.getUserMedia()`.
 */
export function cameraProblem(cause: unknown): CameraProblem {
	switch (errorName(cause)) {
		case 'NotAllowedError':
		case 'PermissionDeniedError':
		case 'SecurityError':
			return {
				title: 'No hay permiso para usar la cámara',
				hint: `Habilitala para este sitio (candado en la barra de direcciones) y reintentá. ${FALLBACK}`,
				retry: true
			};
		case 'NotFoundError':
		case 'DevicesNotFoundError':
		case 'OverconstrainedError':
			return {
				title: 'No encontré una cámara en este dispositivo',
				hint: `Probá desde el celular, o ${FALLBACK.toLowerCase()}`,
				retry: true
			};
		case 'NotReadableError':
		case 'TrackStartError':
		case 'AbortError':
			return {
				title: 'La cámara está ocupada por otra aplicación',
				hint: `Cerrá la otra app o pestaña que la esté usando y reintentá. ${FALLBACK}`,
				retry: true
			};
		default:
			return {
				title: 'No se pudo abrir la cámara',
				hint: FALLBACK,
				retry: true
			};
	}
}
