/** @type {import('jest').Config} */
export default {
	preset: 'ts-jest/presets/default-esm',
	testEnvironment: 'node',
	extensionsToTreatAsEsm: ['.ts'],
	moduleNameMapper: {
		'^(\\.{1,2}/.*)\\.js$': '$1'
	},
	transform: {
		'^.+\\.tsx?$': [
			'ts-jest',
			{
				useESM: true,
				tsconfig: {
					module: 'ESNext',
					moduleResolution: 'node',
					esModuleInterop: true,
					allowSyntheticDefaultImports: true
				}
			}
		]
	},
	testMatch: [
		'<rootDir>/tests/unit/**/*.test.ts',
		'<rootDir>/tests/integration/**/*.test.ts'
	],
	testPathIgnorePatterns: [
		'/node_modules/'
	],
	collectCoverageFrom: [
		'src/**/*.ts',
		'!src/**/*.d.ts',
		'!src/index.ts',
		'!src/**/index.ts'
	],
	coverageThreshold: {
		global: {
			branches: 70,
			functions: 80,
			lines: 80,
			statements: 80
		}
	},
	// Parallel execution - resource leaks have been fixed
	maxWorkers: '50%', // Use 50% of available CPU cores for optimal performance
	workerIdleMemoryLimit: '512MB', // Memory limit per worker
	maxConcurrency: 5, // Allow up to 5 tests to run concurrently within a worker
	
	// Test execution
	testTimeout: parseInt(process.env.TEST_TIMEOUT || '30000', 10), // Configurable timeout (default 30s)
	bail: false, // Run all tests
	
	// Performance optimizations
	cache: true,
	cacheDirectory: '<rootDir>/node_modules/.cache/jest',
	clearMocks: true,
	resetMocks: false,
	restoreMocks: false,
	
	// Output
	verbose: false,
	silent: false,
	
	// Force exit after tests complete - required for integration tests that spawn CLI processes
	// Even with proper stream cleanup, Jest may detect lingering handles from subprocess spawns
	forceExit: true
};
