import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	baseVitestConfig,
	defineConfig,
	mergeConfig
} from '@tm/build-config/vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Core package Vitest configuration
 * Extends base config with path aliases for cleaner imports
 */
export default mergeConfig(
	baseVitestConfig,
	defineConfig({
		test: {
			setupFiles: ['./tests/setup.ts']
		},
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
