import json from '@eslint/json'
import markdown from '@eslint/markdown'
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier/flat'
import preferArrowFunctions from 'eslint-plugin-prefer-arrow-functions'
import pluginPromise from 'eslint-plugin-promise'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import eslintPluginTailwindcss from 'eslint-plugin-tailwindcss'
import unicorn from 'eslint-plugin-unicorn'

const NO_PARENT_IMPORTS = {
  group: ['../*'],
  message:
    'Use `./` for the same folder or a direct subfolder and the `@/` alias otherwise.'
}

const layerRule = (patterns) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        ...patterns.map((regex) => ({
          regex,
          message: 'Imports only flow down the layers (see AGENTS.md).'
        })),
        NO_PARENT_IMPORTS
      ]
    }
  ]
})

const layersBelow = (layers) => `^@/(${layers.join('|')})(/|$)`

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  pluginPromise.configs['flat/recommended'],
  prettier,
  preferArrowFunctions.configs.all,
  {
    extends: [eslintPluginTailwindcss.configs.recommended],
    settings: {
      tailwindcss: {
        cssConfigPath: './src/app/styles/globals.css',
        parseKeyFunctions: ['classnames', 'classNames']
      }
    }
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    plugins: {
      unicorn
    },
    extends: ['unicorn/recommended'],
    rules: {
      'unicorn/consistent-boolean-name': 'off',
      'unicorn/default-export-style': ['error', { functions: 'separate' }],
      'unicorn/logical-assignment-operators': 'off',
      'unicorn/no-null': 'off',
      'unicorn/name-replacements': [
        'error',
        {
          replacements: {
            params: false,
            props: false,
            utils: false
          }
        }
      ]
    }
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    rules: layerRule([])
  },
  // Pages reach the database only through the models, which take the client as an argument
  {
    files: ['src/app/**'],
    rules: layerRule([
      layersBelow(['repositories']),
      '^@/infra/(?!database/client$)'
    ])
  },
  ...Object.entries({
    'src/entry/**': ['app'],
    'src/models/**': ['app', 'entry'],
    'src/repositories/**': ['app', 'entry', 'models'],
    'src/infra/**': ['app', 'entry', 'models', 'repositories'],
    'src/constants/**': ['app', 'entry', 'models', 'repositories', 'infra']
  }).map(([files, layers]) => ({
    files: [files],
    rules: layerRule([layersBelow(layers)])
  })),
  {
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'import/no-anonymous-default-export': 'off'
    }
  },
  {
    files: ['**/*.json'],
    plugins: { json },
    language: 'json/json',
    extends: ['json/recommended']
  },
  {
    files: ['**/*.md'],
    plugins: { markdown },
    language: 'markdown/gfm',
    languageOptions: { frontmatter: 'yaml' },
    extends: ['markdown/recommended'],
    // These rules crash ESLint on GFM text nodes without a position (e.g. `[text][https://...]`)
    // instead of reporting: https://github.com/eslint/markdown/issues/619
    rules: {
      'markdown/no-invalid-label-refs': 'off',
      'markdown/no-missing-label-refs': 'off',
      'markdown/no-reference-like-urls': 'off',
      'markdown/no-space-in-emphasis': 'off'
    }
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    '.claude/**',
    'test-results/**'
  ])
])

export default eslintConfig
