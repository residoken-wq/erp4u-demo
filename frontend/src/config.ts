const defaultApiUrl = typeof import.meta !== 'undefined' && (import.meta as any)?.env?.DEV ? 'http://localhost:3000/api' : '/api';
export const API_URL = (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_API_URL) || defaultApiUrl;

