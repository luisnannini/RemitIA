/**
 * Validación LOCAL del archivo antes de subirlo (PRD 8.3: JPG o PNG, máximo 12 MB).
 *
 * Esto es UX, no negocio: evita empujar 12 MB por una subida condenada a fallar y
 * da un mensaje inmediato en el mismo gesto de elegir la foto. La fuente de verdad
 * sigue siendo FastAPI, que valida igual y puede rechazar con `INVALID_FILE` algo
 * que acá pase (por ejemplo un JPG corrupto o un HEIC renombrado a `.jpg`).
 *
 * Regla: acá no se decide nada de negocio ni se anticipa una transición. Solo se
 * responde "¿esto tiene forma de lo que el contrato pide?".
 */

/** PRD 8.3 — `document`: JPG o PNG, obligatorio, máximo 12 MB. */
export const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;

/** MIME aceptados por el contrato. HEIC no convertible se rechaza (PRD 8.3). */
export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png'] as const;

/** Valor del atributo `accept` del input de captura. */
export const DOCUMENT_ACCEPT = 'image/jpeg,image/png';

/**
 * Algunos pickers de Android devuelven `type: ''`. En ese caso se mira la
 * extensión antes de rechazar: es preferible dejar pasar y que el server
 * (que verifica el MIME real del binario) decida, a bloquear una foto válida.
 */
const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

export type DocumentIssueReason = 'type' | 'size' | 'empty';

export interface DocumentIssue {
	reason: DocumentIssueReason;
	/** Texto listo para mostrar, en español y sin jerga técnica. */
	message: string;
}

/** Tamaño legible para la ficha del archivo elegido. */
export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes < 0) return '—';
	if (bytes < 1024) return `${bytes} B`;
	const kb = bytes / 1024;
	if (kb < 1024) return `${kb.toFixed(0)} kB`;
	return `${(kb / 1024).toFixed(1)} MB`;
}

function hasAcceptedExtension(name: string): boolean {
	const lower = name.toLowerCase();
	return ACCEPTED_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/**
 * `null` si el archivo tiene forma de lo que pide el contrato; si no, el motivo.
 * No lanza: la UI decide cómo mostrarlo.
 */
export function validateDocumentFile(file: File): DocumentIssue | null {
	if (file.size === 0) {
		return {
			reason: 'empty',
			message: 'El archivo está vacío. Volvé a sacar la foto.'
		};
	}

	const type = file.type.toLowerCase();
	const typeIsKnown = type.length > 0;
	const typeIsAccepted = (ACCEPTED_MIME_TYPES as readonly string[]).includes(
		type === 'image/jpg' ? 'image/jpeg' : type
	);

	if (typeIsKnown ? !typeIsAccepted : !hasAcceptedExtension(file.name)) {
		return {
			reason: 'type',
			message: 'Solo puedo leer fotos JPG o PNG. Elegí otra imagen o volvé a sacar la foto.'
		};
	}

	if (file.size > MAX_DOCUMENT_BYTES) {
		return {
			reason: 'size',
			message: `La foto pesa ${formatBytes(file.size)} y el máximo es 12 MB. Sacala de nuevo con menos resolución.`
		};
	}

	return null;
}
