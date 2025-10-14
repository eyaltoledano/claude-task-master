import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			include: ['src/**/*.ts'],
			exclude: [
				'node_modules/',
				'dist/',
				'tests/',
				'**/*.test.ts',
				'**/*.spec.ts',
				'**/*.d.ts',
				'**/mocks/**',
				'**/fixtures/**',
				'vitest.config.ts'
			]
		}
	}
});
