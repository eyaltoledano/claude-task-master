/**
 * Centralized authentication configuration
 */

import os from 'os';
import path from 'path';
import { AuthConfig } from './types.js';

/**
 * Get the base domain from environment variables
 * Evaluated lazily to allow dotenv to load first
 * Runtime vars (TM_*) take precedence over build-time vars (TM_PUBLIC_*)
 * Build-time: process.env.TM_PUBLIC_BASE_DOMAIN gets replaced by tsdown's env option
 * Runtime: process.env.TM_BASE_DOMAIN can override for staging/development
 * Default: https://tryhamster.com for production
 */
function getBaseDomain(): string {
	return (
		process.env.TM_BASE_DOMAIN || // Runtime override (for staging/tux)
		process.env.TM_PUBLIC_BASE_DOMAIN || // Build-time (baked into compiled code)
		'https://tryhamster.com' // Fallback default
	);
}

/**
 * Get default authentication configuration
 * All URL configuration is derived from the single BASE_DOMAIN
 * Evaluated lazily to allow dotenv to load environment variables first
 */
function getDefaultAuthConfig(): AuthConfig {
	return {
		// Base domain for all services
		baseUrl: getBaseDomain(),

		// Configuration directory and file paths
		configDir: path.join(os.homedir(), '.taskmaster'),
		configFile: path.join(os.homedir(), '.taskmaster', 'auth.json')
	};
}

/**
 * Get merged configuration with optional overrides
 */
export function getAuthConfig(overrides?: Partial<AuthConfig>): AuthConfig {
	return {
		...getDefaultAuthConfig(),
		...overrides
	};
}

/**
 * Default authentication configuration (exported for backward compatibility)
 * Note: This is now a getter property that evaluates lazily
 */
export const DEFAULT_AUTH_CONFIG: AuthConfig = new Proxy({} as AuthConfig, {
	get(_target, prop) {
		return getDefaultAuthConfig()[prop as keyof AuthConfig];
	}
});
