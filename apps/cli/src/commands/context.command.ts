/**
 * @fileoverview Context command for managing org/brief selection
 * Provides a clean interface for workspace context management
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import {
	AuthManager,
	AuthenticationError,
	type UserContext
} from '@tm/core/auth';
import * as ui from '../utils/ui.js';

/**
 * Result type from context command
 */
export interface ContextResult {
	success: boolean;
	action: 'show' | 'select-org' | 'select-brief' | 'clear' | 'set';
	context?: UserContext;
	message?: string;
}

/**
 * ContextCommand extending Commander's Command class
 * Manages user's workspace context (org/brief selection)
 */
export class ContextCommand extends Command {
	private authManager: AuthManager;
	private lastResult?: ContextResult;

	constructor(name?: string) {
		super(name || 'context');

		// Initialize auth manager
		this.authManager = AuthManager.getInstance();

		// Configure the command
		this.description(
			'Manage workspace context (organization and brief selection)'
		);

		// Add subcommands
		this.addOrgCommand();
		this.addBriefCommand();
		this.addClearCommand();
		this.addSetCommand();

		// Default action shows current context
		this.action(async () => {
			await this.executeShow();
		});
	}

	/**
	 * Add org selection subcommand
	 */
	private addOrgCommand(): void {
		this.command('org')
			.description('Select an organization')
			.action(async () => {
				await this.executeSelectOrg();
			});
	}

	/**
	 * Add brief selection subcommand
	 */
	private addBriefCommand(): void {
		this.command('brief')
			.description('Select a brief within the current organization')
			.action(async () => {
				await this.executeSelectBrief();
			});
	}

	/**
	 * Add clear subcommand
	 */
	private addClearCommand(): void {
		this.command('clear')
			.description('Clear all context selections')
			.action(async () => {
				await this.executeClear();
			});
	}

	/**
	 * Add set subcommand for direct context setting
	 */
	private addSetCommand(): void {
		this.command('set')
			.description('Set context directly')
			.option('--org <id>', 'Organization ID')
			.option('--org-name <name>', 'Organization name')
			.option('--brief <id>', 'Brief ID')
			.option('--brief-name <name>', 'Brief name')
			.action(async (options) => {
				await this.executeSet(options);
			});
	}

	/**
	 * Execute show current context
	 */
	private async executeShow(): Promise<void> {
		try {
			const result = this.displayContext();
			this.setLastResult(result);
		} catch (error: any) {
			this.handleError(error);
			process.exit(1);
		}
	}

	/**
	 * Display current context
	 */
	private displayContext(): ContextResult {
		// Check authentication first
		if (!this.authManager.isAuthenticated()) {
			console.log(chalk.yellow('✗ Not authenticated'));
			console.log(chalk.gray('\n  Run "tm auth login" to authenticate first'));

			return {
				success: false,
				action: 'show',
				message: 'Not authenticated'
			};
		}

		const context = this.authManager.getContext();

		console.log(chalk.cyan('\n🌍 Workspace Context\n'));

		if (context && (context.orgId || context.briefId)) {
			if (context.orgName || context.orgId) {
				console.log(chalk.green('✓ Organization'));
				if (context.orgName) {
					console.log(chalk.white(`  ${context.orgName}`));
				}
				if (context.orgId) {
					console.log(chalk.gray(`  ID: ${context.orgId}`));
				}
			}

			if (context.briefName || context.briefId) {
				console.log(chalk.green('\n✓ Brief'));
				if (context.briefName) {
					console.log(chalk.white(`  ${context.briefName}`));
				}
				if (context.briefId) {
					console.log(chalk.gray(`  ID: ${context.briefId}`));
				}
			}

			if (context.updatedAt) {
				console.log(
					chalk.gray(
						`\n  Last updated: ${new Date(context.updatedAt).toLocaleString()}`
					)
				);
			}

			return {
				success: true,
				action: 'show',
				context,
				message: 'Context loaded'
			};
		} else {
			console.log(chalk.yellow('✗ No context selected'));
			console.log(
				chalk.gray('\n  Run "tm context org" to select an organization')
			);
			console.log(chalk.gray('  Run "tm context brief" to select a brief'));

			return {
				success: true,
				action: 'show',
				message: 'No context selected'
			};
		}
	}

	/**
	 * Execute org selection
	 */
	private async executeSelectOrg(): Promise<void> {
		try {
			// Check authentication
			if (!this.authManager.isAuthenticated()) {
				ui.displayError('Not authenticated. Run "tm auth login" first.');
				process.exit(1);
			}

			const result = await this.selectOrganization();
			this.setLastResult(result);

			if (!result.success) {
				process.exit(1);
			}
		} catch (error: any) {
			this.handleError(error);
			process.exit(1);
		}
	}

	/**
	 * Select an organization interactively
	 */
	private async selectOrganization(): Promise<ContextResult> {
		const spinner = ora('Fetching organizations...').start();

		try {
			// Fetch organizations from API
			const organizations = await this.authManager.getOrganizations();
			spinner.stop();

			if (organizations.length === 0) {
				ui.displayWarning('No organizations available');
				return {
					success: false,
					action: 'select-org',
					message: 'No organizations available'
				};
			}

			// Prompt for selection
			const { selectedOrg } = await inquirer.prompt([
				{
					type: 'list',
					name: 'selectedOrg',
					message: 'Select an organization:',
					choices: organizations.map((org) => ({
						name: org.name,
						value: org
					}))
				}
			]);

			// Update context
			await this.authManager.updateContext({
				orgId: selectedOrg.id,
				orgName: selectedOrg.name,
				// Clear brief when changing org
				briefId: undefined,
				briefName: undefined
			});

			ui.displaySuccess(`Selected organization: ${selectedOrg.name}`);

			return {
				success: true,
				action: 'select-org',
				context: this.authManager.getContext() || undefined,
				message: `Selected organization: ${selectedOrg.name}`
			};
		} catch (error) {
			spinner.fail('Failed to fetch organizations');
			throw error;
		}
	}

	/**
	 * Execute brief selection
	 */
	private async executeSelectBrief(): Promise<void> {
		try {
			// Check authentication
			if (!this.authManager.isAuthenticated()) {
				ui.displayError('Not authenticated. Run "tm auth login" first.');
				process.exit(1);
			}

			// Check if org is selected
			const context = this.authManager.getContext();
			if (!context?.orgId) {
				ui.displayError(
					'No organization selected. Run "tm context org" first.'
				);
				process.exit(1);
			}

			const result = await this.selectBrief(context.orgId);
			this.setLastResult(result);

			if (!result.success) {
				process.exit(1);
			}
		} catch (error: any) {
			this.handleError(error);
			process.exit(1);
		}
	}

	/**
	 * Select a brief within the current organization
	 */
	private async selectBrief(orgId: string): Promise<ContextResult> {
		const spinner = ora('Fetching briefs...').start();

		try {
			// Fetch briefs from API
			const briefs = await this.authManager.getBriefs(orgId);
			spinner.stop();

			if (briefs.length === 0) {
				ui.displayWarning('No briefs available in this organization');
				return {
					success: false,
					action: 'select-brief',
					message: 'No briefs available'
				};
			}

			// Prompt for selection
			const { selectedBrief } = await inquirer.prompt([
				{
					type: 'list',
					name: 'selectedBrief',
					message: 'Select a brief:',
					choices: [
						{ name: '(No brief - organization level)', value: null },
						...briefs.map((brief) => ({
							name: `Brief ${brief.id.slice(0, 8)} (${new Date(brief.createdAt).toLocaleDateString()})`,
							value: brief
						}))
					]
				}
			]);

			if (selectedBrief) {
				// Update context with brief
				const briefName = `Brief ${selectedBrief.id.slice(0, 8)}`;
				await this.authManager.updateContext({
					briefId: selectedBrief.id,
					briefName: briefName
				});

				ui.displaySuccess(`Selected brief: ${briefName}`);

				return {
					success: true,
					action: 'select-brief',
					context: this.authManager.getContext() || undefined,
					message: `Selected brief: ${selectedBrief.name}`
				};
			} else {
				// Clear brief selection
				await this.authManager.updateContext({
					briefId: undefined,
					briefName: undefined
				});

				ui.displaySuccess('Cleared brief selection (organization level)');

				return {
					success: true,
					action: 'select-brief',
					context: this.authManager.getContext() || undefined,
					message: 'Cleared brief selection'
				};
			}
		} catch (error) {
			spinner.fail('Failed to fetch briefs');
			throw error;
		}
	}

	/**
	 * Execute clear context
	 */
	private async executeClear(): Promise<void> {
		try {
			// Check authentication
			if (!this.authManager.isAuthenticated()) {
				ui.displayError('Not authenticated. Run "tm auth login" first.');
				process.exit(1);
			}

			const result = await this.clearContext();
			this.setLastResult(result);

			if (!result.success) {
				process.exit(1);
			}
		} catch (error: any) {
			this.handleError(error);
			process.exit(1);
		}
	}

	/**
	 * Clear all context selections
	 */
	private async clearContext(): Promise<ContextResult> {
		try {
			await this.authManager.clearContext();
			ui.displaySuccess('Context cleared');

			return {
				success: true,
				action: 'clear',
				message: 'Context cleared'
			};
		} catch (error) {
			ui.displayError(`Failed to clear context: ${(error as Error).message}`);

			return {
				success: false,
				action: 'clear',
				message: `Failed to clear context: ${(error as Error).message}`
			};
		}
	}

	/**
	 * Execute set context with options
	 */
	private async executeSet(options: any): Promise<void> {
		try {
			// Check authentication
			if (!this.authManager.isAuthenticated()) {
				ui.displayError('Not authenticated. Run "tm auth login" first.');
				process.exit(1);
			}

			const result = await this.setContext(options);
			this.setLastResult(result);

			if (!result.success) {
				process.exit(1);
			}
		} catch (error: any) {
			this.handleError(error);
			process.exit(1);
		}
	}

	/**
	 * Set context directly from options
	 */
	private async setContext(options: any): Promise<ContextResult> {
		try {
			const context: Partial<UserContext> = {};

			if (options.org) {
				context.orgId = options.org;
			}
			if (options.orgName) {
				context.orgName = options.orgName;
			}
			if (options.brief) {
				context.briefId = options.brief;
			}
			if (options.briefName) {
				context.briefName = options.briefName;
			}

			if (Object.keys(context).length === 0) {
				ui.displayWarning('No context options provided');
				return {
					success: false,
					action: 'set',
					message: 'No context options provided'
				};
			}

			await this.authManager.updateContext(context);
			ui.displaySuccess('Context updated');

			// Display what was set
			if (context.orgName || context.orgId) {
				console.log(
					chalk.gray(`  Organization: ${context.orgName || context.orgId}`)
				);
			}
			if (context.briefName || context.briefId) {
				console.log(
					chalk.gray(`  Brief: ${context.briefName || context.briefId}`)
				);
			}

			return {
				success: true,
				action: 'set',
				context: this.authManager.getContext() || undefined,
				message: 'Context updated'
			};
		} catch (error) {
			ui.displayError(`Failed to set context: ${(error as Error).message}`);

			return {
				success: false,
				action: 'set',
				message: `Failed to set context: ${(error as Error).message}`
			};
		}
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
	 * Set the last result for programmatic access
	 */
	private setLastResult(result: ContextResult): void {
		this.lastResult = result;
	}

	/**
	 * Get the last result (for programmatic usage)
	 */
	getLastResult(): ContextResult | undefined {
		return this.lastResult;
	}

	/**
	 * Get current context (for programmatic usage)
	 */
	getContext(): UserContext | null {
		return this.authManager.getContext();
	}

	/**
	 * Clean up resources
	 */
	async cleanup(): Promise<void> {
		// No resources to clean up for context command
	}

	/**
	 * Static method to register this command on an existing program
	 */
	static registerOn(program: Command): Command {
		const contextCommand = new ContextCommand();
		program.addCommand(contextCommand);
		return contextCommand;
	}

	/**
	 * Alternative registration that returns the command for chaining
	 */
	static register(program: Command, name?: string): ContextCommand {
		const contextCommand = new ContextCommand(name);
		program.addCommand(contextCommand);
		return contextCommand;
	}
}
