/**
 * Connection Manager for Cortex Code CLI
 * 
 * This module provides unified management of Snowflake connections,
 * CLI installation detection, and authentication validation.
 * 
 * Combines functionality from:
 * - Connection discovery and validation
 * - CLI installation checking
 * - Authentication validation
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import TOML from '@iarna/toml';
import { getLogger } from '../utils/logger.js';

/**
 * Connection configuration interface
 */
export interface SnowflakeConnection {
	account: string;
	user: string;
	password: string;
	warehouse?: string;
	role?: string;
	database?: string;
	schema?: string;
	host?: string;
}

/**
 * Connections object interface
 */
export interface SnowflakeConnections {
	[name: string]: SnowflakeConnection;
}

/**
 * CLI installation check result
 */
export interface CliCheckResult {
	available: boolean;
	version?: string;
}

/**
 * Validation parameters
 */
export interface ValidationParams {
	/** Optional connection name to validate */
	connection?: string;
	/** Optional API key to validate */
	apiKey?: string;
	/** Whether to skip validation (useful for testing) */
	skipValidation?: boolean;
}

/**
 * Validation result
 */
export interface ValidationResult {
	/** Whether validation passed */
	valid: boolean;
	/** Error message if validation failed */
	error?: string;
	/** CLI availability status */
	cliAvailable?: boolean;
	/** CLI version if detected */
	cliVersion?: string;
	/** Whether a valid connection was found */
	hasConnection?: boolean;
	/** Whether an API key was found */
	hasApiKey?: boolean;
}

// Connection cache
const connectionCache = new Map<
	string,
	{ connection: SnowflakeConnection; timestamp: number }
>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// CLI check cache
let _cliChecked = false;
let _cliAvailable: boolean | null = null;
let _cliVersion: string | null = null;

/**
 * Unified Connection Manager for Cortex Code CLI
 */
export class ConnectionManager {
	private static logger = getLogger({ prefix: 'ConnectionManager' });

	// ==================== Connection Discovery ====================

	/**
	 * Discover Snowflake connections from config files
	 * Checks both connections.toml (preferred) and config.toml
	 * 
	 * @returns Object containing connection configurations, or null if none found
	 */
	static discoverConnections(): SnowflakeConnections | null {
		const snowflakeDir = path.join(os.homedir(), '.snowflake');
		const connectionFiles = [
			path.join(snowflakeDir, 'connections.toml'),
			path.join(snowflakeDir, 'config.toml')
		];

		for (const file of connectionFiles) {
			try {
				if (fs.existsSync(file)) {
					const content = fs.readFileSync(file, 'utf-8');
					const parsed = TOML.parse(content) as any;

					if (parsed.connections && Object.keys(parsed.connections).length > 0) {
						console.debug(
							`Discovered ${Object.keys(parsed.connections).length} connection(s) from ${file}`
						);
						return parsed.connections as SnowflakeConnections;
					}
				}
			} catch (error) {
				console.warn(
					`Failed to parse ${file}: ${error instanceof Error ? error.message : String(error)}`
				);
				continue;
			}
		}

		console.debug('No Snowflake connections found in config files');
		return null;
	}

	/**
	 * Get a specific connection by name, with caching
	 * 
	 * @param connectionName - Name of the connection to retrieve
	 * @returns Connection configuration, or null if not found
	 * @throws Error if connection exists but is invalid
	 */
	static getConnection(connectionName = 'default'): SnowflakeConnection | null {
		// Check cache first
		const cached = connectionCache.get(connectionName);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			console.debug(`Using cached connection: ${connectionName}`);
			return cached.connection;
		}

		// Re-discover connections
		const connections = this.discoverConnections();
		if (!connections || !connections[connectionName]) {
			console.debug(`Connection "${connectionName}" not found`);
			return null;
		}

		// Validate connection
		const connection = connections[connectionName];
		this.validateConnection(connection, connectionName);

		// Cache the validated connection
		connectionCache.set(connectionName, {
			connection,
			timestamp: Date.now()
		});

		console.debug(`Cached connection: ${connectionName}`);
		return connection;
	}

	/**
	 * Get the default connection (tries 'default' then falls back to first available)
	 * 
	 * @returns Connection configuration, or null if none found
	 * @throws Error if connection exists but is invalid
	 */
	static getDefaultConnection(): SnowflakeConnection | null {
		// Try 'default' connection first
		const defaultConn = this.getConnection('default');
		if (defaultConn) {
			return defaultConn;
		}

		// Fall back to first available connection
		const connections = this.discoverConnections();
		if (connections) {
			const firstConnectionName = Object.keys(connections)[0];
			if (firstConnectionName) {
				console.debug(
					`No 'default' connection found, using first available: ${firstConnectionName}`
				);
				return this.getConnection(firstConnectionName);
			}
		}

		return null;
	}

	/**
	 * List all available connection names
	 * 
	 * @returns Array of connection names
	 */
	static listConnections(): string[] {
		const connections = this.discoverConnections();
		if (!connections) {
			return [];
		}
		return Object.keys(connections);
	}

	/**
	 * Validate a Snowflake connection configuration
	 * Ensures all required fields are present
	 * 
	 * @param connection - Connection configuration object
	 * @param connectionName - Name of the connection (for error messages)
	 * @throws Error if required fields are missing
	 * @returns True if validation passes
	 */
	static validateConnection(
		connection: SnowflakeConnection,
		connectionName = 'default'
	): boolean {
		const required: (keyof SnowflakeConnection)[] = [
			'account',
			'user',
			'password'
		];
		const missing = required.filter((field) => !connection[field]);

		if (missing.length > 0) {
			const setupInstructions = `
Missing required fields for connection "${connectionName}": ${missing.join(', ')}

Please configure ~/.snowflake/config.toml with:

[connections.${connectionName}]
account = "YOUR_ACCOUNT"
user = "YOUR_USERNAME"
password = "YOUR_PAT"
warehouse = "YOUR_WAREHOUSE"
role = "YOUR_ROLE"

To generate a PAT (Personal Access Token):
1. Go to your Snowflake account (e.g., <ACCOUNT_NAME>.snowflakecomputing.com)
2. Navigate to Settings > Authentication
3. Generate a new Personal Access Token
4. Use the PAT as the password in your config

For more information, see: https://docs.snowflake.com/en/user-guide/ui-snowsight/cortex-code
		`.trim();

			throw new Error(setupInstructions);
		}

		return true;
	}

	/**
	 * Clear the connection cache
	 * Useful for testing or when connections have been updated
	 */
	static clearConnectionCache(): void {
		connectionCache.clear();
		console.debug('Connection cache cleared');
	}

	// ==================== CLI Installation ====================

	/**
	 * Check if Cortex Code CLI is available in the system
	 * 
	 * @returns Promise resolving to CLI availability and version
	 */
	static async checkCliInstallation(): Promise<CliCheckResult> {
		const startTime = this.logger.startTiming('system', 'checkCliInstallation');
		this.logger.debug('Checking CLI installation');

		return new Promise((resolve) => {
			const child = spawn('cortex', ['--version'], {
				stdio: ['ignore', 'pipe', 'pipe'],
				detached: false
			});

			let stdout = '';

			child.stdout?.on('data', (data) => {
				stdout += data.toString();
			});

			child.on('error', () => {
				this.logger.debug('Cortex Code not found in PATH');
				// Clean up streams
				if (child.stdout) child.stdout.destroy();
				if (child.stderr) child.stderr.destroy();
				child.unref();
				
				this.logger.endTiming(startTime, 'system', 'checkCliInstallation', 'error', {
					error: 'Not found in PATH'
				});
				resolve({ available: false });
			});

			child.on('exit', (code) => {
				// Clean up streams
				if (child.stdout) child.stdout.destroy();
				if (child.stderr) child.stderr.destroy();
				child.unref();
				
				if (code === 0) {
					const versionMatch = stdout.match(/(\d+\.\d+\.\d+)/);
					const version = versionMatch?.[1];
					this.logger.debug('Cortex Code detected', { version });
					
					this.logger.endTiming(startTime, 'system', 'checkCliInstallation', 'success');
					resolve({
						available: true,
						version
					});
				} else {
					this.logger.endTiming(startTime, 'system', 'checkCliInstallation', 'error', {
						error: `Exit code ${code}`
					});
					resolve({ available: false });
				}
			});
		});
	}

	/**
	 * Get setup instructions for Cortex Code CLI
	 * 
	 * @returns Setup instructions
	 */
	static getSetupInstructions(): string {
		return `
Cortex Code CLI Setup Required

1. Install Cortex Code CLI:
   Please see your Snowflake Account Executive to request access to the PrPr of Cortex Code.

2. Set up Snowflake connection:
   - Generate a PAT at your Snowflake account (Settings > Authentication)
   - Create ~/.snowflake/config.toml with:

   [connections.default]
   account = "YOUR_ACCOUNT"
   user = "YOUR_USERNAME"
   password = "YOUR_PAT"
   warehouse = "YOUR_WAREHOUSE"
   role = "YOUR_ROLE"

3. Verify installation:
   cortex --version

For more information: https://docs.snowflake.com/en/user-guide/ui-snowsight/cortex-code
	`.trim();
	}

	// ==================== Validation ====================

	/**
	 * Check if a valid Snowflake connection is available
	 * @private
	 */
	private static hasValidConnection(connectionName?: string): boolean {
		try {
			const name = connectionName || 'default';
			const connection = this.getConnection(name) || this.getDefaultConnection();
			return !!connection;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Validate Cortex Code CLI installation and authentication
	 * 
	 * This function checks:
	 * 1. Whether the Cortex Code CLI is installed
	 * 2. Whether authentication is configured (connection or API key)
	 * 
	 * @param params - Validation parameters
	 * @returns Validation result with detailed status
	 * 
	 * @example
	 * ```typescript
	 * import { ConnectionManager } from '@tm/ai-sdk-provider-cortex-code';
	 * 
	 * const result = await ConnectionManager.validateAuth({
	 *   connection: '<ACCOUNT_NAME>'
	 * });
	 * 
	 * if (!result.valid) {
	 *   console.error(result.error);
	 * }
	 * ```
	 */
	static async validateAuth(
		params: ValidationParams = {}
	): Promise<ValidationResult> {
		// Skip validation if requested (useful for testing)
		if (params.skipValidation || process.env.NODE_ENV === 'test') {
			return { valid: true };
		}

		// Check CLI installation (cached check)
		if (!_cliChecked) {
			try {
				const cliCheck = await this.checkCliInstallation();
				_cliAvailable = cliCheck.available;
				_cliVersion = cliCheck.version || null;
				_cliChecked = true;
			} catch (error) {
				_cliAvailable = false;
				_cliChecked = true;
			}
		}

		// If CLI is not available, return error with setup instructions
		if (!_cliAvailable) {
			return {
				valid: false,
				error:
					'Cortex Code CLI is not installed.\n\n' + this.getSetupInstructions(),
				cliAvailable: false
			};
		}

		// Check for connection or API key
		const hasConnection = this.hasValidConnection(params.connection);
		const hasApiKey = !!(params.apiKey || process.env.CORTEX_API_KEY);

		// At least one authentication method must be available
		if (!hasConnection && !hasApiKey) {
			return {
				valid: false,
				error:
					'Either a Snowflake connection or CORTEX_API_KEY is required.\n\n' +
					this.getSetupInstructions(),
				cliAvailable: true,
				cliVersion: _cliVersion || undefined,
				hasConnection: false,
				hasApiKey: false
			};
		}

		// Validation successful
		return {
			valid: true,
			cliAvailable: true,
			cliVersion: _cliVersion || undefined,
			hasConnection,
			hasApiKey
		};
	}

	/**
	 * Synchronous validation check (uses cached CLI status)
	 * Use this for quick checks after initial async validation
	 * 
	 * @param params - Validation parameters
	 * @returns Validation result
	 * 
	 * @example
	 * ```typescript
	 * // After initial async validation
	 * const quickResult = ConnectionManager.validateAuthSync();
	 * if (!quickResult.valid) {
	 *   console.warn(quickResult.error);
	 * }
	 * ```
	 */
	static validateAuthSync(params: ValidationParams = {}): ValidationResult {
		// Skip validation if requested
		if (params.skipValidation || process.env.NODE_ENV === 'test') {
			return { valid: true };
		}

		// If we haven't checked yet, we can't validate synchronously
		if (!_cliChecked) {
			return {
				valid: false,
				error: 'CLI has not been checked yet. Call validateAuth() first.'
			};
		}

		// Use cached CLI status
		if (!_cliAvailable) {
			return {
				valid: false,
				error:
					'Cortex Code CLI is not installed.\n\n' + this.getSetupInstructions(),
				cliAvailable: false
			};
		}

		// Check authentication
		const hasConnection = this.hasValidConnection(params.connection);
		const hasApiKey = !!(params.apiKey || process.env.CORTEX_API_KEY);

		if (!hasConnection && !hasApiKey) {
			return {
				valid: false,
				error:
					'Either a Snowflake connection or CORTEX_API_KEY is required.\n\n' +
					this.getSetupInstructions(),
				cliAvailable: true,
				cliVersion: _cliVersion || undefined,
				hasConnection: false,
				hasApiKey: false
			};
		}

		return {
			valid: true,
			cliAvailable: true,
			cliVersion: _cliVersion || undefined,
			hasConnection,
			hasApiKey
		};
	}

	/**
	 * Clear the CLI check cache
	 * Useful for testing or when CLI has been updated
	 */
	static clearValidationCache(): void {
		_cliChecked = false;
		_cliAvailable = null;
		_cliVersion = null;
	}
}

