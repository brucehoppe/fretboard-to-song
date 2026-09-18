import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('./', import.meta.url));
const alias = {
  '@/': root,
  // The Worker-only module is replaced by a settable test double.
  'cloudflare:workers': fileURLToPath(new URL('./tests/helpers/cloudflare-workers.ts', import.meta.url)),
};

export default defineConfig({
  resolve: { alias },
  test: {
    coverage: {
      provider: 'v8',
      include: ['lib/**', 'hooks/**', 'components/app/**', 'app/api/**'],
      exclude: ['lib/database.ts', 'lib/utils.ts', 'hooks/use-mobile.ts'],
      thresholds: { lines: 97, functions: 97, branches: 92, statements: 95 },
    },
    projects: [
      { resolve: { alias }, test: { name: 'unit', environment: 'node', testTimeout: 30_000, include: ['tests/unit/**/*.test.ts'] } },
      { resolve: { alias }, test: { name: 'api', environment: 'node', include: ['tests/api/**/*.test.ts'] } },
      {
        plugins: [react()], resolve: { alias },
        test: { name: 'components', environment: 'jsdom', testTimeout: 60_000, include: ['tests/components/**/*.test.tsx'], setupFiles: ['tests/helpers/setup-dom.ts'] },
      },
    ],
  },
});
