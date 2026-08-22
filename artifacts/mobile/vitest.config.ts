import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // @workspace/dosage-calc exports a .ts source file directly; Vitest
      // cannot resolve it through the package exports field without this alias.
      '@workspace/dosage-calc': path.resolve(
        __dirname,
        '../../lib/dosage-calc/src/index.ts',
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['services/**/*.test.ts'],
    globals: false,
  },
});
