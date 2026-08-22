/**
 * Estado de las acciones de la pantalla de revisión, indexado POR LÍNEA.
 *
 * Es por línea a propósito: en el escenario A del PRD conviven una línea
 * ambigua y una sin candidato, y las dos pueden tener un POST en vuelo a la vez.
 * Con un `busy` o un error únicos y globales, el `finally` de una acción apagaría
 * el "Resolviendo…" de la otra y un rechazo se leería en la tarjeta equivocada.
 *
 * Además, el rechazo del servidor (PRD 8.11) —`SKU_ALREADY_EXISTS` es el caso
 * típico del flujo (c)— se muestra dentro de la tarjeta de esa línea y no en un
 * panel global lejos del botón que la persona acaba de tocar.
 */

import type { ApiError } from '$lib/api';

/** `line_id`s con un POST en vuelo. Solo lectura para las pantallas. */
export type BusyLines = ReadonlySet<string>;

/** Último rechazo del servidor por `line_id` (PRD 8.11). Solo lectura. */
export type LineErrors = ReadonlyMap<string, ApiError>;
