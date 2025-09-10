/**
 * Base tsup configuration for Task Master monorepo
 * Provides shared configuration that can be extended by individual packages
 */
import type { Options } from 'tsup';

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

/**
 * Base tsup configuration for all packages
 * Since everything gets bundled into root dist/ anyway, use consistent settings
 */
export const baseConfig: Partial<Options> = {
	format: ['esm'],
	target: 'node18',
	sourcemap: isDevelopment,
	clean: true,
	dts: true,
	minify: isProduction,
	treeshake: isProduction,
	// Don't bundle any other dependencies (auto-external all node_modules)
	external: [/^[^./]/],
	esbuildOptions(options) {
		options.platform = 'node';
		// Allow importing TypeScript from JavaScript
		options.resolveExtensions = ['.ts', '.js', '.mjs', '.json'];
		// Better source mapping in development only
		options.sourcesContent = isDevelopment;
		// Keep original names for better debugging in development
		options.keepNames = isDevelopment;
	},
	// Watch mode configuration for development
	watch: isDevelopment ? ['src'] : false
};


/**
 * Legacy external modules list - kept for backwards compatibility
 * Note: When using tsup-node, this is not needed as it automatically
 * excludes dependencies and peerDependencies from package.json
 */
export const commonExternals = [
	// Native Node.js modules (for cases where tsup is used instead of tsup-node)
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
 * Simplified for tsup-node usage
 */
export function mergeConfig(
	baseConfig: Partial<Options>,
	overrides: Partial<Options>
): Options {
	return {
		...baseConfig,
		...overrides,
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
