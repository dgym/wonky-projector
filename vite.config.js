import { defineConfig } from 'vite';
import ssr from 'vite-plugin-ssr/plugin';
import { svelte } from './node_modules/@sveltejs/vite-plugin-svelte/dist/index.js';

export default defineConfig({
    build: {
        sourcemap: true,
    },
    plugins: [
        svelte({}),
        ssr({prerender: true}),
    ],
});
