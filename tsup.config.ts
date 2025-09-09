import { defineConfig } from 'tsup';

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
	esbuildOptions(options) {
		options.platform = 'node';
		// Allow importing TypeScript from JavaScript
		options.resolveExtensions = ['.ts', '.js', '.mjs', '.json'];
	},
	// Bundle our monorepo packages but keep node_modules external
	noExternal: [/@tm\/.*/],
	external: [
		// Keep native node modules external
		'fs',
		'path',
		'child_process',
		'crypto',
		'os',
		'url',
		'util',
		'stream',
		'http',
		'https',
		'events',
		'assert',
		'buffer',
		'querystring',
		'readline',
		'zlib',
		'tty',
		'net',
		'dgram',
		'dns',
		'tls',
		'cluster',
		'process',
		'module'
	]
});
