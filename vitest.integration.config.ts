import { defineConfig } from 'vitest/config';

/**
 * Integration test configuration
 * Runs .test.ts files only, no coverage
 */
export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
		exclude: ['node_modules', 'dist', '.git', '.cache', '**/node_modules/**'],
		coverage: { enabled: false },
		passWithNoTests: true,
		testTimeout: 30000,
		clearMocks: true,
		restoreMocks: true,
		mockReset: true
	}
});
