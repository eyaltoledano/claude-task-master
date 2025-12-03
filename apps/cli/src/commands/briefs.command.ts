/**
 * @fileoverview Briefs Command - Friendly alias for tag management in API storage
 * Provides brief-specific commands that only work with API storage
 */

import readline from 'readline';
import { type LogLevel, type TagInfo, tryAddTagViaRemote } from '@tm/bridge';
import type { Brief, TmCore } from '@tm/core';
import { AuthManager, createTmCore } from '@tm/core';
import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { getBriefStatusWithColor } from '../ui/formatters/status-formatters.js';
import { checkAuthentication } from '../utils/auth-helpers.js';
import {
	selectBriefFromInput,
	selectBriefInteractive
} from '../utils/brief-selection.js';
import { ensureOrgSelected } from '../utils/org-selection.js';
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

			// Ensure org is selected - prompt if not
			const orgId = await this.ensureOrgSelectedLocal();
			if (!orgId) {
				process.exit(1);
			}

			// Fetch briefs directly from AuthManager (bypasses storage layer issues)
			const spinner = ora('Fetching briefs...').start();
			const briefs = await this.authManager.getBriefs(orgId);
			spinner.stop();

			// Get current context to determine current brief
			const context = this.authManager.getContext();
			const currentBriefId = context?.briefId;

			// Convert to TagInfo format for display
			const tags: TagInfo[] = briefs.map((brief: Brief) => ({
				name: brief.document?.title || `Brief ${brief.id.slice(-8)}`,
				isCurrent: brief.id === currentBriefId,
				taskCount: brief.taskCount || 0,
				completedTasks: 0, // Not available from getBriefs
				statusBreakdown: {},
				created: brief.createdAt,
				description: brief.document?.description,
				status: brief.status,
				briefId: brief.id,
				updatedAt: brief.updatedAt
			}));

			// Sort: current first, then by updatedAt
			tags.sort((a, b) => {
				if (a.isCurrent) return -1;
				if (b.isCurrent) return 1;
				return 0;
			});

			this.setLastResult({
				success: true,
				action: 'list',
				briefs: tags,
				currentBrief: currentBriefId || null,
				message: `Found ${tags.length} brief(s)`
			});

			// Determine if we should skip table display (when interactive selection follows)
			const isInteractive = process.stdout.isTTY;

			// If interactive mode and briefs available, show integrated table selection
			if (isInteractive && tags.length > 0) {
				await this.promptBriefSelection(tags);
			} else if (tags.length === 0) {
				ui.displayWarning('No briefs found in this organization');
			} else {
				// Non-interactive: display table
				this.displayBriefsTable(tags, options?.showMetadata);
			}
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
	 * Ensure an organization is selected, prompting if necessary
	 * Uses the shared org-selection utility
	 */
	private async ensureOrgSelectedLocal(): Promise<string | null> {
		const result = await ensureOrgSelected(this.authManager);
		return result.success ? result.orgId || null : null;
	}

	/**
	 * Display briefs in a table format (for non-interactive mode)
	 */
	private displayBriefsTable(tags: TagInfo[], _showMetadata?: boolean): void {
		const Table = require('cli-table3');

		const terminalWidth = Math.max(process.stdout.columns || 120, 80);
		const usableWidth = Math.floor(terminalWidth * 0.95);
		const widths = [0.35, 0.25, 0.2, 0.1, 0.1];
		const colWidths = widths.map((w, i) =>
			Math.max(Math.floor(usableWidth * w), i === 0 ? 20 : 8)
		);

		const table = new Table({
			head: [
				chalk.cyan.bold('Brief Name'),
				chalk.cyan.bold('Status'),
				chalk.cyan.bold('Updated'),
				chalk.cyan.bold('Tasks'),
				chalk.cyan.bold('Completed')
			],
			colWidths: colWidths,
			wordWrap: true
		});

		tags.forEach((tag) => {
			const shortId = tag.briefId ? tag.briefId.slice(-8) : 'unknown';
			const tagDisplay = tag.isCurrent
				? `${chalk.green('●')} ${chalk.green.bold(tag.name)} ${chalk.gray(`(current - ${shortId})`)}`
				: `  ${tag.name} ${chalk.gray(`(${shortId})`)}`;

			const updatedDate = tag.updatedAt
				? new Date(tag.updatedAt).toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric',
						year: 'numeric'
					})
				: chalk.gray('N/A');

			table.push([
				tagDisplay,
				getBriefStatusWithColor(tag.status, true),
				chalk.gray(updatedDate),
				chalk.white(String(tag.taskCount || 0)),
				chalk.green(String(tag.completedTasks || 0))
			]);
		});

		console.log(table.toString());
	}

	/**
	 * Create table-formatted choice for integrated selection
	 */
	private formatBriefAsTableRow(
		brief: TagInfo,
		colWidths: {
			name: number;
			status: number;
			updated: number;
			tasks: number;
			done: number;
		}
	): string {
		const shortId = brief.briefId ? brief.briefId.slice(-8) : 'unknown';
		const isCurrent = brief.isCurrent;

		// Current indicator
		const currentMarker = isCurrent ? chalk.green('●') : ' ';

		// Calculate max name length (leave room for marker, spaces, and ID)
		const idSuffix = isCurrent ? '(current)' : `(${shortId})`;
		const maxNameLen = colWidths.name - 4 - idSuffix.length; // 4 = "● " + " " before id

		// Truncate name if too long
		let displayName = brief.name;
		if (displayName.length > maxNameLen) {
			displayName = displayName.substring(0, maxNameLen - 1) + '…';
		}

		const nameText = isCurrent ? chalk.green.bold(displayName) : displayName;
		const idText = isCurrent
			? chalk.gray(`(current)`)
			: chalk.gray(`(${shortId})`);

		// Calculate visual length and pad
		const nameVisualLength = 2 + displayName.length + 1 + idSuffix.length;
		const namePadding = Math.max(0, colWidths.name - nameVisualLength);
		const nameCol = `${currentMarker} ${nameText} ${idText}${' '.repeat(namePadding)}`;

		// Status column - fixed width with padding
		const statusDisplay = getBriefStatusWithColor(brief.status, true);
		const statusVisual = (brief.status || 'unknown').length + 2; // icon + space + status
		const statusPadding = Math.max(0, colWidths.status - statusVisual);
		const statusCol = `${statusDisplay}${' '.repeat(statusPadding)}`;

		// Updated column
		const updatedDate = brief.updatedAt
			? new Date(brief.updatedAt).toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				})
			: 'N/A';
		const updatedCol = chalk.gray(updatedDate.padEnd(colWidths.updated));

		// Tasks column
		const tasksCol = chalk.white(
			String(brief.taskCount || 0).padStart(colWidths.tasks)
		);

		// Done column
		const doneCol = chalk.green(
			String(brief.completedTasks || 0).padStart(colWidths.done)
		);

		return `${nameCol}  ${statusCol}  ${updatedCol}  ${tasksCol}  ${doneCol}`;
	}

	/**
	 * Prompt user to select a brief using integrated table selection
	 */
	private async promptBriefSelection(briefs: TagInfo[]): Promise<void> {
		try {
			// Check if org is selected (required for context updates)
			const context = this.authManager.getContext();
			if (!context?.orgId) {
				// Don't prompt if no org selected - user needs to set org first
				return;
			}

			// Calculate column widths based on terminal
			const terminalWidth = Math.max(process.stdout.columns || 120, 80);
			const usableWidth = Math.floor(terminalWidth * 0.95);
			const colWidths = {
				name: Math.floor(usableWidth * 0.42), // More room for long names
				status: Math.floor(usableWidth * 0.14),
				updated: Math.floor(usableWidth * 0.16),
				tasks: 6,
				done: 6
			};

			// Create table header
			const headerLine =
				chalk.cyan.bold('Brief Name'.padEnd(colWidths.name)) +
				chalk.cyan.bold('Status'.padEnd(colWidths.status)) +
				chalk.cyan.bold('Updated'.padEnd(colWidths.updated)) +
				chalk.cyan.bold('Tasks'.padStart(colWidths.tasks + 2)) +
				chalk.cyan.bold('Done'.padStart(colWidths.done + 2));

			const separator = chalk.gray('─'.repeat(usableWidth));

			// Build choices as table rows
			const choices: any[] = [
				new inquirer.Separator(headerLine),
				new inquirer.Separator(separator)
			];

			briefs.forEach((brief) => {
				choices.push({
					name: this.formatBriefAsTableRow(brief, colWidths),
					value: brief.briefId || brief.name,
					short: brief.name // Show just name after selection
				});
			});

			// Add separator and cancel option
			choices.push(new inquirer.Separator(separator));
			choices.push({
				name: chalk.dim('  (Cancel - keep current selection)'),
				value: null,
				short: 'Cancelled'
			});

			// Set up ESC key handler to cancel
			let cancelled = false;
			const handleKeypress = (_char: string, key: readline.Key) => {
				if (key && key.name === 'escape') {
					cancelled = true;
					// Send Ctrl+C to cancel the prompt
					process.stdin.emit('keypress', '', { name: 'c', ctrl: true });
				}
			};

			// Enable keypress events
			if (process.stdin.isTTY) {
				readline.emitKeypressEvents(process.stdin);
				process.stdin.on('keypress', handleKeypress);
			}

			let answer: { selectedBrief: string | null };
			try {
				answer = await inquirer.prompt([
					{
						type: 'list',
						name: 'selectedBrief',
						message: 'Select a brief:',
						choices: choices,
						pageSize: Math.min(briefs.length + 5, 20), // Show all briefs if possible
						loop: false
					}
				]);
			} finally {
				// Clean up keypress listener
				if (process.stdin.isTTY) {
					process.stdin.removeListener('keypress', handleKeypress);
				}
			}

			// If ESC was pressed, treat as cancel
			if (cancelled) {
				return;
			}

			if (answer.selectedBrief && answer.selectedBrief !== null) {
				// Find the selected brief
				const selectedBrief = briefs.find(
					(b) =>
						b.briefId === answer.selectedBrief ||
						b.name === answer.selectedBrief
				);

				if (selectedBrief) {
					// Update context with selected brief
					await this.authManager.updateContext({
						briefId: selectedBrief.briefId || undefined,
						briefName: selectedBrief.name,
						briefStatus: selectedBrief.status || undefined,
						briefUpdatedAt: selectedBrief.updatedAt || undefined
					});

					ui.displaySuccess(`Selected brief: ${selectedBrief.name}`);
					this.setLastResult({
						success: true,
						action: 'select',
						currentBrief: selectedBrief.briefId || selectedBrief.name,
						message: `Selected brief: ${selectedBrief.name}`
					});
				}
			}
		} catch (error) {
			// If user cancels (Ctrl+C), inquirer throws - handle gracefully
			if ((error as any).isTtyError) {
				// Not a TTY, skip interactive prompt
				return;
			}
			// Other errors - log but don't fail the command
			console.error(
				chalk.yellow(
					`\nNote: Could not prompt for brief selection: ${(error as Error).message}`
				)
			);
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
