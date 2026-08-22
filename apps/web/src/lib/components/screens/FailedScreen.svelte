<script lang="ts">
	/**
	 * Estado `failed` (PRD 7) — la recepción no llegó a `needs_document_review`.
	 *
	 * El escenario C del PRD 11.3 (foto deficiente) termina acá: la salida es
	 * sacar otra foto. `?recapturar=1` deja el Home listo para capturar de nuevo.
	 *
	 * La vista canónica (PRD 8.4) no publica el código de error del fallo, así que
	 * acá NO se adivina la causa: se muestran los `warnings` y la calidad de OCR
	 * cuando la API los trae, y nada más.
	 */
	import type { ReceptionView } from '$lib/api';
	import { asPercent } from '$lib/ui/labels';

	interface Props {
		view: ReceptionView;
	}

	let { view }: Props = $props();

	let warnings = $derived(view.document?.warnings ?? []);
	let quality = $derived(asPercent(view.document?.ocr_quality));
</script>

<div class="grid gap-4">
	<section class="card border-rose-400/25">
		<h1 class="text-lg font-bold text-white">No pude procesar el remito</h1>
		<p class="mt-1.5 text-sm text-slate-400">
			La foto no pudo leerse con seguridad. Probá con otra imagen, mejor iluminada, con el remito
			completo dentro del cuadro y sin inclinación.
		</p>

		{#if warnings.length > 0}
			<ul class="mt-3 grid gap-1.5">
				{#each warnings as warning (warning)}
					<li class="flex gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
						<span class="text-rose-300" aria-hidden="true">•</span>
						{warning}
					</li>
				{/each}
			</ul>
		{/if}

		{#if quality}
			<p class="mt-3 text-xs text-slate-500">Calidad de lectura reportada: {quality}.</p>
		{/if}

		<div class="mt-4 grid gap-2">
			<a href="/?recapturar=1" class="btn-primary w-full">Sacar otra foto</a>
			<a href="/" class="btn-ghost w-full">Volver al inicio</a>
		</div>
	</section>
</div>
