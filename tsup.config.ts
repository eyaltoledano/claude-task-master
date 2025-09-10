import { defineConfig } from 'tsup';
import { baseConfig, mergeConfig } from '@tm/build-config';

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
		// Better watch configuration
		ignoreWatch: [
			'dist',
			'node_modules',
			'.git',
			'tests',
			'*.test.*',
			'*.spec.*'
		]
	})
);
