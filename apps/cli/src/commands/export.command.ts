/**
 * @fileoverview Export command for exporting tasks to Hamster
 * Creates a new brief from local tasks and imports them atomically
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import {
	FileStorage,
	type GenerateBriefResult,
	type InvitationResult,
	PromptService,
	type TmCore,
	createTmCore
} from '@tm/core';
import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';
import ora, { type Ora } from 'ora';
import {
	type ExportableTask,
	selectTasks,
	showExportPreview,
	showUpgradeMessage,
	validateTasks
} from '../export/index.js';
import { ensureAuthenticated } from '../utils/auth-guard.js';
import { selectBriefFromInput } from '../utils/brief-selection.js';
import { displayError } from '../utils/error-handler.js';
import { getProjectRoot } from '../utils/project-root.js';

/**
 * Exported tag tracking in state.json
 */
interface ExportedTagInfo {
	briefId: string;
	briefUrl: string;
	exportedAt: string;
}

/**
 * Result type from export command
 */
export interface ExportCommandResult {
	success: boolean;
	action: 'export' | 'validate' | 'cancelled';
	result?: GenerateBriefResult;
	message?: string;
}

/**
 * ExportCommand extending Commander's Command class
 * Handles task export to Hamster by generating a new brief
 */
export class ExportCommand extends Command {
	private taskMasterCore?: TmCore;
	private promptService?: PromptService;
	private lastResult?: ExportCommandResult;

	constructor(name?: string) {
		super(name || 'export');

		// Configure the command
		this.description(
			'Export tasks to Hamster by creating a new brief from your local tasks'
		);

		// Options - interactive by default, direct export when flags are passed
		this.option(
			'--tag <tag>',
			'Export tasks from a specific tag (non-interactive)'
		);
		this.option(
			'--title <title>',
			'Specify a title for the generated brief (non-interactive)'
		);
		this.option(
			'--description <description>',
			'Specify a description for the generated brief (non-interactive)'
		);
		this.option(
			'-I, --invite',
			'Prompt for email addresses to invite collaborators to the brief'
		);

		// Default action
		this.action(async (options?: any) => {
			await this.executeExport(options);
		});
	}

	/**
	 * Initialize the TmCore and PromptService
	 */
	private async initializeServices(): Promise<void> {
		if (this.taskMasterCore) {
			return;
		}

		try {
			const projectRoot = getProjectRoot();

			// Initialize TmCore
			this.taskMasterCore = await createTmCore({
				projectPath: projectRoot
			});

			// Initialize PromptService for upgrade prompts
			this.promptService = new PromptService(projectRoot);
		} catch (error) {
			throw new Error(
				`Failed to initialize services: ${(error as Error).message}`
			);
		}
	}

	/**
	 * Execute the export command
	 */
	private async executeExport(options?: any): Promise<void> {
		try {
			// Ensure user is authenticated (will prompt and trigger OAuth if not)
			const authResult = await ensureAuthenticated({
				actionName: 'export tasks to Hamster'
			});

			if (!authResult.authenticated) {
				if (authResult.cancelled) {
					this.lastResult = {
						success: false,
						action: 'cancelled',
						message: 'User cancelled authentication'
					};
				}
				return;
			}

			// Initialize services
			await this.initializeServices();

			// Check if a brief is already in context (meaning we're working with remote tasks)
			const context = this.taskMasterCore!.auth.getContext();
			if (context?.briefId) {
				console.log(
					chalk.yellow('\n  You are currently connected to a Hamster brief.')
				);
				console.log(
					chalk.gray(
						'  Tasks in this context already live on Hamster - export is unnecessary.\n'
					)
				);

				// Ask if they want to export a different tag
				const { wantsToExportDifferent } = await inquirer.prompt<{
					wantsToExportDifferent: boolean;
				}>([
					{
						type: 'confirm',
						name: 'wantsToExportDifferent',
						message:
							'Would you like to export a different tag from your local tasks.json?',
						default: true
					}
				]);

				if (!wantsToExportDifferent) {
					this.lastResult = {
						success: false,
						action: 'cancelled',
						message: 'Export cancelled - already connected to brief'
					};
					return;
				}

				// Force interactive tag selection
				await this.executeInteractiveTagSelection(options);
				return;
			}

			// Show upgrade message with tag info
			const tagToExport = options?.tag || 'master';
			showUpgradeMessage(tagToExport);

			// Determine if we should be interactive:
			// - Interactive by default (no flags passed)
			// - Non-interactive if --tag, --title, or --description are specified
			const hasDirectFlags =
				options?.tag || options?.title || options?.description;
			const isInteractive = !hasDirectFlags;

			if (isInteractive) {
				await this.executeInteractiveTagSelection(options);
			} else {
				await this.executeStandardExport(options);
			}
		} catch (error: any) {
			displayError(error);
		}
	}

	/**
	 * Interactive tag selection before export
	 */
	private async executeInteractiveTagSelection(options?: any): Promise<void> {
		try {
			// Get available local tags from file storage DIRECTLY
			// (not via taskMasterCore which may be using API storage when connected to a brief)
			const projectRoot = getProjectRoot();
			if (!projectRoot) {
				console.log(chalk.yellow('\nNo project root found.\n'));
				this.lastResult = {
					success: false,
					action: 'cancelled',
					message: 'No project root found'
				};
				return;
			}

			const fileStorage = new FileStorage(projectRoot);
			await fileStorage.initialize();
			const tagsResult = await fileStorage.getTagsWithStats();

			if (!tagsResult.tags || tagsResult.tags.length === 0) {
				console.log(chalk.yellow('\nNo local tags found in tasks.json.\n'));
				this.lastResult = {
					success: false,
					action: 'cancelled',
					message: 'No local tags available'
				};
				return;
			}

			// Get already exported tags
			const exportedTags = await this.getExportedTags();

			// Build choices for tag selection
			const tagChoices = tagsResult.tags.map((tag) => {
				const taskInfo = `${tag.taskCount} tasks, ${tag.completedTasks} done`;
				const currentMarker = tag.isCurrent ? chalk.cyan(' (current)') : '';
				const exportedMarker = exportedTags[tag.name]
					? chalk.green(' [exported]')
					: '';
				return {
					name: `${tag.name}${currentMarker}${exportedMarker} - ${chalk.gray(taskInfo)}`,
					value: tag.name,
					short: tag.name
				};
			});

			// Add cancel option
			tagChoices.push({
				name: chalk.gray('Cancel'),
				value: '__cancel__',
				short: 'Cancel'
			});

			// Prompt for tag selection
			const { selectedTag } = await inquirer.prompt<{ selectedTag: string }>([
				{
					type: 'list',
					name: 'selectedTag',
					message: 'Which tag would you like to export to Hamster?',
					choices: tagChoices,
					pageSize: 10
				}
			]);

			if (selectedTag === '__cancel__') {
				console.log(chalk.gray('\n  Export cancelled.\n'));
				this.lastResult = {
					success: false,
					action: 'cancelled',
					message: 'User cancelled tag selection'
				};
				return;
			}

			// Check if tag was already exported
			if (exportedTags[selectedTag]) {
				console.log(
					chalk.yellow(`\n  This tag was previously exported to Hamster.`)
				);
				console.log(
					chalk.gray(`  Brief URL: ${exportedTags[selectedTag].briefUrl}`)
				);

				const { confirmReExport } = await inquirer.prompt<{
					confirmReExport: boolean;
				}>([
					{
						type: 'confirm',
						name: 'confirmReExport',
						message: 'Export again? (This will create a new brief)',
						default: false
					}
				]);

				if (!confirmReExport) {
					console.log(chalk.gray('\n  Export cancelled.\n'));
					this.lastResult = {
						success: false,
						action: 'cancelled',
						message: 'User cancelled re-export'
					};
					return;
				}
			}

			// Show upgrade message with selected tag
			showUpgradeMessage(selectedTag);

			// Execute interactive export with selected tag
			await this.executeInteractiveExport({ ...options, tag: selectedTag });
		} catch (error: any) {
			displayError(error);
		}
	}

	/**
	 * Execute standard (non-interactive) export
	 */
	private async executeStandardExport(options: any): Promise<void> {
		let spinner: Ora | undefined;

		try {
			// Load tasks to show preview
			spinner = ora('Loading tasks...').start();
			const taskList = await this.taskMasterCore!.tasks.list({
				tag: options?.tag,
				includeSubtasks: true
			});
			spinner.succeed(`${taskList.tasks.length} tasks`);

			if (taskList.tasks.length === 0) {
				console.log(chalk.yellow('\nNo tasks found to export.\n'));
				this.lastResult = {
					success: false,
					action: 'cancelled',
					message: 'No tasks found'
				};
				return;
			}

			// Show what will be exported
			this.showTaskPreview(taskList.tasks);

			// Prompt for invite emails if --invite flag is set
			let inviteEmails: string[] = [];
			if (options?.invite) {
				inviteEmails = await this.promptForInviteEmails();
			}

			// Perform export
			spinner = ora('Creating brief and exporting tasks...').start();

			const result =
				await this.taskMasterCore!.integration.generateBriefFromTasks({
					tag: options?.tag,
					inviteEmails: inviteEmails.length > 0 ? inviteEmails : undefined,
					options: {
						// Always generate title/description unless manually specified
						generateTitle: !options?.title,
						generateDescription: !options?.description,
						title: options?.title,
						description: options?.description,
						preserveHierarchy: true,
						preserveDependencies: true
					}
				});

			if (result.success && result.brief) {
				spinner.succeed('Export complete');
				this.displaySuccessResult(result);

				// Show invitation results if any
				if (result.invitations && result.invitations.length > 0) {
					this.displayInvitationResults(result.invitations);
				}

				// Always show the invite URL
				this.showInviteUrl(result.brief.url);

				// Auto-set context to the new brief
				await this.setContextToBrief(result.brief.url);

				// Track exported tag for future reference
				const exportedTag = options?.tag || 'master';
				await this.trackExportedTag(
					exportedTag,
					result.brief.id,
					result.brief.url
				);

				// Record export success for prompt metrics
				await this.promptService?.recordAction('export_attempt', 'accepted');
			} else {
				spinner.fail('Export failed');
				const errorMsg = result.error?.message || 'Unknown error occurred';
				console.error(chalk.red(`\n${errorMsg}`));
				if (result.error?.code) {
					console.error(chalk.gray(`  Error code: ${result.error.code}`));
				}
			}

			this.lastResult = {
				success: result.success,
				action: 'export',
				result
			};
		} catch (error: any) {
			if (spinner?.isSpinning) spinner.fail('Export failed');
			throw error;
		}
	}

	/**
	 * Execute interactive export with task selection
	 */
	private async executeInteractiveExport(options: any): Promise<void> {
		let spinner: Ora | undefined;

		try {
			// Load tasks
			const taskList = await this.taskMasterCore!.tasks.list({
				tag: options?.tag,
				includeSubtasks: true
			});

			if (taskList.tasks.length === 0) {
				console.log(chalk.yellow('\nNo tasks available for export.\n'));
				this.lastResult = {
					success: false,
					action: 'cancelled',
					message: 'No tasks available'
				};
				return;
			}

			// Convert to exportable format
			const exportableTasks: ExportableTask[] = taskList.tasks.map((task) => ({
				id: String(task.id),
				title: task.title,
				description: task.description,
				status: task.status,
				priority: task.priority,
				dependencies: task.dependencies?.map(String),
				subtasks: task.subtasks?.map((st) => ({
					id: String(st.id),
					title: st.title,
					description: st.description,
					status: st.status,
					priority: st.priority
				}))
			}));

			// Interactive task selection (all pre-selected by default)
			const selectionResult = await selectTasks(exportableTasks, {
				preselectAll: true,
				showStatus: true,
				showPriority: true
			});

			if (
				selectionResult.cancelled ||
				selectionResult.selectedTasks.length === 0
			) {
				console.log(chalk.yellow('\nExport cancelled.\n'));
				this.lastResult = {
					success: false,
					action: 'cancelled',
					message: 'User cancelled selection'
				};
				return;
			}

			// Validate selected tasks
			const validation = validateTasks(selectionResult.selectedTasks);
			if (!validation.isValid) {
				console.log(chalk.red('\nCannot export due to validation errors:\n'));
				for (const error of validation.errors) {
					console.log(chalk.red(`  - ${error}`));
				}
				this.lastResult = {
					success: false,
					action: 'validate',
					message: 'Validation failed'
				};
				return;
			}

			// Show preview and confirm
			const confirmed = await showExportPreview(selectionResult.selectedTasks, {
				briefName: options?.title || '(will be generated)'
			});

			if (!confirmed) {
				console.log(chalk.yellow('\nExport cancelled.\n'));
				this.lastResult = {
					success: false,
					action: 'cancelled',
					message: 'User cancelled after preview'
				};
				return;
			}

			// Ask about inviting collaborators BEFORE export
			let inviteEmails: string[] = [];
			const { wantsToInvite } = await inquirer.prompt<{
				wantsToInvite: boolean;
			}>([
				{
					type: 'confirm',
					name: 'wantsToInvite',
					message:
						'Do you want to invite teammates to collaborate on these tasks together?',
					default: false
				}
			]);

			if (wantsToInvite) {
				inviteEmails = await this.promptForInviteEmails();
			}

			// Perform export
			spinner = ora('Creating brief and exporting tasks...').start();

			// TODO: Support exporting specific selected tasks
			// For now, we export all tasks from the tag
			const result =
				await this.taskMasterCore!.integration.generateBriefFromTasks({
				tag: options?.tag,
					inviteEmails: inviteEmails.length > 0 ? inviteEmails : undefined,
					options: {
						generateTitle: !options?.title,
						generateDescription: !options?.description,
						title: options?.title,
						description: options?.description,
						preserveHierarchy: true,
						preserveDependencies: true
					}
				});

			if (result.success && result.brief) {
				spinner.succeed('Export complete');
				this.displaySuccessResult(result);

				// Show invitation results if any
				if (result.invitations && result.invitations.length > 0) {
					this.displayInvitationResults(result.invitations);
				}

				// Always show the invite URL (whether they invited or not)
				this.showInviteUrl(result.brief.url);

				// Auto-set context to the new brief
				await this.setContextToBrief(result.brief.url);

				// Track exported tag for future reference
				const exportedTag = options?.tag || 'master';
				await this.trackExportedTag(
					exportedTag,
					result.brief.id,
					result.brief.url
				);

				// Record success
				await this.promptService?.recordAction('export_attempt', 'accepted');
			} else {
				spinner.fail('Export failed');
				const errorMsg = result.error?.message || 'Unknown error occurred';
				console.error(chalk.red(`\n${errorMsg}`));
				if (result.error?.code) {
					console.error(chalk.gray(`  Error code: ${result.error.code}`));
				}
			}

			this.lastResult = {
				success: result.success,
				action: 'export',
				result
			};
		} catch (error: any) {
			if (spinner?.isSpinning) spinner.fail('Export failed');
			throw error;
		}
	}

	/**
	 * Show a preview of tasks to be exported
	 */
	private showTaskPreview(tasks: any[]): void {
		console.log(chalk.cyan('\nTasks to Export\n'));

		const previewTasks = tasks.slice(0, 10);
		for (const task of previewTasks) {
			const statusIcon = this.getStatusIcon(task.status);
			console.log(chalk.white(`  ${statusIcon} [${task.id}] ${task.title}`));
		}

		if (tasks.length > 10) {
			console.log(chalk.gray(`  ... and ${tasks.length - 10} more tasks`));
		}
		console.log('');
	}

	/**
	 * Display success result with brief URL
	 */
	private displaySuccessResult(result: GenerateBriefResult): void {
		if (!result.brief) return;

		console.log('');
		console.log(chalk.green('  Done! ') + chalk.white.bold(result.brief.title));
		console.log(chalk.gray(`  ${result.brief.taskCount} tasks exported`));
		console.log('');
		console.log(chalk.white(`  ${result.brief.url}`));

		// Warnings if any
		if (result.warnings && result.warnings.length > 0) {
			console.log('');
			for (const warning of result.warnings) {
				console.log(chalk.yellow(`  Warning: ${warning}`));
			}
		}

		console.log('');
	}

	/**
	 * Prompt for email addresses to invite collaborators
	 * @returns Array of validated email addresses, or empty array if none/cancelled
	 */
	private async promptForInviteEmails(): Promise<string[]> {
		const { emails } = await inquirer.prompt<{ emails: string }>([
			{
				type: 'input',
				name: 'emails',
				message: 'Enter email addresses to invite (comma-separated, max 10):',
				validate: (input: string) => {
					if (!input.trim()) {
						return true; // Empty is valid - means no invites
					}
					const emailList = input
						.split(',')
						.map((e) => e.trim())
						.filter(Boolean);
					if (emailList.length > 10) {
						return 'Maximum 10 email addresses allowed';
					}
					// Basic email format validation
					const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
					const invalid = emailList.filter((e) => !emailRegex.test(e));
					if (invalid.length > 0) {
						return `Invalid email format: ${invalid.join(', ')}`;
					}
					return true;
				}
			}
		]);

		if (!emails.trim()) {
			return [];
		}

		return emails
			.split(',')
			.map((e) => e.trim())
			.filter(Boolean)
			.slice(0, 10);
	}

	/**
	 * Display invitation results
	 */
	private displayInvitationResults(invitations: InvitationResult[]): void {
		if (!invitations || invitations.length === 0) return;

		console.log(chalk.cyan('\n  Collaborator Invitations:'));
		for (const inv of invitations) {
			switch (inv.status) {
				case 'sent':
					console.log(chalk.green(`    ${inv.email}: Invitation sent`));
					break;
				case 'already_member':
					console.log(chalk.gray(`    ${inv.email}: Already a team member`));
					break;
				case 'error':
					console.log(
						chalk.red(`    ${inv.email}: ${inv.error || 'Failed to invite'}`)
					);
					break;
			}
		}
	}

	/**
	 * Show invite URL for team members (without auto-opening)
	 */
	private showInviteUrl(briefUrl: string): void {
		// Extract base URL and org slug from brief URL
		// briefUrl format: http://localhost:3000/home/{org_slug}/briefs/{briefId}
		const urlMatch = briefUrl.match(
			/^(https?:\/\/[^/]+)\/home\/([^/]+)\/briefs\//
		);
		if (urlMatch) {
			const [, baseUrl, orgSlug] = urlMatch;
			const membersUrl = `${baseUrl}/home/${orgSlug}/members`;
			console.log(chalk.gray(`  Invite teammates: ${membersUrl}`));
		}
	}

	/**
	 * Set context to the newly created brief
	 * Uses the selectBriefFromInput utility to properly resolve and set all context fields
	 */
	private async setContextToBrief(briefUrl: string): Promise<void> {
		try {
			if (!this.taskMasterCore) return;

			// Get AuthManager from TmCore
			const authManager = (this.taskMasterCore.auth as any).authManager;
			if (!authManager) return;

			// Use the selectBriefFromInput utility which properly resolves
			// the brief and sets all context fields (org, brief details, etc.)
			const result = await selectBriefFromInput(
				authManager,
				briefUrl,
				this.taskMasterCore
			);

			if (!result.success) {
				// Silently fail - already exported successfully
			}
		} catch {
			// Silently fail - context setting is a nice-to-have
			// The export was already successful, user can manually set context
		}
	}

	/**
	 * Get status icon for display
	 */
	private getStatusIcon(status?: string): string {
		switch (status) {
			case 'done':
				return chalk.green('●');
			case 'in-progress':
			case 'in_progress':
				return chalk.yellow('◐');
			case 'blocked':
				return chalk.red('⊘');
			default:
				return chalk.gray('○');
		}
	}

	/**
	 * Get the last export result (useful for testing)
	 */
	public getLastResult(): ExportCommandResult | undefined {
		return this.lastResult;
	}

	/**
	 * Clean up resources
	 */
	async cleanup(): Promise<void> {
		// No resources to clean up
	}

	/**
	 * Get exported tags from state.json
	 */
	private async getExportedTags(): Promise<Record<string, ExportedTagInfo>> {
		const projectRoot = getProjectRoot();
		if (!projectRoot) return {};

		const statePath = path.join(projectRoot, '.taskmaster', 'state.json');

		try {
			const stateData = await fs.readFile(statePath, 'utf-8');
			const state = JSON.parse(stateData);
			return state.metadata?.exportedTags || {};
		} catch {
			return {};
		}
	}

	/**
	 * Track an exported tag in state.json
	 */
	private async trackExportedTag(
		tagName: string,
		briefId: string,
		briefUrl: string
	): Promise<void> {
		const projectRoot = getProjectRoot();
		if (!projectRoot) return;

		const statePath = path.join(projectRoot, '.taskmaster', 'state.json');

		try {
			let state: Record<string, any> = {};

			try {
				const stateData = await fs.readFile(statePath, 'utf-8');
				state = JSON.parse(stateData);
			} catch {
				// State file doesn't exist, create new
			}

			// Initialize metadata if needed
			if (!state.metadata) state.metadata = {};
			if (!state.metadata.exportedTags) state.metadata.exportedTags = {};

			// Track the exported tag
			state.metadata.exportedTags[tagName] = {
				briefId,
				briefUrl,
				exportedAt: new Date().toISOString()
			};

			state.lastUpdated = new Date().toISOString();

			// Write back
			await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
		} catch {
			// Silently fail - tracking is nice-to-have
		}
	}

	/**
	 * Register this command on an existing program
	 */
	static register(program: Command, name?: string): ExportCommand {
		const exportCommand = new ExportCommand(name);
		program.addCommand(exportCommand);
		return exportCommand;
	}
}

/**
 * ExportTagCommand - Alias for export with --tag
 * Allows: tm export-tag <tagName>
 */
export class ExportTagCommand extends Command {
	constructor() {
		super('export-tag');

		this.description(
			'Export a specific tag to Hamster (alias for: tm export --tag <tag>)'
		);
		this.argument('<tag>', 'Name of the tag to export');
		this.option('--title <title>', 'Specify a title for the generated brief');
		this.option(
			'--description <description>',
			'Specify a description for the generated brief'
		);

		this.action(async (tag: string, options: any) => {
			// Create and execute ExportCommand with tag option
			const exportCmd = new ExportCommand();
			// Call the private method via the public action
			await exportCmd.parseAsync([
				'node',
				'export',
				'--tag',
				tag,
				...(options.title ? ['--title', options.title] : []),
				...(options.description ? ['--description', options.description] : [])
			]);
		});
	}

	/**
	 * Register this command on an existing program
	 */
	static register(program: Command): ExportTagCommand {
		const exportTagCommand = new ExportTagCommand();
		program.addCommand(exportTagCommand);
		return exportTagCommand;
	}
}
