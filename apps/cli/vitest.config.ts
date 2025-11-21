import { defineConfig, mergeConfig } from 'vitest/config';
import rootConfig from '../../vitest.config';

/**
 * CLI package Vitest configuration
 * Extends root config with CLI-specific settings
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
			]
		}
	})
);
