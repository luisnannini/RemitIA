<script lang="ts">
	/**
	 * Pantalla 2 — PROCESANDO (PRD 11.1).
	 *
	 * REGLA DE HONESTIDAD (PRD 11.2 / 17): sin porcentajes inventados, sin barra
	 * de progreso y sin pasos tildados. El contrato P0 no publica avance por
	 * etapa: el backend publica `ocr_quality` y las líneas recién al transicionar
	 * de `processing_document` (antes son null/vacías), así que acá no se infiere
	 * ningún estado interno. Las tres etapas del pipeline (PRD 10.1/10.2) se
	 * muestran como descripción de lo que pasa adentro, no como checklist. El
	 * único número que se mueve es el tiempo transcurrido, que es real.
	 */
	import type { ReceptionView } from '$lib/api';
	import LocalSeal from '$lib/components/LocalSeal.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	interface Props {
		view: ReceptionView;
		/** Segundos reales desde que se abrió la pantalla. */
		elapsedSeconds: number;
	}

	let { view, elapsedSeconds }: Props = $props();

	/** PRD 16.3 — OCR + extracción warm: objetivo ≤ 30 s; cutoff 60 s. */
	const TARGET_SECONDS = 30;
	const CUTOFF_SECONDS = 60;

	/** Etapas del pipeline local (PRD 10.1/10.2), solo informativas. */
	const steps = [
		{ title: 'Leyendo el documento', detail: 'OCR local sobre la foto' },
		{ title: 'Estructurando las líneas', detail: 'Descripción y cantidad por renglón' },
		{ title: 'Relacionando con el catálogo', detail: 'Candidatos y veredicto lexical' }
	];

	let elapsedLabel = $derived(
		elapsedSeconds < 60
			? `${elapsedSeconds} s`
			: `${Math.floor(elapsedSeconds / 60)} min ${String(elapsedSeconds % 60).padStart(2, '0')} s`
	);

	let previewFailed = $state(false);
	let previewUrl = $derived(view.document?.preview_url ?? null);
</script>

<div class="grid gap-4">
	<section class="card">
		<div class="flex items-start gap-3">
			{#if previewUrl && !previewFailed}
				<!-- PRD 8.10: el binario lo sirve la API; nunca un path del cliente. -->
				<img
					src={previewUrl}
					alt="Remito en proceso"
					class="h-14 w-14 shrink-0 rounded-lg border border-white/10 object-cover"
					onerror={() => (previewFailed = true)}
				/>
			{:else}
				<Spinner size={22} label="Procesando" />
			{/if}
			<div class="min-w-0">
				<h1 class="text-lg font-bold text-white">Procesando el remito</h1>
				<p class="truncate text-xs text-slate-500">
					{view.document?.filename ?? 'documento'}
				</p>
				<p class="tnum flex items-center gap-1.5 text-xs text-slate-400">
					<Spinner size={12} label="En curso" />
					Trabajando en esta máquina · {elapsedLabel}
				</p>
			</div>
		</div>

		<ol class="mt-4 grid gap-2.5">
			{#each steps as step, index (step.title)}
				<li
					class="flex items-start gap-3 rounded-xl border border-sky-400/20 bg-sky-500/[0.06] px-3 py-2.5"
				>
					<span
						class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-400/20 text-[10px] font-bold text-sky-200"
						aria-hidden="true"
					>
						{index + 1}
					</span>
					<span class="min-w-0 flex-1">
						<span class="block text-sm font-semibold text-slate-100">{step.title}</span>
						<span class="block text-xs text-slate-500">{step.detail}</span>
					</span>
				</li>
			{/each}
		</ol>

		<p class="mt-4 text-xs text-slate-500">
			Puede tardar varios segundos: los modelos corren en esta máquina, sin internet. El sistema no
			informa el avance etapa por etapa, así que acá no hay tildes ni porcentajes: el resultado
			aparece apenas termina.
		</p>

		{#if elapsedSeconds >= CUTOFF_SECONDS}
			<p class="mt-2 text-xs text-amber-300/90">
				Ya pasó el presupuesto previsto de {CUTOFF_SECONDS} s. Sigue trabajando; si no avanza,
				conviene sacar otra foto más nítida.
			</p>
		{:else if elapsedSeconds >= TARGET_SECONDS}
			<p class="mt-2 text-xs text-slate-400">
				Está tardando más que el objetivo de {TARGET_SECONDS} s. Es esperable con la máquina fría.
			</p>
		{/if}
	</section>

	<div class="flex justify-center">
		<LocalSeal compact />
	</div>
</div>
