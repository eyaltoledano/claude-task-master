/**
 * Centralized authentication configuration
 */

import os from 'os';
import path from 'path';
import { AuthConfig } from './types';

// Single base domain for all URLs
// Build-time: process.env.TM_PUBLIC_BASE_DOMAIN gets replaced by tsup's env option
// Default: https://tryhamster.com for production
const BASE_DOMAIN =
	process.env.TM_PUBLIC_BASE_DOMAIN || // This gets replaced at build time by tsup
	'https://tryhamster.com';

/**
 * Default authentication configuration
 * All URL configuration is derived from the single BASE_DOMAIN
 */
export const DEFAULT_AUTH_CONFIG: AuthConfig = {
	// Base domain for all services
	baseUrl: BASE_DOMAIN,

	// Configuration directory and file paths
	configDir: path.join(os.homedir(), '.taskmaster'),
	configFile: path.join(os.homedir(), '.taskmaster', 'auth.json')
};

/**
 * Get merged configuration with optional overrides
 */
export function getAuthConfig(overrides?: Partial<AuthConfig>): AuthConfig {
	return {
		...DEFAULT_AUTH_CONFIG,
		...overrides
	};
}
