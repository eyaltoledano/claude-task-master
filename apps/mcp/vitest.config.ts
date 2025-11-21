import { defineConfig, mergeConfig } from 'vitest/config';
import rootConfig from '../../vitest.config';

/**
 * MCP package Vitest configuration
 * Extends root config with MCP-specific settings
 */
export default mergeConfig(
	rootConfig,
	defineConfig({
		test: {
			// MCP-specific test patterns
			include: [
				'tests/**/*.test.ts',
				'tests/**/*.spec.ts',
				'src/**/*.test.ts',
				'src/**/*.spec.ts'
			]
		}
	})
);
