export default {
	// Use ts-jest preset for TypeScript support
	preset: 'ts-jest/presets/default-esm',
	
	// Use Node.js environment for testing
	testEnvironment: 'node',

	// Automatically clear mock calls between every test
	clearMocks: true,

	// Indicates whether the coverage information should be collected while executing the test
	collectCoverage: false,

	// The directory where Jest should output its coverage files
	coverageDirectory: 'coverage',

	// A list of paths to directories that Jest should use to search for files in
	roots: ['<rootDir>/tests', '<rootDir>/src', '<rootDir>/scripts', '<rootDir>/mcp-server'],

	// The glob patterns Jest uses to detect test files
	testMatch: [
		'**/__tests__/**/*.[jt]s',
		'**/?(*.)+(spec|test).[jt]s'
	],

	// Transform files
	transform: {
		'^.+\\.tsx?$': ['ts-jest', {
			useESM: true,
			tsconfig: {
				allowJs: true,
				esModuleInterop: true,
			},
		}],
		'^.+\\.jsx?$': ['ts-jest', {
			useESM: true,
			tsconfig: {
				allowJs: true,
				esModuleInterop: true,
			},
		}],
	},

	// Disable transformations for node_modules except for ES modules
	transformIgnorePatterns: [
		'node_modules/(?!(chalk|ora|boxen|inquirer|gradient-string|figlet)/)'
	],

	// Module file extensions
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

	// Set moduleNameMapper for absolute paths
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/$1',
		'^(\\.{1,2}/.*)\\.js$': '$1',
	},

	// Setup module aliases
	moduleDirectories: ['node_modules', '<rootDir>'],

	// Configure test coverage thresholds
	coverageThreshold: {
		global: {
			branches: 80,
			functions: 80,
			lines: 80,
			statements: 80
		}
	},

	// Generate coverage report in these formats
	coverageReporters: ['text', 'lcov'],

	// Verbose output
	verbose: true,

	// Setup file
	setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
	
	// ESM support
	extensionsToTreatAsEsm: ['.ts'],
};
