module.exports = {
  ...require('../../packages/config/eslint.base.cjs'),
  root: true,
  env: { node: true, jest: true },
  ignorePatterns: ['dist', 'cucumber.cjs'],
};
