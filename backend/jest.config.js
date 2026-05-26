/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  setupFilesAfterEach: [],
  setupFiles: ["<rootDir>/tests/helpers/env.ts"],
  testTimeout: 30000,
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: ["src/**/*.ts", "!src/scripts/**", "!src/server.ts"],
  coverageDirectory: "coverage",
  verbose: false
};
