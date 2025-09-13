import { defineConfig } from 'tsup';
import { baseConfig, mergeConfig } from '@tm/build-config';
import { load as dotenvLoad } from 'dotenv-mono';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
		publicDir: 'public',
		// Override the base config's external to bundle our workspace packages
		noExternal: [/^@tm\//],
		external: [/^@supabase\//], // Keep Supabase external to avoid dynamic require issues
		env: getBuildTimeEnvs(),
		esbuildOptions(options) {
			// Set up path aliases for workspace packages
			options.alias = {
				'@tm/core': path.resolve(__dirname, 'packages/tm-core/src/index.ts'),
				'@tm/core/auth': path.resolve(__dirname, 'packages/tm-core/src/auth/index.ts'),
				'@tm/core/storage': path.resolve(__dirname, 'packages/tm-core/src/storage/index.ts'),
				'@tm/core/config': path.resolve(__dirname, 'packages/tm-core/src/config/index.ts'),
				'@tm/core/providers': path.resolve(__dirname, 'packages/tm-core/src/providers/index.ts'),
				'@tm/core/services': path.resolve(__dirname, 'packages/tm-core/src/services/index.ts'),
				'@tm/core/errors': path.resolve(__dirname, 'packages/tm-core/src/errors/index.ts'),
				'@tm/core/logger': path.resolve(__dirname, 'packages/tm-core/src/logger/index.ts'),
				'@tm/core/types': path.resolve(__dirname, 'packages/tm-core/src/types/index.ts'),
				'@tm/core/interfaces': path.resolve(__dirname, 'packages/tm-core/src/interfaces/index.ts'),
				'@tm/core/utils': path.resolve(__dirname, 'packages/tm-core/src/utils/index.ts'),
				'@tm/cli': path.resolve(__dirname, 'apps/cli/src/index.ts'),
				'@tm/cli/commands': path.resolve(__dirname, 'apps/cli/src/commands/index.ts'),
				'@tm/cli/utils': path.resolve(__dirname, 'apps/cli/src/utils/index.ts'),
				'@tm/cli/ui': path.resolve(__dirname, 'apps/cli/src/ui/index.ts'),
				'@tm/build-config': path.resolve(__dirname, 'packages/build-config/src/tsup.base.ts'),
			};
		}
	})
);
