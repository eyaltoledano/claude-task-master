import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
	plugins: [react()],

	// Define the root directory for the web assets
	root: resolve(__dirname, 'web/src'),

	// Base URL for assets in production
	base: '/',

	// Build configuration
	build: {
		// Output directory relative to project root
		outDir: resolve(__dirname, 'web/dist'),

		// Empty the output directory before building
		emptyOutDir: true,

		// Generate source maps for debugging
		sourcemap: process.env.NODE_ENV === 'development',

		// Minify in production
		minify: process.env.NODE_ENV === 'production' ? 'esbuild' : false,

		// Rollup options
		rollupOptions: {
			input: {
				main: resolve(__dirname, 'web/src/index.html')
			},

			// Optimize chunk splitting
			output: {
				manualChunks: {
					vendor: ['react', 'react-dom'],
					utils: ['uuid', 'zod']
				}
			}
		},

		// Asset handling
		assetsDir: 'assets',

		// Define for production builds
		define: {
			'process.env.NODE_ENV': JSON.stringify(
				process.env.NODE_ENV || 'production'
			),
			__DEV__: process.env.NODE_ENV === 'development'
		}
	},

	// Development server configuration
	server: {
		host: 'localhost',
		port: 5173,
		strictPort: false,
		open: false,

		// Proxy API requests to the Express server during development
		proxy: {
			'/api': {
				target: 'http://localhost:3001',
				changeOrigin: true,
				secure: false
			},
			'/ws': {
				target: 'ws://localhost:3001',
				ws: true,
				changeOrigin: true
			}
		}
	},

	// Preview server configuration (for built assets)
	preview: {
		host: 'localhost',
		port: 4173,
		strictPort: false,
		open: false
	},

	// CSS configuration
	css: {
		devSourcemap: true,
		modules: {
			localsConvention: 'camelCase'
		}
	},

	// Path resolution
	resolve: {
		alias: {
			'@': resolve(__dirname, 'web/src'),
			'@components': resolve(__dirname, 'web/src/components'),
			'@utils': resolve(__dirname, 'web/src/utils'),
			'@api': resolve(__dirname, 'web/src/api')
		}
	},

	// Environment variables
	envDir: resolve(__dirname, '.'),
	envPrefix: ['VITE_', 'TASKMASTER_'],

	// Optimization
	optimizeDeps: {
		include: ['react', 'react-dom'],
		exclude: ['task-master-ai']
	}
});
