/**
 * @fileoverview Briefs Command - Friendly alias for tag management in API storage
 * Provides brief-specific commands that only work with API storage
 */

import {
	type LogLevel,
	type TagInfo,
	tryAddTagViaRemote,
	tryListTagsViaRemote
} from '@tm/bridge';
import type { TmCore } from '@tm/core';
import { AuthManager, createTmCore } from '@tm/core';
import { Command } from 'commander';
import { checkAuthentication } from '../utils/auth-helpers.js';
import {
	selectBriefFromInput,
	selectBriefInteractive
} from '../utils/brief-selection.js';
import * as ui from '../utils/ui.js';

/**
 * Result type from briefs command
 */
export interface BriefsResult {
	success: boolean;
	action: 'list' | 'select' | 'create';
	briefs?: TagInfo[];
	currentBrief?: string | null;
	message?: string;
}

/**
 * BriefsCommand - Manage briefs for API storage (friendly alias)
 * Only works when using API storage (tryhamster.com)
 */
export class BriefsCommand extends Command {
	private tmCore?: TmCore;
	private authManager: AuthManager;
	private lastResult?: BriefsResult;

	constructor(name?: string) {
		super(name || 'briefs');

		// Initialize auth manager
		this.authManager = AuthManager.getInstance();

		// Configure the command
		this.description('Manage briefs (API storage only)');
		this.alias('brief');

		// Add subcommands
		this.addListCommand();
		this.addSelectCommand();
		this.addCreateCommand();

		// Accept optional positional argument for brief URL/ID
		this.argument('[briefOrUrl]', 'Brief ID or Hamster brief URL');

		// Default action: if argument provided, select brief; else list briefs
		this.action(async (briefOrUrl?: string) => {
			if (briefOrUrl && briefOrUrl.trim().length > 0) {
				await this.executeSelectFromUrl(briefOrUrl.trim());
				return;
			}
			await this.executeList();
		});
	}

	/**
	 * Check if user is authenticated (required for briefs)
	 */
	private async checkAuth(): Promise<boolean> {
		return checkAuthentication(this.authManager, {
			message:
				'The "briefs" command requires you to be logged in to your Hamster account.',
			footer:
				'Working locally instead?\n' +
				'  → Use "task-master tags" for local tag management.',
			authCommand: 'task-master auth login'
		});
	}

	/**
	 * Add list subcommand
	 */
	private addListCommand(): void {
		this.command('list')
			.description('List all briefs (default action)')
			.option('--show-metadata', 'Show additional brief metadata')
			.addHelpText(
				'after',
				`
Examples:
  $ tm briefs            # List all briefs (default)
  $ tm briefs list       # List all briefs (explicit)
  $ tm briefs list --show-metadata  # List with metadata

Note: This command only works with API storage (tryhamster.com).
`
			)
			.action(async (options) => {
				await this.executeList(options);
			});
	}

	/**
	 * Add select subcommand
	 */
	private addSelectCommand(): void {
		this.command('select')
			.description('Select a brief to work with')
			.argument(
				'[briefOrUrl]',
				'Brief ID or Hamster URL (optional, interactive if omitted)'
			)
			.addHelpText(
				'after',
				`
Examples:
  $ tm brief select                                    # Interactive selection
  $ tm brief select abc12345                           # Select by ID
  $ tm brief select https://app.tryhamster.com/...     # Select by URL

Shortcuts:
  $ tm brief <brief-url>                               # Same as "select"
  $ tm brief                                           # List all briefs

Note: Works exactly like "tm context brief" - reuses the same interactive interface.
`
			)
			.action(async (briefOrUrl) => {
				await this.executeSelect(briefOrUrl);
			});
	}

	/**
	 * Add create subcommand
	 */
	private addCreateCommand(): void {
		this.command('create')
			.description('Create a new brief (redirects to web UI)')
			.argument('[name]', 'Brief name (optional)')
			.addHelpText(
				'after',
				`
Examples:
  $ tm briefs create              # Redirect to web UI to create brief
  $ tm briefs create my-new-brief # Redirect with suggested name

Note: Briefs must be created through the Hamster Studio web interface.
`
			)
			.action(async (name) => {
				await this.executeCreate(name);
			});
	}

	/**
	 * Initialize TmCore if not already initialized
	 */
	private async initTmCore(): Promise<void> {
		if (!this.tmCore) {
			this.tmCore = await createTmCore({
				projectPath: process.cwd()
			});
		}
	}

	/**
	 * Execute list briefs
	 */
	private async executeList(options?: {
		showMetadata?: boolean;
	}): Promise<void> {
		try {
			// Check authentication
			if (!(await this.checkAuth())) {
				process.exit(1);
			}

			// Use the bridge to list briefs
			const remoteResult = await tryListTagsViaRemote({
				projectRoot: process.cwd(),
				showMetadata: options?.showMetadata || false,
				report: (level: LogLevel, ...args: unknown[]) => {
					const message = args[0] as string;
					if (level === 'error') ui.displayError(message);
					else if (level === 'warn') ui.displayWarning(message);
					else if (level === 'info') ui.displayInfo(message);
				}
			});

			if (!remoteResult) {
				throw new Error('Failed to fetch briefs from API');
			}

			this.setLastResult({
				success: remoteResult.success,
				action: 'list',
				briefs: remoteResult.tags,
				currentBrief: remoteResult.currentTag,
				message: remoteResult.message
			});
		} catch (error) {
			ui.displayError(`Failed to list briefs: ${(error as Error).message}`);
			this.setLastResult({
				success: false,
				action: 'list',
				message: (error as Error).message
			});
			process.exit(1);
		}
	}

	/**
	 * Execute select brief interactively or by name/ID
	 */
	private async executeSelect(nameOrId?: string): Promise<void> {
		try {
			// Check authentication
			const hasSession = await this.authManager.hasValidSession();
			if (!hasSession) {
				ui.displayError('Not authenticated. Run "tm auth login" first.');
				process.exit(1);
			}

			// If name/ID provided, treat it as URL/ID selection
			if (nameOrId && nameOrId.trim().length > 0) {
				await this.executeSelectFromUrl(nameOrId.trim());
				return;
			}

			// Check if org is selected for interactive selection
			const context = this.authManager.getContext();
			if (!context?.orgId) {
				ui.displayErrorBox(
					'No organization selected. Run "tm context org" first.'
				);
				process.exit(1);
			}

			// Use shared utility for interactive selection
			const result = await selectBriefInteractive(
				this.authManager,
				context.orgId
			);

			this.setLastResult({
				success: result.success,
				action: 'select',
				currentBrief: result.briefId,
				message: result.message
			});

			if (!result.success) {
				process.exit(1);
			}
		} catch (error) {
			ui.displayErrorBox(`Failed to select brief: ${(error as Error).message}`);
			this.setLastResult({
				success: false,
				action: 'select',
				message: (error as Error).message
			});
			process.exit(1);
		}
	}

	/**
	 * Execute select brief from any input (URL, ID, or name)
	 * All parsing logic is in tm-core
	 */
	private async executeSelectFromUrl(input: string): Promise<void> {
		try {
			// Check authentication
			const hasSession = await this.authManager.hasValidSession();
			if (!hasSession) {
				ui.displayError('Not authenticated. Run "tm auth login" first.');
				process.exit(1);
			}

			// Initialize tmCore to access business logic
			await this.initTmCore();

			// Use shared utility - tm-core handles ALL parsing
			const result = await selectBriefFromInput(
				this.authManager,
				input,
				this.tmCore
			);

			this.setLastResult({
				success: result.success,
				action: 'select',
				currentBrief: result.briefId,
				message: result.message
			});

			if (!result.success) {
				process.exit(1);
			}
		} catch (error) {
			ui.displayErrorBox(`Failed to select brief: ${(error as Error).message}`);
			this.setLastResult({
				success: false,
				action: 'select',
				message: (error as Error).message
			});
			process.exit(1);
		}
	}

	/**
	 * Execute create brief (redirect to web UI)
	 */
	private async executeCreate(name?: string): Promise<void> {
		try {
			// Check authentication
			if (!(await this.checkAuth())) {
				process.exit(1);
			}

			// Use the bridge to redirect to web UI
			const remoteResult = await tryAddTagViaRemote({
				tagName: name || 'new-brief',
				projectRoot: process.cwd(),
				report: (level: LogLevel, ...args: unknown[]) => {
					const message = args[0] as string;
					if (level === 'error') ui.displayError(message);
					else if (level === 'warn') ui.displayWarning(message);
					else if (level === 'info') ui.displayInfo(message);
				}
			});

			if (!remoteResult) {
				throw new Error('Failed to get brief creation URL');
			}

			this.setLastResult({
				success: remoteResult.success,
				action: 'create',
				message: remoteResult.message
			});

			if (!remoteResult.success) {
				process.exit(1);
			}
		} catch (error) {
			ui.displayErrorBox(`Failed to create brief: ${(error as Error).message}`);
			this.setLastResult({
				success: false,
				action: 'create',
				message: (error as Error).message
			});
			process.exit(1);
		}
	}

	/**
	 * Set the last result for programmatic access
	 */
	private setLastResult(result: BriefsResult): void {
		this.lastResult = result;
	}

	/**
	 * Get the last result (for programmatic usage)
	 */
	getLastResult(): BriefsResult | undefined {
		return this.lastResult;
	}

	/**
	 * Register this command on an existing program
	 */
	static register(program: Command, name?: string): BriefsCommand {
		const briefsCommand = new BriefsCommand(name);
		program.addCommand(briefsCommand);
		return briefsCommand;
	}
}
