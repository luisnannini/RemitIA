<script lang="ts">
	interface Props {
		size?: number;
		label?: string;
	}

	let { size = 20, label = 'Cargando' }: Props = $props();
</script>

<span
	class="inline-block animate-spin rounded-full border-2 border-white/20 border-t-sky-400"
	style="width: {size}px; height: {size}px"
	role="status"
	aria-label={label}
></span>
