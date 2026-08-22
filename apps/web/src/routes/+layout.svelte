<script lang="ts">
	import '../app.css';
	import { isMockEnabled } from '$lib/api';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();

	// Solo puede ser `true` con `vite dev`: en el build de producción el mock ni
	// siquiera está en el bundle.
	const usingMock = isMockEnabled();
</script>

<div class="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
	<header
		class="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/5 bg-[#060a14]/85 px-4 py-3 backdrop-blur"
	>
		<a href="/" class="flex items-center gap-2.5">
			<span
				class="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sm font-black text-sky-300"
			>
				R
			</span>
			<span class="leading-tight">
				<span class="block text-sm font-bold tracking-tight text-white">RemitIA</span>
				<span class="block text-[10px] text-slate-500">Recepción guiada local</span>
			</span>
		</a>

		{#if usingMock}
			<span class="chip bg-fuchsia-500/15 text-fuchsia-300 ring-1 ring-fuchsia-400/30">
				datos de ejemplo · dev
			</span>
		{/if}
	</header>

	<main class="flex-1 px-4 pt-4 pb-10">
		{@render children()}
	</main>

	<footer class="px-4 pb-6 text-center text-[11px] text-slate-600">
		Todo corre en esta máquina. Ningún documento sale del depósito.
	</footer>
</div>
