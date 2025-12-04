/**
 * Unit tests for Snowflake authentication
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import {
	resolveConnectionConfig,
	generateJwtToken,
	authenticate,
	clearAuthCache
} from '../src/auth/snowflake-auth.js';
import type { SnowflakeConnectionConfig } from '../src/types.js';

// Mock external modules
jest.mock('fs');
jest.mock('toml');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockToml = require('toml') as jest.Mocked<typeof import('toml')>;

describe('SnowflakeAuth', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		// Reset environment variables
		process.env = { ...originalEnv };
		// Clear CORTEX_* and SNOWFLAKE_* variables to ensure clean state
		// CORTEX_* takes precedence over SNOWFLAKE_*, so we must clear both
		delete process.env.CORTEX_ACCOUNT;
		delete process.env.CORTEX_API_KEY;
		delete process.env.CORTEX_USER;
		delete process.env.CORTEX_BASE_URL;
		delete process.env.CORTEX_ROLE;
		delete process.env.SNOWFLAKE_ACCOUNT;
		delete process.env.SNOWFLAKE_API_KEY;
		delete process.env.SNOWFLAKE_USER;
		delete process.env.SNOWFLAKE_BASE_URL;
		delete process.env.SNOWFLAKE_PRIVATE_KEY_PATH;
		delete process.env.SNOWFLAKE_PRIVATE_KEY_FILE;
		delete process.env.SNOWFLAKE_PRIVATE_KEY_PASSPHRASE;
		delete process.env.SNOWFLAKE_ROLE;
		// Clear all mocks
		jest.clearAllMocks();
		// Clear auth cache
		clearAuthCache();
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe('resolveConnectionConfig', () => {
		it('should return null when no configuration is found', async () => {
			mockFs.existsSync.mockReturnValue(false);

			const result = await resolveConnectionConfig();
			expect(result).toBeNull();
		});

		it('should load configuration from environment variables', async () => {
			mockFs.existsSync.mockReturnValue(false);

			process.env.SNOWFLAKE_ACCOUNT = 'test-account';
			process.env.SNOWFLAKE_USER = 'test-user';
			process.env.SNOWFLAKE_PRIVATE_KEY_PATH = '/path/to/key.p8';
			process.env.SNOWFLAKE_PRIVATE_KEY_PASSPHRASE = 'test-passphrase';
			process.env.SNOWFLAKE_ROLE = 'TEST_ROLE';

			const result = await resolveConnectionConfig();

			expect(result).toMatchObject({
				account: 'test-account',
				user: 'test-user',
				username: 'test-user',
				privateKeyPath: '/path/to/key.p8',
				privateKeyPass: 'test-passphrase',
				role: 'TEST_ROLE'
			});
		});

		it('should support SNOWFLAKE_PRIVATE_KEY_FILE alias', async () => {
			mockFs.existsSync.mockReturnValue(false);

			process.env.SNOWFLAKE_ACCOUNT = 'test-account';
			process.env.SNOWFLAKE_USER = 'test-user';
			process.env.SNOWFLAKE_PRIVATE_KEY_FILE = '/path/to/key.p8';

			const result = await resolveConnectionConfig();

			expect(result?.privateKeyPath).toBe('/path/to/key.p8');
		});

		it('should support SNOWSQL_PRIVATE_KEY_PASSPHRASE alias', async () => {
			mockFs.existsSync.mockReturnValue(false);

			process.env.SNOWFLAKE_ACCOUNT = 'test-account';
			process.env.SNOWFLAKE_USER = 'test-user';
			process.env.SNOWSQL_PRIVATE_KEY_PASSPHRASE = 'test-passphrase';

			const result = await resolveConnectionConfig();

			expect(result?.privateKeyPass).toBe('test-passphrase');
		});

		it('should support SNOWFLAKE_PRIVATE_KEY_FILE_PWD alias', async () => {
			mockFs.existsSync.mockReturnValue(false);

			process.env.SNOWFLAKE_ACCOUNT = 'test-account';
			process.env.SNOWFLAKE_USER = 'test-user';
			process.env.SNOWFLAKE_PRIVATE_KEY_FILE_PWD = 'test-passphrase';

			const result = await resolveConnectionConfig();

			expect(result?.privateKeyPass).toBe('test-passphrase');
		});

		it('should give CORTEX_* variables precedence over SNOWFLAKE_* variables', async () => {
			mockFs.existsSync.mockReturnValue(false);

			// Set both CORTEX_* and SNOWFLAKE_* variables
			process.env.CORTEX_ACCOUNT = 'cortex-account';
			process.env.CORTEX_API_KEY = 'cortex-api-key';
			process.env.CORTEX_USER = 'cortex-user';
			process.env.SNOWFLAKE_ACCOUNT = 'snowflake-account';
			process.env.SNOWFLAKE_API_KEY = 'snowflake-api-key';
			process.env.SNOWFLAKE_USER = 'snowflake-user';

			const result = await resolveConnectionConfig();

			// CORTEX_* should take precedence
			expect(result?.account).toBe('cortex-account');
			expect(result?.token).toBe('cortex-api-key');
			expect(result?.user).toBe('cortex-user');
		});

		it('should fall back to SNOWFLAKE_* when CORTEX_* is not set', async () => {
			mockFs.existsSync.mockReturnValue(false);

			// Only set SNOWFLAKE_* variables
			process.env.SNOWFLAKE_ACCOUNT = 'snowflake-account';
			process.env.SNOWFLAKE_API_KEY = 'snowflake-api-key';
			process.env.SNOWFLAKE_USER = 'snowflake-user';

			const result = await resolveConnectionConfig();

			// Should use SNOWFLAKE_* values
			expect(result?.account).toBe('snowflake-account');
			expect(result?.token).toBe('snowflake-api-key');
			expect(result?.user).toBe('snowflake-user');
		});

		it('should load configuration from connections.toml', async () => {
			const tomlContent = {
				default: {
					account: 'toml-account',
					user: 'toml-user',
					private_key_path: '/path/to/key.p8',
					role: 'TOML_ROLE'
				}
			};

			mockFs.existsSync.mockImplementation((p) =>
				(p as string).endsWith('connections.toml')
			);
			mockFs.readFileSync.mockReturnValue('toml content');
			mockToml.parse.mockReturnValue(tomlContent);

			const result = await resolveConnectionConfig();

			expect(result).toMatchObject({
				account: 'toml-account',
				username: 'toml-user',
				privateKeyPath: '/path/to/key.p8',
				role: 'TOML_ROLE'
			});
		});

		it('should load configuration from config.toml with connections section', async () => {
			const tomlContent = {
				connections: {
					default: {
						account: 'config-account',
						user: 'config-user'
					}
				}
			};

			// Only config.toml exists
			mockFs.existsSync.mockImplementation((p) =>
				(p as string).endsWith('config.toml')
			);
			mockFs.readFileSync.mockReturnValue('toml content');
			mockToml.parse.mockReturnValue(tomlContent);

			const result = await resolveConnectionConfig();

			expect(result?.account).toBe('config-account');
			expect(result?.username).toBe('config-user');
		});

		it('should apply connection-specific environment overrides', async () => {
			const tomlContent = {
				myconn: {
					account: 'toml-account',
					user: 'toml-user'
				}
			};

			mockFs.existsSync.mockImplementation((p) =>
				(p as string).endsWith('connections.toml')
			);
			mockFs.readFileSync.mockReturnValue('toml content');
			mockToml.parse.mockReturnValue(tomlContent);

			// Set connection-specific override
			process.env.SNOWFLAKE_CONNECTIONS_MYCONN_USER = 'override-user';

			const result = await resolveConnectionConfig({ connection: 'myconn' });

			expect(result?.account).toBe('toml-account');
			expect(result?.user).toBe('override-user');
		});

		it('should apply explicit apiKey setting', async () => {
			mockFs.existsSync.mockReturnValue(false);
			process.env.SNOWFLAKE_ACCOUNT = 'test-account';

			const result = await resolveConnectionConfig({
				apiKey: 'explicit-api-key'
			});

			expect(result?.token).toBe('explicit-api-key');
		});
	});

	describe('generateJwtToken', () => {
		// Generate a test RSA key pair for testing
		let testPrivateKey: string;
		let testPublicKey: string;

		beforeAll(() => {
			const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
				modulusLength: 2048,
				privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
				publicKeyEncoding: { type: 'spki', format: 'pem' }
			});
			testPrivateKey = privateKey;
			testPublicKey = publicKey;
		});

		it('should generate a valid JWT token', () => {
			const token = generateJwtToken(
				testPrivateKey,
				'test-account',
				'test-user'
			);

			expect(token).toBeDefined();
			expect(typeof token).toBe('string');

			// JWT should have 3 parts separated by dots
			const parts = token.split('.');
			expect(parts.length).toBe(3);
		});

		it('should include correct issuer and subject in JWT', () => {
			const jwt = require('jsonwebtoken');
			const token = generateJwtToken(
				testPrivateKey,
				'test-account',
				'test-user'
			);

			// Decode without verification to check claims
			const decoded = jwt.decode(token) as { iss: string; sub: string };

			expect(decoded.sub).toBe('TEST-ACCOUNT.TEST-USER');
			expect(decoded.iss).toContain('TEST-ACCOUNT.TEST-USER.');
			expect(decoded.iss).toContain('SHA256:');
		});

		it('should set correct expiration time', () => {
			const jwt = require('jsonwebtoken');
			const beforeTime = Math.floor(Date.now() / 1000);

			const token = generateJwtToken(
				testPrivateKey,
				'test-account',
				'test-user'
			);

			const afterTime = Math.floor(Date.now() / 1000);
			const decoded = jwt.decode(token) as { iat: number; exp: number };

			// iat should be around current time
			expect(decoded.iat).toBeGreaterThanOrEqual(beforeTime);
			expect(decoded.iat).toBeLessThanOrEqual(afterTime);

			// exp should be 120 seconds after iat
			expect(decoded.exp - decoded.iat).toBe(120);
		});
	});

	describe('authenticate', () => {
		it('should return direct token when SNOWFLAKE_API_KEY and SNOWFLAKE_BASE_URL are set', async () => {
			process.env.SNOWFLAKE_API_KEY = 'direct-api-key';
			process.env.SNOWFLAKE_BASE_URL = 'https://test.snowflakecomputing.com';
			mockFs.existsSync.mockReturnValue(false);

			const result = await authenticate();

			expect(result.accessToken).toBe('direct-api-key');
			expect(result.baseURL).toBe('https://test.snowflakecomputing.com');
		});

		it('should use explicit apiKey and baseURL settings', async () => {
			mockFs.existsSync.mockReturnValue(false);

			const result = await authenticate({
				apiKey: 'explicit-key',
				baseURL: 'https://explicit.snowflakecomputing.com/'
			});

			expect(result.accessToken).toBe('explicit-key');
			expect(result.baseURL).toBe('https://explicit.snowflakecomputing.com');
		});

		it('should remove trailing slash from baseURL', async () => {
			mockFs.existsSync.mockReturnValue(false);

			const result = await authenticate({
				apiKey: 'key',
				baseURL: 'https://test.snowflakecomputing.com/'
			});

			expect(result.baseURL).toBe('https://test.snowflakecomputing.com');
		});

		it('should throw when no configuration is found', async () => {
			mockFs.existsSync.mockReturnValue(false);
			delete process.env.SNOWFLAKE_ACCOUNT;
			delete process.env.SNOWFLAKE_API_KEY;

			await expect(authenticate()).rejects.toThrow(
				'No Snowflake connection configuration found'
			);
		});

		it('should use token from connection config', async () => {
			const tomlContent = {
				default: {
					account: 'test-account',
					token: 'toml-token'
				}
			};

			mockFs.existsSync.mockImplementation((p) =>
				(p as string).endsWith('connections.toml')
			);
			mockFs.readFileSync.mockReturnValue('toml content');
			mockToml.parse.mockReturnValue(tomlContent);

			const result = await authenticate();

			expect(result.accessToken).toBe('toml-token');
			expect(result.baseURL).toBe(
				'https://test-account.snowflakecomputing.com'
			);
		});

		it('should throw when key pair auth is configured but username is missing', async () => {
			mockFs.existsSync.mockReturnValue(false);
			process.env.SNOWFLAKE_ACCOUNT = 'test-account';
			process.env.SNOWFLAKE_PRIVATE_KEY_PATH = '/path/to/key.p8';
			// No SNOWFLAKE_USER set

			await expect(authenticate()).rejects.toThrow(
				'Username is required for key pair authentication'
			);
		});
	});

	describe('clearAuthCache', () => {
		it('should clear the authentication cache', async () => {
			// Setup direct token auth
			process.env.SNOWFLAKE_API_KEY = 'test-key';
			process.env.SNOWFLAKE_BASE_URL = 'https://test.snowflakecomputing.com';
			mockFs.existsSync.mockReturnValue(false);

			// First call should succeed
			await authenticate();

			// Clear cache
			clearAuthCache();

			// Should not throw
			const result = await authenticate();
			expect(result.accessToken).toBe('test-key');
		});
	});
});
