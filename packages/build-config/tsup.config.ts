import { defineConfig } from 'tsup';

const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig({
	entry: ['src/tsup.base.ts'],
	format: ['esm', 'cjs'],
	target: 'node18',
	// Sourcemaps only in development
	sourcemap: !isProduction,
	clean: true,
	dts: true,
	// Enable minification in production
	minify: isProduction,
	treeshake: isProduction,
	external: ['tsup'],
	esbuildOptions(options) {
		// Better source mapping in development only
		options.sourcesContent = !isProduction;
		// Keep original names for better debugging in development
		options.keepNames = !isProduction;
	}
});
