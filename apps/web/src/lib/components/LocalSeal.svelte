<script lang="ts">
	// PRD 10.6 — sello obligatorio en la UI.
	interface Props {
		compact?: boolean;
	}

	let { compact = false }: Props = $props();
</script>

<div
	class="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-emerald-300"
	class:text-xs={compact}
	class:text-sm={!compact}
>
	<svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" aria-hidden="true">
		<path
			d="M12 3l7 3v6c0 4.2-2.9 7.8-7 9-4.1-1.2-7-4.8-7-9V6l7-3Z"
			stroke="currentColor"
			stroke-width="1.7"
			stroke-linejoin="round"
		/>
		<path
			d="M9 12.2l2.1 2.2 4-4.4"
			stroke="currentColor"
			stroke-width="1.7"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
	<span class="font-medium">Procesado localmente con QVAC · sin nube</span>
</div>
