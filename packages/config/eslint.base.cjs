/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: false,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import', 'boundaries'],
  settings: {
    'import/resolver': {
      node: { extensions: ['.ts', '.tsx', '.js'] },
    },
    'boundaries/elements': [
      { type: 'domain', pattern: '**/domain/**' },
      { type: 'application', pattern: '**/application/**' },
      { type: 'infrastructure', pattern: '**/infrastructure/**' },
    ],
  },
  rules: {
    'boundaries/element-types': [
      'error',
      {
        default: 'disallow',
        rules: [
          { from: 'domain', allow: ['domain'] },
          { from: 'application', allow: ['application', 'domain'] },
          { from: 'infrastructure', allow: ['infrastructure', 'application', 'domain'] },
        ],
      },
    ],
  },
};
