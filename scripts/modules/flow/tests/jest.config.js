/**
 * Jest Configuration for Task Master Flow Tests
 * 
 * ES Modules configuration for testing the Flow system components
 * including AST processing, cache management, and service testing.
 */

export default {
	// Test environment
	testEnvironment: 'node',
	
	// Enable ES modules support (extensionsToTreatAsEsm not needed with type: module in package.json)
	transform: {},
	
	// Module name mapping for easier imports
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/../$1',
		'^@tests/(.*)$': '<rootDir>/$1'
	},
	
	// Test file patterns
	testMatch: [
		'<rootDir>/**/*.test.js',
		'<rootDir>/**/*.spec.js'
	],
	
	// Files to ignore
	testPathIgnorePatterns: [
		'<rootDir>/node_modules/',
		'<rootDir>/fixtures/',
		'<rootDir>/coverage/'
	],
	
	// Setup files
	setupFilesAfterEnv: [
		'<rootDir>/setup.js'
	],
	
	// Coverage configuration
	collectCoverage: false, // Enable manually with --coverage
	collectCoverageFrom: [
		'../**/*.js',
		'!../node_modules/**',
		'!../tests/**',
		'!../coverage/**',
		'!../**/fixtures/**'
	],
	
	coverageDirectory: '<rootDir>/coverage',
	coverageReporters: [
		'text',
		'lcov',
		'html'
	],
	
	// Verbose output for better debugging
	verbose: true,
	
	// Clear mocks between tests
	clearMocks: true,
	
	// Restore mocks after each test
	restoreMocks: true,
	
	// Maximum number of concurrent workers
	maxWorkers: '50%',
	
	// Timeout for tests (10 seconds for service tests)
	testTimeout: 10000,
	
	// Global setup and teardown
	globalSetup: undefined,
	globalTeardown: undefined,
	
	// Error handling
	errorOnDeprecated: true,
	
	// Module directories
	moduleDirectories: [
		'node_modules',
		'<rootDir>/../node_modules',
		'<rootDir>/../../node_modules',
		'<rootDir>/../../../node_modules'
	],
	
	// Transform ignore patterns for ES modules
	transformIgnorePatterns: [
		'node_modules/(?!(some-esm-package)/)'
	]
};
