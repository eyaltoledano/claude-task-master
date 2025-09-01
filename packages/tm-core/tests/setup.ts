/**
 * @fileoverview Vitest test setup file
 */

import { afterAll, beforeAll, vi } from 'vitest';

// Setup any global test configuration here
// For example, increase timeout for slow CI environments
if (process.env.CI) {
	// Vitest timeout is configured in vitest.config.ts
}

// Suppress console errors during tests unless explicitly testing them
const originalError = console.error;
beforeAll(() => {
	console.error = vi.fn();
});

afterAll(() => {
	console.error = originalError;
});
