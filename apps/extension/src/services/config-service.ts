/**
 * Config Service
 * Manages Task Master config.json file operations
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as vscode from 'vscode';
import type { ExtensionLogger } from '../utils/logger';

export interface TaskMasterConfigJson {
	anthropicApiKey?: string;
	perplexityApiKey?: string;
	openaiApiKey?: string;
	googleApiKey?: string;
	xaiApiKey?: string;
	openrouterApiKey?: string;
	mistralApiKey?: string;
	debug?: boolean;
	models?: {
		main?: string;
		research?: string;
		fallback?: string;
	};
}

export class ConfigService {
	private configCache: TaskMasterConfigJson | null = null;
	private lastReadTime = 0;
	private readonly CACHE_DURATION = 5000; // 5 seconds

	constructor(private logger: ExtensionLogger) {}

	/**
	 * Read Task Master config.json from the workspace
	 */
	async readConfig(): Promise<TaskMasterConfigJson | null> {
		// Check cache first
		if (
			this.configCache &&
			Date.now() - this.lastReadTime < this.CACHE_DURATION
		) {
			return this.configCache;
		}

		try {
			const workspaceRoot = this.getWorkspaceRoot();
			if (!workspaceRoot) {
				this.logger.warn('No workspace folder found');
				return null;
			}

			const configPath = path.join(workspaceRoot, '.taskmaster', 'config.json');

			try {
				const configContent = await fs.readFile(configPath, 'utf-8');
				const config = JSON.parse(configContent) as TaskMasterConfigJson;

				// Cache the result
				this.configCache = config;
				this.lastReadTime = Date.now();

				this.logger.debug('Successfully read Task Master config', {
					hasModels: !!config.models,
					debug: config.debug
				});

				return config;
			} catch (error) {
				if ((error as any).code === 'ENOENT') {
					this.logger.debug('Task Master config.json not found');
				} else {
					this.logger.error('Failed to read Task Master config', error);
				}
				return null;
			}
		} catch (error) {
			this.logger.error('Error accessing Task Master config', error);
			return null;
		}
	}

	/**
	 * Get safe config for display (with sensitive data masked)
	 */
	async getSafeConfig(): Promise<Record<string, any> | null> {
		const config = await this.readConfig();
		if (!config) {
			return null;
		}

		// Create a safe copy with masked API keys
		const safeConfig: Record<string, any> = {
			...config
		};

		// Mask all API keys
		const apiKeyFields = [
			'anthropicApiKey',
			'perplexityApiKey',
			'openaiApiKey',
			'googleApiKey',
			'xaiApiKey',
			'openrouterApiKey',
			'mistralApiKey'
		];

		for (const field of apiKeyFields) {
			if (safeConfig[field]) {
				safeConfig[field] = this.maskApiKey(safeConfig[field]);
			}
		}

		return safeConfig;
	}

	/**
	 * Mask API key for display
	 * Shows only the last 4 characters for better security
	 */
	private maskApiKey(key: string): string {
		if (key.length <= 4) {
			return '****';
		}
		const visibleChars = 4;
		const maskedLength = key.length - visibleChars;
		return (
			'*'.repeat(Math.min(maskedLength, 12)) +
			key.substring(key.length - visibleChars)
		);
	}

	/**
	 * Clear cache
	 */
	clearCache(): void {
		this.configCache = null;
		this.lastReadTime = 0;
	}

	/**
	 * Get workspace root path
	 */
	private getWorkspaceRoot(): string | undefined {
		return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	}
}
