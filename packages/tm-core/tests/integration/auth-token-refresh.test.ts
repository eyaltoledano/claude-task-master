/**
 * @fileoverview Integration tests for JWT token auto-refresh functionality
 *
 * These tests verify that expired tokens are automatically refreshed
 * when making API calls through AuthManager.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Session } from '@supabase/supabase-js';
import { AuthManager } from '../../src/auth/auth-manager';
import { CredentialStore } from '../../src/auth/credential-store';
import type { AuthCredentials } from '../../src/auth/types';

describe('AuthManager - Token Auto-Refresh Integration', () => {
	let authManager: AuthManager;
	let credentialStore: CredentialStore;
	let tmpDir: string;
	let authFile: string;

	// Mock Supabase session that will be returned on refresh
	const mockRefreshedSession: Session = {
		access_token: 'new-access-token-xyz',
		refresh_token: 'new-refresh-token-xyz',
		token_type: 'bearer',
		expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
		expires_in: 3600,
		user: {
			id: 'test-user-id',
			email: 'test@example.com',
			aud: 'authenticated',
			role: 'authenticated',
			app_metadata: {},
			user_metadata: {},
			created_at: new Date().toISOString()
		}
	};

	beforeEach(() => {
		// Reset singletons
		AuthManager.resetInstance();
		CredentialStore.resetInstance();

		// Create temporary directory for test isolation
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-auth-integration-'));
		authFile = path.join(tmpDir, 'auth.json');

		// Initialize AuthManager with test config (this will create CredentialStore internally)
		authManager = AuthManager.getInstance({
			configDir: tmpDir,
			configFile: authFile
		});

		// Get the CredentialStore instance that AuthManager created
		credentialStore = CredentialStore.getInstance();
		credentialStore.clearCredentials();
	});

	afterEach(() => {
		// Clean up
		try {
			credentialStore.clearCredentials();
		} catch {
			// Ignore cleanup errors
		}
		AuthManager.resetInstance();
		CredentialStore.resetInstance();
		vi.restoreAllMocks();

		// Remove temporary directory
		if (tmpDir && fs.existsSync(tmpDir)) {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	describe('Expired Token Detection', () => {
		it('should detect expired token', async () => {
			// Set up expired credentials
			const expiredCredentials: AuthCredentials = {
				token: 'expired-token',
				refreshToken: 'valid-refresh-token',
				userId: 'test-user-id',
				email: 'test@example.com',
				expiresAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
				savedAt: new Date().toISOString()
			};

			credentialStore.saveCredentials(expiredCredentials);

			authManager = AuthManager.getInstance();

			// Mock the Supabase refreshSession to return new tokens
			const mockRefreshSession = vi
				.fn()
				.mockResolvedValue(mockRefreshedSession);
			vi.spyOn(
				authManager['supabaseClient'],
				'refreshSession'
			).mockImplementation(mockRefreshSession);

			// Get credentials should trigger refresh
			const credentials = await authManager.getCredentials();

			expect(mockRefreshSession).toHaveBeenCalledTimes(1);
			expect(credentials).not.toBeNull();
			expect(credentials?.token).toBe('new-access-token-xyz');
		});

		it('should not refresh valid token', async () => {
			// Set up valid credentials
			const validCredentials: AuthCredentials = {
				token: 'valid-token',
				refreshToken: 'valid-refresh-token',
				userId: 'test-user-id',
				email: 'test@example.com',
				expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
				savedAt: new Date().toISOString()
			};

			credentialStore.saveCredentials(validCredentials);

			authManager = AuthManager.getInstance();

			// Mock refresh to ensure it's not called
			const mockRefreshSession = vi.fn();
			vi.spyOn(
				authManager['supabaseClient'],
				'refreshSession'
			).mockImplementation(mockRefreshSession);

			const credentials = await authManager.getCredentials();

			expect(mockRefreshSession).not.toHaveBeenCalled();
			expect(credentials?.token).toBe('valid-token');
		});
	});

	describe('Token Refresh Flow', () => {
		it('should refresh expired token and save new credentials', async () => {
			const expiredCredentials: AuthCredentials = {
				token: 'old-token',
				refreshToken: 'old-refresh-token',
				userId: 'test-user-id',
				email: 'test@example.com',
				expiresAt: new Date(Date.now() - 60000).toISOString(),
				savedAt: new Date(Date.now() - 3600000).toISOString(),
				selectedContext: {
					orgId: 'test-org',
					briefId: 'test-brief',
					updatedAt: new Date().toISOString()
				}
			};

			credentialStore.saveCredentials(expiredCredentials);

			authManager = AuthManager.getInstance();

			vi.spyOn(
				authManager['supabaseClient'],
				'refreshSession'
			).mockResolvedValue(mockRefreshedSession);

			const refreshedCredentials = await authManager.getCredentials();

			expect(refreshedCredentials).not.toBeNull();
			expect(refreshedCredentials?.token).toBe('new-access-token-xyz');
			expect(refreshedCredentials?.refreshToken).toBe('new-refresh-token-xyz');

			// Verify context was preserved
			expect(refreshedCredentials?.selectedContext?.orgId).toBe('test-org');
			expect(refreshedCredentials?.selectedContext?.briefId).toBe('test-brief');

			// Verify new expiration is in the future
			const newExpiry = new Date(refreshedCredentials!.expiresAt!).getTime();
			const now = Date.now();
			expect(newExpiry).toBeGreaterThan(now);
		});

		it('should return null if refresh fails', async () => {
			const expiredCredentials: AuthCredentials = {
				token: 'expired-token',
				refreshToken: 'invalid-refresh-token',
				userId: 'test-user-id',
				email: 'test@example.com',
				expiresAt: new Date(Date.now() - 60000).toISOString(),
				savedAt: new Date().toISOString()
			};

			credentialStore.saveCredentials(expiredCredentials);

			authManager = AuthManager.getInstance();

			// Mock refresh to fail
			vi.spyOn(
				authManager['supabaseClient'],
				'refreshSession'
			).mockRejectedValue(new Error('Refresh token expired'));

			const credentials = await authManager.getCredentials();

			expect(credentials).toBeNull();
		});

		it('should return null if no refresh token available', async () => {
			const expiredCredentials: AuthCredentials = {
				token: 'expired-token',
				// No refresh token
				userId: 'test-user-id',
				email: 'test@example.com',
				expiresAt: new Date(Date.now() - 60000).toISOString(),
				savedAt: new Date().toISOString()
			};

			credentialStore.saveCredentials(expiredCredentials);

			authManager = AuthManager.getInstance();

			const credentials = await authManager.getCredentials();

			expect(credentials).toBeNull();
		});

		it('should return null if credentials missing expiresAt', async () => {
			const credentialsWithoutExpiry: AuthCredentials = {
				token: 'test-token',
				refreshToken: 'refresh-token',
				userId: 'test-user-id',
				email: 'test@example.com',
				// Missing expiresAt
				savedAt: new Date().toISOString()
			} as any;

			credentialStore.saveCredentials(credentialsWithoutExpiry);

			authManager = AuthManager.getInstance();

			const credentials = await authManager.getCredentials();

			// Should return null because no valid expiration
			expect(credentials).toBeNull();
		});
	});

	describe('Clock Skew Tolerance', () => {
		it('should refresh token within 30-second expiry window', async () => {
			// Token expires in 15 seconds (within 30-second buffer)
			const almostExpiredCredentials: AuthCredentials = {
				token: 'almost-expired-token',
				refreshToken: 'valid-refresh-token',
				userId: 'test-user-id',
				email: 'test@example.com',
				expiresAt: new Date(Date.now() + 15000).toISOString(), // 15 seconds from now
				savedAt: new Date().toISOString()
			};

			credentialStore.saveCredentials(almostExpiredCredentials);

			authManager = AuthManager.getInstance();

			const mockRefreshSession = vi
				.fn()
				.mockResolvedValue(mockRefreshedSession);
			vi.spyOn(
				authManager['supabaseClient'],
				'refreshSession'
			).mockImplementation(mockRefreshSession);

			const credentials = await authManager.getCredentials();

			// Should trigger refresh due to 30-second buffer
			expect(mockRefreshSession).toHaveBeenCalledTimes(1);
			expect(credentials?.token).toBe('new-access-token-xyz');
		});

		it('should not refresh token well before expiry', async () => {
			// Token expires in 5 minutes (well outside 30-second buffer)
			const validCredentials: AuthCredentials = {
				token: 'valid-token',
				refreshToken: 'valid-refresh-token',
				userId: 'test-user-id',
				email: 'test@example.com',
				expiresAt: new Date(Date.now() + 300000).toISOString(), // 5 minutes
				savedAt: new Date().toISOString()
			};

			credentialStore.saveCredentials(validCredentials);

			authManager = AuthManager.getInstance();

			const mockRefreshSession = vi.fn();
			vi.spyOn(
				authManager['supabaseClient'],
				'refreshSession'
			).mockImplementation(mockRefreshSession);

			const credentials = await authManager.getCredentials();

			expect(mockRefreshSession).not.toHaveBeenCalled();
			expect(credentials?.token).toBe('valid-token');
		});
	});

	describe('Synchronous vs Async Methods', () => {
		it('getCredentialsSync should not trigger refresh', () => {
			const expiredCredentials: AuthCredentials = {
				token: 'expired-token',
				refreshToken: 'valid-refresh-token',
				userId: 'test-user-id',
				email: 'test@example.com',
				expiresAt: new Date(Date.now() - 60000).toISOString(),
				savedAt: new Date().toISOString()
			};

			credentialStore.saveCredentials(expiredCredentials);

			authManager = AuthManager.getInstance();

			// Synchronous call should return null without refresh
			const credentials = authManager.getCredentialsSync();

			expect(credentials).toBeNull();
		});

		it('getCredentials async should trigger refresh', async () => {
			const expiredCredentials: AuthCredentials = {
				token: 'expired-token',
				refreshToken: 'valid-refresh-token',
				userId: 'test-user-id',
				email: 'test@example.com',
				expiresAt: new Date(Date.now() - 60000).toISOString(),
				savedAt: new Date().toISOString()
			};

			credentialStore.saveCredentials(expiredCredentials);

			authManager = AuthManager.getInstance();

			vi.spyOn(
				authManager['supabaseClient'],
				'refreshSession'
			).mockResolvedValue(mockRefreshedSession);

			const credentials = await authManager.getCredentials();

			expect(credentials).not.toBeNull();
			expect(credentials?.token).toBe('new-access-token-xyz');
		});
	});

	describe('Multiple Concurrent Calls', () => {
		it('should handle concurrent getCredentials calls gracefully', async () => {
			const expiredCredentials: AuthCredentials = {
				token: 'expired-token',
				refreshToken: 'valid-refresh-token',
				userId: 'test-user-id',
				email: 'test@example.com',
				expiresAt: new Date(Date.now() - 60000).toISOString(),
				savedAt: new Date().toISOString()
			};

			credentialStore.saveCredentials(expiredCredentials);

			authManager = AuthManager.getInstance();

			const mockRefreshSession = vi
				.fn()
				.mockResolvedValue(mockRefreshedSession);
			vi.spyOn(
				authManager['supabaseClient'],
				'refreshSession'
			).mockImplementation(mockRefreshSession);

			// Make multiple concurrent calls
			const [creds1, creds2, creds3] = await Promise.all([
				authManager.getCredentials(),
				authManager.getCredentials(),
				authManager.getCredentials()
			]);

			// All should get the refreshed token
			expect(creds1?.token).toBe('new-access-token-xyz');
			expect(creds2?.token).toBe('new-access-token-xyz');
			expect(creds3?.token).toBe('new-access-token-xyz');

			// Refresh might be called multiple times, but that's okay
			// (ideally we'd debounce, but this is acceptable behavior)
			expect(mockRefreshSession).toHaveBeenCalled();
		});
	});
});
