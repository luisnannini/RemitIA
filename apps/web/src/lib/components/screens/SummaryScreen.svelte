<script lang="ts">
	/**
	 * Pantalla 5 — RESUMEN / RECLAMO (PRD 11.1).
	 * Diferencias, borrador del reclamo con tabla de hechos, sello QVAC local,
	 * "qué hizo QVAC / el código / la persona" y botón de reset.
	 *
	 * El texto y la tabla llegan del backend; acá no se compone ni se recalcula.
	 * La UI dice "borrador listo", nunca "enviado" (PRD 17).
	 */
	import type { ReceptionView } from '$lib/api';
	import { discrepancyLabel, discrepancyTone } from '$lib/ui/labels';
	import LocalSeal from '$lib/components/LocalSeal.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	interface Props {
		view: ReceptionView;
		claiming: boolean;
		closing: boolean;
		resetting: boolean;
		onclaim: () => void;
		onclose: () => void;
		onreset: () => void;
	}

	let { view, claiming, closing, resetting, onclaim, onclose, onreset }: Props = $props();

	let differences = $derived(
		view.lines.filter((line) => line.discrepancy && line.discrepancy.type !== 'ok')
	);
	let isClosed = $derived(view.status === 'closed');
</script>

<div class="grid gap-4">
	<section class="card">
		<h1 class="text-lg font-bold text-white">
			{isClosed ? 'Recepción cerrada' : 'Resultado de la recepción'}
		</h1>
		<p class="mt-0.5 text-sm text-slate-400">
			{view.document?.provider_name ?? 'Proveedor sin identificar'}
			{#if view.document?.remit_number}
				· Remito {view.document.remit_number}
			{/if}
		</p>

		<dl class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
			<div class="rounded-xl bg-black/25 px-3 py-3 text-center">
				<dt class="text-[11px] text-slate-500">Esperado</dt>
				<dd class="tnum text-2xl font-black text-slate-100">{view.summary.units_expected}</dd>
			</div>
			<div class="rounded-xl bg-black/25 px-3 py-3 text-center">
				<dt class="text-[11px] text-slate-500">Contado</dt>
				<dd class="tnum text-2xl font-black text-slate-100">{view.summary.units_counted}</dd>
			</div>
			<div class="rounded-xl bg-rose-500/10 px-3 py-3 text-center">
				<dt class="text-[11px] text-rose-300/70">Faltan</dt>
				<dd class="tnum text-2xl font-black text-rose-300">{view.summary.missing_units}</dd>
			</div>
			<div class="rounded-xl bg-amber-500/10 px-3 py-3 text-center">
				<dt class="text-[11px] text-amber-300/70">De más</dt>
				<dd class="tnum text-2xl font-black text-amber-300">{view.summary.unexpected_units}</dd>
			</div>
		</dl>
	</section>

	{#if differences.length > 0}
		<section class="grid gap-2">
			<h2 class="px-1 text-xs tracking-wider text-slate-500 uppercase">Diferencias detectadas</h2>
			{#each differences as line (line.line_id)}
				<article class="card flex items-center justify-between gap-3 py-3">
					<div class="min-w-0">
						<p class="truncate text-sm font-semibold text-slate-100">{line.match.selected_sku}</p>
						<p class="truncate font-mono text-[11px] text-slate-500">{line.source_text}</p>
					</div>
					<div class="shrink-0 text-right">
						<p class="tnum text-sm text-slate-300">
							{line.counted_quantity} de {line.expected_quantity ?? '—'}
						</p>
						{#if line.discrepancy}
							<p class="text-xs font-semibold {discrepancyTone[line.discrepancy.type]}">
								{discrepancyLabel[line.discrepancy.type]}
								{line.discrepancy.missing_quantity ?? line.discrepancy.over_quantity ?? ''}
							</p>
						{/if}
					</div>
				</article>
			{/each}
		</section>
	{/if}

	{#if view.status === 'ready_to_claim' && !view.claim}
		<section class="card">
			<h2 class="text-sm font-semibold text-white">Reclamo</h2>
			<p class="mt-1 text-sm text-slate-400">
				RemitIA redacta el borrador a partir del resultado congelado. Puede tardar unos segundos.
			</p>
			<button type="button" class="btn-primary mt-3 w-full" disabled={claiming} onclick={onclaim}>
				{#if claiming}
					<Spinner size={16} />
					Redactando el reclamo…
				{:else}
					Redactar reclamo
				{/if}
			</button>
		</section>
	{/if}

	{#if view.claim}
		<section class="card">
			<div class="flex items-center justify-between gap-3">
				<h2 class="text-sm font-semibold text-white">Borrador listo</h2>
				<span class="chip bg-emerald-500/15 text-emerald-300">
					{view.claim.grounding_status === 'validated' ? 'verificado' : 'fallback seguro'}
				</span>
			</div>
			<p class="mt-2 text-sm font-semibold text-slate-100">{view.claim.subject}</p>
			<p class="mt-2 text-sm whitespace-pre-line text-slate-300">{view.claim.body}</p>

			{#if view.claim.facts.length > 0}
				<div class="mt-3 overflow-x-auto">
					<table class="w-full min-w-[420px] text-left text-xs">
						<thead class="text-slate-500">
							<tr>
								<th class="py-1.5 pr-2 font-medium">Producto</th>
								<th class="py-1.5 pr-2 text-right font-medium">Esperado</th>
								<th class="py-1.5 pr-2 text-right font-medium">Recibido</th>
								<th class="py-1.5 text-right font-medium">Falta</th>
							</tr>
						</thead>
						<tbody class="text-slate-200">
							{#each view.claim.facts as fact (fact.sku)}
								<tr class="border-t border-white/5">
									<td class="py-1.5 pr-2">
										{fact.description}
										<span class="block font-mono text-[10px] text-slate-500">{fact.sku}</span>
									</td>
									<td class="tnum py-1.5 pr-2 text-right">{fact.expected_quantity}</td>
									<td class="tnum py-1.5 pr-2 text-right">{fact.counted_quantity}</td>
									<td class="tnum py-1.5 text-right font-bold text-rose-300">
										{fact.missing_quantity}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			<p class="mt-3 text-[11px] text-slate-500">
				Este texto queda como borrador. RemitIA no envía correos.
			</p>

			{#if view.status === 'ready_to_claim'}
				<button type="button" class="btn-secondary mt-3 w-full" disabled={closing} onclick={onclose}>
					{#if closing}
						<Spinner size={16} />
						Cerrando…
					{:else}
						Cerrar la recepción
					{/if}
				</button>
			{/if}
		</section>
	{/if}

	<section class="card">
		<h2 class="text-sm font-semibold text-white">Quién hizo qué</h2>
		<ul class="mt-2.5 grid gap-2 text-xs text-slate-400">
			<li class="flex gap-2.5">
				<span class="shrink-0 font-semibold text-sky-300">QVAC</span>
				leyó la foto, normalizó las líneas y redactó la prosa del reclamo.
			</li>
			<li class="flex gap-2.5">
				<span class="shrink-0 font-semibold text-emerald-300">Código</span>
				calculó candidatos, conteos y diferencias. Ningún número lo dijo el modelo.
			</li>
			<li class="flex gap-2.5">
				<span class="shrink-0 font-semibold text-amber-300">Persona</span>
				resolvió las dudas, asignó productos y confirmó el cierre.
			</li>
		</ul>
		<div class="mt-3">
			<LocalSeal compact />
		</div>
		{#if view.latest_trace_id}
			<p class="mt-2 font-mono text-[10px] text-slate-600">trace: {view.latest_trace_id}</p>
		{/if}
	</section>

	<button type="button" class="btn-secondary w-full" disabled={resetting} onclick={onreset}>
		{#if resetting}
			<Spinner size={16} />
			Reiniciando…
		{:else}
			Reiniciar demo
		{/if}
	</button>
</div>
