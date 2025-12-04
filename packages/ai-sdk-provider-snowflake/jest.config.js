/** @type {import('jest').Config} */
const baseTransform = {
	'^.+\\.ts$': [
		'ts-jest',
		{
			useESM: true,
			tsconfig: {
				target: 'ES2022',
				module: 'ESNext',
				moduleResolution: 'bundler',
				esModuleInterop: true,
				allowSyntheticDefaultImports: true,
				strict: true,
			},
		},
	],
};

const baseConfig = {
	moduleNameMapper: {
		'^(\\.{1,2}/.*)\\.js$': '$1',
	},
	moduleFileExtensions: ['ts', 'js', 'json', 'node'],
	extensionsToTreatAsEsm: ['.ts'],
	transform: baseTransform,
	clearMocks: true,
	restoreMocks: true,
	setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};

export default {
	// Parallel execution - optimized for test performance
	maxWorkers: '50%', // Use 50% of available CPU cores for optimal performance
	workerIdleMemoryLimit: '512MB', // Memory limit per worker
	maxConcurrency: 5, // Allow up to 5 tests to run concurrently within a worker
	
	// Performance optimizations
	cache: true,
	cacheDirectory: '<rootDir>/node_modules/.cache/jest',
	
	// Test execution
	testTimeout: parseInt(process.env.TEST_TIMEOUT || '30000', 10), // Default 30s timeout
	bail: false, // Run all tests
	verbose: false,
	silent: false,
	
	// Coverage - at root level
	collectCoverage: true,
	coverageDirectory: 'coverage',
	collectCoverageFrom: [
		'src/**/*.ts',
		'!src/**/*.d.ts',
		'!src/**/index.ts',
	],
	// Coverage thresholds - relaxed for integration tests
	// Integration tests hit real APIs and can't cover all code paths
	coverageThreshold: {
		global: {
			branches: 10,
			functions: 20,
			lines: 20,
			statements: 20,
		},
	},
	
	// Force exit after tests complete - required for integration tests that may have lingering handles
	forceExit: true,
	
	// Projects for different test types
	projects: [
		// Unit tests - run in parallel
		{
			...baseConfig,
			displayName: 'unit',
			testEnvironment: 'node',
			roots: ['<rootDir>/tests'],
			testMatch: [
				'<rootDir>/tests/unit/**/*.test.ts',
				'<rootDir>/tests/*.test.ts',
			],
			testPathIgnorePatterns: [
				'<rootDir>/tests/integration.test.ts',
				'<rootDir>/tests/integration/',
			],
			maxWorkers: '50%', // Parallel unit tests
		},
		// Integration tests (requires credentials)
		{
			...baseConfig,
			displayName: 'integration',
			testEnvironment: 'node',
			roots: ['<rootDir>/tests'],
			testMatch: [
				'<rootDir>/tests/integration.test.ts',
				'<rootDir>/tests/integration/**/*.test.ts',
			],
			// Increase workers for faster integration tests
			// Note: Adjust if you hit Snowflake API rate limits
			maxWorkers: '50%',
			// Use globals for timeout in integration tests
			globals: {
				'ts-jest': {
					useESM: true,
				},
			},
			// Disable coverage thresholds for integration tests - they test functionality, not code paths
			coverageThreshold: {},
		},
	],
};

