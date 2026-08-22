<script lang="ts">
	/**
	 * Pantalla 2 — PROCESANDO (PRD 11.1).
	 * Pasos honestos: leyendo, estructurando, relacionando.
	 *
	 * REGLA DE HONESTIDAD (PRD 11.2 / 17): acá no hay porcentajes inventados, ni
	 * barra de progreso, ni pasos que avancen por reloj. Un paso se marca como
	 * hecho SOLO si la vista canónica trae la evidencia de que ocurrió
	 * (`document.ocr_quality`, `lines.length`, el cambio de `status`). El único
	 * número que se mueve solo es el tiempo transcurrido, que es real.
	 *
	 * El pipeline del PRD 10.1/10.2 es secuencial, así que el primer paso sin
	 * evidencia es el que está en curso. Eso es lectura del contrato, no una
	 * transición: la web no decide cuándo termina nada.
	 */
	import type { ReceptionView } from '$lib/api';
	import { asPercent } from '$lib/ui/labels';
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

	interface Step {
		title: string;
		detail: string;
		/** Evidencia publicada por la API, o `null` si todavía no llegó. */
		evidence: (current: ReceptionView) => string | null;
	}

	const steps: Step[] = [
		{
			title: 'Leyendo el documento',
			detail: 'OCR local sobre la foto',
			evidence: (current) => {
				const quality = asPercent(current.document?.ocr_quality);
				return quality ? `Calidad de lectura ${quality}` : null;
			}
		},
		{
			title: 'Estructurando las líneas',
			detail: 'Descripción y cantidad por renglón',
			evidence: (current) =>
				current.lines.length > 0
					? `${current.lines.length} ${current.lines.length === 1 ? 'línea' : 'líneas'} detectadas`
					: null
		},
		{
			title: 'Relacionando con el catálogo',
			detail: 'Candidatos y veredicto lexical',
			evidence: (current) =>
				current.status === 'draft' || current.status === 'processing_document'
					? null
					: 'Veredicto publicado'
		}
	];

	let evidences = $derived(steps.map((step) => step.evidence(view)));
	/** Primer paso sin evidencia = el que está corriendo ahora. */
	let currentIndex = $derived.by(() => {
		const pending = evidences.findIndex((value) => value === null);
		return pending === -1 ? steps.length : pending;
	});

	let elapsedLabel = $derived(
		elapsedSeconds < 60
			? `${elapsedSeconds} s`
			: `${Math.floor(elapsedSeconds / 60)} min ${String(elapsedSeconds % 60).padStart(2, '0')} s`
	);

	let previewFailed = $state(false);
	let previewUrl = $derived(view.document?.preview_url ?? null);

	function toneClass(index: number): string {
		if (index < currentIndex) return 'border-emerald-400/25 bg-emerald-500/10';
		if (index === currentIndex) return 'border-sky-400/35 bg-sky-500/10';
		return 'border-white/10 bg-white/[0.03]';
	}

	function bulletClass(index: number): string {
		if (index < currentIndex) return 'bg-emerald-400 text-emerald-950';
		if (index === currentIndex) return 'bg-sky-400 text-sky-950';
		return 'bg-white/10 text-slate-500';
	}
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
				<p class="tnum text-xs text-slate-400">
					Paso {Math.min(currentIndex + 1, steps.length)} de {steps.length} · {elapsedLabel}
				</p>
			</div>
		</div>

		<ol class="mt-4 grid gap-2.5">
			{#each steps as step, index (step.title)}
				<li class="flex items-start gap-3 rounded-xl border px-3 py-2.5 transition {toneClass(index)}">
					<span
						class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold {bulletClass(
							index
						)}"
						aria-hidden="true"
					>
						{index < currentIndex ? '✓' : index + 1}
					</span>
					<span class="min-w-0 flex-1">
						<span class="block text-sm font-semibold text-slate-100">{step.title}</span>
						<span class="block text-xs text-slate-500">{step.detail}</span>
						{#if evidences[index]}
							<span class="mt-0.5 block text-xs text-emerald-300/90">{evidences[index]}</span>
						{/if}
					</span>
					{#if index === currentIndex}
						<Spinner size={14} label="En curso" />
					{/if}
				</li>
			{/each}
		</ol>

		<p class="mt-4 text-xs text-slate-500">
			Puede tardar varios segundos: los modelos corren en esta máquina, sin internet. Un paso se
			marca como hecho solo cuando la API publica el dato, no por reloj.
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
