/**
 * @fileoverview Briefs Command - Friendly alias for tag management in API storage
 * Provides brief-specific commands that only work with API storage
 */

import { Command } from 'commander';
import chalk from 'chalk';
import type { TmCore } from '@tm/core';
import { createTmCore } from '@tm/core';
import * as ui from '../utils/ui.js';
import {
	tryListTagsViaRemote,
	tryAddTagViaRemote,
	tryUseTagViaRemote,
	type TagInfo,
	type LogLevel
} from '@tm/bridge';

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
	private lastResult?: BriefsResult;

	constructor(name?: string) {
		super(name || 'briefs');

		// Configure the command
		this.description('Manage briefs (API storage only)');

		// Add subcommands
		this.addListCommand();
		this.addSelectCommand();
		this.addCreateCommand();

		// Default action: list briefs
		this.action(async () => {
			await this.executeList();
		});
	}

	/**
	 * Check if using API storage
	 */
	private async checkApiStorage(): Promise<boolean> {
		await this.initTmCore();
		const storageType = this.tmCore!.tasks.getStorageType();

		if (storageType !== 'api') {
			console.log(
				chalk.yellow('\n⚠ Briefs command requires API storage\n')
			);
			console.log(
				chalk.white(
					'The "briefs" command is only available when using API storage (tryhamster.com).'
				)
			);
			console.log(chalk.gray('\nYou are currently using file-based storage.'));
			console.log(
				chalk.gray('\nUse "tm tags" instead for file-based tag management.')
			);
			return false;
		}

		return true;
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
			.description('Interactively select a brief to work with')
			.argument('[name]', 'Brief name or ID (optional, interactive if omitted)')
			.addHelpText(
				'after',
				`
Examples:
  $ tm briefs select              # Interactive selection
  $ tm briefs select my-brief     # Select by name
  $ tm briefs select abc12345     # Select by ID (last 8 chars)

Note: This is an alias for "tm context brief" when using API storage.
`
			)
			.action(async (name) => {
				await this.executeSelect(name);
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
			// Check if using API storage
			if (!(await this.checkApiStorage())) {
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
			ui.displayError(
				`Failed to list briefs: ${(error as Error).message}`
			);
			this.setLastResult({
				success: false,
				action: 'list',
				message: (error as Error).message
			});
			process.exit(1);
		}
	}

	/**
	 * Execute select brief (switch to brief)
	 */
	private async executeSelect(name?: string): Promise<void> {
		try {
			// Check if using API storage
			if (!(await this.checkApiStorage())) {
				process.exit(1);
			}

			if (!name) {
				// Interactive selection - use tm context brief
				ui.displayInfo(
					'For interactive brief selection, use: tm context brief'
				);
				this.setLastResult({
					success: false,
					action: 'select',
					message: 'Name required. Use "tm context brief" for interactive selection.'
				});
				process.exit(1);
			}

			// Use the bridge to switch briefs
			const remoteResult = await tryUseTagViaRemote({
				tagName: name,
				projectRoot: process.cwd(),
				report: (level: LogLevel, ...args: unknown[]) => {
					const message = args[0] as string;
					if (level === 'error') ui.displayError(message);
					else if (level === 'warn') ui.displayWarning(message);
					else if (level === 'info') ui.displayInfo(message);
				}
			});

			if (!remoteResult) {
				throw new Error('Failed to switch brief');
			}

			this.setLastResult({
				success: remoteResult.success,
				action: 'select',
				currentBrief: remoteResult.currentTag,
				message: remoteResult.message
			});
		} catch (error) {
			ui.displayError(
				`Failed to select brief: ${(error as Error).message}`
			);
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
			// Check if using API storage
			if (!(await this.checkApiStorage())) {
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
		} catch (error) {
			ui.displayError(
				`Failed to create brief: ${(error as Error).message}`
			);
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
