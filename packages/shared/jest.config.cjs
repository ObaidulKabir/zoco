const base = require('../config/jest.base.cjs');

module.exports = {
  ...base,
  rootDir: '.',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/index.ts'],
  coverageThreshold: {
    global: { lines: 80 },
  },
};
