/**
 * @fileoverview Tests for FileStorage cleanup in ExportService
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Use vi.hoisted to define mocks that will be available during hoisting
const {
	mockInitialize,
	mockLoadTasks,
	mockClose,
	MockFileStorage,
	MockAuthDomain
} = vi.hoisted(() => {
	const mockInitialize = vi.fn().mockResolvedValue(undefined);
	const mockLoadTasks = vi.fn().mockResolvedValue([]);
	const mockClose = vi.fn().mockResolvedValue(undefined);

	class MockFileStorage {
		initialize = mockInitialize;
		loadTasks = mockLoadTasks;
		close = mockClose;
	}

	class MockAuthDomain {
		getApiBaseUrl() {
			return 'https://api.example.com';
		}
	}

	return {
		mockInitialize,
		mockLoadTasks,
		mockClose,
		MockFileStorage,
		MockAuthDomain
	};
});

// Mock FileStorage module
vi.mock('../../storage/adapters/file-storage/index.js', () => ({
	FileStorage: MockFileStorage
}));

vi.mock('../../auth/auth-domain.js', () => ({
	AuthDomain: MockAuthDomain
}));

import { ExportService } from './export.service.js';
import type { ConfigManager } from '../../config/managers/config-manager.js';
import type { AuthManager } from '../../auth/managers/auth-manager.js';

describe('ExportService - FileStorage cleanup', () => {
	let exportService: ExportService;
	let mockConfigManager: ConfigManager;
	let mockAuthManager: AuthManager;

	beforeEach(() => {
		vi.clearAllMocks();

		// Reset mock implementations
		mockInitialize.mockResolvedValue(undefined);
		mockLoadTasks.mockResolvedValue([]);
		mockClose.mockResolvedValue(undefined);

		// Stub global fetch to prevent leakage
		vi.stubGlobal('fetch', vi.fn());

		mockConfigManager = {
			getProjectRoot: vi.fn().mockReturnValue('/test/project'),
			getActiveTag: vi.fn().mockReturnValue('default')
		} as unknown as ConfigManager;

		mockAuthManager = {
			hasValidSession: vi.fn().mockResolvedValue(true),
			getContext: vi.fn().mockResolvedValue({
				orgId: 'test-org',
				briefId: 'test-brief'
			}),
			getAccessToken: vi.fn().mockResolvedValue('test-token'),
			getOrganizations: vi.fn().mockResolvedValue([{ id: 'test-org' }])
		} as unknown as AuthManager;

		exportService = new ExportService(mockConfigManager, mockAuthManager);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('exportTasks - FileStorage cleanup', () => {
		it('should close FileStorage after successful task loading', async () => {
			mockLoadTasks.mockResolvedValue([]);

			const result = await exportService.exportTasks({});

			expect(mockInitialize).toHaveBeenCalledOnce();
			expect(mockClose).toHaveBeenCalledOnce();
			expect(result.success).toBe(false); // No tasks to export
			expect(result.message).toBe('No tasks found to export');
		});

		it('should close FileStorage even when loadTasks throws an error', async () => {
			const testError = new Error('Failed to load tasks');
			mockLoadTasks.mockRejectedValue(testError);

			await expect(exportService.exportTasks({})).rejects.toThrow(
				'Failed to load tasks'
			);

			expect(mockInitialize).toHaveBeenCalledOnce();
			expect(mockClose).toHaveBeenCalledOnce();
		});

		it('should close FileStorage even when initialize throws an error', async () => {
			const testError = new Error('Failed to initialize storage');
			mockInitialize.mockRejectedValue(testError);

			await expect(exportService.exportTasks({})).rejects.toThrow(
				'Failed to initialize storage'
			);

			expect(mockInitialize).toHaveBeenCalledOnce();
			expect(mockClose).toHaveBeenCalledOnce();
		});

		it('should close FileStorage with tasks loaded successfully', async () => {
			const mockTasks = [
				{
					id: 1,
					title: 'Test Task',
					status: 'pending',
					description: 'Test description'
				}
			];
			mockLoadTasks.mockResolvedValue(mockTasks);

			// Mock fetch to prevent actual API call
			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						successCount: 1,
						totalTasks: 1,
						failedCount: 0,
						results: []
					})
			} as Response);

			const result = await exportService.exportTasks({});

			expect(mockClose).toHaveBeenCalledOnce();
			expect(result.success).toBe(true);
		});
	});

	describe('generateBriefFromTasks - FileStorage cleanup', () => {
		it('should close FileStorage after successful task loading', async () => {
			mockLoadTasks.mockResolvedValue([]);

			const result = await exportService.generateBriefFromTasks({});

			expect(mockInitialize).toHaveBeenCalledOnce();
			expect(mockClose).toHaveBeenCalledOnce();
			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('NO_TASKS');
		});

		it('should close FileStorage even when loadTasks throws an error', async () => {
			const testError = new Error('Storage read error');
			mockLoadTasks.mockRejectedValue(testError);

			await expect(exportService.generateBriefFromTasks({})).rejects.toThrow(
				'Storage read error'
			);

			expect(mockInitialize).toHaveBeenCalledOnce();
			expect(mockClose).toHaveBeenCalledOnce();
		});

		it('should close FileStorage even when initialize throws an error', async () => {
			const testError = new Error('Storage init failed');
			mockInitialize.mockRejectedValue(testError);

			await expect(exportService.generateBriefFromTasks({})).rejects.toThrow(
				'Storage init failed'
			);

			expect(mockInitialize).toHaveBeenCalledOnce();
			expect(mockClose).toHaveBeenCalledOnce();
		});

		it('should close FileStorage before making API call', async () => {
			const mockTasks = [
				{
					id: 1,
					title: 'Test Task',
					status: 'pending',
					description: 'Test',
					dependencies: []
				}
			];
			mockLoadTasks.mockResolvedValue(mockTasks);

			// Track call order
			const callOrder: string[] = [];
			mockClose.mockImplementation(() => {
				callOrder.push('close');
				return Promise.resolve();
			});

			// Mock fetch
			vi.mocked(fetch).mockImplementation(() => {
				callOrder.push('fetch');
				return Promise.resolve({
					ok: true,
					headers: {
						get: () => 'application/json'
					},
					json: () =>
						Promise.resolve({
							success: true,
							brief: {
								id: 'brief-123',
								url: 'https://example.com/brief',
								title: 'Test Brief',
								description: 'Test',
								taskCount: 1
							},
							taskMapping: []
						})
				} as Response);
			});

			const result = await exportService.generateBriefFromTasks({});

			// Verify close was called before fetch
			expect(mockClose).toHaveBeenCalledOnce();
			expect(callOrder).toEqual(['close', 'fetch']);
			expect(result.success).toBe(true);
		});
	});

	describe('FileStorage cleanup on authentication errors', () => {
		it('exportTasks should not create FileStorage when auth check fails', async () => {
			// Create a fresh mock to track FileStorage instantiation
			vi.clearAllMocks();

			mockAuthManager.hasValidSession = vi.fn().mockResolvedValue(false);
			exportService = new ExportService(mockConfigManager, mockAuthManager);

			await expect(exportService.exportTasks({})).rejects.toThrow(
				'Authentication required'
			);

			// FileStorage methods should not be called when auth fails early
			expect(mockInitialize).not.toHaveBeenCalled();
			expect(mockLoadTasks).not.toHaveBeenCalled();
			expect(mockClose).not.toHaveBeenCalled();
		});

		it('generateBriefFromTasks should not create FileStorage when auth check fails', async () => {
			// Create a fresh mock to track FileStorage instantiation
			vi.clearAllMocks();

			mockAuthManager.hasValidSession = vi.fn().mockResolvedValue(false);
			exportService = new ExportService(mockConfigManager, mockAuthManager);

			await expect(exportService.generateBriefFromTasks({})).rejects.toThrow(
				'Authentication required'
			);

			// FileStorage methods should not be called when auth fails early
			expect(mockInitialize).not.toHaveBeenCalled();
			expect(mockLoadTasks).not.toHaveBeenCalled();
			expect(mockClose).not.toHaveBeenCalled();
		});
	});
});
