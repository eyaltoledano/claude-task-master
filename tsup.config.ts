import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'path';
import { baseConfig, mergeConfig } from '@tm/build-config';
import { config } from 'dotenv';
import { defineConfig } from 'tsup';

// Load .env file explicitly with absolute path
config({ path: resolve(process.cwd(), '.env') });

// Get all TM_PUBLIC_* env variables for build-time injection
const getBuildTimeEnvs = () => {
	const envs: Record<string, string> = {};

	// Inject package.json version at build time
	try {
		const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
		envs['TM_PUBLIC_VERSION'] = packageJson.version || 'unknown';
	} catch (error) {
		console.warn('Could not read package.json version during build:', error);
		envs['TM_PUBLIC_VERSION'] = 'unknown';
	}

	for (const [key, value] of Object.entries(process.env)) {
		if (key.startsWith('TM_PUBLIC_')) {
			envs[key] = value || '';
		}
	}

	return envs;
};

export default defineConfig((cliOptions) => {
	// Boolean watch filters to code dependencies; also rebuild copied assets.
	// Explicit CLI watch paths retain the user's requested scope.
	if (cliOptions.watch === true) cliOptions.watch = ['.'];

	return mergeConfig(baseConfig, {
		entry: {
			'task-master': 'scripts/dev.js',
			'mcp-server': 'mcp-server/server.js'
		},
		outDir: 'dist',
		outExtension: () => ({ js: '.js' }),
		onSuccess: async () => {
			cpSync(resolve('assets'), resolve('dist/assets'), { recursive: true });
			mkdirSync(resolve('dist/third-party-licenses'), { recursive: true });
			cpSync(
				resolve('src/ai-providers/gemini-cli-sdk/LICENSE'),
				resolve('dist/third-party-licenses/ai-sdk-provider-gemini-cli.LICENSE')
			);
		},
		ignoreWatch: ['node_modules', 'dist', 'tests', 'apps/extension'],
		// Bundle only our workspace packages, keep npm dependencies external
		noExternal: [/^@tm\//],
		env: getBuildTimeEnvs()
	});
});
