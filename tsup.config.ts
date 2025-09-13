import { defineConfig } from 'tsup';
import { baseConfig, mergeConfig } from '@tm/build-config';
import { load as dotenvLoad } from 'dotenv-mono';

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


export default defineConfig(
	mergeConfig(baseConfig, {
		entry: {
			'task-master': 'bin/task-master.js',
			'mcp-server': 'mcp-server/server.js'
		},
		outDir: 'dist',
		publicDir: 'public',
		// Bundle our monorepo packages but keep node_modules external
		noExternal: [/@tm\/.*/],
		// Ensure no code splitting
		splitting: false,
		// Better watch configuration
		ignoreWatch: [
			'dist',
			'node_modules',
			'.git',
			'tests',
			'*.test.*',
			'*.spec.*'
		],
		env: getBuildTimeEnvs()
	})
);
