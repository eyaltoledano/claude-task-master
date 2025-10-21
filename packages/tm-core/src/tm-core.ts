/**
 * @fileoverview TmCore - Unified facade for all Task Master functionality
 * This is the ONLY entry point for using tm-core
 */

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
 * await tmcore.auth.login({ ... });
 * const tasks = await tmcore.tasks.list();
 * await tmcore.workflow.start({ taskId: '1' });
 * await tmcore.git.commit('feat: add feature');
 * const mainModel = tmcore.config.get('models.main');
 * await tmcore.integration.exportTasks({ ... });
 * ```
 */
export class TmCore {
	// Core infrastructure
	private readonly _projectPath: string;
	private readonly _configManager: ConfigManager;

	// Domain facades (public, readonly)
	public readonly tasks: TasksDomain;
	public readonly auth: AuthDomain;
	public readonly workflow: WorkflowDomain;
	public readonly git: GitDomain;
	public readonly config: ConfigDomain;
	public readonly integration: IntegrationDomain;

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

		this._projectPath = options.projectPath;
		this._options = options;
		this._configManager = null as any; // Will be initialized in initialize()

		// Initialize domain facades (services will be wired up in initialize())
		this.tasks = null as any;
		this.auth = null as any;
		this.workflow = null as any;
		this.git = null as any;
		this.config = null as any;
		this.integration = null as any;
	}

	/**
	 * Initialize the TmCore instance
	 * Private - only called by the factory method
	 */
	private async initialize(): Promise<void> {
		try {
			// Create config manager
			(this as any)._configManager = await ConfigManager.create(
				this._projectPath
			);

			// Apply configuration overrides if provided
			if (this._options.configuration) {
				await this._configManager.updateConfig(this._options.configuration);
			}

			// Initialize domain facades
			(this as any).tasks = new TasksDomain(this._configManager);
			(this as any).auth = new AuthDomain(this._configManager);
			(this as any).workflow = new WorkflowDomain(this._configManager);
			(this as any).git = new GitDomain(this._projectPath);
			(this as any).config = new ConfigDomain(this._configManager);
			(this as any).integration = new IntegrationDomain(this._configManager);

			// Initialize domains that need async setup
			await this.tasks.initialize();
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
