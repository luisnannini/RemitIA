/**
 * ⚠️ FIXTURES DE DESARROLLO — NUNCA DEBEN ENTRAR AL BUNDLE DE PRODUCCIÓN.
 *
 * Este módulo solo se importa desde `mock/mock-client.ts`, que a su vez solo se
 * carga con `import()` dinámico dentro de un `if (import.meta.env.DEV)`. En
 * `vite build` esa rama es dead code y Rollup no emite el chunk.
 *
 * Escenario A del PRD 11.3 — demo principal:
 *   línea 1  → match directo (flujo a)
 *   línea 2  → ambigua con dos candidatos (flujo b)
 *   línea 3  → sin candidato (flujo c: asignar / alta / unresolved)
 *   línea 4  → match directo que terminará con FALTANTE al contar
 *
 * Escenario C del PRD 11.3 — foto deficiente: ver `MOCK_SCENARIO_C_TRIGGERS`.
 */

import type { Catalog, HealthView, ReceptionDocument, ReceptionLine, ReceptionSummary } from '../types';

/**
 * Marcador único para verificar por grep que el mock no llegó al build.
 * Ver README de `apps/web`: `grep -r REMITIA_MOCK_FIXTURE build/` debe dar vacío.
 */
export const MOCK_FIXTURE_MARKER = 'REMITIA_MOCK_FIXTURE_ONLY_DEV';

/** Segundo marcador, para el escenario C. También debe estar ausente del build. */
export const MOCK_SCENARIO_C_MARKER = 'REMITIA_MOCK_SCENARIO_C';

/**
 * Disparadores del escenario C (PRD 11.3, foto deficiente) POR NOMBRE DE ARCHIVO.
 *
 * Existen solo en el adapter fake: el contrato no cambia y el backend real no
 * mira el nombre del archivo para nada. Sirven para poder navegar en dev el
 * camino "foto deficiente → nueva foto" sin depender de QVAC.
 *
 *   - `borrosa` → el POST se acepta (202) y la extracción termina en `failed`.
 *                 Es el escenario C completo: ejercita el polling y su corte.
 *   - `mala`    → el POST se rechaza en el acto con `DOCUMENT_LOW_QUALITY` y
 *                 `user_action: take_another_photo`. Ejercita el ErrorPanel del Home.
 *
 * La comparación ignora mayúsculas y tildes: "Remito Borroso.jpg" también entra.
 */
export const MOCK_SCENARIO_C_TRIGGERS = {
	asyncFailure: 'borros',
	uploadReject: 'mala'
} as const;

function normalize(value: string): string {
	return value
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '');
}

export type MockScenarioC = 'async_failure' | 'upload_reject' | null;

/** Qué variante del escenario C pide este nombre de archivo, si es que pide alguna. */
export function mockScenarioCFor(filename: string): MockScenarioC {
	const name = normalize(filename);
	if (name.includes(MOCK_SCENARIO_C_TRIGGERS.uploadReject)) return 'upload_reject';
	if (name.includes(MOCK_SCENARIO_C_TRIGGERS.asyncFailure)) return 'async_failure';
	return null;
}

/** Documento tal como lo publica la vista canónica cuando la extracción falló. */
export const MOCK_LOW_QUALITY_DOCUMENT: Omit<ReceptionDocument, 'filename' | 'preview_url'> = {
	provider_name: null,
	remit_number: null,
	ocr_quality: 0.21,
	warnings: [
		'La foto está movida: no se leen los renglones del cuerpo del remito.',
		'No pude identificar el número de remito ni el proveedor.'
	]
};

export const MOCK_CATALOG: Catalog = {
	catalog_id: 'demo-main',
	products: [
		{
			sku: 'PEI-BIL-MC-CR',
			barcode: '7790000000012',
			name: 'Monocomando mesada Bilbao cromado',
			unit: 'unidad',
			aliases: ['Monoc. mesada Bilbao CR', 'Bilbao cromada'],
			attributes: { family: 'Bilbao', finish: 'cromado' }
		},
		{
			sku: 'PEI-BIL-MC-NE',
			barcode: '7790000000029',
			name: 'Monocomando mesada Bilbao negro',
			unit: 'unidad',
			aliases: ['Monoc. mesada Bilbao NE', 'Bilbao negra'],
			attributes: { family: 'Bilbao', finish: 'negro' }
		},
		{
			sku: 'PEI-FLX-40-MA',
			barcode: '7790000000036',
			name: 'Flexible malla acero 1/2 x 40 cm',
			unit: 'unidad',
			aliases: ['Flex malla 1/2 40', 'flexible 40cm'],
			attributes: { family: 'Flexibles', length_cm: 40 }
		},
		{
			sku: 'PEI-SIF-BOT-CR',
			barcode: '7790000000043',
			name: 'Sifón botella cromado 1 1/4',
			unit: 'unidad',
			aliases: ['Sifon botella CR', 'sifón cromado'],
			attributes: { family: 'Desagües', finish: 'cromado' }
		},
		{
			sku: 'PEI-REJ-PIL-10',
			barcode: '7790000000050',
			name: 'Rejilla pileta 10 x 10 acero',
			unit: 'unidad',
			aliases: ['rejilla 10x10'],
			attributes: { family: 'Desagües', size: '10x10' }
		},
		{
			sku: 'PEI-CIN-TEF-12',
			barcode: '7790000000067',
			name: 'Cinta teflón 12 mm x 10 m',
			unit: 'unidad',
			aliases: ['teflon 12mm'],
			attributes: { family: 'Insumos' }
		},
		{
			// Producto que no aparece en ningún remito de prueba (PRD 15.1):
			// existe para ejercitar el buscador del flujo (c).
			sku: 'PEI-VAL-ESF-34',
			barcode: '7790000000074',
			name: 'Válvula esférica bronce 3/4',
			unit: 'unidad',
			aliases: ['valvula esferica 3/4'],
			attributes: { family: 'Válvulas' }
		}
	]
};

export const MOCK_HEALTH_READY: HealthView = {
	status: 'ready',
	api: 'ready',
	database: 'ready',
	qvac: {
		status: 'ready',
		local: true,
		models: [
			{ capability: 'ocr', name: 'OCR_LATIN', loaded: true },
			{ capability: 'text', name: 'qvac-text-dev-fixture', loaded: true }
		]
	}
};

export const MOCK_DOCUMENT = {
	filename: 'remito-demo.jpg',
	provider_name: 'Distribuidora Norte',
	remit_number: 'R-1842',
	ocr_quality: 0.78,
	warnings: [] as string[]
};

/** Estado inicial de las líneas al salir de `processing_document`. */
export function mockInitialLines(): ReceptionLine[] {
	return [
		{
			line_id: 'line_1',
			source_text: 'Flex malla 1/2 40 cm x 6',
			evidence: { block_ids: ['ocr_11'], confidence: 0.93 },
			expected_quantity: 6,
			unit: 'unidad',
			match: {
				status: 'matched',
				selected_sku: 'PEI-FLX-40-MA',
				score: 0.94,
				candidates: [{ sku: 'PEI-FLX-40-MA', name: 'Flexible malla acero 1/2 x 40 cm' }],
				question: null,
				reason: 'Nombre y medida coinciden con un único producto del catálogo.'
			},
			counted_quantity: 0,
			discrepancy: null
		},
		{
			line_id: 'line_2',
			source_text: 'Monoc. mesada Bilbao C? x 12',
			evidence: { block_ids: ['ocr_17'], confidence: 0.74 },
			expected_quantity: 12,
			unit: 'unidad',
			match: {
				status: 'ambiguous',
				selected_sku: null,
				score: 0.74,
				candidates: [
					{
						sku: 'PEI-BIL-MC-CR',
						name: 'Monocomando mesada Bilbao cromado',
						attributes: { finish: 'cromado' }
					},
					{
						sku: 'PEI-BIL-MC-NE',
						name: 'Monocomando mesada Bilbao negro',
						attributes: { finish: 'negro' }
					}
				],
				question: {
					question_id: 'q_1',
					text: '¿Dice cromado o negro?',
					answer_mode: 'choice'
				},
				reason: 'La terminación no se lee con confianza suficiente.'
			},
			counted_quantity: 0,
			discrepancy: null
		},
		{
			line_id: 'line_3',
			source_text: 'Codo PVC 110 reforzado s/marca x 3',
			evidence: { block_ids: ['ocr_23'], confidence: 0.61 },
			expected_quantity: 3,
			unit: 'unidad',
			match: {
				status: 'unmatched',
				selected_sku: null,
				score: 0.31,
				candidates: [],
				question: null,
				reason: 'Ningún producto del catálogo se parece lo suficiente.'
			},
			counted_quantity: 0,
			discrepancy: null
		},
		{
			line_id: 'line_4',
			source_text: 'Sifon botella cromado 1 1/4 x 10',
			evidence: { block_ids: ['ocr_29'], confidence: 0.88 },
			expected_quantity: 10,
			unit: 'unidad',
			match: {
				status: 'matched',
				selected_sku: 'PEI-SIF-BOT-CR',
				score: 0.91,
				candidates: [{ sku: 'PEI-SIF-BOT-CR', name: 'Sifón botella cromado 1 1/4' }],
				question: null,
				reason: 'Coincidencia directa con el catálogo.'
			},
			counted_quantity: 0,
			discrepancy: null
		}
	];
}

export const MOCK_EMPTY_SUMMARY: ReceptionSummary = {
	expected_lines: 0,
	resolved_lines: 0,
	units_expected: 0,
	units_counted: 0,
	missing_units: 0,
	unexpected_units: 0
};

/** Prosa de reclamo de ejemplo. El backend real la pide a QVAC (PRD 9.4). */
export const MOCK_CLAIM_PROSE = {
	opening:
		'Solicitamos revisar la entrega correspondiente al remito R-1842 recibida en nuestro depósito.',
	closing: 'Agradecemos confirmar la reposición o emitir la nota de crédito correspondiente.'
};
