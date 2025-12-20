import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
    server: {
        port: 5173,
        host: '0.0.0.0' // Allow external access
    },
    // Serve ui folder as public assets
    publicDir: 'public',
    build: {
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
            }
        }
    }
})
