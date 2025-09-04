/**
 * Tests for CredentialStore with numeric and string timestamp handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CredentialStore } from './credential-store.js';
import { AuthenticationError } from './types.js';
import type { AuthCredentials } from './types.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock fs module
vi.mock('fs');

// Mock logger
const mockLogger = {
	warn: vi.fn(),
	info: vi.fn(),
	debug: vi.fn(),
	error: vi.fn()
};

vi.mock('../logger/index.js', () => ({
	getLogger: () => mockLogger
}));

describe('CredentialStore', () => {
	let store: CredentialStore;
	const testDir = '/test/config';
	const configFile = '/test/config/auth.json';

	beforeEach(() => {
		vi.clearAllMocks();
		store = new CredentialStore({
			configDir: testDir,
			configFile: configFile,
			baseUrl: 'https://api.test.com'
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('getCredentials with timestamp migration', () => {
		it('should handle string ISO timestamp correctly', () => {
			const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
			const mockCredentials: AuthCredentials = {
				token: 'test-token',
				userId: 'user-123',
				email: 'test@example.com',
				expiresAt: futureDate.toISOString(),
				tokenType: 'standard',
				savedAt: new Date().toISOString()
			};

			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockCredentials));

			const result = store.getCredentials();

			expect(result).not.toBeNull();
			expect(result?.token).toBe('test-token');
			// The timestamp should be normalized to numeric milliseconds
			expect(typeof result?.expiresAt).toBe('number');
			expect(result?.expiresAt).toBe(futureDate.getTime());
		});

		it('should handle numeric timestamp correctly', () => {
			const futureTimestamp = Date.now() + 7200000; // 2 hours from now
			const mockCredentials = {
				token: 'test-token',
				userId: 'user-456',
				email: 'test2@example.com',
				expiresAt: futureTimestamp,
				tokenType: 'standard',
				savedAt: new Date().toISOString()
			};

			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockCredentials));

			const result = store.getCredentials();

			expect(result).not.toBeNull();
			expect(result?.token).toBe('test-token');
			// Numeric timestamp should remain as-is
			expect(typeof result?.expiresAt).toBe('number');
			expect(result?.expiresAt).toBe(futureTimestamp);
		});

		it('should reject invalid string timestamp', () => {
			const mockCredentials = {
				token: 'test-token',
				userId: 'user-789',
				expiresAt: 'invalid-date-string',
				tokenType: 'standard',
				savedAt: new Date().toISOString()
			};

			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockCredentials));

			const result = store.getCredentials();

			expect(result).toBeNull();
			expect(mockLogger.warn).toHaveBeenCalledWith(
				'No valid expiration time provided for token'
			);
		});

		it('should reject NaN timestamp', () => {
			const mockCredentials = {
				token: 'test-token',
				userId: 'user-nan',
				expiresAt: NaN,
				tokenType: 'standard',
				savedAt: new Date().toISOString()
			};

			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockCredentials));

			const result = store.getCredentials();

			expect(result).toBeNull();
			expect(mockLogger.warn).toHaveBeenCalledWith(
				'No valid expiration time provided for token'
			);
		});

		it('should reject Infinity timestamp', () => {
			const mockCredentials = {
				token: 'test-token',
				userId: 'user-inf',
				expiresAt: Infinity,
				tokenType: 'standard',
				savedAt: new Date().toISOString()
			};

			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockCredentials));

			const result = store.getCredentials();

			expect(result).toBeNull();
			expect(mockLogger.warn).toHaveBeenCalledWith(
				'No valid expiration time provided for token'
			);
		});

		it('should handle missing expiresAt field', () => {
			const mockCredentials = {
				token: 'test-token',
				userId: 'user-no-expiry',
				tokenType: 'standard',
				savedAt: new Date().toISOString()
				// No expiresAt field
			};

			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockCredentials));

			const result = store.getCredentials();

			expect(result).toBeNull();
			expect(mockLogger.warn).toHaveBeenCalledWith(
				'No valid expiration time provided for token'
			);
		});

		it('should check token expiration correctly', () => {
			const expiredTimestamp = Date.now() - 3600000; // 1 hour ago
			const mockCredentials = {
				token: 'expired-token',
				userId: 'user-expired',
				expiresAt: expiredTimestamp,
				tokenType: 'standard',
				savedAt: new Date().toISOString()
			};

			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockCredentials));

			const result = store.getCredentials();

			expect(result).toBeNull();
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.stringContaining('Authentication token has expired'),
				expect.any(Object)
			);
		});

		it('should allow expired tokens when requested', () => {
			const expiredTimestamp = Date.now() - 3600000; // 1 hour ago
			const mockCredentials = {
				token: 'expired-token',
				userId: 'user-expired',
				expiresAt: expiredTimestamp,
				tokenType: 'standard',
				savedAt: new Date().toISOString()
			};

			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockCredentials));

			const result = store.getCredentials({ allowExpired: true });

			expect(result).not.toBeNull();
			expect(result?.token).toBe('expired-token');
		});
	});

	describe('saveCredentials with timestamp normalization', () => {
		beforeEach(() => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
			vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
			vi.mocked(fs.renameSync).mockImplementation(() => undefined);
		});

		it('should normalize string timestamp to ISO string when saving', () => {
			const futureDate = new Date(Date.now() + 3600000);
			const credentials: AuthCredentials = {
				token: 'test-token',
				userId: 'user-123',
				expiresAt: futureDate.toISOString(),
				tokenType: 'standard',
				savedAt: new Date().toISOString()
			};

			store.saveCredentials(credentials);

			expect(fs.writeFileSync).toHaveBeenCalledWith(
				expect.stringContaining('.tmp'),
				expect.stringContaining('"expiresAt":'),
				expect.any(Object)
			);

			// Check that the written data contains a valid ISO string
			const writtenData = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
			const parsed = JSON.parse(writtenData);
			expect(typeof parsed.expiresAt).toBe('string');
			expect(new Date(parsed.expiresAt).toISOString()).toBe(parsed.expiresAt);
		});

		it('should convert numeric timestamp to ISO string when saving', () => {
			const futureTimestamp = Date.now() + 7200000;
			const credentials: AuthCredentials = {
				token: 'test-token',
				userId: 'user-456',
				expiresAt: futureTimestamp,
				tokenType: 'standard',
				savedAt: new Date().toISOString()
			};

			store.saveCredentials(credentials);

			const writtenData = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
			const parsed = JSON.parse(writtenData);
			expect(typeof parsed.expiresAt).toBe('string');
			expect(new Date(parsed.expiresAt).getTime()).toBe(futureTimestamp);
		});

		it('should reject invalid string timestamp when saving', () => {
			const credentials: AuthCredentials = {
				token: 'test-token',
				userId: 'user-789',
				expiresAt: 'invalid-date' as any,
				tokenType: 'standard',
				savedAt: new Date().toISOString()
			};

			expect(() => store.saveCredentials(credentials)).toThrow(AuthenticationError);
			expect(() => store.saveCredentials(credentials)).toThrow('Invalid expiresAt format');
		});

		it('should reject NaN timestamp when saving', () => {
			const credentials: AuthCredentials = {
				token: 'test-token',
				userId: 'user-nan',
				expiresAt: NaN as any,
				tokenType: 'standard',
				savedAt: new Date().toISOString()
			};

			expect(() => store.saveCredentials(credentials)).toThrow(AuthenticationError);
			expect(() => store.saveCredentials(credentials)).toThrow('Invalid expiresAt format');
		});

		it('should reject Infinity timestamp when saving', () => {
			const credentials: AuthCredentials = {
				token: 'test-token',
				userId: 'user-inf',
				expiresAt: Infinity as any,
				tokenType: 'standard',
				savedAt: new Date().toISOString()
			};

			expect(() => store.saveCredentials(credentials)).toThrow(AuthenticationError);
			expect(() => store.saveCredentials(credentials)).toThrow('Invalid expiresAt format');
		});

		it('should handle missing expiresAt when saving', () => {
			const credentials: AuthCredentials = {
				token: 'test-token',
				userId: 'user-no-expiry',
				tokenType: 'standard',
				savedAt: new Date().toISOString()
				// No expiresAt
			};

			store.saveCredentials(credentials);

			const writtenData = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
			const parsed = JSON.parse(writtenData);
			expect(parsed.expiresAt).toBeUndefined();
		});

		it('should not mutate the original credentials object', () => {
			const originalTimestamp = Date.now() + 3600000;
			const credentials: AuthCredentials = {
				token: 'test-token',
				userId: 'user-123',
				expiresAt: originalTimestamp,
				tokenType: 'standard',
				savedAt: new Date().toISOString()
			};

			const originalCredentialsCopy = { ...credentials };

			store.saveCredentials(credentials);

			// Original object should not be modified
			expect(credentials).toEqual(originalCredentialsCopy);
			expect(credentials.expiresAt).toBe(originalTimestamp);
		});
	});

	describe('corrupt file handling', () => {
		it('should quarantine corrupt file on JSON parse error', () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue('invalid json {');
			vi.mocked(fs.renameSync).mockImplementation(() => undefined);

			const result = store.getCredentials();

			expect(result).toBeNull();
			expect(fs.renameSync).toHaveBeenCalledWith(
				configFile,
				expect.stringContaining('.corrupt-')
			);
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.stringContaining('Quarantined corrupt auth file')
			);
		});

		it('should handle quarantine failure gracefully', () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue('invalid json {');
			vi.mocked(fs.renameSync).mockImplementation(() => {
				throw new Error('Permission denied');
			});

			const result = store.getCredentials();

			expect(result).toBeNull();
			expect(mockLogger.debug).toHaveBeenCalledWith(
				expect.stringContaining('Could not quarantine corrupt file')
			);
		});
	});

	describe('cleanupCorruptFiles', () => {
		it('should remove old corrupt files', () => {
			const now = Date.now();
			const oldFile = 'auth.json.corrupt-' + (now - 8 * 24 * 60 * 60 * 1000); // 8 days old
			const newFile = 'auth.json.corrupt-' + (now - 1000); // 1 second old

			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readdirSync).mockReturnValue([
				{ name: oldFile, isFile: () => true },
				{ name: newFile, isFile: () => true },
				{ name: 'auth.json', isFile: () => true }
			] as any);
			vi.mocked(fs.statSync).mockImplementation((filePath) => {
				if (filePath.includes(oldFile)) {
					return { mtimeMs: now - 8 * 24 * 60 * 60 * 1000 } as any;
				}
				return { mtimeMs: now - 1000 } as any;
			});
			vi.mocked(fs.unlinkSync).mockImplementation(() => undefined);

			store.cleanupCorruptFiles();

			expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining(oldFile));
			expect(fs.unlinkSync).not.toHaveBeenCalledWith(expect.stringContaining(newFile));
		});

		it('should handle cleanup errors gracefully', () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readdirSync).mockImplementation(() => {
				throw new Error('Permission denied');
			});

			// Should not throw
			expect(() => store.cleanupCorruptFiles()).not.toThrow();
			expect(mockLogger.debug).toHaveBeenCalledWith(
				expect.stringContaining('Error during corrupt file cleanup')
			);
		});
	});
});