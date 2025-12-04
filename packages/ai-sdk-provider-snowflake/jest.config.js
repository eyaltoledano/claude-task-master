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
	// ========================================================================
	// Parallel Execution Configuration
	// ========================================================================
	
	// Use 75% of CPUs for maximum parallelization (increase from 50%)
	maxWorkers: '75%',
	
	// Allow more concurrent tests within each worker
	maxConcurrency: 10,
	
	// Memory management
	workerIdleMemoryLimit: '512MB',
	
	// ========================================================================
	// Performance Optimizations
	// ========================================================================
	
	cache: true,
	cacheDirectory: '<rootDir>/node_modules/.cache/jest',
	
	// Run tests in parallel within each file using it.concurrent
	// Note: it.concurrent.each enables parallel execution of parameterized tests
	
	// ========================================================================
	// Test Execution
	// ========================================================================
	
	testTimeout: parseInt(process.env.TEST_TIMEOUT || '30000', 10),
	bail: false,
	verbose: false,
	silent: false,
	
	// Force exit after tests (handles async cleanup)
	forceExit: true,
	
	// ========================================================================
	// Coverage Configuration
	// ========================================================================
	
	collectCoverage: true,
	coverageDirectory: 'coverage',
	collectCoverageFrom: [
		'src/**/*.ts',
		'!src/**/*.d.ts',
		'!src/**/index.ts',
	],
	coverageThreshold: {
		global: {
			branches: 10,
			functions: 20,
			lines: 20,
			statements: 20,
		},
	},
	
	// ========================================================================
	// Test Projects (Parallel Execution by Category)
	// ========================================================================
	
	projects: [
		// ----------------------------------------------------------------------
		// Unit Tests - Run in full parallel
		// ----------------------------------------------------------------------
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
			// Maximum parallelization for unit tests (fast, no API calls)
			maxWorkers: '100%',
			maxConcurrency: 20,
		},
		
		// ----------------------------------------------------------------------
		// Integration Tests - Parallel with rate limiting consideration
		// ----------------------------------------------------------------------
		{
			...baseConfig,
			displayName: 'integration',
			testEnvironment: 'node',
			roots: ['<rootDir>/tests'],
			testMatch: [
				// Legacy integration test (to be deprecated)
				'<rootDir>/tests/integration.test.ts',
				// New organized integration tests
				'<rootDir>/tests/integration/**/*.test.ts',
			],
			// Moderate parallelization for API tests (avoid rate limits)
			maxWorkers: '50%',
			maxConcurrency: 5,
			// Longer timeout for API calls
			testTimeout: 120000,
			// Disable coverage thresholds for integration tests
			coverageThreshold: {},
			globals: {
				'ts-jest': {
					useESM: true,
				},
			},
		},
	],
	
	// ========================================================================
	// Reporter Configuration
	// ========================================================================
	
	reporters: [
		'default',
		// Uncomment for detailed test timing analysis:
		// ['jest-slow-test-reporter', { numTests: 10, warnOnSlowerThan: 5000 }]
	],
};
