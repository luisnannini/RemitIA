/**
 * Etiquetas en español para los valores canónicos del contrato.
 *
 * Es traducción de presentación, no lógica: no deriva ni infiere estado. Si la
 * API agrega un valor, acá se agrega su texto y nada más.
 */

import type { DiscrepancyType, MatchStatus, ReceptionStatus, ServiceStatus } from '$lib/api';

export const receptionStatusLabel: Record<ReceptionStatus, string> = {
	draft: 'Borrador',
	processing_document: 'Procesando documento',
	failed: 'No se pudo procesar',
	needs_document_review: 'Revisión del remito',
	receiving: 'Recepción guiada',
	ready_to_claim: 'Listo para reclamar',
	closed: 'Cerrada'
};

export const matchStatusLabel: Record<MatchStatus, string> = {
	matched: 'Resuelta',
	ambiguous: 'Necesita una respuesta',
	unmatched: 'Sin candidato',
	unresolved: 'Descartada'
};

export const matchStatusHint: Record<MatchStatus, string> = {
	matched: 'Relacionada con un producto del catálogo.',
	ambiguous: 'RemitIA encontró más de un producto posible.',
	unmatched: 'Ningún producto del catálogo se parece lo suficiente.',
	unresolved: 'No participa del conteo ni del resumen.'
};

/** Clases Tailwind por estado de match. Mismo orden semántico en toda la app. */
export const matchStatusTone: Record<MatchStatus, string> = {
	matched: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30',
	ambiguous: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30',
	unmatched: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30',
	unresolved: 'bg-slate-500/15 text-slate-400 ring-1 ring-slate-400/25'
};

export const discrepancyLabel: Record<DiscrepancyType, string> = {
	ok: 'Completo',
	missing: 'Faltante',
	over: 'Sobrante'
};

export const discrepancyTone: Record<DiscrepancyType, string> = {
	ok: 'text-emerald-300',
	missing: 'text-rose-300',
	over: 'text-amber-300'
};

export const serviceStatusLabel: Record<ServiceStatus, string> = {
	starting: 'Iniciando',
	ready: 'Listo',
	degraded: 'Degradado'
};

/** Formatea un score/confianza [0,1] como porcentaje entero. */
export function asPercent(value: number | null | undefined): string | null {
	if (value === null || value === undefined || Number.isNaN(value)) return null;
	return `${Math.round(value * 100)}%`;
}

/** Identificador de evento de escaneo, idempotente por intento (PRD 8.7). */
export function newClientEventId(): string {
	const random =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID()
			: Math.random().toString(36).slice(2);
	return `scan_${random}`;
}
