import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'jsdom', include: ['quality/**/*.test.tsx'], restoreMocks: true }, esbuild: { jsx: 'automatic' } });
