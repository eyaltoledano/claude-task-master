/**
 * Base Vitest configuration for Task Master monorepo
 * Provides shared configuration that can be extended by individual packages
 */
import { defineConfig } from 'vitest/config';

/**
 * Base Vitest configuration for all packages
 * Import and use with mergeConfig in package-specific vitest.config.ts
 */
export const baseVitestConfig = defineConfig({
	test: {
		// Enable global test APIs (describe, it, expect, etc.)
		globals: true,

		// Default environment for all packages (Node.js)
		environment: 'node',

		// Common test file patterns
		include: [
			'tests/**/*.test.ts',
			'tests/**/*.spec.ts',
			'src/**/*.test.ts',
			'src/**/*.spec.ts'
		],

		// Common exclusions
		exclude: ['node_modules', 'dist', '.git', '.cache', '**/node_modules/**'],

		// Coverage configuration
		coverage: {
			provider: 'v8',
			enabled: true,
			reporter: ['text', 'json', 'html'],
			include: ['src/**/*.ts'],
			exclude: [
				'node_modules/',
				'dist/',
				'tests/',
				'**/*.test.ts',
				'**/*.spec.ts',
				'**/*.d.ts',
				'**/mocks/**',
				'**/fixtures/**',
				'**/types/**',
				'vitest.config.ts',
				'src/index.ts'
			],
			thresholds: {
				branches: 70,
				functions: 70,
				lines: 70,
				statements: 70
			}
		},

		// Test execution settings
		testTimeout: 10000,
		clearMocks: true,
		restoreMocks: true,
		mockReset: true
	}
});

// Re-export vitest utilities for convenience
export { defineConfig, mergeConfig } from 'vitest/config';
