import nextPlugin from '@next/eslint-plugin-next';
import base from './base.js';

export default [
  ...base,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
    },
    languageOptions: {
      globals: {
        document: 'readonly',
        fetch: 'readonly',
        HTMLButtonElement: 'readonly',
        navigator: 'readonly',
        process: 'readonly',
        window: 'readonly',
        React: 'readonly',
      },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
];
