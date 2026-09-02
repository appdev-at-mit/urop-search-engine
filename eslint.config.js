import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // cdk.out holds ~1GB of synthesized asset bundles (vendored node_modules
  // included), which made a local `npm run lint` hang for minutes. CI never
  // noticed because a fresh checkout has no cdk.out.
  // .venv is here because Playwright's pip package bundles a Node driver with
  // ~1000 lint errors' worth of .d.ts files. CI never saw it (fresh checkouts
  // have no venv), but it broke `npm run lint` locally.
  globalIgnores(['dist', 'infra/cdk.out', '**/node_modules', '**/.venv']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Pre-existing pattern used throughout this codebase (syncing local
      // state from props/query results in an effect). Not unsafe, just
      // stylistically discouraged by this newer rule.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
