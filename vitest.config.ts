import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'dist/**',
        'src/**/*.d.ts',
        'src/styles/**',
        'src/runtime/panel/pages/**'
      ],
      all: true,
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit-pure',
          environment: 'node',
          include: ['tests/unit-pure/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'unit-chrome',
          environment: 'node',
          include: ['tests/unit-chrome/**/*.test.ts'],
          setupFiles: ['tests/setup/chrome.setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'unit-dom',
          environment: 'jsdom',
          include: ['tests/unit-dom/**/*.test.ts'],
          setupFiles: ['tests/setup/dom.setup.ts', 'tests/setup/chrome.setup.ts'],
        },
      },
    ],
  },
});
