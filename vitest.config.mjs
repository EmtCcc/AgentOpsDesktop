import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.{js,ts}'],
    environment: 'node',
    setupFiles: ['tests/setup.js'],
    bench: {
      include: ['tests/benchmarks/**/*.bench.{js,ts}'],
      reporters: ['default'],
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{js,ts}'],
      exclude: [
        'src/**/index.{js,ts}',
        '**/*.d.ts',
        '**/node_modules/**',
        '**/dist/**',
      ],
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
      },
    },
  },
});
