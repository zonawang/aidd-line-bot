import { defineConfig } from 'vitest/config';
import SafeReporter from './tests/u1-lunch-bot/fixtures/safe-reporter.js';

export default defineConfig({
  test: {
    watch: false,
    passWithNoTests: false,
    allowOnly: false,
    cache: false,
    silent: true,
    onConsoleLog: () => false,
    reporters: [new SafeReporter()],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [],
      clean: true,
      cleanOnRerun: false,
      reportsDirectory: 'coverage/u1-lunch-bot',
      reporter: ['json-summary'],
      thresholds: { lines: 80, autoUpdate: false },
    },
    projects: ['unit', 'integration', 'e2e', 'performance'].map((layer) => ({
      extends: true,
      test: {
        name: `u1-lunch-bot-${layer}`,
        include: [`tests/u1-lunch-bot/${layer}/**/*.test.ts`],
        environment: 'node',
        pool: 'forks',
        maxWorkers: 1,
        fileParallelism: false,
        isolate: true,
        retry: 0,
        testTimeout: layer === 'performance' ? 360_000 : 10_000,
        hookTimeout: 10_000,
        clearMocks: true,
        restoreMocks: true,
        unstubEnvs: true,
        unstubGlobals: true,
      },
    })),
  },
});
