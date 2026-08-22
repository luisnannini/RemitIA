<script lang="ts">
	import { page } from '$app/state';
</script>

<section class="card mt-8">
	<p class="text-xs tracking-wider text-slate-500 uppercase">Error {page.status}</p>
	<h1 class="mt-1 text-lg font-bold text-white">
		{page.status === 404 ? 'No encontré esa pantalla' : 'Algo salió mal'}
	</h1>
	<p class="mt-1.5 text-sm text-slate-400">
		{page.error?.message ?? 'Volvé al inicio para empezar una recepción.'}
	</p>
	<a href="/" class="btn-primary mt-4 w-full">Volver al inicio</a>
</section>
