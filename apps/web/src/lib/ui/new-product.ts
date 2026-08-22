/**
 * Alta de SKU nueva (flujo c, PRD 8.6) — validación de FORMA en el cliente.
 *
 * Límites deliberados:
 *   - Esto no decide nada de negocio: la unicidad del SKU la valida la API y su
 *     rechazo llega como `SKU_ALREADY_EXISTS` (PRD 8.11), que la línea muestra
 *     tal cual. Por eso el duplicado detectado con el catálogo ya cargado es un
 *     AVISO, no un bloqueo: si bloqueáramos, el error del servidor nunca se
 *     podría ver ni demostrar.
 *   - El alta es una acción humana explícita (PRD 1.4 regla 2): nada de esto se
 *     autocompleta a partir de la salida del modelo.
 */

/**
 * SKU: mayúsculas, dígitos y guiones. Sin espacios ni símbolos.
 *
 * Acepta a propósito lo que la normalización en vivo puede dejar a mitad de
 * tipeo (un guion final): los guiones del borde los recorta
 * `normalizeSkuInput` antes de validar y de enviar, no un mensaje de error.
 */
export const SKU_PATTERN = /^[A-Z0-9][A-Z0-9-]*$/;

/**
 * Normaliza MIENTRAS se tipea: mayúsculas, espacios convertidos en guiones y
 * guiones consecutivos colapsados en uno. Escribir "codo pvc 110" en el celular
 * deja `CODO-PVC-110` sin pelear con el teclado.
 *
 * Recorta el guion del principio pero NO el del final: si al tipear "SKU-" el
 * guion desapareciera en la misma tecla, escribir "SKU-01" sería imposible.
 */
export function normalizeSkuTyping(raw: string): string {
	return raw
		.toUpperCase()
		.replace(/[\s-]+/g, '-')
		.replace(/^-+/, '');
}

/**
 * Forma FINAL del SKU (blur y envío): lo anterior más el recorte del guion del
 * final, que en vivo molestaría al tipear. Es idempotente y es lo único que se
 * manda a la API.
 */
export function normalizeSkuInput(raw: string): string {
	return normalizeSkuTyping(raw).replace(/-+$/, '');
}

/** Mensaje de error del campo SKU, o `null` si está bien. `null` también si está vacío y todavía no se tocó. */
export function skuFieldError(sku: string): string | null {
	if (!sku) return 'Escribí el SKU nuevo.';
	if (!SKU_PATTERN.test(sku)) return 'Solo mayúsculas, números y guiones. Sin espacios.';
	return null;
}

/** Mensaje de error del campo nombre, o `null` si está bien. */
export function nameFieldError(name: string): string | null {
	if (!name.trim()) return 'Escribí el nombre del producto.';
	return null;
}
