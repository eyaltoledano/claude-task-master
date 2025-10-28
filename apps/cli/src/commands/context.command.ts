/**
 * @fileoverview Context command for managing org/brief selection
 * Provides a clean interface for workspace context management
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import search from '@inquirer/search';
import ora, { Ora } from 'ora';
import { AuthManager, type UserContext } from '@tm/core';
import * as ui from '../utils/ui.js';
import { displayError } from '../utils/error-handler.js';

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

		// Accept optional positional argument for brief ID or Hamster URL
		this.argument('[briefOrUrl]', 'Brief ID or Hamster brief URL');

		// Default action: if an argument is provided, resolve and set context; else show
		this.action(async (briefOrUrl?: string) => {
			if (briefOrUrl && briefOrUrl.trim().length > 0) {
				await this.executeSetFromBriefInput(briefOrUrl.trim());
				return;
			}
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
			const result = await this.displayContext();
			this.setLastResult(result);
		} catch (error: any) {
			displayError(error);
		}
	}

	/**
	 * Display current context
	 */
	private async displayContext(): Promise<ContextResult> {
		// Check authentication first
		const hasSession = await this.authManager.hasValidSession();
		if (!hasSession) {
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
				if (context.briefName && context.briefId) {
					const shortId = context.briefId.slice(0, 8);
					console.log(
						chalk.white(`  ${context.briefName} `) + chalk.gray(`(${shortId})`)
					);
				} else if (context.briefName) {
					console.log(chalk.white(`  ${context.briefName}`));
				} else if (context.briefId) {
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
			const hasSession = await this.authManager.hasValidSession();
			if (!hasSession) {
				ui.displayError('Not authenticated. Run "tm auth login" first.');
				process.exit(1);
			}

			const result = await this.selectOrganization();
			this.setLastResult(result);

			if (!result.success) {
				process.exit(1);
			}
		} catch (error: any) {
			displayError(error);
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
	private async executeSelectBrief(): Promise<void> {
		try {
			// Check authentication
			const hasSession = await this.authManager.hasValidSession();
			if (!hasSession) {
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
			displayError(error);
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

			// Prompt for selection with search
			const selectedBrief = await search<(typeof briefs)[0] | null>({
				message: 'Search for a brief:',
				source: async (input) => {
					const searchTerm = input?.toLowerCase() || '';

					// Static option for no brief
					const noBriefOption = {
						name: '(No brief - organization level)',
						value: null as any,
						description: 'Clear brief selection'
					};

					// Filter and map brief options
					const briefOptions = briefs
						.filter((brief) => {
							if (!searchTerm) return true;

							const title = brief.document?.title || '';
							const shortId = brief.id.slice(0, 8);

							// Search by title first, then by UUID
							return (
								title.toLowerCase().includes(searchTerm) ||
								brief.id.toLowerCase().includes(searchTerm) ||
								shortId.toLowerCase().includes(searchTerm)
							);
						})
						.map((brief) => {
							const title =
								brief.document?.title || `Brief ${brief.id.slice(0, 8)}`;
							const shortId = brief.id.slice(0, 8);
							return {
								name: `${title} ${chalk.gray(`(${shortId})`)}`,
								value: brief
							};
						});

					return [noBriefOption, ...briefOptions];
				}
			});

			if (selectedBrief) {
				// Update context with brief
				const briefName =
					selectedBrief.document?.title ||
					`Brief ${selectedBrief.id.slice(0, 8)}`;
				await this.authManager.updateContext({
					briefId: selectedBrief.id,
					briefName: briefName
				});

				ui.displaySuccess(`Selected brief: ${briefName}`);

				return {
					success: true,
					action: 'select-brief',
					context: this.authManager.getContext() || undefined,
					message: `Selected brief: ${selectedBrief.document?.title}`
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
			const hasSession = await this.authManager.hasValidSession();
			if (!hasSession) {
				ui.displayError('Not authenticated. Run "tm auth login" first.');
				process.exit(1);
			}

			const result = await this.clearContext();
			this.setLastResult(result);

			if (!result.success) {
				process.exit(1);
			}
		} catch (error: any) {
			displayError(error);
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
			const hasSession = await this.authManager.hasValidSession();
			if (!hasSession) {
				ui.displayError('Not authenticated. Run "tm auth login" first.');
				process.exit(1);
			}

			const result = await this.setContext(options);
			this.setLastResult(result);

			if (!result.success) {
				process.exit(1);
			}
		} catch (error: any) {
			displayError(error);
		}
	}

	/**
	 * Execute setting context from a brief ID or Hamster URL
	 */
	private async executeSetFromBriefInput(briefOrUrl: string): Promise<void> {
		let spinner: Ora | undefined;
		try {
			// Check authentication
			const hasSession = await this.authManager.hasValidSession();
			if (!hasSession) {
				ui.displayError('Not authenticated. Run "tm auth login" first.');
				process.exit(1);
			}

			spinner = ora('Resolving brief...');
			spinner.start();

			// Extract brief ID
			const briefId = this.extractBriefId(briefOrUrl);
			if (!briefId) {
				spinner.fail('Could not extract a brief ID from the provided input');
				ui.displayError(
					`Provide a valid brief ID or a Hamster brief URL, e.g. https://${process.env.TM_BASE_DOMAIN || process.env.TM_PUBLIC_BASE_DOMAIN}/home/hamster/briefs/<id>`
				);
				process.exit(1);
			}

			// Fetch brief and resolve its organization
			const brief = await this.authManager.getBrief(briefId);
			if (!brief) {
				spinner.fail('Brief not found or you do not have access');
				process.exit(1);
			}

			// Fetch org to get a friendly name and slug (optional)
			let orgName: string | undefined;
			let orgSlug: string | undefined;
			try {
				const org = await this.authManager.getOrganization(brief.accountId);
				orgName = org?.name;
				orgSlug = org?.slug;
			} catch {
				// Non-fatal if org lookup fails
			}

			// Update context: set org and brief
			const briefName =
				brief.document?.title || `Brief ${brief.id.slice(0, 8)}`;
			await this.authManager.updateContext({
				orgId: brief.accountId,
				orgName,
				orgSlug,
				briefId: brief.id,
				briefName
			});

			spinner.succeed('Context set from brief');
			console.log(
				chalk.gray(
					`  Organization: ${orgName || brief.accountId}\n  Brief: ${briefName}`
				)
			);

			this.setLastResult({
				success: true,
				action: 'set',
				context: this.authManager.getContext() || undefined,
				message: 'Context set from brief'
			});
		} catch (error: any) {
			try {
				if (spinner?.isSpinning) spinner.stop();
			} catch {}
			displayError(error);
		}
	}

	/**
	 * Extract a brief ID from raw input (ID or Hamster URL)
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

		// 1) URL (absolute or scheme‑less)
		const url = parseUrl(raw);
		if (url) {
			const qId = url.searchParams.get('id') || url.searchParams.get('briefId');
			const candidate = (qId || fromParts(url.pathname)) ?? null;
			if (candidate) {
				// Light sanity check; let API be the final validator
				if (this.isLikelyId(candidate) || candidate.length >= 8)
					return candidate;
			}
		}

		// 2) Looks like a path without scheme
		if (raw.includes('/')) {
			const candidate = fromParts(raw);
			if (candidate && (this.isLikelyId(candidate) || candidate.length >= 8)) {
				return candidate;
			}
		}

		// 3) Fallback: raw token
		return raw;
	}

	/**
	 * Heuristic to check if a string looks like a brief ID (UUID-like)
	 */
	private isLikelyId(value: string): boolean {
		const uuidRegex =
			/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
		const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i; // ULID
		const slugRegex = /^[A-Za-z0-9_-]{16,}$/; // general token
		return (
			uuidRegex.test(value) || ulidRegex.test(value) || slugRegex.test(value)
		);
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
	 * Prompts user to select org and brief
	 */
	async setupContextInteractive(): Promise<{
		success: boolean;
		orgSelected: boolean;
		briefSelected: boolean;
	}> {
		try {
			// Ask if user wants to set up workspace context
			const { setupContext } = await inquirer.prompt([
				{
					type: 'confirm',
					name: 'setupContext',
					message: 'Would you like to set up your workspace context now?',
					default: true
				}
			]);

			if (!setupContext) {
				return { success: true, orgSelected: false, briefSelected: false };
			}

			// Select organization
			const orgResult = await this.selectOrganization();
			if (!orgResult.success || !orgResult.context?.orgId) {
				return { success: false, orgSelected: false, briefSelected: false };
			}

			// Select brief
			const briefResult = await this.selectBrief(orgResult.context.orgId);
			return {
				success: true,
				orgSelected: true,
				briefSelected: briefResult.success
			};
		} catch (error) {
			console.error(
				chalk.yellow(
					'\nContext setup skipped due to error. You can set it up later with "tm context"'
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
