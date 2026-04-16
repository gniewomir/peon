import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.{js,cjs,mjs,ts,cts,mts}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'data/**'],
  },
  eslintConfigPrettier,
);
