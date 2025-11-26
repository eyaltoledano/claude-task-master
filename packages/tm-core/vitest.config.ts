import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vitest/config';
import rootConfig from '../../vitest.config';

// __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Core package Vitest configuration
 * Extends root config with core-specific settings including:
 * - Path aliases for cleaner imports
 * - Test setup file
 * - Higher coverage thresholds (80%)
 */
export default mergeConfig(
	rootConfig,
	defineConfig({
		test: {
			// Core-specific test patterns
			include: [
				'tests/**/*.test.ts',
				'tests/**/*.spec.ts',
				'tests/{unit,integration,e2e}/**/*.{test,spec}.ts',
				'src/**/*.test.ts',
				'src/**/*.spec.ts'
			],

			// Core-specific setup
			setupFiles: ['./tests/setup.ts'],

			// Higher coverage thresholds for core package
			coverage: {
				thresholds: {
					branches: 80,
					functions: 80,
					lines: 80,
					statements: 80
				}
			}
		},

		// Path aliases for cleaner imports
		resolve: {
			alias: {
				'@': path.resolve(__dirname, './src'),
				'@/types': path.resolve(__dirname, './src/types'),
				'@/providers': path.resolve(__dirname, './src/providers'),
				'@/storage': path.resolve(__dirname, './src/storage'),
				'@/parser': path.resolve(__dirname, './src/parser'),
				'@/utils': path.resolve(__dirname, './src/utils'),
				'@/errors': path.resolve(__dirname, './src/errors')
			}
		}
	})
);
