import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	target: 'node18',
	splitting: false,
	sourcemap: true,
	clean: true,
	dts: true,
	shims: true,
	esbuildOptions(options) {
		options.platform = 'node';
	}
});
