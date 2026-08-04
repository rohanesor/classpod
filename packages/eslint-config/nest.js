import base from './base.js';

export default [
  ...base,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
