<script lang="ts">
	/**
	 * Una línea del remito con su estado y su acción humana (PRD 11.1, pantalla 3).
	 *
	 * Lo que hace:
	 *   - flujo (a): muestra el producto ya relacionado;
	 *   - flujo (b): pregunta destacada + candidatos como botones de un toque → `POST /answers` (PRD 8.5);
	 *   - flujo (c): buscador client-side, alta de SKU o "dejar sin resolver" → `POST /lines/{id}/assign` (PRD 8.6).
	 *
	 * Lo que NO hace: calcular, decidir estados ni transicionar. Todo lo que se ve
	 * llega en `line`; cada acción emite un evento y la pantalla se vuelve a
	 * dibujar con la vista que devolvió la API.
	 */
	import type {
		ApiError,
		AssignRequest,
		CatalogProduct,
		MatchCandidate,
		ReceptionLine
	} from '$lib/api';
	import {
		asPercent,
		matchStatusAccent,
		matchStatusHint,
		matchStatusSurface,
		needsHumanAction
	} from '$lib/ui/labels';
	import {
		nameFieldError,
		normalizeSkuInput,
		normalizeSkuTyping,
		skuFieldError
	} from '$lib/ui/new-product';
	import ErrorPanel from './ErrorPanel.svelte';
	import MatchBadge from './MatchBadge.svelte';
	import MatchStatusIcon from './MatchStatusIcon.svelte';
	import Spinner from './Spinner.svelte';

	interface Props {
		line: ReceptionLine;
		/** Catálogo completo ya cargado (PRD 8.2): el buscador filtra en el cliente. */
		products: CatalogProduct[];
		/** Hay un POST en vuelo para ESTA línea. */
		busy?: boolean;
		/** Error del servidor para ESTA línea (PRD 8.11). Ej.: `SKU_ALREADY_EXISTS`. */
		error?: ApiError | null;
		/** Flujo (b) — PRD 8.5. */
		onanswer: (questionId: string, selectedSku: string) => void;
		/** Flujo (c) — PRD 8.6. */
		onassign: (lineId: string, payload: AssignRequest) => void;
	}

	let { line, products, busy = false, error = null, onanswer, onassign }: Props = $props();

	/** Cuántos resultados del catálogo se listan antes de pedir afinar la búsqueda. */
	const MAX_RESULTS = 8;

	/* Estado local: solo UI. Nada de esto llega al servidor por sí solo. */
	let query = $state('');
	let showAssign = $state(false);
	let showNewProduct = $state(false);
	let newSku = $state('');
	let newName = $state('');
	/** No se muestran errores de validación hasta que la persona tocó los campos. */
	let touched = $state(false);
	/** `null` = el detalle sigue al estado de la línea; un booleano = decisión manual. */
	let expanded = $state<boolean | null>(null);

	let status = $derived(line.match.status);
	/** PRD 7: bloquea si es `ambiguous` o `unmatched`. `unresolved` no bloquea. */
	let actionable = $derived(needsHumanAction(status));
	/** Flujo (b) solo si la API publicó la pregunta; si no, se cae al flujo (c). */
	let question = $derived(status === 'ambiguous' ? line.match.question : null);
	/** El panel de asignación no aplica a una línea ya relacionada. */
	let assignOpen = $derived(status !== 'matched' && (showAssign || (actionable && !question)));
	let detailOpen = $derived(expanded ?? actionable);

	let selectedProduct = $derived(
		line.match.selected_sku
			? (products.find((product) => product.sku === line.match.selected_sku) ?? null)
			: null
	);

	let confidence = $derived(asPercent(line.evidence?.confidence));
	let score = $derived(asPercent(line.match.score));
	let reason = $derived(line.match.reason ?? matchStatusHint[status]);

	let needle = $derived(query.trim().toLowerCase());
	/** Buscador client-side sobre el catálogo ya cargado: nombre, SKU y alias. */
	let allResults = $derived.by(() => {
		if (!needle) return products;
		return products.filter(
			(product) =>
				product.sku.toLowerCase().includes(needle) ||
				product.name.toLowerCase().includes(needle) ||
				(product.aliases ?? []).some((alias) => alias.toLowerCase().includes(needle))
		);
	});
	let results = $derived(allResults.slice(0, MAX_RESULTS));

	let skuError = $derived(touched ? skuFieldError(newSku) : null);
	let nameError = $derived(touched ? nameFieldError(newName) : null);
	let canCreate = $derived(!skuFieldError(newSku) && !nameFieldError(newName));
	/**
	 * Aviso, no bloqueo: la unicidad la decide la API (PRD 6). Si el cliente
	 * frenara el envío, `SKU_ALREADY_EXISTS` no se podría ver nunca.
	 */
	let duplicate = $derived(
		newSku ? (products.find((product) => product.sku === newSku) ?? null) : null
	);

	function openNewProduct() {
		showNewProduct = true;
		touched = false;
		// El nombre arranca con el texto del remito para editarlo, no para
		// aceptarlo: el alta sigue siendo una decisión explícita de la persona.
		if (!newName) newName = line.source_text;
	}

	/**
	 * Normalización en vivo (mayúsculas, espacios → guion, guiones colapsados).
	 *
	 * Reescribir `value` manda el cursor al final, así que solo se reescribe si
	 * el texto cambió y se recalcula la posición normalizando el prefijo que
	 * quedó a la izquierda del cursor: editar en el medio del SKU no salta.
	 */
	function onSkuInput(input: HTMLInputElement) {
		const raw = input.value;
		const normalized = normalizeSkuTyping(raw);
		newSku = normalized;
		if (normalized === raw) return;

		const caret = input.selectionStart ?? raw.length;
		const nextCaret = normalizeSkuTyping(raw.slice(0, caret)).length;
		input.value = normalized;
		input.setSelectionRange(nextCaret, nextCaret);
	}

	/** Al salir del campo sí se recortan los guiones del borde (ver `new-product`). */
	function onSkuBlur(input: HTMLInputElement) {
		touched = true;
		const finalSku = normalizeSkuInput(newSku);
		if (finalSku !== input.value) input.value = finalSku;
		newSku = finalSku;
	}

	/** Flujo (b): body exacto de PRD 8.5, y solo con un candidato de la lista. */
	function answerWith(candidate: MatchCandidate) {
		const current = line.match.question;
		if (!current) return;
		// Whitelist del lado del cliente, espejo de la que aplica la API: un SKU
		// fuera de los candidatos de esta pregunta no se puede ni intentar.
		if (!line.match.candidates.some((item) => item.sku === candidate.sku)) return;
		onanswer(current.question_id, candidate.sku);
	}

	/** Flujo (c) — PRD 8.6: exactamente una clave por request. */
	function assignSku(sku: string) {
		onassign(line.line_id, { sku });
	}

	function createProduct() {
		touched = true;
		const sku = normalizeSkuInput(newSku);
		const name = newName.trim();
		if (skuFieldError(sku) || nameFieldError(name)) return;
		onassign(line.line_id, { new_product: { sku, name } });
	}

	function discard() {
		onassign(line.line_id, { mark_unresolved: true });
	}
</script>

<article
	class="rounded-2xl border border-white/10 border-l-4 p-4 shadow-lg shadow-black/20 {matchStatusAccent[
		status
	]} {matchStatusSurface[status]}"
	class:opacity-75={status === 'unresolved' && !assignOpen}
	class:ring-2={busy}
	class:ring-sky-400={busy}
	aria-busy={busy}
>
	<header class="flex items-start justify-between gap-3">
		<div class="min-w-0 flex-1">
			<p class="text-[11px] tracking-wider text-slate-500 uppercase">Texto del remito</p>
			<p class="mt-0.5 font-mono text-[15px] leading-snug break-words text-slate-100">
				{line.source_text}
			</p>
		</div>
		<MatchBadge {status} size={actionable ? 'lg' : 'sm'} />
	</header>

	<p class="mt-2 text-xs text-slate-400">
		Cantidad esperada:
		<strong class="tnum text-sm text-slate-100">{line.expected_quantity ?? '—'}</strong>
		{line.unit ?? ''}
	</p>

	{#if actionable}
		<p class="mt-2 text-xs leading-snug text-slate-300 italic">{reason}</p>
	{/if}

	{#if busy}
		<p
			class="mt-3 flex items-center gap-2 rounded-xl bg-sky-500/15 px-3 py-2 text-sm font-semibold text-sky-100"
			role="status"
		>
			<Spinner size={16} label="Resolviendo" />
			Resolviendo…
		</p>
	{/if}

	{#if error}
		<!-- PRD 8.11: el mismo panel que el resto de la app (código, `trace_id` y
		     acción humana), en su variante compacta. Sin `onretry`: los botones
		     que reintentan la acción son los de la propia tarjeta, acá al lado. -->
		<div class="mt-3">
			<ErrorPanel {error} compact />
			{#if error.code === 'SKU_ALREADY_EXISTS'}
				<p class="mt-1.5 px-1 text-xs text-rose-200/90">
					Elegí otro código, o asigná desde el buscador el producto que ya existe.
				</p>
			{/if}
		</div>
	{/if}

	<!-- Flujo (a): la línea ya está relacionada con un SKU del catálogo -->
	{#if status === 'matched'}
		<div class="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2.5">
			<p class="text-[11px] tracking-wider text-emerald-400/80 uppercase">Producto del catálogo</p>
			<p class="mt-0.5 text-sm font-semibold text-emerald-100">
				{selectedProduct?.name ?? line.match.selected_sku}
			</p>
			<p class="font-mono text-[11px] text-emerald-300/70">
				{line.match.selected_sku}{#if selectedProduct?.created_during_reception}
					· dado de alta en esta recepción{/if}
			</p>
		</div>
	{/if}

	<!-- `unresolved` (PRD 7): no bloquea y no participa del conteo -->
	{#if status === 'unresolved'}
		<div class="mt-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
			<p class="text-sm text-slate-300">Queda fuera del conteo y del resumen.</p>
			{#if !assignOpen}
				<button
					type="button"
					class="btn-ghost mt-1 w-full text-xs"
					disabled={busy}
					onclick={() => (showAssign = true)}
				>
					Volver a resolverla
				</button>
			{/if}
		</div>
	{/if}

	<!-- Flujo (b): pregunta desambigüadora por botones (PRD 8.5) -->
	{#if question}
		<div class="mt-3 rounded-xl border border-amber-300/40 bg-amber-400/10 p-3">
			<p class="flex items-start gap-2 text-base leading-snug font-bold text-amber-50">
				<span class="mt-0.5"><MatchStatusIcon status="ambiguous" size={20} /></span>
				{question.text}
			</p>
			<p class="mt-1 text-[11px] text-amber-200/70">
				Un toque alcanza. Solo se pueden elegir los candidatos que envió la API.
			</p>

			<div class="mt-3 grid gap-2">
				{#each line.match.candidates as candidate (candidate.sku)}
					<button
						type="button"
						class="option-strong"
						disabled={busy}
						onclick={() => answerWith(candidate)}
					>
						<span class="text-base font-bold text-amber-50">{candidate.name}</span>
						<span class="font-mono text-[11px] text-amber-200/70">{candidate.sku}</span>
					</button>
				{:else}
					<p class="text-xs text-amber-200/70">La API no envió candidatos para esta pregunta.</p>
				{/each}
			</div>

			{#if !assignOpen}
				<button
					type="button"
					class="btn-ghost mt-1.5 w-full text-xs"
					disabled={busy}
					onclick={() => (showAssign = true)}
				>
					Ninguno de estos · buscar en el catálogo
				</button>
			{/if}
		</div>
	{/if}

	<!-- Flujo (c): asignar del catálogo, dar de alta un SKU o dejar sin resolver (PRD 8.6) -->
	{#if assignOpen}
		<div class="mt-3 rounded-xl border border-white/15 bg-black/30 p-3">
			<p class="text-sm font-bold text-slate-100">Elegí el producto del catálogo</p>
			<p class="mt-0.5 text-[11px] text-slate-400">
				Lo que el modelo no sabe, lo decide la persona. El alta de un SKU queda registrada.
			</p>

			{#if !question && line.match.candidates.length > 0}
				<p class="mt-2.5 text-[11px] tracking-wider text-slate-500 uppercase">
					Lo más parecido según la API
				</p>
				<div class="mt-1.5 grid gap-1.5">
					{#each line.match.candidates as candidate (candidate.sku)}
						<button
							type="button"
							class="option"
							disabled={busy}
							onclick={() => assignSku(candidate.sku)}
						>
							<span class="text-[15px] font-semibold text-slate-100">{candidate.name}</span>
							<span class="font-mono text-[11px] text-slate-400">{candidate.sku}</span>
						</button>
					{/each}
				</div>
			{/if}

			<label class="mt-2.5 block">
				<span class="sr-only">Buscar en el catálogo</span>
				<input
					type="search"
					class="field"
					placeholder="Buscar por nombre, SKU o alias…"
					bind:value={query}
					disabled={busy}
					autocomplete="off"
					spellcheck="false"
				/>
			</label>

			<div class="mt-2 grid gap-1.5">
				{#each results as product (product.sku)}
					<button
						type="button"
						class="option"
						disabled={busy}
						onclick={() => assignSku(product.sku)}
					>
						<span class="text-[15px] font-semibold text-slate-100">{product.name}</span>
						<span class="font-mono text-[11px] text-slate-400">
							{product.sku}{#if product.created_during_reception} · nuevo{/if}
						</span>
					</button>
				{:else}
					<p class="py-2 text-xs text-slate-400">
						Ningún producto del catálogo coincide. Podés dar de alta uno nuevo.
					</p>
				{/each}
			</div>

			{#if allResults.length > results.length}
				<p class="mt-1 text-[11px] text-slate-500">
					Se listan {results.length} de {allResults.length} productos. Afiná la búsqueda.
				</p>
			{/if}

			{#if showNewProduct}
				<div class="mt-3 grid gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 p-3">
					<div>
						<p class="text-sm font-semibold text-sky-100">Dar de alta un SKU nuevo</p>
						<p class="text-[11px] text-sky-200/70">
							Sin código de barras: durante el conteo se escanea por SKU.
						</p>
					</div>

					<div>
						<label class="text-[11px] tracking-wider text-sky-200/70 uppercase" for="sku-{line.line_id}">
							SKU
						</label>
						<input
							id="sku-{line.line_id}"
							class="field mt-1 font-mono"
							placeholder="SKU-NUEVO-01"
							value={newSku}
							oninput={(event) => onSkuInput(event.currentTarget)}
							onblur={(event) => onSkuBlur(event.currentTarget)}
							disabled={busy}
							autocomplete="off"
							autocapitalize="characters"
							spellcheck="false"
							aria-invalid={!!skuError}
							aria-describedby={skuError ? `sku-error-${line.line_id}` : undefined}
						/>
						{#if skuError}
							<p id="sku-error-{line.line_id}" class="mt-1 text-[11px] font-semibold text-rose-300">
								{skuError}
							</p>
						{:else if duplicate}
							<p class="mt-1 text-[11px] text-amber-300">
								«{duplicate.name}» ya usa ese SKU: el servidor va a rechazar el alta.
							</p>
						{/if}
					</div>

					<div>
						<label class="text-[11px] tracking-wider text-sky-200/70 uppercase" for="name-{line.line_id}">
							Nombre
						</label>
						<input
							id="name-{line.line_id}"
							class="field mt-1"
							placeholder="Nombre del producto"
							bind:value={newName}
							onblur={() => (touched = true)}
							disabled={busy}
							aria-invalid={!!nameError}
							aria-describedby={nameError ? `name-error-${line.line_id}` : undefined}
						/>
						{#if nameError}
							<p id="name-error-{line.line_id}" class="mt-1 text-[11px] font-semibold text-rose-300">
								{nameError}
							</p>
						{/if}
					</div>

					<div class="flex gap-2">
						<button
							type="button"
							class="btn-primary flex-1"
							disabled={busy || !canCreate}
							onclick={createProduct}
						>
							Dar de alta y asignar
						</button>
						<button
							type="button"
							class="btn-ghost"
							disabled={busy}
							onclick={() => (showNewProduct = false)}
						>
							Cancelar
						</button>
					</div>
				</div>
			{:else}
				<button
					type="button"
					class="btn-secondary mt-2 w-full text-sm"
					disabled={busy}
					onclick={openNewProduct}
				>
					No está en el catálogo · dar de alta un SKU nuevo
				</button>
			{/if}

			{#if status !== 'unresolved'}
				<button
					type="button"
					class="btn-ghost mt-1 w-full text-xs"
					disabled={busy}
					onclick={discard}
				>
					Dejar sin resolver · queda fuera del conteo
				</button>
			{/if}
		</div>
	{/if}

	<!-- Evidencia: abierta en las bloqueantes, colapsada en las resueltas -->
	<div class="mt-3 border-t border-white/5 pt-2">
		<button
			type="button"
			class="flex w-full items-center justify-between gap-2 text-[11px] tracking-wider text-slate-500 uppercase hover:text-slate-300"
			aria-expanded={detailOpen}
			onclick={() => (expanded = !detailOpen)}
		>
			<span>Evidencia del documento</span>
			<span aria-hidden="true">{detailOpen ? '▾' : '▸'}</span>
		</button>

		{#if detailOpen}
			<div class="mt-2 grid gap-1.5 text-xs">
				{#if !actionable}
					<p class="text-slate-300 italic">{reason}</p>
				{/if}

				<div class="flex flex-wrap gap-x-4 gap-y-1 text-slate-400">
					{#if confidence}
						<span>OCR de la línea <strong class="tnum text-slate-100">{confidence}</strong></span>
					{/if}
					{#if score}
						<span>Similitud lexical <strong class="tnum text-slate-100">{score}</strong></span>
					{/if}
					{#if !confidence && !score}
						<span class="text-slate-500">La API no publicó números para esta línea.</span>
					{/if}
				</div>

				{#if line.evidence?.block_ids.length}
					<p class="font-mono text-[10px] text-slate-600">
						Bloques OCR · {line.evidence.block_ids.join(' · ')}
					</p>
				{/if}

				<p class="text-[11px] text-slate-500">
					Los números salen del OCR y del matching lexical de la API. El modelo nunca declara un
					decimal.
				</p>
			</div>
		{/if}
	</div>
</article>
