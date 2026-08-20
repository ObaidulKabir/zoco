const base = require('../../packages/config/jest.base.cjs');

module.exports = {
  ...base,
  rootDir: '.',
  testPathIgnorePatterns: ['\\.int\\.spec\\.ts$'],
  moduleNameMapper: {
    '^@zoqo/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: [
    'src/modules/**/domain/**/*.ts',
    'src/modules/**/application/**/*.ts',
    '!**/*.spec.ts',
  ],
  coverageThreshold: {
    global: { lines: 90 },
  },
};
