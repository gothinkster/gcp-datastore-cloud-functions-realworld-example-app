module.exports = {

  env: {
    node: true,
  },

  globals: {
    Promise: true,
    describe: true,
    it: true,
    before: true,
    after: true,
  },

  parserOptions: {
    ecmaVersion: 2017,
    sourceType: 'module',
  },

  // The Rules
  extends: 'eslint:recommended',
  rules: {
    'semi': ['error', 'always'],
    'no-console': 'off',
  },

};
