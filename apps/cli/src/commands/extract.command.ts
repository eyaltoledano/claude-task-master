/**
 * @fileoverview Extract command for exporting tasks to external systems
 * Provides functionality to extract tasks to Hamster briefs
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora, { Ora } from 'ora';
import {
	AuthManager,
	AuthenticationError,
	type UserContext
} from '@tm/core/auth';
import { TaskMasterCore, type ExtractResult } from '@tm/core';
import * as ui from '../utils/ui.js';

/**
 * Result type from extract command
 */
export interface ExtractCommandResult {
	success: boolean;
	action: 'extract' | 'validate' | 'cancelled';
	result?: ExtractResult;
	message?: string;
}

/**
 * ExtractCommand extending Commander's Command class
 * Handles task extraction to external systems
 */
export class ExtractCommand extends Command {
	private authManager: AuthManager;
	private taskMasterCore?: TaskMasterCore;
	private lastResult?: ExtractCommandResult;

	constructor(name?: string) {
		super(name || 'extract');

		// Initialize auth manager
		this.authManager = AuthManager.getInstance();

		// Configure the command
		this.description(
			'Extract tasks to external systems (e.g., Hamster briefs)'
		);

		// Add options
		this.option('--org <id>', 'Organization ID to extract to');
		this.option('--brief <id>', 'Brief ID to extract tasks to');
		this.option('--tag <tag>', 'Extract tasks from a specific tag');
		this.option(
			'--status <status>',
			'Filter tasks by status (pending, in-progress, done, etc.)'
		);
		this.option('--with-subtasks', 'Include subtasks in extraction');
		this.option('-y, --yes', 'Skip confirmation prompt');

		// Accept optional positional argument for brief ID or Hamster URL
		this.argument('[briefOrUrl]', 'Brief ID or Hamster brief URL');

		// Default action
		this.action(async (briefOrUrl?: string, options?: any) => {
			await this.executeExtract(briefOrUrl, options);
		});
	}

	/**
	 * Initialize the TaskMasterCore
	 */
	private async initializeServices(): Promise<void> {
		if (this.taskMasterCore) {
			return;
		}

		try {
			// Initialize TaskMasterCore
			this.taskMasterCore = await TaskMasterCore.create({
				projectPath: process.cwd()
			});
		} catch (error) {
			throw new Error(
				`Failed to initialize services: ${(error as Error).message}`
			);
		}
	}

	/**
	 * Execute the extract command
	 */
	private async executeExtract(
		briefOrUrl?: string,
		options?: any
	): Promise<void> {
		let spinner: Ora | undefined;

		try {
			// Check authentication
			if (!this.authManager.isAuthenticated()) {
				ui.displayError('Not authenticated. Run "tm auth login" first.');
				process.exit(1);
			}

			// Initialize services
			await this.initializeServices();

			// Get current context
			const context = this.authManager.getContext();

			// Determine org and brief IDs
			let orgId = options?.org || context?.orgId;
			let briefId = options?.brief || briefOrUrl || context?.briefId;

			// If a URL/ID was provided as argument, resolve it
			if (briefOrUrl && !options?.brief) {
				spinner = ora('Resolving brief...').start();
				const resolvedBrief = await this.resolveBriefInput(briefOrUrl);
				if (resolvedBrief) {
					briefId = resolvedBrief.briefId;
					orgId = resolvedBrief.orgId;
					spinner.succeed('Brief resolved');
				} else {
					spinner.fail('Could not resolve brief');
					process.exit(1);
				}
			}

			// Validate we have necessary IDs
			if (!orgId) {
				ui.displayError(
					'No organization selected. Run "tm context org" or use --org flag.'
				);
				process.exit(1);
			}

			if (!briefId) {
				ui.displayError(
					'No brief specified. Run "tm context brief", provide a brief ID/URL, or use --brief flag.'
				);
				process.exit(1);
			}

			// Confirm extraction if not auto-confirmed
			if (!options?.yes) {
				const confirmed = await this.confirmExtraction(orgId, briefId, context);
				if (!confirmed) {
					ui.displayWarning('Extraction cancelled');
					this.setLastResult({
						success: false,
						action: 'cancelled',
						message: 'User cancelled extraction'
					});
					process.exit(0);
				}
			}

			// Perform extraction
			spinner = ora('Extracting tasks...').start();

			const extractResult = await this.taskMasterCore!.extractTasks({
				orgId,
				briefId,
				tag: options?.tag,
				status: options?.status,
				includeSubtasks: options?.withSubtasks
			});

			if (extractResult.success) {
				spinner.succeed(
					`Successfully extracted ${extractResult.taskCount} task(s) to brief`
				);

				// Display summary
				console.log(chalk.cyan('\n📤 Extraction Summary\n'));
				console.log(chalk.white(`  Organization: ${orgId}`));
				console.log(chalk.white(`  Brief: ${briefId}`));
				console.log(
					chalk.white(`  Tasks extracted: ${extractResult.taskCount}`)
				);
				if (options?.tag) {
					console.log(chalk.gray(`  Tag: ${options.tag}`));
				}
				if (options?.status) {
					console.log(chalk.gray(`  Status filter: ${options.status}`));
				}

				if (extractResult.message) {
					console.log(chalk.gray(`\n  ${extractResult.message}`));
				}
			} else {
				spinner.fail('Extraction failed');
				if (extractResult.error) {
					console.error(chalk.red(`\n✗ ${extractResult.error.message}`));
				}
			}

			this.setLastResult({
				success: extractResult.success,
				action: 'extract',
				result: extractResult
			});
		} catch (error: any) {
			if (spinner?.isSpinning) spinner.fail('Extraction failed');
			this.handleError(error);
			process.exit(1);
		}
	}

	/**
	 * Resolve brief input to get brief and org IDs
	 */
	private async resolveBriefInput(
		briefOrUrl: string
	): Promise<{ briefId: string; orgId: string } | null> {
		try {
			// Extract brief ID from input
			const briefId = this.extractBriefId(briefOrUrl);
			if (!briefId) {
				return null;
			}

			// Fetch brief to get organization
			const brief = await this.authManager.getBrief(briefId);
			if (!brief) {
				ui.displayError('Brief not found or you do not have access');
				return null;
			}

			return {
				briefId: brief.id,
				orgId: brief.accountId
			};
		} catch (error) {
			console.error(chalk.red(`Failed to resolve brief: ${error}`));
			return null;
		}
	}

	/**
	 * Extract a brief ID from raw input (ID or URL)
	 */
	private extractBriefId(input: string): string | null {
		const raw = input?.trim() ?? '';
		if (!raw) return null;

		const parseUrl = (s: string): URL | null => {
			try {
				return new URL(s);
			} catch {}
			try {
				return new URL(`https://${s}`);
			} catch {}
			return null;
		};

		const fromParts = (path: string): string | null => {
			const parts = path.split('/').filter(Boolean);
			const briefsIdx = parts.lastIndexOf('briefs');
			const candidate =
				briefsIdx >= 0 && parts.length > briefsIdx + 1
					? parts[briefsIdx + 1]
					: parts[parts.length - 1];
			return candidate?.trim() || null;
		};

		// Try URL parsing
		const url = parseUrl(raw);
		if (url) {
			const qId = url.searchParams.get('id') || url.searchParams.get('briefId');
			const candidate = (qId || fromParts(url.pathname)) ?? null;
			if (candidate) {
				if (this.isLikelyId(candidate) || candidate.length >= 8) {
					return candidate;
				}
			}
		}

		// Check if it looks like a path
		if (raw.includes('/')) {
			const candidate = fromParts(raw);
			if (candidate && (this.isLikelyId(candidate) || candidate.length >= 8)) {
				return candidate;
			}
		}

		// Return raw if it looks like an ID
		return raw;
	}

	/**
	 * Check if a string looks like a brief ID
	 */
	private isLikelyId(value: string): boolean {
		const uuidRegex =
			/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
		const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
		const slugRegex = /^[A-Za-z0-9_-]{16,}$/;
		return (
			uuidRegex.test(value) || ulidRegex.test(value) || slugRegex.test(value)
		);
	}

	/**
	 * Confirm extraction with the user
	 */
	private async confirmExtraction(
		orgId: string,
		briefId: string,
		context: UserContext | null
	): Promise<boolean> {
		console.log(chalk.cyan('\n📤 Extract Tasks\n'));

		// Show org name if available
		if (context?.orgName) {
			console.log(chalk.white(`  Organization: ${context.orgName}`));
			console.log(chalk.gray(`  ID: ${orgId}`));
		} else {
			console.log(chalk.white(`  Organization ID: ${orgId}`));
		}

		// Show brief info
		if (context?.briefName) {
			console.log(chalk.white(`\n  Brief: ${context.briefName}`));
			console.log(chalk.gray(`  ID: ${briefId}`));
		} else {
			console.log(chalk.white(`\n  Brief ID: ${briefId}`));
		}

		const { confirmed } = await inquirer.prompt([
			{
				type: 'confirm',
				name: 'confirmed',
				message: 'Do you want to proceed with extraction?',
				default: true
			}
		]);

		return confirmed;
	}

	/**
	 * Handle errors
	 */
	private handleError(error: any): void {
		if (error instanceof AuthenticationError) {
			console.error(chalk.red(`\n✗ ${error.message}`));

			if (error.code === 'NOT_AUTHENTICATED') {
				ui.displayWarning('Please authenticate first: tm auth login');
			}
		} else {
			const msg = error?.message ?? String(error);
			console.error(chalk.red(`Error: ${msg}`));

			if (error.stack && process.env.DEBUG) {
				console.error(chalk.gray(error.stack));
			}
		}
	}

	/**
	 * Clean up resources
	 */
	async cleanup(): Promise<void> {
		// No resources to clean up
	}

	/**
	 * Static method to register this command on an existing program
	 */
	static registerOn(program: Command): Command {
		const extractCommand = new ExtractCommand();
		program.addCommand(extractCommand);
		return extractCommand;
	}

	/**
	 * Alternative registration that returns the command for chaining
	 */
	static register(program: Command, name?: string): ExtractCommand {
		const extractCommand = new ExtractCommand(name);
		program.addCommand(extractCommand);
		return extractCommand;
	}
}
