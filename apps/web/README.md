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
│  │  ├─ labels.ts            # textos en español de los valores canónicos
│  │  └─ document-file.ts     # validación local JPG/PNG ≤ 12 MB (PRD 8.3)
│  └─ components/
│     ├─ HealthBanner, LineCard, MatchBadge, ErrorPanel, LocalSeal, Spinner
│     ├─ DocumentPicker.svelte # cámara/archivo + preview con objectURL
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

## Reglas que respeta esta app

- No calcula diferencias ni totales: muestra `summary` y `discrepancy` tal como llegan.
- No decide transiciones: elige la pantalla según el `status` que publica la API.
- No acepta un SKU fuera de los candidatos en el flujo (b).
- Muestra `message` del envelope de error y una acción humana; nunca stack traces.
- Dice "borrador listo", nunca "enviado".
