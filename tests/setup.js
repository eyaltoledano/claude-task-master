/**
 * Jest setup file
 *
 * This file is run before each test suite to set up the test environment.
 */

// Mock environment variables
process.env.MODEL = 'sonar-pro';
process.env.MAX_TOKENS = '64000';
process.env.TEMPERATURE = '0.2';
process.env.DEBUG = 'false';
process.env.TASKMASTER_LOG_LEVEL = 'error'; // Set to error to reduce noise in tests
process.env.DEFAULT_SUBTASKS = '5';
process.env.DEFAULT_PRIORITY = 'medium';
process.env.PROJECT_NAME = 'Test Project';
process.env.PROJECT_VERSION = '1.0.0';
// Ensure tests don't make real API calls by setting mock API keys
process.env.ANTHROPIC_API_KEY = 'test-mock-api-key-for-tests';
process.env.PERPLEXITY_API_KEY = 'test-mock-perplexity-key-for-tests';

// Add global test helpers if needed
global.wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// If needed, silence console during tests
if (process.env.SILENCE_CONSOLE === 'true') {
	global.console = {
		...console,
		log: () => {},
		info: () => {},
		warn: () => {},
		error: () => {}
	};
}
