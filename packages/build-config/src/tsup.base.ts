/**
 * Base tsup configuration for Task Master monorepo
 * Provides shared configuration that can be extended by individual packages
 */
import type { Options } from 'tsup';

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

/**
 * Base configuration for library packages (tm-core, etc.)
 */
export const libraryConfig: Partial<Options> = {
	format: ['cjs', 'esm'],
	target: 'es2022',
	// Sourcemaps only in development to reduce production bundle size
	sourcemap: isDevelopment,
	clean: true,
	dts: true,
	// Enable optimizations in production
	splitting: isProduction,
	treeshake: isProduction,
	minify: isProduction,
	bundle: true,
	esbuildOptions(options) {
		options.conditions = ['module'];
		// Better source mapping in development only
		options.sourcesContent = isDevelopment;
		// Keep original names for better debugging in development
		options.keepNames = isDevelopment;
	},
	// Watch mode configuration for development
	watch: isDevelopment ? ['src'] : false
};

/**
 * Base configuration for CLI packages
 */
export const cliConfig: Partial<Options> = {
	format: ['esm'],
	target: 'node18',
	splitting: false,
	// Sourcemaps only in development to reduce production bundle size
	sourcemap: isDevelopment,
	clean: true,
	dts: true,
	shims: true,
	// Enable minification in production for smaller bundles
	minify: isProduction,
	treeshake: isProduction,
	esbuildOptions(options) {
		options.platform = 'node';
		// Better source mapping in development only
		options.sourcesContent = isDevelopment;
		// Keep original names for better debugging in development
		options.keepNames = isDevelopment;
	}
};

/**
 * Base configuration for executable bundles (root level)
 */
export const executableConfig: Partial<Options> = {
	format: ['esm'],
	target: 'node18',
	splitting: false,
	// Sourcemaps only in development to reduce production bundle size
	sourcemap: isDevelopment,
	clean: true,
	bundle: true, // Bundle everything into one file
	// Minify in production for smaller executables
	minify: isProduction,
	// Handle TypeScript imports transparently
	loader: {
		'.js': 'jsx',
		'.ts': 'ts'
	},
	esbuildOptions(options) {
		options.platform = 'node';
		// Allow importing TypeScript from JavaScript
		options.resolveExtensions = ['.ts', '.js', '.mjs', '.json'];
		// Better source mapping in development only
		options.sourcesContent = isDevelopment;
		// Keep original names for better debugging in development
		options.keepNames = isDevelopment;
	}
};

/**
 * Common external modules that should not be bundled
 */
export const commonExternals = [
	// Native Node.js modules
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
];

/**
 * Utility function to merge configurations
 */
export function mergeConfig(
	baseConfig: Partial<Options>,
	overrides: Partial<Options>
): Options {
	return {
		...baseConfig,
		...overrides,
		// Merge arrays instead of overwriting
		external: [...(baseConfig.external || []), ...(overrides.external || [])],
		// Merge esbuildOptions
		esbuildOptions(options, context) {
			if (baseConfig.esbuildOptions) {
				baseConfig.esbuildOptions(options, context);
			}
			if (overrides.esbuildOptions) {
				overrides.esbuildOptions(options, context);
			}
		}
	} as Options;
}

/**
 * Environment helpers
 */
export const env = {
	isProduction,
	isDevelopment,
	NODE_ENV: process.env.NODE_ENV || 'development'
};
