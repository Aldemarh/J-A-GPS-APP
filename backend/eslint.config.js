import js from '@eslint/js';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

// Reglas de JavaScript recomendadas para Node (módulos ES).
export default defineConfig([
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },
]);
