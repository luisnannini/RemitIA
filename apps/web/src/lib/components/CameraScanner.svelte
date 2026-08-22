<script lang="ts">
	/**
	 * Escaneo por cámara (FE-05) — overlay a pantalla completa.
	 *
	 * PRD 8.7 corregido por Rachid en 869a9a7 (rama Rachid), con acuerdo de los
	 * tres builders: la entrada física del conteo es la cámara del celular
	 * (Android + Chrome, etiquetas Code 128); el teclado queda como fallback.
	 * El lector USB keyboard-wedge del PRD original no existe.
	 *
	 * Este componente NO conoce la API: lee códigos y los emite por `onscan`,
	 * exactamente el mismo camino que el submit del input de teclado. Quien llama
	 * pone `client_event_id` y `quantity: 1` (PRD 8.7) y renderiza la vista que
	 * devuelve el servidor. Acá no se suma ni se decide nada del conteo: el
	 * número grande es `units_counted` del servidor, que es la verdad (PRD 10.3).
	 *
	 * Decodificación con la API nativa `BarcodeDetector` (ver
	 * `src/barcode-detector.d.ts`): sin librerías externas, P0 offline.
	 */
	import {
		CAMERA_INSECURE,
		CAMERA_UNSUPPORTED,
		cameraProblem,
		type CameraProblem
	} from '$lib/ui/camera';

	interface Props {
		/**
		 * `view.summary.units_counted`: el contador que manda. Llega como número y
		 * no como vista entera a propósito — el overlay no debe poder mirar el
		 * resto del contrato.
		 */
		unitsCounted: number;
		/** Hay un `POST /scans` en vuelo: no se emite ninguna detección. */
		scanning: boolean;
		onscan: (code: string) => void;
		onclose: () => void;
	}

	let { unitsCounted, scanning, onscan, onclose }: Props = $props();

	/** Un frame cada ~200 ms: alcanza para leer y no funde la batería. */
	const DETECT_INTERVAL_MS = 200;
	/**
	 * Un mismo apuntado sostenido produce una detección por frame. El cooldown es
	 * POR CÓDIGO: sostener la cámara no dispara diez `POST /scans`, y re-apuntar
	 * deliberadamente después de la ventana sí suma otra unidad.
	 */
	const COOLDOWN_MS = 1500;
	/** `HAVE_CURRENT_DATA`: antes de esto `detect()` rechaza con `InvalidStateError`. */
	const HAVE_CURRENT_DATA = 2;

	let video = $state<HTMLVideoElement | null>(null);
	let closeButton = $state<HTMLButtonElement | null>(null);
	let problemRetryButton = $state<HTMLButtonElement | null>(null);
	let problemCloseButton = $state<HTMLButtonElement | null>(null);

	let problem = $state<CameraProblem | null>(null);
	let live = $state(false);
	/** Contador local, solo informativo. El del servidor es el protagonista. */
	let sessionCount = $state(0);
	let lastCode = $state<string | null>(null);
	/** Se incrementa en cada aceptación: re-monta el flash con `{#key}`. */
	let flashes = $state(0);
	/** Dependencia explícita del efecto de cámara: reintentar lo re-ejecuta. */
	let attempt = $state(0);

	/** código → instante de la última emisión. No es estado de UI: Map común. */
	const cooldown = new Map<string, number>();

	/**
	 * Emite un código leído, o lo descarta. Las dos razones para descartar:
	 *
	 *   - `scanning`: ya hay un `POST /scans` en vuelo. El padre pone `scanning`
	 *     en `true` de forma síncrona dentro de `onscan`, así que dos códigos del
	 *     MISMO frame tampoco se pisan;
	 *   - cooldown vigente para ese código.
	 */
	function accept(rawValue: string) {
		const code = rawValue.trim();
		if (!code || scanning) return;

		const now = Date.now();
		const seen = cooldown.get(code);
		if (seen !== undefined && now - seen < COOLDOWN_MS) return;

		// La ventana ya venció para el resto: la tabla no crece sin techo.
		if (cooldown.size > 32) {
			for (const [key, at] of cooldown) if (now - at >= COOLDOWN_MS) cooldown.delete(key);
		}
		cooldown.set(code, now);

		lastCode = code;
		flashes += 1;
		sessionCount += 1;
		// Feedback físico donde no se escucha nada: el depósito es ruidoso.
		navigator.vibrate?.(40);

		onscan(code);
	}

	/**
	 * Ciclo de vida de la cámara. El teardown para SIEMPRE los tracks, incluso si
	 * el componente se desmonta con la cámara abierta o si `getUserMedia` todavía
	 * está en vuelo (`stopped` cubre esa carrera): dejar un track vivo mantiene la
	 * luz de la cámara prendida.
	 *
	 * `scanning` NO es dependencia: se lee dentro del `setInterval`, fuera del
	 * contexto reactivo, así que un escaneo no reinicia la cámara.
	 */
	$effect(() => {
		const el = video;
		void attempt;
		if (!el) return;

		problem = null;
		live = false;

		let stream: MediaStream | null = null;
		let timer: ReturnType<typeof setInterval> | null = null;
		let stopped = false;
		let busy = false;

		// "Apuntá al código" recién cuando el <video> pinta frames de verdad: si
		// autoplay quedara bloqueado, el título se queda en "Preparando la cámara…".
		const onPlaying = () => {
			if (!stopped) live = true;
		};

		// Arrow + `const` a propósito: una `function` declarada acá se hoistea y
		// TypeScript pierde el estrechamiento de `el` a `HTMLVideoElement`.
		const stop = () => {
			stopped = true;
			if (timer) clearInterval(timer);
			timer = null;
			stream?.getTracks().forEach((track) => track.stop());
			stream = null;
			el.removeEventListener('playing', onPlaying);
			el.srcObject = null;
		};

		const tick = async (detector: BarcodeDetector) => {
			// Una detección a la vez: en un celular lento `detect()` puede tardar
			// más que el intervalo y encolar trabajo que ya no sirve.
			if (busy || stopped || el.readyState < HAVE_CURRENT_DATA) return;
			busy = true;
			try {
				const barcodes = await detector.detect(el);
				// `stop()` pudo correr durante el `await`: `detect()` en vuelo no se
				// cancela, y un código resuelto tarde dispararía un `POST /scans`
				// que la persona ya no ve (el overlay se cerró).
				if (stopped) return;
				for (const barcode of barcodes) accept(barcode.rawValue);
			} catch {
				// Un frame suelto puede rechazar (el `<video>` todavía no decodificó,
				// la pestaña pasó a segundo plano). No rompe el loop y no se le
				// muestra a la persona: el frame siguiente vuelve a intentar.
			} finally {
				busy = false;
			}
		};

		(async () => {
			const Detector = window.BarcodeDetector;
			if (!Detector) {
				problem = CAMERA_UNSUPPORTED;
				return;
			}
			// Sin contexto seguro (HTTP en una IP de la LAN) `mediaDevices` no existe.
			if (!navigator.mediaDevices?.getUserMedia) {
				problem = CAMERA_INSECURE;
				return;
			}

			let detector: BarcodeDetector;
			try {
				detector = new Detector({ formats: ['code_128'] });
			} catch (cause) {
				problem = cameraProblem(cause);
				return;
			}

			try {
				// Cámara trasera: la de atrás es la que apunta al producto.
				stream = await navigator.mediaDevices.getUserMedia({
					video: { facingMode: 'environment' }
				});
			} catch (cause) {
				problem = cameraProblem(cause);
				return;
			}

			if (stopped) {
				// El teardown corrió mientras se pedía el permiso: `stream` se asignó
				// después de `stop()` y hay que apagarlo acá.
				stream.getTracks().forEach((track) => track.stop());
				stream = null;
				return;
			}

			el.srcObject = stream;
			el.muted = true;
			el.addEventListener('playing', onPlaying);
			try {
				await el.play();
			} catch {
				// Autoplay bloqueado: `autoplay muted playsinline` alcanza en Chrome.
			}
			if (stopped) return;

			timer = setInterval(() => void tick(detector), DETECT_INTERVAL_MS);
		})();

		return stop;
	});

	/**
	 * Foco del diálogo (a11y). Enfocar solo al montar no alcanza: cuando aparece
	 * `problem`, el header pasa a `inert` con el foco adentro y el navegador lo
	 * tira a <body>; el panel de error quedaría invisible para teclado y lector
	 * de pantalla. Cada cambio de `problem` reubica el foco en el lado activo.
	 */
	$effect(() => {
		if (problem) (problemRetryButton ?? problemCloseButton)?.focus();
		else closeButton?.focus();
	});

	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		onclose();
	}

	function retry() {
		problem = null;
		attempt += 1;
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div
	class="fixed inset-0 z-50 bg-black"
	role="dialog"
	aria-modal="true"
	aria-labelledby="camera-scanner-title"
>
	<!-- Video en vivo de la cámara: no hay audio ni pista que subtitular. -->
	<!-- svelte-ignore a11y_media_has_caption -->
	<video
		bind:this={video}
		class="absolute inset-0 h-full w-full object-cover"
		autoplay
		muted
		playsinline
	></video>

	<!-- Con el panel de error arriba, el header y el footer quedan tapados:
	     `inert` los saca también del orden de tabulación, así el único "Cerrar"
	     alcanzable es el del panel. -->
	<div
		class="absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-black/80 via-transparent to-black/85"
		inert={problem !== null}
	>
		<header class="flex items-start justify-between gap-3 p-4">
			<div class="min-w-0">
				<h2 id="camera-scanner-title" class="text-base font-bold text-white">
					Escaneá con la cámara
				</h2>
				<p class="text-xs text-white/70">
					{live ? 'Apuntá al código de barras del producto.' : 'Preparando la cámara…'}
				</p>
			</div>
			<button
				bind:this={closeButton}
				type="button"
				class="btn-secondary shrink-0 border-white/25 bg-black/60 px-4"
				onclick={onclose}
			>
				Cerrar
			</button>
		</header>

		<!-- Mira: dice dónde poner la etiqueta. No recorta nada: `detect()` mira el
		     frame entero, así que un código apenas afuera también se lee. -->
		<div class="pointer-events-none flex flex-1 items-center justify-center px-8">
			<div class="relative aspect-[5/2] w-full max-w-sm rounded-2xl border-2 border-white/60">
				{#key flashes}
					{#if flashes > 0}
						<div class="flash absolute -inset-0.5 rounded-2xl bg-emerald-400"></div>
					{/if}
				{/key}
			</div>
		</div>

		<footer class="p-4">
			<div class="rounded-2xl border border-white/15 bg-black/70 p-3">
				<div class="flex items-end justify-between gap-3">
					<div class="min-w-0">
						<p class="text-[11px] tracking-wider text-sky-300/70 uppercase">Contado</p>
						<!-- El total lo publica el servidor; acá no se suma nada. -->
						<p class="tnum text-5xl leading-none font-black text-sky-200">{unitsCounted}</p>
					</div>
					<div class="shrink-0 text-right">
						<p class="text-[11px] tracking-wider text-white/45 uppercase">En esta sesión</p>
						<p class="tnum text-xl leading-tight font-bold text-white/75">{sessionCount}</p>
					</div>
				</div>

				<p class="mt-2 truncate text-xs text-white/70" aria-live="polite">
					{#if scanning}
						Sumando…
					{:else if lastCode}
						Leído <span class="font-mono text-emerald-300">{lastCode}</span>
					{:else}
						Esperando un código…
					{/if}
				</p>
			</div>
			<p class="mt-2 text-center text-[11px] text-white/50">
				Code 128. Cerrá el overlay para escribir un código a mano.
			</p>
		</footer>
	</div>

	{#if problem}
		<!-- Falla local del navegador: no es el envelope del PRD 8.11 y no va al
		     ErrorPanel global. Mensaje humano y una salida, nunca un stack trace. -->
		<div class="absolute inset-0 z-10 grid place-items-center bg-black/90 p-6" role="alert">
			<div class="card w-full max-w-sm">
				<p class="text-base font-bold text-white">{problem.title}</p>
				<p class="mt-1.5 text-sm text-slate-300">{problem.hint}</p>
				<div class="mt-4 grid gap-2">
					{#if problem.retry}
						<button
							bind:this={problemRetryButton}
							type="button"
							class="btn-primary w-full"
							onclick={retry}
						>
							Reintentar
						</button>
					{/if}
					<button
						bind:this={problemCloseButton}
						type="button"
						class="btn-secondary w-full"
						onclick={onclose}
					>
						Cerrar y escribir el código
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Destello verde por lectura aceptada: se ve a un metro y no depende del
	   sonido (el depósito es ruidoso) ni de la vibración (no siempre existe). */
	.flash {
		animation: flash 420ms ease-out forwards;
	}

	@keyframes flash {
		from {
			opacity: 0.75;
		}
		to {
			opacity: 0;
		}
	}
</style>
