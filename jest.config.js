module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@octokit|universal-user-agent)/)'
  ],
  moduleNameMapper: {
    '^@octokit/(.*)$': '<rootDir>/node_modules/@octokit/$1'
  }
};