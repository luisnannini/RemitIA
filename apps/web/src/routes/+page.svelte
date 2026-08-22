<script lang="ts">
	/**
	 * Pantalla 1 — HOME (PRD 11.1).
	 * Banner de ready check, cámara/upload y promesa de privacidad local.
	 * La captura completa (preview, validaciones, reintento) es FE-02.
	 */
	import { goto } from '$app/navigation';
	import { ApiError, getApiClient, isApiError } from '$lib/api';
	import ErrorPanel from '$lib/components/ErrorPanel.svelte';
	import HealthBanner from '$lib/components/HealthBanner.svelte';
	import LocalSeal from '$lib/components/LocalSeal.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	let ready = $state(false);
	let file = $state<File | null>(null);
	let sending = $state(false);
	let error = $state<ApiError | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);

	function onFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		file = input.files?.[0] ?? null;
		error = null;
	}

	async function start() {
		if (!file || sending) return;
		// PRD 8.3: sin Idempotency-Key, la web deshabilita el botón tras el primer toque.
		sending = true;
		error = null;
		try {
			const client = await getApiClient();
			const accepted = await client.createReception(file);
			await goto(`/recepcion/${accepted.reception_id}`);
		} catch (cause) {
			error = isApiError(cause) ? cause : null;
			sending = false;
		}
	}

	function reset() {
		file = null;
		error = null;
		if (fileInput) fileInput.value = '';
	}
</script>

<div class="grid gap-4">
	<HealthBanner onready={(value) => (ready = value)} />

	<section class="card">
		<h1 class="text-xl leading-tight font-bold text-white">
			Sacá una foto del remito y recibí con criterio de veterano
		</h1>
		<p class="mt-2 text-sm text-slate-400">
			RemitIA lee el documento, lo relaciona con tu catálogo, te guía en el conteo y deja el reclamo
			redactado antes de que el camión se vaya.
		</p>

		<div class="mt-4 grid gap-2.5">
			<!-- ADR-009: captura con input file; sin micrófono ni audio. -->
			<input
				bind:this={fileInput}
				id="document"
				type="file"
				accept="image/jpeg,image/png"
				capture="environment"
				class="sr-only"
				onchange={onFileChange}
				disabled={sending}
			/>

			<label
				for="document"
				class="btn-primary w-full cursor-pointer"
				class:pointer-events-none={sending}
			>
				<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" aria-hidden="true">
					<path
						d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1-1.8h6.6l1 1.8h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linejoin="round"
					/>
					<circle cx="12" cy="12.5" r="3.2" stroke="currentColor" stroke-width="1.8" />
				</svg>
				{file ? 'Cambiar foto' : 'Tomar o elegir foto del remito'}
			</label>

			{#if file}
				<div
					class="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5"
				>
					<div class="min-w-0">
						<p class="truncate text-sm text-slate-200">{file.name}</p>
						<p class="text-[11px] text-slate-500">
							{(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || 'tipo desconocido'}
						</p>
					</div>
					<button type="button" class="btn-ghost px-2 text-xs" onclick={reset} disabled={sending}>
						Quitar
					</button>
				</div>
			{/if}

			<button type="button" class="btn-primary w-full" disabled={!file || !ready || sending} onclick={start}>
				{#if sending}
					<Spinner size={16} />
					Iniciando recepción…
				{:else}
					Iniciar recepción
				{/if}
			</button>

			{#if !ready}
				<p class="text-center text-xs text-amber-300/80">
					Esperando que el sistema esté listo para habilitar la recepción.
				</p>
			{/if}
		</div>

		{#if error}
			<div class="mt-3">
				<!-- Reintentar = repetir el POST con la MISMA foto; si la acción pedida
			     es otra foto (INVALID_FILE), el botón descarta la actual. -->
			<ErrorPanel {error} onretry={error?.userAction === 'take_another_photo' ? reset : start} />
			</div>
		{/if}
	</section>

	<section class="card">
		<h2 class="text-sm font-semibold text-white">Promesa de privacidad</h2>
		<ul class="mt-2.5 grid gap-2 text-sm text-slate-400">
			<li class="flex gap-2.5">
				<span class="mt-0.5 text-emerald-400" aria-hidden="true">•</span>
				La foto se procesa en esta máquina. No se sube a ninguna nube.
			</li>
			<li class="flex gap-2.5">
				<span class="mt-0.5 text-emerald-400" aria-hidden="true">•</span>
				No hay claves de IA externas ni fallback remoto.
			</li>
			<li class="flex gap-2.5">
				<span class="mt-0.5 text-emerald-400" aria-hidden="true">•</span>
				Los documentos se borran con el reset de la demo.
			</li>
		</ul>
		<div class="mt-3">
			<LocalSeal compact />
		</div>
	</section>
</div>
