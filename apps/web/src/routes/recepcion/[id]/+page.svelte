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
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import {
		ApiError,
		getApiClient,
		isApiError,
		pollReception,
		stopsPolling,
		type ApiClient,
		type AssignRequest,
		type CatalogProduct,
		type ReceptionView
	} from '$lib/api';
	import { newClientEventId } from '$lib/ui/labels';
	import ErrorPanel from '$lib/components/ErrorPanel.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import FailedScreen from '$lib/components/screens/FailedScreen.svelte';
	import ProcessingScreen from '$lib/components/screens/ProcessingScreen.svelte';
	import ReceivingScreen from '$lib/components/screens/ReceivingScreen.svelte';
	import ReviewScreen from '$lib/components/screens/ReviewScreen.svelte';
	import SummaryScreen from '$lib/components/screens/SummaryScreen.svelte';

	let receptionId = $derived(page.params.id ?? '');

	let view = $state<ReceptionView | null>(null);
	let products = $state<CatalogProduct[]>([]);
	let error = $state<ApiError | null>(null);
	let loading = $state(true);

	/**
	 * Estado de las acciones de línea, indexado por `line_id` (ver `$lib/ui/actions`):
	 * dos líneas pendientes pueden tener acciones en vuelo a la vez y ninguna
	 * puede pisar el `busy` ni el error de la otra.
	 */
	let busyLines = new SvelteSet<string>();
	/** Rechazo del servidor atribuido a la línea que lo provocó (PRD 8.11). */
	let lineErrors = new SvelteMap<string, ApiError>();
	let scanning = $state(false);
	let finalizing = $state(false);
	let claiming = $state(false);
	let closing = $state(false);
	let resetting = $state(false);

	let elapsedSeconds = $state(0);
	/** Se incrementa para re-ejecutar el efecto de carga/polling (reintento manual). */
	let pollToken = $state(0);

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

	/**
	 * Catálogo: se carga una vez y se filtra client-side (PRD 8.2). Se vuelve a
	 * pedir después de un alta de SKU, que lo modifica (PRD 8.6).
	 *
	 * Ese refresco va en modo `silent`: el alta ya la aceptó la API y la vista
	 * devuelta es la verdad; no poder releer el catálogo no debería pisar la
	 * pantalla con un error.
	 */
	async function loadCatalog(silent = false) {
		const catalog = silent
			? await getApiClient()
					.then((client) => client.getCatalog())
					.catch(() => null)
			: await withClient((client) => client.getCatalog());
		if (catalog) products = catalog.products;
	}

	/** El catálogo se carga una sola vez por montaje (PRD 8.2). */
	$effect(() => {
		void loadCatalog();
	});

	/**
	 * Carga inicial + polling cada 750 ms mientras el documento se procesa (ADR-004).
	 *
	 * El corte lo decide el `status` publicado por la API, no la web: `stopsPolling`
	 * corta en `failed`, `needs_document_review`, `receiving`, `ready_to_claim` y
	 * `closed`, y sigue solo en `draft` / `processing_document` (PRD 7).
	 *
	 * `pollToken` es una dependencia explícita: incrementarlo re-ejecuta el efecto
	 * (con su teardown) y reanuda el polling tras un error.
	 */
	$effect(() => {
		const id = receptionId;
		void pollToken;
		if (!id) return;

		const controller = new AbortController();
		const startedAt = Date.now();
		let ticker: ReturnType<typeof setInterval> | null = setInterval(() => {
			elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
		}, 250);

		const stopTicker = () => {
			if (ticker) clearInterval(ticker);
			ticker = null;
		};

		loading = true;
		error = null;
		lineErrors.clear();
		elapsedSeconds = 0;

		(async () => {
			const client = await getApiClient().catch((cause) => {
				handle(cause);
				return null;
			});
			if (!client || controller.signal.aborted) {
				stopTicker();
				return;
			}

			try {
				const first = await client.getReception(id, { signal: controller.signal });
				view = first;
				loading = false;

				if (!stopsPolling(first.status)) {
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
				stopTicker();
			}
		})();

		return () => {
			controller.abort();
			stopTicker();
		};
	});

	/** Reanuda la consulta tras un error de red o el techo de espera del cliente. */
	function resume() {
		error = null;
		pollToken += 1;
	}

	/* ---- Acciones: cada una renderiza exclusivamente la vista devuelta ---- */

	/**
	 * Acciones sobre una línea (flujos b y c). Tres diferencias con el resto:
	 *
	 *   - el `busy` y el error viven bajo el `line_id` que los produjo: dos
	 *     acciones simultáneas sobre líneas distintas no se pisan;
	 *   - el rechazo del servidor se muestra DENTRO de la tarjeta de esa línea,
	 *     que es donde está el botón que la persona acaba de tocar
	 *     (`SKU_ALREADY_EXISTS` es el caso típico del flujo c);
	 *   - si el error no se puede atribuir a una línea, cae al panel global.
	 *
	 * Devuelve la vista publicada por la API, o `null` si la llamada falló: quien
	 * necesite encadenar algo debe mirar ese valor y no un estado compartido, que
	 * después del `await` ya puede ser de otra línea.
	 *
	 * La vista se reemplaza por la que devuelve la API y nada más: la transición
	 * a `receiving` (PRD 7) llega en ese `status`, no la decide esta función.
	 */
	async function runOnLine(
		lineId: string | null,
		run: (client: ApiClient) => Promise<ReceptionView>
	): Promise<ReceptionView | null> {
		if (lineId) {
			busyLines.add(lineId);
			lineErrors.delete(lineId);
		}
		error = null;
		try {
			const client = await getApiClient();
			const next = await run(client);
			view = next;
			return next;
		} catch (cause) {
			if (lineId && isApiError(cause)) lineErrors.set(lineId, cause);
			else handle(cause);
			return null;
		} finally {
			if (lineId) busyLines.delete(lineId);
		}
	}

	async function answer(questionId: string, selectedSku: string) {
		const line = view?.lines.find((item) => item.match.question?.question_id === questionId);
		await runOnLine(line?.line_id ?? null, (client) =>
			client.answerQuestion(receptionId, { question_id: questionId, selected_sku: selectedSku })
		);
	}

	async function assign(lineId: string, payload: AssignRequest) {
		const next = await runOnLine(lineId, (client) =>
			client.assignLine(receptionId, lineId, payload)
		);
		// El alta agrega un producto al catálogo (PRD 8.6): la copia local quedó
		// vieja y el buscador y el nombre del producto asignado la usan. La
		// decisión se toma con el resultado de ESTA llamada, no leyendo estado
		// después del `await`: otra línea puede haber escrito ahí mientras tanto.
		if (next && 'new_product' in payload) await loadCatalog(true);
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
		<ErrorPanel {error} onretry={error?.userAction === 'start_over' ? () => goto('/') : resume} />
		<a href="/" class="btn-secondary w-full">Volver al inicio</a>
	</div>
{:else}
	<div class="grid gap-4">
		{#if error}
			<ErrorPanel {error} onretry={resume} compact />
		{/if}

		{#if view.status === 'processing_document' || view.status === 'draft'}
			<ProcessingScreen {view} {elapsedSeconds} />
		{:else if view.status === 'needs_document_review'}
			<ReviewScreen
				{view}
				{products}
				{busyLines}
				{lineErrors}
				onanswer={answer}
				onassign={assign}
			/>
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
			<FailedScreen {view} />
		{/if}
	</div>
{/if}
