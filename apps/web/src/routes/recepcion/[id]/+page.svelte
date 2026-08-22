<script lang="ts">
	/**
	 * Router de pantallas por estado.
	 *
	 * La máquina de estados del PRD 7 manda: este componente NO decide
	 * transiciones, solo elige qué pantalla mostrar según `view.status` y vuelve
	 * a renderizar la vista que devuelve cada llamada.
	 */
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		ApiError,
		getApiClient,
		isApiError,
		pollReception,
		type ApiClient,
		type AssignRequest,
		type CatalogProduct,
		type ReceptionView
	} from '$lib/api';
	import { newClientEventId } from '$lib/ui/labels';
	import ErrorPanel from '$lib/components/ErrorPanel.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import ProcessingScreen from '$lib/components/screens/ProcessingScreen.svelte';
	import ReceivingScreen from '$lib/components/screens/ReceivingScreen.svelte';
	import ReviewScreen from '$lib/components/screens/ReviewScreen.svelte';
	import SummaryScreen from '$lib/components/screens/SummaryScreen.svelte';

	let receptionId = $derived(page.params.id ?? '');

	let view = $state<ReceptionView | null>(null);
	let products = $state<CatalogProduct[]>([]);
	let error = $state<ApiError | null>(null);
	let loading = $state(true);

	let busyLineId = $state<string | null>(null);
	let scanning = $state(false);
	let finalizing = $state(false);
	let claiming = $state(false);
	let closing = $state(false);
	let resetting = $state(false);

	let elapsedSeconds = $state(0);

	function handle(cause: unknown) {
		error = isApiError(cause) ? cause : null;
		if (!error) console.error(cause);
	}

	async function withClient<T>(run: (client: ApiClient) => Promise<T>): Promise<T | null> {
		try {
			const client = await getApiClient();
			return await run(client);
		} catch (cause) {
			handle(cause);
			return null;
		}
	}

	/** Catálogo: se carga una vez y se filtra client-side (PRD 8.2). */
	async function loadCatalog() {
		const catalog = await withClient((client) => client.getCatalog());
		if (catalog) products = catalog.products;
	}

	/**
	 * Carga inicial + polling mientras el documento se procesa (ADR-004).
	 * El corte lo decide el `status` publicado por la API, no la web.
	 */
	$effect(() => {
		const id = receptionId;
		if (!id) return;

		const controller = new AbortController();
		let ticker: ReturnType<typeof setInterval> | null = null;

		loading = true;
		error = null;
		elapsedSeconds = 0;

		(async () => {
			const client = await getApiClient().catch((cause) => {
				handle(cause);
				return null;
			});
			if (!client || controller.signal.aborted) return;

			try {
				const first = await client.getReception(id, { signal: controller.signal });
				view = first;
				loading = false;

				if (first.status === 'processing_document') {
					const started = Date.now();
					ticker = setInterval(() => {
						elapsedSeconds = Math.floor((Date.now() - started) / 1000);
					}, 500);

					const final = await pollReception(id, {
						signal: controller.signal,
						onView: (next) => {
							view = next;
						}
					});
					view = final;
				}
			} catch (cause) {
				if (controller.signal.aborted) return;
				loading = false;
				handle(cause);
			} finally {
				if (ticker) clearInterval(ticker);
			}
		})();

		void loadCatalog();

		return () => {
			controller.abort();
			if (ticker) clearInterval(ticker);
		};
	});

	/* ---- Acciones: cada una renderiza exclusivamente la vista devuelta ---- */

	async function answer(questionId: string, selectedSku: string) {
		const line = view?.lines.find((item) => item.match.question?.question_id === questionId);
		busyLineId = line?.line_id ?? null;
		error = null;
		const next = await withClient((client) =>
			client.answerQuestion(receptionId, { question_id: questionId, selected_sku: selectedSku })
		);
		if (next) view = next;
		busyLineId = null;
	}

	async function assign(lineId: string, payload: AssignRequest) {
		busyLineId = lineId;
		error = null;
		const next = await withClient((client) => client.assignLine(receptionId, lineId, payload));
		if (next) view = next;
		busyLineId = null;
	}

	async function scan(code: string) {
		scanning = true;
		error = null;
		const next = await withClient((client) =>
			client.registerScan(receptionId, {
				client_event_id: newClientEventId(),
				barcode_or_sku: code,
				quantity: 1
			})
		);
		if (next) view = next;
		scanning = false;
	}

	async function finalize() {
		finalizing = true;
		error = null;
		const next = await withClient((client) => client.finalize(receptionId));
		if (next) view = next;
		finalizing = false;
	}

	async function claim() {
		claiming = true;
		error = null;
		const generated = await withClient((client) => client.generateClaim(receptionId));
		if (generated) {
			// Se vuelve a pedir la vista canónica: el claim viaja dentro de ella.
			const next = await withClient((client) => client.getReception(receptionId));
			if (next) view = next;
		}
		claiming = false;
	}

	async function close() {
		closing = true;
		error = null;
		const next = await withClient((client) => client.closeReception(receptionId));
		if (next) view = next;
		closing = false;
	}

	async function reset() {
		resetting = true;
		error = null;
		const done = await withClient(async (client) => {
			await client.resetDemo();
			return true;
		});
		resetting = false;
		if (done) await goto('/');
	}

	async function reload() {
		loading = true;
		error = null;
		const next = await withClient((client) => client.getReception(receptionId));
		if (next) view = next;
		loading = false;
	}
</script>

{#if loading && !view}
	<div class="flex items-center gap-3 py-16 text-slate-400">
		<Spinner size={22} />
		<p class="text-sm">Cargando la recepción…</p>
	</div>
{:else if !view}
	<div class="grid gap-3 py-8">
		<!-- `start_over` (ej. RECEPTION_NOT_FOUND) vuelve al inicio; reintentar el
		     mismo GET con el mismo id volvería a fallar igual. -->
		<ErrorPanel {error} onretry={error?.userAction === 'start_over' ? () => goto('/') : reload} />
		<a href="/" class="btn-secondary w-full">Volver al inicio</a>
	</div>
{:else}
	<div class="grid gap-4">
		{#if error}
			<ErrorPanel {error} onretry={reload} compact />
		{/if}

		{#if view.status === 'processing_document' || view.status === 'draft'}
			<ProcessingScreen {view} {elapsedSeconds} />
		{:else if view.status === 'needs_document_review'}
			<ReviewScreen {view} {products} {busyLineId} onanswer={answer} onassign={assign} />
		{:else if view.status === 'receiving'}
			<ReceivingScreen {view} {scanning} {finalizing} onscan={scan} onfinalize={finalize} />
		{:else if view.status === 'ready_to_claim' || view.status === 'closed'}
			<SummaryScreen
				{view}
				{claiming}
				{closing}
				{resetting}
				onclaim={claim}
				onclose={close}
				onreset={reset}
			/>
		{:else if view.status === 'failed'}
			<section class="card">
				<h1 class="text-lg font-bold text-white">No pude procesar el remito</h1>
				<p class="mt-1.5 text-sm text-slate-400">
					La foto no pudo leerse con seguridad. Probá con otra imagen, mejor iluminada y sin
					inclinación.
				</p>
				<a href="/" class="btn-primary mt-4 w-full">Sacar otra foto</a>
			</section>
		{/if}
	</div>
{/if}
