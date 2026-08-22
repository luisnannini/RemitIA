<script lang="ts">
	import { ApiError, hasUserAction, userActionLabel } from '$lib/api';

	interface Props {
		error: ApiError | null;
		/**
		 * Acción del botón principal. Si no se pasa, no se muestra botón.
		 * Tampoco se muestra si el envelope no habilita ninguna acción
		 * (`retryable: false` y `user_action: null`).
		 */
		onretry?: (() => void) | null;
		compact?: boolean;
	}

	let { error, onretry = null, compact = false }: Props = $props();

	// PRD 8.11: se muestra `message` y una acción humana; nunca un stack trace.
	let actionLabel = $derived(error ? userActionLabel(error.userAction) : '');
	let showAction = $derived(!!error && !!onretry && hasUserAction(error));
</script>

{#if error}
	<div
		class="rounded-2xl border border-rose-400/30 bg-rose-500/10 {compact ? 'p-3' : 'p-4'}"
		role="alert"
	>
		<p class="text-sm font-semibold text-rose-200">{error.message}</p>

		<div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-rose-300/70">
			<span class="font-mono">{error.code}</span>
			{#if error.traceId}
				<span class="font-mono">trace: {error.traceId}</span>
			{/if}
			{#if !error.retryable}
				<span>No se puede reintentar automáticamente.</span>
			{/if}
		</div>

		{#if showAction && onretry}
			<button type="button" class="btn-secondary mt-3 w-full sm:w-auto" onclick={onretry}>
				{actionLabel}
			</button>
		{/if}
	</div>
{/if}
