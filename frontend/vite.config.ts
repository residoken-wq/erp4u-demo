import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Cho phep Docker map port
    port: 5173,
    allowedHosts: ['localhost:3000'],
    proxy: {
      '/api': {
        target: 'http://localhost:3999',
        changeOrigin: true,
      },
    },
  },
  build: {
    minify: false, // Tắt minify để tránh treo RAM trên VPS yếu
    sourcemap: false,
    reportCompressedSize: false // Tắt tính toán gzip size để tăng tốc build
  }
})
