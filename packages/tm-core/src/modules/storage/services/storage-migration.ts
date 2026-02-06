/**
 * @fileoverview Storage migration utilities for TaskMaster
 *
 * Provides migration functionality between storage backends:
 * - File storage (tasks.json) <-> SQLite storage
 *
 * Handles data transformation, validation, and configuration updates.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IStorage } from '../../../common/interfaces/storage.interface.js';
import type { StorageType } from '../../../common/types/index.js';
import { FormatHandler } from '../adapters/file-storage/format-handler.js';
import { FileStorage } from '../adapters/file-storage/index.js';
import { SqliteStorage } from '../adapters/sqlite-storage/index.js';

/**
 * Result of a migration operation
 */
export interface MigrationResult {
	/** Whether the migration completed successfully */
	success: boolean;
	/** Number of tasks migrated */
	taskCount: number;
	/** Alias for taskCount (for MCP tool compatibility) */
	tasksCount?: number;
	/** Number of subtasks migrated */
	subtaskCount: number;
	/** Number of tags migrated */
	tagsCount?: number;
	/** List of error messages encountered */
	errors: string[];
	/** List of warning messages */
	warnings: string[];
	/** Source storage type */
	sourceType: StorageType;
	/** Target storage type */
	targetType: StorageType;
	/** Duration of migration in milliseconds */
	durationMs: number;
}

/**
 * Status of the current storage configuration
 */
export interface StorageStatus {
	/** Current storage type */
	currentType: StorageType;
	/** Whether SQLite database exists */
	sqliteExists: boolean;
	/** Whether JSONL file exists */
	jsonlExists: boolean;
	/** Whether tasks.json exists */
	tasksJsonExists: boolean;
	/** List of available tags */
	tags: string[];
}

/**
 * Options for migration operations
 */
export interface MigrationOptions {
	/** Whether to create a backup before migration (default: true) */
	createBackup?: boolean;
	/** Whether to validate data after migration (default: true) */
	validateAfterMigration?: boolean;
	/** Specific tag to migrate (default: migrates all tags) */
	tag?: string;
	/** Whether to update config.json (default: true) */
	updateConfig?: boolean;
	/** Whether to update .gitignore for SQLite (default: true) */
	updateGitignore?: boolean;
}

/**
 * Validation result for comparing source and target data
 */
export interface ValidationResult {
	/** Whether validation passed */
	isValid: boolean;
	/** Total tasks in source */
	sourceTaskCount: number;
	/** Total tasks in target */
	targetTaskCount: number;
	/** Total subtasks in source */
	sourceSubtaskCount: number;
	/** Total subtasks in target */
	targetSubtaskCount: number;
	/** List of discrepancies found */
	discrepancies: string[];
}

/**
 * Configuration file structure
 */
interface TaskMasterConfig {
	storage?: {
		type?: StorageType;
		[key: string]: unknown;
	};
	[key: string]: unknown;
}

/**
 * Storage migration service for TaskMaster
 *
 * Handles migration between file storage (tasks.json) and SQLite storage,
 * with data validation and configuration updates.
 *
 * @example
 * ```typescript
 * const migration = new StorageMigration('/path/to/project');
 *
 * // Migrate from file to SQLite
 * const result = await migration.migrateToSqlite();
 * console.log(`Migrated ${result.taskCount} tasks`);
 *
 * // Validate the migration
 * const validation = await migration.validateMigration('file', 'sqlite');
 * if (validation.isValid) {
 *   console.log('Migration validated successfully');
 * }
 * ```
 */
export class StorageMigration {
	private projectPath: string;
	private taskmasterDir: string;
	private tasksDir: string;
	private configPath: string;
	private gitignorePath: string;
	private formatHandler: FormatHandler;

	/**
	 * Create a new StorageMigration instance
	 * @param projectPath - Root path of the project
	 */
	constructor(projectPath: string) {
		this.projectPath = projectPath;
		this.taskmasterDir = path.join(projectPath, '.taskmaster');
		this.tasksDir = path.join(this.taskmasterDir, 'tasks');
		this.configPath = path.join(this.taskmasterDir, 'config.json');
		this.gitignorePath = path.join(projectPath, '.gitignore');
		this.formatHandler = new FormatHandler();
	}

	/**
	 * Get the current storage status
	 *
	 * @returns Storage status including current type and available files
	 */
	async getStatus(): Promise<StorageStatus> {
		const currentType = await this.getCurrentStorageType();

		const sqliteDbPath = path.join(this.tasksDir, 'tasks.db');
		const jsonlPath = path.join(this.tasksDir, 'tasks.jsonl');
		const tasksJsonPath = path.join(this.tasksDir, 'tasks.json');

		const sqliteExists = fs.existsSync(sqliteDbPath);
		const jsonlExists = fs.existsSync(jsonlPath);
		const tasksJsonExists = fs.existsSync(tasksJsonPath);

		// Get tags from whichever storage exists
		let tags: string[] = [];
		let sqliteStorage: SqliteStorage | undefined;
		try {
			if (currentType === 'sqlite' && sqliteExists) {
				sqliteStorage = new SqliteStorage(this.projectPath);
				await sqliteStorage.initialize();
				tags = await sqliteStorage.getAllTags();
			} else if (tasksJsonExists) {
				const rawData = JSON.parse(
					await fs.promises.readFile(tasksJsonPath, 'utf-8')
				);
				tags = this.formatHandler.extractTags(rawData);
			}
		} catch {
			tags = ['master'];
		} finally {
			// Always close storage to prevent resource leaks
			await sqliteStorage?.close();
		}

		if (tags.length === 0) {
			tags = ['master'];
		}

		return {
			currentType,
			sqliteExists,
			jsonlExists,
			tasksJsonExists,
			tags
		};
	}

	/**
	 * Rebuild SQLite database from JSONL file
	 *
	 * This is useful when the SQLite database is corrupted or out of sync
	 * with the JSONL file (which is the git-synced source of truth).
	 *
	 * @returns Migration result
	 */
	async rebuildSqlite(): Promise<MigrationResult> {
		const startTime = Date.now();
		const errors: string[] = [];
		const warnings: string[] = [];
		let taskCount = 0;
		let subtaskCount = 0;
		let tagsCount = 0;

		try {
			const jsonlPath = path.join(this.tasksDir, 'tasks.jsonl');
			const sqliteDbPath = path.join(this.tasksDir, 'tasks.db');

			// Check if JSONL exists
			if (!fs.existsSync(jsonlPath)) {
				errors.push(`JSONL file not found at ${jsonlPath}`);
				return {
					success: false,
					taskCount,
					tasksCount: taskCount,
					subtaskCount,
					tagsCount,
					errors,
					warnings,
					sourceType: 'sqlite',
					targetType: 'sqlite',
					durationMs: Date.now() - startTime
				};
			}

			// Delete existing database if it exists
			if (fs.existsSync(sqliteDbPath)) {
				await fs.promises.unlink(sqliteDbPath);
				warnings.push('Deleted existing SQLite database');
			}

			// Also delete WAL and SHM files if they exist
			const walPath = `${sqliteDbPath}-wal`;
			const shmPath = `${sqliteDbPath}-shm`;
			if (fs.existsSync(walPath)) {
				await fs.promises.unlink(walPath);
			}
			if (fs.existsSync(shmPath)) {
				await fs.promises.unlink(shmPath);
			}

			// Create new SQLite storage (this will rebuild from JSONL on init)
			const sqliteStorage = new SqliteStorage(this.projectPath);
			await sqliteStorage.initialize();

			// Get stats after rebuild
			const tags = await sqliteStorage.getAllTags();
			tagsCount = tags.length;

			for (const tag of tags) {
				const tasks = await sqliteStorage.loadTasks(tag);
				taskCount += tasks.length;
				for (const task of tasks) {
					subtaskCount += task.subtasks?.length || 0;
				}
			}

			await sqliteStorage.close();

			return {
				success: true,
				taskCount,
				tasksCount: taskCount,
				subtaskCount,
				tagsCount,
				errors,
				warnings,
				sourceType: 'sqlite',
				targetType: 'sqlite',
				durationMs: Date.now() - startTime
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			errors.push(errorMessage);

			return {
				success: false,
				taskCount,
				tasksCount: taskCount,
				subtaskCount,
				tagsCount,
				errors,
				warnings,
				sourceType: 'sqlite',
				targetType: 'sqlite',
				durationMs: Date.now() - startTime
			};
		}
	}

	/**
	 * Migrate from file storage (tasks.json) to SQLite
	 *
	 * Steps:
	 * 1. Read tasks from tasks.json (handles both formats)
	 * 2. Create SQLite database and save all tasks
	 * 3. Export to JSONL for git sync
	 * 4. Update config.json to set storage.type = 'sqlite'
	 * 5. Add tasks.db* patterns to .gitignore
	 *
	 * @param options - Migration options
	 * @returns Migration result
	 */
	async migrateToSqlite(
		options: MigrationOptions = {}
	): Promise<MigrationResult> {
		const startTime = Date.now();
		const errors: string[] = [];
		const warnings: string[] = [];
		let taskCount = 0;
		let subtaskCount = 0;
		let tagsCount = 0;

		const {
			createBackup = true,
			validateAfterMigration = true,
			updateConfig = true,
			updateGitignore = true
		} = options;

		// Declare storage variables outside try for finally cleanup
		let sqliteStorage: SqliteStorage | undefined;
		let fileStorage: FileStorage | undefined;

		try {
			// Step 1: Check current storage type
			const currentType = await this.getCurrentStorageType();
			if (currentType === 'sqlite') {
				warnings.push('Already using SQLite storage');
			}

			// Step 2: Read tasks from file storage
			const tasksJsonPath = path.join(this.tasksDir, 'tasks.json');
			if (!fs.existsSync(tasksJsonPath)) {
				throw new Error(`tasks.json not found at ${tasksJsonPath}`);
			}

			// Create backup if requested
			if (createBackup) {
				await this.createBackup(tasksJsonPath);
			}

			// Read and parse tasks.json
			const rawData = JSON.parse(
				await fs.promises.readFile(tasksJsonPath, 'utf-8')
			);
			const tags = this.formatHandler.extractTags(rawData);

			if (tags.length === 0) {
				tags.push('master');
			}
			tagsCount = tags.length;

			// Step 3: Create SQLite storage and initialize
			sqliteStorage = new SqliteStorage(this.projectPath);
			await sqliteStorage.initialize();

			// Step 4: Migrate all tasks for each tag
			for (const tag of tags) {
				const tasks = this.formatHandler.extractTasks(rawData, tag);
				const metadata = this.formatHandler.extractMetadata(rawData, tag);

				if (tasks.length > 0) {
					// Save tasks to SQLite
					await sqliteStorage.saveTasks(tasks, tag);
					taskCount += tasks.length;

					// Count subtasks
					for (const task of tasks) {
						subtaskCount += task.subtasks?.length || 0;
					}

					// Save metadata if present
					if (metadata) {
						await sqliteStorage.saveMetadata(metadata, tag);
					}
				}
			}

			// Step 5: Update config.json
			if (updateConfig) {
				await this.updateConfig('sqlite');
			}

			// Step 6: Update .gitignore
			if (updateGitignore) {
				await this.updateGitignore();
			}

			// Step 7: Validate migration if requested
			if (validateAfterMigration) {
				fileStorage = new FileStorage(this.projectPath);
				await fileStorage.initialize();

				const validation = await this.validate(
					fileStorage,
					sqliteStorage,
					tags
				);

				if (!validation.isValid) {
					errors.push(...validation.discrepancies);
				}
			}

			return {
				success: errors.length === 0,
				taskCount,
				tasksCount: taskCount,
				subtaskCount,
				tagsCount,
				errors,
				warnings,
				sourceType: 'file',
				targetType: 'sqlite',
				durationMs: Date.now() - startTime
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			errors.push(errorMessage);

			return {
				success: false,
				taskCount,
				tasksCount: taskCount,
				subtaskCount,
				tagsCount,
				errors,
				warnings,
				sourceType: 'file',
				targetType: 'sqlite',
				durationMs: Date.now() - startTime
			};
		} finally {
			// Always close storage connections to prevent resource leaks
			await sqliteStorage?.close();
			await fileStorage?.close();
		}
	}

	/**
	 * Migrate from SQLite storage to file storage (tasks.json)
	 *
	 * Steps:
	 * 1. Load all tasks from SQLite
	 * 2. Save to tasks.json in the tagged format
	 * 3. Update config.json to set storage.type = 'file'
	 *
	 * @param options - Migration options
	 * @returns Migration result
	 */
	async migrateToFile(
		options: MigrationOptions = {}
	): Promise<MigrationResult> {
		const startTime = Date.now();
		const errors: string[] = [];
		const warnings: string[] = [];
		let taskCount = 0;
		let subtaskCount = 0;
		let tagsCount = 0;

		const {
			createBackup = true,
			validateAfterMigration = true,
			updateConfig = true
		} = options;

		// Declare storage variables outside try for finally cleanup
		let sqliteStorage: SqliteStorage | undefined;
		let fileStorage: FileStorage | undefined;

		try {
			// Step 1: Check current storage type
			const currentType = await this.getCurrentStorageType();
			if (currentType === 'file') {
				warnings.push('Already using file storage');
			}

			// Step 2: Initialize SQLite storage and load tasks
			sqliteStorage = new SqliteStorage(this.projectPath);
			await sqliteStorage.initialize();

			// Get all tags
			const tags = await sqliteStorage.getAllTags();
			if (tags.length === 0) {
				tags.push('master');
			}
			tagsCount = tags.length;

			// Create backup of existing tasks.json if it exists
			const tasksJsonPath = path.join(this.tasksDir, 'tasks.json');
			if (createBackup && fs.existsSync(tasksJsonPath)) {
				await this.createBackup(tasksJsonPath);
			}

			// Step 3: Initialize file storage
			fileStorage = new FileStorage(this.projectPath);
			await fileStorage.initialize();

			// Step 4: Migrate all tasks for each tag
			for (const tag of tags) {
				const tasks = await sqliteStorage.loadTasks(tag);
				const metadata = await sqliteStorage.loadMetadata(tag);

				if (tasks.length > 0) {
					// Save tasks to file storage
					await fileStorage.saveTasks(tasks, tag);
					taskCount += tasks.length;

					// Count subtasks
					for (const task of tasks) {
						subtaskCount += task.subtasks?.length || 0;
					}

					// Save metadata if present
					if (metadata) {
						await fileStorage.saveMetadata(metadata, tag);
					}
				}
			}

			// Step 5: Update config.json
			if (updateConfig) {
				await this.updateConfig('file');
			}

			// Step 6: Validate migration if requested
			if (validateAfterMigration) {
				const validation = await this.validate(
					sqliteStorage,
					fileStorage,
					tags
				);

				if (!validation.isValid) {
					errors.push(...validation.discrepancies);
				}
			}

			return {
				success: errors.length === 0,
				taskCount,
				tasksCount: taskCount,
				subtaskCount,
				tagsCount,
				errors,
				warnings,
				sourceType: 'sqlite',
				targetType: 'file',
				durationMs: Date.now() - startTime
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			errors.push(errorMessage);

			return {
				success: false,
				taskCount,
				tasksCount: taskCount,
				subtaskCount,
				tagsCount,
				errors,
				warnings,
				sourceType: 'sqlite',
				targetType: 'file',
				durationMs: Date.now() - startTime
			};
		} finally {
			// Always close storage connections to prevent resource leaks
			await sqliteStorage?.close();
			await fileStorage?.close();
		}
	}

	/**
	 * Get the current storage type from config.json
	 *
	 * @returns Current storage type or 'auto' if not set
	 */
	async getCurrentStorageType(): Promise<StorageType> {
		try {
			if (!fs.existsSync(this.configPath)) {
				return 'auto';
			}

			const config: TaskMasterConfig = JSON.parse(
				await fs.promises.readFile(this.configPath, 'utf-8')
			);

			return (config.storage?.type as StorageType) || 'auto';
		} catch {
			return 'auto';
		}
	}

	/**
	 * Validate migration by comparing task counts and data between source and target
	 *
	 * @param source - Source storage adapter
	 * @param target - Target storage adapter
	 * @param tags - Tags to validate (optional, validates all tags if not provided)
	 * @returns Validation result
	 */
	async validate(
		source: IStorage,
		target: IStorage,
		tags?: string[]
	): Promise<ValidationResult> {
		const discrepancies: string[] = [];
		let sourceTaskCount = 0;
		let targetTaskCount = 0;
		let sourceSubtaskCount = 0;
		let targetSubtaskCount = 0;

		// Get tags to validate
		const tagsToValidate = tags || (await source.getAllTags());

		for (const tag of tagsToValidate) {
			// Load tasks from both storages
			const sourceTasks = await source.loadTasks(tag);
			const targetTasks = await target.loadTasks(tag);

			sourceTaskCount += sourceTasks.length;
			targetTaskCount += targetTasks.length;

			// Check task count match
			if (sourceTasks.length !== targetTasks.length) {
				discrepancies.push(
					`Tag "${tag}": Task count mismatch - source: ${sourceTasks.length}, target: ${targetTasks.length}`
				);
			}

			// Create maps for detailed comparison
			const sourceMap = new Map(sourceTasks.map((t) => [String(t.id), t]));
			const targetMap = new Map(targetTasks.map((t) => [String(t.id), t]));

			// Build set of valid task IDs for dependency validation
			const validTaskIds = new Set(sourceTasks.map((t) => String(t.id)));

			// Check for missing tasks
			for (const [id, sourceTask] of sourceMap) {
				// Count unique subtask IDs (source may have duplicates that get deduplicated)
				const sourceSubtaskIds = new Set(
					(sourceTask.subtasks || []).map((s) => s.id)
				);
				sourceSubtaskCount += sourceSubtaskIds.size;

				const targetTask = targetMap.get(id);
				if (!targetTask) {
					discrepancies.push(`Tag "${tag}": Task ${id} missing in target`);
					continue;
				}

				targetSubtaskCount += targetTask.subtasks?.length || 0;

				// Validate key fields
				if (sourceTask.title !== targetTask.title) {
					discrepancies.push(`Tag "${tag}": Task ${id} title mismatch`);
				}
				if (sourceTask.status !== targetTask.status) {
					discrepancies.push(
						`Tag "${tag}": Task ${id} status mismatch - source: ${sourceTask.status}, target: ${targetTask.status}`
					);
				}
				if (sourceTask.priority !== targetTask.priority) {
					discrepancies.push(
						`Tag "${tag}": Task ${id} priority mismatch - source: ${sourceTask.priority}, target: ${targetTask.priority}`
					);
				}

				// Check subtask count (using unique IDs from source)
				const targetSubtasks = targetTask.subtasks?.length || 0;
				if (sourceSubtaskIds.size !== targetSubtasks) {
					discrepancies.push(
						`Tag "${tag}": Task ${id} subtask count mismatch - source: ${sourceSubtaskIds.size} unique, target: ${targetSubtasks}`
					);
				}

				// Check dependencies (only compare valid dependencies that exist in source)
				const sourceValidDeps = (sourceTask.dependencies || [])
					.filter((d) => validTaskIds.has(String(d)))
					.map(String)
					.sort()
					.join(',');
				const targetDeps =
					(targetTask.dependencies || []).map(String).sort().join(',') || '';
				if (sourceValidDeps !== targetDeps) {
					discrepancies.push(`Tag "${tag}": Task ${id} dependencies mismatch`);
				}
			}

			// Check for extra tasks in target
			for (const id of targetMap.keys()) {
				if (!sourceMap.has(id)) {
					discrepancies.push(
						`Tag "${tag}": Task ${id} exists in target but not in source`
					);
				}
			}
		}

		return {
			isValid: discrepancies.length === 0,
			sourceTaskCount,
			targetTaskCount,
			sourceSubtaskCount,
			targetSubtaskCount,
			discrepancies
		};
	}

	/**
	 * Perform a round-trip validation test
	 *
	 * Exports from source, imports to target, and compares the results.
	 * This is useful for verifying migration integrity.
	 *
	 * @param sourceType - Type of source storage ('file' or 'sqlite')
	 * @returns Validation result
	 */
	async roundTripTest(
		sourceType: 'file' | 'sqlite'
	): Promise<ValidationResult> {
		let source: IStorage | undefined;
		let target: IStorage | undefined;

		try {
			if (sourceType === 'file') {
				source = new FileStorage(this.projectPath);
				target = new SqliteStorage(this.projectPath);
			} else {
				source = new SqliteStorage(this.projectPath);
				target = new FileStorage(this.projectPath);
			}

			await source.initialize();
			await target.initialize();

			// Copy all data from source to target
			const tags = await source.getAllTags();
			for (const tag of tags) {
				const tasks = await source.loadTasks(tag);
				if (tasks.length > 0) {
					await target.saveTasks(tasks, tag);
				}
			}

			// Validate
			const result = await this.validate(source, target, tags);

			return result;
		} catch (error) {
			return {
				isValid: false,
				sourceTaskCount: 0,
				targetTaskCount: 0,
				sourceSubtaskCount: 0,
				targetSubtaskCount: 0,
				discrepancies: [error instanceof Error ? error.message : String(error)]
			};
		} finally {
			// Always close storage connections to prevent resource leaks
			await source?.close();
			await target?.close();
		}
	}

	/**
	 * Check if migration is possible from current state
	 *
	 * @param targetType - Target storage type
	 * @returns Object with canMigrate flag and reason if not
	 */
	async canMigrate(targetType: 'file' | 'sqlite'): Promise<{
		canMigrate: boolean;
		reason?: string;
	}> {
		const currentType = await this.getCurrentStorageType();

		if (currentType === targetType) {
			return {
				canMigrate: false,
				reason: `Already using ${targetType} storage`
			};
		}

		if (targetType === 'sqlite') {
			// Check if tasks.json exists
			const tasksJsonPath = path.join(this.tasksDir, 'tasks.json');
			if (!fs.existsSync(tasksJsonPath)) {
				return {
					canMigrate: false,
					reason: 'No tasks.json file found to migrate from'
				};
			}
		} else if (targetType === 'file') {
			// Check if SQLite database exists
			const dbPath = path.join(this.tasksDir, 'tasks.db');
			if (!fs.existsSync(dbPath)) {
				return {
					canMigrate: false,
					reason: 'No SQLite database found to migrate from'
				};
			}
		}

		return { canMigrate: true };
	}

	/**
	 * Update config.json with new storage type
	 *
	 * @param newType - New storage type to set
	 */
	private async updateConfig(newType: 'file' | 'sqlite'): Promise<void> {
		// Ensure config directory exists
		await fs.promises.mkdir(this.taskmasterDir, { recursive: true });

		let config: TaskMasterConfig = {};

		// Read existing config if it exists
		if (fs.existsSync(this.configPath)) {
			try {
				config = JSON.parse(
					await fs.promises.readFile(this.configPath, 'utf-8')
				);
			} catch {
				// Start fresh if config is corrupted
				config = {};
			}
		}

		// Update storage type
		config.storage = {
			...config.storage,
			type: newType
		};

		// Write updated config
		await fs.promises.writeFile(
			this.configPath,
			JSON.stringify(config, null, 2),
			'utf-8'
		);
	}

	/**
	 * Add SQLite database patterns to .gitignore
	 *
	 * Adds patterns to ignore:
	 * - .taskmaster/tasks/tasks.db
	 * - .taskmaster/tasks/tasks.db-shm
	 * - .taskmaster/tasks/tasks.db-wal
	 */
	private async updateGitignore(): Promise<void> {
		const patterns = [
			'# TaskMaster SQLite database (use JSONL for git sync)',
			'.taskmaster/tasks/tasks.db',
			'.taskmaster/tasks/tasks.db-shm',
			'.taskmaster/tasks/tasks.db-wal'
		];

		let content = '';

		// Read existing .gitignore if it exists
		if (fs.existsSync(this.gitignorePath)) {
			content = await fs.promises.readFile(this.gitignorePath, 'utf-8');
		}

		// Check if patterns already exist
		const hasPatterns = patterns.some(
			(pattern) => content.includes(pattern) && !pattern.startsWith('#')
		);

		if (hasPatterns) {
			return; // Already has the patterns
		}

		// Add patterns to .gitignore
		const newContent =
			content.endsWith('\n') || content === ''
				? content + '\n' + patterns.join('\n') + '\n'
				: content + '\n\n' + patterns.join('\n') + '\n';

		await fs.promises.writeFile(this.gitignorePath, newContent, 'utf-8');
	}

	/**
	 * Create a backup of a file
	 *
	 * @param filePath - Path to the file to backup
	 */
	private async createBackup(filePath: string): Promise<void> {
		if (!fs.existsSync(filePath)) {
			return;
		}

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const ext = path.extname(filePath);
		const base = filePath.slice(0, -ext.length);
		const backupPath = `${base}.backup-${timestamp}${ext}`;

		await fs.promises.copyFile(filePath, backupPath);
	}
}

export default StorageMigration;
