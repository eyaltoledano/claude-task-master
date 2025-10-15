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

	it('should return expired credentials to enable refresh flows', () => {
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

		// Get credentials should return them even if expired
		// Refresh will be handled by explicit calls or client operations
		const credentials = authManager.getCredentials();

		expect(credentials).not.toBeNull();
		expect(credentials?.token).toBe('expired_access_token');
		expect(credentials?.refreshToken).toBe('valid_refresh_token');
	});

	it('should return valid credentials', () => {
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

		const credentials = authManager.getCredentials();

		expect(credentials?.token).toBe('valid_access_token');
	});

	it('should return expired credentials even without refresh token', () => {
		// Set up expired credentials WITHOUT refresh token
		// We still return them - it's up to the caller to handle
		const expiredCredentials: AuthCredentials = {
			token: 'expired_access_token',
			refreshToken: undefined,
			userId: 'test-user-id',
			email: 'test@example.com',
			expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
			savedAt: new Date().toISOString()
		};

		credentialStore.saveCredentials(expiredCredentials);

		const credentials = authManager.getCredentials();

		// Returns credentials even if expired
		expect(credentials).not.toBeNull();
		expect(credentials?.token).toBe('expired_access_token');
	});

	it('should return null if no credentials exist', () => {
		const credentials = authManager.getCredentials();
		expect(credentials).toBeNull();
	});

	it('should return credentials regardless of refresh token validity', () => {
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

		const credentials = authManager.getCredentials();

		// Returns credentials - refresh will be attempted by the client which will handle failure
		expect(credentials).not.toBeNull();
		expect(credentials?.token).toBe('expired_access_token');
		expect(credentials?.refreshToken).toBe('invalid_refresh_token');
	});
});
