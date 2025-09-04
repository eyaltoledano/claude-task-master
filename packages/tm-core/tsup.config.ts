import { defineConfig } from 'tsup';
import { dotenvLoad } from 'dotenv-mono';
dotenvLoad();

// Get all TM_PUBLIC_* env variables for build-time injection
const getBuildTimeEnvs = () => {
	const envs: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (key.startsWith('TM_PUBLIC_')) {
			// Return the actual value, not JSON.stringify'd
			envs[key] = value || '';
		}
	}
	return envs;
};

export default defineConfig({
	entry: {
		index: 'src/index.ts',
		'auth/index': 'src/auth/index.ts',
		'config/index': 'src/config/index.ts',
		'errors/index': 'src/errors/index.ts',
		'interfaces/index': 'src/interfaces/index.ts',
		'logger/index': 'src/logger/index.ts',
		'parser/index': 'src/parser/index.ts',
		'providers/index': 'src/providers/index.ts',
		'services/index': 'src/services/index.ts',
		'storage/index': 'src/storage/index.ts',
		'types/index': 'src/types/index.ts',
		'utils/index': 'src/utils/index.ts'
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
	// Replace process.env.TM_PUBLIC_* with actual values at build time
	env: getBuildTimeEnvs(),
	// Auto-external all dependencies from package.json
	external: [
		// External all node_modules - everything not starting with . or /
		/^[^./]/
	],
	esbuildOptions(options) {
		options.conditions = ['module'];
	}
});
