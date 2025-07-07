/**
 * @fileoverview Provider Integration Tests
 *
 * Tests the provider abstraction layer, mock provider implementation,
 * and provider registry functionality.
 */

import { Effect, Layer, Runtime, TestContext } from 'effect';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	SandboxProvider,
	SandboxProviderInterface,
	ProviderError,
	ResourceNotFoundError,
	NetworkPolicy,
	SecurityConfig
} from '../providers/provider.interface.js';
import { MockProvider } from '../providers/mock/index.js';
import {
	ProviderRegistry,
	ProviderRegistryLive,
	getProviderFromConfig,
	createProviderLayer
} from '../providers/registry.js';

describe('Provider Interface', () => {
	let runtime;

	beforeEach(async () => {
		runtime = Runtime.make(MockProvider);
	});

	afterEach(async () => {
		if (runtime) {
			await Runtime.dispose(runtime);
		}
	});

	it('should create a resource with valid configuration', async () => {
		const test = Effect.gen(function* () {
			const provider = yield* SandboxProvider;
			const config = {
				type: 'container',
				resources: { cpu: 2, memory: 4096, storage: 10000 },
				tags: { project: 'test', environment: 'dev' }
			};

			const resource = yield* provider.createResource(config);

			expect(resource).toBeDefined();
			expect(resource.id).toMatch(/^mock-/);
			expect(resource.state).toBe('creating');
			expect(resource.health).toBe('unknown');
			expect(resource.tags).toEqual(config.tags);
			expect(new Date(resource.createdAt)).toBeInstanceOf(Date);
		});

		await Runtime.runPromise(runtime)(test);
	});

	it('should get resource status', async () => {
		const test = Effect.gen(function* () {
			const provider = yield* SandboxProvider;

			// Create a resource first
			const config = { type: 'container', resources: { cpu: 1, memory: 1024 } };
			const resource = yield* provider.createResource(config);

			// Get status
			const status = yield* provider.getResourceStatus(resource.id);

			expect(status).toBeDefined();
			expect(status.id).toBe(resource.id);
			expect(status.state).toBeDefined();
			expect(status.health).toBeDefined();
		});

		await Runtime.runPromise(runtime)(test);
	});

	it('should fail when getting status for non-existent resource', async () => {
		const test = Effect.gen(function* () {
			const provider = yield* SandboxProvider;
			const result = yield* Effect.either(
				provider.getResourceStatus('non-existent')
			);

			expect(result._tag).toBe('Left');
			expect(result.left).toBeInstanceOf(ResourceNotFoundError);
			expect(result.left.resourceId).toBe('non-existent');
			expect(result.left.provider).toBe('mock');
		});

		await Runtime.runPromise(runtime)(test);
	});

	it('should trigger actions on resources', async () => {
		const test = Effect.gen(function* () {
			const provider = yield* SandboxProvider;

			// Create a resource
			const config = { type: 'container' };
			const resource = yield* provider.createResource(config);

			// Trigger start action
			const action = yield* provider.triggerAction(resource.id, 'start');

			expect(action).toBeDefined();
			expect(action.actionId).toBeDefined();
			expect(action.actionType).toBe('start');
			expect(action.resourceId).toBe(resource.id);
			expect(action.status).toBe('initiated');
		});

		await Runtime.runPromise(runtime)(test);
	});

	it('should configure networking for resources', async () => {
		const test = Effect.gen(function* () {
			const provider = yield* SandboxProvider;

			// Create a resource
			const config = { type: 'container' };
			const resource = yield* provider.createResource(config);

			// Configure networking
			const networkPolicy = {
				externalAccessEnabled: true,
				ipWhitelist: ['192.168.1.0/24', '10.0.0.0/8'],
				allowedPorts: [80, 443, 8080],
				isolationLevel: 'moderate'
			};

			yield* provider.configureNetworking(resource.id, networkPolicy);

			// Verify the configuration was applied (check logs or status)
			const logs = yield* provider.getLogs(resource.id);
			const networkingLog = logs.find((log) =>
				log.message.includes('Network policy configured')
			);

			expect(networkingLog).toBeDefined();
			expect(networkingLog.metadata.networkPolicy).toEqual(networkPolicy);
		});

		await Runtime.runPromise(runtime)(test);
	});

	it('should manage secrets for resources', async () => {
		const test = Effect.gen(function* () {
			const provider = yield* SandboxProvider;

			// Create a resource
			const config = { type: 'container' };
			const resource = yield* provider.createResource(config);

			// Manage secrets
			const secrets = {
				API_KEY: 'secret-api-key',
				DATABASE_URL: 'postgresql://user:pass@host/db',
				JWT_SECRET: 'super-secret-jwt-key'
			};

			yield* provider.manageSecrets(resource.id, secrets);

			// Verify secrets were configured (check logs)
			const logs = yield* provider.getLogs(resource.id);
			const secretsLog = logs.find((log) =>
				log.message.includes('secrets configured')
			);

			expect(secretsLog).toBeDefined();
			expect(secretsLog.metadata.secretKeys).toEqual(Object.keys(secrets));
			// Ensure secret values are not logged
			expect(secretsLog.metadata.secretKeys).not.toContain('secret-api-key');
		});

		await Runtime.runPromise(runtime)(test);
	});

	it('should get provider capabilities', async () => {
		const test = Effect.gen(function* () {
			const provider = yield* SandboxProvider;
			const capabilities = yield* provider.getCapabilities();

			expect(capabilities).toBeDefined();
			expect(capabilities.name).toBe('Mock Provider');
			expect(capabilities.supportedActions).toBeInstanceOf(Array);
			expect(capabilities.supportedActions).toContain('start');
			expect(capabilities.supportedActions).toContain('stop');
			expect(capabilities.maxCpu).toBeGreaterThan(0);
			expect(capabilities.maxMemory).toBeGreaterThan(0);
			expect(capabilities.networking).toBeDefined();
			expect(capabilities.security).toBeDefined();
		});

		await Runtime.runPromise(runtime)(test);
	});

	it('should perform health checks', async () => {
		const test = Effect.gen(function* () {
			const provider = yield* SandboxProvider;
			const health = yield* provider.healthCheck();

			expect(health).toBeDefined();
			expect(health.status).toMatch(/^(healthy|degraded|unhealthy)$/);
			expect(health.provider).toBe('mock');
			expect(health.timestamp).toBeDefined();
			expect(health.responseTime).toBeGreaterThan(0);
			expect(health.endpoints).toBeDefined();
			expect(health.metrics).toBeDefined();
		});

		await Runtime.runPromise(runtime)(test);
	});

	it('should list resources with filters', async () => {
		const test = Effect.gen(function* () {
			const provider = yield* SandboxProvider;

			// Create multiple resources with different tags
			const config1 = {
				type: 'container',
				tags: { environment: 'dev', project: 'app1' }
			};
			const config2 = {
				type: 'container',
				tags: { environment: 'prod', project: 'app1' }
			};
			const config3 = {
				type: 'container',
				tags: { environment: 'dev', project: 'app2' }
			};

			const resource1 = yield* provider.createResource(config1);
			const resource2 = yield* provider.createResource(config2);
			const resource3 = yield* provider.createResource(config3);

			// List all resources
			const allResources = yield* provider.listResources();
			expect(allResources.length).toBeGreaterThanOrEqual(3);

			// List resources with tag filter
			const devResources = yield* provider.listResources({
				tags: { environment: 'dev' }
			});

			// Should include resource1 and resource3, but not resource2
			const devResourceIds = devResources.map((r) => r.id);
			expect(devResourceIds).toContain(resource1.id);
			expect(devResourceIds).toContain(resource3.id);
			expect(devResourceIds).not.toContain(resource2.id);
		});

		await Runtime.runPromise(runtime)(test);
	});
});

describe('Provider Registry', () => {
	let runtime;

	beforeEach(async () => {
		runtime = Runtime.make(ProviderRegistryLive);
	});

	afterEach(async () => {
		if (runtime) {
			await Runtime.dispose(runtime);
		}
	});

	it('should list built-in providers', async () => {
		const test = Effect.gen(function* () {
			const registry = yield* ProviderRegistry;
			const providers = yield* registry.listProviders();

			expect(providers).toBeInstanceOf(Array);
			expect(providers.length).toBeGreaterThan(0);

			// Should include mock provider
			const mockProvider = providers.find((p) => p.type === 'mock');
			expect(mockProvider).toBeDefined();
			expect(mockProvider.name).toBe('Mock Provider');
			expect(mockProvider.isLoaded).toBe(false);
		});

		await Runtime.runPromise(runtime)(test);
	});

	it('should load and cache providers', async () => {
		const test = Effect.gen(function* () {
			const registry = yield* ProviderRegistry;

			// Load mock provider for the first time
			const provider1 = yield* registry.getProvider('mock');
			expect(provider1).toBeDefined();

			// Load again - should return cached instance
			const provider2 = yield* registry.getProvider('mock');
			expect(provider2).toBe(provider1);

			// Verify provider is marked as loaded
			const providers = yield* registry.listProviders();
			const mockProvider = providers.find((p) => p.type === 'mock');
			expect(mockProvider.isLoaded).toBe(true);
		});

		await Runtime.runPromise(runtime)(test);
	});

	it('should get provider configuration', async () => {
		const test = Effect.gen(function* () {
			const registry = yield* ProviderRegistry;
			const config = yield* registry.getProviderConfig('mock');

			expect(config).toBeDefined();
			expect(config.name).toBe('mock');
			expect(config.type).toBe('mock');
			expect(config.authentication).toBeDefined();
			expect(config.features).toContain('testing');
		});

		await Runtime.runPromise(runtime)(test);
	});

	it('should update provider configuration', async () => {
		const test = Effect.gen(function* () {
			const registry = yield* ProviderRegistry;

			// Update configuration
			const updates = {
				features: ['testing', 'development', 'simulation', 'custom-feature']
			};
			yield* registry.updateProviderConfig('mock', updates);

			// Verify update
			const config = yield* registry.getProviderConfig('mock');
			expect(config.features).toContain('custom-feature');
		});

		await Runtime.runPromise(runtime)(test);
	});

	it('should check provider health', async () => {
		const test = Effect.gen(function* () {
			const registry = yield* ProviderRegistry;

			// Check health of mock provider
			const health = yield* registry.checkProviderHealth('mock');

			expect(health).toBeDefined();
			expect(health.status).toMatch(/^(healthy|degraded|unhealthy)$/);
			expect(health.provider).toBe('mock');
			expect(health.lastChecked).toBeDefined();
		});

		await Runtime.runPromise(runtime)(test);
	});

	it('should register custom providers', async () => {
		const test = Effect.gen(function* () {
			const registry = yield* ProviderRegistry;

			// Register a custom provider
			const customDefinition = {
				name: 'Custom Test Provider',
				type: 'custom',
				loader: () => Promise.resolve(MockProvider), // Reuse mock for testing
				config: {
					name: 'custom',
					type: 'custom',
					authentication: { type: 'api_key', credentials: {} }
				},
				metadata: {
					description: 'Custom provider for testing',
					stability: 'experimental'
				}
			};

			yield* registry.registerProvider('custom', customDefinition);

			// Verify registration
			const providers = yield* registry.listProviders();
			const customProvider = providers.find((p) => p.type === 'custom');
			expect(customProvider).toBeDefined();
			expect(customProvider.name).toBe('Custom Test Provider');
		});

		await Runtime.runPromise(runtime)(test);
	});

	it('should handle fallback providers', async () => {
		const test = Effect.gen(function* () {
			const registry = yield* ProviderRegistry;

			// Try to get a non-existent provider - should fallback to mock
			const provider = yield* registry.getProvider('non-existent');
			expect(provider).toBeDefined();

			// Should be the mock provider (fallback)
			const providerInstance = yield* Effect.provide(
				Effect.service(SandboxProvider),
				provider
			);
			const health = yield* providerInstance.healthCheck();
			expect(health.provider).toBe('mock');
		});

		await Runtime.runPromise(runtime)(test);
	});

	it('should reset providers', async () => {
		const test = Effect.gen(function* () {
			const registry = yield* ProviderRegistry;

			// Load a provider
			yield* registry.getProvider('mock');

			// Verify it's loaded
			let providers = yield* registry.listProviders();
			let mockProvider = providers.find((p) => p.type === 'mock');
			expect(mockProvider.isLoaded).toBe(true);

			// Reset the provider
			yield* registry.resetProvider('mock');

			// Verify it's no longer loaded
			providers = yield* registry.listProviders();
			mockProvider = providers.find((p) => p.type === 'mock');
			expect(mockProvider.isLoaded).toBe(false);
		});

		await Runtime.runPromise(runtime)(test);
	});
});

describe('Provider Configuration Integration', () => {
	it('should get provider from configuration', async () => {
		const runtime = Runtime.make(ProviderRegistryLive);

		const test = Effect.gen(function* () {
			const config = { provider: 'mock', type: 'mock' };
			const provider = yield* getProviderFromConfig(config);

			expect(provider).toBeDefined();

			// Test provider functionality
			const health = yield* provider.healthCheck();
			expect(health.provider).toBe('mock');
		});

		await Runtime.runPromise(runtime)(test);
		await Runtime.dispose(runtime);
	});

	it('should create provider layer from configuration', async () => {
		const runtime = Runtime.make(ProviderRegistryLive);

		const test = Effect.gen(function* () {
			const config = { provider: 'mock' };
			const providerLayer = yield* createProviderLayer(config);

			expect(providerLayer).toBeDefined();

			// Use the layer to get provider instance
			const provider = yield* Effect.provide(
				Effect.service(SandboxProvider),
				providerLayer
			);

			const capabilities = yield* provider.getCapabilities();
			expect(capabilities.name).toBe('Mock Provider');
		});

		await Runtime.runPromise(runtime)(test);
		await Runtime.dispose(runtime);
	});
});

describe('Resource Lifecycle Integration', () => {
	let runtime;

	beforeEach(async () => {
		runtime = Runtime.make(MockProvider);
	});

	afterEach(async () => {
		if (runtime) {
			await Runtime.dispose(runtime);
		}
	});

	it('should handle complete resource lifecycle', async () => {
		const test = Effect.gen(function* () {
			const provider = yield* SandboxProvider;

			// 1. Create resource
			const config = {
				type: 'container',
				resources: { cpu: 2, memory: 4096 },
				tags: { test: 'lifecycle' }
			};
			const resource = yield* provider.createResource(config);
			expect(resource.state).toBe('creating');

			// 2. Start resource
			yield* Effect.sleep(100); // Allow state transition
			const startAction = yield* provider.triggerAction(resource.id, 'start');
			expect(startAction.actionType).toBe('start');

			// 3. Check status after start
			yield* Effect.sleep(600); // Allow action to complete
			const runningStatus = yield* provider.getResourceStatus(resource.id);
			// Note: Mock provider might transition states, so we check for reasonable states
			expect(['ready', 'running', 'starting']).toContain(runningStatus.state);

			// 4. Configure networking and security
			const networkPolicy = { externalAccessEnabled: true };
			yield* provider.configureNetworking(resource.id, networkPolicy);

			const securityConfig = { tlsEnabled: true };
			yield* provider.configureSecurity(resource.id, securityConfig);

			// 5. Stop resource
			const stopAction = yield* provider.triggerAction(resource.id, 'stop');
			expect(stopAction.actionType).toBe('stop');

			// 6. Delete resource
			yield* provider.deleteResource(resource.id);

			// 7. Verify deletion - should fail to get status
			const deleteResult = yield* Effect.either(
				provider.getResourceStatus(resource.id)
			);
			expect(deleteResult._tag).toBe('Left');
			expect(deleteResult.left).toBeInstanceOf(ResourceNotFoundError);
		});

		await Runtime.runPromise(runtime)(test);
	});

	it('should handle concurrent resource operations', async () => {
		const test = Effect.gen(function* () {
			const provider = yield* SandboxProvider;

			// Create multiple resources concurrently
			const configs = [
				{ type: 'container', tags: { instance: '1' } },
				{ type: 'container', tags: { instance: '2' } },
				{ type: 'container', tags: { instance: '3' } }
			];

			const createEffects = configs.map((config) =>
				provider.createResource(config)
			);

			const resources = yield* Effect.all(createEffects);
			expect(resources).toHaveLength(3);

			// Verify all resources have unique IDs
			const ids = resources.map((r) => r.id);
			expect(new Set(ids).size).toBe(3);

			// Perform concurrent actions
			const actionEffects = resources.map((resource) =>
				provider.triggerAction(resource.id, 'start')
			);

			const actions = yield* Effect.all(actionEffects);
			expect(actions).toHaveLength(3);

			// Cleanup
			const deleteEffects = resources.map((resource) =>
				provider.deleteResource(resource.id)
			);
			yield* Effect.all(deleteEffects);
		});

		await Runtime.runPromise(runtime)(test);
	});
});
