/**
 * Tests for concurrent connection loading race condition fix
 * 
 * This test suite verifies that the AsyncLock in snowflake-auth.ts
 * properly prevents race conditions when multiple concurrent requests
 * try to load different connection configurations.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { authenticate, clearAuthCache } from '../../../src/auth/snowflake-auth.js';
import type { SnowflakeProviderSettings } from '../../../src/types.js';

describe('Connection Loading Concurrency', () => {
	let testDir: string;
	let originalEnv: Record<string, string | undefined>;

	beforeAll(() => {
		// Save original environment - include ALL variables that could affect authentication
		originalEnv = {
			SNOWFLAKE_HOME: process.env.SNOWFLAKE_HOME,
			SNOWFLAKE_DEFAULT_CONNECTION_NAME: process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME,
			SNOWFLAKE_CONNECTION_NAME: process.env.SNOWFLAKE_CONNECTION_NAME,
			SNOWFLAKE_CONNECTION: process.env.SNOWFLAKE_CONNECTION,
			// These take precedence in authenticate() and must be cleared
			CORTEX_API_KEY: process.env.CORTEX_API_KEY,
			SNOWFLAKE_API_KEY: process.env.SNOWFLAKE_API_KEY,
			CORTEX_BASE_URL: process.env.CORTEX_BASE_URL,
			SNOWFLAKE_BASE_URL: process.env.SNOWFLAKE_BASE_URL,
			CORTEX_ACCOUNT: process.env.CORTEX_ACCOUNT,
			SNOWFLAKE_ACCOUNT: process.env.SNOWFLAKE_ACCOUNT,
			SNOWFLAKE_USER: process.env.SNOWFLAKE_USER,
			CORTEX_USER: process.env.CORTEX_USER,
			SNOWFLAKE_PRIVATE_KEY_PATH: process.env.SNOWFLAKE_PRIVATE_KEY_PATH,
			SNOWFLAKE_PRIVATE_KEY_FILE: process.env.SNOWFLAKE_PRIVATE_KEY_FILE
		};

		// Clear ALL env vars that could interfere with TOML-based authentication
		delete process.env.CORTEX_API_KEY;
		delete process.env.SNOWFLAKE_API_KEY;
		delete process.env.CORTEX_BASE_URL;
		delete process.env.SNOWFLAKE_BASE_URL;
		delete process.env.CORTEX_ACCOUNT;
		delete process.env.SNOWFLAKE_ACCOUNT;
		delete process.env.SNOWFLAKE_USER;
		delete process.env.CORTEX_USER;
		delete process.env.SNOWFLAKE_PRIVATE_KEY_PATH;
		delete process.env.SNOWFLAKE_PRIVATE_KEY_FILE;
		delete process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME;
		delete process.env.SNOWFLAKE_CONNECTION_NAME;
		delete process.env.SNOWFLAKE_CONNECTION;

		// Create temporary test directory
		testDir = join(tmpdir(), `snowflake-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });

		// Set SNOWFLAKE_HOME to our test directory
		process.env.SNOWFLAKE_HOME = testDir;

		// Create test connections.toml with multiple connections
		const tomlContent = `
# Connection 1
[connection1]
account = "account1.region1"
user = "user1"
token = "token1"

# Connection 2
[connection2]
account = "account2.region2"
user = "user2"
token = "token2"

# Connection 3
[connection3]
account = "account3.region3"
user = "user3"
token = "token3"

# Default connection
default_connection_name = "connection1"
`;

		writeFileSync(join(testDir, 'connections.toml'), tomlContent);
	});

	afterAll(() => {
		// Restore ALL original environment variables
		for (const [key, value] of Object.entries(originalEnv)) {
			if (value !== undefined) {
				process.env[key] = value;
			} else {
				delete process.env[key];
			}
		}

		// Clean up test directory
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}

		// Clear auth cache
		clearAuthCache();
	});

	describe('Race Condition Prevention', () => {
		it('should handle concurrent connection loads without interference', async () => {
			// Clear any cached auth
			clearAuthCache();

			// Create settings for different connections
			const settings1: SnowflakeProviderSettings = { connection: 'connection1' };
			const settings2: SnowflakeProviderSettings = { connection: 'connection2' };
			const settings3: SnowflakeProviderSettings = { connection: 'connection3' };

			// Launch concurrent authentication requests
			const results = await Promise.all([
				authenticate(settings1),
				authenticate(settings2),
				authenticate(settings3),
				authenticate(settings1), // Duplicate to test caching
				authenticate(settings2), // Duplicate to test caching
				authenticate(settings3)  // Duplicate to test caching
			]);

			// Verify each connection got the correct base URL
			expect(results[0].baseURL).toContain('account1-region1');
			expect(results[1].baseURL).toContain('account2-region2');
			expect(results[2].baseURL).toContain('account3-region3');
			expect(results[3].baseURL).toContain('account1-region1');
			expect(results[4].baseURL).toContain('account2-region2');
			expect(results[5].baseURL).toContain('account3-region3');

			// Verify each connection got the correct token
			expect(results[0].accessToken).toBe('token1');
			expect(results[1].accessToken).toBe('token2');
			expect(results[2].accessToken).toBe('token3');
			expect(results[3].accessToken).toBe('token1');
			expect(results[4].accessToken).toBe('token2');
			expect(results[5].accessToken).toBe('token3');
		});

		it('should handle high concurrency without cross-contamination', async () => {
			// Clear any cached auth
			clearAuthCache();

			// Create 30 concurrent requests alternating between 3 connections
			const requests = Array.from({ length: 30 }, (_, i) => {
				const connectionNum = (i % 3) + 1;
				return authenticate({ connection: `connection${connectionNum}` });
			});

			const results = await Promise.all(requests);

			// Verify each result matches its expected connection
			for (let i = 0; i < results.length; i++) {
				const connectionNum = (i % 3) + 1;
				const expectedToken = `token${connectionNum}`;
				const expectedAccount = `account${connectionNum}-region${connectionNum}`;

				expect(results[i].accessToken).toBe(expectedToken);
				expect(results[i].baseURL).toContain(expectedAccount);
			}
		});

		it('should maintain correct env var state after concurrent loads', async () => {
			// Clear any cached auth
			clearAuthCache();

			// Save initial env var state
			const initialEnvVar = process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME;

			// Launch concurrent requests
			await Promise.all([
				authenticate({ connection: 'connection1' }),
				authenticate({ connection: 'connection2' }),
				authenticate({ connection: 'connection3' })
			]);

			// Verify env var was restored to original state
			expect(process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME).toBe(initialEnvVar);
		});

		it('should handle errors during concurrent loads without deadlock', async () => {
			// Clear any cached auth
			clearAuthCache();

			// Mix valid and invalid connection names
			const requests = [
				authenticate({ connection: 'connection1' }),
				authenticate({ connection: 'invalid-connection' }).catch(() => null),
				authenticate({ connection: 'connection2' }),
				authenticate({ connection: 'another-invalid' }).catch(() => null),
				authenticate({ connection: 'connection3' })
			];

			const results = await Promise.all(requests);

			// Verify valid connections succeeded
			expect(results[0]).toBeTruthy();
			expect(results[0]?.accessToken).toBe('token1');
			
			// Verify invalid connections failed gracefully
			expect(results[1]).toBeNull();
			expect(results[3]).toBeNull();

			// Verify other valid connections succeeded
			expect(results[2]).toBeTruthy();
			expect(results[2]?.accessToken).toBe('token2');
			expect(results[4]).toBeTruthy();
			expect(results[4]?.accessToken).toBe('token3');
		});

		it('should serialize env var access even with rapid concurrent calls', async () => {
			// Clear any cached auth
			clearAuthCache();

			// Track the order of env var modifications
			const envVarStates: string[] = [];
			const originalEnvVarGetter = Object.getOwnPropertyDescriptor(process.env, 'SNOWFLAKE_DEFAULT_CONNECTION_NAME')?.get;

			// Create a spy to track env var reads (if possible)
			// This helps verify that modifications are serialized

			// Launch 50 rapid concurrent requests
			const rapidRequests = Array.from({ length: 50 }, (_, i) => {
				const connectionNum = (i % 3) + 1;
				return authenticate({ connection: `connection${connectionNum}` });
			});

			const results = await Promise.all(rapidRequests);

			// Verify all requests completed successfully with correct tokens
			for (let i = 0; i < results.length; i++) {
				const connectionNum = (i % 3) + 1;
				expect(results[i].accessToken).toBe(`token${connectionNum}`);
			}

			// Verify final env var state is clean
			expect(process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME).not.toBe('connection1');
			expect(process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME).not.toBe('connection2');
			expect(process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME).not.toBe('connection3');
		});
	});

	describe('Performance Under Concurrency', () => {
		it('should complete concurrent loads within reasonable time', async () => {
			// Clear any cached auth
			clearAuthCache();

			const startTime = Date.now();

			// Launch 20 concurrent requests
			await Promise.all(
				Array.from({ length: 20 }, (_, i) => {
					const connectionNum = (i % 3) + 1;
					return authenticate({ connection: `connection${connectionNum}` });
				})
			);

			const duration = Date.now() - startTime;

			// Should complete in less than 5 seconds even with serialization
			// This ensures the lock doesn't cause excessive blocking
			expect(duration).toBeLessThan(5000);
		}, 10000); // 10 second timeout
	});
});

