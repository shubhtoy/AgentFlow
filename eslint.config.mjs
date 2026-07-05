import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import importPlugin from 'eslint-plugin-import'
import prettierConfig from 'eslint-config-prettier'
import prettierPlugin from 'eslint-plugin-prettier'
import globals from 'globals'

// TypeScript-native lint config. See docs/CODING-STANDARDS.md for the rationale.
//
// This project is TypeScript on a modern target (ES2020+), not legacy ES5 JS.
// We intentionally do NOT extend `airbnb-base`: it is a plain-JavaScript style
// guide whose `no-restricted-syntax`/`no-continue` rules exist to avoid
// generator-based transpilation of `for...of` for old browsers — irrelevant
// here, and it banned an idiom (`for...of` with `continue`) used throughout
// this codebase. Rules below are @typescript-eslint's own recommendations
// plus a small set of explicit, justified project conventions.

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/.source/**'],
  },

  {
    files: ['**/*.{js,ts,tsx}'],
    plugins: {
      prettier: prettierPlugin,
      import: importPlugin,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'prettier/prettier': 'error',
      'import/extensions': 'off',
      'import/no-unresolved': 'off',
      'import/order': [
        'warn',
        { 'newlines-between': 'never', alphabetize: { order: 'asc', caseInsensitive: true } },
      ],
      // Prefer named exports across this codebase (consistent with how core/cli/studio
      // already import { ... } everywhere) — a single default-export convention isn't in use.
      'import/prefer-default-export': 'off',
      'no-console': 'off', // CLI + services legitimately log; scope console usage in review instead.
    },
  },

  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: 'module',
      },
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // `for...of`/`continue` are idiomatic, readable TypeScript on a modern target —
      // no regenerator-runtime concern applies. Do not reintroduce airbnb's ban on these.
      'no-restricted-syntax': 'off',
      'no-continue': 'off',
      // `_private` naming is used for intentionally-unexported/internal fields; harmless in TS.
      'no-underscore-dangle': 'off',
      // TypeScript hoists types/interfaces; function declarations are commonly used before
      // definition for readability (public API first, helpers below). Type-checking already
      // catches real use-before-init bugs.
      'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
      // Sequential awaits inside a loop are sometimes intentional (rate-limited APIs, ordered
      // fs writes) — require a comment justifying it in review rather than banning outright.
      'no-await-in-loop': 'off',
    },
  },

  {
    // packages/cli/src/services/* deliberately uses lazy in-function `require()` (not static
    // imports) to avoid circular imports between the services layer and parser.ts/library.ts.
    // This is a narrow, intentional exception — do not extend it to new files without the same
    // circular-import justification.
    files: ['packages/cli/src/services/**/*.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  {
    // git-manager.ts defines a mutable `exports = { _git: git }` seam at the bottom of the file
    // so tests/unit/git-manager.test.ts can swap in a mock git implementation
    // (`gitManager._git_exports._git = () => mockGitInstance`). Every call site reads through
    // `exports._git(...)` rather than calling `git` directly so the mock takes effect — this is
    // a real, tested dependency-injection seam, not an accidental forward reference.
    files: ['packages/cli/src/git/git-manager.ts'],
    rules: {
      'no-use-before-define': 'off',
    },
  },

  prettierConfig,
]
