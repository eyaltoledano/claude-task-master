/**
 * Base tsdown configuration for Task Master monorepo
 * Provides shared configuration that can be extended by individual packages
 */
import type { UserConfig } from 'tsdown';

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
 * Base tsdown configuration for all packages
 * Since everything gets bundled into root dist/ anyway, use consistent settings
 */
export const baseConfig: Partial<UserConfig> = {
	sourcemap: isDevelopment,
	dts: isDevelopment,
	minify: isProduction,
	treeshake: isProduction,
	// Don't bundle any other dependencies (auto-external all node_modules)
	external: [/^[^./]/]
};

/**
 * Utility function to merge configurations
 * Simplified for tsdown usage
 */
export function mergeConfig(
	baseConfig: Partial<UserConfig>,
	overrides: Partial<UserConfig>
): UserConfig {
	return {
		...baseConfig,
		...overrides
	} as UserConfig;
}
