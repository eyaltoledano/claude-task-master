/**
 * @fileoverview Unit tests for CredentialStore token expiration handling
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { CredentialStore } from './credential-store';
import type { AuthCredentials } from './types';

describe('CredentialStore - Token Expiration', () => {
	let credentialStore: CredentialStore;
	let tmpDir: string;
	let authFile: string;

	beforeEach(() => {
		// Create temp directory for test credentials
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-cred-test-'));
		authFile = path.join(tmpDir, 'auth.json');

		// Create instance with test config
		CredentialStore.resetInstance();
		credentialStore = CredentialStore.getInstance({
			configDir: tmpDir,
			configFile: authFile
		});
	});

	afterEach(() => {
		// Clean up
		try {
			if (fs.existsSync(tmpDir)) {
				fs.rmSync(tmpDir, { recursive: true, force: true });
			}
		} catch {
			// Ignore cleanup errors
		}
		CredentialStore.resetInstance();
	});

	describe('Expiration Detection', () => {
		it('should return null for expired token', () => {
			const expiredCredentials: AuthCredentials = {
				token: 'expired-token',
				refreshToken: 'refresh-token',
				userId: 'test-user',
				email: 'test@example.com',
				expiresAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
				savedAt: new Date().toISOString()
			};

			credentialStore.saveCredentials(expiredCredentials);

			const retrieved = credentialStore.getCredentials({ allowExpired: false });

			expect(retrieved).toBeNull();
		});

		it('should return credentials for valid token', () => {
			const validCredentials: AuthCredentials = {
				token: 'valid-token',
				refreshToken: 'refresh-token',
				userId: 'test-user',
				email: 'test@example.com',
				expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
				savedAt: new Date().toISOString()
			};

			credentialStore.saveCredentials(validCredentials);

			const retrieved = credentialStore.getCredentials({ allowExpired: false });

			expect(retrieved).not.toBeNull();
			expect(retrieved?.token).toBe('valid-token');
		});

		it('should return expired token when allowExpired is true', () => {
			const expiredCredentials: AuthCredentials = {
				token: 'expired-token',
				refreshToken: 'refresh-token',
				userId: 'test-user',
				email: 'test@example.com',
				expiresAt: new Date(Date.now() - 60000).toISOString(),
				savedAt: new Date().toISOString()
			};

			credentialStore.saveCredentials(expiredCredentials);

			const retrieved = credentialStore.getCredentials({ allowExpired: true });

			expect(retrieved).not.toBeNull();
			expect(retrieved?.token).toBe('expired-token');
		});

		it('should return expired token by default (allowExpired defaults to true)', () => {
			const expiredCredentials: AuthCredentials = {
				token: 'expired-token-default',
				refreshToken: 'refresh-token',
				userId: 'test-user',
				email: 'test@example.com',
				expiresAt: new Date(Date.now() - 60000).toISOString(),
				savedAt: new Date().toISOString()
			};

			credentialStore.saveCredentials(expiredCredentials);

			// Call without options - should default to allowExpired: true
			const retrieved = credentialStore.getCredentials();

			expect(retrieved).not.toBeNull();
			expect(retrieved?.token).toBe('expired-token-default');
		});
	});

	describe('Clock Skew Tolerance', () => {
		it('should reject token expiring within 30-second buffer', () => {
			// Token expires in 15 seconds (within 30-second buffer)
			const almostExpiredCredentials: AuthCredentials = {
				token: 'almost-expired-token',
				refreshToken: 'refresh-token',
				userId: 'test-user',
				email: 'test@example.com',
				expiresAt: new Date(Date.now() + 15000).toISOString(),
				savedAt: new Date().toISOString()
			};

			credentialStore.saveCredentials(almostExpiredCredentials);

			const retrieved = credentialStore.getCredentials({ allowExpired: false });

			expect(retrieved).toBeNull();
		});

		it('should accept token expiring outside 30-second buffer', () => {
			// Token expires in 60 seconds (outside 30-second buffer)
			const validCredentials: AuthCredentials = {
				token: 'valid-token',
				refreshToken: 'refresh-token',
				userId: 'test-user',
				email: 'test@example.com',
				expiresAt: new Date(Date.now() + 60000).toISOString(),
				savedAt: new Date().toISOString()
			};

			credentialStore.saveCredentials(validCredentials);

			const retrieved = credentialStore.getCredentials({ allowExpired: false });

			expect(retrieved).not.toBeNull();
			expect(retrieved?.token).toBe('valid-token');
		});
	});

	describe('Timestamp Format Handling', () => {
		it('should handle ISO string timestamps', () => {
			const credentials: AuthCredentials = {
				token: 'test-token',
				refreshToken: 'refresh-token',
				userId: 'test-user',
				email: 'test@example.com',
				expiresAt: new Date(Date.now() + 3600000).toISOString(),
				savedAt: new Date().toISOString()
			};

			credentialStore.saveCredentials(credentials);

			const retrieved = credentialStore.getCredentials({ allowExpired: false });

			expect(retrieved).not.toBeNull();
			expect(typeof retrieved?.expiresAt).toBe('number'); // Normalized to number
		});

		it('should handle numeric timestamps', () => {
			const credentials: AuthCredentials = {
				token: 'test-token',
				refreshToken: 'refresh-token',
				userId: 'test-user',
				email: 'test@example.com',
				expiresAt: Date.now() + 3600000,
				savedAt: new Date().toISOString()
			};

			credentialStore.saveCredentials(credentials);

			const retrieved = credentialStore.getCredentials({ allowExpired: false });

			expect(retrieved).not.toBeNull();
			expect(typeof retrieved?.expiresAt).toBe('number');
		});

		it('should return null for invalid timestamp format', () => {
			// Manually write invalid timestamp to file
			const invalidCredentials = {
				token: 'test-token',
				refreshToken: 'refresh-token',
				userId: 'test-user',
				email: 'test@example.com',
				expiresAt: 'invalid-date',
				savedAt: new Date().toISOString()
			};

			fs.writeFileSync(authFile, JSON.stringify(invalidCredentials), {
				mode: 0o600
			});

			const retrieved = credentialStore.getCredentials({ allowExpired: false });

			expect(retrieved).toBeNull();
		});

		it('should return null for missing expiresAt', () => {
			const credentialsWithoutExpiry = {
				token: 'test-token',
				refreshToken: 'refresh-token',
				userId: 'test-user',
				email: 'test@example.com',
				savedAt: new Date().toISOString()
			};

			fs.writeFileSync(authFile, JSON.stringify(credentialsWithoutExpiry), {
				mode: 0o600
			});

			const retrieved = credentialStore.getCredentials({ allowExpired: false });

			expect(retrieved).toBeNull();
		});
	});

	describe('Storage Persistence', () => {
		it('should persist expiresAt as ISO string', () => {
			const expiryTime = Date.now() + 3600000;
			const credentials: AuthCredentials = {
				token: 'test-token',
				refreshToken: 'refresh-token',
				userId: 'test-user',
				email: 'test@example.com',
				expiresAt: expiryTime,
				savedAt: new Date().toISOString()
			};

			credentialStore.saveCredentials(credentials);

			// Read raw file to verify format
			const fileContent = fs.readFileSync(authFile, 'utf-8');
			const parsed = JSON.parse(fileContent);

			// Should be stored as ISO string
			expect(typeof parsed.expiresAt).toBe('string');
			expect(parsed.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO format
		});

		it('should normalize timestamp on retrieval', () => {
			const credentials: AuthCredentials = {
				token: 'test-token',
				refreshToken: 'refresh-token',
				userId: 'test-user',
				email: 'test@example.com',
				expiresAt: new Date(Date.now() + 3600000).toISOString(),
				savedAt: new Date().toISOString()
			};

			credentialStore.saveCredentials(credentials);

			const retrieved = credentialStore.getCredentials({ allowExpired: false });

			// Should be normalized to number for runtime use
			expect(typeof retrieved?.expiresAt).toBe('number');
		});
	});

	describe('hasCredentials', () => {
		it('should return true for expired credentials', () => {
			const expiredCredentials: AuthCredentials = {
				token: 'expired-token',
				refreshToken: 'refresh-token',
				userId: 'test-user',
				email: 'test@example.com',
				expiresAt: new Date(Date.now() - 60000).toISOString(),
				savedAt: new Date().toISOString()
			};

			credentialStore.saveCredentials(expiredCredentials);

			expect(credentialStore.hasCredentials()).toBe(true);
		});

		it('should return true for valid credentials', () => {
			const validCredentials: AuthCredentials = {
				token: 'valid-token',
				refreshToken: 'refresh-token',
				userId: 'test-user',
				email: 'test@example.com',
				expiresAt: new Date(Date.now() + 3600000).toISOString(),
				savedAt: new Date().toISOString()
			};

			credentialStore.saveCredentials(validCredentials);

			expect(credentialStore.hasCredentials()).toBe(true);
		});

		it('should return false when no credentials exist', () => {
			expect(credentialStore.hasCredentials()).toBe(false);
		});
	});
});
