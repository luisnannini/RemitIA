<script lang="ts">
	/**
	 * Pantalla 4 — RECEPCIÓN GUIADA (PRD 11.1).
	 * Esperado vs contado en números grandes, input de lector keyboard-wedge y
	 * modal "¿Ya contaste todo?" que dispara `/finalize`.
	 *
	 * Todas las cifras vienen de `view.summary` y `line.discrepancy`.
	 * Acá no se suma ni se resta nada: eso vive en FastAPI (PRD 10.3).
	 */
	import type { ReceptionView } from '$lib/api';
	import { discrepancyLabel, discrepancyTone } from '$lib/ui/labels';

	interface Props {
		view: ReceptionView;
		scanning: boolean;
		finalizing: boolean;
		onscan: (code: string) => void;
		onfinalize: () => void;
	}

	let { view, scanning, finalizing, onscan, onfinalize }: Props = $props();

	let code = $state('');
	let confirmOpen = $state(false);
	let input = $state<HTMLInputElement | null>(null);

	// El lector USB keyboard-wedge escribe y manda Enter: el foco vive en el input.
	// `scanning` y `confirmOpen` se leen de forma SÍNCRONA para registrarlos como
	// dependencias: cada request a `/scans` deshabilita el input y el browser le
	// saca el foco, así que hay que devolvérselo al re-habilitarse o se pierde el
	// segundo escaneo en adelante. Con el modal de confirmación abierto NO se
	// enfoca: un escaneo tardío no debe sumar códigos detrás del overlay.
	// `$effect` corre después de que el DOM se actualizó, con lo cual `disabled`
	// ya es `false` acá y el `focus()` toma efecto.
	$effect(() => {
		if (scanning || confirmOpen) return;
		input?.focus();
	});

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const value = code.trim();
		if (!value || scanning) return;
		onscan(value);
		code = '';
	}

	let countedLines = $derived(view.lines.filter((line) => line.match.status === 'matched'));
</script>

<div class="grid gap-4">
	<section class="card">
		<h1 class="text-lg font-bold text-white">Contá lo que llegó</h1>
		<p class="mt-0.5 text-sm text-slate-400">
			Pasá el lector por cada producto. El backend suma y calcula las diferencias.
		</p>

		<div class="mt-4 grid grid-cols-2 gap-3">
			<div class="rounded-2xl border border-white/10 bg-black/30 px-3 py-4 text-center">
				<p class="text-[11px] tracking-wider text-slate-500 uppercase">Esperado</p>
				<p class="tnum mt-1 text-5xl leading-none font-black text-slate-100">
					{view.summary.units_expected}
				</p>
			</div>
			<div class="rounded-2xl border border-sky-400/25 bg-sky-500/10 px-3 py-4 text-center">
				<p class="text-[11px] tracking-wider text-sky-300/70 uppercase">Contado</p>
				<p class="tnum mt-1 text-5xl leading-none font-black text-sky-200">
					{view.summary.units_counted}
				</p>
			</div>
		</div>

		<form class="mt-4 flex gap-2" onsubmit={submit}>
			<input
				bind:this={input}
				bind:value={code}
				class="field flex-1 font-mono"
				placeholder="Escaneá o escribí el código"
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
				inputmode="text"
				disabled={scanning}
			/>
			<button type="submit" class="btn-primary px-5" disabled={!code.trim() || scanning}>
				Sumar
			</button>
		</form>
		<p class="mt-1.5 text-[11px] text-slate-500">
			Lector USB keyboard-wedge o teclado. Cada escaneo se envía con un identificador único.
		</p>
	</section>

	<section class="grid gap-2">
		<h2 class="px-1 text-xs tracking-wider text-slate-500 uppercase">Detalle por producto</h2>
		{#each countedLines as line (line.line_id)}
			<article class="card flex items-center justify-between gap-3 py-3">
				<div class="min-w-0">
					<p class="truncate text-sm font-semibold text-slate-100">
						{line.match.selected_sku}
					</p>
					<p class="truncate font-mono text-[11px] text-slate-500">{line.source_text}</p>
				</div>
				<div class="flex shrink-0 items-center gap-3 text-right">
					<p class="tnum text-lg font-bold text-slate-100">
						{line.counted_quantity}<span class="text-sm font-normal text-slate-500"
							>/{line.expected_quantity ?? '—'}</span
						>
					</p>
					{#if line.discrepancy}
						<span class="chip {discrepancyTone[line.discrepancy.type]} bg-white/5">
							{discrepancyLabel[line.discrepancy.type]}
						</span>
					{/if}
				</div>
			</article>
		{/each}

		{#if view.unexpected_items.length > 0}
			<h2 class="mt-2 px-1 text-xs tracking-wider text-amber-400/70 uppercase">
				No estaban en el remito
			</h2>
			{#each view.unexpected_items as item (item.sku ?? item.barcode_or_sku)}
				<article class="card flex items-center justify-between gap-3 border-amber-400/25 py-3">
					<p class="min-w-0 truncate text-sm text-amber-100">
						{item.name ?? item.sku ?? item.barcode_or_sku}
					</p>
					<p class="tnum text-lg font-bold text-amber-200">+{item.counted_quantity}</p>
				</article>
			{/each}
		{/if}
	</section>

	<button
		type="button"
		class="btn-primary w-full"
		disabled={finalizing}
		onclick={() => (confirmOpen = true)}
	>
		Terminé de contar
	</button>
</div>

{#if confirmOpen}
	<!-- PRD 7: el modal es solo UI; cancelar no llama a la API. -->
	<div
		class="fixed inset-0 z-30 flex items-end justify-center bg-black/70 p-4 sm:items-center"
		role="dialog"
		aria-modal="true"
		aria-labelledby="confirm-title"
	>
		<div class="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0b1120] p-5">
			<h2 id="confirm-title" class="text-lg font-bold text-white">¿Ya contaste todo?</h2>
			<p class="mt-1.5 text-sm text-slate-400">
				Al confirmar, el servidor congela el resultado del conteo. Después no se modifica.
			</p>
			<div class="mt-4 grid gap-2">
				<button
					type="button"
					class="btn-primary w-full"
					disabled={finalizing}
					onclick={() => {
						confirmOpen = false;
						onfinalize();
					}}
				>
					Sí, finalizar
				</button>
				<button type="button" class="btn-ghost w-full" onclick={() => (confirmOpen = false)}>
					Seguir contando
				</button>
			</div>
		</div>
	</div>
{/if}
