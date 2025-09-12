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
		format: ['esm'],
		dts: true,
		outDir: 'dist',
		// Replace process.env.TM_PUBLIC_* with actual values at build time
		env: getBuildTimeEnvs()
	})
);