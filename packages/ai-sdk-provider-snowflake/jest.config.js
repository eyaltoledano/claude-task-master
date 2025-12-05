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
				strict: true
			}
		}
	]
};

const baseConfig = {
	moduleNameMapper: {
		'^(\\.{1,2}/.*)\\.js$': '$1'
	},
	moduleFileExtensions: ['ts', 'js', 'json', 'node'],
	extensionsToTreatAsEsm: ['.ts'],
	transform: baseTransform,
	clearMocks: true,
	restoreMocks: true,
	setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
};

export default {
	// ========================================================================
	// Parallel Execution Configuration
	// ========================================================================

	// Use 75% of CPUs for maximum parallelization
	maxWorkers: '75%',

	// Memory management - helps workers terminate cleanly
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

	// Global teardown for proper async cleanup
	globalTeardown: '<rootDir>/tests/teardown.ts',

	// Worker configuration to handle async cleanup gracefully
	// Setting workerIdleMemoryLimit helps workers terminate cleanly
	workerIdleMemoryLimit: '512MB',

	// ========================================================================
	// Coverage Configuration
	// ========================================================================

	collectCoverage: true,
	coverageDirectory: 'coverage',
	collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/index.ts'],
	coverageThreshold: {
		global: {
			branches: 80,
			functions: 80,
			lines: 80,
			statements: 80
		}
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
				'<rootDir>/tests/*.test.ts'
			],
			testPathIgnorePatterns: [
				'<rootDir>/tests/integration.test.ts',
				'<rootDir>/tests/integration/'
			],
			// Limit parallelization to reduce worker exit warnings
			// Using 50% of available CPUs provides good balance
			maxWorkers: '50%'
		},

		// ----------------------------------------------------------------------
		// Integration Tests - Parallel with rate limiting consideration
		// ----------------------------------------------------------------------
		{
			...baseConfig,
			displayName: 'integration',
			testEnvironment: 'node',
			roots: ['<rootDir>/src', '<rootDir>/tests'],
			testMatch: [
				// Organized integration tests by feature
				'<rootDir>/tests/integration/**/*.test.ts',
				'<rootDir>/tests/integration/**/*.spec.ts'
			],
			// Moderate parallelization for API tests (avoid rate limits)
			maxWorkers: '50%',
			// Disable coverage thresholds for integration tests
			coverageThreshold: {},
			// Use custom setup for longer timeouts on integration tests
			setupFilesAfterEnv: [
				'<rootDir>/tests/setup.ts',
				'<rootDir>/tests/setup-integration.ts'
			]
		}
	],

	// ========================================================================
	// Reporter Configuration
	// ========================================================================

	reporters: [
		'default'
		// Uncomment for detailed test timing analysis:
		// ['jest-slow-test-reporter', { numTests: 10, warnOnSlowerThan: 5000 }]
	]
};
