import { defineConfig, mergeConfig } from 'vitest/config';
import rootConfig from '../../vitest.config';

/**
 * MCP package Vitest configuration
 * Extends root config with MCP-specific settings
 *
 * Integration tests spawn the CLI / MCP server and routinely take 8–18s.
 * Use the same generous timeout as @tm/cli to avoid flakes under contention.
 */
export default mergeConfig(
	rootConfig,
	defineConfig({
		test: {
			include: [
				'tests/**/*.test.ts',
				'tests/**/*.spec.ts',
				'src/**/*.test.ts',
				'src/**/*.spec.ts'
			],
			testTimeout: 30000,
			hookTimeout: 30000
		}
	})
);
