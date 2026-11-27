import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/__tests__/*.vitest.ts', 'src/**/__tests__/*.vitest.tsx'],
  },
});
