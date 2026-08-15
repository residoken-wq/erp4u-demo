// Dynamic API URL resolution
// 1. If VITE_API_URL environment variable is set (Vercel / Production build), use it.
// 2. If running in browser on localhost, default to http://localhost:3000/api.
// 3. Otherwise default to relative /api for proxy / reverse proxy.

export const API_URL = 
  import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/api'
    : '/api');
