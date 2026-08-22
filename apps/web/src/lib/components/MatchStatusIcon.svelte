<script lang="ts">
	/**
	 * Ícono por estado de match. Formas claramente distintas (tilde, interrogación,
	 * triángulo, círculo tachado) para que el estado se distinga en un video de
	 * celular incluso sin percibir el color. Decorativo: el texto lo da MatchBadge.
	 */
	import type { MatchStatus } from '$lib/api';

	interface Props {
		status: MatchStatus;
		size?: number;
	}

	let { status, size = 16 }: Props = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2.2"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
	class="shrink-0"
>
	{#if status === 'matched'}
		<circle cx="12" cy="12" r="9" />
		<path d="m7.8 12.2 2.9 2.9L16.4 9.4" />
	{:else if status === 'ambiguous'}
		<circle cx="12" cy="12" r="9" />
		<path d="M9.3 9.5a2.8 2.8 0 1 1 3.5 3.1c-.6.2-.9.7-.9 1.3v.4" />
		<path d="M12 17.3h.01" />
	{:else if status === 'unmatched'}
		<path d="M12 3.8 21.2 19.4H2.8z" />
		<path d="M12 10.2v3.6" />
		<path d="M12 16.7h.01" />
	{:else}
		<circle cx="12" cy="12" r="9" />
		<path d="m8.4 8.4 7.2 7.2" />
	{/if}
</svg>
