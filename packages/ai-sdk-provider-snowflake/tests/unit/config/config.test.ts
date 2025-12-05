import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import {
	ENV_VARS,
	getEnvVar,
	getProjectRoot,
	getExecutionMode,
	getEnableMcpServers,
	getDangerouslyAllowAllToolCalls,
	loadUserConfig,
	clearConfigCache,
	isFeatureEnabled,
	getThinkingLevel,
	getResolvedConfig,
	DEFAULT_FEATURES,
	DEFAULT_THINKING,
	DEFAULT_USER_CONFIG
} from '../../../src/config/index.js';

// Mock fs module
jest.mock('fs', () => ({
	existsSync: jest.fn(),
	readFileSync: jest.fn()
}));

const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

describe('Config Module', () => {
	// Store original env vars
	const originalEnv = { ...process.env };

	beforeEach(() => {
		// Clear all test-related env vars before each test
		delete process.env.CORTEX_ACCOUNT;
		delete process.env.SNOWFLAKE_ACCOUNT;
		delete process.env.CORTEX_USER;
		delete process.env.SNOWFLAKE_USER;
		delete process.env.CORTEX_API_KEY;
		delete process.env.SNOWFLAKE_API_KEY;
		delete process.env.CORTEX_BASE_URL;
		delete process.env.SNOWFLAKE_BASE_URL;
		delete process.env.CORTEX_ROLE;
		delete process.env.SNOWFLAKE_ROLE;
		delete process.env.SNOWFLAKE_PASSWORD;
		delete process.env.SNOWFLAKE_PRIVATE_KEY_PATH;
		delete process.env.SNOWFLAKE_PRIVATE_KEY_FILE;
		delete process.env.CORTEX_EXECUTION_MODE;
		delete process.env.SNOWFLAKE_EXECUTION_MODE;
		delete process.env.CORTEX_ENABLE_MCP_SERVERS;
		delete process.env.CORTEX_DANGEROUSLY_ALLOW_ALL_TOOL_CALLS;
		delete process.env.PROJECT_ROOT;
		delete process.env.TASKMASTER_PROJECT_ROOT;
		delete process.env.DEBUG;

		// Reset fs mocks
		mockExistsSync.mockReset();
		mockReadFileSync.mockReset();

		// Clear config cache
		clearConfigCache();
	});

	afterEach(() => {
		// Restore original env vars
		process.env = { ...originalEnv };
	});

	describe('ENV_VARS', () => {
		it('should have account variable names with CORTEX priority', () => {
			expect(ENV_VARS.account).toEqual(['CORTEX_ACCOUNT', 'SNOWFLAKE_ACCOUNT']);
		});

		it('should have user variable names with CORTEX priority', () => {
			expect(ENV_VARS.user).toEqual(['CORTEX_USER', 'SNOWFLAKE_USER']);
		});

		it('should have token variable names with CORTEX priority', () => {
			expect(ENV_VARS.token).toEqual(['CORTEX_API_KEY', 'SNOWFLAKE_API_KEY']);
		});

		it('should have baseURL variable names with CORTEX priority', () => {
			expect(ENV_VARS.baseURL).toEqual([
				'CORTEX_BASE_URL',
				'SNOWFLAKE_BASE_URL'
			]);
		});

		it('should have role variable names with CORTEX priority', () => {
			expect(ENV_VARS.role).toEqual(['CORTEX_ROLE', 'SNOWFLAKE_ROLE']);
		});

		it('should have password variable name', () => {
			expect(ENV_VARS.password).toEqual(['SNOWFLAKE_PASSWORD']);
		});

		it('should have privateKeyPath variable names', () => {
			expect(ENV_VARS.privateKeyPath).toEqual([
				'SNOWFLAKE_PRIVATE_KEY_PATH',
				'SNOWFLAKE_PRIVATE_KEY_FILE'
			]);
		});

		it('should have privateKeyPassphrase with multiple fallbacks', () => {
			expect(ENV_VARS.privateKeyPassphrase).toEqual([
				'SNOWFLAKE_PRIVATE_KEY_PASSPHRASE',
				'SNOWFLAKE_PRIVATE_KEY_FILE_PWD',
				'SNOWSQL_PRIVATE_KEY_PASSPHRASE',
				'PRIVATE_KEY_PASSPHRASE'
			]);
		});

		it('should have warehouse, database, schema variable names', () => {
			expect(ENV_VARS.warehouse).toEqual(['SNOWFLAKE_WAREHOUSE']);
			expect(ENV_VARS.database).toEqual(['SNOWFLAKE_DATABASE']);
			expect(ENV_VARS.schema).toEqual(['SNOWFLAKE_SCHEMA']);
		});

		it('should have authenticator and home variable names', () => {
			expect(ENV_VARS.authenticator).toEqual(['SNOWFLAKE_AUTHENTICATOR']);
			expect(ENV_VARS.home).toEqual(['SNOWFLAKE_HOME']);
		});

		it('should have executionMode variable names', () => {
			expect(ENV_VARS.executionMode).toEqual([
				'CORTEX_EXECUTION_MODE',
				'SNOWFLAKE_EXECUTION_MODE'
			]);
		});

		it('should have enableMcpServers variable name', () => {
			expect(ENV_VARS.enableMcpServers).toEqual(['CORTEX_ENABLE_MCP_SERVERS']);
		});

		it('should have dangerouslyAllowAllToolCalls variable name', () => {
			expect(ENV_VARS.dangerouslyAllowAllToolCalls).toEqual([
				'CORTEX_DANGEROUSLY_ALLOW_ALL_TOOL_CALLS'
			]);
		});
	});

	describe('getEnvVar', () => {
		it('should return undefined when no variables are set', () => {
			expect(getEnvVar(['NONEXISTENT_VAR'])).toBeUndefined();
		});

		it('should return undefined for empty array', () => {
			expect(getEnvVar([])).toBeUndefined();
		});

		it('should return first defined variable', () => {
			process.env.CORTEX_ACCOUNT = 'cortex-account';
			process.env.SNOWFLAKE_ACCOUNT = 'snowflake-account';

			expect(getEnvVar(ENV_VARS.account)).toBe('cortex-account');
		});

		it('should fall back to second variable when first is not set', () => {
			process.env.SNOWFLAKE_ACCOUNT = 'snowflake-account';

			expect(getEnvVar(ENV_VARS.account)).toBe('snowflake-account');
		});

		it('should skip empty string values', () => {
			process.env.CORTEX_ACCOUNT = '';
			process.env.SNOWFLAKE_ACCOUNT = 'snowflake-account';

			expect(getEnvVar(ENV_VARS.account)).toBe('snowflake-account');
		});

		it('should return undefined when all values are empty', () => {
			process.env.CORTEX_ACCOUNT = '';
			process.env.SNOWFLAKE_ACCOUNT = '';

			expect(getEnvVar(ENV_VARS.account)).toBeUndefined();
		});

		it('should work with single variable arrays', () => {
			process.env.SNOWFLAKE_PASSWORD = 'secret';

			expect(getEnvVar(ENV_VARS.password)).toBe('secret');
		});

		it('should work with longer fallback chains', () => {
			// Test the privateKeyPassphrase which has 4 fallbacks
			process.env.PRIVATE_KEY_PASSPHRASE = 'last-fallback';

			expect(getEnvVar(ENV_VARS.privateKeyPassphrase)).toBe('last-fallback');
		});

		it('should return first match even in long chains', () => {
			process.env.SNOWFLAKE_PRIVATE_KEY_PASSPHRASE = 'first';
			process.env.SNOWSQL_PRIVATE_KEY_PASSPHRASE = 'third';
			process.env.PRIVATE_KEY_PASSPHRASE = 'fourth';

			expect(getEnvVar(ENV_VARS.privateKeyPassphrase)).toBe('first');
		});
	});

	describe('getProjectRoot', () => {
		it('should return PROJECT_ROOT when set', () => {
			process.env.PROJECT_ROOT = '/custom/project/root';

			expect(getProjectRoot()).toBe('/custom/project/root');
		});

		it('should fall back to TASKMASTER_PROJECT_ROOT when PROJECT_ROOT not set', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/taskmaster/root';

			expect(getProjectRoot()).toBe('/taskmaster/root');
		});

		it('should prefer PROJECT_ROOT over TASKMASTER_PROJECT_ROOT', () => {
			process.env.PROJECT_ROOT = '/project/root';
			process.env.TASKMASTER_PROJECT_ROOT = '/taskmaster/root';

			expect(getProjectRoot()).toBe('/project/root');
		});

		it('should return current directory when no env vars set and no .taskmaster found', () => {
			// Neither PROJECT_ROOT nor TASKMASTER_PROJECT_ROOT set
			// And no .taskmaster directory exists in parent chain
			const result = getProjectRoot();

			// Should return cwd as fallback
			expect(typeof result).toBe('string');
			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe('getExecutionMode', () => {
		it('should return undefined when no mode is set', () => {
			expect(getExecutionMode()).toBeUndefined();
		});

		it('should return mode from CORTEX_EXECUTION_MODE', () => {
			process.env.CORTEX_EXECUTION_MODE = 'rest';

			expect(getExecutionMode()).toBe('rest');
		});

		it('should return mode from SNOWFLAKE_EXECUTION_MODE', () => {
			process.env.SNOWFLAKE_EXECUTION_MODE = 'cli';

			expect(getExecutionMode()).toBe('cli');
		});

		it('should prefer CORTEX_EXECUTION_MODE over SNOWFLAKE_EXECUTION_MODE', () => {
			process.env.CORTEX_EXECUTION_MODE = 'rest';
			process.env.SNOWFLAKE_EXECUTION_MODE = 'cli';

			expect(getExecutionMode()).toBe('rest');
		});

		it('should normalize mode to lowercase', () => {
			process.env.CORTEX_EXECUTION_MODE = 'REST';

			expect(getExecutionMode()).toBe('rest');
		});

		it('should accept auto mode', () => {
			process.env.CORTEX_EXECUTION_MODE = 'auto';

			expect(getExecutionMode()).toBe('auto');
		});

		it('should return undefined for invalid mode', () => {
			process.env.CORTEX_EXECUTION_MODE = 'invalid-mode';

			// Should warn and return undefined
			expect(getExecutionMode()).toBeUndefined();
		});

		it('should log debug message when DEBUG is set', () => {
			process.env.DEBUG = 'snowflake:config';
			process.env.CORTEX_EXECUTION_MODE = 'rest';

			const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

			expect(getExecutionMode()).toBe('rest');
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('Execution mode from env: rest')
			);

			consoleSpy.mockRestore();
		});
	});

	describe('getEnableMcpServers', () => {
		it('should return true by default', () => {
			expect(getEnableMcpServers()).toBe(true);
		});

		it('should return false when CORTEX_ENABLE_MCP_SERVERS is "false"', () => {
			process.env.CORTEX_ENABLE_MCP_SERVERS = 'false';

			expect(getEnableMcpServers()).toBe(false);
		});

		it('should return false when CORTEX_ENABLE_MCP_SERVERS is "0"', () => {
			process.env.CORTEX_ENABLE_MCP_SERVERS = '0';

			expect(getEnableMcpServers()).toBe(false);
		});

		it('should return true when CORTEX_ENABLE_MCP_SERVERS is "true"', () => {
			process.env.CORTEX_ENABLE_MCP_SERVERS = 'true';

			expect(getEnableMcpServers()).toBe(true);
		});

		it('should return true for any non-false value', () => {
			process.env.CORTEX_ENABLE_MCP_SERVERS = 'yes';

			expect(getEnableMcpServers()).toBe(true);
		});

		it('should log debug message when MCP is disabled and DEBUG is set', () => {
			process.env.DEBUG = 'snowflake:config';
			process.env.CORTEX_ENABLE_MCP_SERVERS = 'false';

			const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

			expect(getEnableMcpServers()).toBe(false);
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('MCP servers disabled from env')
			);

			consoleSpy.mockRestore();
		});
	});

	describe('getDangerouslyAllowAllToolCalls', () => {
		it('should return false by default', () => {
			expect(getDangerouslyAllowAllToolCalls()).toBe(false);
		});

		it('should return true when CORTEX_DANGEROUSLY_ALLOW_ALL_TOOL_CALLS is "true"', () => {
			process.env.CORTEX_DANGEROUSLY_ALLOW_ALL_TOOL_CALLS = 'true';

			expect(getDangerouslyAllowAllToolCalls()).toBe(true);
		});

		it('should return true when CORTEX_DANGEROUSLY_ALLOW_ALL_TOOL_CALLS is "1"', () => {
			process.env.CORTEX_DANGEROUSLY_ALLOW_ALL_TOOL_CALLS = '1';

			expect(getDangerouslyAllowAllToolCalls()).toBe(true);
		});

		it('should return false when CORTEX_DANGEROUSLY_ALLOW_ALL_TOOL_CALLS is "false"', () => {
			process.env.CORTEX_DANGEROUSLY_ALLOW_ALL_TOOL_CALLS = 'false';

			expect(getDangerouslyAllowAllToolCalls()).toBe(false);
		});

		it('should return false for any non-true value', () => {
			process.env.CORTEX_DANGEROUSLY_ALLOW_ALL_TOOL_CALLS = 'yes';

			expect(getDangerouslyAllowAllToolCalls()).toBe(false);
		});

		it('should log debug message when enabled and DEBUG is set', () => {
			process.env.DEBUG = 'snowflake:config';
			process.env.CORTEX_DANGEROUSLY_ALLOW_ALL_TOOL_CALLS = 'true';

			const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

			expect(getDangerouslyAllowAllToolCalls()).toBe(true);
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('dangerouslyAllowAllToolCalls enabled from env')
			);

			consoleSpy.mockRestore();
		});
	});

	describe('DEFAULT_FEATURES', () => {
		it('should have structuredOutputs enabled', () => {
			expect(DEFAULT_FEATURES.structuredOutputs).toBe(true);
		});

		it('should have promptCaching enabled', () => {
			expect(DEFAULT_FEATURES.promptCaching).toBe(true);
		});

		it('should have thinking enabled', () => {
			expect(DEFAULT_FEATURES.thinking).toBe(true);
		});

		it('should have streaming enabled', () => {
			expect(DEFAULT_FEATURES.streaming).toBe(true);
		});
	});

	describe('DEFAULT_THINKING', () => {
		it('should have defaultLevel as medium', () => {
			expect(DEFAULT_THINKING.defaultLevel).toBe('medium');
		});

		it('should have researchLevel as high', () => {
			expect(DEFAULT_THINKING.researchLevel).toBe('high');
		});
	});

	describe('DEFAULT_USER_CONFIG', () => {
		it('should have features object', () => {
			expect(DEFAULT_USER_CONFIG.features).toBeDefined();
		});

		it('should have thinking object', () => {
			expect(DEFAULT_USER_CONFIG.thinking).toBeDefined();
		});
	});

	describe('loadUserConfig', () => {
		it('should return default config when no config file exists', () => {
			const config = loadUserConfig();

			expect(config).toBeDefined();
			expect(config.features).toBeDefined();
			expect(config.thinking).toBeDefined();
		});

		it('should cache config after first load', () => {
			const config1 = loadUserConfig();
			const config2 = loadUserConfig();

			// Should return same reference
			expect(config1).toBe(config2);
		});

		it('should reload config when forceReload is true', () => {
			const config1 = loadUserConfig();
			clearConfigCache();
			const config2 = loadUserConfig(true);

			// Should still return valid config
			expect(config2).toBeDefined();
			expect(config2.features).toBeDefined();
		});
	});

	describe('clearConfigCache', () => {
		it('should clear the cached config', () => {
			// Load config to cache it
			loadUserConfig();

			// Clear cache
			clearConfigCache();

			// Load again - should get fresh config
			const newConfig = loadUserConfig();
			expect(newConfig).toBeDefined();
		});
	});

	describe('isFeatureEnabled', () => {
		it('should return true for structuredOutputs by default', () => {
			expect(isFeatureEnabled('structuredOutputs')).toBe(true);
		});

		it('should return true for promptCaching by default', () => {
			expect(isFeatureEnabled('promptCaching')).toBe(true);
		});

		it('should return true for thinking by default', () => {
			expect(isFeatureEnabled('thinking')).toBe(true);
		});

		it('should return true for streaming by default', () => {
			expect(isFeatureEnabled('streaming')).toBe(true);
		});

		it('should return undefined for unknown features', () => {
			expect(
				isFeatureEnabled('unknownFeature' as keyof typeof DEFAULT_FEATURES)
			).toBeUndefined();
		});

		it('should respect userOverride when true', () => {
			expect(isFeatureEnabled('structuredOutputs', true)).toBe(true);
		});

		it('should respect userOverride when false', () => {
			expect(isFeatureEnabled('structuredOutputs', false)).toBe(false);
		});
	});

	describe('getThinkingLevel', () => {
		it('should return medium for non-research calls', () => {
			expect(getThinkingLevel(false)).toBe('medium');
		});

		it('should return high for research calls', () => {
			expect(getThinkingLevel(true)).toBe('high');
		});

		it('should default to non-research when no argument', () => {
			expect(getThinkingLevel()).toBe('medium');
		});

		it('should use defaults when config has no thinking section', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/fake/project';
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(
				JSON.stringify({
					snowflake: {
						features: { streaming: true }
						// No thinking section
					}
				})
			);
			clearConfigCache();

			expect(getThinkingLevel(false)).toBe('medium');
			expect(getThinkingLevel(true)).toBe('high');
		});

		it('should use defaults when thinking section has explicit null values', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/fake/project';
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(
				JSON.stringify({
					snowflake: {
						thinking: {
							defaultLevel: null,
							researchLevel: null
						}
					}
				})
			);
			clearConfigCache();

			// null values should fall back to defaults via ??
			expect(getThinkingLevel(false)).toBe('medium');
			expect(getThinkingLevel(true)).toBe('high');
		});
	});

	describe('getResolvedConfig', () => {
		it('should return config with all required fields', () => {
			const config = getResolvedConfig();

			expect(config.features).toBeDefined();
			expect(config.thinking).toBeDefined();
			expect(typeof config.features.structuredOutputs).toBe('boolean');
			expect(typeof config.features.promptCaching).toBe('boolean');
			expect(typeof config.features.thinking).toBe('boolean');
			expect(typeof config.features.streaming).toBe('boolean');
		});

		it('should return thinking levels', () => {
			const config = getResolvedConfig();

			expect(config.thinking.defaultLevel).toBeDefined();
			expect(config.thinking.researchLevel).toBeDefined();
		});
	});

	// ============================================================
	// File System Mocked Tests (for branch coverage)
	// ============================================================

	describe('loadUserConfig with file system', () => {
		it('should return defaults when no project root found', () => {
			// No env vars set and no .taskmaster directory
			mockExistsSync.mockReturnValue(false);

			const config = loadUserConfig();

			expect(config).toEqual(DEFAULT_USER_CONFIG);
		});

		it('should return defaults when config file does not exist', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/fake/project';
			// .taskmaster exists but config.json doesn't
			mockExistsSync.mockImplementation((p: unknown) => {
				const pathStr = String(p);
				if (pathStr.includes('.taskmaster') && !pathStr.includes('config.json')) {
					return true;
				}
				return false;
			});

			const config = loadUserConfig();

			expect(config).toEqual(DEFAULT_USER_CONFIG);
		});

		it('should load and merge config from file', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/fake/project';
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(
				JSON.stringify({
					snowflake: {
						features: { streaming: false },
						thinking: { defaultLevel: 'low' }
					}
				})
			);

			const config = loadUserConfig();

			expect(config.features?.streaming).toBe(false);
			expect(config.thinking?.defaultLevel).toBe('low');
			// Defaults should still be merged
			expect(config.features?.structuredOutputs).toBe(true);
		});

		it('should handle config file without snowflake section', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/fake/project';
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(
				JSON.stringify({
					// No snowflake section
					otherSection: { foo: 'bar' }
				})
			);

			const config = loadUserConfig();

			// Should return defaults when snowflake section is missing
			expect(config).toEqual(DEFAULT_USER_CONFIG);
		});

		it('should handle JSON parse errors with DEBUG logging', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/fake/project';
			process.env.DEBUG = 'snowflake:config';
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue('invalid json {{{');

			const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

			const config = loadUserConfig();

			expect(config).toEqual(DEFAULT_USER_CONFIG);
			// logger.debug uses console.log with format: [DEBUG namespace] message error
			expect(consoleSpy).toHaveBeenCalledWith(
				'[DEBUG snowflake:config]',
				'Error loading config:',
				expect.any(Error)
			);

			consoleSpy.mockRestore();
		});
	});

	describe('getExecutionMode with config file', () => {
		it('should read execution mode from config file', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/fake/project';
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(
				JSON.stringify({
					snowflake: { executionMode: 'cli' }
				})
			);

			expect(getExecutionMode()).toBe('cli');
		});

		it('should return undefined when config has no executionMode', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/fake/project';
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(
				JSON.stringify({
					snowflake: {}
				})
			);

			expect(getExecutionMode()).toBeUndefined();
		});

		it('should log debug message when reading from config file', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/fake/project';
			process.env.DEBUG = 'snowflake:config';
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(
				JSON.stringify({
					snowflake: { executionMode: 'rest' }
				})
			);

			const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

			expect(getExecutionMode()).toBe('rest');
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('Execution mode from config.json: rest')
			);

			consoleSpy.mockRestore();
		});

		it('should return undefined when no project root', () => {
			mockExistsSync.mockReturnValue(false);

			expect(getExecutionMode()).toBeUndefined();
		});

		it('should return undefined when config file does not exist', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/fake/project';
			mockExistsSync.mockImplementation((p: unknown) => {
				return !String(p).includes('config.json');
			});

			expect(getExecutionMode()).toBeUndefined();
		});

		it('should handle errors and log with DEBUG', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/fake/project';
			process.env.DEBUG = 'snowflake:config';
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockImplementation(() => {
				throw new Error('Read error');
			});

			const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

			expect(getExecutionMode()).toBeUndefined();
			// logger.debug uses console.log with format: [DEBUG namespace] message error
			expect(consoleSpy).toHaveBeenCalledWith(
				'[DEBUG snowflake:config]',
				'Error reading execution mode from config:',
				expect.any(Error)
			);

			consoleSpy.mockRestore();
		});

		it('should return undefined when config has no snowflake section', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/fake/project';
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(
				JSON.stringify({
					otherSection: {}
				})
			);

			expect(getExecutionMode()).toBeUndefined();
		});
	});

	describe('getEnableMcpServers with config file', () => {
		it('should return true when no project root', () => {
			mockExistsSync.mockReturnValue(false);

			expect(getEnableMcpServers()).toBe(true);
		});

		it('should return true when config file does not exist', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/fake/project';
			mockExistsSync.mockImplementation((p: unknown) => {
				return !String(p).includes('config.json');
			});

			expect(getEnableMcpServers()).toBe(true);
		});

		it('should return false when config has enableMcpServers: false', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/fake/project';
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(
				JSON.stringify({
					snowflake: { enableMcpServers: false }
				})
			);

			expect(getEnableMcpServers()).toBe(false);
		});

		it('should return true when config has enableMcpServers: true', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/fake/project';
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(
				JSON.stringify({
					snowflake: { enableMcpServers: true }
				})
			);

			expect(getEnableMcpServers()).toBe(true);
		});

		it('should return true when config has no enableMcpServers setting', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/fake/project';
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(
				JSON.stringify({
					snowflake: { executionMode: 'cli' }
				})
			);

			expect(getEnableMcpServers()).toBe(true);
		});

		it('should log debug message when MCP disabled from config', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/fake/project';
			process.env.DEBUG = 'snowflake:config';
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(
				JSON.stringify({
					snowflake: { enableMcpServers: false }
				})
			);

			const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

			expect(getEnableMcpServers()).toBe(false);
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('MCP servers disabled from config.json')
			);

			consoleSpy.mockRestore();
		});

		it('should return true on error', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/fake/project';
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockImplementation(() => {
				throw new Error('Read error');
			});

			expect(getEnableMcpServers()).toBe(true);
		});

		it('should return true when config has no snowflake section', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/fake/project';
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(
				JSON.stringify({
					otherSection: {}
				})
			);

			expect(getEnableMcpServers()).toBe(true);
		});
	});

	describe('getDangerouslyAllowAllToolCalls with config file', () => {
		it('should return false when no project root', () => {
			mockExistsSync.mockReturnValue(false);

			expect(getDangerouslyAllowAllToolCalls()).toBe(false);
		});

		it('should return false when config file does not exist', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/fake/project';
			mockExistsSync.mockImplementation((p: unknown) => {
				return !String(p).includes('config.json');
			});

			expect(getDangerouslyAllowAllToolCalls()).toBe(false);
		});

		it('should return true when config has dangerouslyAllowAllToolCalls: true', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/fake/project';
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(
				JSON.stringify({
					snowflake: { dangerouslyAllowAllToolCalls: true }
				})
			);

			expect(getDangerouslyAllowAllToolCalls()).toBe(true);
		});

		it('should log debug message when enabled from config', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/fake/project';
			process.env.DEBUG = 'snowflake:config';
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(
				JSON.stringify({
					snowflake: { dangerouslyAllowAllToolCalls: true }
				})
			);

			const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

			expect(getDangerouslyAllowAllToolCalls()).toBe(true);
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					'dangerouslyAllowAllToolCalls enabled from config.json'
				)
			);

			consoleSpy.mockRestore();
		});

		it('should return false on error', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/fake/project';
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockImplementation(() => {
				throw new Error('Read error');
			});

			expect(getDangerouslyAllowAllToolCalls()).toBe(false);
		});

		it('should return false when config has no snowflake section', () => {
			process.env.TASKMASTER_PROJECT_ROOT = '/fake/project';
			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(
				JSON.stringify({
					otherSection: {}
				})
			);

			expect(getDangerouslyAllowAllToolCalls()).toBe(false);
		});
	});

	describe('getProjectRoot edge cases', () => {
		it('should return cwd when no env vars and no .taskmaster found', () => {
			mockExistsSync.mockReturnValue(false);

			const result = getProjectRoot();

			expect(result).toBe(process.cwd());
		});

		it('should find .taskmaster directory by walking up from cwd', () => {
			// Simulate finding .taskmaster in a parent directory
			const cwd = process.cwd();
			mockExistsSync.mockImplementation((p: unknown) => {
				const pathStr = String(p);
				// Return true only for the .taskmaster directory in parent
				return pathStr.endsWith('.taskmaster');
			});

			const result = getProjectRoot();

			// Should return the directory containing .taskmaster
			expect(result).toBeTruthy();
			expect(mockExistsSync).toHaveBeenCalled();
		});
	});
});

