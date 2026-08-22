<script lang="ts">
	import { ApiError, getApiClient, hasUserAction, isApiError, type HealthView } from '$lib/api';
	import { serviceStatusLabel } from '$lib/ui/labels';
	import ErrorPanel from './ErrorPanel.svelte';
	import Spinner from './Spinner.svelte';

	interface Props {
		/** Se notifica al padre si la API está `ready` (PRD 8.1). */
		onready?: (ready: boolean) => void;
	}

	let { onready }: Props = $props();

	let health = $state<HealthView | null>(null);
	let error = $state<ApiError | null>(null);
	let loading = $state(true);

	async function load() {
		loading = true;
		error = null;
		try {
			const client = await getApiClient();
			health = await client.getHealth();
		} catch (cause) {
			health = null;
			error = isApiError(cause) ? cause : null;
		} finally {
			loading = false;
			onready?.(health?.status === 'ready');
		}
	}

	$effect(() => {
		void load();
	});

	let tone = $derived(
		health?.status === 'ready'
			? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
			: health?.status === 'degraded'
				? 'border-amber-400/30 bg-amber-500/10 text-amber-200'
				: 'border-white/10 bg-white/5 text-slate-300'
	);
</script>

<section aria-label="Estado del sistema">
	{#if loading && !health}
		<div class="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
			<Spinner label="Consultando estado" />
			<p class="text-sm text-slate-300">Verificando que todo esté listo…</p>
		</div>
	{:else if error}
		<div class="grid gap-2">
			<ErrorPanel {error} onretry={load} compact />
			{#if !hasUserAction(error)}
				<!-- GET idempotente que habilita toda la Home: siempre debe poder reconsultarse. -->
				<button type="button" class="btn-secondary w-full sm:w-auto" onclick={load}>
					Volver a verificar
				</button>
			{/if}
		</div>
	{:else if health}
		<div class="rounded-2xl border p-4 {tone}">
			<div class="flex items-center justify-between gap-3">
				<div class="flex items-center gap-2.5">
					<span
						class="h-2.5 w-2.5 shrink-0 rounded-full"
						class:bg-emerald-400={health.status === 'ready'}
						class:bg-amber-400={health.status === 'degraded'}
						class:bg-slate-400={health.status === 'starting'}
						class:animate-pulse={health.status !== 'ready'}
					></span>
					<p class="text-sm font-semibold">
						{health.status === 'ready'
							? 'Todo listo para recibir'
							: `Sistema ${serviceStatusLabel[health.status].toLowerCase()}`}
					</p>
				</div>
				<button
					type="button"
					class="text-xs font-medium text-slate-300 underline underline-offset-2 hover:text-white"
					onclick={load}
				>
					Actualizar
				</button>
			</div>

			<dl class="mt-3 grid grid-cols-3 gap-2 text-[11px]">
				<div class="rounded-lg bg-black/20 px-2 py-1.5">
					<dt class="text-slate-400">API</dt>
					<dd class="font-semibold">{serviceStatusLabel[health.api]}</dd>
				</div>
				<div class="rounded-lg bg-black/20 px-2 py-1.5">
					<dt class="text-slate-400">Base</dt>
					<dd class="font-semibold">{serviceStatusLabel[health.database]}</dd>
				</div>
				<div class="rounded-lg bg-black/20 px-2 py-1.5">
					<dt class="text-slate-400">QVAC</dt>
					<dd class="font-semibold">{serviceStatusLabel[health.qvac.status]}</dd>
				</div>
			</dl>

			{#if health.qvac.models.length > 0}
				<ul class="mt-2 flex flex-wrap gap-1.5">
					{#each health.qvac.models as model (model.capability + model.name)}
						<li class="chip bg-black/25 text-[10px] text-slate-300">
							{model.capability}: {model.name}
							{model.loaded ? '· cargado' : '· sin cargar'}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</section>
