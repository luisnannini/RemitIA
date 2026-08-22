<script lang="ts">
	import type { MatchStatus } from '$lib/api';
	import { matchStatusLabel, matchStatusTone } from '$lib/ui/labels';

	interface Props {
		status: MatchStatus;
	}

	let { status }: Props = $props();
</script>

<span class="chip {matchStatusTone[status]}">{matchStatusLabel[status]}</span>
