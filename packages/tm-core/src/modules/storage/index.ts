/**
 * @fileoverview Storage layer for the tm-core package
 * This file exports all storage-related classes and interfaces
 */

// Export storage implementations
export { FileStorage } from './adapters/file-storage/index.js';
export { ApiStorage, type ApiStorageConfig } from './adapters/api-storage.js';
export { StorageFactory } from './services/storage-factory.js';

// Export activity logger
export {
	logActivity,
	readActivityLog,
	filterActivityLog,
	type ActivityEvent,
	type ActivityFilter
} from './adapters/activity-logger.js';

// Export storage interface and types
export type {
	IStorage,
	StorageStats
} from '../../common/interfaces/storage.interface.js';

// Placeholder exports - these will be implemented in later tasks
export interface StorageAdapter {
	read(path: string): Promise<string | null>;
	write(path: string, data: string): Promise<void>;
	exists(path: string): Promise<boolean>;
	delete(path: string): Promise<void>;
}

/**
 * @deprecated This is a placeholder class that will be properly implemented in later tasks
 */
export class PlaceholderStorage implements StorageAdapter {
	private data = new Map<string, string>();

	async read(path: string): Promise<string | null> {
		return this.data.get(path) || null;
	}

	async write(path: string, data: string): Promise<void> {
		this.data.set(path, data);
	}

	async exists(path: string): Promise<boolean> {
		return this.data.has(path);
	}

	async delete(path: string): Promise<void> {
		this.data.delete(path);
	}
}
