import { defineConfig } from 'tsup';
import { dotenvLoad } from 'dotenv-mono';

// Load .env from root level (monorepo support)
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
		'task-master': 'bin/task-master.js',
		'mcp-server': 'mcp-server/server.js'
	},
	format: ['esm'],
	target: 'node18',
	splitting: false,
	sourcemap: true,
	clean: true,
	bundle: true, // Bundle everything into one file
	outDir: 'dist',
	publicDir: 'public',
	// Handle TypeScript imports transparently
	loader: {
		'.js': 'jsx',
		'.ts': 'ts'
	},
	// Replace process.env.TM_PUBLIC_* with actual values at build time
	env: getBuildTimeEnvs(),
	esbuildOptions(options) {
		options.platform = 'node';
		// Allow importing TypeScript from JavaScript
		options.resolveExtensions = ['.ts', '.js', '.mjs', '.json'];
	},
	// Bundle our monorepo packages but keep node_modules external
	noExternal: [/@tm\/.*/],
	// Don't bundle any other dependencies (auto-external all node_modules)
	// This regex matches anything that doesn't start with . or /
	external: [/^[^./]/],
	// Add success message for debugging
	onSuccess: 'echo "✅ Build completed successfully"'
});
