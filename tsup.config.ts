import { defineConfig } from 'tsup';
import {
	executableConfig,
	mergeConfig,
	commonExternals
} from '@tm/build-config';

export default defineConfig(
	mergeConfig(executableConfig, {
		entry: {
			'task-master': 'bin/task-master.js',
			'mcp-server': 'mcp-server/server.js'
		},
		outDir: 'dist',
		publicDir: 'public',
		// Bundle our monorepo packages but keep node_modules external
		noExternal: [/@tm\/.*/],
		external: commonExternals
	})
);
