/**
 * Jest config for node-side logic tests (DB schema/seed, repositories, history rule,
 * unit formatting, sync round-trip). WatermelonDB's LokiJS adapter runs under jsdom,
 * which is how the engine itself is tested. babel-jest reads babel.config.js, so the
 * legacy-decorator plugin the models need is applied automatically.
 */
module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  // WatermelonDB ships untranspiled ESM-ish modules that must go through babel.
  transformIgnorePatterns: ['node_modules/(?!(@nozbe/watermelondb)/)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
};
