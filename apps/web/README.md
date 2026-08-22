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
grep -ril "REMITIA_MOCK_FIXTURE" build/   # debe no encontrar nada
```

Incluso forzando `VITE_REMITIA_API=mock npm run build` el bundle queda limpio.

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
│  │  └─ index.ts             # switch mock/real + helper de polling (ADR-004)
│  ├─ ui/labels.ts            # textos en español de los valores canónicos
│  └─ components/
│     ├─ HealthBanner, LineCard, MatchBadge, ErrorPanel, LocalSeal, Spinner
│     └─ screens/             # Procesando, Revisión, Recepción guiada, Resumen
└─ routes/
   ├─ +page.svelte            # Home
   └─ recepcion/[id]/         # elige la pantalla según `view.status`
```

## Reglas que respeta esta app

- No calcula diferencias ni totales: muestra `summary` y `discrepancy` tal como llegan.
- No decide transiciones: elige la pantalla según el `status` que publica la API.
- No acepta un SKU fuera de los candidatos en el flujo (b).
- Muestra `message` del envelope de error y una acción humana; nunca stack traces.
- Dice "borrador listo", nunca "enviado".
