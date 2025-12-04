/**
 * Snowflake authentication wrapper using snowflake-sdk
 *
 * Supports multiple authentication methods:
 * 1. Direct token (SNOWFLAKE_API_KEY) - backward compatible
 * 2. Key pair authentication with JWT generation
 * 3. Programmatic Access Token (PAT)
 * 4. Connection profiles from ~/.snowflake/connections.toml
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
// @ts-ignore - jsonwebtoken lacks TypeScript declarations
import jwt from 'jsonwebtoken';
import type {
	SnowflakeConnectionConfig,
	SnowflakeProviderSettings,
	AuthResult
} from '../types.js';
import { TokenCache } from './token-cache.js';

/**
 * Load connection configuration from TOML using Snowflake SDK's loader
 * See: https://github.com/snowflakedb/snowflake-connector-nodejs/blob/master/lib/configuration/connection_configuration.js
 */
let loadConnectionConfiguration:
	| ((connectionName?: string) => Promise<Record<string, unknown> | null>)
	| null = null;
let loadConnectionConfigurationInitialized = false;

// Dynamically load the Snowflake SDK's connection configuration loader
async function initLoadConnectionConfiguration() {
	if (loadConnectionConfigurationInitialized) return;
	loadConnectionConfigurationInitialized = true;
	try {
		// Dynamic import of SDK internal module - not in public types
		const modulePath = 'snowflake-sdk/lib/configuration/connection_configuration.js';
		const connConfigModule = await import(/* @vite-ignore */ modulePath);
		loadConnectionConfiguration = connConfigModule.loadConnectionConfiguration;
	} catch {
		// SDK's connection config loader not available, will use fallback
		loadConnectionConfiguration = null;
	}
}

const JWT_LIFETIME_SECONDS = 120;
const JWT_ALGORITHM = 'RS256';

// Token cache instance
const tokenCache = new TokenCache();

/**
 * Environment variable names for Snowflake credentials
 * Supports multiple aliases for compatibility with different tools
 *
 * PRIORITY ORDER (first match wins):
 * 1. CORTEX_* variables (highest priority - for Cortex-specific usage)
 * 2. SNOWFLAKE_* variables (standard Snowflake SDK variables)
 * 3. Legacy/alternative names
 */
const ENV_VARS = {
	// CORTEX_ACCOUNT takes precedence over SNOWFLAKE_ACCOUNT
	account: ['CORTEX_ACCOUNT', 'SNOWFLAKE_ACCOUNT'],
	user: ['CORTEX_USER', 'SNOWFLAKE_USER'],
	password: ['SNOWFLAKE_PASSWORD'],
	privateKeyPath: ['SNOWFLAKE_PRIVATE_KEY_PATH', 'SNOWFLAKE_PRIVATE_KEY_FILE'],
	privateKeyPassphrase: [
		'SNOWFLAKE_PRIVATE_KEY_PASSPHRASE',
		'SNOWFLAKE_PRIVATE_KEY_FILE_PWD',
		'SNOWSQL_PRIVATE_KEY_PASSPHRASE',
		'PRIVATE_KEY_PASSPHRASE'
	],
	// CORTEX_API_KEY takes precedence over SNOWFLAKE_API_KEY (for PAT tokens)
	token: ['CORTEX_API_KEY', 'SNOWFLAKE_API_KEY'],
	baseURL: ['CORTEX_BASE_URL', 'SNOWFLAKE_BASE_URL'],
	warehouse: ['SNOWFLAKE_WAREHOUSE'],
	database: ['SNOWFLAKE_DATABASE'],
	schema: ['SNOWFLAKE_SCHEMA'],
	role: ['CORTEX_ROLE', 'SNOWFLAKE_ROLE'],
	authenticator: ['SNOWFLAKE_AUTHENTICATOR'],
	home: ['SNOWFLAKE_HOME']
};

/**
 * Get the first defined environment variable from a list of possible names
 */
function getEnvVar(names: string[]): string | undefined {
	for (const name of names) {
		const value = process.env[name];
		if (value !== undefined && value !== '') {
			return value;
		}
	}
	return undefined;
}

/**
 * Get connection-specific environment variable override
 * Format: SNOWFLAKE_CONNECTIONS_<NAME>_<PARAM>
 */
function getConnectionEnvOverride(
	connectionName: string,
	param: string
): string | undefined {
	const envName = `SNOWFLAKE_CONNECTIONS_${connectionName.toUpperCase()}_${param.toUpperCase()}`;
	return process.env[envName];
}

/**
 * Normalize TOML config field names to our expected format
 */
function normalizeTomlConfig(
	config: Record<string, unknown>
): SnowflakeConnectionConfig {
	const normalized: SnowflakeConnectionConfig = {
		account: config.account as string
	};

	// Normalize user/username
	normalized.user = (config.user || config.username) as string | undefined;
	normalized.username = normalized.user;

	// Handle private key path variations (TOML uses snake_case)
	normalized.privateKeyPath = (config.privateKeyPath ||
		config.private_key_path ||
		config.privateKeyFile ||
		config.private_key_file) as string | undefined;

	// Handle private key passphrase variations
	normalized.privateKeyPass = (config.privateKeyPass ||
		config.private_key_passphrase ||
		config.privateKeyPassphrase ||
		config.private_key_pass) as string | undefined;

	// Copy other fields
	normalized.password = config.password as string | undefined;
	normalized.token = config.token as string | undefined;
	normalized.warehouse = config.warehouse as string | undefined;
	normalized.database = config.database as string | undefined;
	normalized.schema = config.schema as string | undefined;
	normalized.role = config.role as string | undefined;
	normalized.authenticator =
		config.authenticator as SnowflakeConnectionConfig['authenticator'];
	normalized.host = config.host as string | undefined;

	return normalized;
}

/**
 * Load connection configuration from TOML file using Snowflake SDK's loader
 * Falls back to manual TOML parsing if SDK loader is unavailable
 */
async function loadConnectionFromTomlAsync(
	connectionName: string
): Promise<SnowflakeConnectionConfig | null> {
	// Initialize SDK's loader if not already done
	await initLoadConnectionConfiguration();

	// Try SDK's loader first (handles all the complexity)
	if (loadConnectionConfiguration) {
		try {
			// SDK's loader uses SNOWFLAKE_DEFAULT_CONNECTION_NAME env var or 'default'
			// We need to set it temporarily if a specific connection is requested
			const originalDefault = process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME;
			if (connectionName && connectionName !== 'default') {
				process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME = connectionName;
			}

			const config = await loadConnectionConfiguration();

			// Restore original
			if (originalDefault !== undefined) {
				process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME = originalDefault;
			} else {
				delete process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME;
			}

			if (config) {
				return normalizeTomlConfig(config);
			}
		} catch {
			// SDK loader failed, fall through to manual parsing
		}
	}

	// Fallback: Manual TOML parsing
	return loadConnectionFromTomlSync(connectionName);
}

/**
 * Synchronous fallback for TOML loading (when SDK loader is unavailable)
 */
function loadConnectionFromTomlSync(
	connectionName: string
): SnowflakeConnectionConfig | null {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	let toml: { parse: (content: string) => Record<string, unknown> };
	try {
		toml = require('toml');
	} catch {
		// TOML parser not available
		return null;
	}

	const snowflakeHome =
		getEnvVar(ENV_VARS.home) || path.join(os.homedir(), '.snowflake');

	// Try connections.toml first (preferred), then config.toml
	const tomlFiles = [
		path.join(snowflakeHome, 'connections.toml'),
		path.join(snowflakeHome, 'config.toml')
	];

	for (const tomlPath of tomlFiles) {
		try {
			if (!fs.existsSync(tomlPath)) {
				continue;
			}

			const content = fs.readFileSync(tomlPath, 'utf8');
			const parsed = toml.parse(content);

			// connections.toml uses [connectionName] directly
			// config.toml uses [connections.connectionName]
			let connectionConfig = parsed[connectionName] as
				| Record<string, unknown>
				| undefined;
			if (!connectionConfig && parsed.connections) {
				connectionConfig = (parsed.connections as Record<string, unknown>)[
					connectionName
				] as Record<string, unknown> | undefined;
			}

			if (connectionConfig) {
				return normalizeTomlConfig(connectionConfig);
			}
		} catch {
			// Continue to next file if parsing fails
		}
	}

	return null;
}

/**
 * Load connection configuration from environment variables
 */
function loadConnectionFromEnv(): SnowflakeConnectionConfig | null {
	const account = getEnvVar(ENV_VARS.account);
	if (!account) {
		return null;
	}

	return {
		account,
		user: getEnvVar(ENV_VARS.user),
		username: getEnvVar(ENV_VARS.user),
		password: getEnvVar(ENV_VARS.password),
		token: getEnvVar(ENV_VARS.token),
		privateKeyPath: getEnvVar(ENV_VARS.privateKeyPath),
		privateKeyPass: getEnvVar(ENV_VARS.privateKeyPassphrase),
		warehouse: getEnvVar(ENV_VARS.warehouse),
		database: getEnvVar(ENV_VARS.database),
		schema: getEnvVar(ENV_VARS.schema),
		role: getEnvVar(ENV_VARS.role),
		authenticator: getEnvVar(
			ENV_VARS.authenticator
		) as SnowflakeConnectionConfig['authenticator']
	};
}

/**
 * Resolve connection configuration with proper precedence:
 * 1. Explicit settings
 * 2. Connection-specific env overrides
 * 3. TOML file configuration (via SDK's loader when available)
 * 4. Generic env variables
 */
export async function resolveConnectionConfig(
	settings: SnowflakeProviderSettings = {}
): Promise<SnowflakeConnectionConfig | null> {
	const connectionName = settings.connection || 'default';

	// Start with TOML configuration (uses SDK's loader when available)
	let config = await loadConnectionFromTomlAsync(connectionName);

	// Fall back to env vars if no TOML config
	if (!config) {
		config = loadConnectionFromEnv();
	}

	if (!config) {
		return null;
	}

	// Apply connection-specific env overrides
	const envOverrides = {
		account: getConnectionEnvOverride(connectionName, 'ACCOUNT'),
		user: getConnectionEnvOverride(connectionName, 'USER'),
		password: getConnectionEnvOverride(connectionName, 'PASSWORD'),
		token: getConnectionEnvOverride(connectionName, 'TOKEN'),
		privateKeyPath: getConnectionEnvOverride(
			connectionName,
			'PRIVATE_KEY_PATH'
		),
		privateKeyPass: getConnectionEnvOverride(
			connectionName,
			'PRIVATE_KEY_PASSPHRASE'
		)
	};

	// Merge overrides
	for (const [key, value] of Object.entries(envOverrides)) {
		if (value !== undefined) {
			(config as unknown as Record<string, unknown>)[key] = value;
		}
	}

	// Apply explicit settings (highest priority)
	if (settings.apiKey) {
		config.token = settings.apiKey;
	}

	return config;
}

/**
 * Load private key from file
 */
function loadPrivateKey(privateKeyPath: string, passphrase?: string): string {
	const keyFile = fs.readFileSync(privateKeyPath);

	let privateKeyObject: crypto.KeyObject;

	if (passphrase) {
		privateKeyObject = crypto.createPrivateKey({
			key: keyFile,
			format: 'pem',
			passphrase
		});
	} else {
		privateKeyObject = crypto.createPrivateKey({
			key: keyFile,
			format: 'pem'
		});
	}

	return privateKeyObject.export({
		format: 'pem',
		type: 'pkcs8'
	}) as string;
}

/**
 * Calculate public key fingerprint from private key
 */
function calculatePublicKeyFingerprint(privateKey: string): string {
	const pubKeyObject = crypto.createPublicKey({
		key: privateKey,
		format: 'pem'
	});

	const publicKey = pubKeyObject.export({
		format: 'der',
		type: 'spki'
	});

	const fingerprint = crypto
		.createHash('sha256')
		.update(publicKey)
		.digest('base64');
	return `SHA256:${fingerprint}`;
}

/**
 * Generate JWT token for key pair authentication
 * Based on Snowflake's auth_keypair.js implementation
 */
export function generateJwtToken(
	privateKey: string,
	account: string,
	username: string
): string {
	const publicKeyFingerprint = calculatePublicKeyFingerprint(privateKey);
	const currentTime = Math.floor(Date.now() / 1000);

	const payload = {
		iss: `${account.toUpperCase()}.${username.toUpperCase()}.${publicKeyFingerprint}`,
		sub: `${account.toUpperCase()}.${username.toUpperCase()}`,
		iat: currentTime,
		exp: currentTime + JWT_LIFETIME_SECONDS
	};

	return jwt.sign(payload, privateKey, { algorithm: JWT_ALGORITHM });
}

/**
 * Exchange JWT for OAuth access token
 * Uses Snowflake's OAuth token endpoint
 */
// Default timeout for OAuth token exchange (30 seconds)
const OAUTH_TIMEOUT_MS = 30000;

async function exchangeJwtForToken(
	jwtToken: string,
	accountUrl: string,
	role?: string
): Promise<{ accessToken: string; expiresIn?: number }> {
	const tokenEndpoint = `${accountUrl}/oauth/token`;

	// Build scope
	let scope = '';
	if (role) {
		scope = `session:role:${role}`;
	}

	const formData = new URLSearchParams();
	formData.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
	formData.append('assertion', jwtToken);
	if (scope) {
		formData.append('scope', scope);
	}

	// Create AbortController for timeout
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), OAUTH_TIMEOUT_MS);

	try {
		const response = await fetch(tokenEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json'
			},
			body: formData.toString(),
			signal: controller.signal
		});

		if (!response.ok) {
			const errorBody = await response.text();
			throw new Error(`Token exchange failed (${response.status}): ${errorBody}`);
		}

		const result = (await response.json()) as {
			access_token: string;
			expires_in?: number;
			token_type?: string;
		};

		return {
			accessToken: result.access_token,
			expiresIn: result.expires_in
		};
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			throw new Error(`Token exchange timed out after ${OAUTH_TIMEOUT_MS}ms`);
		}
		throw error;
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * Build account URL from account identifier
 */
function buildAccountUrl(account: string, host?: string): string {
	if (host) {
		// If host is provided, use it directly
		if (host.startsWith('http://') || host.startsWith('https://')) {
			return host.replace(/\/$/, '');
		}
		return `https://${host}`;
	}

	// Handle account format: org-account or org.account
	const cleanAccount = account.replace('.', '-');
	return `https://${cleanAccount}.snowflakecomputing.com`;
}

/**
 * Authenticate and get access token for Snowflake REST API
 */
export async function authenticate(
	settings: SnowflakeProviderSettings = {}
): Promise<AuthResult> {
	// Check for direct API key first (backward compatible)
	const directToken = settings.apiKey || getEnvVar(ENV_VARS.token);
	const directBaseURL = settings.baseURL || getEnvVar(ENV_VARS.baseURL);

	if (directToken && directBaseURL) {
		return {
			accessToken: directToken,
			baseURL: directBaseURL.replace(/\/$/, '')
		};
	}

	// Load connection config (uses SDK's TOML loader when available)
	const config = await resolveConnectionConfig(settings);

	if (!config) {
		throw new Error(
			'No Snowflake connection configuration found. ' +
				'Set CORTEX_API_KEY + CORTEX_ACCOUNT (or SNOWFLAKE_API_KEY + SNOWFLAKE_ACCOUNT), ' +
				'or configure ~/.snowflake/connections.toml'
		);
	}

	const accountUrl = buildAccountUrl(config.account, config.host);
	const username = config.username || config.user;

	// Check token cache (uses Snowflake's JsonCredentialManager for persistent storage)
	const cachedToken = await tokenCache.get(
		config.account,
		username || 'default'
	);
	if (cachedToken) {
		return {
			accessToken: cachedToken.accessToken,
			baseURL: cachedToken.baseURL || accountUrl,
			expiresAt: cachedToken.expiresAt
		};
	}

	// If we have a direct token, use it
	if (config.token) {
		return {
			accessToken: config.token,
			baseURL: accountUrl
		};
	}

	// Key pair authentication
	if (config.privateKeyPath || config.privateKey) {
		if (!username) {
			throw new Error('Username is required for key pair authentication');
		}

		let privateKey: string;
		if (config.privateKey) {
			privateKey = config.privateKey;
		} else if (config.privateKeyPath) {
			privateKey = loadPrivateKey(config.privateKeyPath, config.privateKeyPass);
		} else {
			throw new Error('Private key or private key path is required');
		}

		// Generate JWT
		const jwtToken = generateJwtToken(privateKey, config.account, username);

		// Exchange JWT for access token
		const { accessToken, expiresIn } = await exchangeJwtForToken(
			jwtToken,
			accountUrl,
			config.role
		);

		// Cache the token (uses Snowflake's JsonCredentialManager for persistent storage)
		const expiresAt = expiresIn
			? Date.now() + expiresIn * 1000
			: Date.now() + JWT_LIFETIME_SECONDS * 1000;

		await tokenCache.set(config.account, username, {
			accessToken,
			expiresAt,
			baseURL: accountUrl
		});

		return {
			accessToken,
			baseURL: accountUrl,
			expiresAt
		};
	}

	throw new Error(
		'No valid authentication method found. ' +
			'Provide CORTEX_API_KEY (or SNOWFLAKE_API_KEY), configure key pair authentication, or set up a connection profile.'
	);
}

/**
 * Clear authentication cache
 */
export function clearAuthCache(): void {
	tokenCache.clear();
}

/**
 * Validate that credentials are available for either REST API or CLI
 *
 * This is a convenience function that:
 * 1. Tries to authenticate for REST API
 * 2. If REST fails, checks if Cortex Code CLI is available
 * 3. Throws an error only if neither option is available
 *
 * @param settings - Provider settings
 * @returns Object indicating which execution mode is available
 */
export async function validateCredentials(
	settings: SnowflakeProviderSettings = {}
): Promise<{ rest: boolean; cli: boolean; preferredMode: 'rest' | 'cli' }> {
	// Import here to avoid circular dependency
	const { isCortexCliAvailable } = await import('../cli/language-model.js');

	let restAvailable = false;
	let cliAvailable = false;

	// Try REST authentication
	try {
		await authenticate(settings);
		restAvailable = true;
	} catch {
		// REST auth failed
	}

	// Check CLI availability
	try {
		cliAvailable = await isCortexCliAvailable();
	} catch {
		// CLI not available
	}

	// If neither is available, throw an error
	if (!restAvailable && !cliAvailable) {
		throw new Error(
			'Snowflake authentication not configured. ' +
				'Set CORTEX_API_KEY + CORTEX_ACCOUNT (or SNOWFLAKE_API_KEY + SNOWFLAKE_ACCOUNT), ' +
				'configure key pair authentication, set up ~/.snowflake/connections.toml, or install Cortex Code CLI.'
		);
	}

	return {
		rest: restAvailable,
		cli: cliAvailable,
		preferredMode: restAvailable ? 'rest' : 'cli'
	};
}
