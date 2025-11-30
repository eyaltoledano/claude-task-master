/**
 * Barebones storage adapter for Supabase Auth sessions
 *
 * This is a simple key-value store that lets Supabase manage sessions
 * without interference. No parsing, no merging, no guessing - just storage.
 *
 * Supabase handles:
 * - Session refresh and token rotation
 * - Expiry checking
 * - Token validation
 *
 * We handle:
 * - Simple get/set/remove/clear operations
 * - Persistence to ~/.taskmaster/session.json with atomic writes via steno
 */

import fsSync from 'fs';
import path from 'path';
import type { SupportedStorage } from '@supabase/supabase-js';
import fs from 'fs/promises';
import { Writer } from 'steno';
import { getLogger } from '../../../common/logger/index.js';

const DEFAULT_SESSION_FILE = path.join(
	process.env.HOME || process.env.USERPROFILE || '~',
	'.taskmaster',
	'session.json'
);

export class SupabaseSessionStorage implements SupportedStorage {
	private storage: Map<string, string> = new Map();
	private persistPath: string;
	private logger = getLogger('SupabaseSessionStorage');
	private writer: Writer;
	private initPromise: Promise<void>;

	constructor(persistPath: string = DEFAULT_SESSION_FILE) {
		this.persistPath = persistPath;
		this.writer = new Writer(persistPath);
		this.initPromise = this.load();
	}

	/**
	 * Load session data from disk on initialization
	 */
	private async load(): Promise<void> {
		try {
			// Ensure directory exists
			const dir = path.dirname(this.persistPath);
			await fs.mkdir(dir, { recursive: true, mode: 0o700 });

			// Try to read existing session
			if (fsSync.existsSync(this.persistPath)) {
				const data = JSON.parse(await fs.readFile(this.persistPath, 'utf8'));
				Object.entries(data).forEach(([k, v]) =>
					this.storage.set(k, v as string)
				);
				this.logger.debug('Loaded session from disk', {
					keys: Array.from(this.storage.keys())
				});
			}
		} catch (error) {
			this.logger.error('Failed to load session:', error);
			// Don't throw - allow starting with fresh session
		}
	}

	/**
	 * Persist session data to disk immediately
	 * Uses steno for atomic writes with fsync guarantees
	 * This prevents race conditions in rapid CLI command sequences
	 */
	private async persist(): Promise<void> {
		try {
			const data = Object.fromEntries(this.storage);
			const jsonContent = JSON.stringify(data, null, 2);

			// steno handles atomic writes with temp file + rename
			// and ensures data is flushed to disk
			await this.writer.write(jsonContent + '\n');

			this.logger.debug('Persisted session to disk (steno)');
		} catch (error) {
			this.logger.error('Failed to persist session:', error);
			// Don't throw - session is still in memory
		}
	}

	/**
	 * Get item from storage
	 * Supabase will call this to retrieve session data
	 * Returns a promise to ensure initialization completes first
	 */
	async getItem(key: string): Promise<string | null> {
		// Wait for initialization to complete
		await this.initPromise;

		const value = this.storage.get(key) ?? null;
		this.logger.debug('getItem called', { key, hasValue: !!value });
		return value;
	}

	/**
	 * Set item in storage
	 * Supabase will call this to store/update session data
	 * CRITICAL: This is called during token refresh - must persist immediately
	 */
	async setItem(key: string, value: string): Promise<void> {
		// Wait for initialization to complete
		await this.initPromise;

		this.logger.debug('setItem called', { key });
		this.storage.set(key, value);

		// Immediately persist on every write
		// steno ensures atomic writes with fsync
		await this.persist();
	}

	/**
	 * Remove item from storage
	 * Supabase will call this during sign out
	 */
	async removeItem(key: string): Promise<void> {
		// Wait for initialization to complete
		await this.initPromise;

		this.logger.debug('removeItem called', { key });
		this.storage.delete(key);
		await this.persist();
	}

	/**
	 * Clear all session data
	 * Useful for complete logout scenarios
	 */
	async clear(): Promise<void> {
		// Wait for initialization to complete
		await this.initPromise;

		this.logger.debug('clear called');
		this.storage.clear();
		await this.persist();
	}
}
