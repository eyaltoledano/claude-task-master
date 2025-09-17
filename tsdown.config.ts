import { defineConfig } from 'tsdown';
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
			'task-master': 'scripts/dev.js',
			'mcp-server': 'mcp-server/server.js'
		},
		outDir: 'dist',
		copy: ['public'],
		// Bundle only our workspace packages, keep npm dependencies external
		noExternal: [/^@tm\//],
		env: getBuildTimeEnvs()
	})
);
