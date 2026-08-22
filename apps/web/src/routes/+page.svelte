<script lang="ts">
	/**
	 * Pantalla 1 — HOME (PRD 11.1).
	 * Banner de ready check, captura del remito (cámara o archivo) con preview y
	 * validación local, y promesa de privacidad local.
	 *
	 * La web no decide transiciones: hace `POST /receptions` (PRD 8.3) y navega a
	 * la recepción con el `reception_id` que devuelve el 202.
	 */
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ApiError, getApiClient, isApiError } from '$lib/api';
	import DocumentPicker from '$lib/components/DocumentPicker.svelte';
	import ErrorPanel from '$lib/components/ErrorPanel.svelte';
	import HealthBanner from '$lib/components/HealthBanner.svelte';
	import LocalSeal from '$lib/components/LocalSeal.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	let ready = $state(false);
	let file = $state<File | null>(null);
	let sending = $state(false);
	let error = $state<ApiError | null>(null);
	let recaptureRequested = $state(false);
	let picker = $state<ReturnType<typeof DocumentPicker> | null>(null);

	/**
	 * Se llega acá con `?recapturar=1` desde una recepción que terminó en `failed`
	 * (PRD 7): el Home queda listo para capturar de nuevo.
	 */
	let cameFromFailure = $derived(page.url.searchParams.has('recapturar'));
	let needsNewPhoto = $derived((recaptureRequested || cameFromFailure) && !file);

	// Al volver desde una recepción fallida, el foco arranca en "Sacar foto".
	$effect(() => {
		if (cameFromFailure) picker?.focusCapture();
	});

	function pick(next: File | null) {
		file = next;
		error = null;
		if (next) recaptureRequested = false;
	}

	async function start() {
		// `ready` solo deshabilita el botón: si el envelope pide `retry`, se reintenta
		// igual y que el servidor conteste, en vez de dejar un botón que no hace nada.
		if (!file || sending) return;
		// PRD 8.3: sin Idempotency-Key, la web deshabilita el botón tras el primer toque.
		sending = true;
		error = null;
		try {
			const client = await getApiClient();
			const accepted = await client.createReception(file);
			await goto(`/recepcion/${accepted.reception_id}`);
		} catch (cause) {
			error = isApiError(cause) ? cause : null;
			// Nada que no venga con envelope llega a la pantalla (PRD 8.11): que al
			// menos quede en la consola y no se pierda en silencio.
			if (!error) console.error(cause);
			sending = false;
		}
	}

	/** `take_another_photo`: se descarta la foto y se vuelve a capturar. */
	function retakePhoto() {
		file = null;
		error = null;
		recaptureRequested = true;
		picker?.focusCapture();
	}

	/** `start_over`: Home limpio, sin insistir con una foto nueva. */
	function startOver() {
		file = null;
		error = null;
		recaptureRequested = false;
	}

	/**
	 * Mapeo de `user_action` del envelope (PRD 8.11) a la acción de la Home.
	 *
	 * `POST /receptions` NO es idempotente (PRD 8.3: sin `Idempotency-Key`), así
	 * que un reintento a ciegas puede crear una segunda recepción. Solo se
	 * reintenta el POST cuando el servidor lo pide explícitamente con `retry`.
	 * Ante una acción desconocida, ausente o que pide intervención humana, el
	 * ErrorPanel no ofrece botón: se muestra el mensaje y la decisión vuelve a la
	 * persona, que tiene la foto y el botón "Iniciar recepción" a mano.
	 */
	interface RetryPlan {
		run: (() => void) | null;
		hint: string | null;
	}

	function planFor(current: ApiError): RetryPlan {
		switch (current.userAction) {
			case 'take_another_photo':
				return { run: retakePhoto, hint: null };
			case 'retry':
				// Solo si el `retry` viene del servidor (envelope real). En los errores
				// sintéticos del cliente (httpStatus 0: red caída, CLIENT_TIMEOUT) el
				// POST pudo haber llegado igual, y POST /receptions no es idempotente:
				// un re-POST automático puede duplicar la recepción.
				if (current.httpStatus === 0) {
					return {
						run: null,
						hint: 'No reintento la subida sola: pudo haber llegado igual. Verificá la conexión y tocá "Iniciar recepción" si querés insistir.'
					};
				}
				return { run: start, hint: null };
			case 'start_over':
				return { run: startOver, hint: null };
			case 'contact_support':
				return {
					run: null,
					hint: current.traceId
						? `Anotá el trace ${current.traceId} y avisale a quien opera la demo.`
						: 'Avisale a quien opera la demo antes de volver a intentar.'
				};
			default:
				return {
					run: null,
					hint: 'No reintento la subida por mi cuenta: revisá la foto y tocá "Iniciar recepción" cuando quieras.'
				};
		}
	}

	let plan = $derived(error ? planFor(error) : null);
</script>

<div class="grid gap-4">
	<HealthBanner onready={(value) => (ready = value)} />

	<section class="card">
		<h1 class="text-xl leading-tight font-bold text-white">
			Sacá una foto del remito y recibí con criterio de veterano
		</h1>
		<p class="mt-2 text-sm text-slate-400">
			RemitIA lee el documento, lo relaciona con tu catálogo, te guía en el conteo y deja el reclamo
			redactado antes de que el camión se vaya.
		</p>

		{#if needsNewPhoto}
			<div class="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
				<p class="text-sm font-semibold text-amber-100">Probemos con otra foto</p>
				<p class="mt-1 text-xs text-amber-200/80">
					Buena luz, el remito completo dentro del cuadro y sin inclinación. El documento no sale de
					esta máquina.
				</p>
			</div>
		{/if}

		<div class="mt-4 grid gap-2.5">
			<DocumentPicker
				bind:this={picker}
				{file}
				disabled={sending}
				highlight={needsNewPhoto}
				onpick={pick}
			/>

			<button
				type="button"
				class="btn-primary w-full"
				disabled={!file || !ready || sending}
				onclick={start}
			>
				{#if sending}
					<Spinner size={16} />
					Iniciando recepción…
				{:else}
					Iniciar recepción
				{/if}
			</button>

			{#if !ready}
				<p class="text-center text-xs text-amber-300/80">
					Esperando que el sistema esté listo para habilitar la recepción.
				</p>
			{/if}
		</div>

		{#if error}
			<div class="mt-3 grid gap-2">
				<ErrorPanel {error} onretry={plan?.run ?? null} />
				{#if plan?.hint}
					<p class="text-xs text-slate-400">{plan.hint}</p>
				{/if}
			</div>
		{/if}
	</section>

	<section class="card">
		<h2 class="text-sm font-semibold text-white">Promesa de privacidad</h2>
		<ul class="mt-2.5 grid gap-2 text-sm text-slate-400">
			<li class="flex gap-2.5">
				<span class="mt-0.5 text-emerald-400" aria-hidden="true">•</span>
				La foto se procesa en esta máquina. No se sube a ninguna nube.
			</li>
			<li class="flex gap-2.5">
				<span class="mt-0.5 text-emerald-400" aria-hidden="true">•</span>
				No hay claves de IA externas ni fallback remoto.
			</li>
			<li class="flex gap-2.5">
				<span class="mt-0.5 text-emerald-400" aria-hidden="true">•</span>
				Los documentos se borran con el reset de la demo.
			</li>
		</ul>
		<div class="mt-3">
			<LocalSeal compact />
		</div>
	</section>
</div>
