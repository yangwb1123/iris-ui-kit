import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import vuePlugin from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import sveltePlugin from 'eslint-plugin-svelte'
import svelteParser from 'svelte-eslint-parser'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.turbo/**', '**/coverage/**', '**/*.d.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Cyclomatic complexity as a low-noise real-time signal (branching, not length).
      // warn-only by design: component render functions are legitimately long but rarely
      // branchy; file/function LENGTH stays governed by scripts/arch-check.mjs (baseline ratchet).
      complexity: ['warn', 15],
    },
  },
  {
    files: ['**/*.vue'],
    plugins: {
      vue: vuePlugin,
    },
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 2022,
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      ...vuePlugin.configs['flat/essential']?.[0]?.rules,
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    plugins: {
      svelte: sveltePlugin,
    },
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 2022,
        sourceType: 'module',
        extraFileExtensions: ['.svelte'],
      },
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_|^\\$\\$' },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Framework adapter components: JSX render functions have conditional branches
  // (ternary, &&) that raise cyclomatic complexity. Relax limit for adapters
  // and plugin packages with complex render logic.
  {
    files: [
      'packages/react/src/**/*.{ts,tsx}',
      'packages/solid/src/**/*.{ts,tsx}',
      'packages/vue/src/**/*.{ts,tsx}',
      'packages/plugin-pro-table/src/**/*.{ts,tsx}',
      'packages/plugin-form-builder/src/**/*.{ts,tsx}',
    ],
    rules: {
      complexity: ['warn', 70],
    },
  },
)
