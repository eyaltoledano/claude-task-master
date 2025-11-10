export default {
	// Use Node.js environment for testing
	testEnvironment: 'node',

	// Automatically clear mock calls between every test
	clearMocks: true,

	// Indicates whether the coverage information should be collected while executing the test
	collectCoverage: false,

	// The directory where Jest should output its coverage files
	coverageDirectory: 'coverage',

	// A list of paths to directories that Jest should use to search for files in
	roots: ['<rootDir>/tests'],

	// The glob patterns Jest uses to detect test files
	testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],

	// Transform files
	preset: 'ts-jest/presets/default-esm',
	extensionsToTreatAsEsm: ['.ts'],
	moduleFileExtensions: ['js', 'ts', 'json', 'node'],
	transform: {
		'^.+\\.ts$': [
			'ts-jest',
			{
				useESM: true
			}
		]
	},

	// Disable transformations for node_modules
	transformIgnorePatterns: ['/node_modules/'],

	// Set moduleNameMapper for absolute paths
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/$1'
	},
	resolver: '<rootDir>/jest.resolver.cjs',

	// Setup module aliases
	moduleDirectories: ['node_modules', '<rootDir>'],

	// Configure test coverage thresholds
	// Note: ts-jest reports coverage against .ts files, not .js
	coverageThreshold: {
		global: {
			branches: 80,
			functions: 80,
			lines: 80,
			statements: 80
		},
		// Critical code requires higher coverage
		'./src/utils/**/*.ts': {
			branches: 70,
			functions: 90,
			lines: 90,
			statements: 90
		},
		'./src/middleware/**/*.ts': {
			branches: 70,
			functions: 85,
			lines: 85,
			statements: 85
		}
	},

	// Generate coverage report in these formats
	coverageReporters: ['text', 'lcov'],

	// Verbose output
	verbose: true,

	// Setup file
	setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};
