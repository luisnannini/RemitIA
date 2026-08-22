/// <reference types="@sveltejs/kit" />

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface Platform {}
	}
}

interface ImportMetaEnv {
	/**
	 * Switch de DESARROLLO entre el adapter fake y FastAPI real.
	 * Solo se lee dentro de una rama `import.meta.env.DEV`; en producción no
	 * habilita nada (ver `src/lib/api/index.ts`).
	 */
	readonly VITE_REMITIA_API?: 'mock' | 'real';
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

export {};
