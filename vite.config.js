import { defineConfig } from 'vite';
import ssr from 'vite-plugin-ssr/plugin';

export default defineConfig({
    build: {
        sourcemap: true,
    },
    plugins: [
        ssr({prerender: true}),
    ],
});
