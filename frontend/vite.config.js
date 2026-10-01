import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'

function htmlPartials() {
    return {
        name: 'html-partials',
        transformIndexHtml(html, ctx) {
            return html.replace(/<!--#include virtual="(.*?)" -->/g, (match, filePath) => {
                const fullPath = path.resolve(__dirname, filePath.replace(/^\//, ''))
                if (fs.existsSync(fullPath)) {
                    return fs.readFileSync(fullPath, 'utf-8')
                }
                return match
            })
        }
    }
}

export default defineConfig({
    plugins: [htmlPartials()],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:8080',
                changeOrigin: true,
                secure: false,
            },
        },
    },
    esbuild: {
        legalComments: 'none',
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
        rollupOptions: {
            input: {
                main: 'index.html',
                tentang: 'tentang.html',
                kontak: 'kontak.html',
                privasi: 'privasi.html',
            },
        },
    },
})