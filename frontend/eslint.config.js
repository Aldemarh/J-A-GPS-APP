import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';

// Reglas de JavaScript recomendadas + reglas de React Hooks (incluye las del React Compiler)
// + aviso cuando un archivo rompe la recarga en caliente de Vite.
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [js.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Cada contexto exporta su proveedor y su hook en el mismo archivo (patrón de React).
      'react-refresh/only-export-components': ['error', { allowExportNames: ['useAuth', 'useFleet'] }],
    },
  },
  {
    // Archivos de configuración: se ejecutan en Node, no en el navegador.
    files: ['*.config.js'],
    languageOptions: { globals: globals.node },
  },
]);
