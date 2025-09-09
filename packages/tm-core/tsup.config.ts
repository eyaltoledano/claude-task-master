import { defineConfig } from 'tsup';

const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig({
	entry: {
		index: 'src/index.ts',
		'auth/index': 'src/auth/index.ts',
		'config/index': 'src/config/index.ts',
		'services/index': 'src/services/index.ts',
		'logger/index': 'src/logger/index.ts',
		'interfaces/index': 'src/interfaces/index.ts',
		'types/index': 'src/types/index.ts',
		'providers/index': 'src/providers/index.ts',
		'storage/index': 'src/storage/index.ts',
		'parser/index': 'src/parser/index.ts',
		'utils/index': 'src/utils/index.ts',
		'errors/index': 'src/errors/index.ts'
	},
	format: ['cjs', 'esm'],
	dts: true,
	// Enhanced sourcemaps for better debugging
	sourcemap: true,
	clean: true,
	// Enable splitting for better tree shaking in production
	splitting: isProduction,
	treeshake: isProduction,
	// Don't minify in development for better debugging
	minify: isProduction,
	target: 'es2022',
	tsconfig: './tsconfig.json',
	outDir: 'dist',
	external: ['zod', '@supabase/supabase-js'],
	esbuildOptions(options) {
		options.conditions = ['module'];
		// Better source mapping
		options.sourcesContent = true;
		// Keep original names for better debugging
		options.keepNames = !isProduction;
	},
	// Watch mode configuration for development
	watch: process.env.NODE_ENV === 'development' ? ['src'] : false,
	// Bundle dependencies in development for easier debugging
	bundle: true
});
