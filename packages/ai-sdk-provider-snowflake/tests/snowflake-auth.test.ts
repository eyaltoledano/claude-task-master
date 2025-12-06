/**
 * Unit tests for Snowflake authentication
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
// @ts-ignore - jsonwebtoken lacks TypeScript declarations
import jwt from 'jsonwebtoken';
import {
	resolveConnectionConfig,
	generateJwtToken,
	authenticate,
	clearAuthCache,
	validateCredentials
} from '../src/auth/snowflake-auth.js';
import type { SnowflakeConnectionConfig } from '../src/types.js';

// Mock the CLI module for validateCredentials
jest.mock('../src/cli/language-model.js', () => ({
	isCortexCliAvailable: jest.fn()
}));

// Get the mock
import { isCortexCliAvailable } from '../src/cli/language-model.js';
const mockIsCortexCliAvailable = isCortexCliAvailable as jest.MockedFunction<typeof isCortexCliAvailable>;

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

	describe('account URL building', () => {
		it('should handle standard account format', async () => {
			mockFs.existsSync.mockReturnValue(false);
			process.env.SNOWFLAKE_ACCOUNT = 'myorg-myaccount';
			process.env.SNOWFLAKE_API_KEY = 'token';

			const result = await authenticate();

			expect(result.baseURL).toBe(
				'https://myorg-myaccount.snowflakecomputing.com'
			);
		});

		it('should handle account with single dot separator', async () => {
			mockFs.existsSync.mockReturnValue(false);
			process.env.SNOWFLAKE_ACCOUNT = 'myorg.myaccount';
			process.env.SNOWFLAKE_API_KEY = 'token';

			const result = await authenticate();

			expect(result.baseURL).toBe(
				'https://myorg-myaccount.snowflakecomputing.com'
			);
		});

		it('should handle account with multiple dot separators', async () => {
			mockFs.existsSync.mockReturnValue(false);
			process.env.SNOWFLAKE_ACCOUNT = 'myorg.region.myaccount';
			process.env.SNOWFLAKE_API_KEY = 'token';

			const result = await authenticate();

			expect(result.baseURL).toBe(
				'https://myorg-region-myaccount.snowflakecomputing.com'
			);
		});

		it('should use explicit base URL over account-derived URL', async () => {
			mockFs.existsSync.mockReturnValue(false);
			process.env.SNOWFLAKE_ACCOUNT = 'myaccount';
			process.env.SNOWFLAKE_API_KEY = 'token';
			process.env.SNOWFLAKE_BASE_URL = 'https://custom.snowflakecomputing.com';

			const result = await authenticate();

			expect(result.baseURL).toBe('https://custom.snowflakecomputing.com');
		});
	});

	describe('environment variable precedence', () => {
		beforeEach(() => {
			mockFs.existsSync.mockReturnValue(false);
		});

		it('should use CORTEX_BASE_URL over SNOWFLAKE_BASE_URL', async () => {
			process.env.CORTEX_ACCOUNT = 'account';
			process.env.CORTEX_API_KEY = 'token';
			process.env.CORTEX_BASE_URL = 'https://cortex.snowflakecomputing.com';
			process.env.SNOWFLAKE_BASE_URL = 'https://snowflake.snowflakecomputing.com';

			const result = await authenticate();

			expect(result.baseURL).toBe('https://cortex.snowflakecomputing.com');
		});

		it('should use CORTEX_ROLE when available', async () => {
			process.env.CORTEX_ACCOUNT = 'account';
			process.env.CORTEX_API_KEY = 'token';
			process.env.CORTEX_BASE_URL = 'https://test.snowflakecomputing.com';
			process.env.CORTEX_ROLE = 'CORTEX_ADMIN';
			process.env.SNOWFLAKE_ROLE = 'SNOWFLAKE_USER';

			const config = await resolveConnectionConfig();

			expect(config?.role).toBe('CORTEX_ADMIN');
		});

		it('should fall back to SNOWFLAKE_ROLE when CORTEX_ROLE not set', async () => {
			process.env.SNOWFLAKE_ACCOUNT = 'account';
			process.env.SNOWFLAKE_API_KEY = 'token';
			process.env.SNOWFLAKE_ROLE = 'SNOWFLAKE_USER';

			const config = await resolveConnectionConfig();

			expect(config?.role).toBe('SNOWFLAKE_USER');
		});
	});

	describe('TOML configuration edge cases', () => {
		it('should handle missing connection in TOML file', async () => {
			const tomlContent = {
				default: {
					account: 'default-account',
					token: 'default-token'
				}
			};

			mockFs.existsSync.mockImplementation((p) =>
				(p as string).endsWith('connections.toml')
			);
			mockFs.readFileSync.mockReturnValue('toml content');
			mockToml.parse.mockReturnValue(tomlContent);

			// Request non-existent connection
			const result = await resolveConnectionConfig({
				connection: 'nonexistent'
			});

			// Should return null since 'nonexistent' doesn't exist
			expect(result).toBeNull();
		});

		it('should handle empty TOML file', async () => {
			mockFs.existsSync.mockImplementation((p) =>
				(p as string).endsWith('connections.toml')
			);
			mockFs.readFileSync.mockReturnValue('');
			mockToml.parse.mockReturnValue({});

			const result = await resolveConnectionConfig();

			expect(result).toBeNull();
		});

		it('should handle TOML parsing errors gracefully', async () => {
			mockFs.existsSync.mockImplementation((p) =>
				(p as string).endsWith('connections.toml')
			);
			mockFs.readFileSync.mockReturnValue('invalid toml');
			mockToml.parse.mockImplementation(() => {
				throw new Error('Invalid TOML');
			});

			const result = await resolveConnectionConfig();

			expect(result).toBeNull();
		});
	});

	describe('authentication methods', () => {
		it('should throw when no valid auth method is available', async () => {
			mockFs.existsSync.mockReturnValue(false);
			process.env.SNOWFLAKE_ACCOUNT = 'test-account';
			// No token, no key pair, no password

			await expect(authenticate()).rejects.toThrow(
				'No valid authentication method found'
			);
		});

		it('should support token from config with different field names', async () => {
			const tomlContent = {
				default: {
					account: 'test-account',
					user: 'test-user',
					authenticator: 'PROGRAMMATIC_ACCESS_TOKEN'
				}
			};

			mockFs.existsSync.mockImplementation((p) =>
				(p as string).endsWith('connections.toml')
			);
			mockFs.readFileSync.mockReturnValue('toml content');
			mockToml.parse.mockReturnValue(tomlContent);

			// This should fail since no token is provided
			await expect(authenticate()).rejects.toThrow(
				'No valid authentication method found'
			);
		});
	});

	describe('JWT token properties', () => {
		let testPrivateKey: string;

		beforeAll(() => {
			const { privateKey } = crypto.generateKeyPairSync('rsa', {
				modulusLength: 2048,
				privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
				publicKeyEncoding: { type: 'spki', format: 'pem' }
			});
			testPrivateKey = privateKey;
		});

		it('should uppercase account and username in JWT claims', () => {
			const token = generateJwtToken(
				testPrivateKey,
				'lowercase-account',
				'lowercase-user'
			);

			const decoded = jwt.decode(token) as { iss: string; sub: string };

			expect(decoded.sub).toBe('LOWERCASE-ACCOUNT.LOWERCASE-USER');
			expect(decoded.iss).toContain('LOWERCASE-ACCOUNT.LOWERCASE-USER.');
		});

		it('should use RS256 algorithm', () => {
			const token = generateJwtToken(
				testPrivateKey,
				'account',
				'user'
			);

			// Decode header to verify algorithm
			const parts = token.split('.');
			const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());

			expect(header.alg).toBe('RS256');
			expect(header.typ).toBe('JWT');
		});

		it('should generate verifiable signatures', () => {
			const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
				modulusLength: 2048,
				privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
				publicKeyEncoding: { type: 'spki', format: 'pem' }
			});

			const token = generateJwtToken(privateKey, 'test-account', 'test-user');

			// Use jwt.verify to validate the token
			const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
			expect(decoded).toBeDefined();
			expect((decoded as any).sub).toContain('TEST-ACCOUNT.TEST-USER');
		});
	});

	describe('validateCredentials', () => {
		beforeEach(() => {
			mockIsCortexCliAvailable.mockReset();
		});

		it('should return rest=true when REST auth succeeds', async () => {
			// Setup successful REST auth
			process.env.SNOWFLAKE_API_KEY = 'test-key';
			process.env.SNOWFLAKE_BASE_URL = 'https://test.snowflakecomputing.com';
			mockFs.existsSync.mockReturnValue(false);
			mockIsCortexCliAvailable.mockResolvedValue(false);

			const result = await validateCredentials();

			expect(result.rest).toBe(true);
			expect(result.preferredMode).toBe('rest');
		});

		it('should return cli=true when CLI is available', async () => {
			// No REST credentials
			mockFs.existsSync.mockReturnValue(false);
			mockIsCortexCliAvailable.mockResolvedValue(true);

			const result = await validateCredentials();

			expect(result.cli).toBe(true);
			expect(result.preferredMode).toBe('cli');
		});

		it('should prefer REST over CLI when both available', async () => {
			process.env.SNOWFLAKE_API_KEY = 'test-key';
			process.env.SNOWFLAKE_BASE_URL = 'https://test.snowflakecomputing.com';
			mockFs.existsSync.mockReturnValue(false);
			mockIsCortexCliAvailable.mockResolvedValue(true);

			const result = await validateCredentials();

			expect(result.rest).toBe(true);
			expect(result.cli).toBe(true);
			expect(result.preferredMode).toBe('rest');
		});

		it('should throw when neither REST nor CLI is available', async () => {
			mockFs.existsSync.mockReturnValue(false);
			mockIsCortexCliAvailable.mockResolvedValue(false);

			await expect(validateCredentials()).rejects.toThrow(
				'Snowflake authentication not configured'
			);
		});

		it('should handle CLI check throwing an error', async () => {
			// Setup successful REST auth
			process.env.SNOWFLAKE_API_KEY = 'test-key';
			process.env.SNOWFLAKE_BASE_URL = 'https://test.snowflakecomputing.com';
			mockFs.existsSync.mockReturnValue(false);
			mockIsCortexCliAvailable.mockRejectedValue(new Error('CLI check failed'));

			const result = await validateCredentials();

			expect(result.rest).toBe(true);
			expect(result.cli).toBe(false);
		});
	});

	describe('key pair authentication with OAuth exchange', () => {
		let testPrivateKey: string;
		const originalFetch = global.fetch;

		beforeAll(() => {
			const { privateKey } = crypto.generateKeyPairSync('rsa', {
				modulusLength: 2048,
				privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
				publicKeyEncoding: { type: 'spki', format: 'pem' }
			});
			testPrivateKey = privateKey;
		});

		beforeEach(() => {
			// Mock fetch globally
			global.fetch = jest.fn();
		});

		afterEach(() => {
			global.fetch = originalFetch;
		});

		it('should exchange JWT for access token', async () => {
			// Setup key pair auth via environment
			process.env.SNOWFLAKE_ACCOUNT = 'test-account';
			process.env.SNOWFLAKE_USER = 'test-user';
			process.env.SNOWFLAKE_PRIVATE_KEY_PATH = '/path/to/key.p8';
			mockFs.existsSync.mockReturnValue(false);
			mockFs.readFileSync.mockReturnValue(Buffer.from(testPrivateKey));

			// Mock successful OAuth response
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						access_token: 'oauth-access-token',
						expires_in: 3600
					})
			});

			const result = await authenticate();

			expect(result.accessToken).toBe('oauth-access-token');
			expect(global.fetch).toHaveBeenCalledWith(
				expect.stringContaining('/oauth/token'),
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						'Content-Type': 'application/x-www-form-urlencoded'
					})
				})
			);
		});

		it('should include role in OAuth scope', async () => {
			process.env.SNOWFLAKE_ACCOUNT = 'test-account';
			process.env.SNOWFLAKE_USER = 'test-user';
			process.env.SNOWFLAKE_PRIVATE_KEY_PATH = '/path/to/key.p8';
			process.env.SNOWFLAKE_ROLE = 'TEST_ROLE';
			mockFs.existsSync.mockReturnValue(false);
			mockFs.readFileSync.mockReturnValue(Buffer.from(testPrivateKey));

			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						access_token: 'oauth-access-token',
						expires_in: 3600
					})
			});

			await authenticate();

			const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
			const body = fetchCall[1].body;
			expect(body).toContain('scope=session%3Arole%3ATEST_ROLE');
		});

		it('should throw on OAuth failure', async () => {
			process.env.SNOWFLAKE_ACCOUNT = 'test-account';
			process.env.SNOWFLAKE_USER = 'test-user';
			process.env.SNOWFLAKE_PRIVATE_KEY_PATH = '/path/to/key.p8';
			mockFs.existsSync.mockReturnValue(false);
			mockFs.readFileSync.mockReturnValue(Buffer.from(testPrivateKey));

			(global.fetch as jest.Mock).mockResolvedValue({
				ok: false,
				status: 401,
				text: () => Promise.resolve('Invalid credentials')
			});

			await expect(authenticate()).rejects.toThrow('Token exchange failed (401)');
		});

		it('should handle OAuth timeout', async () => {
			process.env.SNOWFLAKE_ACCOUNT = 'test-account';
			process.env.SNOWFLAKE_USER = 'test-user';
			process.env.SNOWFLAKE_PRIVATE_KEY_PATH = '/path/to/key.p8';
			mockFs.existsSync.mockReturnValue(false);
			mockFs.readFileSync.mockReturnValue(Buffer.from(testPrivateKey));

			// Simulate abort error
			const abortError = new Error('Aborted');
			abortError.name = 'AbortError';
			(global.fetch as jest.Mock).mockRejectedValue(abortError);

			await expect(authenticate()).rejects.toThrow('Token exchange timed out');
		});

		it('should use cached token on subsequent calls', async () => {
			process.env.SNOWFLAKE_ACCOUNT = 'test-account';
			process.env.SNOWFLAKE_USER = 'test-user';
			process.env.SNOWFLAKE_PRIVATE_KEY_PATH = '/path/to/key.p8';
			mockFs.existsSync.mockReturnValue(false);
			mockFs.readFileSync.mockReturnValue(Buffer.from(testPrivateKey));

			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						access_token: 'cached-token',
						expires_in: 3600
					})
			});

			// First call should hit OAuth
			const result1 = await authenticate();
			expect(result1.accessToken).toBe('cached-token');
			expect(global.fetch).toHaveBeenCalledTimes(1);

			// Second call should use cache
			const result2 = await authenticate();
			expect(result2.accessToken).toBe('cached-token');
			expect(global.fetch).toHaveBeenCalledTimes(1); // Still 1

			// Clear cache and call again
			clearAuthCache();
			const result3 = await authenticate();
			expect(result3.accessToken).toBe('cached-token');
			expect(global.fetch).toHaveBeenCalledTimes(2); // Now 2
		});

		it('should load private key with passphrase', async () => {
			// Generate encrypted key for this test
			const { privateKey: encryptedKey } = crypto.generateKeyPairSync('rsa', {
				modulusLength: 2048,
				privateKeyEncoding: {
					type: 'pkcs8',
					format: 'pem',
					cipher: 'aes-256-cbc',
					passphrase: 'test-passphrase'
				},
				publicKeyEncoding: { type: 'spki', format: 'pem' }
			});

			process.env.SNOWFLAKE_ACCOUNT = 'test-account';
			process.env.SNOWFLAKE_USER = 'test-user';
			process.env.SNOWFLAKE_PRIVATE_KEY_PATH = '/path/to/key.p8';
			process.env.SNOWFLAKE_PRIVATE_KEY_PASSPHRASE = 'test-passphrase';
			mockFs.existsSync.mockReturnValue(false);
			mockFs.readFileSync.mockReturnValue(Buffer.from(encryptedKey));

			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						access_token: 'encrypted-key-token',
						expires_in: 3600
					})
			});

			const result = await authenticate();
			expect(result.accessToken).toBe('encrypted-key-token');
		});
	});
});
