<script lang="ts">
	/**
	 * Captura del remito: cámara o archivo, preview real y validación local.
	 *
	 * - PRD 8.3 / ADR-009: JPG o PNG, máximo 12 MB, input de archivo (sin audio).
	 * - La validación es UX previa a la subida; el server valida igual (ver
	 *   `$lib/ui/document-file.ts`). Este componente NO llama a la API.
	 * - El preview usa `URL.createObjectURL` con `revokeObjectURL` en el teardown
	 *   del `$effect`: se libera al cambiar de foto y al destruir el componente.
	 */
	import {
		DOCUMENT_ACCEPT,
		formatBytes,
		validateDocumentFile,
		type DocumentIssue
	} from '$lib/ui/document-file';

	interface Props {
		/** Foto vigente. La memoria la tiene el padre: así el reintento la conserva. */
		file: File | null;
		disabled?: boolean;
		/** Resalta el bloque cuando se vuelve al Home a sacar otra foto. */
		highlight?: boolean;
		/** `null` = la persona quitó la foto o la que eligió no sirve. */
		onpick: (file: File | null) => void;
	}

	let { file, disabled = false, highlight = false, onpick }: Props = $props();

	let cameraInput = $state<HTMLInputElement | null>(null);
	let libraryInput = $state<HTMLInputElement | null>(null);
	let cameraButton = $state<HTMLButtonElement | null>(null);
	let issue = $state<DocumentIssue | null>(null);
	let zoomed = $state(false);

	/** Preview real de la foto elegida (miniatura, no solo el nombre). */
	let previewUrl = $state<string | null>(null);

	$effect(() => {
		const current = file;
		if (!current) {
			previewUrl = null;
			return;
		}
		const url = URL.createObjectURL(current);
		previewUrl = url;
		return () => {
			// Antes de re-ejecutarse (otra foto) y al destruirse: sin fugas de memoria.
			URL.revokeObjectURL(url);
			previewUrl = null;
		};
	});

	/**
	 * El foco vuelve acá cuando el flujo pide una foto nueva (`take_another_photo`).
	 * Se expone como método de instancia: el padre lo llama con `bind:this`.
	 */
	export function focusCapture() {
		cameraButton?.focus();
	}

	function onFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const picked = input.files?.[0] ?? null;
		// Se limpia el input para que volver a elegir EL MISMO archivo dispare
		// `change` otra vez. El `File` ya está capturado y sigue siendo válido.
		input.value = '';

		if (!picked) return;

		// Si la nueva foto no sirve, NO se pisa la que ya estaba elegida: se avisa
		// y la persona decide. Solo un archivo válido reemplaza al anterior.
		const problem = validateDocumentFile(picked);
		issue = problem;
		if (!problem) onpick(picked);
	}

	function clear() {
		issue = null;
		zoomed = false;
		onpick(null);
	}
</script>

<div class="grid gap-2.5">
	<!-- ADR-009: captura con input file; sin micrófono ni audio. -->
	<input
		bind:this={cameraInput}
		type="file"
		accept={DOCUMENT_ACCEPT}
		capture="environment"
		class="sr-only"
		tabindex="-1"
		aria-hidden="true"
		{disabled}
		onchange={onFileChange}
	/>
	<input
		bind:this={libraryInput}
		type="file"
		accept={DOCUMENT_ACCEPT}
		class="sr-only"
		tabindex="-1"
		aria-hidden="true"
		{disabled}
		onchange={onFileChange}
	/>

	<div class="grid grid-cols-2 gap-2">
		<button
			bind:this={cameraButton}
			type="button"
			class="btn-primary w-full"
			class:ring-2={highlight}
			class:ring-amber-300={highlight}
			{disabled}
			onclick={() => cameraInput?.click()}
		>
			<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" aria-hidden="true">
				<path
					d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1-1.8h6.6l1 1.8h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linejoin="round"
				/>
				<circle cx="12" cy="12.5" r="3.2" stroke="currentColor" stroke-width="1.8" />
			</svg>
			{file ? 'Otra foto' : 'Sacar foto'}
		</button>

		<button
			type="button"
			class="btn-secondary w-full"
			{disabled}
			onclick={() => libraryInput?.click()}
		>
			<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" aria-hidden="true">
				<path
					d="M4 16.5V6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linejoin="round"
				/>
				<path d="m5 16 4.2-4.2 3 3L15.5 11 19 14.5" stroke="currentColor" stroke-width="1.8" />
			</svg>
			Elegir archivo
		</button>
	</div>

	<p class="text-center text-[11px] text-slate-500">JPG o PNG, hasta 12 MB.</p>

	{#if issue}
		<!-- Chequeo local, previo a la subida: se distingue a propósito de un error
		     del servidor (que llega con el envelope del PRD 8.11). -->
		<div class="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3" role="alert">
			<p class="text-sm font-semibold text-amber-100">{issue.message}</p>
			<p class="mt-1 text-[11px] text-amber-300/70">
				Verificado en este dispositivo antes de subir nada.{file
					? ' Sigo con la foto anterior.'
					: ''}
			</p>
		</div>
	{/if}

	{#if file && previewUrl}
		<div class="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-2.5">
			<button
				type="button"
				class="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40"
				onclick={() => (zoomed = true)}
				aria-label="Ver la foto en grande"
			>
				<img src={previewUrl} alt="Foto del remito elegida" class="h-full w-full object-cover" />
			</button>

			<div class="min-w-0 flex-1">
				<p class="truncate text-sm text-slate-200">{file.name}</p>
				<p class="text-[11px] text-slate-500">
					{formatBytes(file.size)} · {file.type || 'tipo desconocido'}
				</p>
				<p class="text-[11px] text-slate-500">Tocá la miniatura para revisar que se lea.</p>
			</div>

			<button type="button" class="btn-ghost px-2 text-xs" {disabled} onclick={clear}>
				Quitar
			</button>
		</div>
	{/if}
</div>

{#if zoomed && previewUrl}
	<!-- Revisión a pantalla completa antes de subir: si no se lee acá, tampoco la
	     va a leer el OCR (PRD 11.3, escenario C). -->
	<div
		class="fixed inset-0 z-40 flex flex-col bg-black/90 p-4"
		role="dialog"
		aria-modal="true"
		aria-label="Foto del remito"
	>
		<div class="flex min-h-0 flex-1 items-center justify-center">
			<img src={previewUrl} alt="Foto del remito elegida" class="max-h-full max-w-full object-contain" />
		</div>
		<button type="button" class="btn-secondary mt-4 w-full" onclick={() => (zoomed = false)}>
			Cerrar
		</button>
	</div>
{/if}
