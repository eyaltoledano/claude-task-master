/**
 * Unit tests for ConnectionManager - PARALLEL FEATURE MATRIX
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ConnectionManager } from '../../src/cli/connection-manager.js';

beforeEach(() => {
	ConnectionManager.clearConnectionCache();
	ConnectionManager.clearValidationCache();
});

// Connection validation matrix - runs in parallel
const validConnectionMatrix = [
	[
		'Complete connection',
		{
			account: 'test-account',
			user: 'test-user',
			password: 'test-password',
			warehouse: 'test-warehouse',
			role: 'test-role'
		},
		true
	],
	[
		'Minimal connection',
		{
			account: 'test-account',
			user: 'test-user',
			password: 'test-password'
		},
		true
	]
] as const;

describe.each(validConnectionMatrix)(
	'Valid Connection: %s',
	(...args) => {
		const [testName, connection, shouldPass] = args;
		it('should validate without errors', () => {
			if (shouldPass) {
				expect(() => ConnectionManager.validateConnection(connection)).not.toThrow();
			}
		});
	}
);

// Invalid connection matrix - runs in parallel
const invalidConnectionMatrix = [
	['Missing account', { account: '', user: 'test-user', password: 'test-password' }, 'account'],
	['Missing user', { account: 'test-account', user: '', password: 'test-password' }, 'user'],
	[
		'Missing password',
		{ account: 'test-account', user: 'test-user', password: '' },
		'password'
	],
	['Missing all', { account: '', user: '', password: '' }, 'account']
] as const;

describe.each(invalidConnectionMatrix)(
	'Invalid Connection: %s',
	(...args) => {
		const [testName, connection, missingField] = args;
		it('should throw error with field name', () => {
			try {
				ConnectionManager.validateConnection(connection as any);
				fail('Should have thrown');
			} catch (error) {
				expect((error as Error).message).toContain(missingField);
			}
		});
	}
);

// Setup instructions validation matrix
const setupInstructionsMatrix = [
	['Cortex Code CLI', /Cortex Code CLI/],
	['config.toml path', /\.snowflake\/config\.toml/],
	['connections section', /\[connections\.default\]/],
	['account field', /account/],
	['user field', /user/],
	['password field', /password/],
	['PAT generation', /Generate a PAT/],
	['verification command', /cortex --version/]
] as const;

describe.each(setupInstructionsMatrix)(
	'Setup Instructions: %s',
	(...args) => {
		const [testName, expectedPattern] = args;
		it('should include in instructions', () => {
			const instructions = ConnectionManager.getSetupInstructions();
			expect(instructions).toMatch(expectedPattern);
		});
	}
);

// Synchronous validation matrix - runs in parallel
const syncValidationMatrix = [
	['Test environment', 'test', true, undefined],
	['Production with skip', 'production', true, { skipValidation: true }],
	['Development without check', 'development', false, undefined]
] as const;

describe.each(syncValidationMatrix)(
	'Sync Validation: %s',
	(...args) => {
		const [testName, nodeEnv, shouldBeValid, params] = args;
		it('should return correct validation result', () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = nodeEnv;

			const result = ConnectionManager.validateAuthSync(params);

			if (shouldBeValid) {
				expect(result.valid).toBe(true);
			}

			process.env.NODE_ENV = originalEnv;
		});
	}
);

// Async validation matrix - runs in parallel
const asyncValidationMatrix = [
	['Test environment', 'test', true, undefined],
	['Production with skip', 'production', true, { skipValidation: true }]
] as const;

describe.each(asyncValidationMatrix)(
	'Async Validation: %s',
	(...args) => {
		const [testName, nodeEnv, shouldBeValid, params] = args;
		it('should return correct validation result', async () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = nodeEnv;

			const result = await ConnectionManager.validateAuth(params);

			if (shouldBeValid) {
				expect(result.valid).toBe(true);
			}

			process.env.NODE_ENV = originalEnv;
		});
	}
);

// Static methods availability matrix
const staticMethodsMatrix = [
	['discoverConnections', 'function'],
	['getConnection', 'function'],
	['getDefaultConnection', 'function'],
	['listConnections', 'function'],
	['validateConnection', 'function'],
	['clearConnectionCache', 'function'],
	['checkCliInstallation', 'function'],
	['getSetupInstructions', 'function'],
	['validateAuth', 'function'],
	['validateAuthSync', 'function'],
	['clearValidationCache', 'function']
] as const;

describe.each(staticMethodsMatrix)('Static Method: %s', (...args) => {
	const [methodName, expectedType] = args;
	it('should be available', () => {
		expect(typeof (ConnectionManager as any)[methodName]).toBe(expectedType);
	});
});

// Cache management tests
describe('Cache Management', () => {
	it('should clear connection cache', () => {
		expect(() => ConnectionManager.clearConnectionCache()).not.toThrow();
	});

	it('should clear validation cache', () => {
		expect(() => ConnectionManager.clearValidationCache()).not.toThrow();
	});
});

// Connection listing tests
describe('Connection Operations', () => {
	it('should return array for listConnections', () => {
		const connections = ConnectionManager.listConnections();
		expect(Array.isArray(connections)).toBe(true);
	});

	it('should handle discoverConnections', () => {
		const connections = ConnectionManager.discoverConnections();
		expect(connections === null || typeof connections === 'object').toBe(true);
	});
});
