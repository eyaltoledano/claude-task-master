/**
 * @fileoverview General-purpose mock implementations for tests
 *
 * These mocks provide consistent test doubles for common dependencies
 * across unit and integration tests.
 */

/**
 * Mock logger factory for suppressing log output in tests.
 *
 * Returns a logger with all methods stubbed as no-ops.
 *
 * USAGE:
 * ```ts
 * vi.mock('../path/to/logger/index.js', () => ({
 *   getLogger: createMockLogger
 * }));
 * ```
 */
export const createMockLogger = (): {
	warn: () => void;
	info: () => void;
	debug: () => void;
	error: () => void;
} => ({
	warn: () => {},
	info: () => {},
	debug: () => {},
	error: () => {}
});
