module.exports = {
  default: {
    requireModule: ['reflect-metadata', 'tsx/cjs'],
    require: ['tests/bdd/steps/**/*.ts'],
    paths: ['../../features/**/*.feature'],
    format: ['progress'],
  },
};
