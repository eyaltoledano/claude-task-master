/**
 * Base tsup configuration for Task Master monorepo
 * Provides shared configuration that can be extended by individual packages
 */
import type { Options } from 'tsup';

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

/**
 * Environment helpers
 */
export const env = {
	isProduction,
	isDevelopment,
	NODE_ENV: process.env.NODE_ENV || 'development'
};

/**
 * Base tsup configuration for all packages
 * Since everything gets bundled into root dist/ anyway, use consistent settings
 */
export const baseConfig: Partial<Options> = {
	clean: true,
	sourcemap: isDevelopment,
	format: 'esm',
	platform: 'node',
	target: 'node20.0',
	removeNodeProtocol: false,
	replaceNodeEnv: false,
	dts: isDevelopment,
	minify: isProduction,
	treeshake: isProduction,
	// Better debugging in development
	...(isDevelopment && {
		keepNames: true,
		splitting: false // Disable code splitting for better stack traces
	}),
	// Keep npm dependencies external, but bundle absolute Windows source paths.
	external: [/^(?![A-Za-z]:[\\/])[^@./]/, /^@(?!tm\/)/]
};

/**
 * Utility function to merge configurations
 * Simplified for tsup usage
 */
export function mergeConfig(
	base: Partial<Options>,
	overrides: Partial<Options>
): Options {
	return {
		...base,
		...overrides
	} as Options;
}
