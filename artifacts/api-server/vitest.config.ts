import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
  },
  resolve: {
    alias: {
      // Resolve workspace packages to their source
      '@workspace/db': path.resolve(__dirname, '../../lib/db/src/index.ts'),
    },
  },
});
