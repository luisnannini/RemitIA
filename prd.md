# PRD y contrato de arquitectura — RemitIA

**Hackathon Aleph · Track QVAC by Tether · 22–23 de agosto de 2026**
**Versión:** 1.4 — MVP mínimo para video de 3 minutos
**Estado:** listo para ejecución por Luis, Rachid y Nahuel
**Nombre canónico:** RemitIA
**Lema:** *La experiencia está diseñada para la demo. La inteligencia es real.*

> Este archivo es la única fuente de verdad compartida para la demo. Cada integrante debe entregárselo completo a su agente, indicarle su nombre y pedirle que trabaje solamente sobre las historias que le pertenecen. El agente genera sus propias subtareas, pero no puede cambiar contratos, alcance P0 ni responsabilidades sin aprobación de los tres integrantes.

**Cambios v1.4 (recorte a MVP):**

- La demo se define por los **tres flujos de mapeo** de la sección 2; todo lo que no aparece ahí no existe.
- Respuesta libre de texto movida a P1: la desambiguación P0 es por **botones** (selección de candidato).
- Nueva acción para líneas sin match: **asignar un SKU del catálogo o dar de alta un SKU nuevo** (flujo c).
- **Embeddings eliminados.** El shortlist y los scores salen de matching lexical en código (`rapidfuzz` o `difflib`). Esto elimina un modelo, un endpoint interno inexistente y un conflicto de ownership de v1.3.
- La verificación de tres respuestas se reemplaza por `POST /finalize` con body vacío; el modal "¿Ya contaste todo?" es solo UI.
- Máquina de estados simplificada: la extracción exitosa siempre pasa por `needs_document_review`.
- Endpoint nuevo `GET /api/v1/catalog` para el buscador de asignación manual.
- Desarrollo mismo-origen vía **proxy de Vite** (`/api` → `localhost:8000`); CORS no existe en ningún modo.
- Limpieza de restos de voz (`audio` en runtime, menciones sueltas).

> **Regla code-freeze (hackathon):** antes del sábado 12:00 del mediodía solo se permite este PRD, la preparación de datos sanitizados (catálogo, fotos de remitos) y la descarga de modelos/dependencias. Todo artefacto de código se escribe **después** del inicio oficial. `qvac doctor` y la descarga de modelos se hacen el viernes.

---

## 0. Prompt operativo para los tres agentes

Copiar este bloque al iniciar cada agente, seguido de este archivo completo:

```text
Estamos construyendo RemitIA para la hackathon Aleph, track QVAC by Tether.
Lee el PRD completo antes de proponer o modificar código.

Mi nombre es <LUIS | RACHID | NAHUEL>. Soy responsable únicamente de las historias
asignadas a mi nombre y de los directorios que me pertenecen según el mapa de ownership.

Tu primera respuesta debe:
1. resumir mi misión en cinco líneas como máximo;
2. listar dependencias que necesito de los otros dos responsables;
3. convertir MIS historias P0 en subtareas ordenadas y verificables;
4. identificar cualquier contradicción real con el contrato antes de escribir código;
5. comenzar por el primer vertical slice integrable, no por infraestructura secundaria.

Reglas obligatorias:
- No cambies endpoints, schemas, nombres de estados o ownership por cuenta propia.
- No implementes lógica que pertenece a otra persona.
- Puedes usar mocks solo detrás de las interfaces pactadas y solo durante desarrollo.
- El modo de demo final debe usar QVAC real; nunca respuestas de IA hardcodeadas.
- El modelo interpreta lenguaje. El backend calcula cantidades y decide estados.
- Todo debe funcionar sin internet una vez descargados los modelos y dependencias.
- No agregues una feature sin eliminar otra de esfuerzo equivalente.
- Si algo no está en la sección 2 y no desbloquea la demo, no lo construyas.
- No hay voz ni PDF: toda interacción es manual (botones, lector, teclado).
- Antes de cerrar una historia, ejecuta sus criterios de aceptación y deja evidencia.
```

---

## 1. Resumen del producto

### 1.1 La frase que deben recordar los jueces

**RemitIA convierte cualquier remito en una recepción guiada: entiende lo que debía llegar, verifica lo que llegó y deja el reclamo redactado antes de que el proveedor se vaya. Todo corre localmente; ningún documento sale del depósito.**

### 1.2 Usuario y momento

El usuario principal es un empleado novato que recibe mercadería mientras el camión y el chofer esperan. Tiene pocos minutos para interpretar un remito abreviado o mal impreso, relacionarlo con el catálogo interno, contar lo recibido y dejar asentado cualquier faltante. Si el error se descubre días después, suele ser irreclamable.

La transformación que muestra la demo: **una persona sin conocimiento histórico del proveedor recibe con el criterio de un veterano**.

### 1.3 Problema

- El proveedor describe productos con abreviaturas, errores, variantes o escritura manual.
- El catálogo interno usa SKU y nombres distintos.
- El remito normalmente no incluye el SKU interno.
- La traducción entre ambos lenguajes depende de una persona experimentada.
- Los faltantes se detectan tarde y generan pérdida económica.
- Los documentos contienen datos comerciales que no deberían enviarse a un proveedor cloud.

### 1.4 Solución

**LEER → RELACIONAR → PREGUNTAR → CONTAR → DETECTAR → RECLAMAR**

QVAC hace las tareas de lenguaje: OCR, normalización de líneas, elección entre candidatos, formulación de la pregunta y prosa del reclamo.

El backend hace las tareas determinísticas: validación, persistencia, shortlist y scores lexicales, conteo, diferencias, umbrales y transiciones de estado.

**Reglas centrales de confiabilidad:**

1. El modelo nunca decide aritmética. Toda diferencia se calcula en código.
2. El modelo nunca inventa un SKU: toda salida del LLM se valida contra los candidatos recibidos. Solo una persona puede dar de alta un SKU nuevo, mediante una acción explícita de UI que queda en el log.
3. El LLM devuelve veredictos categóricos (`matched` | `ambiguous` | `unmatched`), SKU elegido, razón y pregunta. Los números (score y margen) los produce el matching lexical en código. El LLM nunca emite un decimal de confianza.

---

## 2. Definición exacta de la demo (ni más ni menos)

La entrega es un **video de hasta 3 minutos** grabado sobre el sistema real, reproducible y reiniciable. Está permitido cortar esperas muertas en edición; nunca se falsifica una capacidad. El README publica las latencias reales.

La demo cumple exactamente estos flujos:

1. **OCR:** se carga una foto nueva (JPG/PNG) de un remito. QVAC hace OCR real y el LLM estructura líneas: descripción + cantidad entera.
2. **Mapeo remito → catálogo, con tres flujos:**
   - **(a) Match directo:** la línea se relaciona sola con un SKU del catálogo y aparece resuelta en el resumen.
   - **(b) Ambigua:** RemitIA muestra una pregunta con los candidatos más cercanos como opciones. Ejemplo: el OCR leyó "manzanas" y el catálogo tiene `MANZANA-ROJA` y `MANZANA-VERDE`. La persona toca una opción.
   - **(c) Sin candidato:** la persona asigna un SKU con un buscador del catálogo, o da de alta un SKU nuevo.
3. **Conteo:** escaneos con lector USB keyboard-wedge; el backend suma y calcula diferencias en código.
4. **Cierre:** resumen esperado vs contado. Si hay diferencias, QVAC redacta el reclamo grounded. Se cierra la recepción y se resetea.

### 2.1 Métrica norte

**Una persona debe poder entender la discrepancia y la acción recomendada en cinco segundos, con evidencia suficiente para verificarla sin confiar ciegamente en el modelo.**

### 2.2 Éxito mínimo P0

P0 está terminado cuando, desde un clon limpio y con los modelos ya disponibles localmente:

- se inicia la solución con un comando documentado;
- se carga una foto JPG o PNG no hardcodeada;
- QVAC realiza OCR y estructuración reales;
- al menos una línea se relaciona sola con un SKU real (flujo a);
- una ambigüedad se resuelve tocando un candidato (flujo b);
- una línea sin candidato se resuelve con asignación manual o alta de SKU (flujo c);
- se registran conteos y el backend calcula la diferencia;
- QVAC produce el texto de un reclamo grounded cuando hay diferencias;
- el flujo se puede resetear y repetir;
- funciona con la red externa desconectada después de descargar los modelos.

### 2.3 Prioridad P1

Solo después de P0 estable:

- respuesta libre de texto para la pregunta desambigüadora (`answer_text` + endpoint interno de resolución);
- hipótesis para un ítem inesperado como posible sustituto;
- embeddings de QVAC para el shortlist, si el matching lexical falla con datos reales.

La voz (ASR/TTS), el PDF, el RAG y el multimodal no son P1: están fuera del alcance de esta entrega.

### 2.4 Fuera de alcance

- ERP real, proveedores reales o envío real de correos;
- autenticación, usuarios, permisos, multiempresa;
- cloud en cualquier forma (sync, telemetría, API de IA);
- contabilidad, stock real, pagos;
- remitos multipágina, letra manuscrita garantizada, cantidades fraccionarias;
- aplicación móvil nativa o modelo en el teléfono;
- voz (ASR, TTS), PDF, RAG, multimodal, fine-tuning;
- autonomía abierta del agente: el flujo está acotado por la máquina de estados.

---

## 3. Decisiones de arquitectura congeladas

### ADR-001 — Tres componentes locales con responsabilidades estrictas

1. **Web SvelteKit + TypeScript** — interfaz, propiedad de Luis.
2. **API FastAPI** — estado, persistencia, reglas y orquestación, propiedad de Rachid.
3. **Servicio QVAC Python/FastAPI** — inferencia local con `tetherto-qvac-sdk`, propiedad de Nahuel.

En desarrollo corren tres procesos. Para la demo, SvelteKit se compila estático y FastAPI sirve esos archivos: quedan dos procesos Python. Ambos servicios FastAPI conservan procesos, entornos y puertos separados. Todo corre en la misma notebook. El celular, si se usa, es un cliente web por LAN.

### ADR-002 — QVAC directo para documentos

El servicio de IA usa `tetherto-qvac-sdk` mediante su cliente asyncio y mantiene `Client`, worker y modelos cargados entre requests. No se envían imágenes al endpoint OpenAI-compatible (el chat de ese servidor es text-only). Para P0: **OCR QVAC + LLM de texto QVAC**. VisionPsy no forma parte de esta entrega.

### ADR-003 — Un único backend público, mismo origen siempre

El navegador solo conoce FastAPI. Nunca llama al servicio QVAC ni a SQLite. La web consume la API **exclusivamente con rutas relativas** (`/api/v1/...`).

- Demo: FastAPI sirve el build estático; el teléfono accede a `http://<IP-LAN>:8000`. Mismo origen, sin CORS.
- Desarrollo: la web corre en `http://localhost:5173` con **proxy de Vite** (`/api` → `http://localhost:8000`) en `vite.config.ts`. Mismo origen aparente, sin CORS.
- QVAC interno: `http://127.0.0.1:8787`, ligado a loopback, nunca expuesto a la LAN.

### ADR-004 — Polling, no WebSocket

El procesamiento de documento es asíncrono: la API responde `202` y la web consulta cada 750 ms. Sin WebSockets ni SSE.

### ADR-005 — SQLite y filesystem local

FastAPI guarda todo en SQLite y los documentos en `runtime/` fuera de Git. La base se resetea con un endpoint exclusivo de demo.

### ADR-006 — Contrato antes que implementación

El contrato vive en **modelos Pydantic compartidos** (OpenAPI autogenerado por FastAPI; nadie escribe YAML) y **JSON de ejemplo canónicos** en `contracts/examples/`. Un mock es aceptable en desarrollo si implementa el mismo schema; el modo estricto rechaza el arranque con proveedor fake.

### ADR-007 — Cantidades enteras

El happy path admite enteros positivos. Una cantidad fraccionaria, negativa, ausente o dudosa se marca para revisión; nunca se corrige silenciosamente.

### ADR-008 — Sin contenedores en el camino crítico

Docker no es requisito. Scripts nativos y procesos visibles.

### ADR-009 — Stack exacto del frontend

Greenfield. **SvelteKit + TypeScript + Vite + Tailwind CSS**, `adapter-static`, `fetch` con rutas relativas y polling. Sin Redux, WebSockets, SSR, PWA ni librería global de estado. Captura con `<input type="file" accept="image/*" capture="environment">`. Sin micrófono ni audio.

### ADR-010 — Shortlist y scores lexicales en código

El shortlist (máximo 5 candidatos por línea) y sus scores los calcula FastAPI con matching lexical (`rapidfuzz`; fallback `difflib` de la stdlib) sobre nombre + aliases del catálogo, normalizado a [0, 1]. **No se usa modelo de embeddings en P0**: agregaba un modelo más en RAM, un endpoint interno inexistente y un conflicto de ownership (Rachid no llama al SDK). El LLM recibe los candidatos sin scores y devuelve veredicto categórico. Los umbrales sobre score y margen los aplica la API. Embeddings quedan como P1 si el lexical falla con datos reales.

---

## 4. Vista macro

```text
┌───────────────────────────────────────────────────────────────────┐
│ Celular o navegador del depósito                                  │
│ SvelteKit: foto, revisión, escaneo, resumen, reclamo               │
└───────────────────────────┬───────────────────────────────────────┘
                            │ HTTP /api/v1/* por LAN o localhost
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│ FastAPI — única fuente de verdad                                  │
│ - máquina de estados y log de eventos                              │
│ - catálogo, shortlist y scores lexicales                           │
│ - conteos, diferencias y umbrales                                  │
│ - SQLite y uploads                                                 │
└───────────────┬──────────────────────────────┬────────────────────┘
                │ loopback /internal/v1/*      │ filesystem local
                ▼                              ▼
┌───────────────────────────────┐  ┌───────────────────────────────┐
│ Servicio QVAC Python/FastAPI  │  │ SQLite + uploads + fixtures  │
│ - OCR local                   │  │ sanitizados                  │
│ - extracción estructurada     │  └───────────────────────────────┘
│ - veredicto de matching       │
│ - pregunta desambigüadora     │
│ - prosa del reclamo           │
└───────────────────────────────┘
```

**Límite de datos:** ningún request de la aplicación se dirige a un host externo. Modelos y dependencias se descargan durante setup, no durante la recepción.

---

## 5. Estructura del repositorio y ownership

```text
/
├─ PRD.md                         # contrato congelado; cambios con aprobación de 3
├─ README.md                      # Rachid integra; cada dueño aporta su sección
├─ .env.example                   # Rachid
├─ scripts/                       # Rachid: arranque, parada, reset y smoke E2E
├─ contracts/
│  ├─ examples/                   # JSON canónicos de cada request/response
│  └─ README.md                   # puntero a los modelos Pydantic (fuente real)
├─ apps/
│  ├─ web/                        # LUIS solamente
│  └─ api/                        # RACHID solamente
├─ services/
│  └─ qvac/                       # NAHUEL solamente
├─ demo-data/                     # Rachid: catálogo y documentos sanitizados
├─ evidence/                      # benchmark slim, sin secretos
└─ runtime/                       # gitignored: DB, uploads y artefactos temporales
```

### 5.1 Regla de ownership

- Luis no modifica `apps/api`, `services/qvac` ni contratos sin acordar el cambio.
- Rachid no implementa prompts ni llamadas al SDK QVAC.
- Nahuel no implementa reglas de conteo, estado de negocio ni componentes de UI.
- Rachid integra archivos raíz y resuelve la ejecución end-to-end.
- Un cambio de contrato requiere nota corta (problema, cambio, impacto) y confirmación de los otros dos.
- Nadie hace refactors transversales durante el último tercio del evento.

### 5.2 Variables de entorno contractuales

```dotenv
# web
# (sin variables: rutas relativas mismo-origen; proxy de Vite en dev)

# api
QVAC_BASE_URL=http://127.0.0.1:8787
REMITIA_DB_PATH=./runtime/remitia.db
REMITIA_UPLOAD_DIR=./runtime/uploads
REMITIA_DEMO_MODE=true
REMITIA_STRICT_LOCAL_AI=true

# qvac
QVAC_HOST=127.0.0.1
QVAC_PORT=8787
QVAC_CACHE_DIR=./runtime/qvac-models
QVAC_WORKER_PATH=
QVAC_TEXT_MODEL=<modelo-validado-y-fijado>
QVAC_OCR_MODEL=OCR_LATIN
```

`REMITIA_STRICT_LOCAL_AI=true` impide mocks y debe estar activo al grabar la demo. `QVAC_WORKER_PATH` queda vacío si `Client()` encuentra el worker solo.

### 5.3 Gate de máquina antes de programar (viernes)

- Python `>= 3.10`; fijar 3.11 para los dos servicios FastAPI.
- Instalar `tetherto-qvac-sdk` y ejecutar `python -m tetherto.qvac_sdk install-worker`.
- El worker requiere Node.js `>= 22.17`. Fijar la versión de Node para el worker y para compilar SvelteKit.
- Ejecutar y guardar la salida de `qvac doctor` en la máquina de demo.
- El servicio QVAC corre como **proceso único, sin `--reload`**: el reload duplica el proceso y los modelos en RAM.
- En Windows 10+ x64, QVAC exige Vulkan `>= 1.4` incluso para CPU. Comprobarlo antes de repartir implementación.
- Reservar 5 GB de disco y medir RAM con los modelos elegidos.
- Descargar modelos y dependencias el viernes: el Wi-Fi del venue es el cuello de botella.

---

## 6. Fuente de verdad y responsabilidades

| Decisión o dato | Responsable | Regla |
|---|---|---|
| Píxeles, navegación y experiencia | Luis / Web | Renderiza estado; no inventa estado de negocio |
| Sesión, estado y log de eventos | Rachid / API | Única fuente de verdad |
| Conteos y diferencias | Rachid / API | Siempre en código, nunca en un prompt |
| Catálogo, validez y alta de SKU | Rachid / API | El modelo nunca crea un SKU; la persona sí, con acción explícita |
| Shortlist, scores y margen | Rachid / API | Matching lexical en código; nunca un decimal dicho por el LLM |
| Umbrales y estado final del match | Rachid / API | La API puede degradar el veredicto del LLM, nunca mejorarlo |
| OCR y evidencia por bloque | Nahuel / QVAC | Texto, bbox y confianza si el SDK los entrega |
| Interpretación de descripción | Nahuel / QVAC | Elige solo entre candidatos recibidos; veredicto categórico |
| Pregunta desambigüadora | Nahuel / QVAC | Separa atributos reales de los candidatos |
| Prosa del reclamo | Nahuel / QVAC | Grounded en snapshot inmutable |
| Salud y metadatos de modelos | Nahuel / QVAC | Sin afirmar capacidades no cargadas |
| Reset de demo y arranque completo | Rachid / raíz | Deja un estado inicial conocido |

---

## 7. Máquina de estados

Estados canónicos; no crear sinónimos:

```text
draft
  └─ documento cargado → processing_document
       ├─ fallo técnico → failed
       └─ extracción válida → needs_document_review
            └─ sin líneas bloqueantes → receiving        (automático al resolver la última)
                 └─ POST /finalize (congela snapshot)
                      ├─ con discrepancias → ready_to_claim
                      │    └─ reclamo generado + POST /close → closed
                      └─ sin discrepancias → closed (conforme, sin reclamo)
```

Reglas:

- Una línea **bloqueante** es `ambiguous` o `unmatched` sin acción humana. Se desbloquea al responder (flujo b), asignar o crear SKU (flujo c), o marcarse `unresolved`.
- Una línea `unresolved` no participa del conteo ni del snapshot.
- El modal "¿Ya contaste todo?" es UI: cancelar no llama a la API.
- No existe el estado `verifying`.

### 7.1 Log de eventos (append-only, sin framework)

Tabla simple: `id`, `reception_id`, `type`, `created_at`, `actor` (`human` | `backend` | `qvac`), payload pequeño. Es un `INSERT` por acción y un `SELECT` para la pantalla final. Tipos: `document_uploaded`, `extraction_validated`, `clarification_answered`, `line_assigned`, `product_created`, `item_scanned`, `unexpected_item_scanned`, `reception_finalized`, `claim_generated`, `reception_closed`, `processing_failed`.

Los eventos nunca contienen el binario del documento.

---

## 8. Contrato público: Web ↔ FastAPI

Prefijo `/api/v1`. JSON en `snake_case`. Fechas ISO 8601 UTC. Errores con el envelope de la sección 8.11.

### 8.1 Salud

`GET /api/v1/health`

```json
{
  "status": "ready",
  "api": "ready",
  "database": "ready",
  "qvac": {
    "status": "ready",
    "local": true,
    "models": [
      { "capability": "ocr", "name": "OCR_LATIN", "loaded": true },
      { "capability": "text", "name": "<pinned-model>", "loaded": true }
    ]
  }
}
```

`status`: `starting` | `ready` | `degraded`. La web no habilita "Iniciar recepción" hasta `ready` (banner en el home, no pantalla aparte).

### 8.2 Catálogo

`GET /api/v1/catalog`

Devuelve el catálogo completo (`catalog_id`, `products[]` con `sku`, `barcode`, `name`, `unit`, `attributes`). Son menos de 30 productos: la web lo carga una vez y filtra client-side para el buscador de asignación (flujo c) y para imprimir la hoja de barcodes.

### 8.3 Crear recepción

`POST /api/v1/receptions` — `multipart/form-data`:

- `document`: JPG o PNG, obligatorio, máximo 12 MB.

Sin `provider_id`, `catalog_id` ni `locale`: el backend usa `demo-main` y `es-AR` fijos. HEIC no convertible se rechaza con `INVALID_FILE`. Sin `Idempotency-Key`: la web deshabilita el botón tras el primer toque.

Respuesta `202`:

```json
{
  "reception_id": "rec_01J...",
  "status": "processing_document",
  "poll_url": "/api/v1/receptions/rec_01J..."
}
```

### 8.4 Consultar recepción

`GET /api/v1/receptions/{reception_id}` — la vista canónica que consume la web:

```json
{
  "id": "rec_01J...",
  "status": "needs_document_review",
  "created_at": "2026-08-22T15:00:00Z",
  "document": {
    "filename": "remito.jpg",
    "preview_url": "/api/v1/receptions/rec_01J.../document",
    "provider_name": "Distribuidora Norte",
    "remit_number": "R-1842",
    "ocr_quality": 0.78,
    "warnings": []
  },
  "lines": [
    {
      "line_id": "line_1",
      "source_text": "Monoc. mesada Bilbao C? x 12",
      "evidence": { "block_ids": ["ocr_17"], "confidence": 0.74 },
      "expected_quantity": 12,
      "unit": "unidad",
      "match": {
        "status": "ambiguous",
        "selected_sku": null,
        "score": 0.74,
        "candidates": [
          { "sku": "PEI-BIL-MC-CR", "name": "Monocomando mesada Bilbao cromado" },
          { "sku": "PEI-BIL-MC-NE", "name": "Monocomando mesada Bilbao negro" }
        ],
        "question": {
          "question_id": "q_1",
          "text": "¿Dice cromado o negro?",
          "answer_mode": "choice"
        },
        "reason": "La terminación no se lee con confianza suficiente."
      },
      "counted_quantity": 0,
      "discrepancy": null
    }
  ],
  "unexpected_items": [],
  "summary": {
    "expected_lines": 1,
    "resolved_lines": 0,
    "units_expected": 12,
    "units_counted": 0,
    "missing_units": 0,
    "unexpected_units": 0
  },
  "claim": null,
  "latest_trace_id": "trace_01J..."
}
```

`match.status`: `matched` | `ambiguous` | `unmatched` | `unresolved`. `discrepancy.type`: `ok` | `missing` | `over`.

`score` y `evidence.confidence` provienen del matching lexical y del OCR; ningún número fue declarado por el LLM.

### 8.5 Responder una ambigüedad (flujo b)

`POST /api/v1/receptions/{reception_id}/answers`

```json
{ "question_id": "q_1", "selected_sku": "PEI-BIL-MC-CR" }
```

Solo selección de candidato. La API valida que el SKU esté entre los candidatos de esa pregunta. `answer_text` no existe en P0 (P1). Respuesta `200`: `ReceptionView`.

### 8.6 Asignar o crear SKU (flujo c)

`POST /api/v1/receptions/{reception_id}/lines/{line_id}/assign`

Body con **exactamente una** de estas formas:

```json
{ "sku": "PEI-BIL-MC-CR" }
```

```json
{ "new_product": { "sku": "MANZ-DELICIA", "name": "Manzana Delicia x kg" } }
```

```json
{ "mark_unresolved": true }
```

- `sku`: asigna un producto existente del catálogo (cualquiera, no solo candidatos).
- `new_product`: crea el producto (marcado `created_during_reception: true`, sin barcode: se escanea por SKU) y lo asigna. La API valida unicidad del SKU. Queda evento `product_created`.
- `mark_unresolved`: descarta la línea del conteo.

Respuesta `200`: `ReceptionView`.

### 8.7 Registrar un escaneo

`POST /api/v1/receptions/{reception_id}/scans`

```json
{
  "client_event_id": "scan_01J...",
  "barcode_or_sku": "7790000000012",
  "quantity": 1
}
```

`client_event_id` vuelve el escaneo idempotente. `quantity` es entero positivo. El backend resuelve barcode → SKU, incrementa y recalcula diferencias. Un SKU que no está en el remito va a `unexpected_items`.

Entrada física: **lector USB keyboard-wedge (el de Accesaniga)** sobre un input de texto; teclado manual como fallback. Se imprime una hoja con los barcodes del catálogo de demo.

Respuesta `200`: `ReceptionView`.

### 8.8 Finalizar conteo

`POST /api/v1/receptions/{reception_id}/finalize`

Body vacío. Solo válido en `receiving`. Congela el snapshot de discrepancias en el servidor y transiciona:

- con discrepancias → `ready_to_claim`;
- sin discrepancias → `closed` (constancia de recepción conforme, sin reclamo).

Respuesta `200`: `ReceptionView`.

### 8.9 Generar reclamo y cerrar

`POST /api/v1/receptions/{reception_id}/claim` — body vacío, solo en `ready_to_claim`:

```json
{
  "claim_id": "claim_01J...",
  "status": "draft",
  "subject": "Reclamo por faltante — Remito R-1842",
  "body": "Solicitamos revisar la entrega correspondiente al remito R-1842...",
  "facts": [
    {
      "sku": "PEI-BIL-MC-CR",
      "description": "Monocomando mesada Bilbao cromado",
      "expected_quantity": 12,
      "counted_quantity": 10,
      "missing_quantity": 2
    }
  ],
  "grounding_status": "validated",
  "generated_by": "qvac_local",
  "trace_id": "trace_01J..."
}
```

`POST /api/v1/receptions/{reception_id}/close` cierra desde `ready_to_claim` con reclamo generado. La UI dice "borrador listo", nunca "enviado".

Los endpoints con inferencia síncrona (`/claim`) pueden tardar decenas de segundos: spinner y timeouts de fetch ≥ 60 s. Riesgo aceptado; no se rediseña a asíncrono.

### 8.10 Documento original y reset

`GET /api/v1/receptions/{reception_id}/document` — binario de la foto (MIME verificado). Sirve solo desde runtime; nunca un path del cliente. Es el `preview_url`.

`POST /api/v1/demo/reset` — solo con `REMITIA_DEMO_MODE=true`. Borra sesiones y uploads de runtime; nunca toca `demo-data` ni modelos. También elimina los productos `created_during_reception`. Respuesta `204`.

### 8.11 Errores

```json
{
  "error": {
    "code": "DOCUMENT_LOW_QUALITY",
    "message": "No pude leer con seguridad las líneas 3 y 5.",
    "retryable": true,
    "user_action": "take_another_photo",
    "trace_id": "trace_01J...",
    "details": {}
  }
}
```

Códigos mínimos: `INVALID_FILE`, `DOCUMENT_LOW_QUALITY`, `QVAC_NOT_READY`, `QVAC_TIMEOUT`, `INVALID_MODEL_OUTPUT`, `INVALID_STATE_TRANSITION`, `UNKNOWN_BARCODE`, `QUESTION_ALREADY_RESOLVED`, `SKU_ALREADY_EXISTS`, `RECEPTION_NOT_FOUND`.

La web muestra `message` y una acción humana; nunca stack traces.

---

## 9. Contrato interno: FastAPI ↔ servicio QVAC

El servicio QVAC escucha solo en loopback. Todos los endpoints aceptan header `X-Trace-Id`; si no viene, generan uno. No persiste sesiones de negocio.

### 9.1 Salud y precarga

`GET /internal/v1/health`

```json
{
  "status": "ready",
  "sdk": "tetherto-qvac-sdk",
  "sdk_version": "<pinned>",
  "local": true,
  "models": [
    { "capability": "ocr", "configured_name": "OCR_LATIN", "loaded": true },
    { "capability": "text", "configured_name": "<pinned-model>", "quantization": "<measured>", "loaded": true }
  ]
}
```

Precarga modelos al iniciar y no anuncia `ready` hasta completar un smoke inference real.

### 9.2 Extraer remito

`POST /internal/v1/remits/extract` — `multipart/form-data` con `document` (JPG/PNG).

Respuesta `200`:

```json
{
  "document": {
    "provider_name": { "value": "Distribuidora Norte", "confidence": 0.91, "evidence_block_ids": ["ocr_2"] },
    "remit_number": { "value": "R-1842", "confidence": 0.95, "evidence_block_ids": ["ocr_4"] },
    "date": { "value": "2026-08-22", "confidence": 0.84, "evidence_block_ids": ["ocr_5"] }
  },
  "ocr": {
    "quality": 0.78,
    "blocks": [
      { "block_id": "ocr_17", "text": "Monoc. mesada Bilbao C? x 12", "confidence": 0.74, "bbox": [120, 330, 940, 382] }
    ]
  },
  "lines": [
    {
      "source_line_id": "source_1",
      "raw_text": "Monoc. mesada Bilbao C? x 12",
      "normalized_description": "Monocomando de mesada Bilbao, terminación incierta",
      "expected_quantity": 12,
      "unit": "unidad",
      "confidence": 0.74,
      "evidence_block_ids": ["ocr_17"],
      "warnings": ["finish_unclear"]
    }
  ],
  "needs_retake": false,
  "uncertainty_reasons": [],
  "model_trace": { "trace_id": "trace_01J...", "ocr_ms": 1850, "generation_ms": 6200, "validation_attempts": 1 }
}
```

Reglas:

- `expected_quantity` es entero positivo o `null`.
- Cada dato crítico apunta a evidencia OCR. Sin evidencia suficiente: `null` + warning; no se adivina.
- `needs_retake=true` cuando la calidad global es baja o líneas críticas no tienen texto/cantidad recuperable.

### 9.3 Veredicto de matching

`POST /internal/v1/catalog/match`

FastAPI produce el shortlist con matching lexical (ADR-010) y envía líneas + candidatos **sin scores** (el LLM no los necesita y anclan su salida):

```json
{
  "lines": [
    {
      "source_line_id": "source_1",
      "raw_text": "Monoc. mesada Bilbao C? x 12",
      "normalized_description": "Monocomando de mesada Bilbao, terminación incierta",
      "candidates": [
        { "sku": "PEI-BIL-MC-CR", "name": "Monocomando mesada Bilbao cromado", "attributes": { "finish": "cromado" } },
        { "sku": "PEI-BIL-MC-NE", "name": "Monocomando mesada Bilbao negro", "attributes": { "finish": "negro" } }
      ]
    }
  ]
}
```

Respuesta:

```json
{
  "matches": [
    {
      "source_line_id": "source_1",
      "status": "ambiguous",
      "selected_sku": null,
      "reason": "La familia coincide, pero la terminación no es legible.",
      "question": { "text": "¿Dice cromado o negro?", "expected_attributes": ["finish"] }
    }
  ],
  "model_trace": { "trace_id": "trace_01J...", "generation_ms": 4100, "validation_attempts": 1 }
}
```

Reglas:

- El servicio rechaza como inválido cualquier `selected_sku` fuera de los candidatos recibidos.
- `status` pertenece al enum `matched` | `ambiguous` | `unmatched`; otro valor es salida inválida.
- **El backend tiene la última palabra:** si el LLM dice `matched` pero el margen lexical está bajo el umbral, la API degrada a `ambiguous`. Nunca mejora un veredicto.

Umbrales iniciales sobre score/margen lexical (se recalibran el sábado con los remitos reales; cada ajuste queda registrado):

- `matched`: veredicto LLM `matched` **y** score ≥ 0.85 **y** margen ≥ 0.15.
- `ambiguous`: score entre 0.60 y 0.85, o margen < 0.15.
- `unmatched`: score < 0.60 o candidatos insuficientes.

### 9.4 Redactar reclamo grounded

`POST /internal/v1/claims/draft`

FastAPI envía un snapshot inmutable:

```json
{
  "provider_name": "Distribuidora Norte",
  "remit_number": "R-1842",
  "verified_by_human": true,
  "facts": [
    {
      "sku": "PEI-BIL-MC-CR",
      "description": "Monocomando mesada Bilbao cromado",
      "expected_quantity": 12,
      "counted_quantity": 10,
      "missing_quantity": 2
    }
  ],
  "unexpected_items": []
}
```

QVAC responde solo prosa:

```json
{
  "subject": "Reclamo por faltante — Remito R-1842",
  "opening": "Solicitamos revisar la entrega correspondiente al remito R-1842.",
  "closing": "Agradecemos confirmar la reposición o emitir la nota correspondiente.",
  "mentioned_skus": ["PEI-BIL-MC-CR"],
  "trace_id": "trace_01J..."
}
```

FastAPI compone el cuerpo final con una tabla determinística del snapshot. Valida que la prosa no introduzca SKU, cantidades ni números de remito ajenos. Si falla: un reintento; si vuelve a fallar: encabezado seguro y `grounding_status=safe_fallback`.

### 9.5 Endpoints P1 (no construir en P0)

- `POST /internal/v1/catalog/resolve` — interpretación de respuesta libre de texto.
- `POST /internal/v1/unexpected/hypothesis` — hipótesis de sustituto para ítem inesperado.

---

## 10. Pipeline de confiabilidad

### 10.1 Extracción

1. FastAPI valida tamaño y MIME real.
2. QVAC ejecuta OCR local y conserva bloques, bbox y confianza.
3. El LLM recibe el texto OCR y un schema cerrado para normalizar campos y líneas.
4. La salida se parsea y valida con schema runtime.
5. Se verifican cantidades enteras, evidencia existente y campos permitidos.
6. Si falla: un único reintento con los errores de validación.
7. Si vuelve a fallar: incertidumbre o nueva foto; nunca datos inventados.

### 10.2 Matching

1. FastAPI produce candidatos solo desde el catálogo local, rankeados por score lexical (score y margen reales).
2. QVAC distingue exclusivamente esos candidatos: veredicto categórico, SKU, razón y pregunta.
3. Un validador elimina cualquier SKU ajeno al request y cualquier status fuera del enum.
4. Los umbrales deciden el estado final; el backend degrada, nunca mejora.
5. Una ambigüedad genera una pregunta basada en atributos reales de los candidatos.
6. La acción humana (respuesta, asignación, alta) se persiste antes de resolver la línea.

### 10.3 Reconciliación

```text
delta = counted_quantity - expected_quantity

delta = 0  → ok
delta < 0  → missing, missing_quantity = abs(delta)
delta > 0  → over, over_quantity = delta
```

Vive y se prueba únicamente en FastAPI. Los prompts no calculan `delta`.

### 10.4 Reclamo

- Parte solo del snapshot congelado por `/finalize`.
- La tabla de hechos se genera en código.
- QVAC redacta asunto, apertura y cierre.
- El backend valida entidades y números; retry y luego fallback explícito.

### 10.5 Timeouts y retries

- OCR/extracción: timeout 60 s, un retry lógico máximo.
- Matching/reclamo: timeout 20 s, un retry por salida inválida.
- Escaneos idempotentes por `client_event_id`.
- Sin retry infinito ni llamadas paralelas al mismo modelo.
- Un timeout deja error recuperable y `trace_id` visible.

### 10.6 Observabilidad local

Cada inferencia registra `trace_id`, capability, modelo/versión/cuantización, duración e intentos, y el resultado del validador. Nunca el binario ni secretos en logs versionados. La UI muestra el sello **"Procesado localmente con QVAC · sin nube"**.

---

## 11. Experiencia de demo

### 11.1 Pantallas P0

1. **Home** — banner de ready check, cámara/upload, promesa de privacidad local.
2. **Procesando** — pasos honestos: leyendo, estructurando, relacionando.
3. **Revisión** — documento (vía 8.10) y líneas con los tres flujos: resueltas (a), pregunta con opciones (b), buscador + alta de SKU (c).
4. **Recepción guiada** — esperado vs contado en números grandes, input de lector/teclado, feedback inmediato; modal "¿Ya contaste todo?" que dispara `/finalize`.
5. **Resumen / reclamo** — diferencias, borrador del reclamo con tabla de hechos, sello QVAC local, "qué hizo QVAC / el código / la persona" y botón reset.

### 11.2 Guion de tres minutos

Los tiempos se fijan **después** de medir latencias reales. El video puede cortar esperas muertas en edición; nunca se falsifica una capacidad.

| Tiempo | Acción visible | Mensaje para el juez |
|---|---|---|
| 0:00–0:15 | Banner ready y modo offline | "Todo corre en esta notebook." |
| 0:15–0:35 | Foto de remito real | "El documento no sale del depósito." |
| 0:35–1:00 | OCR, líneas y evidencia | "QVAC lee y normaliza lenguaje del proveedor." |
| 1:00–1:20 | Flujo b: pregunta con opciones, un toque | "No oculta la duda: pregunta lo mínimo." |
| 1:20–1:40 | Flujo c: buscador o alta de SKU nuevo | "Lo que el modelo no sabe, la persona lo decide." |
| 1:40–2:05 | Escaneos con lector físico | "El modelo no hace cuentas; el código calcula." |
| 2:05–2:20 | Finalizar: esperaba 12, contó 10 | "La persona conserva la decisión." |
| 2:20–2:45 | Reclamo grounded | "El reclamo queda listo antes de que se vaya el camión." |
| 2:45–3:00 | Resumen, sello local y reset | "Real donde el juez inspecciona." |

### 11.3 Escenarios preparados

- **A — Demo principal:** una línea directa, una ambigua, una sin candidato y un faltante.
- **C — Foto deficiente:** QVAC devuelve líneas no confiables y pide nueva foto.

El escenario "conforme" (cierre sin reclamo) debe funcionar porque la máquina de estados lo permite, pero no se coreografía ni se ensaya. Los documentos pueden estar preparados; sus respuestas no. Un documento no visto debe atravesar el mismo pipeline para la prueba de honestidad.

---

## 12. Historias asignadas

### 12.1 Luis — Frontend

#### FE-01 · Shell de demo y cliente de contrato — P0

**Resultado:** web mobile-first que consume el contrato público y representa todos los estados canónicos.

**Aceptación:**

- capa cliente única con rutas relativas `/api/v1` y proxy de Vite en dev;
- maneja loading, retry y envelope de error común;
- sin aritmética de reconciliación ni transiciones de negocio;
- puede trabajar con respuestas ejemplo en desarrollo; el mock no puede activarse en build estricto.

**Depende de:** ejemplos de `ReceptionView` publicados por Rachid.

#### FE-02 · Captura y procesamiento — P0

**Resultado:** foto, preview, inicio de recepción y progreso comprensible.

**Aceptación:**

- input de cámara/archivo acepta JPG y PNG;
- deshabilita el botón tras el primer toque;
- polling cada 750 ms con corte en estado terminal/interactivo;
- ofrece nueva foto ante `DOCUMENT_LOW_QUALITY`.

**Depende de:** BE-02.

#### FE-03 · Revisión con los tres flujos — P0

**Resultado:** pantalla que muestra fuente, evidencia y los tres flujos de mapeo.

**Aceptación:**

- diferencia visualmente `matched`, `ambiguous`, `unmatched` y `unresolved`;
- flujo b: pregunta destacada con candidatos como botones; no permite un SKU fuera de candidatos;
- flujo c: buscador client-side sobre `GET /catalog`, alta de SKU nuevo con validación, y opción `unresolved`;
- muestra texto original y confianza sin sobrecargar;
- tras cada acción renderiza exclusivamente la vista devuelta por la API.

**Depende de:** BE-02, BE-04 y AI-03.

#### FE-04 · Conteo, resumen y reclamo — P0

**Resultado:** flujo de escaneo hasta cierre y reset.

**Aceptación:**

- input acepta lector keyboard-wedge y teclado; un `client_event_id` por escaneo;
- muestra esperado, contado y discrepancia recibidos del backend;
- modal de finalizar antes de congelar;
- muestra prosa y tabla de hechos del reclamo;
- cierre y reset vuelven al inicio.

**Depende de:** BE-03, BE-05 y AI-04.

### 12.2 Rachid — Backend y motor determinístico

#### BE-01 · API, persistencia y máquina de estados — P0

**Aceptación:**

- implementa exactamente los estados y el log de eventos de este PRD;
- persiste recepciones, líneas, preguntas, asignaciones, escaneos y reclamos;
- rechaza transiciones inválidas con error contractual;
- IDs y timestamps del lado servidor;
- publica modelos Pydantic y ejemplos canónicos antes de integrar UI.

**Depende de:** ninguna.

#### BE-02 · Ingesta y orquestación del documento — P0

**Aceptación:**

- valida MIME/tamaño; archivos solo en runtime local;
- `202` rápido y polling;
- llama extracción y matching con `trace_id` compartido;
- persiste evidencia e incertidumbre sin perder campos;
- diferencia foto ilegible, modelo no listo, timeout y salida inválida;
- no permite conteo con líneas bloqueantes.

**Depende de:** AI-01, AI-02 y AI-03; puede comenzar con fake adapter contractual.

#### BE-03 · Catálogo, shortlist lexical, escaneos y reconciliación — P0

**Aceptación:**

- catálogo local versionado y fixture sanitizado; `GET /catalog`;
- shortlist de máximo cinco candidatos con score y margen lexicales (`rapidfuzz`/`difflib`);
- escaneos idempotentes por `client_event_id`;
- ningún SKU inventado por el modelo se persiste; el alta humana valida unicidad;
- toda cifra de `summary` y `discrepancy` se deriva en código.

**Depende de:** BE-01.

#### BE-04 · Respuestas, asignación y alta de SKU — P0

**Aceptación:**

- persiste pregunta y candidatos; selección directa validada sin reinterpretar con el modelo;
- `assign` con las tres formas (sku existente, new_product, mark_unresolved) y eventos correspondientes;
- transición automática a `receiving` cuando no quedan líneas bloqueantes;
- el reset elimina los productos creados durante recepciones.

**Depende de:** AI-03.

#### BE-05 · Finalizar, reclamo seguro, cierre y reset — P0

**Aceptación:**

- `/finalize` congela snapshot y transiciona según discrepancias (con → `ready_to_claim`, sin → `closed`);
- el snapshot no cambia por acciones posteriores;
- tabla de hechos determinística; prosa QVAC validada contra el snapshot con fallback explícito;
- cierre sin efectos externos; reset borra solo runtime y se prueba dos veces seguidas.

**Depende de:** AI-04.

#### BE-06 · Arranque e integración end-to-end — P0

**Aceptación:**

- scripts nativos: compilar web, levantar QVAC y API en orden, verificar build estático servido;
- health agregado no dice `ready` antes del smoke inference;
- modo estricto falla si detecta fake AI;
- smoke E2E: crear → poll → responder → asignar → escanear → finalizar → reclamar → cerrar;
- README con instalación limpia, caché de modelos y troubleshooting breve.

**Depende de:** todas las historias P0.

### 12.3 Nahuel — QVAC e IA local

#### AI-01 · Runtime QVAC, modelos y health — P0

**Aceptación:**

- versión exacta del SDK fijada; modelo, cuantización y hardware registrados;
- `qvac doctor` ejecutado y documentado;
- modelos cargados una sola vez, smoke inference antes de `ready`;
- escucha solo en `127.0.0.1`; proceso único sin reload;
- sin API keys, proveedores cloud ni fallback remoto.

**Depende de:** gate de máquina del viernes.

#### AI-02 · OCR y extracción estructurada con evidencia — P0

**Aceptación:**

- OCR real de QVAC; bbox/confianza cuando el SDK los entrega;
- normalización con modelo QVAC local y schema cerrado;
- campos críticos referencian bloques OCR;
- parsea, valida, reintenta una vez, luego declara incertidumbre;
- probado con al menos tres fotos de más de un proveedor, incluida una deficiente;
- no hardcodea texto, proveedor, remito, línea ni cantidad.

**Depende de:** AI-01.

#### AI-03 · Veredicto de matching y pregunta — P0

**Aceptación:**

- solo acepta el shortlist recibido; salida validada nunca contiene SKU ajeno;
- veredicto categórico del enum, sin decimales de confianza;
- la pregunta usa atributos presentes en los candidatos;
- casos de prueba: SKU inventado por el modelo, candidato cercano, línea sin candidato razonable.

**Depende de:** AI-01 y contrato interno publicado.

#### AI-04 · Reclamo grounded — P0

**Aceptación:**

- recibe exclusivamente el snapshot confirmado;
- schema cerrado: asunto, apertura, cierre, SKU mencionados;
- no calcula diferencias ni arma la tabla;
- salida reproducible con temperatura baja;
- devuelve error validable si no puede generar prosa grounded.

**Depende de:** AI-01.

#### AI-06 · Benchmark slim y evidencia para jueces — P0

**Aceptación:**

- un script corre 3 documentos una vez cada uno y guarda el JSON crudo en `evidence/`;
- el README publica una tabla: schema válido, cantidad exacta, SKU válido/correcto, honestidad ante duda, grounding y latencia warm/cold;
- conserva los fallos no corregidos; sin porcentajes ficticios previos;
- permalinks exactos en el README a carga de modelo, OCR, completion, validación y retry.

**Depende de:** AI-02, AI-03 y AI-04.

---

## 13. Orden de integración

### Gate 0 — Freeze de contrato (sábado, tras el inicio oficial)

- Los tres leen este archivo.
- Rachid materializa modelos Pydantic públicos y ejemplos canónicos.
- Nahuel materializa los modelos internos.
- Luis confirma que puede representar todos los estados.

No se construye una segunda versión del contrato en chats separados.

### Gate 1 — Vertical slice con adapter fake

- Web crea recepción y hace polling contra FastAPI.
- FastAPI usa adapter QVAC fake solo en desarrollo.
- La vista llega hasta una línea resuelta y un conteo.

### Gate 2 — Primera inferencia real

- Nahuel procesa una foto por el servicio real.
- Rachid reemplaza el fake por `QVAC_BASE_URL` sin cambiar dominio ni UI.
- Luis muestra evidencia e incertidumbre sin cambios de schema.

### Gate 3 — Historia completa

- Flujo a + b + c → conteo → faltante → finalizar → reclamo → cierre.
- Modo estricto activo. Red externa desconectada.
- Tag `demo-candidate`.

### Gate 4 — Demo machine y grabación

- Tres corridas seguidas con reset; una con documento no visto; una con foto mala.
- Se registran tiempos y fallos. Se congela scope: solo defectos de P0.
- Se graba el video.

---

## 14. Estrategia de Git y coordinación

- Una rama corta por historia: `luis/fe-01`, `rachid/be-02`, `nahuel/ai-03`.
- PRs pequeños con historia y criterio de aceptación.
- Los contratos se integran antes que sus consumidores; cambios incompatibles actualizan modelos, ejemplos y consumidores juntos.
- No se hace merge de un mock habilitado por defecto.
- Último tercio del evento: solo defectos reproducibles.

**Handoff mínimo por historia:** commit/PR, comando exacto para probar, resultado esperado, limitaciones, evidencia (screenshot/JSON/log), cambios de variables de entorno.

---

## 15. Datos de demo

### 15.1 Catálogo mínimo

Entre 15 y 30 productos, con al menos:

- dos variantes casi iguales separadas por un atributo visible (`cromado`/`negro`);
- un producto con sinónimos/abreviaturas de proveedor;
- un producto que NO esté en ningún remito de prueba (para ejercitar el buscador del flujo c);
- barcodes únicos; nombre, SKU, unidad y atributos estructurados.

```json
{
  "catalog_id": "demo-main",
  "products": [
    {
      "sku": "PEI-BIL-MC-CR",
      "barcode": "7790000000012",
      "name": "Monocomando mesada Bilbao cromado",
      "unit": "unidad",
      "aliases": ["Monoc. mesada Bilbao CR", "Bilbao cromada"],
      "attributes": { "family": "Bilbao", "finish": "cromado" }
    }
  ]
}
```

Los aliases alimentan el matching lexical, pero el test con inputs nuevos incluye descripciones no copiadas de ellos.

### 15.2 Documentos

- Solo documentos propios o sanitizados; sin datos personales ni precios sensibles en el repo.
- Guardar original, resultado esperado y notas de dificultad por separado; el ground truth nunca entra al prompt.
- Incluir: foto buena, inclinada, baja luz y una no procesable.
- El remito principal debe contener una línea que dispare cada flujo: a, b y c.

---

## 16. Pruebas y métricas

### 16.1 Tests P0 — solo dos suites

1. **Aritmética de reconciliación** (backend): exacto, faltante, sobrante, duplicado e inesperado.
2. **Whitelist de SKU** (backend + adapter): ningún SKU inventado por el modelo cruza la validación; el alta humana valida unicidad.

Todo lo demás se cubre con el checklist de la sección 18 y las corridas del Gate 4.

### 16.2 Matriz de evaluación (slim)

Tres documentos × una corrida (script de AI-06): schema válido, cantidad exacta, SKU correcto, SKU válido, honestidad, grounding del reclamo, latencia warm y cold. Resultados reales en el README, incluido lo que falla.

### 16.3 Presupuestos de experiencia

- UI no inferencial: < 300 ms percibidos.
- OCR + extracción warm: objetivo ≤ 30 s; cutoff 60 s.
- Matching/reclamo warm: objetivo ≤ 10 s; cutoff 20 s.
- Reset: ≤ 3 s.

Si el hardware no llega, se mide y se adapta el guion; el video edita esperas, no falsifica.

---

## 17. Seguridad, privacidad y honestidad

- Sin API keys: no hay IA externa.
- Sin CORS: mismo origen en demo, proxy de Vite en desarrollo.
- QVAC solo en loopback.
- Nombres de archivo reemplazados por IDs; MIME verificado por contenido.
- Los documentos se eliminan con reset y no se commitean.
- El texto OCR es input no confiable: no puede cambiar instrucciones ni schemas; los prompts separan datos de instrucciones.
- La aplicación dice "borrador listo", nunca "enviado".
- Una incertidumbre visible es comportamiento correcto.

---

## 18. Definition of Done global

- [ ] `README.md` funciona desde un clon limpio.
- [ ] Versiones de Node, Python, SDK, worker y modelos fijadas.
- [ ] Hardware, SO, cuantización, RAM y latencias reales documentados.
- [ ] Integración QVAC nueva con permalinks directos.
- [ ] Sin endpoint, key o fallback de IA cloud.
- [ ] OCR/extracción procesa un documento no incluido en fixtures.
- [ ] El backend hace todas las operaciones numéricas.
- [ ] Ningún SKU inventado por el modelo cruza la validación.
- [ ] Los tres flujos de mapeo (a, b, c) funcionan y quedan en el log.
- [ ] El reclamo usa el snapshot congelado y pasa validación grounded.
- [ ] La demo corre offline con modelos cacheados.
- [ ] Reset + segunda corrida sin reiniciar la base.
- [ ] Escenarios A y C ensayados; el cierre conforme funciona sin ensayo.
- [ ] Benchmark slim (3 documentos) con fallos incluidos.
- [ ] El video final dura 3 minutos o menos.

---

## 19. Kill list y regla de scope

Si P0 no está estable, se elimina en este orden:

1. **Reclamo grounded** — el video cierra en el resumen de diferencias ("faltan 2, detectado al instante"); caen AI-04, 9.4 y la parte de reclamo de BE-05/FE-04.
2. **Escenario C** (foto deficiente) — `needs_retake` queda implementado pero sin ensayo.
3. **Alta de SKU nuevo** — el flujo c queda solo con asignación de SKU existente + `unresolved`.

No se elimina:

- OCR y extracción reales con QVAC;
- validación de salida y whitelist;
- pregunta desambigüadora por botones;
- asignación manual del flujo c;
- reconciliación determinística;
- reset y evidencia slim.

> **Ley suprema:** nunca aumentar el scope sin eliminar otra cosa de esfuerzo equivalente.

---

## 20. Riesgos y mitigaciones

| Riesgo | Señal temprana | Mitigación |
|---|---|---|
| QVAC no inicia en hardware/OS | health no pasa smoke | `qvac doctor` el viernes; fijar máquina de demo |
| Wi-Fi del venue saturado | descarga lenta | modelos y dependencias descargados el viernes |
| `--reload` en servicio QVAC | RAM duplicada | proceso único sin auto-reload (5.3) |
| Foto HEIC desde iPhone | upload falla | probar viernes; `INVALID_FILE` con mensaje claro |
| `/claim` bloquea con inferencia | spinner largo | timeout de fetch ≥ 60 s; riesgo aceptado |
| RAM insuficiente OCR + LLM | carga lenta, OOM | solo modelos necesarios; medir RSS |
| OCR pobre en español | líneas ausentes | rotación/contraste local, evidencia, nueva foto |
| JSON inválido del modelo | parse error | schema estricto, un repair, luego incertidumbre |
| SKU alucinado | SKU inexistente | shortlist lexical + whitelist obligatoria |
| Shortlist lexical no trae el SKU correcto | flujo c aparece de más | aliases ricos en el catálogo; embeddings como P1 |
| Demo tarda más de tres minutos | warm latency alta | medir, ajustar guion, editar esperas en el video |
| Tres ramas divergen | schemas distintos | Pydantic primero, ejemplos canónicos, gates |
| Mock llega a la demo | resultados perfectos | modo estricto + smoke inference en health |
| Wi-Fi falla en vivo | celular no conecta | demo completa en la misma notebook |
| Reclamo agrega hechos | número/SKU extraño | snapshot, tabla en código, validador, fallback |
| Hardware de escaneo ausente | no se ve real | lector USB keyboard-wedge de Accesaniga + hoja de barcodes impresa |

---

## 21. Referencias técnicas verificadas

- [QVAC — System requirements](https://docs.qvac.tether.io/system-requirements/): plataformas, Vulkan ≥ 1.4 en Windows incluso CPU, RAM, disco y `qvac doctor`.
- [QVAC — Python SDK](https://docs.qvac.tether.io/python-sdk/): `tetherto-qvac-sdk`, Python ≥ 3.10, worker Node ≥ 22.17, cliente asyncio.
- [QVAC — OCR](https://docs.qvac.tether.io/ai-capabilities/ocr/): `OCR_LATIN`, bloques con bbox/confianza.
- [QVAC — Connection caveats](https://docs.qvac.tether.io/cli/http-server/connection/): el chat OpenAI-compatible es text-only.
- [Repositorio oficial QVAC](https://github.com/tetherto/qvac).

---

## 22. Decisiones pendientes que no bloquean el contrato

Se cierran con un smoke test, no con debate:

1. Modelo de texto exacto y cuantización: el menor que pase el set real; registrar versión.
2. Configuración de `OCR_LATIN` para español: validar sobre los remitos disponibles.
3. Máquina y SO finales de demo: requirements + tres corridas seguidas.
4. **Confirmación del sponsor (workshop sábado 9:30):** preguntar a Raquel si QVAC en una máquina local del depósito con clientes web por LAN cumple el requisito de inferencia local del track. ADR-003 asume que sí; si debe ser on-device, se renegocia scope en ese momento.

---

## 23. Cierre del contrato

RemitIA no automatiza el depósito. Automatiza un momento económico y verificable: interpretar un remito, traducirlo al catálogo, detectar la diferencia mientras todavía se puede reclamar y dejar la nota lista.

- **Luis hace visible y operable la historia.**
- **Rachid garantiza estado, números e integración.**
- **Nahuel demuestra inteligencia local real, controlada y medible.**

Ante cualquier duda durante la ejecución, la respuesta por defecto es la opción que reduzca scope, preserve la inferencia QVAC real y haga más repetible la demo.
