<script lang="ts">
	/**
	 * Pantalla 3 — REVISIÓN (PRD 11.1). Es la que más tiempo tiene en el video:
	 * el guion 1:00–1:40 vive acá (flujos b y c).
	 *
	 * Jerarquía: primero lo que bloquea, después lo que ya está. Las tarjetas se
	 * agrupan por el `match.status` que publica la API; agrupar y contar tarjetas
	 * es presentación, no negocio. La transición a `receiving` la decide la API
	 * (PRD 7) y la maneja el router: acá no se fuerza nada.
	 */
	import type { AssignRequest, CatalogProduct, ReceptionLine, ReceptionView } from '$lib/api';
	import { receptionDocumentUrl } from '$lib/api';
	import { asPercent, needsHumanAction } from '$lib/ui/labels';
	import type { BusyLines, LineErrors } from '$lib/ui/actions';
	import LineCard from '$lib/components/LineCard.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	interface Props {
		view: ReceptionView;
		products: CatalogProduct[];
		/** `line_id`s con una acción en vuelo. */
		busyLines: BusyLines;
		/** Rechazos del servidor por `line_id` (PRD 8.11). */
		lineErrors: LineErrors;
		onanswer: (questionId: string, selectedSku: string) => void;
		onassign: (lineId: string, payload: AssignRequest) => void;
	}

	let { view, products, busyLines, lineErrors, onanswer, onassign }: Props = $props();

	let showDocument = $state(false);
	let documentBroken = $state(false);
	let documentSrc = $derived(receptionDocumentUrl(view.id));

	/* Agrupación de presentación: el estado de cada línea lo publica la API. */
	let pending = $derived(view.lines.filter((line) => needsHumanAction(line.match.status)));
	/**
	 * `matched` y `unresolved` van en secciones separadas a propósito: el número
	 * del título "Ya resueltas" tiene que leerse igual que `summary.resolved_lines`
	 * de la cabecera, y una línea `unresolved` no está resuelta ni participa del
	 * conteo (PRD 7). Mezclarlas mostraba dos números distintos en la misma pantalla.
	 */
	let matched = $derived(view.lines.filter((line) => line.match.status === 'matched'));
	let unresolved = $derived(view.lines.filter((line) => line.match.status === 'unresolved'));

	let ocrQuality = $derived(asPercent(view.document?.ocr_quality) ?? '—');

	/**
	 * Al resolver una línea, su tarjeta salta de sección y el foco se pierde sin
	 * que un lector de pantalla diga nada. Esto lo anuncia, y solo cuando BAJA el
	 * número de bloqueantes que publica la API: sin temporizadores y sin derivar
	 * nada de negocio. `lastPending` es memoria del último valor visto y NO es
	 * estado reactivo a propósito (no debe disparar el efecto).
	 */
	let lastPending = -1;
	let announcement = $state('');

	$effect(() => {
		const count = pending.length;
		if (lastPending > count) {
			announcement =
				count === 0
					? 'Línea resuelta. No quedan líneas por resolver.'
					: `Línea resuelta. ${count === 1 ? 'Queda' : 'Quedan'} ${count} por resolver.`;
		}
		lastPending = count;
	});
</script>

{#snippet lineCards(lines: ReceptionLine[])}
	{#each lines as line (line.line_id)}
		<LineCard
			{line}
			{products}
			busy={busyLines.has(line.line_id)}
			error={lineErrors.get(line.line_id) ?? null}
			{onanswer}
			{onassign}
		/>
	{/each}
{/snippet}

<div class="grid gap-4">
	<!-- Solo para lectores de pantalla: la tarjeta resuelta cambia de sección. -->
	<p class="sr-only" role="status" aria-live="polite">{announcement}</p>

	<section class="card">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="min-w-0">
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
				aria-expanded={showDocument}
				onclick={() => (showDocument = !showDocument)}
			>
				{showDocument ? 'Ocultar foto' : 'Ver foto'}
			</button>
		</div>

		{#if showDocument}
			<!-- PRD 8.10: el binario lo sirve la API, nunca un path del cliente. La
			     foto se despliega en línea (no tapa la pantalla) y se puede abrir
			     entera en otra pestaña para mirar de cerca. -->
			<div class="mt-3">
				{#if documentBroken}
					<p class="rounded-xl border border-white/10 bg-black/30 px-3 py-4 text-xs text-slate-400">
						No pude cargar la foto original desde la API.
					</p>
				{:else}
					<img
						src={documentSrc}
						alt="Foto original del remito"
						class="w-full rounded-xl border border-white/10 bg-black/40 object-contain"
						loading="lazy"
						onerror={() => (documentBroken = true)}
					/>
					<a
						href={documentSrc}
						target="_blank"
						rel="noopener noreferrer"
						class="btn-ghost mt-1 w-full text-xs"
					>
						Abrir la foto en grande
					</a>
				{/if}
			</div>
		{/if}

		<!-- Contador del guion: qué falta para habilitar el conteo. -->
		{#if pending.length > 0}
			<div class="mt-3 rounded-xl border border-amber-300/40 bg-amber-400/10 px-3 py-3">
				<p class="tnum text-2xl leading-none font-black text-amber-100">
					{pending.length === 1 ? 'Queda' : 'Quedan'}
					{pending.length}
					{pending.length === 1 ? 'línea' : 'líneas'} por resolver
				</p>
				<p class="mt-1 text-xs text-amber-200/80">
					Resolvelas y la API habilita el conteo sola.
				</p>
			</div>
		{:else if view.lines.length > 0}
			<!-- Sin bloqueantes la API pasa sola a `receiving` (PRD 7). Este aviso
			     describe lo que ya decidió el servidor; la web no lo provoca. -->
			<div class="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-3">
				<p class="flex items-center gap-2 text-lg leading-none font-black text-emerald-100">
					<Spinner size={16} label="Pasando al conteo" />
					Todo resuelto, pasando al conteo
				</p>
				<p class="mt-1.5 text-xs text-emerald-200/80">
					No quedan líneas bloqueantes: la API cambia el estado y la pantalla sigue sola.
				</p>
			</div>
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
				<dd class="tnum text-base font-bold text-slate-100">{ocrQuality}</dd>
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

	{#if view.lines.length === 0}
		<p class="card text-sm text-slate-400">El documento no devolvió líneas.</p>
	{/if}

	{#if pending.length > 0}
		<section class="grid gap-3">
			<h2 class="px-1 text-xs tracking-wider text-amber-300/80 uppercase">
				Para resolver · {pending.length}
			</h2>
			{@render lineCards(pending)}
		</section>
	{/if}

	<!-- Solo `matched`: este número es el mismo «Resueltas» del resumen de arriba. -->
	{#if matched.length > 0}
		<section class="grid gap-3">
			<h2 class="px-1 text-xs tracking-wider text-slate-500 uppercase">
				Ya resueltas · {matched.length}
			</h2>
			{@render lineCards(matched)}
		</section>
	{/if}

	{#if unresolved.length > 0}
		<section class="grid gap-3">
			<h2 class="px-1 text-xs tracking-wider text-slate-500 uppercase">
				Dejadas sin resolver · {unresolved.length}
			</h2>
			<!-- PRD 7: `unresolved` no bloquea el paso a `receiving` y no se cuenta. -->
			<p class="-mt-1.5 px-1 text-[11px] text-slate-500">
				No frenan el conteo, pero tampoco participan de él ni del resumen.
			</p>
			{@render lineCards(unresolved)}
		</section>
	{/if}
</div>
