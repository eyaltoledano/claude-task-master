/**
 * @fileoverview TmCore - Unified facade for all Task Master functionality
 * This is the ONLY entry point for using tm-core
 */

import path from 'node:path';
import { ConfigManager } from './modules/config/managers/config-manager.js';
import { TasksDomain } from './modules/tasks/tasks-domain.js';
import { AuthDomain } from './modules/auth/auth-domain.js';
import { WorkflowDomain } from './modules/workflow/workflow-domain.js';
import { GitDomain } from './modules/git/git-domain.js';
import { ConfigDomain } from './modules/config/config-domain.js';
import { IntegrationDomain } from './modules/integration/integration-domain.js';

import {
	ERROR_CODES,
	TaskMasterError
} from './common/errors/task-master-error.js';
import type { IConfiguration } from './common/interfaces/configuration.interface.js';

/**
 * Options for creating TmCore instance
 */
export interface TmCoreOptions {
	/** Absolute path to project root */
	projectPath: string;
	/** Optional configuration overrides */
	configuration?: Partial<IConfiguration>;
}

/**
 * TmCore - Unified facade providing access to all Task Master domains
 *
 * @example
 * ```typescript
 * const tmcore = await createTmCore({ projectPath: process.cwd() });
 *
 * // Access any domain
 * await tmcore.auth.authenticateWithOAuth();
 * const tasks = await tmcore.tasks.list();
 * await tmcore.workflow.start({ taskId: '1' });
 * await tmcore.git.commit('feat: add feature');
 * const modelConfig = tmcore.config.getModelConfig();
 * await tmcore.integration.exportTasks({ ... });
 * ```
 */
export class TmCore {
	// Core infrastructure
	private readonly _projectPath: string;
	private _configManager!: ConfigManager;

	// Private writable properties
	private _tasks!: TasksDomain;
	private _auth!: AuthDomain;
	private _workflow!: WorkflowDomain;
	private _git!: GitDomain;
	private _config!: ConfigDomain;
	private _integration!: IntegrationDomain;

	// Public readonly getters
	get tasks(): TasksDomain {
		return this._tasks;
	}
	get auth(): AuthDomain {
		return this._auth;
	}
	get workflow(): WorkflowDomain {
		return this._workflow;
	}
	get git(): GitDomain {
		return this._git;
	}
	get config(): ConfigDomain {
		return this._config;
	}
	get integration(): IntegrationDomain {
		return this._integration;
	}

	/**
	 * Create and initialize a new TmCore instance
	 * This is the ONLY way to create TmCore
	 *
	 * @param options - Configuration options
	 * @returns Fully initialized TmCore instance
	 */
	static async create(options: TmCoreOptions): Promise<TmCore> {
		const instance = new TmCore(options);
		await instance.initialize();
		return instance;
	}

	private _options: TmCoreOptions;

	/**
	 * Private constructor - use TmCore.create() instead
	 * This ensures TmCore is always properly initialized
	 */
	private constructor(options: TmCoreOptions) {
		if (!options.projectPath) {
			throw new TaskMasterError(
				'Project path is required',
				ERROR_CODES.MISSING_CONFIGURATION
			);
		}

		// Validate that projectPath is absolute
		if (!path.isAbsolute(options.projectPath)) {
			throw new TaskMasterError(
				`Project path must be an absolute path, received: "${options.projectPath}"`,
				ERROR_CODES.INVALID_INPUT
			);
		}

		// Normalize the path
		this._projectPath = path.resolve(options.projectPath);
		this._options = options;
		// Domain facades will be initialized in initialize()
	}

	/**
	 * Initialize the TmCore instance
	 * Private - only called by the factory method
	 */
	private async initialize(): Promise<void> {
		try {
			// Create config manager
			this._configManager = await ConfigManager.create(this._projectPath);

			// Apply configuration overrides if provided
			if (this._options.configuration) {
				await this._configManager.updateConfig(this._options.configuration);
			}

			// Initialize domain facades
			this._tasks = new TasksDomain(this._configManager);
			this._auth = new AuthDomain();
			this._workflow = new WorkflowDomain(this._configManager);
			this._git = new GitDomain(this._projectPath);
			this._config = new ConfigDomain(this._configManager);
			this._integration = new IntegrationDomain(this._configManager);

			// Initialize domains that need async setup
			await this._tasks.initialize();
		} catch (error) {
			throw new TaskMasterError(
				'Failed to initialize TmCore',
				ERROR_CODES.INTERNAL_ERROR,
				{ operation: 'initialize' },
				error as Error
			);
		}
	}

	/**
	 * Get project root path
	 */
	get projectPath(): string {
		return this._projectPath;
	}
}

/**
 * Factory function to create a new TmCore instance
 * This is the recommended way to create TmCore
 *
 * @param options - Configuration options
 * @returns Fully initialized TmCore instance
 */
export async function createTmCore(options: TmCoreOptions): Promise<TmCore> {
	return TmCore.create(options);
}
