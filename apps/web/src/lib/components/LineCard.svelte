<script lang="ts">
	import type { AssignRequest, CatalogProduct, ReceptionLine } from '$lib/api';
	import { asPercent, matchStatusHint } from '$lib/ui/labels';
	import MatchBadge from './MatchBadge.svelte';
	import Spinner from './Spinner.svelte';

	interface Props {
		line: ReceptionLine;
		products: CatalogProduct[];
		busy?: boolean;
		/** Flujo (b) — PRD 8.5. */
		onanswer: (questionId: string, selectedSku: string) => void;
		/** Flujo (c) — PRD 8.6. */
		onassign: (lineId: string, payload: AssignRequest) => void;
	}

	let { line, products, busy = false, onanswer, onassign }: Props = $props();

	/* Flujo (c): buscador client-side sobre el catálogo ya cargado (PRD 8.2).
	   Esqueleto de FE-01; FE-03 lo completa con evidencia y validaciones finas. */
	let query = $state('');
	let showNewProduct = $state(false);
	let newSku = $state('');
	let newName = $state('');

	let matches = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return products.slice(0, 6);
		return products
			.filter(
				(product) =>
					product.sku.toLowerCase().includes(needle) ||
					product.name.toLowerCase().includes(needle) ||
					(product.aliases ?? []).some((alias) => alias.toLowerCase().includes(needle))
			)
			.slice(0, 6);
	});

	let selectedName = $derived.by(() => {
		if (!line.match.selected_sku) return null;
		return products.find((product) => product.sku === line.match.selected_sku)?.name ?? null;
	});

	let confidence = $derived(asPercent(line.evidence?.confidence));
	let score = $derived(asPercent(line.match.score));

	function createProduct() {
		const sku = newSku.trim().toUpperCase();
		const name = newName.trim();
		if (!sku || !name) return;
		onassign(line.line_id, { new_product: { sku, name } });
		showNewProduct = false;
		newSku = '';
		newName = '';
	}
</script>

<article class="card" class:opacity-60={line.match.status === 'unresolved'}>
	<header class="flex flex-wrap items-start justify-between gap-2">
		<div class="min-w-0 flex-1">
			<p class="text-[11px] uppercase tracking-wider text-slate-500">Texto del remito</p>
			<p class="mt-0.5 font-mono text-sm leading-snug break-words text-slate-100">
				{line.source_text}
			</p>
		</div>
		<MatchBadge status={line.match.status} />
	</header>

	<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
		<span>
			Esperado:
			<strong class="tnum text-slate-200">{line.expected_quantity ?? '—'}</strong>
			{line.unit ?? ''}
		</span>
		{#if confidence}<span>OCR {confidence}</span>{/if}
		{#if score}<span>Similitud {score}</span>{/if}
		{#if line.evidence?.block_ids.length}
			<span class="font-mono text-[10px] text-slate-600">
				{line.evidence.block_ids.join(' · ')}
			</span>
		{/if}
	</div>

	{#if line.match.reason}
		<p class="mt-2 text-xs text-slate-400 italic">{line.match.reason}</p>
	{:else}
		<p class="mt-2 text-xs text-slate-500">{matchStatusHint[line.match.status]}</p>
	{/if}

	<!-- Flujo (a): resuelta -->
	{#if line.match.status === 'matched'}
		<div class="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2.5">
			<p class="text-[11px] uppercase tracking-wider text-emerald-400/70">Producto del catálogo</p>
			<p class="mt-0.5 text-sm font-semibold text-emerald-100">
				{selectedName ?? line.match.selected_sku}
			</p>
			<p class="font-mono text-[11px] text-emerald-300/70">{line.match.selected_sku}</p>
		</div>
	{/if}

	<!-- Flujo (b): pregunta desambigüadora por botones (PRD 8.5) -->
	{#if line.match.status === 'ambiguous' && line.match.question}
		<div class="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3">
			<p class="text-sm font-semibold text-amber-100">{line.match.question.text}</p>
			<p class="mt-0.5 text-[11px] text-amber-300/70">
				Elegí una opción. Solo se aceptan los candidatos que envió la API.
			</p>
			<div class="mt-2.5 grid gap-2">
				{#each line.match.candidates as candidate (candidate.sku)}
					<button
						type="button"
						class="btn-secondary w-full flex-col items-start gap-0.5 py-2.5 text-left"
						disabled={busy}
						onclick={() => onanswer(line.match.question!.question_id, candidate.sku)}
					>
						<span class="text-sm font-semibold">{candidate.name}</span>
						<span class="font-mono text-[11px] font-normal text-slate-400">{candidate.sku}</span>
					</button>
				{/each}
			</div>
			<button
				type="button"
				class="btn-ghost mt-1 w-full text-xs"
				disabled={busy}
				onclick={() => onassign(line.line_id, { mark_unresolved: true })}
			>
				Ninguno · descartar la línea
			</button>
		</div>
	{/if}

	<!-- Flujo (c): asignación manual o alta de SKU (PRD 8.6) -->
	{#if line.match.status === 'unmatched'}
		<div class="mt-3 rounded-xl border border-rose-400/25 bg-rose-500/10 p-3">
			<p class="text-sm font-semibold text-rose-100">Asigná un producto</p>
			<p class="mt-0.5 text-[11px] text-rose-300/70">
				Lo que el modelo no sabe, lo decide la persona.
			</p>

			<input
				type="search"
				class="field mt-2.5"
				placeholder="Buscar por nombre o SKU…"
				bind:value={query}
				disabled={busy}
			/>

			<div class="mt-2 grid gap-1.5">
				{#each matches as product (product.sku)}
					<button
						type="button"
						class="btn-secondary w-full flex-col items-start gap-0.5 py-2 text-left"
						disabled={busy}
						onclick={() => onassign(line.line_id, { sku: product.sku })}
					>
						<span class="text-sm font-semibold">{product.name}</span>
						<span class="font-mono text-[11px] font-normal text-slate-400">{product.sku}</span>
					</button>
				{:else}
					<p class="py-2 text-xs text-slate-400">Sin resultados en el catálogo.</p>
				{/each}
			</div>

			{#if showNewProduct}
				<div class="mt-2.5 grid gap-2 rounded-lg border border-white/10 bg-black/20 p-2.5">
					<input class="field" placeholder="SKU nuevo" bind:value={newSku} disabled={busy} />
					<input class="field" placeholder="Nombre del producto" bind:value={newName} disabled={busy} />
					<div class="flex gap-2">
						<button
							type="button"
							class="btn-primary flex-1"
							disabled={busy || !newSku.trim() || !newName.trim()}
							onclick={createProduct}
						>
							Dar de alta y asignar
						</button>
						<button type="button" class="btn-ghost" onclick={() => (showNewProduct = false)}>
							Cancelar
						</button>
					</div>
				</div>
			{:else}
				<button
					type="button"
					class="btn-ghost mt-1 w-full text-xs"
					disabled={busy}
					onclick={() => (showNewProduct = true)}
				>
					No está en el catálogo · dar de alta un SKU nuevo
				</button>
			{/if}

			<button
				type="button"
				class="btn-ghost w-full text-xs"
				disabled={busy}
				onclick={() => onassign(line.line_id, { mark_unresolved: true })}
			>
				No puedo resolverla ahora · descartar
			</button>
		</div>
	{/if}

	{#if busy}
		<div class="mt-3 flex items-center gap-2 text-xs text-slate-400">
			<Spinner size={14} />
			Enviando…
		</div>
	{/if}
</article>
