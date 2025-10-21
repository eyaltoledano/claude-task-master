/**
 * @fileoverview Integration tests for ConfigManager
 * Tests the orchestration of all configuration services
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ConfigManager } from './config-manager.js';
import { DEFAULT_CONFIG_VALUES } from '../../../common/interfaces/configuration.interface.js';
import { ConfigLoader } from '../services/config-loader.service.js';
import { ConfigMerger } from '../services/config-merger.service.js';
import { RuntimeStateManager } from '../services/runtime-state-manager.service.js';
import { ConfigPersistence } from '../services/config-persistence.service.js';
import { EnvironmentConfigProvider } from '../services/environment-config-provider.service.js';

// Mock all services
vi.mock('../services/config-loader.service.js');
vi.mock('../services/config-merger.service.js');
vi.mock('../services/runtime-state-manager.service.js');
vi.mock('../services/config-persistence.service.js');
vi.mock('../services/environment-config-provider.service.js');

describe('ConfigManager', () => {
	let manager: ConfigManager;
	const testProjectRoot = '/test/project';
	const originalEnv = { ...process.env };

	beforeEach(async () => {
		vi.clearAllMocks();

		// Clear environment variables
		Object.keys(process.env).forEach((key) => {
			if (key.startsWith('TASKMASTER_')) {
				delete process.env[key];
			}
		});

		// Setup default mock behaviors
		vi.mocked(ConfigLoader).mockImplementation(
			() =>
				({
					getDefaultConfig: vi.fn().mockReturnValue({
						models: { main: 'default-model', fallback: 'fallback-model' },
						storage: { type: 'file' },
						version: '1.0.0'
					}),
					loadLocalConfig: vi.fn().mockResolvedValue(null),
					loadGlobalConfig: vi.fn().mockResolvedValue(null),
					hasLocalConfig: vi.fn().mockResolvedValue(false),
					hasGlobalConfig: vi.fn().mockResolvedValue(false)
				}) as any
		);

		vi.mocked(ConfigMerger).mockImplementation(
			() =>
				({
					addSource: vi.fn(),
					clearSources: vi.fn(),
					merge: vi.fn().mockReturnValue({
						models: { main: 'merged-model', fallback: 'fallback-model' },
						storage: { type: 'file' }
					}),
					getSources: vi.fn().mockReturnValue([]),
					hasSource: vi.fn().mockReturnValue(false),
					removeSource: vi.fn().mockReturnValue(false)
				}) as any
		);

		vi.mocked(RuntimeStateManager).mockImplementation(
			() =>
				({
					loadState: vi.fn().mockResolvedValue({ activeTag: 'master' }),
					saveState: vi.fn().mockResolvedValue(undefined),
					getCurrentTag: vi.fn().mockReturnValue('master'),
					setCurrentTag: vi.fn().mockResolvedValue(undefined),
					getState: vi.fn().mockReturnValue({ activeTag: 'master' }),
					updateMetadata: vi.fn().mockResolvedValue(undefined),
					clearState: vi.fn().mockResolvedValue(undefined)
				}) as any
		);

		vi.mocked(ConfigPersistence).mockImplementation(
			() =>
				({
					saveConfig: vi.fn().mockResolvedValue(undefined),
					configExists: vi.fn().mockResolvedValue(false),
					deleteConfig: vi.fn().mockResolvedValue(undefined),
					getBackups: vi.fn().mockResolvedValue([]),
					restoreFromBackup: vi.fn().mockResolvedValue(undefined)
				}) as any
		);

		vi.mocked(EnvironmentConfigProvider).mockImplementation(
			() =>
				({
					loadConfig: vi.fn().mockReturnValue({}),
					getRuntimeState: vi.fn().mockReturnValue({}),
					hasEnvVar: vi.fn().mockReturnValue(false),
					getAllTaskmasterEnvVars: vi.fn().mockReturnValue({}),
					addMapping: vi.fn(),
					getMappings: vi.fn().mockReturnValue([])
				}) as any
		);

		// Since constructor is private, we need to use the factory method
		// But for testing, we'll create a test instance using create()
		manager = await ConfigManager.create(testProjectRoot);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		process.env = { ...originalEnv };
	});

	describe('creation', () => {
		it('should initialize all services when created', () => {
			// Services should have been initialized during beforeEach
			expect(ConfigLoader).toHaveBeenCalledWith(testProjectRoot);
			expect(ConfigMerger).toHaveBeenCalled();
			expect(RuntimeStateManager).toHaveBeenCalledWith(testProjectRoot);
			expect(ConfigPersistence).toHaveBeenCalledWith(testProjectRoot);
			expect(EnvironmentConfigProvider).toHaveBeenCalled();
		});
	});

	describe('create (factory method)', () => {
		it('should create and initialize manager', async () => {
			const createdManager = await ConfigManager.create(testProjectRoot);

			expect(createdManager).toBeInstanceOf(ConfigManager);
			expect(createdManager.getConfig()).toBeDefined();
		});
	});

	describe('initialization (via create)', () => {
		it('should load and merge all configuration sources', () => {
			// Manager was created in beforeEach, so initialization already happened
			const loader = (manager as any).loader;
			const merger = (manager as any).merger;
			const stateManager = (manager as any).stateManager;
			const envProvider = (manager as any).envProvider;

			// Verify loading sequence
			expect(merger.clearSources).toHaveBeenCalled();
			expect(loader.getDefaultConfig).toHaveBeenCalled();
			expect(loader.loadGlobalConfig).toHaveBeenCalled();
			expect(loader.loadLocalConfig).toHaveBeenCalled();
			expect(envProvider.loadConfig).toHaveBeenCalled();
			expect(merger.merge).toHaveBeenCalled();
			expect(stateManager.loadState).toHaveBeenCalled();
		});

		it('should add sources with correct precedence during creation', () => {
			const merger = (manager as any).merger;

			// Check that sources were added with correct precedence
			expect(merger.addSource).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'defaults',
					precedence: 0
				})
			);

			// Note: local and env sources may not be added if they don't exist
			// The mock setup determines what gets called
		});
	});

	describe('configuration access', () => {
		// Manager is already initialized in the main beforeEach

		it('should return merged configuration', () => {
			const config = manager.getConfig();
			expect(config).toEqual({
				models: { main: 'merged-model', fallback: 'fallback-model' },
				storage: { type: 'file' }
			});
		});

		it('should return storage configuration', () => {
			const storage = manager.getStorageConfig();
			expect(storage).toEqual({ type: 'file' });
		});

		it('should return API storage configuration when configured', async () => {
			// Create a new instance with API storage config
			vi.mocked(ConfigMerger).mockImplementationOnce(
				() =>
					({
						addSource: vi.fn(),
						clearSources: vi.fn(),
						merge: vi.fn().mockReturnValue({
							storage: {
								type: 'api',
								apiEndpoint: 'https://api.example.com',
								apiAccessToken: 'token123'
							}
						}),
						getSources: vi.fn().mockReturnValue([]),
						hasSource: vi.fn().mockReturnValue(false),
						removeSource: vi.fn().mockReturnValue(false)
					}) as any
			);

			const apiManager = await ConfigManager.create(testProjectRoot);

			const storage = apiManager.getStorageConfig();
			expect(storage).toEqual({
				type: 'api',
				apiEndpoint: 'https://api.example.com',
				apiAccessToken: 'token123'
			});
		});

		it('should return model configuration', () => {
			const models = manager.getModelConfig();
			expect(models).toEqual({
				main: 'merged-model',
				fallback: 'fallback-model'
			});
		});

		it('should return default models when not configured', () => {
			// Update the mock for current instance
			const merger = (manager as any).merger;
			merger.merge.mockReturnValue({});
			// Force re-merge
			(manager as any).config = merger.merge();

			const models = manager.getModelConfig();
			expect(models).toEqual({
				main: DEFAULT_CONFIG_VALUES.MODELS.MAIN,
				fallback: DEFAULT_CONFIG_VALUES.MODELS.FALLBACK
			});
		});

		it('should return response language', () => {
			const language = manager.getResponseLanguage();
			expect(language).toBe('English');
		});

		it('should return custom response language', () => {
			// Update config for current instance
			(manager as any).config = {
				custom: { responseLanguage: 'Spanish' }
			};

			const language = manager.getResponseLanguage();
			expect(language).toBe('Spanish');
		});

		it('should return project root', () => {
			expect(manager.getProjectRoot()).toBe(testProjectRoot);
		});

		it('should check if API is explicitly configured', () => {
			expect(manager.isApiExplicitlyConfigured()).toBe(false);
		});

		it('should detect when API is explicitly configured', () => {
			// Update config for current instance
			(manager as any).config = {
				storage: {
					type: 'api',
					apiEndpoint: 'https://api.example.com',
					apiAccessToken: 'token'
				}
			};

			expect(manager.isApiExplicitlyConfigured()).toBe(true);
		});
	});

	describe('runtime state', () => {
		// Manager is already initialized in the main beforeEach

		it('should get active tag from state manager', () => {
			const tag = manager.getActiveTag();
			expect(tag).toBe('master');
		});

		it('should set active tag through state manager', async () => {
			await manager.setActiveTag('feature-branch');

			const stateManager = (manager as any).stateManager;
			expect(stateManager.setCurrentTag).toHaveBeenCalledWith('feature-branch');
		});
	});

	describe('configuration updates', () => {
		// Manager is already initialized in the main beforeEach

		it('should update configuration and save', async () => {
			const updates = {
				models: { main: 'new-model', fallback: 'fallback-model' }
			};
			await manager.updateConfig(updates);

			const persistence = (manager as any).persistence;
			expect(persistence.saveConfig).toHaveBeenCalled();
		});

		it('should re-initialize after update to maintain precedence', async () => {
			const merger = (manager as any).merger;
			merger.clearSources.mockClear();

			await manager.updateConfig({ custom: { test: 'value' } });

			expect(merger.clearSources).toHaveBeenCalled();
		});

		it('should set response language', async () => {
			await manager.setResponseLanguage('French');

			const persistence = (manager as any).persistence;
			expect(persistence.saveConfig).toHaveBeenCalledWith(
				expect.objectContaining({
					custom: { responseLanguage: 'French' }
				})
			);
		});

		it('should save configuration with options', async () => {
			await manager.saveConfig();

			const persistence = (manager as any).persistence;
			expect(persistence.saveConfig).toHaveBeenCalledWith(expect.any(Object), {
				createBackup: true,
				atomic: true
			});
		});
	});

	describe('utilities', () => {
		// Manager is already initialized in the main beforeEach

		it('should reset configuration to defaults', async () => {
			await manager.reset();

			const persistence = (manager as any).persistence;
			const stateManager = (manager as any).stateManager;

			expect(persistence.deleteConfig).toHaveBeenCalled();
			expect(stateManager.clearState).toHaveBeenCalled();
		});

		it('should re-initialize after reset', async () => {
			const merger = (manager as any).merger;
			merger.clearSources.mockClear();

			await manager.reset();

			expect(merger.clearSources).toHaveBeenCalled();
		});

		it('should get configuration sources for debugging', () => {
			const merger = (manager as any).merger;
			const mockSources = [{ name: 'test', config: {}, precedence: 1 }];
			merger.getSources.mockReturnValue(mockSources);

			const sources = manager.getConfigSources();

			expect(sources).toEqual(mockSources);
		});
	});

	describe('error handling', () => {
		it('should handle missing services gracefully', async () => {
			// Even if a service fails, manager should still work
			const loader = (manager as any).loader;
			loader.loadLocalConfig.mockRejectedValue(new Error('File error'));

			// Creating a new manager should not throw even if service fails
			await expect(
				ConfigManager.create(testProjectRoot)
			).resolves.not.toThrow();
		});
	});
});
