/**
 * Unit tests for SnowflakeConnectionConfig
 */

import { SnowflakeConnectionConfig } from '../../../src/cli/connection-config.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Mock fs and os modules
jest.mock('fs');
jest.mock('os');
jest.mock('path');

const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
const mockReadFileSync = fs.readFileSync as jest.MockedFunction<
	typeof fs.readFileSync
>;
const mockHomedir = os.homedir as jest.MockedFunction<typeof os.homedir>;
const mockJoin = path.join as jest.MockedFunction<typeof path.join>;

describe('SnowflakeConnectionConfig', () => {
	let originalEnv: NodeJS.ProcessEnv;
	let originalPlatform: NodeJS.Platform;

	beforeEach(() => {
		// Store original environment and platform
		originalEnv = { ...process.env };
		originalPlatform = process.platform;

		// Clean up Snowflake-related environment variables
		delete process.env.SNOWFLAKE_CONNECTION;
		delete process.env.SNOWFLAKE_CONNECTION_NAME;
		delete process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME;
		delete process.env.SNOWFLAKE_HOME;
		delete process.env.XDG_CONFIG_HOME;

		// Reset mocks
		jest.clearAllMocks();

		// Setup default mocks
		mockHomedir.mockReturnValue('/home/testuser');
		mockJoin.mockImplementation((...args) => args.join('/'));

		// Default: no files exist
		mockExistsSync.mockReturnValue(false);
	});

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv;
		Object.defineProperty(process, 'platform', {
			value: originalPlatform,
			writable: true,
		});
	});

	describe('File Path Methods', () => {
		describe('getConnectionsTomlPath', () => {
			it('should return path when connections.toml exists in ~/.snowflake', () => {
				mockExistsSync.mockImplementation((filePath) => {
					return filePath === '/home/testuser/.snowflake/connections.toml';
				});

				const config = new SnowflakeConnectionConfig({});
				expect(config.getConnectionsTomlPath()).toBe(
					'/home/testuser/.snowflake/connections.toml'
				);
			});

			it('should return null when connections.toml does not exist', () => {
				mockExistsSync.mockReturnValue(false);

				const config = new SnowflakeConnectionConfig({});
				expect(config.getConnectionsTomlPath()).toBeNull();
			});

			it('should check SNOWFLAKE_HOME first', () => {
				process.env.SNOWFLAKE_HOME = '/custom/snowflake';

				mockExistsSync.mockImplementation((filePath) => {
					return filePath === '/custom/snowflake/connections.toml';
				});

				const config = new SnowflakeConnectionConfig({});
				expect(config.getConnectionsTomlPath()).toBe(
					'/custom/snowflake/connections.toml'
				);
			});
		});

		describe('getConfigTomlPath', () => {
			it('should return path when config.toml exists in ~/.snowflake', () => {
				mockExistsSync.mockImplementation((filePath) => {
					return filePath === '/home/testuser/.snowflake/config.toml';
				});

				const config = new SnowflakeConnectionConfig({});
				expect(config.getConfigTomlPath()).toBe(
					'/home/testuser/.snowflake/config.toml'
				);
			});

			it('should return null when config.toml does not exist', () => {
				mockExistsSync.mockReturnValue(false);

				const config = new SnowflakeConnectionConfig({});
				expect(config.getConfigTomlPath()).toBeNull();
			});

			it('should check SNOWFLAKE_HOME first', () => {
				process.env.SNOWFLAKE_HOME = '/custom/snowflake';

				mockExistsSync.mockImplementation((filePath) => {
					return filePath === '/custom/snowflake/config.toml';
				});

				const config = new SnowflakeConnectionConfig({});
				expect(config.getConfigTomlPath()).toBe('/custom/snowflake/config.toml');
			});
		});
	});

	describe('Priority 1: Explicit Settings', () => {
		it('should return connection from settings when provided', () => {
			const config = new SnowflakeConnectionConfig({
				connection: 'explicit-connection',
			});

			expect(config.getConnectionName()).toBe('explicit-connection');
		});

		it('should return connection from settings even if env vars are set', () => {
			process.env.SNOWFLAKE_CONNECTION = 'env-connection';
			process.env.SNOWFLAKE_CONNECTION_NAME = 'env-connection-name';

			const config = new SnowflakeConnectionConfig({
				connection: 'explicit-connection',
			});

			expect(config.getConnectionName()).toBe('explicit-connection');
		});
	});

	describe('Priority 2: Environment Variables', () => {
		it('should return SNOWFLAKE_CONNECTION when set', () => {
			process.env.SNOWFLAKE_CONNECTION = 'env-connection';

			const config = new SnowflakeConnectionConfig({});

			expect(config.getConnectionName()).toBe('env-connection');
		});

		it('should return SNOWFLAKE_CONNECTION_NAME when SNOWFLAKE_CONNECTION is not set', () => {
			process.env.SNOWFLAKE_CONNECTION_NAME = 'env-connection-name';

			const config = new SnowflakeConnectionConfig({});

			expect(config.getConnectionName()).toBe('env-connection-name');
		});

		it('should return SNOWFLAKE_DEFAULT_CONNECTION_NAME when others are not set', () => {
			process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME = 'env-default-connection';

			const config = new SnowflakeConnectionConfig({});

			expect(config.getConnectionName()).toBe('env-default-connection');
		});

		it('should prefer SNOWFLAKE_CONNECTION_NAME over SNOWFLAKE_CONNECTION', () => {
			process.env.SNOWFLAKE_CONNECTION_NAME = 'connection-1';
			process.env.SNOWFLAKE_CONNECTION = 'connection-2';
			process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME = 'connection-3';

			const config = new SnowflakeConnectionConfig({});

			expect(config.getConnectionName()).toBe('connection-1');
		});

		it('should verify env connection exists in connections.toml if file exists', () => {
			process.env.SNOWFLAKE_CONNECTION = 'my-connection';

			mockExistsSync.mockImplementation((filePath) => {
				return filePath === '/home/testuser/.snowflake/connections.toml';
			});

			mockReadFileSync.mockReturnValue('[my-connection]\naccount = "test"');

			const config = new SnowflakeConnectionConfig({});

			expect(config.getConnectionName()).toBe('my-connection');
			expect(mockReadFileSync).toHaveBeenCalledWith(
				'/home/testuser/.snowflake/connections.toml',
				'utf8'
			);
		});

		it('should return env connection even if not found in files', () => {
			process.env.SNOWFLAKE_CONNECTION = 'missing-connection';

			mockExistsSync.mockReturnValue(false);

			const config = new SnowflakeConnectionConfig({});

			expect(config.getConnectionName()).toBe('missing-connection');
		});
	});

	describe('Priority 3: connections.toml', () => {
		it('should read default_connection_name from connections.toml', () => {
			mockExistsSync.mockImplementation((filePath) => {
				return filePath === '/home/testuser/.snowflake/connections.toml';
			});

			mockReadFileSync.mockReturnValue(
				'default_connection_name = "my-default-connection"\n[my-default-connection]\naccount = "test"'
			);

			const config = new SnowflakeConnectionConfig({});

			expect(config.getConnectionName()).toBe('my-default-connection');
		});

		it('should handle default_connection_name with single quotes', () => {
			mockExistsSync.mockImplementation((filePath) => {
				return filePath === '/home/testuser/.snowflake/connections.toml';
			});

			mockReadFileSync.mockReturnValue(
				"default_connection_name = 'single-quote-connection'\n[single-quote-connection]\naccount = 'test'"
			);

			const config = new SnowflakeConnectionConfig({});

			expect(config.getConnectionName()).toBe('single-quote-connection');
		});

		it('should handle default_connection_name with whitespace', () => {
			mockExistsSync.mockImplementation((filePath) => {
				return filePath === '/home/testuser/.snowflake/connections.toml';
			});

			mockReadFileSync.mockReturnValue(
				'  default_connection_name  =  "spaced-connection"  \n[spaced-connection]\naccount = "test"'
			);

			const config = new SnowflakeConnectionConfig({});

			expect(config.getConnectionName()).toBe('spaced-connection');
		});

		it('should recognize [default] section in connections.toml', () => {
			mockExistsSync.mockImplementation((filePath) => {
				return filePath === '/home/testuser/.snowflake/connections.toml';
			});

			mockReadFileSync.mockReturnValue('[default]\naccount = "test"\nuser = "testuser"');

			const config = new SnowflakeConnectionConfig({});

			expect(config.getConnectionName()).toBe('default');
		});

		it('should recognize [connections.default] section in connections.toml', () => {
			mockExistsSync.mockImplementation((filePath) => {
				return filePath === '/home/testuser/.snowflake/connections.toml';
			});

			mockReadFileSync.mockReturnValue(
				'[connections.default]\naccount = "test"\nuser = "testuser"'
			);

			const config = new SnowflakeConnectionConfig({});

			expect(config.getConnectionName()).toBe('default');
		});

	it('should return null when no default connection in connections.toml', () => {
		mockExistsSync.mockImplementation((filePath) => {
			return filePath === '/home/testuser/.snowflake/connections.toml';
		});

		mockReadFileSync.mockReturnValue(
			'[my-connection]\naccount = "test"\nuser = "testuser"'
		);

		const config = new SnowflakeConnectionConfig({});

		expect(config.getConnectionName()).toBeNull();
	});

	it('should prefer connections.toml over config.toml when both exist with defaults', () => {
		mockExistsSync.mockImplementation((filePath) => {
			return (
				filePath === '/home/testuser/.snowflake/connections.toml' ||
				filePath === '/home/testuser/.snowflake/config.toml'
			);
		});

		mockReadFileSync.mockImplementation((filePath) => {
			if (filePath === '/home/testuser/.snowflake/connections.toml') {
				return 'default_connection_name = "connections-file-connection"\n[connections-file-connection]\naccount = "test"';
			}
			if (filePath === '/home/testuser/.snowflake/config.toml') {
				return 'default_connection_name = "config-file-connection"\n[connections.config-file-connection]\naccount = "test"';
			}
			return '';
		});

		const config = new SnowflakeConnectionConfig({});

		expect(config.getConnectionName()).toBe('connections-file-connection');
	});

		it('should ignore config.toml connections when connections.toml exists but is empty', () => {
			mockExistsSync.mockImplementation((filePath) => {
				return (
					filePath === '/home/testuser/.snowflake/connections.toml' ||
					filePath === '/home/testuser/.snowflake/config.toml'
				);
			});

			mockReadFileSync.mockImplementation((filePath) => {
				if (filePath === '/home/testuser/.snowflake/connections.toml') {
					return '# Empty connections file';
				}
				if (filePath === '/home/testuser/.snowflake/config.toml') {
					return '[connections.should-not-be-used]\naccount = "test"';
				}
				return '';
			});

			const config = new SnowflakeConnectionConfig({});

			expect(config.getConnectionName()).toBeNull();
		});
	});

	describe('Priority 4: config.toml', () => {
		it('should read default_connection_name from config.toml', () => {
			mockExistsSync.mockImplementation((filePath) => {
				return filePath === '/home/testuser/.snowflake/config.toml';
			});

			mockReadFileSync.mockReturnValue(
				'default_connection_name = "config-default"\n[connections.config-default]\naccount = "test"'
			);

			const config = new SnowflakeConnectionConfig({});

			expect(config.getConnectionName()).toBe('config-default');
		});

		it('should recognize [connections.default] section in config.toml', () => {
			mockExistsSync.mockImplementation((filePath) => {
				return filePath === '/home/testuser/.snowflake/config.toml';
			});

			mockReadFileSync.mockReturnValue(
				'[connections.default]\naccount = "test"\nuser = "testuser"'
			);

			const config = new SnowflakeConnectionConfig({});

			expect(config.getConnectionName()).toBe('default');
		});

	it('should return null when no default in config.toml', () => {
		mockExistsSync.mockImplementation((filePath) => {
			return filePath === '/home/testuser/.snowflake/config.toml';
		});

		mockReadFileSync.mockReturnValue(
			'[connections.any-connection]\naccount = "test"\nuser = "testuser"'
		);

		const config = new SnowflakeConnectionConfig({});

		expect(config.getConnectionName()).toBeNull();
	});
	});

	describe('File Location Priority', () => {
	it('should check SNOWFLAKE_HOME first', () => {
		process.env.SNOWFLAKE_HOME = '/custom/snowflake';

		mockExistsSync.mockImplementation((filePath) => {
			return filePath === '/custom/snowflake/connections.toml';
		});

		mockReadFileSync.mockReturnValue('default_connection_name = "home-env-connection"\n[home-env-connection]\naccount = "test"');

		const config = new SnowflakeConnectionConfig({});

		expect(config.getConnectionName()).toBe('home-env-connection');
		expect(mockExistsSync).toHaveBeenCalledWith('/custom/snowflake/connections.toml');
	});

	it('should check ~/.snowflake second', () => {
		mockExistsSync.mockImplementation((filePath) => {
			return filePath === '/home/testuser/.snowflake/connections.toml';
		});

		mockReadFileSync.mockReturnValue('default_connection_name = "home-dir-connection"\n[home-dir-connection]\naccount = "test"');

		const config = new SnowflakeConnectionConfig({});

		expect(config.getConnectionName()).toBe('home-dir-connection');
	});

	it('should check platform-specific location on macOS', () => {
		Object.defineProperty(process, 'platform', {
			value: 'darwin',
			writable: true,
		});

		mockExistsSync.mockImplementation((filePath) => {
			return (
				filePath ===
				'/home/testuser/Library/Application Support/snowflake/connections.toml'
			);
		});

		mockReadFileSync.mockReturnValue('default_connection_name = "mac-connection"\n[mac-connection]\naccount = "test"');

		const config = new SnowflakeConnectionConfig({});

		expect(config.getConnectionName()).toBe('mac-connection');
	});

	it('should check platform-specific location on Windows', () => {
		Object.defineProperty(process, 'platform', {
			value: 'win32',
			writable: true,
		});
		process.env.USERPROFILE = 'C:\\Users\\testuser';

		mockExistsSync.mockImplementation((filePath) => {
			return (
				filePath ===
				'C:\\Users\\testuser/AppData/Local/snowflake/connections.toml'
			);
		});

		mockReadFileSync.mockReturnValue('default_connection_name = "windows-connection"\n[windows-connection]\naccount = "test"');

		const config = new SnowflakeConnectionConfig({});

		expect(config.getConnectionName()).toBe('windows-connection');
	});

	it('should check platform-specific location on Linux', () => {
		Object.defineProperty(process, 'platform', {
			value: 'linux',
			writable: true,
		});

		mockExistsSync.mockImplementation((filePath) => {
			return filePath === '/home/testuser/.config/snowflake/connections.toml';
		});

		mockReadFileSync.mockReturnValue('default_connection_name = "linux-connection"\n[linux-connection]\naccount = "test"');

			const config = new SnowflakeConnectionConfig({});

			expect(config.getConnectionName()).toBe('linux-connection');
		});

	it('should respect XDG_CONFIG_HOME on Linux', () => {
		Object.defineProperty(process, 'platform', {
			value: 'linux',
			writable: true,
		});
		process.env.XDG_CONFIG_HOME = '/custom/config';

		mockExistsSync.mockImplementation((filePath) => {
			return filePath === '/custom/config/snowflake/connections.toml';
		});

		mockReadFileSync.mockReturnValue('default_connection_name = "xdg-connection"\n[xdg-connection]\naccount = "test"');

		const config = new SnowflakeConnectionConfig({});

		expect(config.getConnectionName()).toBe('xdg-connection');
	});

		it('should check multiple locations in order', () => {
			const callOrder: string[] = [];

			mockExistsSync.mockImplementation((filePath) => {
				callOrder.push(filePath as string);
				// Only the last location has the file
				return filePath === '/home/testuser/.config/snowflake/connections.toml';
			});

			mockReadFileSync.mockReturnValue('[found-connection]\naccount = "test"');

			Object.defineProperty(process, 'platform', {
				value: 'linux',
				writable: true,
			});

			const config = new SnowflakeConnectionConfig({});
			config.getConnectionName();

			// Should check connections.toml in all locations first
			expect(callOrder[0]).toContain('.snowflake/connections.toml');
			expect(callOrder[1]).toContain('.config/snowflake/connections.toml');
		});
	});

	describe('Error Handling', () => {
		it('should handle file read errors gracefully', () => {
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockImplementation(() => {
				throw new Error('Permission denied');
			});

			const config = new SnowflakeConnectionConfig({});

			expect(config.getConnectionName()).toBeNull();
		});

		it('should handle malformed TOML gracefully', () => {
			mockExistsSync.mockImplementation((filePath) => {
				return filePath === '/home/testuser/.snowflake/connections.toml';
			});

			mockReadFileSync.mockReturnValue('invalid toml content {{[[');

			const config = new SnowflakeConnectionConfig({});

			// Should not throw, just return null
			expect(config.getConnectionName()).toBeNull();
		});

		it('should return null when no configuration is found', () => {
			mockExistsSync.mockReturnValue(false);

			const config = new SnowflakeConnectionConfig({});

			expect(config.getConnectionName()).toBeNull();
		});
	});

	describe('Complex Scenarios', () => {
	it('should handle connections with dots in the name', () => {
		mockExistsSync.mockImplementation((filePath) => {
			return filePath === '/home/testuser/.snowflake/connections.toml';
		});

		mockReadFileSync.mockReturnValue(
			'default_connection_name = "my-org-prod"\n[connections.my-org-prod]\naccount = "test"'
		);

		const config = new SnowflakeConnectionConfig({});

		expect(config.getConnectionName()).toBe('my-org-prod');
	});

	it('should return null when multiple connections exist without default', () => {
		mockExistsSync.mockImplementation((filePath) => {
			return filePath === '/home/testuser/.snowflake/connections.toml';
		});

		mockReadFileSync.mockReturnValue(
			'[first-connection]\naccount = "test"\n\n[second-connection]\naccount = "test2"'
		);

		const config = new SnowflakeConnectionConfig({});

		expect(config.getConnectionName()).toBeNull();
	});

		it('should handle comments in TOML files', () => {
			mockExistsSync.mockImplementation((filePath) => {
				return filePath === '/home/testuser/.snowflake/connections.toml';
			});

			mockReadFileSync.mockReturnValue(
				'# This is a comment\ndefault_connection_name = "commented-connection"\n# Another comment\n[commented-connection]\naccount = "test"'
			);

			const config = new SnowflakeConnectionConfig({});

			expect(config.getConnectionName()).toBe('commented-connection');
		});

		it('should handle env var pointing to non-existent connection in connections.toml', () => {
			process.env.SNOWFLAKE_CONNECTION = 'non-existent';

			mockExistsSync.mockImplementation((filePath) => {
				return filePath === '/home/testuser/.snowflake/connections.toml';
			});

			mockReadFileSync.mockReturnValue('[other-connection]\naccount = "test"');

			const config = new SnowflakeConnectionConfig({});

			// Should still return the env var value (allows override)
			expect(config.getConnectionName()).toBe('non-existent');
		});
	});

	describe('getConnectionSettings', () => {
		describe('connections.toml settings', () => {
			it('should parse connection settings from connections.toml', () => {
				mockExistsSync.mockImplementation((filePath) => {
					return filePath === '/home/testuser/.snowflake/connections.toml';
				});

				mockReadFileSync.mockReturnValue(`[my-connection]
account = "test-account"
user = "test-user"
password = "test-password"
warehouse = "test-warehouse"
database = "test-database"
schema = "test-schema"`);

				const config = new SnowflakeConnectionConfig({
					connection: 'my-connection',
				});

				const settings = config.getConnectionSettings();

				expect(settings).toEqual({
					account: 'test-account',
					user: 'test-user',
					password: 'test-password',
					warehouse: 'test-warehouse',
					database: 'test-database',
					schema: 'test-schema',
				});
			});

			it('should handle boolean values', () => {
				mockExistsSync.mockImplementation((filePath) => {
					return filePath === '/home/testuser/.snowflake/connections.toml';
				});

				mockReadFileSync.mockReturnValue(`[my-connection]
account = "test-account"
authenticator = "externalbrowser"
ssl_enabled = true
validate_default_parameters = false`);

				const config = new SnowflakeConnectionConfig({
					connection: 'my-connection',
				});

				const settings = config.getConnectionSettings();

				expect(settings).toEqual({
					account: 'test-account',
					authenticator: 'externalbrowser',
					ssl_enabled: true,
					validate_default_parameters: false,
				});
			});

			it('should handle numeric values', () => {
				mockExistsSync.mockImplementation((filePath) => {
					return filePath === '/home/testuser/.snowflake/connections.toml';
				});

				mockReadFileSync.mockReturnValue(`[my-connection]
account = "test-account"
port = 443
timeout = 30.5`);

				const config = new SnowflakeConnectionConfig({
					connection: 'my-connection',
				});

				const settings = config.getConnectionSettings();

				expect(settings).toEqual({
					account: 'test-account',
					port: 443,
					timeout: 30.5,
				});
			});

			it('should handle single and double quotes', () => {
				mockExistsSync.mockImplementation((filePath) => {
					return filePath === '/home/testuser/.snowflake/connections.toml';
				});

				mockReadFileSync.mockReturnValue(`[my-connection]
account = "test-account"
user = 'test-user'
role = "ACCOUNTADMIN"`);

				const config = new SnowflakeConnectionConfig({
					connection: 'my-connection',
				});

				const settings = config.getConnectionSettings();

				expect(settings).toEqual({
					account: 'test-account',
					user: 'test-user',
					role: 'ACCOUNTADMIN',
				});
			});

			it('should ignore comments and empty lines', () => {
				mockExistsSync.mockImplementation((filePath) => {
					return filePath === '/home/testuser/.snowflake/connections.toml';
				});

				mockReadFileSync.mockReturnValue(`# Production connection
[my-connection]
account = "test-account"
# User credentials
user = "test-user"

# Database settings
database = "test-database"`);

				const config = new SnowflakeConnectionConfig({
					connection: 'my-connection',
				});

				const settings = config.getConnectionSettings();

				expect(settings).toEqual({
					account: 'test-account',
					user: 'test-user',
					database: 'test-database',
				});
			});

			it('should handle [connections.name] format', () => {
				mockExistsSync.mockImplementation((filePath) => {
					return filePath === '/home/testuser/.snowflake/connections.toml';
				});

				mockReadFileSync.mockReturnValue(`[connections.my-connection]
account = "test-account"
user = "test-user"`);

				const config = new SnowflakeConnectionConfig({
					connection: 'my-connection',
				});

				const settings = config.getConnectionSettings();

				expect(settings).toEqual({
					account: 'test-account',
					user: 'test-user',
				});
			});

			it('should stop parsing at next section', () => {
				mockExistsSync.mockImplementation((filePath) => {
					return filePath === '/home/testuser/.snowflake/connections.toml';
				});

				mockReadFileSync.mockReturnValue(`[my-connection]
account = "test-account"
user = "test-user"

[other-connection]
account = "other-account"
user = "other-user"`);

				const config = new SnowflakeConnectionConfig({
					connection: 'my-connection',
				});

				const settings = config.getConnectionSettings();

				expect(settings).toEqual({
					account: 'test-account',
					user: 'test-user',
				});
			});
		});

		describe('config.toml settings', () => {
			it('should parse connection settings from config.toml when connections.toml does not exist', () => {
				mockExistsSync.mockImplementation((filePath) => {
					return filePath === '/home/testuser/.snowflake/config.toml';
				});

				mockReadFileSync.mockReturnValue(`[connections.my-connection]
account = "test-account"
user = "test-user"
database = "test-database"`);

				const config = new SnowflakeConnectionConfig({
					connection: 'my-connection',
				});

				const settings = config.getConnectionSettings();

				expect(settings).toEqual({
					account: 'test-account',
					user: 'test-user',
					database: 'test-database',
				});
			});

			it('should not fall back to config.toml if connections.toml exists', () => {
				mockExistsSync.mockImplementation((filePath) => {
					return (
						filePath === '/home/testuser/.snowflake/connections.toml' ||
						filePath === '/home/testuser/.snowflake/config.toml'
					);
				});

				mockReadFileSync.mockImplementation((filePath) => {
					if (filePath === '/home/testuser/.snowflake/connections.toml') {
						return '[other-connection]\naccount = "other"';
					}
					if (filePath === '/home/testuser/.snowflake/config.toml') {
						return '[connections.my-connection]\naccount = "test-account"';
					}
					return '';
				});

				const config = new SnowflakeConnectionConfig({
					connection: 'my-connection',
				});

				const settings = config.getConnectionSettings();

				expect(settings).toBeNull();
			});
		});

		describe('connection name parameter', () => {
			it('should use provided connection name instead of auto-detection', () => {
				process.env.SNOWFLAKE_CONNECTION_NAME = 'env-connection';

				mockExistsSync.mockImplementation((filePath) => {
					return filePath === '/home/testuser/.snowflake/connections.toml';
				});

				mockReadFileSync.mockReturnValue(`[specific-connection]
account = "specific-account"
user = "specific-user"`);

				const config = new SnowflakeConnectionConfig({});

				const settings = config.getConnectionSettings('specific-connection');

				expect(settings).toEqual({
					account: 'specific-account',
					user: 'specific-user',
				});
			});
		});

		describe('error handling', () => {
			it('should return null when connection not found', () => {
				mockExistsSync.mockImplementation((filePath) => {
					return filePath === '/home/testuser/.snowflake/connections.toml';
				});

				mockReadFileSync.mockReturnValue('[other-connection]\naccount = "other"');

				const config = new SnowflakeConnectionConfig({
					connection: 'my-connection',
				});

				const settings = config.getConnectionSettings();

				expect(settings).toBeNull();
			});

			it('should return null when file cannot be read', () => {
				mockExistsSync.mockReturnValue(true);
				mockReadFileSync.mockImplementation(() => {
					throw new Error('Permission denied');
				});

				const config = new SnowflakeConnectionConfig({
					connection: 'my-connection',
				});

				const settings = config.getConnectionSettings();

				expect(settings).toBeNull();
			});

			it('should return null when no connection name can be determined', () => {
				mockExistsSync.mockReturnValue(false);

				const config = new SnowflakeConnectionConfig({});

				const settings = config.getConnectionSettings();

				expect(settings).toBeNull();
			});

			it('should return null when connection section has no properties', () => {
				mockExistsSync.mockImplementation((filePath) => {
					return filePath === '/home/testuser/.snowflake/connections.toml';
				});

				mockReadFileSync.mockReturnValue(`[my-connection]
# Just comments, no properties`);

				const config = new SnowflakeConnectionConfig({
					connection: 'my-connection',
				});

				const settings = config.getConnectionSettings();

				expect(settings).toBeNull();
			});
		});
	});

});

