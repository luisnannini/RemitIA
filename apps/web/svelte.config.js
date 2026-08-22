import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * ADR-003 / ADR-009: SPA estática servida por FastAPI en la demo.
 * `fallback: 'index.html'` permite rutas dinámicas (/recepcion/[id]) sin SSR.
 * @type {import('@sveltejs/kit').Config}
 */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: false
		}),
		alias: {
			$components: 'src/lib/components'
		}
	}
};

export default config;
