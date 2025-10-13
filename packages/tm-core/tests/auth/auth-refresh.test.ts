import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Session } from '@supabase/supabase-js';
import { AuthManager } from '../../src/auth/auth-manager';
import { CredentialStore } from '../../src/auth/credential-store';
import type { AuthCredentials } from '../../src/auth/types';

describe('AuthManager Token Refresh', () => {
	let authManager: AuthManager;
	let credentialStore: CredentialStore;
	let tmpDir: string;
	let authFile: string;

	beforeEach(() => {
		// Reset singletons
		AuthManager.resetInstance();
		CredentialStore.resetInstance();

		// Create temporary directory for test isolation
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-auth-refresh-'));
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

	it('should not make concurrent refresh requests', async () => {
		// Set up expired credentials with refresh token
		const expiredCredentials: AuthCredentials = {
			token: 'expired_access_token',
			refreshToken: 'valid_refresh_token',
			userId: 'test-user-id',
			email: 'test@example.com',
			expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
			savedAt: new Date().toISOString()
		};

		credentialStore.saveCredentials(expiredCredentials);

		// Mock the refreshToken method to track calls
		const refreshTokenSpy = vi.spyOn(authManager as any, 'refreshToken');
		const mockSession: Session = {
			access_token: 'new_access_token',
			refresh_token: 'new_refresh_token',
			expires_at: Math.floor(Date.now() / 1000) + 3600,
			user: {
				id: 'test-user-id',
				email: 'test@example.com',
				app_metadata: {},
				user_metadata: {},
				aud: 'authenticated',
				created_at: new Date().toISOString()
			}
		};

		refreshTokenSpy.mockResolvedValue({
			token: mockSession.access_token,
			refreshToken: mockSession.refresh_token,
			userId: mockSession.user.id,
			email: mockSession.user.email,
			expiresAt: new Date(mockSession.expires_at! * 1000).toISOString(),
			savedAt: new Date().toISOString()
		});

		// Make multiple concurrent calls to getCredentials
		const promises = [
			authManager.getCredentials(),
			authManager.getCredentials(),
			authManager.getCredentials()
		];

		const results = await Promise.all(promises);

		// Verify all calls returned the same new credentials
		expect(results[0]?.token).toBe('new_access_token');
		expect(results[1]?.token).toBe('new_access_token');
		expect(results[2]?.token).toBe('new_access_token');

		// Verify refreshToken was only called once, not three times
		expect(refreshTokenSpy).toHaveBeenCalledTimes(1);
	});

	it('should return valid credentials without attempting refresh', async () => {
		// Set up valid (non-expired) credentials
		const validCredentials: AuthCredentials = {
			token: 'valid_access_token',
			refreshToken: 'valid_refresh_token',
			userId: 'test-user-id',
			email: 'test@example.com',
			expiresAt: new Date(Date.now() + 3600000).toISOString(), // Expires in 1 hour
			savedAt: new Date().toISOString()
		};

		credentialStore.saveCredentials(validCredentials);

		// Spy on refreshToken to ensure it's not called
		const refreshTokenSpy = vi.spyOn(authManager as any, 'refreshToken');

		const credentials = await authManager.getCredentials();

		expect(credentials?.token).toBe('valid_access_token');
		expect(refreshTokenSpy).not.toHaveBeenCalled();
	});

	it('should return null if credentials are expired with no refresh token', async () => {
		// Set up expired credentials WITHOUT refresh token
		const expiredCredentials: AuthCredentials = {
			token: 'expired_access_token',
			refreshToken: undefined,
			userId: 'test-user-id',
			email: 'test@example.com',
			expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
			savedAt: new Date().toISOString()
		};

		credentialStore.saveCredentials(expiredCredentials);

		const credentials = await authManager.getCredentials();

		expect(credentials).toBeNull();
	});

	it('should return null if no credentials exist', async () => {
		const credentials = await authManager.getCredentials();
		expect(credentials).toBeNull();
	});

	it('should handle refresh failures gracefully', async () => {
		// Set up expired credentials with refresh token
		const expiredCredentials: AuthCredentials = {
			token: 'expired_access_token',
			refreshToken: 'invalid_refresh_token',
			userId: 'test-user-id',
			email: 'test@example.com',
			expiresAt: new Date(Date.now() - 1000).toISOString(),
			savedAt: new Date().toISOString()
		};

		credentialStore.saveCredentials(expiredCredentials);

		// Mock refreshToken to throw an error
		const refreshTokenSpy = vi.spyOn(authManager as any, 'refreshToken');
		refreshTokenSpy.mockRejectedValue(new Error('Refresh failed'));

		const credentials = await authManager.getCredentials();

		expect(credentials).toBeNull();
		expect(refreshTokenSpy).toHaveBeenCalledTimes(1);
	});
});
