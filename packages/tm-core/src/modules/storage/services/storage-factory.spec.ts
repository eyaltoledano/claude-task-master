/**
 * @fileoverview Tests for StorageFactory auto-detection logic
 * Specifically covers HAM-1167: solo-mode projects should not
 * auto-escalate to API storage based on global auth state.
 */

import fsSync from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockHasValidSession, mockGetAccessToken, mockGetContext } = vi.hoisted(
	() => ({
		mockHasValidSession: vi.fn(),
		mockGetAccessToken: vi.fn(),
		mockGetContext: vi.fn()
	})
);

vi.mock('node:fs', () => ({
	default: { existsSync: vi.fn() }
}));

vi.mock('../../auth/managers/auth-manager.js', () => ({
	AuthManager: {
		getInstance: vi.fn(() => ({
			hasValidSession: mockHasValidSession,
			getAccessToken: mockGetAccessToken,
			getContext: mockGetContext
		}))
	}
}));

vi.mock('../../integration/clients/supabase-client.js', () => ({
	SupabaseAuthClient: {
		getInstance: vi.fn(() => ({
			getClient: vi.fn(() => ({}))
		}))
	}
}));

vi.mock('../adapters/api-storage.js', () => ({
	ApiStorage: vi.fn()
}));

vi.mock('../adapters/file-storage/index.js', () => ({
	FileStorage: vi.fn()
}));

import type { IConfiguration } from '../../../common/interfaces/configuration.interface.js';
import { FileStorage } from '../adapters/file-storage/index.js';
import { ApiStorage } from '../adapters/api-storage.js';
import { StorageFactory } from './storage-factory.js';

describe('StorageFactory', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockHasValidSession.mockResolvedValue(false);
		mockGetAccessToken.mockResolvedValue(null);
		mockGetContext.mockReturnValue(null);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('hasLocalTaskFiles', () => {
		it('should return true when tasks.json exists', () => {
			vi.mocked(fsSync.existsSync).mockReturnValue(true);

			expect(StorageFactory.hasLocalTaskFiles('/my/project')).toBe(true);
			expect(fsSync.existsSync).toHaveBeenCalledWith(
				expect.stringContaining('.taskmaster/tasks/tasks.json')
			);
		});

		it('should return false when tasks.json does not exist', () => {
			vi.mocked(fsSync.existsSync).mockReturnValue(false);

			expect(StorageFactory.hasLocalTaskFiles('/my/project')).toBe(false);
		});
	});

	describe('auto storage type - solo mode detection (HAM-1167)', () => {
		it('should use file storage when local task files exist and no brief is selected', async () => {
			// Simulate: user logged in but no brief selected for this workspace
			mockHasValidSession.mockResolvedValue(true);
			mockGetAccessToken.mockResolvedValue('some-token');
			mockGetContext.mockReturnValue({
				orgId: 'some-org'
				// No briefId — user hasn't selected a brief
			});

			// Simulate: current project has local task files (solo mode)
			vi.mocked(fsSync.existsSync).mockReturnValue(true);

			const config: Partial<IConfiguration> = {
				storage: { type: 'auto' }
			} as Partial<IConfiguration>;
			await StorageFactory.create(config, '/solo/project');

			// Should use FileStorage because no brief is selected
			expect(FileStorage).toHaveBeenCalled();
			expect(ApiStorage).not.toHaveBeenCalled();
		});

		it('should use API storage when local task files exist but brief is explicitly selected', async () => {
			// Simulate: user has selected a brief for this workspace
			mockHasValidSession.mockResolvedValue(true);
			mockGetAccessToken.mockResolvedValue('valid-token');
			mockGetContext.mockReturnValue({
				briefId: 'my-brief',
				briefName: 'My Brief',
				orgSlug: 'my-org'
			});

			// Simulate: current project also has local task files
			vi.mocked(fsSync.existsSync).mockReturnValue(true);

			const config: Partial<IConfiguration> = {
				storage: { type: 'auto' }
			} as Partial<IConfiguration>;
			await StorageFactory.create(config, '/solo/project');

			// Should use ApiStorage because brief is explicitly selected
			expect(ApiStorage).toHaveBeenCalled();
			expect(FileStorage).not.toHaveBeenCalled();
		});

		it('should use API storage when no local task files and valid session with brief', async () => {
			mockHasValidSession.mockResolvedValue(true);
			mockGetAccessToken.mockResolvedValue('valid-token');
			mockGetContext.mockReturnValue({
				briefId: 'my-brief',
				briefName: 'My Brief'
			});

			// No local task files
			vi.mocked(fsSync.existsSync).mockReturnValue(false);

			const config: Partial<IConfiguration> = {
				storage: { type: 'auto' }
			} as Partial<IConfiguration>;
			await StorageFactory.create(config, '/api/project');

			// Should use ApiStorage
			expect(ApiStorage).toHaveBeenCalled();
			expect(FileStorage).not.toHaveBeenCalled();
		});

		it('should use file storage when no local task files, valid session, but no brief selected', async () => {
			mockHasValidSession.mockResolvedValue(true);
			mockGetAccessToken.mockResolvedValue('valid-token');
			mockGetContext.mockReturnValue(null);

			vi.mocked(fsSync.existsSync).mockReturnValue(false);

			const config: Partial<IConfiguration> = {
				storage: { type: 'auto' }
			} as Partial<IConfiguration>;
			await StorageFactory.create(config, '/some/project');

			expect(FileStorage).toHaveBeenCalled();
			expect(ApiStorage).not.toHaveBeenCalled();
		});
	});
});
