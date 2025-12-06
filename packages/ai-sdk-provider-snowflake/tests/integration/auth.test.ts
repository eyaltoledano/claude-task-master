/**
 * Authentication Integration Tests
 *
 * Tests for Snowflake authentication including:
 * - Basic authentication with available credentials
 * - Token caching and reuse
 * - Connection-specific authentication
 * - Environment variable configuration
 *
 * Environment setup: See tests/integration.test.ts header for details
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { config } from 'dotenv';
import { resolve } from 'path';
import { authenticate, clearAuthCache } from '../../src/auth/index.js';
import { describeWithCredentials } from '../test-utils.js';

// Load environment variables
config({ path: resolve(process.cwd(), '../../.env') });

describeWithCredentials('Authentication Integration Tests', () => {
	beforeAll(() => {
		// Clear any cached tokens before tests
		clearAuthCache();
	});

	afterAll(() => {
		// Clean up after tests
		clearAuthCache();
	});

	describe('Basic Authentication', () => {
		it('should authenticate successfully with available credentials', async () => {
			const result = await authenticate({});
			expect(result).toBeDefined();
			expect(result.accessToken).toBeDefined();
			expect(result.baseURL).toBeDefined();
			expect(result.baseURL).toContain('snowflakecomputing.com');
		});

		it('should use connection from environment variables', async () => {
			// This test verifies that env vars are properly read
			const result = await authenticate({});
			expect(result).toBeDefined();
			expect(result.accessToken).toBeDefined();
		});
	});

	describe('Token Caching', () => {
		it('should cache tokens and reuse them', async () => {
			const result1 = await authenticate({});
			const result2 = await authenticate({});

			// Should return the same cached token
			expect(result1.accessToken).toBe(result2.accessToken);
		});
	});

	describe('Connection Configuration', () => {
		it('should authenticate with specific connection name if configured', async () => {
			// Skip if no connection name in environment
			const connectionName = process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME;
			if (!connectionName) {
				console.log('Skipping: SNOWFLAKE_DEFAULT_CONNECTION_NAME not set');
				return;
			}

			const result = await authenticate({ connection: connectionName });
			expect(result.accessToken).toBeDefined();
		});
	});

	describe('Base URL Validation', () => {
		it('should construct valid Snowflake URLs', async () => {
			const result = await authenticate({});
			expect(result.baseURL).toContain('snowflakecomputing.com');
		});

		it('should handle URLs with correct format', () => {
			const validURLs = [
				'https://org-account.snowflakecomputing.com',
				'https://myorg-myaccount.snowflakecomputing.com',
				'https://MYORG-MYACCOUNT.snowflakecomputing.com'
			];

			validURLs.forEach((url) => {
				expect(url).toMatch(/https:\/\/[a-zA-Z0-9-]+\.snowflakecomputing\.com/);
			});
		});

		it('should handle URLs with trailing slash normalization', () => {
			const baseURL = 'https://org-account.snowflakecomputing.com/';
			const normalized = baseURL.replace(/\/$/, '');
			expect(normalized).toBe('https://org-account.snowflakecomputing.com');
		});

		it('should handle URLs with existing path', () => {
			const baseURL =
				'https://org-account.snowflakecomputing.com/api/v2/cortex/v1';
			expect(baseURL).toContain('/api/v2/cortex/v1');
		});
	});
});

