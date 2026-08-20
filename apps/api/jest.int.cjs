const unit = require('./jest.config.cjs');

module.exports = {
  ...unit,
  testMatch: ['**/*.int.spec.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  testTimeout: 30000,
};
