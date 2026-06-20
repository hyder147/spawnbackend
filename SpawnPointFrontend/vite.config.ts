import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
    plugins: [react()],

    // ─── Dev server ───────────────────────────────────────────
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:5077',  // ← fixed: was 5000
                changeOrigin: true,
                secure: false,
            }
        }
    },

    // ─── Production build ─────────────────────────────────────
    build: {
        outDir: 'dist',
        sourcemap: mode === 'development',
        minify: true,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        if (id.includes('react-router-dom')) return 'router';
                        if (id.includes('react-dom') || id.includes('/react/') || id.includes('\\react\\')) return 'react';
                    }
                }
            }
        }
    },

    // ─── Preview server ───────────────────────────────────────
    preview: {
        port: 4173,
    }
}))