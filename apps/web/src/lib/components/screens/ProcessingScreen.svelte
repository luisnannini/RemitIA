<script lang="ts">
	/**
	 * Pantalla 2 — PROCESANDO (PRD 11.1).
	 * Pasos honestos: leyendo, estructurando, relacionando.
	 * El resaltado es indicativo: la API no publica sub-pasos, solo el `status`.
	 * La web NO decide cuándo termina; corta cuando la API cambia de estado.
	 */
	import type { ReceptionView } from '$lib/api';
	import LocalSeal from '$lib/components/LocalSeal.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	interface Props {
		view: ReceptionView;
		/** Segundos transcurridos desde que arrancó el polling. */
		elapsedSeconds: number;
	}

	let { view, elapsedSeconds }: Props = $props();

	const steps = [
		{ title: 'Leyendo el documento', detail: 'OCR local sobre la foto' },
		{ title: 'Estructurando las líneas', detail: 'Descripción y cantidad por renglón' },
		{ title: 'Relacionando con el catálogo', detail: 'Candidatos y veredicto' }
	];

	// Solo estética del spinner: no representa estado de negocio.
	let activeStep = $derived(Math.min(steps.length - 1, Math.floor(elapsedSeconds / 4)));

	function stepClass(index: number, active: number): string {
		if (index < active) return 'border-emerald-400/25 bg-emerald-500/10';
		if (index === active) return 'border-sky-400/35 bg-sky-500/10';
		return 'border-white/8 bg-white/[0.03]';
	}

	function bulletClass(index: number, active: number): string {
		if (index < active) return 'bg-emerald-400 text-emerald-950';
		if (index === active) return 'bg-sky-400 text-sky-950';
		return 'bg-white/10 text-slate-500';
	}
</script>

<div class="grid gap-4">
	<section class="card">
		<div class="flex items-center gap-3">
			<Spinner size={22} label="Procesando" />
			<div>
				<h1 class="text-lg font-bold text-white">Procesando el remito</h1>
				<p class="text-xs text-slate-500">
					{view.document?.filename ?? 'documento'} · {elapsedSeconds}s
				</p>
			</div>
		</div>

		<ol class="mt-4 grid gap-2.5">
			{#each steps as step, index (step.title)}
				<li
					class="flex items-start gap-3 rounded-xl border px-3 py-2.5 transition {stepClass(
						index,
						activeStep
					)}"
				>
					<span
						class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold {bulletClass(
							index,
							activeStep
						)}"
					>
						{index < activeStep ? '✓' : index + 1}
					</span>
					<span class="min-w-0">
						<span class="block text-sm font-semibold text-slate-100">{step.title}</span>
						<span class="block text-xs text-slate-500">{step.detail}</span>
					</span>
				</li>
			{/each}
		</ol>

		<p class="mt-4 text-xs text-slate-500">
			Puede tardar varios segundos: los modelos corren en esta máquina, sin internet.
		</p>
	</section>

	<div class="flex justify-center">
		<LocalSeal compact />
	</div>
</div>
