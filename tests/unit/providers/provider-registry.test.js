/**
 * Tests for ProviderRegistry - Singleton for managing AI providers
 *
 * This test suite covers:
 * 1. Singleton pattern behavior
 * 2. Provider registration and validation
 * 3. Provider retrieval and management
 * 4. Provider unregistration
 * 5. Registry reset (for testing)
 * 6. Interface validation for registered providers
 */

import { jest } from '@jest/globals';

// Import ProviderRegistry
const { default: ProviderRegistry } = await import(
	'../../../src/provider-registry/index.js'
);

// Mock provider classes for testing
class MockValidProvider {
	constructor() {
		this.name = 'MockValidProvider';
	}

	generateText() {
		return Promise.resolve({ text: 'mock text' });
	}
	streamText() {
		return Promise.resolve('mock stream');
	}
	generateObject() {
		return Promise.resolve({ object: {} });
	}
	getRequiredApiKeyName() {
		return 'MOCK_API_KEY';
	}
}

class MockInvalidProvider {
	constructor() {
		this.name = 'MockInvalidProvider';
	}
	// Missing required methods: generateText, streamText, generateObject
}

describe('ProviderRegistry', () => {
	let registry;

	beforeEach(() => {
		// Get a fresh instance and reset it
		registry = ProviderRegistry.getInstance();
		registry.reset();
	});

	afterEach(() => {
		// Clean up after each test
		registry.reset();
	});

	describe('Singleton Pattern', () => {
		test('getInstance returns the same instance', () => {
			const instance1 = ProviderRegistry.getInstance();
			const instance2 = ProviderRegistry.getInstance();

			expect(instance1).toBe(instance2);
			expect(instance1).toBe(registry);
		});

		test('multiple calls to getInstance return same instance', () => {
			const instances = Array.from({ length: 5 }, () =>
				ProviderRegistry.getInstance()
			);

			instances.forEach((instance) => {
				expect(instance).toBe(registry);
			});
		});
	});

	describe('Initialization', () => {
		test('registry is not auto-initialized when mocked', () => {
			// When mocked, the auto-initialization at import may not occur
			expect(registry._initialized).toBe(false);
		});

		test('initialize sets initialized flag', () => {
			expect(registry._initialized).toBe(false);

			const result = registry.initialize();

			expect(registry._initialized).toBe(true);
			expect(result).toBe(registry);
		});

		test('initialize can be called multiple times safely', () => {
			// First call initializes
			registry.initialize();
			expect(registry._initialized).toBe(true);

			// Second call should not throw
			expect(() => registry.initialize()).not.toThrow();
		});

		test('initialize returns self for chaining', () => {
			const result = registry.initialize();
			expect(result).toBe(registry);
		});
	});

	describe('Provider Registration', () => {
		test('registerProvider adds valid provider successfully', () => {
			const mockProvider = new MockValidProvider();
			const options = { priority: 'high' };

			const result = registry.registerProvider('mock', mockProvider, options);

			expect(result).toBe(registry); // Should return self for chaining
			expect(registry.hasProvider('mock')).toBe(true);
		});

		test('registerProvider validates provider name', () => {
			const mockProvider = new MockValidProvider();

			// Test empty string
			expect(() => registry.registerProvider('', mockProvider)).toThrow(
				'Provider name must be a non-empty string'
			);

			// Test null
			expect(() => registry.registerProvider(null, mockProvider)).toThrow(
				'Provider name must be a non-empty string'
			);

			// Test non-string
			expect(() => registry.registerProvider(123, mockProvider)).toThrow(
				'Provider name must be a non-empty string'
			);
		});

		test('registerProvider validates provider instance', () => {
			expect(() => registry.registerProvider('mock', null)).toThrow(
				'Provider instance is required'
			);

			expect(() => registry.registerProvider('mock', undefined)).toThrow(
				'Provider instance is required'
			);
		});

		test('registerProvider validates provider interface', () => {
			const invalidProvider = new MockInvalidProvider();

			expect(() => registry.registerProvider('mock', invalidProvider)).toThrow(
				'Provider must implement BaseAIProvider interface'
			);
		});

		test('registerProvider stores provider with metadata', () => {
			const mockProvider = new MockValidProvider();
			const options = { priority: 'high', custom: 'value' };
			const beforeRegistration = new Date();

			registry.registerProvider('mock', mockProvider, options);

			const storedEntry = registry._providers.get('mock');
			expect(storedEntry.instance).toBe(mockProvider);
			expect(storedEntry.options).toEqual(options);
			expect(storedEntry.registeredAt).toBeInstanceOf(Date);
			expect(storedEntry.registeredAt.getTime()).toBeGreaterThanOrEqual(
				beforeRegistration.getTime()
			);
		});

		test('registerProvider can overwrite existing providers', () => {
			const provider1 = new MockValidProvider();
			const provider2 = new MockValidProvider();

			registry.registerProvider('mock', provider1);
			expect(registry.getProvider('mock')).toBe(provider1);

			registry.registerProvider('mock', provider2);
			expect(registry.getProvider('mock')).toBe(provider2);
		});

		test('registerProvider handles missing options', () => {
			const mockProvider = new MockValidProvider();

			registry.registerProvider('mock', mockProvider);

			const storedEntry = registry._providers.get('mock');
			expect(storedEntry.options).toEqual({});
		});
	});

	describe('Provider Retrieval', () => {
		beforeEach(() => {
			const mockProvider = new MockValidProvider();
			registry.registerProvider('mock', mockProvider, { test: 'value' });
		});

		test('hasProvider returns correct boolean values', () => {
			expect(registry.hasProvider('mock')).toBe(true);
			expect(registry.hasProvider('nonexistent')).toBe(false);
			expect(registry.hasProvider('')).toBe(false);
			expect(registry.hasProvider(null)).toBe(false);
		});

		test('getProvider returns correct provider instance', () => {
			const provider = registry.getProvider('mock');
			expect(provider).toBeInstanceOf(MockValidProvider);
			expect(provider.name).toBe('MockValidProvider');
		});

		test('getProvider returns null for nonexistent provider', () => {
			expect(registry.getProvider('nonexistent')).toBe(null);
			expect(registry.getProvider('')).toBe(null);
			expect(registry.getProvider(null)).toBe(null);
		});

		test('getAllProviders returns copy of providers map', () => {
			const mockProvider2 = new MockValidProvider();
			registry.registerProvider('mock2', mockProvider2);

			const allProviders = registry.getAllProviders();

			expect(allProviders).toBeInstanceOf(Map);
			expect(allProviders.size).toBe(2);
			expect(allProviders.has('mock')).toBe(true);
			expect(allProviders.has('mock2')).toBe(true);

			// Should be a copy, not the original
			expect(allProviders).not.toBe(registry._providers);
		});

		test('getAllProviders returns empty map when no providers', () => {
			registry.reset();

			const allProviders = registry.getAllProviders();

			expect(allProviders).toBeInstanceOf(Map);
			expect(allProviders.size).toBe(0);
		});
	});

	describe('Provider Unregistration', () => {
		beforeEach(() => {
			const mockProvider = new MockValidProvider();
			registry.registerProvider('mock', mockProvider);
		});

		test('unregisterProvider removes existing provider', () => {
			expect(registry.hasProvider('mock')).toBe(true);

			const result = registry.unregisterProvider('mock');

			expect(result).toBe(true);
			expect(registry.hasProvider('mock')).toBe(false);
		});

		test('unregisterProvider returns false for nonexistent provider', () => {
			const result = registry.unregisterProvider('nonexistent');

			expect(result).toBe(false);
		});

		test('unregisterProvider handles edge cases', () => {
			expect(registry.unregisterProvider('')).toBe(false);
			expect(registry.unregisterProvider(null)).toBe(false);
			expect(registry.unregisterProvider(undefined)).toBe(false);
		});
	});

	describe('Registry Reset', () => {
		beforeEach(() => {
			const mockProvider = new MockValidProvider();
			registry.registerProvider('mock', mockProvider);
			registry.initialize();
		});

		test('reset clears all providers', () => {
			expect(registry.hasProvider('mock')).toBe(true);
			expect(registry._initialized).toBe(true);

			registry.reset();

			expect(registry.hasProvider('mock')).toBe(false);
			expect(registry._providers.size).toBe(0);
		});

		test('reset clears initialization flag', () => {
			expect(registry._initialized).toBe(true);

			registry.reset();

			expect(registry._initialized).toBe(false);
		});

		// No log assertion for reset, just call reset
		test('reset can be called without error', () => {
			expect(() => registry.reset()).not.toThrow();
		});

		test('reset allows re-initialization', () => {
			registry.reset();
			expect(registry._initialized).toBe(false);

			registry.initialize();
			expect(registry._initialized).toBe(true);
		});
	});

	describe('Interface Validation', () => {
		test('validates generateText method exists', () => {
			const providerWithoutGenerateText = {
				streamText: jest.fn(),
				generateObject: jest.fn()
			};

			expect(() =>
				registry.registerProvider('invalid', providerWithoutGenerateText)
			).toThrow('Provider must implement BaseAIProvider interface');
		});

		test('validates streamText method exists', () => {
			const providerWithoutStreamText = {
				generateText: jest.fn(),
				generateObject: jest.fn()
			};

			expect(() =>
				registry.registerProvider('invalid', providerWithoutStreamText)
			).toThrow('Provider must implement BaseAIProvider interface');
		});

		test('validates generateObject method exists', () => {
			const providerWithoutGenerateObject = {
				generateText: jest.fn(),
				streamText: jest.fn()
			};

			expect(() =>
				registry.registerProvider('invalid', providerWithoutGenerateObject)
			).toThrow('Provider must implement BaseAIProvider interface');
		});

		test('validates methods are functions', () => {
			const providerWithNonFunctionMethods = {
				generateText: 'not a function',
				streamText: jest.fn(),
				generateObject: jest.fn()
			};

			expect(() =>
				registry.registerProvider('invalid', providerWithNonFunctionMethods)
			).toThrow('Provider must implement BaseAIProvider interface');
		});

		test('accepts provider with all required methods', () => {
			const validProvider = {
				generateText: jest.fn(),
				streamText: jest.fn(),
				generateObject: jest.fn()
			};

			expect(() =>
				registry.registerProvider('valid', validProvider)
			).not.toThrow();
		});
	});

	describe('Edge Cases and Error Handling', () => {
		test('handles provider registration after reset', () => {
			const mockProvider = new MockValidProvider();
			registry.registerProvider('mock', mockProvider);
			expect(registry.hasProvider('mock')).toBe(true);

			registry.reset();
			expect(registry.hasProvider('mock')).toBe(false);

			registry.registerProvider('mock', mockProvider);
			expect(registry.hasProvider('mock')).toBe(true);
		});

		test('handles multiple registrations and unregistrations', () => {
			const provider1 = new MockValidProvider();
			const provider2 = new MockValidProvider();

			registry.registerProvider('provider1', provider1);
			registry.registerProvider('provider2', provider2);

			expect(registry.getAllProviders().size).toBe(2);

			registry.unregisterProvider('provider1');
			expect(registry.hasProvider('provider1')).toBe(false);
			expect(registry.hasProvider('provider2')).toBe(true);

			registry.unregisterProvider('provider2');
			expect(registry.getAllProviders().size).toBe(0);
		});

		test('maintains provider isolation', () => {
			const provider1 = new MockValidProvider();
			const provider2 = new MockValidProvider();

			registry.registerProvider('provider1', provider1);
			registry.registerProvider('provider2', provider2);

			const retrieved1 = registry.getProvider('provider1');
			const retrieved2 = registry.getProvider('provider2');

			expect(retrieved1).toBe(provider1);
			expect(retrieved2).toBe(provider2);
			expect(retrieved1).not.toBe(retrieved2);
		});
	});
});
