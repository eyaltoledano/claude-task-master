/**
 * @fileoverview Unit tests for ConfigPersistence service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import { ConfigPersistence } from './config-persistence.service.js';
import type { PartialConfiguration } from '@tm/core/common/interfaces/configuration.interface.js';

vi.mock('node:fs', () => ({
	promises: {
		readFile: vi.fn(),
		writeFile: vi.fn(),
		mkdir: vi.fn(),
		unlink: vi.fn(),
		access: vi.fn(),
		readdir: vi.fn(),
		rename: vi.fn()
	}
}));

describe('ConfigPersistence', () => {
	let persistence: ConfigPersistence;
	const testProjectRoot = '/test/project';

	beforeEach(() => {
		persistence = new ConfigPersistence(testProjectRoot);
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('saveConfig', () => {
		const mockConfig: PartialConfiguration = {
			models: { main: 'test-model', fallback: 'test-fallback' },
			storage: {
				type: 'file' as const,
				enableBackup: true,
				maxBackups: 5,
				enableCompression: true,
				encoding: 'utf-8',
				atomicOperations: true
			}
		};

		it('should save configuration to file', async () => {
			vi.mocked(fs.mkdir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			await persistence.saveConfig(mockConfig);

			expect(fs.mkdir).toHaveBeenCalledWith('/test/project/.taskmaster', {
				recursive: true
			});

			expect(fs.writeFile).toHaveBeenCalledWith(
				'/test/project/.taskmaster/config.json',
				JSON.stringify(mockConfig, null, 2),
				'utf-8'
			);
		});

		it('should use atomic write when specified', async () => {
			vi.mocked(fs.mkdir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);
			vi.mocked(fs.rename).mockResolvedValue(undefined);

			await persistence.saveConfig(mockConfig, { atomic: true });

			// Should write to temp file first
			expect(fs.writeFile).toHaveBeenCalledWith(
				'/test/project/.taskmaster/config.json.tmp',
				JSON.stringify(mockConfig, null, 2),
				'utf-8'
			);

			// Then rename to final location
			expect(fs.rename).toHaveBeenCalledWith(
				'/test/project/.taskmaster/config.json.tmp',
				'/test/project/.taskmaster/config.json'
			);
		});

		it('should create backup when requested', async () => {
			vi.mocked(fs.mkdir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);
			vi.mocked(fs.access).mockResolvedValue(undefined); // Config exists
			vi.mocked(fs.readFile).mockResolvedValue('{"old": "config"}');
			vi.mocked(fs.readdir).mockResolvedValue([]);

			await persistence.saveConfig(mockConfig, { createBackup: true });

			// Should create backup directory
			expect(fs.mkdir).toHaveBeenCalledWith(
				'/test/project/.taskmaster/backups',
				{ recursive: true }
			);

			// Should read existing config for backup
			expect(fs.readFile).toHaveBeenCalledWith(
				'/test/project/.taskmaster/config.json',
				'utf-8'
			);

			// Should write backup file
			expect(fs.writeFile).toHaveBeenCalledWith(
				expect.stringContaining('/test/project/.taskmaster/backups/config-'),
				'{"old": "config"}',
				'utf-8'
			);
		});

		it('should not create backup if config does not exist', async () => {
			vi.mocked(fs.mkdir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);
			vi.mocked(fs.access).mockRejectedValue(new Error('Not found'));

			await persistence.saveConfig(mockConfig, { createBackup: true });

			// Should not read or create backup
			expect(fs.readFile).not.toHaveBeenCalled();
			expect(fs.writeFile).toHaveBeenCalledTimes(1); // Only the main config
		});

		it('should throw TaskMasterError on save failure', async () => {
			vi.mocked(fs.mkdir).mockRejectedValue(new Error('Disk full'));

			await expect(persistence.saveConfig(mockConfig)).rejects.toThrow(
				'Failed to save configuration'
			);
		});
	});

	describe('configExists', () => {
		it('should return true when config exists', async () => {
			vi.mocked(fs.access).mockResolvedValue(undefined);

			const exists = await persistence.configExists();

			expect(fs.access).toHaveBeenCalledWith(
				'/test/project/.taskmaster/config.json'
			);
			expect(exists).toBe(true);
		});

		it('should return false when config does not exist', async () => {
			vi.mocked(fs.access).mockRejectedValue(new Error('Not found'));

			const exists = await persistence.configExists();

			expect(exists).toBe(false);
		});
	});

	describe('deleteConfig', () => {
		it('should delete configuration file', async () => {
			vi.mocked(fs.unlink).mockResolvedValue(undefined);

			await persistence.deleteConfig();

			expect(fs.unlink).toHaveBeenCalledWith(
				'/test/project/.taskmaster/config.json'
			);
		});

		it('should not throw when file does not exist', async () => {
			const error = new Error('File not found') as any;
			error.code = 'ENOENT';
			vi.mocked(fs.unlink).mockRejectedValue(error);

			await expect(persistence.deleteConfig()).resolves.not.toThrow();
		});

		it('should throw TaskMasterError for other errors', async () => {
			vi.mocked(fs.unlink).mockRejectedValue(new Error('Permission denied'));

			await expect(persistence.deleteConfig()).rejects.toThrow(
				'Failed to delete configuration'
			);
		});
	});

	describe('getBackups', () => {
		it('should return list of backup files sorted newest first', async () => {
			vi.mocked(fs.readdir).mockResolvedValue([
				'config-2024-01-01T10-00-00-000Z.json',
				'config-2024-01-02T10-00-00-000Z.json',
				'config-2024-01-03T10-00-00-000Z.json',
				'other-file.txt'
			] as any);

			const backups = await persistence.getBackups();

			expect(fs.readdir).toHaveBeenCalledWith(
				'/test/project/.taskmaster/backups'
			);

			expect(backups).toEqual([
				'config-2024-01-03T10-00-00-000Z.json',
				'config-2024-01-02T10-00-00-000Z.json',
				'config-2024-01-01T10-00-00-000Z.json'
			]);
		});

		it('should return empty array when backup directory does not exist', async () => {
			vi.mocked(fs.readdir).mockRejectedValue(new Error('Not found'));

			const backups = await persistence.getBackups();

			expect(backups).toEqual([]);
		});

		it('should filter out non-backup files', async () => {
			vi.mocked(fs.readdir).mockResolvedValue([
				'config-2024-01-01T10-00-00-000Z.json',
				'README.md',
				'.DS_Store',
				'config.json',
				'config-backup.json' // Wrong format
			] as any);

			const backups = await persistence.getBackups();

			expect(backups).toEqual(['config-2024-01-01T10-00-00-000Z.json']);
		});
	});

	describe('restoreFromBackup', () => {
		const backupFile = 'config-2024-01-01T10-00-00-000Z.json';
		const backupContent = '{"restored": "config"}';

		it('should restore configuration from backup', async () => {
			vi.mocked(fs.readFile).mockResolvedValue(backupContent);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			await persistence.restoreFromBackup(backupFile);

			expect(fs.readFile).toHaveBeenCalledWith(
				`/test/project/.taskmaster/backups/${backupFile}`,
				'utf-8'
			);

			expect(fs.writeFile).toHaveBeenCalledWith(
				'/test/project/.taskmaster/config.json',
				backupContent,
				'utf-8'
			);
		});

		it('should throw TaskMasterError when backup file not found', async () => {
			vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

			await expect(
				persistence.restoreFromBackup('nonexistent.json')
			).rejects.toThrow('Failed to restore from backup');
		});

		it('should throw TaskMasterError on write failure', async () => {
			vi.mocked(fs.readFile).mockResolvedValue(backupContent);
			vi.mocked(fs.writeFile).mockRejectedValue(new Error('Disk full'));

			await expect(persistence.restoreFromBackup(backupFile)).rejects.toThrow(
				'Failed to restore from backup'
			);
		});
	});

	describe('backup management', () => {
		it('should clean old backups when limit exceeded', async () => {
			vi.mocked(fs.mkdir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);
			vi.mocked(fs.access).mockResolvedValue(undefined);
			vi.mocked(fs.readFile).mockResolvedValue('{"old": "config"}');
			vi.mocked(fs.unlink).mockResolvedValue(undefined);

			// Mock 7 existing backups
			vi.mocked(fs.readdir).mockResolvedValue([
				'config-2024-01-01T10-00-00-000Z.json',
				'config-2024-01-02T10-00-00-000Z.json',
				'config-2024-01-03T10-00-00-000Z.json',
				'config-2024-01-04T10-00-00-000Z.json',
				'config-2024-01-05T10-00-00-000Z.json',
				'config-2024-01-06T10-00-00-000Z.json',
				'config-2024-01-07T10-00-00-000Z.json'
			] as any);

			await persistence.saveConfig({}, { createBackup: true });

			// Should delete oldest backups (keeping 5)
			expect(fs.unlink).toHaveBeenCalledWith(
				'/test/project/.taskmaster/backups/config-2024-01-01T10-00-00-000Z.json'
			);
			expect(fs.unlink).toHaveBeenCalledWith(
				'/test/project/.taskmaster/backups/config-2024-01-02T10-00-00-000Z.json'
			);
		});

		it('should handle backup cleanup errors gracefully', async () => {
			vi.mocked(fs.mkdir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);
			vi.mocked(fs.access).mockResolvedValue(undefined);
			vi.mocked(fs.readFile).mockResolvedValue('{"old": "config"}');
			vi.mocked(fs.readdir).mockResolvedValue(['config-old.json'] as any);
			vi.mocked(fs.unlink).mockRejectedValue(new Error('Permission denied'));

			// Mock console.warn to verify it's called
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			// Should not throw even if cleanup fails
			await expect(
				persistence.saveConfig({}, { createBackup: true })
			).resolves.not.toThrow();

			expect(warnSpy).toHaveBeenCalledWith(
				'Failed to clean old backups:',
				expect.any(Error)
			);

			warnSpy.mockRestore();
		});
	});
});
