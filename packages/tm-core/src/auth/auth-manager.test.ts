/**
 * Tests for AuthManager singleton behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthManager } from './auth-manager.js';

// Mock the logger to verify warnings
const mockLogger = {
	warn: vi.fn(),
	info: vi.fn(),
	debug: vi.fn(),
	error: vi.fn()
};

vi.mock('../logger/index.js', () => ({
	getLogger: () => mockLogger
}));

describe('AuthManager Singleton', () => {
	beforeEach(() => {
		// Reset singleton before each test
		AuthManager.resetInstance();
		vi.clearAllMocks();
	});

	it('should return the same instance on multiple calls', () => {
		const instance1 = AuthManager.getInstance();
		const instance2 = AuthManager.getInstance();

		expect(instance1).toBe(instance2);
	});

	it('should use config on first call', () => {
		const config = {
			baseUrl: 'https://test.auth.com',
			configDir: '/test/config',
			configFile: '/test/config/auth.json'
		};

		const instance = AuthManager.getInstance(config);
		expect(instance).toBeDefined();
		
		// Verify the config is passed to internal components
		// This would be observable when attempting operations that use the config
		// For example, getCredentials would look in the configured file path
		const credentials = instance.getCredentials();
		expect(credentials).toBeNull(); // File doesn't exist, but it should check the right path
	});

	it('should warn when config is provided after initialization', () => {
		// Clear previous calls
		mockLogger.warn.mockClear();

		// First call with config
		AuthManager.getInstance({ baseUrl: 'https://first.auth.com' });

		// Second call with different config
		AuthManager.getInstance({ baseUrl: 'https://second.auth.com' });

		// Verify warning was logged
		expect(mockLogger.warn).toHaveBeenCalledWith(
			'getInstance called with config after initialization; config is ignored.'
		);
	});

	it('should not warn when no config is provided after initialization', () => {
		// Clear previous calls
		mockLogger.warn.mockClear();

		// First call with config
		AuthManager.getInstance({ configDir: '/test/config' });

		// Second call without config
		AuthManager.getInstance();

		// Verify no warning was logged
		expect(mockLogger.warn).not.toHaveBeenCalled();
	});

	it('should allow resetting the instance', () => {
		const instance1 = AuthManager.getInstance();

		// Reset the instance
		AuthManager.resetInstance();

		// Get new instance
		const instance2 = AuthManager.getInstance();

		// They should be different instances
		expect(instance1).not.toBe(instance2);
	});
});
