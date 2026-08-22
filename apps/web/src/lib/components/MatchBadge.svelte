<script lang="ts">
	/**
	 * Estado de la línea con las tres señales juntas: color, ícono y texto
	 * (criterio 1 de FE-03). No infiere nada: traduce `match.status` tal como
	 * llega de la API.
	 */
	import type { MatchStatus } from '$lib/api';
	import { matchStatusLabel, matchStatusTone } from '$lib/ui/labels';
	import MatchStatusIcon from './MatchStatusIcon.svelte';

	interface Props {
		status: MatchStatus;
		/** `lg` para las líneas que piden acción; `sm` para las ya resueltas. */
		size?: 'sm' | 'lg';
	}

	let { status, size = 'sm' }: Props = $props();
</script>

<span class="chip {matchStatusTone[status]} {size === 'lg' ? 'px-3 py-1.5 text-sm' : ''}">
	<MatchStatusIcon {status} size={size === 'lg' ? 17 : 14} />
	{matchStatusLabel[status]}
</span>
