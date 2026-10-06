import javascript from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import typescript from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '.codex/**',
    '.agents/**',
    'aidlc/**',
    'node_modules/**',
    'dist/**',
    'coverage/**',
  ]),
  {
    files: ['eslint.config.mjs', 'scripts/u1-lunch-bot/**/*.mjs'],
    extends: [javascript.configs.recommended],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: globals.node,
    },
  },
  {
    files: [
      'src/**/*.ts',
      'scripts/u1-lunch-bot/**/*.ts',
      'tests/u1-lunch-bot/**/*.ts',
      'vitest.config.ts',
    ],
    extends: [javascript.configs.recommended, typescript.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
]);
