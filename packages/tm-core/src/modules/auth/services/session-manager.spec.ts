/**
 * Tests for SessionManager
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the logger
const mockLogger = {
	warn: vi.fn(),
	info: vi.fn(),
	debug: vi.fn(),
	error: vi.fn()
};

vi.mock('../../../common/logger/index.js', () => ({
	getLogger: () => mockLogger
}));

// Mock fs with default implementations
vi.mock('fs', () => ({
	default: {
		existsSync: vi.fn(() => false),
		unlinkSync: vi.fn()
	},
	existsSync: vi.fn(() => false),
	unlinkSync: vi.fn()
}));

// Mock SupabaseAuthClient
const mockSupabaseClient = {
	initialize: vi.fn(),
	getSession: vi.fn(),
	getUser: vi.fn(),
	verifyOneTimeCode: vi.fn(),
	checkMFARequired: vi.fn(),
	verifyMFA: vi.fn(),
	refreshSession: vi.fn(),
	signOut: vi.fn()
};

vi.mock('../../integration/clients/supabase-client.js', () => ({
	SupabaseAuthClient: vi.fn(() => mockSupabaseClient)
}));

// Mock ContextStore
const mockContextStore = {
	getUserContext: vi.fn(),
	getContext: vi.fn(),
	saveContext: vi.fn(),
	clearContext: vi.fn()
};

vi.mock('./context-store.js', () => ({
	ContextStore: {
		getInstance: () => mockContextStore
	}
}));

import { AuthenticationError } from '../types.js';
import { SessionManager } from './session-manager.js';

describe('SessionManager', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Initialization', () => {
		it('should initialize session on construction', async () => {
			mockSupabaseClient.initialize.mockResolvedValue(undefined);

			const sessionManager = new SessionManager(
				mockSupabaseClient as any,
				mockContextStore as any
			);

			// Wait for initialization to complete
			await sessionManager.waitForInitialization();

			expect(mockSupabaseClient.initialize).toHaveBeenCalled();
		});

		it('should handle initialization errors gracefully', async () => {
			mockSupabaseClient.initialize.mockRejectedValue(new Error('No session'));

			const sessionManager = new SessionManager(
				mockSupabaseClient as any,
				mockContextStore as any
			);

			// Should not throw
			await expect(
				sessionManager.waitForInitialization()
			).resolves.toBeUndefined();

			expect(mockLogger.debug).toHaveBeenCalledWith(
				'No existing session to restore'
			);
		});

		it('should prevent race conditions by waiting for initialization', async () => {
			let initResolved = false;
			mockSupabaseClient.initialize.mockImplementation(async () => {
				await new Promise((resolve) => setTimeout(resolve, 100));
				initResolved = true;
			});

			const sessionManager = new SessionManager(
				mockSupabaseClient as any,
				mockContextStore as any
			);

			// Call method that should wait for initialization
			const sessionPromise = sessionManager.getSession();

			// Verify init hasn't completed yet
			expect(initResolved).toBe(false);

			await sessionPromise;

			// Now it should have completed
			expect(initResolved).toBe(true);
		});
	});

	describe('Legacy Migration', () => {
		const LEGACY_AUTH_FILE = path.join(
			os.homedir(),
			'.taskmaster',
			'auth.json'
		);

		it('should delete legacy file if valid session exists', async () => {
			// Setup all mocks before creating SessionManager
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.unlinkSync).mockReturnValue(undefined);

			// Mock initialization to succeed
			mockSupabaseClient.initialize.mockResolvedValue(undefined);

			// First call in migrateLegacyAuth, second call checks session
			mockSupabaseClient.getSession
				.mockResolvedValueOnce({
					access_token: 'valid-token',
					user: { id: 'user-1', email: 'test@example.com' }
				})
				.mockResolvedValue({
					access_token: 'valid-token',
					user: { id: 'user-1', email: 'test@example.com' }
				});

			const sessionManager = new SessionManager(
				mockSupabaseClient as any,
				mockContextStore as any
			);

			await sessionManager.waitForInitialization();

			expect(fs.unlinkSync).toHaveBeenCalledWith(LEGACY_AUTH_FILE);
			expect(mockLogger.info).toHaveBeenCalledWith(
				expect.stringContaining('Migrated to Supabase auth')
			);
		});

		it('should warn if legacy file exists but no session', async () => {
			// Setup all mocks before creating SessionManager
			vi.mocked(fs.existsSync).mockReturnValue(true);

			// Mock initialization to succeed
			mockSupabaseClient.initialize.mockResolvedValue(undefined);

			// No session available
			mockSupabaseClient.getSession.mockResolvedValue(null);

			const sessionManager = new SessionManager(
				mockSupabaseClient as any,
				mockContextStore as any
			);

			await sessionManager.waitForInitialization();

			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.stringContaining('Legacy auth.json found')
			);
		});
	});

	describe('Session State', () => {
		it('should return true for valid session', async () => {
			mockSupabaseClient.getSession.mockResolvedValue({
				access_token: 'valid-token'
			});

			const sessionManager = new SessionManager(
				mockSupabaseClient as any,
				mockContextStore as any
			);

			const hasSession = await sessionManager.hasValidSession();

			expect(hasSession).toBe(true);
		});

		it('should return false when no session exists', async () => {
			mockSupabaseClient.getSession.mockResolvedValue(null);

			const sessionManager = new SessionManager(
				mockSupabaseClient as any,
				mockContextStore as any
			);

			const hasSession = await sessionManager.hasValidSession();

			expect(hasSession).toBe(false);
		});

		it('should return false on session check error', async () => {
			mockSupabaseClient.getSession.mockRejectedValue(new Error('Failed'));

			const sessionManager = new SessionManager(
				mockSupabaseClient as any,
				mockContextStore as any
			);

			const hasSession = await sessionManager.hasValidSession();

			expect(hasSession).toBe(false);
		});
	});

	describe('Token Operations', () => {
		it('should get access token from session', async () => {
			mockSupabaseClient.getSession.mockResolvedValue({
				access_token: 'test-token'
			});

			const sessionManager = new SessionManager(
				mockSupabaseClient as any,
				mockContextStore as any
			);

			const token = await sessionManager.getAccessToken();

			expect(token).toBe('test-token');
		});

		it('should return null when no session', async () => {
			mockSupabaseClient.getSession.mockResolvedValue(null);

			const sessionManager = new SessionManager(
				mockSupabaseClient as any,
				mockContextStore as any
			);

			const token = await sessionManager.getAccessToken();

			expect(token).toBeNull();
		});

		it('should build auth credentials from session', async () => {
			const mockSession = {
				access_token: 'test-token',
				refresh_token: 'refresh-token',
				expires_at: 1234567890,
				user: {
					id: 'user-1',
					email: 'test@example.com'
				}
			};

			mockSupabaseClient.getSession.mockResolvedValue(mockSession);
			mockContextStore.getUserContext.mockReturnValue({
				briefId: 'brief-1',
				briefName: 'Test Brief'
			});

			const sessionManager = new SessionManager(
				mockSupabaseClient as any,
				mockContextStore as any
			);

			const credentials = await sessionManager.getAuthCredentials();

			expect(credentials).toMatchObject({
				token: 'test-token',
				refreshToken: 'refresh-token',
				userId: 'user-1',
				email: 'test@example.com',
				tokenType: 'standard'
			});
			expect(credentials?.selectedContext).toEqual({
				briefId: 'brief-1',
				briefName: 'Test Brief'
			});
		});

		it('should refresh token and sync context', async () => {
			const mockSession = {
				access_token: 'new-token',
				refresh_token: 'new-refresh-token',
				expires_at: 9999999999,
				user: {
					id: 'user-1',
					email: 'test@example.com'
				}
			};

			mockSupabaseClient.refreshSession.mockResolvedValue(mockSession);
			mockContextStore.getContext.mockReturnValue({
				selectedContext: { briefId: 'brief-1' }
			});

			const sessionManager = new SessionManager(
				mockSupabaseClient as any,
				mockContextStore as any
			);

			const credentials = await sessionManager.refreshToken();

			expect(mockContextStore.saveContext).toHaveBeenCalledWith({
				userId: 'user-1',
				email: 'test@example.com'
			});
			expect(credentials.token).toBe('new-token');
		});

		it('should throw on refresh failure', async () => {
			mockSupabaseClient.refreshSession.mockResolvedValue(null);

			const sessionManager = new SessionManager(
				mockSupabaseClient as any,
				mockContextStore as any
			);

			await expect(sessionManager.refreshToken()).rejects.toThrow(
				AuthenticationError
			);
		});
	});

	describe('Authentication with Code', () => {
		it('should authenticate with one-time code', async () => {
			const mockSession = {
				access_token: 'test-token',
				refresh_token: 'refresh-token',
				expires_at: 1234567890
			};

			const mockUser = {
				id: 'user-1',
				email: 'test@example.com'
			};

			mockSupabaseClient.verifyOneTimeCode.mockResolvedValue(mockSession);
			mockSupabaseClient.getUser.mockResolvedValue(mockUser);
			mockSupabaseClient.checkMFARequired.mockResolvedValue({
				required: false
			});

			const sessionManager = new SessionManager(
				mockSupabaseClient as any,
				mockContextStore as any
			);

			const credentials =
				await sessionManager.authenticateWithCode('test-code');

			expect(credentials.token).toBe('test-token');
			expect(credentials.userId).toBe('user-1');
			expect(mockContextStore.saveContext).toHaveBeenCalledWith({
				userId: 'user-1',
				email: 'test@example.com'
			});
		});

		it('should throw MFA_REQUIRED when MFA needed', async () => {
			const mockSession = {
				access_token: 'test-token',
				refresh_token: 'refresh-token'
			};

			mockSupabaseClient.verifyOneTimeCode.mockResolvedValue(mockSession);
			mockSupabaseClient.getUser.mockResolvedValue({
				id: 'user-1',
				email: 'test@example.com'
			});
			mockSupabaseClient.checkMFARequired.mockResolvedValue({
				required: true,
				factorId: 'factor-123',
				factorType: 'totp'
			});

			const sessionManager = new SessionManager(
				mockSupabaseClient as any,
				mockContextStore as any
			);

			const promise = sessionManager.authenticateWithCode('test-code');

			await expect(promise).rejects.toThrow(AuthenticationError);
			await expect(promise).rejects.toMatchObject({
				code: 'MFA_REQUIRED',
				mfaChallenge: {
					factorId: 'factor-123',
					factorType: 'totp'
				}
			});
		});
	});

	describe('MFA Verification', () => {
		it('should verify MFA and return credentials', async () => {
			const mockSession = {
				access_token: 'mfa-token',
				refresh_token: 'mfa-refresh-token',
				expires_at: 1234567890
			};

			const mockUser = {
				id: 'user-1',
				email: 'test@example.com'
			};

			mockSupabaseClient.verifyMFA.mockResolvedValue(mockSession);
			mockSupabaseClient.getUser.mockResolvedValue(mockUser);

			const sessionManager = new SessionManager(
				mockSupabaseClient as any,
				mockContextStore as any
			);

			const credentials = await sessionManager.verifyMFA(
				'factor-123',
				'123456'
			);

			expect(credentials.token).toBe('mfa-token');
			expect(mockContextStore.saveContext).toHaveBeenCalled();
		});

		it('should throw on MFA verification failure', async () => {
			mockSupabaseClient.verifyMFA.mockResolvedValue(null);

			const sessionManager = new SessionManager(
				mockSupabaseClient as any,
				mockContextStore as any
			);

			await expect(
				sessionManager.verifyMFA('factor-123', '123456')
			).rejects.toThrow(AuthenticationError);
		});
	});

	describe('Logout', () => {
		it('should sign out and clear all credentials', async () => {
			// Setup all mocks before creating SessionManager
			vi.mocked(fs.existsSync).mockReturnValue(false); // No legacy file during init
			mockSupabaseClient.initialize.mockResolvedValue(undefined);
			mockSupabaseClient.signOut.mockResolvedValue(undefined);

			const sessionManager = new SessionManager(
				mockSupabaseClient as any,
				mockContextStore as any
			);

			// Now mock existsSync to return true for logout test
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.unlinkSync).mockReturnValue(undefined);

			await sessionManager.logout();

			expect(mockSupabaseClient.signOut).toHaveBeenCalled();
			expect(mockContextStore.clearContext).toHaveBeenCalled();
			expect(fs.unlinkSync).toHaveBeenCalled();
		});

		it('should clear local state even if Supabase signout fails', async () => {
			mockSupabaseClient.signOut.mockRejectedValue(new Error('Network error'));
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const sessionManager = new SessionManager(
				mockSupabaseClient as any,
				mockContextStore as any
			);

			// Should not throw
			await expect(sessionManager.logout()).resolves.toBeUndefined();

			expect(mockContextStore.clearContext).toHaveBeenCalled();
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.stringContaining('Failed to sign out'),
				expect.anything()
			);
		});
	});
});
