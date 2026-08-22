import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

/**
 * ADR-003 — mismo origen siempre.
 * En desarrollo el navegador habla con http://localhost:5173 y Vite proxea
 * `/api` hacia FastAPI en http://localhost:8000. No existe CORS en ningún modo:
 * el código de la app nunca usa una URL absoluta.
 */
export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		port: 5173,
		strictPort: false,
		proxy: {
			'/api': {
				target: 'http://localhost:8000',
				changeOrigin: false
			}
		}
	}
});
