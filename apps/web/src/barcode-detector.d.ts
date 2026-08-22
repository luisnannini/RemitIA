/**
 * Barcode Detection API — tipos mínimos.
 *
 * `lib.dom.d.ts` (TypeScript 5.9) todavía NO declara `BarcodeDetector`, así que
 * sin esto el overlay de cámara tendría que trabajar con `any`. Se declara solo
 * lo que la app usa, con las firmas de la especificación:
 * https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API
 *
 * Archivo *script* a propósito (sin `import`/`export` de nivel superior): todo
 * lo que declara es global, igual que el resto de las Web APIs.
 *
 * `Window.BarcodeDetector` es OPCIONAL adrede: es la única forma soportada de
 * llegar al constructor en esta app. La API existe en Chrome (Android y
 * desktop) pero no en Firefox ni en Safari, y el feature-detect
 * (`'BarcodeDetector' in window`) es parte del contrato de FE-05.
 */

/** Formatos de la especificación. La demo solo pide `code_128` (PRD 8.7). */
type BarcodeDetectorFormat =
	| 'aztec'
	| 'code_128'
	| 'code_39'
	| 'code_93'
	| 'codabar'
	| 'data_matrix'
	| 'ean_13'
	| 'ean_8'
	| 'itf'
	| 'pdf417'
	| 'qr_code'
	| 'upc_a'
	| 'upc_e'
	| 'unknown';

interface BarcodeDetectorOptions {
	formats?: BarcodeDetectorFormat[];
}

/** Un código leído en un frame. `rawValue` es lo único que usa la app. */
interface DetectedBarcode {
	readonly boundingBox: DOMRectReadOnly;
	readonly cornerPoints: ReadonlyArray<{ readonly x: number; readonly y: number }>;
	readonly format: string;
	readonly rawValue: string;
}

interface BarcodeDetector {
	/**
	 * Puede RECHAZAR en frames sueltos sin que la cámara esté rota: p. ej.
	 * `InvalidStateError` mientras el `<video>` todavía no decodificó un cuadro.
	 * Quien la llame tiene que tolerarlo y seguir con el frame siguiente.
	 */
	detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
	new (options?: BarcodeDetectorOptions): BarcodeDetector;
	getSupportedFormats(): Promise<string[]>;
}

interface Window {
	readonly BarcodeDetector?: BarcodeDetectorConstructor;
}
