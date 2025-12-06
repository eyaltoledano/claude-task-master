/**
 * Snowflake connection configuration resolver
 * Handles finding and resolving connection names from various sources following Snowflake CLI's priority order
 */

import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
// @ts-ignore - toml lacks TypeScript declarations
import toml from 'toml';
import type { SnowflakeProviderSettings } from '../types.js';

/**
 * Resolves Snowflake connection configuration from settings, environment variables, and TOML files
 * 
 * Priority order:
 * 1. Explicit settings (programmatic)
 * 2. Environment variables (SNOWFLAKE_CONNECTION_NAME > SNOWFLAKE_CONNECTION > SNOWFLAKE_DEFAULT_CONNECTION_NAME)
 * 3. connections.toml file (takes complete precedence over config.toml if it exists)
 * 4. config.toml file (fallback)
 * 
 * File location priority:
 * 1. $SNOWFLAKE_HOME
 * 2. ~/.snowflake
 * 3. Platform-specific locations (Mac: ~/Library/Application Support/snowflake, Windows: %USERPROFILE%\AppData\Local\snowflake, Linux: ~/.config/snowflake)
 * 
 * @see https://docs.snowflake.com/en/developer-guide/snowflake-cli/connecting/configure-cli
 */
export class SnowflakeConnectionConfig {
	private settings: SnowflakeProviderSettings;

	constructor(settings: SnowflakeProviderSettings = {}) {
		this.settings = settings;
	}

	/**
	 * Get the path to config.toml file if it exists
	 * Checks locations in priority order as per Snowflake CLI documentation
	 * 
	 * @returns Absolute path to config.toml or null if not found
	 */
	public getConfigTomlPath(): string | null {
		const locations = this.getSnowflakeConfigLocations();

		for (const location of locations) {
			const configPath = join(location, 'config.toml');
			if (existsSync(configPath)) {
				return configPath;
			}
		}

		return null;
	}

	/**
	 * Get the connection name based on priority order
	 * 
	 * Priority:
	 * 1. Explicit settings
	 * 2. Environment variables (SNOWFLAKE_CONNECTION_NAME > SNOWFLAKE_CONNECTION > SNOWFLAKE_DEFAULT_CONNECTION_NAME)
	 * 3. connections.toml (takes precedence over config.toml)
	 * 4. config.toml
	 * 
	 * @returns Connection name or null if not found
	 */
	public getConnectionName(): string | null {
		// Check settings first (explicit programmatic setting)
		if (this.settings.connection) {
			return this.settings.connection;
		}

		// Check environment variables (runtime configuration)
		// Support multiple env var names for compatibility
		const envConnection =
            process.env.SNOWFLAKE_CONNECTION_NAME ||
            process.env.SNOWFLAKE_CONNECTION ||
			process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME;
		if (envConnection) {
			// If env var is set, verify it exists in connection files
			const connection = this.findConnectionInFiles(envConnection);
			if (connection) {
				return connection;
			}
			// If not found in files, still use the env var (allows override without file)
			return envConnection;
		}

		// Check for connections.toml first - if it exists, it takes precedence over config.toml
		const connectionsFile = this.getConnectionsTomlPath();
		if (connectionsFile) {
			// connections.toml exists - use ONLY connections from this file
			const connection = this.findDefaultInConnectionsFile(connectionsFile);
			if (connection) {
				return connection;
			}
			// If connections.toml exists but has no default, do NOT fall back to config.toml or any connection
			return null;
		}

		// No connections.toml found - fall back to config.toml
		const configDefault = this.findDefaultInConfigFile();
		if (configDefault) {
			return configDefault;
		}

		return null;
	}

	/**
	 * Get connection settings (credentials, account info, etc.) for a specific connection
	 * 
	 * @param connectionName - The name of the connection to get settings for (optional, uses getConnectionName() if not provided)
	 * @returns Object containing connection settings or null if connection not found
	 */
	public getConnectionSettings(connectionName?: string): Record<string, any> | null {
		const name = connectionName || this.getConnectionName();
		if (!name) {
			return null;
		}

		// Check connections.toml first
		const connectionsFile = this.getConnectionsTomlPath();
		if (connectionsFile) {
			const settings = this.parseConnectionSettings(connectionsFile, name);
			if (settings) {
				return settings;
			}
		}

		// Fall back to config.toml (only if connections.toml doesn't exist)
		if (!connectionsFile) {
			const configFile = this.getConfigTomlPath();
			if (configFile) {
				const settings = this.parseConnectionSettings(configFile, name);
				if (settings) {
					return settings;
				}
			}
		}

		return null;
	}


	/**
	 * Get the path to connections.toml file if it exists
	 * Checks locations in priority order as per Snowflake CLI documentation
	 * 
	 * @returns Absolute path to connections.toml or null if not found
	 */
	public getConnectionsTomlPath(): string | null {
		const locations = this.getSnowflakeConfigLocations();

		for (const location of locations) {
			const connectionsPath = join(location, 'connections.toml');
			if (existsSync(connectionsPath)) {
				return connectionsPath;
			}
		}

		return null;
	}

	/**
	 * Find a specific connection name in connections.toml or config.toml
	 * If connections.toml exists, ONLY check that file (it takes precedence)
	 */
	private findConnectionInFiles(connectionName: string): string | null {
		const locations = this.getSnowflakeConfigLocations();

		// First check if any connections.toml exists
		const connectionsFile = this.getConnectionsTomlPath();
		if (connectionsFile) {
			// connections.toml exists - ONLY check this file
			try {
				const content = readFileSync(connectionsFile, 'utf8');
				const parsed = toml.parse(content) as Record<string, unknown>;

				// Check for connection at top level
				if (parsed[connectionName]) {
					return connectionName;
				}

				// Check in connections section
				if (parsed.connections && typeof parsed.connections === 'object') {
					const connections = parsed.connections as Record<string, unknown>;
					if (connections[connectionName]) {
						return connectionName;
					}
				}
			} catch {
				// File read error or parsing error
			}
			return null;
		}

		// No connections.toml - check config.toml files
		for (const location of locations) {
			try {
				const configPath = join(location, 'config.toml');
				if (existsSync(configPath)) {
					const content = readFileSync(configPath, 'utf8');
					const parsed = toml.parse(content) as Record<string, unknown>;

					// Check in connections section
					if (parsed.connections && typeof parsed.connections === 'object') {
						const connections = parsed.connections as Record<string, unknown>;
						if (connections[connectionName]) {
							return connectionName;
						}
					}
				}
			} catch {
				// Continue to next location
			}
		}

		return null;
	}

	/**
	 * Find default connection in a specific connections.toml file
	 */
	private findDefaultInConnectionsFile(filePath: string): string | null {
		try {
			const content = readFileSync(filePath, 'utf8');
			const parsed = toml.parse(content) as Record<string, unknown>;

			// Check for top-level default_connection_name = "connection_name"
			if (parsed.default_connection_name && typeof parsed.default_connection_name === 'string') {
				return parsed.default_connection_name;
			}

			// Check for [default] section
			if (parsed.default) {
				return 'default';
			}

			// Check for [connections.default] section (less common but possible)
			if (parsed.connections && typeof parsed.connections === 'object') {
				const connections = parsed.connections as Record<string, unknown>;
				if (connections.default) {
					return 'default';
				}
			}
		} catch {
			// File read error or parsing error
		}

		return null;
	}

	/**
	 * Find default connection in config.toml
	 */
	private findDefaultInConfigFile(): string | null {
		const locations = this.getSnowflakeConfigLocations();

		for (const location of locations) {
			try {
				const configPath = join(location, 'config.toml');
				if (!existsSync(configPath)) {
					continue;
				}

				const content = readFileSync(configPath, 'utf8');
				const parsed = toml.parse(content) as Record<string, unknown>;

				// Check for top-level default_connection_name = "connection_name"
				if (parsed.default_connection_name && typeof parsed.default_connection_name === 'string') {
					return parsed.default_connection_name;
				}

				// Check for [connections.default] section
				if (parsed.connections && typeof parsed.connections === 'object') {
					const connections = parsed.connections as Record<string, unknown>;
					if (connections.default) {
						return 'default';
					}
				}
			} catch {
				// Continue to next location
			}
		}

		return null;
	}

	/**
	 * Parse connection settings from a TOML file
	 * 
	 * @param filePath - Path to the TOML file (connections.toml or config.toml)
	 * @param connectionName - Name of the connection to parse
	 * @returns Object containing connection settings or null if not found
	 */
	private parseConnectionSettings(
		filePath: string,
		connectionName: string
	): Record<string, any> | null {
		try {
			const content = readFileSync(filePath, 'utf8');
			const parsed = toml.parse(content) as Record<string, unknown>;

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

			if (connectionConfig && Object.keys(connectionConfig).length > 0) {
				return connectionConfig as Record<string, any>;
			}

			return null;
		} catch {
			// File read error or parsing error
			return null;
		}
	}

	/**
	 * Get all possible Snowflake config directory locations in priority order
	 * Returns directory paths (not full file paths) to check for config.toml and connections.toml
	 * See: https://docs.snowflake.com/en/developer-guide/snowflake-cli/connecting/specify-credentials#location-of-the-toml-configuration-file
	 */
	private getSnowflakeConfigLocations(): string[] {
		const locations: string[] = [];

		// 1. SNOWFLAKE_HOME environment variable
		if (process.env.SNOWFLAKE_HOME) {
			locations.push(process.env.SNOWFLAKE_HOME);
		}

		// 2. ~/.snowflake directory
		locations.push(join(homedir(), '.snowflake'));

		// 3. Platform-specific locations
		const platform = process.platform;

		if (platform === 'darwin') {
			// Mac: ~/Library/Application Support/snowflake/
			locations.push(join(homedir(), 'Library', 'Application Support', 'snowflake'));
		} else if (platform === 'win32') {
			// Windows: %USERPROFILE%\AppData\Local\snowflake\
			locations.push(
				join(process.env.USERPROFILE || homedir(), 'AppData', 'Local', 'snowflake')
			);
		} else {
			// Linux: ~/.config/snowflake/ (respects XDG_CONFIG_HOME)
			const xdgConfigHome =
				process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
			locations.push(join(xdgConfigHome, 'snowflake'));
		}

		return locations;
	}
}

