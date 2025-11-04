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
import { AuthManager } from '../../src/modules/auth/managers/auth-manager.js';
import { CredentialStore } from '../../src/modules/auth/services/credential-store.js';
import type { AuthCredentials } from '../../src/modules/auth/types.js';

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
		it('should return expired token for Supabase to refresh', () => {
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

			// Get credentials returns them even if expired
			const credentials = authManager.getCredentials();

			expect(credentials).not.toBeNull();
			expect(credentials?.token).toBe('expired-token');
			expect(credentials?.refreshToken).toBe('valid-refresh-token');
		});

		it('should return valid token', () => {
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

			const credentials = authManager.getCredentials();

			expect(credentials?.token).toBe('valid-token');
		});
	});

	describe('Token Refresh Flow', () => {
		it('should manually refresh expired token and save new credentials', async () => {
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

			// Explicitly call refreshToken() method
			const refreshedCredentials = await authManager.refreshToken();

			expect(refreshedCredentials).not.toBeNull();
			expect(refreshedCredentials.token).toBe('new-access-token-xyz');
			expect(refreshedCredentials.refreshToken).toBe('new-refresh-token-xyz');

			// Verify context was preserved
			expect(refreshedCredentials.selectedContext?.orgId).toBe('test-org');
			expect(refreshedCredentials.selectedContext?.briefId).toBe('test-brief');

			// Verify new expiration is in the future
			const newExpiry = new Date(refreshedCredentials.expiresAt!).getTime();
			const now = Date.now();
			expect(newExpiry).toBeGreaterThan(now);
		});

		it('should throw error if manual refresh fails', async () => {
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

			// Explicit refreshToken() call should throw
			await expect(authManager.refreshToken()).rejects.toThrow();
		});

		it('should return expired credentials even without refresh token', () => {
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

			const credentials = authManager.getCredentials();

			// Credentials are returned even without refresh token
			expect(credentials).not.toBeNull();
			expect(credentials?.token).toBe('expired-token');
			expect(credentials?.refreshToken).toBeUndefined();
		});

		it('should return null if credentials missing expiresAt', () => {
			const credentialsWithoutExpiry: AuthCredentials = {
				token: 'test-token',
				refreshToken: 'refresh-token',
				userId: 'test-user-id',
				email: 'test@example.com',
				// Missing expiresAt - invalid token
				savedAt: new Date().toISOString()
			} as any;

			credentialStore.saveCredentials(credentialsWithoutExpiry);

			authManager = AuthManager.getInstance();

			const credentials = authManager.getCredentials();

			// Tokens without valid expiration are considered invalid
			expect(credentials).toBeNull();
		});
	});

	describe('Clock Skew Tolerance', () => {
		it('should return credentials within 30-second expiry window', () => {
			// Token expires in 15 seconds (within 30-second buffer)
			// Supabase will handle refresh automatically
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

			const credentials = authManager.getCredentials();

			// Credentials are returned (Supabase handles auto-refresh in background)
			expect(credentials).not.toBeNull();
			expect(credentials?.token).toBe('almost-expired-token');
			expect(credentials?.refreshToken).toBe('valid-refresh-token');
		});

		it('should return valid token well before expiry', () => {
			// Token expires in 5 minutes
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

			const credentials = authManager.getCredentials();

			// Valid credentials are returned as-is
			expect(credentials).not.toBeNull();
			expect(credentials?.token).toBe('valid-token');
			expect(credentials?.refreshToken).toBe('valid-refresh-token');
		});
	});

	describe('Synchronous vs Async Methods', () => {
		it('getCredentials should return expired credentials', () => {
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

			// Returns credentials even if expired - Supabase will handle refresh
			const credentials = authManager.getCredentials();

			expect(credentials).not.toBeNull();
			expect(credentials?.token).toBe('expired-token');
			expect(credentials?.refreshToken).toBe('valid-refresh-token');
		});
	});

	describe('Multiple Concurrent Calls', () => {
		it('should handle concurrent getCredentials calls gracefully', () => {
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

			// Make multiple concurrent calls (synchronous now)
			const creds1 = authManager.getCredentials();
			const creds2 = authManager.getCredentials();
			const creds3 = authManager.getCredentials();

			// All should get the same credentials (even if expired)
			expect(creds1?.token).toBe('expired-token');
			expect(creds2?.token).toBe('expired-token');
			expect(creds3?.token).toBe('expired-token');

			// All include refresh token for Supabase to use
			expect(creds1?.refreshToken).toBe('valid-refresh-token');
			expect(creds2?.refreshToken).toBe('valid-refresh-token');
			expect(creds3?.refreshToken).toBe('valid-refresh-token');
		});
	});
});
