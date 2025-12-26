import { defineConfig, mergeConfig } from 'vitest/config';
import rootConfig from '../../vitest.config';

/**
 * CLI package Vitest configuration
 * Extends root config with CLI-specific settings
 *
 * Integration tests (.test.ts) spawn CLI processes and need more time.
 * The 30s timeout is reasonable now that auto-update network calls are skipped
 * when TASKMASTER_SKIP_AUTO_UPDATE=1 or NODE_ENV=test.
 */
export default mergeConfig(
	rootConfig,
	defineConfig({
		test: {
			// CLI-specific test patterns
			include: [
				'tests/**/*.test.ts',
				'tests/**/*.spec.ts',
				'src/**/*.test.ts',
				'src/**/*.spec.ts'
			],
			// Integration tests spawn CLI processes - 30s is reasonable with optimized startup
			testTimeout: 30000,
			hookTimeout: 15000
		}
	})
);
