/**
 * @fileoverview storage_config MCP tool
 * Get or set storage backend configuration
 */

import { z } from 'zod';
import { handleApiResult, withToolContext } from '../../shared/utils.js';
import type { ToolContext } from '../../shared/types.js';
import {
	StorageMigration,
	type StorageType,
	type MigrationResult
} from '@tm/core';
import type { FastMCP } from 'fastmcp';

const StorageConfigSchema = z.object({
	action: z
		.enum(['get', 'set', 'migrate', 'rebuild'])
		.describe(
			'Action to perform: get (current config), set (change type), migrate (move data), rebuild (restore SQLite from JSONL)'
		),
	type: z
		.enum(['file', 'sqlite', 'api'])
		.optional()
		.describe("Target storage type for 'set' and 'migrate' actions"),
	projectRoot: z
		.string()
		.describe(
			'Absolute path to the project root directory (Optional, usually from session)'
		),
	tag: z.string().optional().describe('Tag context to operate on')
});

type StorageConfigArgs = z.infer<typeof StorageConfigSchema>;

/**
 * Register the storage_config tool with the MCP server
 */
export function registerStorageConfigTool(server: FastMCP) {
	server.addTool({
		name: 'storage_config',
		description:
			'Get or set storage backend configuration. Supports file, sqlite, and api storage types. Use migrate to move data between backends, or rebuild to restore SQLite from JSONL.',
		parameters: StorageConfigSchema,
		annotations: {
			title: 'Storage Config',
			readOnlyHint: false
		},
		execute: withToolContext(
			'storage-config',
			async (args: StorageConfigArgs, { log, tmCore }: ToolContext) => {
				const { action, type, projectRoot, tag } = args;

				try {
					log.info(`Storage config action: ${action} in root: ${projectRoot}`);

					const migration = new StorageMigration(projectRoot);

					switch (action) {
						case 'get': {
							// Get current storage configuration
							const config = tmCore.config.getStorageConfig();
							const status = await migration.getStatus();

							log.info(
								`Current storage type: ${config.type}, status: ${JSON.stringify(status)}`
							);

							return handleApiResult({
								result: {
									success: true,
									data: {
										currentType: config.type,
										basePath: config.basePath,
										apiConfigured: config.apiConfigured,
										dbPath: config.dbPath,
										walMode: config.walMode,
										status
									}
								},
								log,
								projectRoot,
								tag
							});
						}

						case 'set': {
							// Set storage type without migrating data
							if (!type) {
								return handleApiResult({
									result: {
										success: false,
										error: {
											message:
												"'type' parameter is required for 'set' action. Specify 'file', 'sqlite', or 'api'."
										}
									},
									log,
									projectRoot
								});
							}

							log.info(`Setting storage type to: ${type}`);

							// Update config through updateConfig method
							await tmCore.config.updateConfig({
								storage: { type: type as StorageType } as any
							});

							return handleApiResult({
								result: {
									success: true,
									data: {
										message: `Storage type set to '${type}'. Note: This only changes the configuration. Use 'migrate' action to move existing data.`,
										newType: type
									}
								},
								log,
								projectRoot,
								tag
							});
						}

						case 'migrate': {
							// Migrate data to a different storage backend
							if (!type) {
								return handleApiResult({
									result: {
										success: false,
										error: {
											message:
												"'type' parameter is required for 'migrate' action. Specify 'file' or 'sqlite'."
										}
									},
									log,
									projectRoot
								});
							}

							if (type === 'api') {
								return handleApiResult({
									result: {
										success: false,
										error: {
											message:
												"Migration to 'api' storage is not supported. Use 'tm auth login' to sync with Hamster."
										}
									},
									log,
									projectRoot
								});
							}

							log.info(`Migrating storage to: ${type}`);

							let result: MigrationResult;

							if (type === 'sqlite') {
								result = await migration.migrateToSqlite();
							} else {
								result = await migration.migrateToFile();
							}

							if (!result.success) {
								return handleApiResult({
									result: {
										success: false,
										error: {
											message: `Migration failed: ${result.errors.join(', ')}`
										}
									},
									log,
									projectRoot
								});
							}

							return handleApiResult({
								result: {
									success: true,
									data: {
										message: `Successfully migrated to '${type}' storage.`,
										taskCount: result.taskCount,
										subtaskCount: result.subtaskCount,
										tagsCount: result.tagsCount,
										warnings: result.warnings
									}
								},
								log,
								projectRoot,
								tag
							});
						}

						case 'rebuild': {
							// Rebuild SQLite database from JSONL
							log.info('Rebuilding SQLite from JSONL...');

							const status = await migration.getStatus();

							if (status.currentType !== 'sqlite') {
								return handleApiResult({
									result: {
										success: false,
										error: {
											message:
												'Rebuild is only available for SQLite storage. Current type: ' +
												status.currentType
										}
									},
									log,
									projectRoot
								});
							}

							// Rebuild by re-migrating from JSONL
							const result = await migration.rebuildSqlite();

							if (!result.success) {
								return handleApiResult({
									result: {
										success: false,
										error: {
											message: `Rebuild failed: ${result.errors.join(', ')}`
										}
									},
									log,
									projectRoot
								});
							}

							return handleApiResult({
								result: {
									success: true,
									data: {
										message: 'Successfully rebuilt SQLite database from JSONL.',
										taskCount: result.taskCount,
										subtaskCount: result.subtaskCount,
										tagsCount: result.tagsCount
									}
								},
								log,
								projectRoot,
								tag
							});
						}

						default:
							return handleApiResult({
								result: {
									success: false,
									error: {
										message: `Unknown action: ${action}. Valid actions: get, set, migrate, rebuild`
									}
								},
								log,
								projectRoot
							});
					}
				} catch (error: any) {
					log.error(`Error in storage-config: ${error.message}`);
					if (error.stack) {
						log.debug(error.stack);
					}
					return handleApiResult({
						result: {
							success: false,
							error: {
								message: `Storage config failed: ${error.message}`
							}
						},
						log,
						projectRoot
					});
				}
			}
		)
	});
}
