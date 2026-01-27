import { defineConfig } from 'vitest/config';

/**
 * Unit test configuration
 * Runs .spec.ts files only, no coverage
 */
export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['tests/**/*.spec.ts', 'src/**/*.spec.ts'],
		exclude: ['node_modules', 'dist', '.git', '.cache', '**/node_modules/**'],
		coverage: { enabled: false },
		passWithNoTests: true,
		testTimeout: 10000,
		clearMocks: true,
		restoreMocks: true,
		mockReset: true
	}
});
