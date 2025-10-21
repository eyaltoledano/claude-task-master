import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: [
			'tests/**/*.test.ts',
			'tests/**/*.spec.ts',
			'tests/{unit,integration,e2e}/**/*.{test,spec}.ts',
			'src/**/*.test.ts',
			'src/**/*.spec.ts'
		],
		exclude: ['node_modules', 'dist', '.git', '.cache'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html', 'lcov'],
			exclude: [
				'node_modules/',
				'dist/',
				'tests/',
				'**/*.test.ts',
				'**/*.spec.ts',
				'**/*.d.ts',
				'**/mocks/**',
				'**/fixtures/**',
				'vitest.config.ts',
				'src/index.ts'
			],
			thresholds: {
				branches: 80,
				functions: 80,
				lines: 80,
				statements: 80
			}
		},
		setupFiles: ['./tests/setup.ts'],
		testTimeout: 10000,
		clearMocks: true,
		restoreMocks: true,
		mockReset: true
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
});
