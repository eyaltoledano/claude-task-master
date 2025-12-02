/**
 * @fileoverview Context command for managing org/brief selection
 * Provides a clean interface for workspace context management
 */

import {
	AuthManager,
	type TmCore,
	type UserContext,
	createTmCore
} from '@tm/core';
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
	private tmCore?: TmCore;
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

		// Accept optional positional argument for brief ID or Hamster URL
		this.argument('[briefOrUrl]', 'Brief ID or Hamster brief URL');

		// Global option for this command and its subcommands
		this.option('--no-header', 'Suppress the header display');

		// Default action: if an argument is provided, resolve and set context; else show
		this.action(async (briefOrUrl?: string, options?: { header?: boolean }) => {
			const showHeader = options?.header !== false;
			if (briefOrUrl && briefOrUrl.trim().length > 0) {
				await this.executeSetFromBriefInput(briefOrUrl.trim(), showHeader);
				return;
			}
			await this.executeShow(showHeader);
		});
	}

	/**
	 * Add org selection subcommand
	 */
	private addOrgCommand(): void {
		this.command('org')
			.description('Select an organization')
			.argument('[orgId]', 'Organization ID or slug to select directly')
			.option('--no-header', 'Suppress the header display')
			.action(async (orgId?: string) => {
				await this.executeSelectOrg(orgId);
			});
	}

	/**
	 * Add brief selection subcommand
	 */
	private addBriefCommand(): void {
		this.command('brief')
			.description('Select a brief within the current organization')
			.argument('[briefIdOrUrl]', 'Brief ID or Hamster URL to select directly')
			.option('--no-header', 'Suppress the header display')
			.action(async (briefIdOrUrl?: string) => {
				await this.executeSelectBrief(briefIdOrUrl);
			});
	}

	/**
	 * Add clear subcommand
	 */
	private addClearCommand(): void {
		this.command('clear')
			.description('Clear all context selections')
			.option('--no-header', 'Suppress the header display')
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
			.option('--no-header', 'Suppress the header display')
			.action(async (options) => {
				await this.executeSet(options);
			});
	}

	/**
	 * Execute show current context
	 */
	private async executeShow(showHeader: boolean = true): Promise<void> {
		try {
			const result = await this.displayContext(showHeader);
			this.setLastResult(result);
		} catch (error: any) {
			ui.displayError(`Failed to show context: ${(error as Error).message}`);
			process.exit(1);
		}
	}

	/**
	 * Display current context
	 */
	private async displayContext(
		showHeader: boolean = true
	): Promise<ContextResult> {
		// Check authentication first
		const isAuthenticated = await checkAuthentication(this.authManager, {
			message:
				'The "context" command requires you to be logged in to your Hamster account.'
		});

		if (!isAuthenticated) {
			return {
				success: false,
				action: 'show',
				message: 'Not authenticated'
			};
		}

		const context = this.authManager.getContext();

		if (showHeader) {
			console.log(chalk.cyan('\n🌍 Workspace Context\n'));
		}

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
				if (context.briefName && context.briefId) {
					const shortId = context.briefId.slice(-8);
					console.log(
						chalk.white(`  ${context.briefName} `) + chalk.gray(`(${shortId})`)
					);
				} else if (context.briefName) {
					console.log(chalk.white(`  ${context.briefName}`));
				} else if (context.briefId) {
					console.log(chalk.gray(`  ID: ${context.briefId}`));
				}

				// Show brief status if available
				if (context.briefStatus) {
					const statusDisplay = getBriefStatusWithColor(context.briefStatus);
					console.log(chalk.gray(`  Status: `) + statusDisplay);
				}

				// Show brief updated date if available
				if (context.briefUpdatedAt) {
					const updatedDate = new Date(
						context.briefUpdatedAt
					).toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric',
						year: 'numeric',
						hour: '2-digit',
						minute: '2-digit'
					});
					console.log(chalk.gray(`  Updated: ${updatedDate}`));
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
	private async executeSelectOrg(orgId?: string): Promise<void> {
		try {
			// Check authentication
			if (!(await checkAuthentication(this.authManager))) {
				process.exit(1);
			}

			const result = await this.selectOrganization(orgId);
			this.setLastResult(result);

			if (!result.success) {
				process.exit(1);
			}
		} catch (error: any) {
			ui.displayError(
				`Failed to select organization: ${(error as Error).message}`
			);
			process.exit(1);
		}
	}

	/**
	 * Select an organization interactively or by ID/slug/name
	 */
	private async selectOrganization(orgId?: string): Promise<ContextResult> {
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

			let selectedOrg;

			// If orgId provided, find matching org by ID, slug or name
			const trimmedOrgId = orgId?.trim();
			if (trimmedOrgId) {
				const normalizedInput = trimmedOrgId.toLowerCase();
				selectedOrg = organizations.find(
					(org) =>
						org.id === trimmedOrgId ||
						org.slug?.toLowerCase() === normalizedInput ||
						org.name.toLowerCase() === normalizedInput
				);

				if (!selectedOrg) {
					const totalCount = organizations.length;
					const displayLimit = 5;
					const orgList = organizations
						.slice(0, displayLimit)
						.map((o) => o.name)
						.join(', ');

					let errorMessage = `Organization not found: ${trimmedOrgId}\n`;
					if (totalCount <= displayLimit) {
						errorMessage += `Available organizations: ${orgList}`;
					} else {
						errorMessage += `Available organizations (showing ${displayLimit} of ${totalCount}): ${orgList}`;
						errorMessage += `\nRun "tm context org" to see all organizations and select interactively`;
					}

					ui.displayError(errorMessage);
					return {
						success: false,
						action: 'select-org',
						message: `Organization not found: ${trimmedOrgId}`
					};
				}
			} else {
				// Interactive selection
				const response = await inquirer.prompt([
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
				selectedOrg = response.selectedOrg;
			}

			// Update context
			await this.authManager.updateContext({
				orgId: selectedOrg.id,
				orgName: selectedOrg.name,
				orgSlug: selectedOrg.slug,
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
	private async executeSelectBrief(briefIdOrUrl?: string): Promise<void> {
		try {
			// Check authentication
			if (!(await checkAuthentication(this.authManager))) {
				process.exit(1);
			}

			// If briefIdOrUrl provided, use direct selection
			if (briefIdOrUrl && briefIdOrUrl.trim().length > 0) {
				await this.selectBriefDirectly(briefIdOrUrl.trim(), 'select-brief');
				return;
			}

			// Interactive selection
			const context = this.authManager.getContext();
			if (!context?.orgId) {
				ui.displayError(
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
				action: 'select-brief',
				context: this.authManager.getContext() || undefined,
				message: result.message
			});

			if (!result.success) {
				process.exit(1);
			}
		} catch (error: any) {
			ui.displayError(`Failed to select brief: ${(error as Error).message}`);
			process.exit(1);
		}
	}

	/**
	 * Execute clear context
	 */
	private async executeClear(): Promise<void> {
		try {
			// Check authentication
			if (!(await checkAuthentication(this.authManager))) {
				process.exit(1);
			}

			const result = await this.clearContext();
			this.setLastResult(result);

			if (!result.success) {
				process.exit(1);
			}
		} catch (error: any) {
			ui.displayError(`Failed to clear context: ${(error as Error).message}`);
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
			if (!(await checkAuthentication(this.authManager))) {
				process.exit(1);
			}

			const result = await this.setContext(options);
			this.setLastResult(result);

			if (!result.success) {
				process.exit(1);
			}
		} catch (error: any) {
			ui.displayError(`Failed to set context: ${(error as Error).message}`);
			process.exit(1);
		}
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
	 * Helper method to select brief directly from input (URL or ID)
	 * Used by both executeSelectBrief and executeSetFromBriefInput
	 */
	private async selectBriefDirectly(
		input: string,
		action: 'select-brief' | 'set'
	): Promise<void> {
		await this.initTmCore();

		const result = await selectBriefFromInput(
			this.authManager,
			input,
			this.tmCore
		);

		this.setLastResult({
			success: result.success,
			action,
			context: this.authManager.getContext() || undefined,
			message: result.message
		});

		if (!result.success) {
			process.exit(1);
		}
	}

	/**
	 * Execute setting context from a brief ID or Hamster URL
	 * All parsing logic is in tm-core
	 */
	private async executeSetFromBriefInput(
		input: string,
		_showHeader: boolean = true
	): Promise<void> {
		try {
			// Check authentication
			if (!(await checkAuthentication(this.authManager))) {
				process.exit(1);
			}

			await this.selectBriefDirectly(input, 'set');
		} catch (error: any) {
			ui.displayError(
				`Failed to set context from brief: ${(error as Error).message}`
			);
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
	 * Interactive context setup (for post-auth flow)
	 * Organization selection is MANDATORY - you cannot proceed without an org.
	 * Brief selection is optional.
	 */
	async setupContextInteractive(): Promise<{
		success: boolean;
		orgSelected: boolean;
		briefSelected: boolean;
	}> {
		try {
			// Organization selection is REQUIRED - use the shared utility
			// It will auto-select if only one org, or prompt if multiple
			const orgResult = await ensureOrgSelected(this.authManager, {
				promptMessage: 'Select an organization:'
			});

			if (!orgResult.success || !orgResult.orgId) {
				// This should rarely happen (only if user has no orgs)
				return { success: false, orgSelected: false, briefSelected: false };
			}

			// Brief selection is optional - ask if they want to select one
			const { selectBrief } = await inquirer.prompt([
				{
					type: 'confirm',
					name: 'selectBrief',
					message: 'Would you like to select a brief now?',
					default: true
				}
			]);

			if (!selectBrief) {
				return { success: true, orgSelected: true, briefSelected: false };
			}

			// Select brief using shared utility
			const briefResult = await selectBriefInteractive(
				this.authManager,
				orgResult.orgId
			);
			return {
				success: true,
				orgSelected: true,
				briefSelected: briefResult.success
			};
		} catch (error) {
			console.error(
				chalk.yellow(
					'\nContext setup encountered an error. You can set it up later with "tm context"'
				)
			);
			return { success: false, orgSelected: false, briefSelected: false };
		}
	}

	/**
	 * Clean up resources
	 */
	async cleanup(): Promise<void> {
		// No resources to clean up for context command
	}

	/**
	 * Register this command on an existing program
	 */
	static register(program: Command, name?: string): ContextCommand {
		const contextCommand = new ContextCommand(name);
		program.addCommand(contextCommand);
		return contextCommand;
	}
}
