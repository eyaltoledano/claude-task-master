import { defineConfig } from 'vite';
import { resolve } from 'path';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default defineConfig({
	build: {
		ssr: true, // Use SSR mode for Node.js
		rollupOptions: {
			// Multiple entry points for different applications
			input: {
				'task-master': resolve(__dirname, 'bin/task-master.js'), // CLI tool
				'task-master-mcp': resolve(__dirname, 'mcp-server/server.js') // MCP server
			},
			// Bundle everything except Node.js built-ins
			external: [
				// Node.js built-in modules
				'fs',
				'fs/promises',
				'path',
				'os',
				'crypto',
				'http',
				'https',
				'net',
				'tls',
				'child_process',
				'util',
				'events',
				'stream',
				'url',
				'querystring',
				'buffer',
				'module',
				'worker_threads',
				'readline',
				'process',
				'assert',
				'zlib',
				'dns',
				'perf_hooks',
				// Optional dependencies that might not be available
				'@anthropic-ai/claude-code'
			],
			output: {
				// Generate separate files for each entry
				dir: 'dist',
				format: 'cjs', // CommonJS for Node.js compatibility
				entryFileNames: '[name].cjs',
				chunkFileNames: 'chunks/[name]-[hash].cjs',
				assetFileNames: 'assets/[name].[ext]'
			},
			plugins: [
				nodeResolve({
					preferBuiltins: true,
					exportConditions: ['node']
				})
			]
		},
		target: 'node18',
		outDir: 'dist',
		minify: false, // Keep readable for debugging
		sourcemap: false
	},
	define: {
		// Define any environment variables if needed
		'process.env.NODE_ENV': '"production"'
	},
	ssr: {
		// Don't externalize any dependencies - bundle them all
		noExternal: true
	}
});
