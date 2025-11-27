/**
 * @fileoverview Export command for exporting tasks to Hamster
 * Creates a new brief from local tasks and imports them atomically
 */

import {
	type GenerateBriefResult,
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
import { displayError } from '../utils/error-handler.js';
import { getProjectRoot } from '../utils/project-root.js';

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

			// Show upgrade message
			showUpgradeMessage();

			// Determine if we should be interactive:
			// - Interactive by default (no flags passed)
			// - Non-interactive if --tag, --title, or --description are specified
			const hasDirectFlags =
				options?.tag || options?.title || options?.description;
			const isInteractive = !hasDirectFlags;

			if (isInteractive) {
				await this.executeInteractiveExport(options);
			} else {
				await this.executeStandardExport(options);
			}
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

			// Perform export
			spinner = ora('Creating brief and exporting tasks...').start();

			const result =
				await this.taskMasterCore!.integration.generateBriefFromTasks({
					tag: options?.tag,
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

				// Prompt to invite teammates
				await this.promptInviteTeammates(result.brief.url);

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

			// Perform export
			spinner = ora('Creating brief and exporting tasks...').start();

			// TODO: Support exporting specific selected tasks
			// For now, we export all tasks from the tag
			const result =
				await this.taskMasterCore!.integration.generateBriefFromTasks({
					tag: options?.tag,
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

				// Prompt to invite teammates
				await this.promptInviteTeammates(result.brief.url);

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
	 * Prompt user to invite teammates after successful export
	 */
	private async promptInviteTeammates(briefUrl: string): Promise<void> {
		const { wantsToInvite } = await inquirer.prompt<{ wantsToInvite: boolean }>(
			[
				{
					type: 'confirm',
					name: 'wantsToInvite',
					message:
						'Do you want to invite teammates to collaborate on these tasks together?',
					default: false
				}
			]
		);

		if (wantsToInvite) {
			// Extract base URL and org slug from brief URL
			// briefUrl format: http://localhost:3000/home/{org_slug}/briefs/{briefId}
			const urlMatch = briefUrl.match(
				/^(https?:\/\/[^/]+)\/home\/([^/]+)\/briefs\//
			);
			if (urlMatch) {
				const [, baseUrl, orgSlug] = urlMatch;
				const membersUrl = `${baseUrl}/home/${orgSlug}/members`;
				const open = await import('open');
				await open.default(membersUrl);
				console.log(chalk.gray('  Opened team members page in browser'));
			} else {
				// Fallback to brief URL if pattern doesn't match
				const open = await import('open');
				await open.default(briefUrl);
				console.log(chalk.gray('  Opened brief in browser'));
			}
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
