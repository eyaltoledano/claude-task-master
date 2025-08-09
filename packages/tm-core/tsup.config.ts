import { defineConfig } from 'tsup';

export default defineConfig({
	entry: {
		index: 'src/index.ts',
		'types/index': 'src/types/index.ts',
		'providers/index': 'src/providers/index.ts',
		'storage/index': 'src/storage/index.ts',
		'parser/index': 'src/parser/index.ts',
		'utils/index': 'src/utils/index.ts',
		'errors/index': 'src/errors/index.ts'
	},
	format: ['cjs', 'esm'],
	dts: true,
	sourcemap: true,
	clean: true,
	splitting: false,
	treeshake: true,
	minify: false,
	target: 'es2022',
	tsconfig: './tsconfig.json',
	outDir: 'dist',
	external: ['zod'],
	esbuildOptions(options) {
		options.conditions = ['module'];
	}
});
