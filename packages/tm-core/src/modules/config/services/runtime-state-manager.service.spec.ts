/**
 * @fileoverview Unit tests for RuntimeStateManager service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import { RuntimeStateManager } from './runtime-state-manager.service.js';
import { DEFAULT_CONFIG_VALUES } from '../../../common/interfaces/configuration.interface.js';

vi.mock('node:fs', () => ({
	promises: {
		readFile: vi.fn(),
		writeFile: vi.fn(),
		mkdir: vi.fn(),
		unlink: vi.fn()
	}
}));

describe('RuntimeStateManager', () => {
	let stateManager: RuntimeStateManager;
	const testProjectRoot = '/test/project';

	beforeEach(() => {
		stateManager = new RuntimeStateManager(testProjectRoot);
		vi.clearAllMocks();
		// Clear environment variables
		delete process.env.TASKMASTER_TAG;
	});

	afterEach(() => {
		vi.restoreAllMocks();
		delete process.env.TASKMASTER_TAG;
	});

	describe('loadState', () => {
		it('should load state from file', async () => {
			const mockState = {
				activeTag: 'feature-branch',
				lastUpdated: '2024-01-01T00:00:00.000Z',
				metadata: { test: 'data' }
			};

			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockState));

			const state = await stateManager.loadState();

			expect(fs.readFile).toHaveBeenCalledWith(
				'/test/project/.taskmaster/state.json',
				'utf-8'
			);
			expect(state.currentTag).toBe('feature-branch');
			expect(state.metadata).toEqual({ test: 'data' });
		});

		it('should override with environment variable if set', async () => {
			const mockState = { activeTag: 'file-tag' };
			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockState));

			process.env.TASKMASTER_TAG = 'env-tag';

			const state = await stateManager.loadState();

			expect(state.currentTag).toBe('env-tag');
		});

		it('should use default state when file does not exist', async () => {
			const error = new Error('File not found') as any;
			error.code = 'ENOENT';
			vi.mocked(fs.readFile).mockRejectedValue(error);

			const state = await stateManager.loadState();

			expect(state.currentTag).toBe(DEFAULT_CONFIG_VALUES.TAGS.DEFAULT_TAG);
		});

		it('should use environment variable when file does not exist', async () => {
			const error = new Error('File not found') as any;
			error.code = 'ENOENT';
			vi.mocked(fs.readFile).mockRejectedValue(error);

			process.env.TASKMASTER_TAG = 'env-tag';

			const state = await stateManager.loadState();

			expect(state.currentTag).toBe('env-tag');
		});

		it('should handle file read errors gracefully', async () => {
			vi.mocked(fs.readFile).mockRejectedValue(new Error('Permission denied'));

			const state = await stateManager.loadState();

			expect(state.currentTag).toBe(DEFAULT_CONFIG_VALUES.TAGS.DEFAULT_TAG);
		});

		it('should handle invalid JSON gracefully', async () => {
			vi.mocked(fs.readFile).mockResolvedValue('invalid json');

			// Mock console.warn to avoid noise in tests
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const state = await stateManager.loadState();

			expect(state.currentTag).toBe(DEFAULT_CONFIG_VALUES.TAGS.DEFAULT_TAG);
			expect(warnSpy).toHaveBeenCalled();

			warnSpy.mockRestore();
		});
	});

	describe('saveState', () => {
		it('should save state to file with timestamp', async () => {
			vi.mocked(fs.mkdir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			// Set a specific state
			await stateManager.setCurrentTag('test-tag');

			// Verify mkdir was called
			expect(fs.mkdir).toHaveBeenCalledWith('/test/project/.taskmaster', {
				recursive: true
			});

			// Verify writeFile was called with correct data
			expect(fs.writeFile).toHaveBeenCalledWith(
				'/test/project/.taskmaster/state.json',
				expect.stringContaining('"activeTag":"test-tag"'),
				'utf-8'
			);

			// Verify timestamp is included
			expect(fs.writeFile).toHaveBeenCalledWith(
				expect.any(String),
				expect.stringContaining('"lastUpdated"'),
				'utf-8'
			);
		});

		it('should throw TaskMasterError on save failure', async () => {
			vi.mocked(fs.mkdir).mockRejectedValue(new Error('Disk full'));

			await expect(stateManager.saveState()).rejects.toThrow(
				'Failed to save runtime state'
			);
		});

		it('should format JSON with proper indentation', async () => {
			vi.mocked(fs.mkdir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			await stateManager.saveState();

			const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
			const jsonContent = writeCall[1] as string;

			// Check for 2-space indentation
			expect(jsonContent).toMatch(/\n  /);
		});
	});

	describe('getActiveTag', () => {
		it('should return current active tag', () => {
			const tag = stateManager.getCurrentTag();
			expect(tag).toBe(DEFAULT_CONFIG_VALUES.TAGS.DEFAULT_TAG);
		});

		it('should return updated tag after setActiveTag', async () => {
			vi.mocked(fs.mkdir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			await stateManager.setCurrentTag('new-tag');

			expect(stateManager.getCurrentTag()).toBe('new-tag');
		});
	});

	describe('setActiveTag', () => {
		it('should update active tag and save state', async () => {
			vi.mocked(fs.mkdir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			await stateManager.setCurrentTag('feature-xyz');

			expect(stateManager.getCurrentTag()).toBe('feature-xyz');
			expect(fs.writeFile).toHaveBeenCalled();
		});
	});

	describe('getState', () => {
		it('should return copy of current state', () => {
			const state1 = stateManager.getState();
			const state2 = stateManager.getState();

			expect(state1).not.toBe(state2); // Different instances
			expect(state1).toEqual(state2); // Same content
			expect(state1.currentTag).toBe(DEFAULT_CONFIG_VALUES.TAGS.DEFAULT_TAG);
		});
	});

	describe('updateMetadata', () => {
		it('should update metadata and save state', async () => {
			vi.mocked(fs.mkdir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			await stateManager.updateMetadata({ key1: 'value1' });

			const state = stateManager.getState();
			expect(state.metadata).toEqual({ key1: 'value1' });
			expect(fs.writeFile).toHaveBeenCalled();
		});

		it('should merge metadata with existing values', async () => {
			vi.mocked(fs.mkdir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			await stateManager.updateMetadata({ key1: 'value1' });
			await stateManager.updateMetadata({ key2: 'value2' });

			const state = stateManager.getState();
			expect(state.metadata).toEqual({
				key1: 'value1',
				key2: 'value2'
			});
		});

		it('should override existing metadata values', async () => {
			vi.mocked(fs.mkdir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			await stateManager.updateMetadata({ key1: 'value1' });
			await stateManager.updateMetadata({ key1: 'value2' });

			const state = stateManager.getState();
			expect(state.metadata).toEqual({ key1: 'value2' });
		});
	});

	describe('clearState', () => {
		it('should delete state file and reset to defaults', async () => {
			vi.mocked(fs.unlink).mockResolvedValue(undefined);

			await stateManager.clearState();

			expect(fs.unlink).toHaveBeenCalledWith(
				'/test/project/.taskmaster/state.json'
			);
			expect(stateManager.getCurrentTag()).toBe(
				DEFAULT_CONFIG_VALUES.TAGS.DEFAULT_TAG
			);
			expect(stateManager.getState().metadata).toBeUndefined();
		});

		it('should ignore ENOENT errors when file does not exist', async () => {
			const error = new Error('File not found') as any;
			error.code = 'ENOENT';
			vi.mocked(fs.unlink).mockRejectedValue(error);

			await expect(stateManager.clearState()).resolves.not.toThrow();
			expect(stateManager.getCurrentTag()).toBe(
				DEFAULT_CONFIG_VALUES.TAGS.DEFAULT_TAG
			);
		});

		it('should throw other errors', async () => {
			vi.mocked(fs.unlink).mockRejectedValue(new Error('Permission denied'));

			await expect(stateManager.clearState()).rejects.toThrow(
				'Permission denied'
			);
		});
	});
});
