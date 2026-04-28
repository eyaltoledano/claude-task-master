/**
 * Bun test setup file
 *
 * This file is run before each test suite to set up the test environment.
 * Used for root-level tests (tests/) that use Bun's test runner.
 * Package-level tests (tm-core, cli, mcp) use Vitest for advanced mocking.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll } from 'bun:test';

// Capture the actual original working directory before any changes
const originalWorkingDirectory = process.cwd();

// Store original working directory and project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Ensure we're always starting from the project root
if (process.cwd() !== projectRoot) {
	process.chdir(projectRoot);
}

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
declare global {
	var wait: (ms: number) => Promise<void>;
	var originalWorkingDirectory: string;
	var projectRoot: string;
}

globalThis.wait = (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));

// Store original working directory for tests that need it
globalThis.originalWorkingDirectory = originalWorkingDirectory;
globalThis.projectRoot = projectRoot;

// If needed, silence console during tests
if (process.env.SILENCE_CONSOLE === 'true') {
	globalThis.console = {
		...console,
		log: () => {},
		info: () => {},
		warn: () => {},
		error: () => {}
	};
}

// Track original listener counts to restore only what we added
const originalListenerCounts: Record<string, number> = {
	SIGINT: process.listenerCount('SIGINT'),
	SIGTERM: process.listenerCount('SIGTERM'),
	SIGHUP: process.listenerCount('SIGHUP')
};

// Clean up signal-exit listeners after all tests to prevent open handle warnings
// This is needed because packages like proper-lockfile register signal handlers
afterAll(async () => {
	// Give any pending async operations time to complete
	await new Promise((resolve) => setImmediate(resolve));

	// Remove only listeners added after setup, preserving framework/application listeners
	for (const [signal, originalCount] of Object.entries(
		originalListenerCounts
	)) {
		const currentListeners = process.listeners(signal as NodeJS.Signals);
		const addedCount = currentListeners.length - originalCount;
		for (let i = 0; i < addedCount; i++) {
			const listener = currentListeners[currentListeners.length - 1 - i];
			process.removeListener(signal, listener as (...args: unknown[]) => void);
		}
	}
});
