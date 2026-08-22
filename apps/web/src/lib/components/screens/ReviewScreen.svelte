<script lang="ts">
	/**
	 * Pantalla 3 — REVISIÓN (PRD 11.1).
	 * Documento + líneas con los cuatro estados canónicos y los tres flujos.
	 * FE-01 deja el esqueleto navegable; FE-03 completa evidencia y validaciones.
	 *
	 * Cero lógica de negocio: los contadores salen de `view.summary`.
	 */
	import type { AssignRequest, CatalogProduct, ReceptionView } from '$lib/api';
	import { receptionDocumentUrl } from '$lib/api';
	import LineCard from '$lib/components/LineCard.svelte';

	interface Props {
		view: ReceptionView;
		products: CatalogProduct[];
		busyLineId: string | null;
		onanswer: (questionId: string, selectedSku: string) => void;
		onassign: (lineId: string, payload: AssignRequest) => void;
	}

	let { view, products, busyLineId, onanswer, onassign }: Props = $props();

	let showDocument = $state(false);
	let documentSrc = $derived(receptionDocumentUrl(view.id));
</script>

<div class="grid gap-4">
	<section class="card">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h1 class="text-lg font-bold text-white">Revisá lo que dice el remito</h1>
				<p class="mt-0.5 text-sm text-slate-400">
					{view.document?.provider_name ?? 'Proveedor sin identificar'}
					{#if view.document?.remit_number}
						· Remito {view.document.remit_number}
					{/if}
				</p>
			</div>
			<button
				type="button"
				class="btn-secondary px-3 text-xs"
				onclick={() => (showDocument = !showDocument)}
			>
				{showDocument ? 'Ocultar foto' : 'Ver foto'}
			</button>
		</div>

		{#if showDocument}
			<!-- PRD 8.10: el binario se sirve desde la API, nunca desde un path del cliente. -->
			<img
				src={documentSrc}
				alt="Foto original del remito"
				class="mt-3 w-full rounded-xl border border-white/10 bg-black/40 object-contain"
				loading="lazy"
			/>
		{/if}

		<dl class="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
			<div class="rounded-lg bg-black/25 px-2.5 py-2">
				<dt class="text-slate-500">Líneas</dt>
				<dd class="tnum text-base font-bold text-slate-100">{view.summary.expected_lines}</dd>
			</div>
			<div class="rounded-lg bg-black/25 px-2.5 py-2">
				<dt class="text-slate-500">Resueltas</dt>
				<dd class="tnum text-base font-bold text-emerald-300">{view.summary.resolved_lines}</dd>
			</div>
			<div class="rounded-lg bg-black/25 px-2.5 py-2">
				<dt class="text-slate-500">Unidades esperadas</dt>
				<dd class="tnum text-base font-bold text-slate-100">{view.summary.units_expected}</dd>
			</div>
			<div class="rounded-lg bg-black/25 px-2.5 py-2">
				<dt class="text-slate-500">Calidad OCR</dt>
				<dd class="tnum text-base font-bold text-slate-100">
					{view.document?.ocr_quality !== null && view.document?.ocr_quality !== undefined
						? `${Math.round(view.document.ocr_quality * 100)}%`
						: '—'}
				</dd>
			</div>
		</dl>

		{#if view.document?.warnings?.length}
			<ul class="mt-2.5 grid gap-1">
				{#each view.document.warnings as warning (warning)}
					<li class="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200">
						{warning}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<p class="px-1 text-xs text-slate-500">
		Resolvé las líneas marcadas. Cuando no quede ninguna pendiente, la API habilita el conteo.
	</p>

	<div class="grid gap-3">
		{#each view.lines as line (line.line_id)}
			<LineCard {line} {products} busy={busyLineId === line.line_id} {onanswer} {onassign} />
		{:else}
			<p class="card text-sm text-slate-400">El documento no devolvió líneas.</p>
		{/each}
	</div>
</div>
