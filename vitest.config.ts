import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Vitest workspace configuration for Task Master monorepo
 *
 * Convention: .spec.ts = unit tests, .test.ts = integration tests
 */
export default defineConfig({
	test: {
		projects: [
			// Core package
			{
				test: {
					name: 'core:unit',
					root: './packages/tm-core',
					include: ['tests/**/*.spec.ts', 'src/**/*.spec.ts'],
					setupFiles: ['./tests/setup.ts']
				},
				resolve: {
					alias: {
						'@': path.resolve(__dirname, './packages/tm-core/src'),
						'@/types': path.resolve(__dirname, './packages/tm-core/src/types'),
						'@/providers': path.resolve(
							__dirname,
							'./packages/tm-core/src/providers'
						),
						'@/storage': path.resolve(
							__dirname,
							'./packages/tm-core/src/storage'
						),
						'@/parser': path.resolve(
							__dirname,
							'./packages/tm-core/src/parser'
						),
						'@/utils': path.resolve(__dirname, './packages/tm-core/src/utils'),
						'@/errors': path.resolve(__dirname, './packages/tm-core/src/errors')
					}
				}
			},
			{
				test: {
					name: 'core:integration',
					root: './packages/tm-core',
					include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
					setupFiles: ['./tests/setup.ts']
				},
				resolve: {
					alias: {
						'@': path.resolve(__dirname, './packages/tm-core/src'),
						'@/types': path.resolve(__dirname, './packages/tm-core/src/types'),
						'@/providers': path.resolve(
							__dirname,
							'./packages/tm-core/src/providers'
						),
						'@/storage': path.resolve(
							__dirname,
							'./packages/tm-core/src/storage'
						),
						'@/parser': path.resolve(
							__dirname,
							'./packages/tm-core/src/parser'
						),
						'@/utils': path.resolve(__dirname, './packages/tm-core/src/utils'),
						'@/errors': path.resolve(__dirname, './packages/tm-core/src/errors')
					}
				}
			},

			// CLI app
			{
				test: {
					name: 'cli:unit',
					root: './apps/cli',
					include: ['tests/**/*.spec.ts', 'src/**/*.spec.ts']
				}
			},
			{
				test: {
					name: 'cli:integration',
					root: './apps/cli',
					include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
					// Integration tests spawn CLI processes - need longer timeouts
					testTimeout: 30000,
					hookTimeout: 15000
				}
			},

			// MCP app
			{
				test: {
					name: 'mcp:unit',
					root: './apps/mcp',
					include: ['tests/**/*.spec.ts', 'src/**/*.spec.ts']
				}
			},
			{
				test: {
					name: 'mcp:integration',
					root: './apps/mcp',
					include: ['tests/**/*.test.ts', 'src/**/*.test.ts']
				}
			}
		]
	}
});
