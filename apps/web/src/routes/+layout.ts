/**
 * ADR-003 / ADR-009 — SPA pura: sin SSR, sin prerender.
 * El build de `adapter-static` emite `index.html` como fallback y FastAPI lo
 * sirve para cualquier ruta.
 */
export const ssr = false;
export const prerender = false;
export const trailingSlash = 'never';
