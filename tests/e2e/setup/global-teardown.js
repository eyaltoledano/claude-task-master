/**
 * Global teardown for E2E tests
 * Runs once after all test suites
 */

export default async () => {
	// Silent mode for cleaner output
	if (!process.env.JEST_SILENT_REPORTER) {
		console.log('\n🧹 Cleaning up E2E test environment...\n');
	}

	// Any global cleanup needed
	// Note: Individual test directories are cleaned up in afterEach hooks
};
