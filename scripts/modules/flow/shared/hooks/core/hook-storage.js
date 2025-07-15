import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Hook Storage - provides persistent data storage for hooks
 */
export class HookStorage {
	constructor(projectRoot) {
		this.projectRoot = projectRoot;
		this.storageDir = path.join(__dirname, '..', 'data');
		this.initialized = false;
		this.cache = new Map();
	}

	/**
	 * Initialize storage system
	 */
	async initialize() {
		if (this.initialized) return;

		try {
			// Ensure storage directory exists
			await fs.mkdir(this.storageDir, { recursive: true });

			// Load existing data into cache
			await this.loadCache();

			this.initialized = true;
			console.log('💾 Hook storage initialized');
		} catch (error) {
			console.error('❌ Failed to initialize hook storage:', error);
			throw error;
		}
	}

	/**
	 * Load all data files into cache
	 */
	async loadCache() {
		try {
			const files = await fs.readdir(this.storageDir);

			for (const file of files) {
				if (file.endsWith('.json')) {
					const hookName = path.basename(file, '.json');
					const filePath = path.join(this.storageDir, file);

					try {
						const data = await fs.readFile(filePath, 'utf8');
						this.cache.set(hookName, JSON.parse(data));
					} catch (fileError) {
						console.warn(
							`⚠️ Failed to load hook data for ${hookName}:`,
							fileError.message
						);
					}
				}
			}
		} catch (error) {
			// Storage directory doesn't exist yet, which is fine
			if (error.code !== 'ENOENT') {
				throw error;
			}
		}
	}

	/**
	 * Get data for a specific hook
	 */
	async get(hookName, key = null) {
		if (!this.initialized) {
			await this.initialize();
		}

		const hookData = this.cache.get(hookName) || {};

		if (key === null) {
			return hookData;
		}

		return hookData[key] || null;
	}

	/**
	 * Set data for a specific hook
	 */
	async set(hookName, key, value) {
		if (!this.initialized) {
			await this.initialize();
		}

		// Get existing data or create new
		const hookData = this.cache.get(hookName) || {};

		// Update data
		hookData[key] = value;
		hookData._lastUpdated = new Date().toISOString();

		// Update cache
		this.cache.set(hookName, hookData);

		// Persist to disk
		await this.persist(hookName);

		return true;
	}

	/**
	 * Update data for a specific hook (merge with existing)
	 */
	async update(hookName, data) {
		if (!this.initialized) {
			await this.initialize();
		}

		// Get existing data or create new
		const hookData = this.cache.get(hookName) || {};

		// Merge data
		Object.assign(hookData, data);
		hookData._lastUpdated = new Date().toISOString();

		// Update cache
		this.cache.set(hookName, hookData);

		// Persist to disk
		await this.persist(hookName);

		return hookData;
	}

	/**
	 * Delete data for a specific hook
	 */
	async delete(hookName, key = null) {
		if (!this.initialized) {
			await this.initialize();
		}

		const hookData = this.cache.get(hookName);
		if (!hookData) return false;

		if (key === null) {
			// Delete entire hook data
			this.cache.delete(hookName);

			// Delete file
			const filePath = path.join(this.storageDir, `${hookName}.json`);
			try {
				await fs.unlink(filePath);
			} catch (error) {
				// File might not exist, which is fine
				if (error.code !== 'ENOENT') {
					throw error;
				}
			}
		} else {
			// Delete specific key
			if (key in hookData) {
				const newHookData = { ...hookData };
				// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
				delete newHookData[key];
				newHookData._lastUpdated = new Date().toISOString();

				this.cache.set(hookName, newHookData);
				await this.persist(hookName);
			}
		}

		return true;
	}

	/**
	 * Persist hook data to disk
	 */
	async persist(hookName) {
		const hookData = this.cache.get(hookName);
		if (!hookData) return;

		const filePath = path.join(this.storageDir, `${hookName}.json`);

		try {
			await fs.writeFile(filePath, JSON.stringify(hookData, null, 2));
		} catch (error) {
			console.error(`❌ Failed to persist hook data for ${hookName}:`, error);
			throw error;
		}
	}

	/**
	 * Get all hook data
	 */
	async getAll() {
		if (!this.initialized) {
			await this.initialize();
		}

		const result = {};
		for (const [hookName, data] of this.cache) {
			result[hookName] = data;
		}

		return result;
	}

	/**
	 * Clear all data for a hook
	 */
	async clear(hookName) {
		return this.delete(hookName);
	}

	/**
	 * Get storage statistics
	 */
	async getStats() {
		if (!this.initialized) {
			await this.initialize();
		}

		const stats = {
			totalHooks: this.cache.size,
			storageDir: this.storageDir,
			hooks: {}
		};

		for (const [hookName, data] of this.cache) {
			const keyCount = Object.keys(data).filter(
				(key) => !key.startsWith('_')
			).length;
			stats.hooks[hookName] = {
				keys: keyCount,
				lastUpdated: data._lastUpdated || 'unknown',
				sizeBytes: JSON.stringify(data).length
			};
		}

		return stats;
	}

	/**
	 * Backup all hook data
	 */
	async backup() {
		if (!this.initialized) {
			await this.initialize();
		}

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const backupDir = path.join(this.storageDir, 'backups');
		const backupFile = path.join(backupDir, `hooks-backup-${timestamp}.json`);

		await fs.mkdir(backupDir, { recursive: true });

		const allData = await this.getAll();
		await fs.writeFile(backupFile, JSON.stringify(allData, null, 2));

		return backupFile;
	}

	/**
	 * Restore from backup
	 */
	async restore(backupFile) {
		try {
			const data = await fs.readFile(backupFile, 'utf8');
			const allData = JSON.parse(data);

			// Clear current cache
			this.cache.clear();

			// Load backup data
			for (const [hookName, hookData] of Object.entries(allData)) {
				this.cache.set(hookName, hookData);
				await this.persist(hookName);
			}

			return true;
		} catch (error) {
			console.error('❌ Failed to restore from backup:', error);
			throw error;
		}
	}

	/**
	 * Clean up old data
	 */
	async cleanup(maxAge = 30 * 24 * 60 * 60 * 1000) {
		// 30 days default
		if (!this.initialized) {
			await this.initialize();
		}

		const cutoff = new Date(Date.now() - maxAge);
		let cleaned = 0;

		for (const [hookName, data] of this.cache) {
			if (data._lastUpdated) {
				const lastUpdated = new Date(data._lastUpdated);
				if (lastUpdated < cutoff) {
					await this.delete(hookName);
					cleaned++;
				}
			}
		}

		return { cleaned, cutoff: cutoff.toISOString() };
	}
}
