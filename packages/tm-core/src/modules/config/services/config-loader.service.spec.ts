/**
 * @fileoverview Unit tests for ConfigLoader service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import { ConfigLoader } from './config-loader.service.js';
import { DEFAULT_CONFIG_VALUES } from '../../../common/interfaces/configuration.interface.js';

vi.mock('node:fs', () => ({
	promises: {
		readFile: vi.fn(),
		access: vi.fn()
	}
}));

describe('ConfigLoader', () => {
	let configLoader: ConfigLoader;
	const testProjectRoot = '/test/project';

	beforeEach(() => {
		configLoader = new ConfigLoader(testProjectRoot);
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('getDefaultConfig', () => {
		it('should return default configuration values', () => {
			const config = configLoader.getDefaultConfig();

			expect(config.models).toEqual({
				main: DEFAULT_CONFIG_VALUES.MODELS.MAIN,
				fallback: DEFAULT_CONFIG_VALUES.MODELS.FALLBACK
			});

			expect(config.storage).toEqual({
				type: DEFAULT_CONFIG_VALUES.STORAGE.TYPE,
				encoding: DEFAULT_CONFIG_VALUES.STORAGE.ENCODING,
				enableBackup: false,
				maxBackups: DEFAULT_CONFIG_VALUES.STORAGE.MAX_BACKUPS,
				enableCompression: false,
				atomicOperations: true
			});

			expect(config.version).toBe(DEFAULT_CONFIG_VALUES.VERSION);
		});
	});

	describe('loadLocalConfig', () => {
		it('should load and parse local configuration file', async () => {
			const mockConfig = {
				models: { main: 'test-model' },
				storage: { type: 'api' as const }
			};

			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

			const result = await configLoader.loadLocalConfig();

			expect(fs.readFile).toHaveBeenCalledWith(
				'/test/project/.taskmaster/config.json',
				'utf-8'
			);
			expect(result).toEqual(mockConfig);
		});

		it('should return null when config file does not exist', async () => {
			const error = new Error('File not found') as any;
			error.code = 'ENOENT';
			vi.mocked(fs.readFile).mockRejectedValue(error);

			const result = await configLoader.loadLocalConfig();

			expect(result).toBeNull();
		});

		it('should throw TaskMasterError for other file errors', async () => {
			const error = new Error('Permission denied');
			vi.mocked(fs.readFile).mockRejectedValue(error);

			await expect(configLoader.loadLocalConfig()).rejects.toThrow(
				'Failed to load local configuration'
			);
		});

		it('should throw error for invalid JSON', async () => {
			vi.mocked(fs.readFile).mockResolvedValue('invalid json');

			await expect(configLoader.loadLocalConfig()).rejects.toThrow();
		});
	});

	describe('loadGlobalConfig', () => {
		it('should return null (not implemented yet)', async () => {
			const result = await configLoader.loadGlobalConfig();
			expect(result).toBeNull();
		});
	});

	describe('hasLocalConfig', () => {
		it('should return true when local config exists', async () => {
			vi.mocked(fs.access).mockResolvedValue(undefined);

			const result = await configLoader.hasLocalConfig();

			expect(fs.access).toHaveBeenCalledWith(
				'/test/project/.taskmaster/config.json'
			);
			expect(result).toBe(true);
		});

		it('should return false when local config does not exist', async () => {
			vi.mocked(fs.access).mockRejectedValue(new Error('Not found'));

			const result = await configLoader.hasLocalConfig();

			expect(result).toBe(false);
		});
	});

	describe('hasGlobalConfig', () => {
		it('should check global config path', async () => {
			vi.mocked(fs.access).mockResolvedValue(undefined);

			const result = await configLoader.hasGlobalConfig();

			expect(fs.access).toHaveBeenCalledWith(
				expect.stringContaining('.taskmaster/config.json')
			);
			expect(result).toBe(true);
		});

		it('should return false when global config does not exist', async () => {
			vi.mocked(fs.access).mockRejectedValue(new Error('Not found'));

			const result = await configLoader.hasGlobalConfig();

			expect(result).toBe(false);
		});
	});
});
