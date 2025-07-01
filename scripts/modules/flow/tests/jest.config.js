export default {
  displayName: "Flow Tests",
  testMatch: ["<rootDir>/**/*.test.js"],
  testEnvironment: "node",
  
  // Simple module mapping (fixed typo from moduleNameMapping)
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/../$1"
  },
  
  // Coverage configuration
  collectCoverageFrom: [
    "../**/*.js",
    "../**/*.jsx",
    "!../node_modules/**",
    "!../tests/**",
    "!../dist/**"
  ],
  coverageReporters: ["text", "lcov", "html"],
  coverageDirectory: "<rootDir>/coverage",
  
  // Test configuration
  testTimeout: 10000,
  verbose: true,
  
  // Setup files
  setupFilesAfterEnv: ["<rootDir>/setup.js"]
};
