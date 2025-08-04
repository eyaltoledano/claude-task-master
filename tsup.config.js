import { defineConfig } from 'tsup';

export default defineConfig({
	entry: {
		'server': 'mcp-server/server.js',
		'task-master': 'bin/task-master.js'
	},
	format: ['cjs'],
	target: 'node18',
	platform: 'node',
	outDir: 'dist-bundled',
	clean: true,
	bundle: true,
	minify: false,
	sourcemap: false,
	splitting: false,
	shims: true,
	// External dependencies that shouldn't be bundled
	external: [
		// Keep native modules external
		'fsevents',
		'canvas',
		'bufferutil',
		'utf-8-validate',
		// Optional dependencies that may not be installed
		'sury',
		'effect',
		'@valibot/to-json-schema'
	],
	noExternal: [
		// Bundle all dependencies except the ones in external
		/^(?!fsevents|canvas|bufferutil|utf-8-validate|sury|effect|@valibot\/to-json-schema).*/
	],
	// Skip type checking since we're using JavaScript
	skipNodeModulesBundle: false
});