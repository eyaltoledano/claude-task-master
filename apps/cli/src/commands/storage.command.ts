/**
 * @fileoverview Storage command for managing TaskMaster storage backends
 * Allows users to view, switch, and migrate between storage types (file, sqlite, api)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
	StorageMigration,
	SqliteStorage,
	type MigrationResult,
	type StorageType
} from '@tm/core';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import {
	displayError,
	displaySuccess,
	displayWarning,
	displayInfo
} from '../utils/ui.js';

/**
 * Result type from storage command operations
 */
export interface StorageResult {
	success: boolean;
	action: 'status' | 'switch' | 'migrate' | 'rebuild';
	currentType?: StorageType;
	message?: string;
	migrationResult?: MigrationResult;
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
 * StorageCommand extending Commander's Command class
 * Manages storage backend configuration and migration
 */
export class StorageCommand extends Command {
	private lastResult?: StorageResult;
	private projectPath: string;
	private configPath: string;

	constructor(name?: string) {
		super(name || 'storage');
		this.projectPath = process.cwd();
		this.configPath = path.join(this.projectPath, '.taskmaster', 'config.json');

		this.description('Manage storage backend configuration');

		// Default action shows status
		this.action(async () => {
			await this.executeStatus();
		});

		// Subcommands
		this.addStatusCommand();
		this.addSwitchCommand();
		this.addMigrateCommand();
		this.addRebuildCommand();
	}

	/**
	 * Add status subcommand
	 */
	private addStatusCommand(): void {
		this.command('status')
			.description('Show current storage backend')
			.action(async () => await this.executeStatus());
	}

	/**
	 * Add switch subcommand
	 */
	private addSwitchCommand(): void {
		this.command('switch <type>')
			.description('Switch to a different storage backend (file, sqlite)')
			.option('--no-migrate', 'Skip data migration')
			.option('--no-backup', 'Skip creating backup')
			.action(
				async (
					type: string,
					options: { migrate?: boolean; backup?: boolean }
				) => {
					await this.executeSwitch(type, options);
				}
			);
	}

	/**
	 * Add migrate subcommand
	 */
	private addMigrateCommand(): void {
		this.command('migrate')
			.description('Manually migrate data between storage backends')
			.option('--from <type>', 'Source storage type')
			.option('--to <type>', 'Target storage type')
			.option('--validate', 'Validate after migration', true)
			.action(
				async (options: { from?: string; to?: string; validate?: boolean }) => {
					await this.executeMigrate(options);
				}
			);
	}

	/**
	 * Add rebuild subcommand
	 */
	private addRebuildCommand(): void {
		this.command('rebuild')
			.description('Rebuild SQLite database from JSONL file')
			.action(async () => {
				await this.executeRebuild();
			});
	}

	/**
	 * Execute status command - show current storage type
	 */
	private async executeStatus(): Promise<void> {
		try {
			const migration = new StorageMigration(this.projectPath);
			const currentType = await migration.getCurrentStorageType();

			console.log(chalk.cyan('\nStorage Configuration\n'));
			console.log(
				`  ${chalk.bold('Current backend:')} ${this.formatStorageType(currentType)}`
			);

			// Show additional details based on storage type
			const tasksDir = path.join(this.projectPath, '.taskmaster', 'tasks');

			if (currentType === 'sqlite') {
				const dbPath = path.join(tasksDir, 'tasks.db');
				const jsonlPath = path.join(tasksDir, 'tasks.jsonl');
				console.log(
					`  ${chalk.bold('Database:')} ${fs.existsSync(dbPath) ? chalk.green('exists') : chalk.red('not found')}`
				);
				console.log(
					`  ${chalk.bold('JSONL sync:')} ${fs.existsSync(jsonlPath) ? chalk.green('exists') : chalk.yellow('not found')}`
				);
			} else if (currentType === 'file') {
				const tasksJsonPath = path.join(tasksDir, 'tasks.json');
				console.log(
					`  ${chalk.bold('Tasks file:')} ${fs.existsSync(tasksJsonPath) ? chalk.green('exists') : chalk.yellow('not found')}`
				);
			} else if (currentType === 'api') {
				console.log(`  ${chalk.dim('Connected to Hamster API')}`);
			}

			console.log();

			this.lastResult = {
				success: true,
				action: 'status',
				currentType,
				message: `Current storage type: ${currentType}`
			};
		} catch (error) {
			displayError(`Failed to get storage status: ${(error as Error).message}`);
			this.lastResult = {
				success: false,
				action: 'status',
				message: (error as Error).message
			};
			process.exit(1);
		}
	}

	/**
	 * Execute switch command - switch to a different storage backend
	 */
	private async executeSwitch(
		type: string,
		options: { migrate?: boolean; backup?: boolean }
	): Promise<void> {
		const validTypes = ['file', 'sqlite'];
		const normalizedType = type.toLowerCase();

		if (!validTypes.includes(normalizedType)) {
			displayError(
				`Invalid storage type: ${type}. Valid types are: ${validTypes.join(', ')}`
			);
			this.lastResult = {
				success: false,
				action: 'switch',
				message: `Invalid storage type: ${type}`
			};
			process.exit(1);
			return;
		}

		const targetType = normalizedType as 'file' | 'sqlite';
		const shouldMigrate = options.migrate !== false;
		const shouldBackup = options.backup !== false;

		const spinner = ora('Checking storage configuration...').start();

		try {
			const migration = new StorageMigration(this.projectPath);
			const currentType = await migration.getCurrentStorageType();

			// Check if already using this type
			if (currentType === targetType) {
				spinner.info(
					`Already using ${this.formatStorageType(targetType)} storage`
				);
				this.lastResult = {
					success: true,
					action: 'switch',
					currentType: targetType,
					message: `Already using ${targetType} storage`
				};
				return;
			}

			// Check if migration is possible
			const canMigrate = await migration.canMigrate(targetType);
			if (!canMigrate.canMigrate && shouldMigrate) {
				spinner.warn(canMigrate.reason || 'Cannot migrate');
				displayWarning(canMigrate.reason || 'Migration not possible');
			}

			spinner.text = `Switching to ${this.formatStorageType(targetType)} storage...`;

			let migrationResult: MigrationResult | undefined;

			if (shouldMigrate && canMigrate.canMigrate) {
				spinner.text = 'Migrating data...';

				if (targetType === 'sqlite') {
					migrationResult = await migration.migrateToSqlite({
						createBackup: shouldBackup,
						validateAfterMigration: true,
						updateConfig: true,
						updateGitignore: true
					});
				} else {
					migrationResult = await migration.migrateToFile({
						createBackup: shouldBackup,
						validateAfterMigration: true,
						updateConfig: true
					});
				}

				if (migrationResult.success) {
					spinner.succeed(
						`Switched to ${this.formatStorageType(targetType)} storage ` +
							`(migrated ${migrationResult.taskCount} tasks, ${migrationResult.subtaskCount} subtasks)`
					);

					if (migrationResult.warnings.length > 0) {
						for (const warning of migrationResult.warnings) {
							displayWarning(warning);
						}
					}
				} else {
					spinner.fail('Migration failed');
					for (const error of migrationResult.errors) {
						displayError(error);
					}
					this.lastResult = {
						success: false,
						action: 'switch',
						message: 'Migration failed',
						migrationResult
					};
					process.exit(1);
					return;
				}
			} else {
				// Just update config without migration
				await this.updateConfigType(targetType);
				spinner.succeed(
					`Switched to ${this.formatStorageType(targetType)} storage (config only, no data migrated)`
				);
			}

			this.lastResult = {
				success: true,
				action: 'switch',
				currentType: targetType,
				message: `Switched to ${targetType} storage`,
				migrationResult
			};
		} catch (error) {
			spinner.fail('Switch failed');
			displayError(`Failed to switch storage: ${(error as Error).message}`);
			this.lastResult = {
				success: false,
				action: 'switch',
				message: (error as Error).message
			};
			process.exit(1);
		}
	}

	/**
	 * Execute migrate command - manually migrate data between backends
	 */
	private async executeMigrate(options: {
		from?: string;
		to?: string;
		validate?: boolean;
	}): Promise<void> {
		const spinner = ora('Preparing migration...').start();

		try {
			const migration = new StorageMigration(this.projectPath);
			const currentType = await migration.getCurrentStorageType();

			// Determine source and target
			const sourceType = (options.from?.toLowerCase() || currentType) as
				| 'file'
				| 'sqlite';
			let targetType: 'file' | 'sqlite';

			if (options.to) {
				targetType = options.to.toLowerCase() as 'file' | 'sqlite';
			} else {
				// Default: toggle between file and sqlite
				targetType = sourceType === 'file' ? 'sqlite' : 'file';
			}

			// Validate types
			const validTypes = ['file', 'sqlite'];
			if (
				!validTypes.includes(sourceType) ||
				!validTypes.includes(targetType)
			) {
				spinner.fail('Invalid storage type');
				displayError(
					`Invalid storage type. Valid types are: ${validTypes.join(', ')}`
				);
				this.lastResult = {
					success: false,
					action: 'migrate',
					message: 'Invalid storage type'
				};
				process.exit(1);
				return;
			}

			if (sourceType === targetType) {
				spinner.info('Source and target are the same, nothing to migrate');
				this.lastResult = {
					success: true,
					action: 'migrate',
					message: 'Source and target are the same'
				};
				return;
			}

			// Check if migration is possible
			const canMigrate = await migration.canMigrate(targetType);
			if (!canMigrate.canMigrate) {
				spinner.fail('Cannot migrate');
				displayError(canMigrate.reason || 'Migration not possible');
				this.lastResult = {
					success: false,
					action: 'migrate',
					message: canMigrate.reason || 'Migration not possible'
				};
				process.exit(1);
				return;
			}

			spinner.text = `Migrating from ${this.formatStorageType(sourceType)} to ${this.formatStorageType(targetType)}...`;

			let migrationResult: MigrationResult;

			if (targetType === 'sqlite') {
				migrationResult = await migration.migrateToSqlite({
					createBackup: true,
					validateAfterMigration: options.validate !== false,
					updateConfig: true,
					updateGitignore: true
				});
			} else {
				migrationResult = await migration.migrateToFile({
					createBackup: true,
					validateAfterMigration: options.validate !== false,
					updateConfig: true
				});
			}

			if (migrationResult.success) {
				spinner.succeed(
					`Migration complete: ${migrationResult.taskCount} tasks, ` +
						`${migrationResult.subtaskCount} subtasks ` +
						`(${migrationResult.durationMs}ms)`
				);

				if (migrationResult.warnings.length > 0) {
					console.log();
					for (const warning of migrationResult.warnings) {
						displayWarning(warning);
					}
				}

				displaySuccess(
					`Successfully migrated to ${this.formatStorageType(targetType)} storage`
				);
			} else {
				spinner.fail('Migration failed');
				for (const error of migrationResult.errors) {
					displayError(error);
				}
				this.lastResult = {
					success: false,
					action: 'migrate',
					message: 'Migration failed',
					migrationResult
				};
				process.exit(1);
				return;
			}

			this.lastResult = {
				success: true,
				action: 'migrate',
				currentType: targetType,
				message: `Migrated to ${targetType} storage`,
				migrationResult
			};
		} catch (error) {
			spinner.fail('Migration failed');
			displayError(`Migration error: ${(error as Error).message}`);
			this.lastResult = {
				success: false,
				action: 'migrate',
				message: (error as Error).message
			};
			process.exit(1);
		}
	}

	/**
	 * Execute rebuild command - rebuild SQLite database from JSONL file
	 */
	private async executeRebuild(): Promise<void> {
		const spinner = ora('Checking for JSONL file...').start();

		try {
			const tasksDir = path.join(this.projectPath, '.taskmaster', 'tasks');
			const jsonlPath = path.join(tasksDir, 'tasks.jsonl');
			const dbPath = path.join(tasksDir, 'tasks.db');

			// Check if JSONL file exists
			if (!fs.existsSync(jsonlPath)) {
				spinner.fail('JSONL file not found');
				displayError(`No JSONL file found at ${jsonlPath}`);
				displayInfo(
					'The rebuild command requires a tasks.jsonl file to rebuild from.'
				);
				this.lastResult = {
					success: false,
					action: 'rebuild',
					message: 'JSONL file not found'
				};
				process.exit(1);
				return;
			}

			// Backup existing database if it exists
			if (fs.existsSync(dbPath)) {
				const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
				const backupPath = path.join(tasksDir, `tasks.backup-${timestamp}.db`);
				spinner.text = 'Backing up existing database...';
				await fs.promises.copyFile(dbPath, backupPath);
				displayInfo(
					`Backed up existing database to ${path.basename(backupPath)}`
				);
			}

			// Remove existing database files
			spinner.text = 'Removing existing database...';
			const dbFiles = [dbPath, `${dbPath}-shm`, `${dbPath}-wal`];
			for (const file of dbFiles) {
				if (fs.existsSync(file)) {
					await fs.promises.unlink(file);
				}
			}

			// Update config to sqlite to trigger rebuild on next initialization
			await this.updateConfigType('sqlite');

			spinner.text = 'Rebuilding database from JSONL...';

			// Create SqliteStorage to trigger rebuild
			// The SqliteStorage automatically rebuilds from JSONL when database doesn't exist
			const storage = new SqliteStorage(this.projectPath);
			await storage.initialize();

			let stats: { totalTasks: number; totalTags: number };
			try {
				// Get stats
				stats = await storage.getStats();
			} finally {
				await storage.close();
			}

			spinner.succeed(
				`Database rebuilt: ${stats.totalTasks} tasks in ${stats.totalTags} tag(s)`
			);
			displaySuccess('SQLite database successfully rebuilt from JSONL file');

			this.lastResult = {
				success: true,
				action: 'rebuild',
				currentType: 'sqlite',
				message: `Rebuilt database with ${stats.totalTasks} tasks`
			};
		} catch (error) {
			spinner.fail('Rebuild failed');
			displayError(`Failed to rebuild database: ${(error as Error).message}`);
			this.lastResult = {
				success: false,
				action: 'rebuild',
				message: (error as Error).message
			};
			process.exit(1);
		}
	}

	/**
	 * Update config.json with new storage type
	 */
	private async updateConfigType(newType: 'file' | 'sqlite'): Promise<void> {
		const taskmasterDir = path.dirname(this.configPath);

		// Ensure directory exists
		await fs.promises.mkdir(taskmasterDir, { recursive: true });

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
	 * Format storage type for display
	 */
	private formatStorageType(type: StorageType): string {
		switch (type) {
			case 'file':
				return chalk.blue('File (tasks.json)');
			case 'sqlite':
				return chalk.green('SQLite');
			case 'api':
				return chalk.magenta('API (Hamster)');
			case 'auto':
				return chalk.yellow('Auto-detect');
			default:
				return chalk.gray(type);
		}
	}

	/**
	 * Get the last result (for programmatic usage)
	 */
	getLastResult(): StorageResult | undefined {
		return this.lastResult;
	}

	/**
	 * Register this command on an existing program
	 */
	static register(program: Command): StorageCommand {
		const cmd = new StorageCommand();
		program.addCommand(cmd);
		return cmd;
	}
}
