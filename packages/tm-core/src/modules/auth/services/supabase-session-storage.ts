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
 * - Persistence to ~/.taskmaster/session.json
 */

import type { SupportedStorage } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
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

	constructor(persistPath: string = DEFAULT_SESSION_FILE) {
		this.persistPath = persistPath;
		this.load();
	}

	/**
	 * Load session data from disk on initialization
	 */
	private load(): void {
		try {
			if (fs.existsSync(this.persistPath)) {
				const data = JSON.parse(fs.readFileSync(this.persistPath, 'utf8'));
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
	 */
	private persist(): void {
		try {
			// Ensure directory exists
			const dir = path.dirname(this.persistPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
			}

			// Write atomically with temp file
			const data = Object.fromEntries(this.storage);
			const tempFile = `${this.persistPath}.tmp`;
			fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), {
				mode: 0o600
			});
			fs.renameSync(tempFile, this.persistPath);

			this.logger.debug('Persisted session to disk');
		} catch (error) {
			this.logger.error('Failed to persist session:', error);
			// Don't throw - session is still in memory
		}
	}

	/**
	 * Get item from storage
	 * Supabase will call this to retrieve session data
	 */
	getItem(key: string): string | null {
		const value = this.storage.get(key) ?? null;
		this.logger.debug('getItem called', { key, hasValue: !!value });
		return value;
	}

	/**
	 * Set item in storage
	 * Supabase will call this to store/update session data
	 * CRITICAL: This is called during token refresh - must persist immediately
	 */
	setItem(key: string, value: string): void {
		this.logger.debug('setItem called', { key });
		this.storage.set(key, value);
		this.persist(); // Immediately persist on every write
	}

	/**
	 * Remove item from storage
	 * Supabase will call this during sign out
	 */
	removeItem(key: string): void {
		this.logger.debug('removeItem called', { key });
		this.storage.delete(key);
		this.persist();
	}

	/**
	 * Clear all session data
	 */
	clear(): void {
		this.logger.debug('clear called');
		this.storage.clear();
		this.persist();
	}
}
