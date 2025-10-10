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
				'src/**/*.test.ts',
				'src/**/*.spec.ts',
				'src/**/*.d.ts'
			]
		}
	}
});
