/**
 * Jest configuration using projects feature to separate AI and non-AI tests
 * This allows different concurrency settings for each type
 */

const baseConfig = {
	testEnvironment: 'node',
	testTimeout: 600000,
	verbose: true,
	silent: false,
	setupFilesAfterEnv: ['<rootDir>/tests/e2e/setup/jest-setup.js'],
	globalSetup: '<rootDir>/tests/e2e/setup/global-setup.js',
	globalTeardown: '<rootDir>/tests/e2e/setup/global-teardown.js',
	transform: {},
	transformIgnorePatterns: ['/node_modules/'],
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/$1'
	},
	moduleDirectories: ['node_modules', '<rootDir>'],
	reporters: [
		'default',
		'jest-junit',
		[
			'jest-html-reporters',
			{
				publicPath: './test-results',
				filename: 'index.html',
				pageTitle: 'Task Master E2E Test Report',
				expand: true,
				openReport: false,
				hideIcon: false,
				includeFailureMsg: true,
				enableMergeData: true,
				dataMergeLevel: 1,
				inlineSource: false
			}
		]
	]
};

export default {
	projects: [
		{
			...baseConfig,
			displayName: 'Non-AI E2E Tests',
			testMatch: [
				'<rootDir>/tests/e2e/**/add-dependency.test.js',
				'<rootDir>/tests/e2e/**/remove-dependency.test.js',
				'<rootDir>/tests/e2e/**/validate-dependencies.test.js',
				'<rootDir>/tests/e2e/**/fix-dependencies.test.js',
				'<rootDir>/tests/e2e/**/add-subtask.test.js',
				'<rootDir>/tests/e2e/**/remove-subtask.test.js',
				'<rootDir>/tests/e2e/**/clear-subtasks.test.js',
				'<rootDir>/tests/e2e/**/set-status.test.js',
				'<rootDir>/tests/e2e/**/show.test.js',
				'<rootDir>/tests/e2e/**/list.test.js',
				'<rootDir>/tests/e2e/**/next.test.js',
				'<rootDir>/tests/e2e/**/tags.test.js',
				'<rootDir>/tests/e2e/**/add-tag.test.js',
				'<rootDir>/tests/e2e/**/delete-tag.test.js',
				'<rootDir>/tests/e2e/**/rename-tag.test.js',
				'<rootDir>/tests/e2e/**/copy-tag.test.js',
				'<rootDir>/tests/e2e/**/use-tag.test.js',
				'<rootDir>/tests/e2e/**/init.test.js',
				'<rootDir>/tests/e2e/**/models.test.js',
				'<rootDir>/tests/e2e/**/move.test.js',
				'<rootDir>/tests/e2e/**/remove-task.test.js',
				'<rootDir>/tests/e2e/**/sync-readme.test.js',
				'<rootDir>/tests/e2e/**/rules.test.js',
				'<rootDir>/tests/e2e/**/lang.test.js',
				'<rootDir>/tests/e2e/**/migrate.test.js'
			],
			// Non-AI tests can run with more parallelism
			maxWorkers: 4,
			maxConcurrency: 5
		},
		{
			...baseConfig,
			displayName: 'Light AI E2E Tests',
			testMatch: [
				'<rootDir>/tests/e2e/**/add-task.test.js',
				'<rootDir>/tests/e2e/**/update-subtask.test.js',
				'<rootDir>/tests/e2e/**/complexity-report.test.js'
			],
			// Light AI tests with moderate parallelism
			maxWorkers: 3,
			maxConcurrency: 3
		},
		{
			...baseConfig,
			displayName: 'Heavy AI E2E Tests',
			testMatch: [
				'<rootDir>/tests/e2e/**/update-task.test.js',
				'<rootDir>/tests/e2e/**/expand-task.test.js',
				'<rootDir>/tests/e2e/**/research.test.js',
				'<rootDir>/tests/e2e/**/research-save.test.js',
				'<rootDir>/tests/e2e/**/parse-prd.test.js',
				'<rootDir>/tests/e2e/**/generate.test.js',
				'<rootDir>/tests/e2e/**/analyze-complexity.test.js',
				'<rootDir>/tests/e2e/**/update.test.js'
			],
			// Heavy AI tests run sequentially to avoid rate limits
			maxWorkers: 1,
			maxConcurrency: 1,
			// Even longer timeout for AI operations
			testTimeout: 900000 // 15 minutes
		}
	],
	// Global settings
	coverageDirectory: '<rootDir>/coverage-e2e',
	collectCoverageFrom: [
		'src/**/*.js',
		'!src/**/*.test.js',
		'!src/**/__tests__/**'
	]
};