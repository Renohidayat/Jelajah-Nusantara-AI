import { defineConfig } from 'vite'

export default defineConfig({
    server: {
        port: 5173,
        proxy: {
            // All /api calls proxied to backend during dev
            '/api': {
                target: 'http://localhost:8080',
                changeOrigin: true,
                secure: false,
            },
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
    },
})