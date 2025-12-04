/**
 * Centralized Test Utilities for Snowflake Provider Tests
 * 
 * This module provides consistent credential checking and CLI availability
 * detection across all unit and integration tests.
 * 
 * IMPORTANT: This is the SINGLE SOURCE OF TRUTH for test skip logic.
 * All test files should import from this module instead of implementing
 * their own credential checks.
 */

import { resolve } from 'path';

/**
 * Comprehensive credential checking that covers all authentication methods:
 * 1. Connection name with connections.toml file
 * 2. Direct API key with base URL or account
 * 3. Key pair authentication (private key path/file)
 * 4. Password authentication
 * 5. Support for both SNOWFLAKE_* and CORTEX_* prefixes
 */
export const hasCredentials = (): boolean => {
	const account = process.env.SNOWFLAKE_ACCOUNT || process.env.CORTEX_ACCOUNT;
	const connectionName = process.env.SNOWFLAKE_CONNECTION_NAME;
	
	// Method 1: Check connections.toml with connection name
	if (connectionName) {
		try {
			const fs = require('fs');
			const homeDir = process.env.HOME || process.env.USERPROFILE || '';
			const connectionsPath = resolve(homeDir, '.snowflake', 'connections.toml');
			if (fs.existsSync(connectionsPath)) {
				const content = fs.readFileSync(connectionsPath, 'utf-8');
				// Check both [connection_name] and [connections.connection_name] formats
				if (content.includes(`[${connectionName}]`) || content.includes(`[connections.${connectionName}]`)) {
					return true;
				}
			}
		} catch {
			// Fall through to other checks if file system access fails
		}
	}
	
	// Method 2: Direct API key authentication
	// Requires API key + either base URL or account
	const apiKey = process.env.SNOWFLAKE_API_KEY || process.env.CORTEX_API_KEY;
	const baseUrl = process.env.SNOWFLAKE_BASE_URL || process.env.CORTEX_BASE_URL;
	if (apiKey && (baseUrl || account)) {
		return true;
	}

	// Method 3 & 4: Key pair or password authentication
	// Requires account + user + (private key OR password)
	const user = process.env.SNOWFLAKE_USER || process.env.CORTEX_USER;
	if (account && user) {
		// Check for key pair auth (supports both path aliases)
		const hasPrivateKey = !!(
			process.env.SNOWFLAKE_PRIVATE_KEY ||
			process.env.SNOWFLAKE_PRIVATE_KEY_PATH ||
			process.env.SNOWFLAKE_PRIVATE_KEY_FILE
		);
		
		// Check for password auth
		const hasPassword = !!process.env.SNOWFLAKE_PASSWORD;
		
		if (hasPrivateKey || hasPassword) {
			return true;
		}
	}
	
	return false;
};

/**
 * Test suite skip helper - use this for describe blocks that need credentials
 * 
 * IMPORTANT: This checks credentials at RUNTIME (when the test suite runs),
 * not at import time. This ensures the .env file is loaded first.
 * 
 * Usage:
 * ```typescript
 * import { skipIfNoCredentials } from '../test-utils';
 * 
 * skipIfNoCredentials('My Integration Tests', () => {
 *   // Tests that require Snowflake credentials
 * });
 * ```
 */
export function skipIfNoCredentials(suiteName: string, testFn: () => void): void {
	// Check credentials at runtime, not import time
	// This ensures .env is loaded by Jest's setupFilesAfterEnv first
	if (hasCredentials()) {
		describe(suiteName, testFn);
	} else {
		describe.skip(suiteName, testFn);
	}
}

/**
 * Check if Cortex CLI is available and functional
 * 
 * This checks for the `cortex` command and validates it can execute
 * by checking its version output.
 */
export const checkCliAvailability = async (): Promise<boolean> => {
	try {
		const { execSync } = await import('child_process');
		const output = execSync('cortex --version', { 
			encoding: 'utf-8', 
			timeout: 5000,
			stdio: ['ignore', 'pipe', 'ignore'] // Suppress stderr
		});
		// Check for version pattern (e.g., "cortex 0.25.1202+193053.088081bf")
		const hasVersion = /cortex\s+\d+\.\d+/.test(output) || /\d+\.\d+\.\d+/.test(output);
		if (hasVersion) {
			console.log(`✅ Cortex CLI detected: ${output.trim().split('\n')[0]}`);
		}
		return hasVersion;
	} catch (error) {
		console.log(`❌ Cortex CLI check failed: ${error instanceof Error ? error.message : String(error)}`);
		return false;
	}
};

/**
 * Get credential information for debugging test skips
 * 
 * Returns a human-readable description of why tests are being skipped
 * or what credentials were detected.
 */
export const getCredentialInfo = (): string => {
	if (!hasCredentials()) {
		return '❌ No valid credentials found. Tests will be skipped.\n' +
			'   Set one of the following:\n' +
			'   1. SNOWFLAKE_CONNECTION_NAME (with ~/.snowflake/connections.toml)\n' +
			'   2. SNOWFLAKE_API_KEY + SNOWFLAKE_BASE_URL\n' +
			'   3. SNOWFLAKE_API_KEY + SNOWFLAKE_ACCOUNT\n' +
			'   4. SNOWFLAKE_ACCOUNT + SNOWFLAKE_USER + SNOWFLAKE_PRIVATE_KEY_PATH\n' +
			'   5. SNOWFLAKE_ACCOUNT + SNOWFLAKE_USER + SNOWFLAKE_PASSWORD';
	}

	const connectionName = process.env.SNOWFLAKE_CONNECTION_NAME;
	if (connectionName) {
		return `✅ Using connection: ${connectionName} from connections.toml`;
	}

	const apiKey = process.env.SNOWFLAKE_API_KEY || process.env.CORTEX_API_KEY;
	if (apiKey) {
		const baseUrl = process.env.SNOWFLAKE_BASE_URL || process.env.CORTEX_BASE_URL;
		const account = process.env.SNOWFLAKE_ACCOUNT || process.env.CORTEX_ACCOUNT;
		if (baseUrl) {
			return `✅ Using API key authentication with base URL: ${baseUrl}`;
		}
		if (account) {
			return `✅ Using API key authentication with account: ${account}`;
		}
	}

	const hasPrivateKey = !!(
		process.env.SNOWFLAKE_PRIVATE_KEY ||
		process.env.SNOWFLAKE_PRIVATE_KEY_PATH ||
		process.env.SNOWFLAKE_PRIVATE_KEY_FILE
	);
	if (hasPrivateKey) {
		return `✅ Using key pair authentication`;
	}

	if (process.env.SNOWFLAKE_PASSWORD) {
		return `✅ Using password authentication`;
	}

	return '⚠️ Credentials detected but method unclear';
};

/**
 * Log test environment information for debugging
 * 
 * Call this in beforeAll to help debug test skip issues
 */
export const logTestEnvironment = (testSuiteName: string): void => {
	console.log(`\n=== ${testSuiteName} ===`);
	console.log(getCredentialInfo());
	
	// Log available environment variables (without values for security)
	const relevantVars = [
		'SNOWFLAKE_ACCOUNT',
		'SNOWFLAKE_API_KEY',
		'SNOWFLAKE_BASE_URL',
		'SNOWFLAKE_USER',
		'SNOWFLAKE_CONNECTION_NAME',
		'SNOWFLAKE_PRIVATE_KEY_PATH',
		'SNOWFLAKE_PRIVATE_KEY_FILE',
		'SNOWFLAKE_PASSWORD',
		'CORTEX_ACCOUNT',
		'CORTEX_API_KEY',
		'CORTEX_BASE_URL',
	];
	
	const setVars = relevantVars.filter(v => !!process.env[v]);
	if (setVars.length > 0) {
		console.log(`Environment variables set: ${setVars.join(', ')}`);
	}
};

