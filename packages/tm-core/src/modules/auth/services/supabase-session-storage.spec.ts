/**
 * Tests for SupabaseSessionStorage
 * Verifies session persistence with steno atomic writes
 */

import fsSync from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SupabaseSessionStorage } from './supabase-session-storage.js';

describe('SupabaseSessionStorage', () => {
	let tempDir: string;
	let sessionPath: string;

	beforeEach(() => {
		// Create unique temp directory for each test
		tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'tm-session-test-'));
		sessionPath = path.join(tempDir, 'session.json');
	});

	afterEach(() => {
		// Clean up temp directory
		if (fsSync.existsSync(tempDir)) {
			fsSync.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	describe('persistence with steno', () => {
		it('should immediately persist data to disk with setItem', async () => {
			const storage = new SupabaseSessionStorage(sessionPath);

			// Set a session token
			const testSession = JSON.stringify({
				access_token: 'test-token',
				refresh_token: 'test-refresh'
			});
			await storage.setItem('sb-localhost-auth-token', testSession);

			// Immediately verify file exists and is readable (without any delay)
			expect(fsSync.existsSync(sessionPath)).toBe(true);

			// Read directly from disk (simulating a new process)
			const diskData = JSON.parse(fsSync.readFileSync(sessionPath, 'utf8'));
			expect(diskData['sb-localhost-auth-token']).toBe(testSession);
		});

		it('should guarantee data is on disk before returning', async () => {
			const storage = new SupabaseSessionStorage(sessionPath);

			// Write large session data
			const largeSession = JSON.stringify({
				access_token: 'x'.repeat(10000),
				refresh_token: 'y'.repeat(10000),
				user: { id: 'test', email: 'test@example.com' }
			});

			await storage.setItem('sb-localhost-auth-token', largeSession);

			// Create a NEW storage instance (simulates separate CLI command)
			const newStorage = new SupabaseSessionStorage(sessionPath);

			// Should immediately read the persisted data
			const retrieved = await newStorage.getItem('sb-localhost-auth-token');
			expect(retrieved).toBe(largeSession);
		});

		it('should handle rapid sequential writes without data loss', async () => {
			const storage = new SupabaseSessionStorage(sessionPath);

			// Simulate rapid token updates (like during refresh)
			for (let i = 0; i < 5; i++) {
				const session = JSON.stringify({
					access_token: `token-${i}`,
					expires_at: Date.now() + i * 1000
				});
				await storage.setItem('sb-localhost-auth-token', session);

				// Each write should be immediately readable
				const newStorage = new SupabaseSessionStorage(sessionPath);
				const retrieved = await newStorage.getItem('sb-localhost-auth-token');
				expect(JSON.parse(retrieved!).access_token).toBe(`token-${i}`);
			}
		});
	});

	describe('atomic writes', () => {
		it('should complete writes atomically without leaving temp files', async () => {
			const storage = new SupabaseSessionStorage(sessionPath);

			await storage.setItem('test-key', 'test-value');

			// Final file should exist with correct content
			expect(fsSync.existsSync(sessionPath)).toBe(true);
			const diskData = JSON.parse(fsSync.readFileSync(sessionPath, 'utf8'));
			expect(diskData['test-key']).toBe('test-value');

			// No unexpected extra files should remain in directory
			const files = fsSync.readdirSync(path.dirname(sessionPath));
			expect(files).toEqual([path.basename(sessionPath)]);
		});

		it('should maintain correct file permissions (0700 for directory)', async () => {
			const storage = new SupabaseSessionStorage(sessionPath);

			await storage.setItem('test-key', 'test-value');

			// Check that file exists
			expect(fsSync.existsSync(sessionPath)).toBe(true);

			// Check directory has correct permissions
			const dir = path.dirname(sessionPath);
			const stats = fsSync.statSync(dir);
			const mode = stats.mode & 0o777;

			// Directory should be readable/writable/executable by owner only (0700)
			expect(mode).toBe(0o700);
		});
	});

	describe('basic operations', () => {
		it('should get and set items', async () => {
			const storage = new SupabaseSessionStorage(sessionPath);

			await storage.setItem('key1', 'value1');
			expect(await storage.getItem('key1')).toBe('value1');
		});

		it('should return null for non-existent items', async () => {
			const storage = new SupabaseSessionStorage(sessionPath);

			expect(await storage.getItem('non-existent')).toBe(null);
		});

		it('should remove items', async () => {
			const storage = new SupabaseSessionStorage(sessionPath);

			await storage.setItem('key1', 'value1');
			expect(await storage.getItem('key1')).toBe('value1');

			await storage.removeItem('key1');
			expect(await storage.getItem('key1')).toBe(null);

			// Verify removed from disk
			const newStorage = new SupabaseSessionStorage(sessionPath);
			expect(await newStorage.getItem('key1')).toBe(null);
		});
	});

	describe('initialization', () => {
		it('should load existing session on initialization', async () => {
			// Create initial storage and save data
			const storage1 = new SupabaseSessionStorage(sessionPath);
			await storage1.setItem('key1', 'value1');

			// Create new instance (simulates new process)
			const storage2 = new SupabaseSessionStorage(sessionPath);
			expect(await storage2.getItem('key1')).toBe('value1');
		});

		it('should handle non-existent session file gracefully', async () => {
			// Don't create any file, just initialize
			const storage = new SupabaseSessionStorage(sessionPath);

			// Should not throw and should work normally
			expect(await storage.getItem('any-key')).toBe(null);
			await storage.setItem('key1', 'value1');
			expect(await storage.getItem('key1')).toBe('value1');
		});

		it('should create directory if it does not exist', async () => {
			const deepPath = path.join(
				tempDir,
				'deep',
				'nested',
				'path',
				'session.json'
			);
			const storage = new SupabaseSessionStorage(deepPath);

			await storage.setItem('key1', 'value1');

			expect(fsSync.existsSync(deepPath)).toBe(true);
			expect(fsSync.existsSync(path.dirname(deepPath))).toBe(true);
		});
	});

	describe('error handling', () => {
		it('should not throw on persist errors', async () => {
			const invalidPath = '/invalid/path/that/cannot/be/written/session.json';
			const storage = new SupabaseSessionStorage(invalidPath);

			// Should not throw, session should remain in memory
			await storage.setItem('key1', 'value1');

			// Should still work in memory
			expect(await storage.getItem('key1')).toBe('value1');
		});

		it('should handle corrupted session file gracefully', async () => {
			// Write corrupted JSON
			fsSync.writeFileSync(sessionPath, 'invalid json {{{');

			// Should not throw on initialization
			expect(() => new SupabaseSessionStorage(sessionPath)).not.toThrow();

			// Should work normally after initialization
			const storage = new SupabaseSessionStorage(sessionPath);
			await storage.setItem('key1', 'value1');
			expect(await storage.getItem('key1')).toBe('value1');
		});
	});
});
