import { defineConfig } from 'vitest/config';

/**
 * Package-specific Vitest configuration for @tm/profiles
 * Only tests the profile classes, not the command definitions
 */
export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'tests/**/*.test.ts'],
		exclude: ['node_modules', 'dist'],
		coverage: {
			provider: 'v8',
			enabled: true,
			reporter: ['text'],
			// Only measure coverage for profile classes
			exclude: ['node_modules', 'dist', 'src/slash-commands/commands/**'],
			thresholds: {
				branches: 70,
				functions: 80,
				lines: 80,
				statements: 80
			}
		}
	}
});
