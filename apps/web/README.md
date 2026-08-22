# RemitIA · Web (Luis)

Shell de demo mobile-first. SvelteKit + TypeScript + Tailwind, compilado con
`adapter-static` a una SPA que FastAPI sirve en la demo (ADR-003 / ADR-009).

> Ownership: este directorio es de Luis. No contiene lógica de negocio: renderiza
> exclusivamente lo que devuelve el contrato público `/api/v1`.

## Requisitos

- Node `>= 22.17` (PRD 5.3). Verificado con `v24.12.0`.

## Comandos

```bash
npm install

npm run dev       # http://localhost:5173 con adapter FAKE (no requiere FastAPI)
npm run dev:api   # http://localhost:5173 contra FastAPI real vía proxy de Vite
npm run build     # genera build/ (index.html + assets)
npm run preview   # sirve build/ localmente
npm run check     # svelte-check (TypeScript + Svelte)
```

`npm run build` deja el sitio en `apps/web/build/`. Es lo que FastAPI monta como
estático; cualquier ruta desconocida debe caer en `build/index.html`.

## Mismo origen, sin CORS

El código de la app **nunca** usa una URL absoluta: todo pasa por `/api/v1/...`.

- Desarrollo: `vite.config.ts` proxea `/api` → `http://localhost:8000`.
- Demo: FastAPI sirve el build y la API en el mismo origen.

## Switch mock / real

Un solo lugar decide la implementación: `src/lib/api/index.ts`.

| Modo   | Cómo se activa                     | Qué hace                                              |
| ------ | ---------------------------------- | ----------------------------------------------------- |
| `mock` | `npm run dev` (`.env.development`)  | Adapter fake en el navegador, escenario A del PRD 11.3 |
| `real` | `npm run dev:api` y **todo build**  | `fetch` relativo contra FastAPI                        |

El mock está detrás de `import.meta.env.DEV` y se carga con `import()` dinámico.
En `vite build` esa rama es dead code: Rollup no emite el chunk. Verificación:

```bash
npm run build
grep -ril "REMITIA_MOCK_FIXTURE" build/     # debe no encontrar nada
grep -ril "REMITIA_MOCK_SCENARIO_C" build/  # debe no encontrar nada
grep -ril "borros" build/                   # trigger del escenario C
```

Incluso forzando `VITE_REMITIA_API=mock npm run build` el bundle queda limpio.

### Escenarios del mock (PRD 11.3)

Por defecto el adapter fake reproduce el **escenario A**. El **escenario C**
(foto deficiente) se dispara por el **nombre del archivo** que se elige en el
Home. Es un atajo exclusivo del mock: el contrato no cambia y el backend real
nunca mira el nombre del archivo.

| Nombre del archivo contiene | Qué simula                                                             |
| --------------------------- | ---------------------------------------------------------------------- |
| `borros…` (borrosa, borroso) | `POST /receptions` responde 202 y la extracción termina en `failed`     |
| `mala`                       | `POST /receptions` falla con `DOCUMENT_LOW_QUALITY` + `take_another_photo` |
| cualquier otro               | Escenario A: cuatro líneas, una ambigua y una sin candidato             |

Comparación sin distinguir mayúsculas ni tildes. Las dos variantes terminan en
el mismo lugar: la UI ofrece sacar otra foto y el Home queda listo para capturar
(`/?recapturar=1`).

## Mapa del código

```
src/
├─ app.css                    # Tailwind v4 + tema de depósito
├─ barcode-detector.d.ts      # tipos de la Barcode Detection API (no están en lib.dom)
├─ lib/
│  ├─ api/
│  │  ├─ types.ts             # contrato público (PRD 7 y 8) tipado
│  │  ├─ errors.ts            # envelope de error (PRD 8.11) → clase ApiError
│  │  ├─ http.ts              # ÚNICO fetch de la app: rutas relativas, timeout, retry
│  │  ├─ contract.ts          # interfaz ApiClient
│  │  ├─ http-client.ts       # implementación real
│  │  ├─ mock/                # ⚠️ solo dev: fixtures + doble del backend
│  │  └─ index.ts             # switch mock/real + polling y su corte (ADR-004)
│  ├─ ui/
│  │  ├─ labels.ts            # textos y clases por estado canónico
│  │  ├─ new-product.ts       # validación de forma del alta de SKU (flujo c)
│  │  ├─ actions.ts           # error del contrato atribuido a una línea
│  │  ├─ camera.ts            # fallas locales de la cámara (NO son del PRD 8.11)
│  │  └─ document-file.ts     # validación local JPG/PNG ≤ 12 MB (PRD 8.3)
│  └─ components/
│     ├─ HealthBanner, LineCard, MatchBadge, MatchStatusIcon, ErrorPanel, LocalSeal, Spinner
│     ├─ DocumentPicker.svelte # cámara/archivo + preview con objectURL
│     ├─ CameraScanner.svelte  # overlay de escaneo Code 128 (BarcodeDetector nativo)
│     └─ screens/             # Procesando, Fallo, Revisión, Recepción guiada, Resumen
└─ routes/
   ├─ +page.svelte            # Home (`?recapturar=1` = listo para otra foto)
   └─ recepcion/[id]/         # elige la pantalla según `view.status`
```

## Captura y procesamiento (FE-02)

- La foto se valida en el dispositivo antes de subirla (tipo y ≤ 12 MB) y se
  muestra una miniatura real, ampliable a pantalla completa. El server valida
  igual: la validación local es UX, no negocio.
- El botón "Iniciar recepción" se deshabilita tras el primer toque (PRD 8.3: no
  hay `Idempotency-Key`).
- El polling es de 750 ms y corta cuando el `status` deja de ser `draft` o
  `processing_document`: `failed`, `needs_document_review`, `receiving`,
  `ready_to_claim` y `closed` lo detienen (`stopsPolling` en `lib/api/index.ts`).
- La pantalla Procesando no inventa progreso: un paso se marca como hecho solo
  cuando la vista canónica trae la evidencia (`document.ocr_quality`,
  `lines.length`, el cambio de `status`). El único número que corre es el tiempo
  transcurrido, que es real. No hay porcentajes ni barra de progreso.
- Mapeo de `user_action` del envelope (PRD 8.11) en el Home:

| `user_action`          | Qué hace la Home                                              |
| ---------------------- | ------------------------------------------------------------- |
| `retry`                | Reintenta el mismo `POST /receptions` con la misma foto        |
| `take_another_photo`   | Descarta la foto, resalta la captura y devuelve el foco        |
| `start_over`           | Home limpio: sin foto y sin error                              |
| `contact_support`      | Sin botón: muestra el `trace_id` para escalar                  |
| desconocido o ausente  | Sin botón: la decisión vuelve a la persona                     |

  El POST no es idempotente, así que un reintento a ciegas puede crear una
  segunda recepción: solo se reintenta cuando el servidor lo pide con `retry`.

## Revisión con los tres flujos (FE-03)

La pantalla de revisión (`screens/ReviewScreen.svelte` + `LineCard.svelte`) es la
que más tiempo ocupa en el video (guion 1:00–1:40).

- **Estado de la línea con tres señales redundantes**: color (barra lateral y
  fondo), ícono de forma distinta (tilde, interrogación, triángulo, círculo
  tachado) y texto. Se lee en un celular sin zoom y no depende solo del color.
- **Lo que bloquea va primero**: dos grupos, `Para resolver · N` y
  `Ya resueltas · N`, más un contador grande "Quedan N líneas por resolver".
  Agrupar y contar tarjetas es presentación: el estado de cada línea lo publica
  la API en `match.status` y la definición de bloqueante (PRD 7) solo se usa para
  ordenar (`needsHumanAction` en `ui/labels.ts`).
- **Flujo (b)**: la pregunta va destacada y cada candidato es un botón de un
  toque con nombre + SKU. La lista sale de `match.candidates` y, además, el
  handler revalida contra esa lista antes de emitir: un SKU ajeno a la pregunta
  no se puede mandar ni tocando el DOM. Si la API marca `ambiguous` sin publicar
  pregunta, la línea cae al panel del flujo (c) en vez de quedar sin salida.
- **Flujo (c)**: buscador client-side sobre el catálogo ya cargado (nombre, SKU y
  alias, hasta 8 resultados), alta de SKU nuevo y "dejar sin resolver". Las tres
  variantes mandan el body exacto de 8.6, con **una sola clave por request**.
- **Alta de SKU**: el SKU se normaliza mientras se tipea (mayúsculas, espacios
  convertidos en guiones) y se valida contra `^[A-Z0-9][A-Z0-9-]*$`; nombre
  obligatorio. Si el SKU ya está en el catálogo cargado se **avisa pero no se
  bloquea**: la unicidad
  la decide la API y su `SKU_ALREADY_EXISTS` se muestra dentro de la tarjeta de
  esa línea, junto al botón que la persona tocó. El nombre arranca con el texto
  del remito para editarlo; el SKU siempre lo escribe la persona.
- **Evidencia sin ruido**: el `source_text` está siempre a la vista; confianza de
  OCR, similitud lexical y bloques van en un detalle expandible, abierto en las
  bloqueantes y colapsado en las resueltas. Si la API no publica esos números, lo
  dice en vez de inventarlos.
- **Foto del remito**: se despliega en línea desde `preview_url` (PRD 8.10) y se
  puede abrir entera en otra pestaña. Nunca tapa la pantalla.
- **Transición**: al resolver la última línea bloqueante la API pasa sola a
  `receiving` y el router cambia de pantalla. La web no fuerza nada; el aviso
  "todo resuelto, pasando al conteo" solo describe lo que ya devolvió la API.
- Después de un alta se vuelve a pedir `GET /catalog` (silenciosamente): el
  catálogo cambió y el buscador y el nombre del producto asignado lo usan.

## Escaneo por cámara (FE-05)

No existe el lector USB que asumía el PRD 8.7 original. La línea corregida dice:
**"Entrada física: cámara del celular (Android + Chrome, Code 128) sobre la
página; teclado manual como fallback."** El contrato de `POST /scans` no cambió:
todo esto es UI.

- `CameraScanner.svelte` es un overlay a pantalla completa con la cámara trasera
  (`getUserMedia({ video: { facingMode: 'environment' } })`) y decodifica con la
  API **nativa** `BarcodeDetector` (`formats: ['code_128']`). **Sin librerías
  externas**: P0 es offline y no se agrega peso al bundle.
- El overlay **no conoce la API**: recibe `unitsCounted`, `scanning`, `onscan` y
  `onclose`, y emite códigos por el mismo `onscan` que el submit del input de
  teclado. El `client_event_id` y el `quantity: 1` los sigue poniendo
  `routes/recepcion/[id]/+page.svelte`.
- **Contador**: el número grande es `view.summary.units_counted`, el del
  servidor. El "en esta sesión" es un dato de UI y se dice como tal; acá no se
  suma nada (PRD 10.3).
- **Cooldown de 1,5 s por código** (`Map` código → instante). Sostener la cámara
  sobre una etiqueta no dispara diez `POST /scans`; re-apuntar deliberadamente
  después de la ventana sí suma otra unidad. Además, mientras `scanning` es
  `true` no se emite nada: nunca hay dos escaneos en vuelo.
- **Feature-detect**: el botón "Escanear con la cámara" aparece solo si
  `'BarcodeDetector' in window` (Chrome; no está en Firefox ni Safari). Sin
  soporte no hay botón **ni error**: el input de teclado queda igual que antes.
- **Foco**: con el overlay abierto, el `$effect` de foco de `ReceivingScreen` no
  toca el input (mismo trato que el modal de confirmación). Al cerrar, el foco
  vuelve al input.
- **Limpieza**: el teardown del `$effect` hace `track.stop()` **siempre**,
  incluso si el componente se desmonta con la cámara abierta o si el permiso
  todavía estaba en vuelo. La luz de la cámara no queda prendida.
- **Errores**: permiso denegado, sin cámara, cámara ocupada, navegador sin
  soporte y contexto no seguro se muestran **dentro** del overlay, con texto
  humano y botones (reintentar / cerrar y escribir el código). Son fallas
  locales del navegador: **no** usan el envelope del PRD 8.11 ni el `ErrorPanel`
  global, y nunca muestran un stack trace.
- **a11y**: `role="dialog"`, `aria-modal`, foco inicial en "Cerrar", `Escape`
  cierra. El feedback es redundante: vibración (`navigator.vibrate`), destello
  verde y el código leído en texto.

### Probarlo en el celular (requiere contexto seguro)

`getUserMedia` solo existe en un **contexto seguro**: HTTPS o `localhost`. Abrir
`http://192.168.x.x:5173` desde el celular deja `navigator.mediaDevices` en
`undefined` y el overlay lo dice con todas las letras.

```bash
npm run dev -- --host        # mock, escenario A, sin FastAPI
npm run dev:api -- --host    # contra FastAPI real (Vite proxea /api desde la notebook)
```

En el celular, Chrome → `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
→ agregar el origen exacto que imprime Vite (`http://192.168.x.x:5173`) →
**Enabled** → relanzar Chrome. Recién ahí el botón de cámara funciona sobre HTTP.

El celular habla **solo** con Vite: el proxy a `http://localhost:8000` lo
resuelve el proceso de Vite en la notebook, así que no hace falta exponer
FastAPI ni tocar CORS (ADR-003). En escritorio alcanza con una webcam en
`http://localhost:5173`, que ya es contexto seguro.

## Reglas que respeta esta app

- No calcula diferencias ni totales: muestra `summary` y `discrepancy` tal como llegan.
- No decide transiciones: elige la pantalla según el `status` que publica la API.
- No acepta un SKU fuera de los candidatos en el flujo (b).
- El overlay de cámara solo emite el código que leyó: no suma, no transiciona y
  no inventa SKUs. Quien resuelve barcode → SKU es el backend (PRD 8.7).
- Muestra `message` del envelope de error y una acción humana; nunca stack traces.
- Dice "borrador listo", nunca "enviado".
