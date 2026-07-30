import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
      '/ready': 'http://localhost:3001',
      '/metrics': 'http://localhost:3001',
      '/openapi.json': 'http://localhost:3001',
      '/api-docs': 'http://localhost:3001',
    },
  },
})
