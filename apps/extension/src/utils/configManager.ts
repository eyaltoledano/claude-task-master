import * as vscode from 'vscode';
import { logger } from './logger';
import type { MCPConfig } from './mcpClient';

export interface TaskMasterConfig {
	mcp: MCPServerConfig;
	ui: UIConfig;
	performance: PerformanceConfig;
	debug: DebugConfig;
}

export interface MCPServerConfig {
	command: string;
	args: string[];
	cwd?: string;
	env?: Record<string, string>;
	timeout: number;
	maxReconnectAttempts: number;
	reconnectBackoffMs: number;
	maxBackoffMs: number;
	healthCheckIntervalMs: number;
}

export interface UIConfig {
	autoRefresh: boolean;
	refreshIntervalMs: number;
	theme: 'auto' | 'light' | 'dark';
	showCompletedTasks: boolean;
	taskDisplayLimit: number;
	showPriority: boolean;
	showTaskIds: boolean;
}

export interface PerformanceConfig {
	maxConcurrentRequests: number;
	requestTimeoutMs: number;
	cacheTasksMs: number;
	lazyLoadThreshold: number;
}

export interface DebugConfig {
	enableLogging: boolean;
	logLevel: 'error' | 'warn' | 'info' | 'debug';
	enableConnectionMetrics: boolean;
	saveEventLogs: boolean;
	maxEventLogSize: number;
}

export interface ConfigValidationResult {
	isValid: boolean;
	errors: string[];
	warnings: string[];
}

export class ConfigManager {
	private static instance: ConfigManager | null = null;
	private config: TaskMasterConfig;
	private configListeners: ((config: TaskMasterConfig) => void)[] = [];

	private constructor() {
		this.config = this.loadConfig();
		this.setupConfigWatcher();
	}

	/**
	 * Get singleton instance
	 */
	static getInstance(): ConfigManager {
		if (!ConfigManager.instance) {
			ConfigManager.instance = new ConfigManager();
		}
		return ConfigManager.instance;
	}

	/**
	 * Get current configuration
	 */
	getConfig(): TaskMasterConfig {
		return { ...this.config };
	}

	/**
	 * Get MCP configuration for the client
	 */
	getMCPConfig(): MCPConfig {
		const mcpConfig = this.config.mcp;
		return {
			command: mcpConfig.command,
			args: mcpConfig.args,
			cwd: mcpConfig.cwd,
			env: mcpConfig.env
		};
	}

	/**
	 * Update configuration (programmatically)
	 */
	async updateConfig(updates: Partial<TaskMasterConfig>): Promise<void> {
		const newConfig = this.mergeConfig(this.config, updates);
		const validation = this.validateConfig(newConfig);

		if (!validation.isValid) {
			throw new Error(
				`Configuration validation failed: ${validation.errors.join(', ')}`
			);
		}

		// Update VS Code settings
		const vsConfig = vscode.workspace.getConfiguration('taskmaster');

		if (updates.mcp) {
			if (updates.mcp.command !== undefined) {
				await vsConfig.update(
					'mcp.command',
					updates.mcp.command,
					vscode.ConfigurationTarget.Workspace
				);
			}
			if (updates.mcp.args !== undefined) {
				await vsConfig.update(
					'mcp.args',
					updates.mcp.args,
					vscode.ConfigurationTarget.Workspace
				);
			}
			if (updates.mcp.cwd !== undefined) {
				await vsConfig.update(
					'mcp.cwd',
					updates.mcp.cwd,
					vscode.ConfigurationTarget.Workspace
				);
			}
			if (updates.mcp.timeout !== undefined) {
				await vsConfig.update(
					'mcp.timeout',
					updates.mcp.timeout,
					vscode.ConfigurationTarget.Workspace
				);
			}
		}

		if (updates.ui) {
			if (updates.ui.autoRefresh !== undefined) {
				await vsConfig.update(
					'ui.autoRefresh',
					updates.ui.autoRefresh,
					vscode.ConfigurationTarget.Workspace
				);
			}
			if (updates.ui.theme !== undefined) {
				await vsConfig.update(
					'ui.theme',
					updates.ui.theme,
					vscode.ConfigurationTarget.Workspace
				);
			}
		}

		if (updates.debug) {
			if (updates.debug.enableLogging !== undefined) {
				await vsConfig.update(
					'debug.enableLogging',
					updates.debug.enableLogging,
					vscode.ConfigurationTarget.Workspace
				);
			}
			if (updates.debug.logLevel !== undefined) {
				await vsConfig.update(
					'debug.logLevel',
					updates.debug.logLevel,
					vscode.ConfigurationTarget.Workspace
				);
			}
		}

		this.config = newConfig;
		this.notifyConfigChange();
	}

	/**
	 * Validate configuration
	 */
	validateConfig(config: TaskMasterConfig): ConfigValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Validate MCP configuration
		if (!config.mcp.command || config.mcp.command.trim() === '') {
			errors.push('MCP command cannot be empty');
		}

		if (config.mcp.timeout < 1000) {
			warnings.push(
				'MCP timeout is very low (< 1s), this may cause connection issues'
			);
		} else if (config.mcp.timeout > 60000) {
			warnings.push(
				'MCP timeout is very high (> 60s), this may cause slow responses'
			);
		}

		if (config.mcp.maxReconnectAttempts < 1) {
			errors.push('Max reconnect attempts must be at least 1');
		} else if (config.mcp.maxReconnectAttempts > 10) {
			warnings.push(
				'Max reconnect attempts is very high, this may cause long delays'
			);
		}

		// Validate UI configuration
		if (config.ui.refreshIntervalMs < 1000) {
			warnings.push(
				'UI refresh interval is very low (< 1s), this may impact performance'
			);
		}

		if (config.ui.taskDisplayLimit < 1) {
			errors.push('Task display limit must be at least 1');
		} else if (config.ui.taskDisplayLimit > 1000) {
			warnings.push(
				'Task display limit is very high, this may impact performance'
			);
		}

		// Validate performance configuration
		if (config.performance.maxConcurrentRequests < 1) {
			errors.push('Max concurrent requests must be at least 1');
		} else if (config.performance.maxConcurrentRequests > 20) {
			warnings.push(
				'Max concurrent requests is very high, this may overwhelm the server'
			);
		}

		if (config.performance.requestTimeoutMs < 1000) {
			warnings.push(
				'Request timeout is very low (< 1s), this may cause premature timeouts'
			);
		}

		// Validate debug configuration
		if (config.debug.maxEventLogSize < 10) {
			errors.push('Max event log size must be at least 10');
		} else if (config.debug.maxEventLogSize > 10000) {
			warnings.push(
				'Max event log size is very high, this may consume significant memory'
			);
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings
		};
	}

	/**
	 * Reset configuration to defaults
	 */
	async resetToDefaults(): Promise<void> {
		const defaultConfig = this.getDefaultConfig();
		await this.updateConfig(defaultConfig);
	}

	/**
	 * Export configuration to JSON
	 */
	exportConfig(): string {
		return JSON.stringify(this.config, null, 2);
	}

	/**
	 * Import configuration from JSON
	 */
	async importConfig(jsonConfig: string): Promise<void> {
		try {
			const importedConfig = JSON.parse(jsonConfig) as TaskMasterConfig;
			const validation = this.validateConfig(importedConfig);

			if (!validation.isValid) {
				throw new Error(
					`Invalid configuration: ${validation.errors.join(', ')}`
				);
			}

			if (validation.warnings.length > 0) {
				const proceed = await vscode.window.showWarningMessage(
					`Configuration has warnings: ${validation.warnings.join(', ')}. Import anyway?`,
					'Yes',
					'No'
				);

				if (proceed !== 'Yes') {
					return;
				}
			}

			await this.updateConfig(importedConfig);
			vscode.window.showInformationMessage(
				'Configuration imported successfully'
			);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error';
			vscode.window.showErrorMessage(
				`Failed to import configuration: ${errorMessage}`
			);
			throw error;
		}
	}

	/**
	 * Add configuration change listener
	 */
	onConfigChange(listener: (config: TaskMasterConfig) => void): void {
		this.configListeners.push(listener);
	}

	/**
	 * Remove configuration change listener
	 */
	removeConfigListener(listener: (config: TaskMasterConfig) => void): void {
		const index = this.configListeners.indexOf(listener);
		if (index !== -1) {
			this.configListeners.splice(index, 1);
		}
	}

	/**
	 * Load configuration from VS Code settings
	 */
	private loadConfig(): TaskMasterConfig {
		const vsConfig = vscode.workspace.getConfiguration('taskmaster');
		const defaultConfig = this.getDefaultConfig();

		return {
			mcp: {
				command: vsConfig.get('mcp.command', defaultConfig.mcp.command),
				args: vsConfig.get('mcp.args', defaultConfig.mcp.args),
				cwd: vsConfig.get('mcp.cwd', defaultConfig.mcp.cwd),
				env: vsConfig.get('mcp.env', defaultConfig.mcp.env),
				timeout: vsConfig.get('mcp.timeout', defaultConfig.mcp.timeout),
				maxReconnectAttempts: vsConfig.get(
					'mcp.maxReconnectAttempts',
					defaultConfig.mcp.maxReconnectAttempts
				),
				reconnectBackoffMs: vsConfig.get(
					'mcp.reconnectBackoffMs',
					defaultConfig.mcp.reconnectBackoffMs
				),
				maxBackoffMs: vsConfig.get(
					'mcp.maxBackoffMs',
					defaultConfig.mcp.maxBackoffMs
				),
				healthCheckIntervalMs: vsConfig.get(
					'mcp.healthCheckIntervalMs',
					defaultConfig.mcp.healthCheckIntervalMs
				)
			},
			ui: {
				autoRefresh: vsConfig.get(
					'ui.autoRefresh',
					defaultConfig.ui.autoRefresh
				),
				refreshIntervalMs: vsConfig.get(
					'ui.refreshIntervalMs',
					defaultConfig.ui.refreshIntervalMs
				),
				theme: vsConfig.get('ui.theme', defaultConfig.ui.theme),
				showCompletedTasks: vsConfig.get(
					'ui.showCompletedTasks',
					defaultConfig.ui.showCompletedTasks
				),
				taskDisplayLimit: vsConfig.get(
					'ui.taskDisplayLimit',
					defaultConfig.ui.taskDisplayLimit
				),
				showPriority: vsConfig.get(
					'ui.showPriority',
					defaultConfig.ui.showPriority
				),
				showTaskIds: vsConfig.get(
					'ui.showTaskIds',
					defaultConfig.ui.showTaskIds
				)
			},
			performance: {
				maxConcurrentRequests: vsConfig.get(
					'performance.maxConcurrentRequests',
					defaultConfig.performance.maxConcurrentRequests
				),
				requestTimeoutMs: vsConfig.get(
					'performance.requestTimeoutMs',
					defaultConfig.performance.requestTimeoutMs
				),
				cacheTasksMs: vsConfig.get(
					'performance.cacheTasksMs',
					defaultConfig.performance.cacheTasksMs
				),
				lazyLoadThreshold: vsConfig.get(
					'performance.lazyLoadThreshold',
					defaultConfig.performance.lazyLoadThreshold
				)
			},
			debug: {
				enableLogging: vsConfig.get(
					'debug.enableLogging',
					defaultConfig.debug.enableLogging
				),
				logLevel: vsConfig.get('debug.logLevel', defaultConfig.debug.logLevel),
				enableConnectionMetrics: vsConfig.get(
					'debug.enableConnectionMetrics',
					defaultConfig.debug.enableConnectionMetrics
				),
				saveEventLogs: vsConfig.get(
					'debug.saveEventLogs',
					defaultConfig.debug.saveEventLogs
				),
				maxEventLogSize: vsConfig.get(
					'debug.maxEventLogSize',
					defaultConfig.debug.maxEventLogSize
				)
			}
		};
	}

	/**
	 * Get default configuration
	 */
	private getDefaultConfig(): TaskMasterConfig {
		return {
			mcp: {
				command: 'npx',
				args: ['task-master-ai'],
				cwd: vscode.workspace.rootPath || '',
				env: undefined,
				timeout: 30000,
				maxReconnectAttempts: 5,
				reconnectBackoffMs: 1000,
				maxBackoffMs: 30000,
				healthCheckIntervalMs: 15000
			},
			ui: {
				autoRefresh: true,
				refreshIntervalMs: 10000,
				theme: 'auto',
				showCompletedTasks: true,
				taskDisplayLimit: 100,
				showPriority: true,
				showTaskIds: true
			},
			performance: {
				maxConcurrentRequests: 5,
				requestTimeoutMs: 30000,
				cacheTasksMs: 5000,
				lazyLoadThreshold: 50
			},
			debug: {
				enableLogging: true,
				logLevel: 'info',
				enableConnectionMetrics: true,
				saveEventLogs: false,
				maxEventLogSize: 1000
			}
		};
	}

	/**
	 * Setup configuration watcher
	 */
	private setupConfigWatcher(): void {
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration('taskmaster')) {
				logger.log('Task Master configuration changed, reloading...');
				this.config = this.loadConfig();
				this.notifyConfigChange();
			}
		});
	}

	/**
	 * Merge configurations
	 */
	private mergeConfig(
		baseConfig: TaskMasterConfig,
		updates: Partial<TaskMasterConfig>
	): TaskMasterConfig {
		return {
			mcp: { ...baseConfig.mcp, ...updates.mcp },
			ui: { ...baseConfig.ui, ...updates.ui },
			performance: { ...baseConfig.performance, ...updates.performance },
			debug: { ...baseConfig.debug, ...updates.debug }
		};
	}

	/**
	 * Notify configuration change listeners
	 */
	private notifyConfigChange(): void {
		this.configListeners.forEach((listener) => {
			try {
				listener(this.config);
			} catch (error) {
				logger.error('Error in configuration change listener:', error);
			}
		});
	}
}

/**
 * Utility function to get configuration manager instance
 */
export function getConfigManager(): ConfigManager {
	return ConfigManager.getInstance();
}
