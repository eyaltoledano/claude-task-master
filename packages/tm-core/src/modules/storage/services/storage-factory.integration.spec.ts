/**
 * @fileoverview Integration test for HAM-1167 fix
 *
 * Uses REAL filesystem (temp directories with real files) to verify
 * that solo-mode projects don't leak brief context from other repos.
 *
 * Only the auth layer is mocked (no real Hamster session available).
 */

import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const { mockHasValidSession, mockGetAccessToken, mockGetContext } = vi.hoisted(
	() => ({
		mockHasValidSession: vi.fn(),
		mockGetAccessToken: vi.fn(),
		mockGetContext: vi.fn()
	})
);

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
import { ApiStorage } from '../adapters/api-storage.js';
import { FileStorage } from '../adapters/file-storage/index.js';
import { StorageFactory } from './storage-factory.js';

describe('HAM-1167 integration: real filesystem solo-mode detection', () => {
	let soloProjectDir: string;
	let emptyProjectDir: string;

	beforeAll(() => {
		// Create real temp directories
		const base = fsSync.mkdtempSync(path.join(os.tmpdir(), 'ham-1167-'));

		// Solo-mode project: has .taskmaster/tasks/tasks.json on disk
		soloProjectDir = path.join(base, 'solo-project');
		const tasksDir = path.join(soloProjectDir, '.taskmaster', 'tasks');
		fsSync.mkdirSync(tasksDir, { recursive: true });
		fsSync.writeFileSync(
			path.join(tasksDir, 'tasks.json'),
			JSON.stringify({ tasks: [{ id: 1, title: 'Local task' }] })
		);

		// Empty project: no .taskmaster directory at all
		emptyProjectDir = path.join(base, 'empty-project');
		fsSync.mkdirSync(emptyProjectDir, { recursive: true });
	});

	afterAll(() => {
		// Cleanup handled by OS temp dir, but be explicit
		fsSync.rmSync(path.dirname(soloProjectDir), {
			recursive: true,
			force: true
		});
	});

	it('hasLocalTaskFiles returns true for real solo-mode directory', () => {
		// No mocks on fs — this hits the real filesystem
		expect(StorageFactory.hasLocalTaskFiles(soloProjectDir)).toBe(true);
	});

	it('hasLocalTaskFiles returns false for real empty directory', () => {
		expect(StorageFactory.hasLocalTaskFiles(emptyProjectDir)).toBe(false);
	});

	it('auto storage uses file storage for real solo-mode dir when no brief is selected', async () => {
		// Simulate: user is logged in but hasn't selected a brief for this workspace
		mockHasValidSession.mockResolvedValue(true);
		mockGetAccessToken.mockResolvedValue('some-token');
		mockGetContext.mockReturnValue({
			orgId: 'some-org'
			// No briefId — no brief selected
		});

		const config = {
			storage: { type: 'auto' }
		} as Partial<IConfiguration>;

		await StorageFactory.create(config, soloProjectDir);

		// Solo-mode project with no brief selected → FileStorage
		expect(FileStorage).toHaveBeenCalled();
		expect(ApiStorage).not.toHaveBeenCalled();
	});

	it('auto storage uses API storage for real solo-mode dir when brief is explicitly selected', async () => {
		// Simulate: user has explicitly selected a brief for this workspace
		mockHasValidSession.mockResolvedValue(true);
		mockGetAccessToken.mockResolvedValue('valid-token');
		mockGetContext.mockReturnValue({
			briefId: 'my-brief',
			briefName: 'My Brief',
			orgSlug: 'my-org'
		});

		const config = {
			storage: { type: 'auto' }
		} as Partial<IConfiguration>;

		vi.mocked(FileStorage).mockClear();
		vi.mocked(ApiStorage).mockClear();

		await StorageFactory.create(config, soloProjectDir);

		// Brief explicitly selected → API storage, even with local files
		expect(ApiStorage).toHaveBeenCalled();
		expect(FileStorage).not.toHaveBeenCalled();
	});

	it('auto storage uses API storage for real empty dir with active Hamster session', async () => {
		mockHasValidSession.mockResolvedValue(true);
		mockGetAccessToken.mockResolvedValue('valid-token');
		mockGetContext.mockReturnValue({
			briefId: 'my-brief',
			briefName: 'My Brief'
		});

		const config = {
			storage: { type: 'auto' }
		} as Partial<IConfiguration>;

		vi.mocked(FileStorage).mockClear();
		vi.mocked(ApiStorage).mockClear();

		await StorageFactory.create(config, emptyProjectDir);

		// Empty project with active session → should use API storage
		expect(ApiStorage).toHaveBeenCalled();
		expect(FileStorage).not.toHaveBeenCalled();
	});
});
