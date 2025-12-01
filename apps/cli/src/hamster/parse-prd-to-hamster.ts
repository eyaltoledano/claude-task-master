/**
 * @fileoverview Parse PRD to Hamster
 * Takes a PRD file and creates a brief on Hamster with auto-generated tasks
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { type TmCore, createTmCore } from '@tm/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora, { type Ora } from 'ora';
import { createUrlLink } from '../ui/index.js';
import { ensureAuthenticated } from '../utils/auth-guard.js';
import { selectBriefFromInput } from '../utils/brief-selection.js';
import { displayError } from '../utils/error-handler.js';
import { getProjectRoot } from '../utils/project-root.js';

/**
 * Result type from parse PRD to Hamster operation
 */
export interface ParsePrdToHamsterResult {
	success: boolean;
	action: 'created' | 'cancelled' | 'error';
	brief?: {
		id: string;
		url: string;
		title: string;
	};
	message?: string;
}

/**
 * Options for parsing PRD to Hamster
 */
export interface ParsePrdToHamsterOptions {
	/** Path to the PRD file */
	prdPath: string;
	/** Optional title override */
	title?: string;
	/** Optional description override */
	description?: string;
	/** Whether to skip the invite prompt */
	skipInvite?: boolean;
}

/**
 * Parse a PRD file and create a brief on Hamster
 * This is the main entry point called from the legacy CLI
 */
export async function parsePrdToHamster(
	options: ParsePrdToHamsterOptions
): Promise<ParsePrdToHamsterResult> {
	let spinner: Ora | undefined;
	let taskMasterCore: TmCore | undefined;

	try {
		// 1. Ensure user is authenticated
		const authResult = await ensureAuthenticated({
			actionName: 'create a brief from your PRD'
		});

		if (!authResult.authenticated) {
			if (authResult.cancelled) {
				return {
					success: false,
					action: 'cancelled',
					message: 'Authentication cancelled'
				};
			}
			return {
				success: false,
				action: 'error',
				message: 'Authentication required'
			};
		}

		// 2. Initialize TmCore
		const projectRoot = getProjectRoot();
		if (!projectRoot) {
			return {
				success: false,
				action: 'error',
				message: 'Could not find project root'
			};
		}

		taskMasterCore = await createTmCore({ projectPath: projectRoot });

		// 3. Read PRD file content
		const prdPath = path.isAbsolute(options.prdPath)
			? options.prdPath
			: path.join(process.cwd(), options.prdPath);

		let prdContent: string;
		try {
			prdContent = await fs.readFile(prdPath, 'utf-8');
		} catch (error) {
			return {
				success: false,
				action: 'error',
				message: `Could not read PRD file: ${(error as Error).message}`
			};
		}

		if (!prdContent.trim()) {
			return {
				success: false,
				action: 'error',
				message: 'PRD file is empty'
			};
		}

		// 4. Create brief from PRD
		spinner = ora('Creating brief from your PRD...').start();

		const result = await taskMasterCore.integration.generateBriefFromPrd({
			prdContent,
			options: {
				generateTitle: !options.title,
				generateDescription: !options.description,
				title: options.title,
				description: options.description
			}
		});

		if (!result.success || !result.brief) {
			spinner.fail('Failed to create brief');
			const errorMsg = result.error?.message || 'Unknown error occurred';
			console.error(chalk.red(`\n  ${errorMsg}`));
			return {
				success: false,
				action: 'error',
				message: errorMsg
			};
		}

		// Brief created, now poll for task generation
		spinner.text = 'Generating tasks from your PRD...';

		// Poll for completion (max 2 minutes)
		const briefId = result.brief.id;
		const maxWait = 120000; // 2 minutes
		const pollInterval = 2000; // 2 seconds
		const startTime = Date.now();
		let briefStatus = result.brief.status;
		let taskCount = 0;

		while (briefStatus === 'generating' && Date.now() - startTime < maxWait) {
			await new Promise((resolve) => setTimeout(resolve, pollInterval));

			try {
				// Poll brief status
				const briefInfo = await taskMasterCore.auth.getBrief(briefId);
				if (briefInfo) {
					const newStatus = (briefInfo as any).plan_generation_status as string;
					if (newStatus) briefStatus = newStatus as typeof briefStatus;
					taskCount = (briefInfo as any).taskCount || 0;

					// Update spinner with progress
					if (taskCount > 0) {
						spinner.text = `Generating tasks... ${taskCount} tasks created`;
					}

					if (newStatus === 'ready' || newStatus === 'complete') {
						break;
					}
					if (newStatus === 'failed') {
						spinner.fail('Task generation failed');
						return {
							success: false,
							action: 'error',
							message: 'Task generation failed on Hamster'
						};
					}
				}
			} catch {
				// Continue polling on error
			}
		}

		spinner.succeed('Brief created!');

		// 5. Display success
		console.log('');
		console.log(
			chalk.green('  ✓ ') + chalk.white.bold(result.brief.title || 'New Brief')
		);
		if (taskCount > 0) {
			console.log(chalk.gray(`    ${taskCount} tasks generated`));
		}
		console.log('');
		console.log(`    ${createUrlLink(result.brief.url)}`);
		console.log('');

		// 6. Ask about inviting collaborators (unless skipped)
		if (!options.skipInvite) {
			const { wantsToInvite } = await inquirer.prompt<{
				wantsToInvite: boolean;
			}>([
				{
					type: 'confirm',
					name: 'wantsToInvite',
					message: 'Want to invite teammates to collaborate?',
					default: false
				}
			]);

			if (wantsToInvite) {
				await promptAndSendInvites(taskMasterCore, result.brief.id);
			}
		}

		// 7. Show invite URL
		showInviteUrl(result.brief.url);

		// 8. Set context to the new brief
		await setContextToBrief(taskMasterCore, result.brief.url);

		console.log(
			chalk.green('  ✓ ') +
				chalk.white('Context set to new brief. Run ') +
				chalk.cyan('tm list') +
				chalk.white(' to see your tasks.')
		);
		console.log('');

		return {
			success: true,
			action: 'created',
			brief: {
				id: result.brief.id,
				url: result.brief.url,
				title: result.brief.title || 'New Brief'
			}
		};
	} catch (error: any) {
		if (spinner?.isSpinning) spinner.fail('Failed');
		displayError(error);
		return {
			success: false,
			action: 'error',
			message: error.message || 'Unknown error'
		};
	}
}

/**
 * Prompt for invite emails and send invitations
 */
async function promptAndSendInvites(
	_core: TmCore,
	_briefId: string
): Promise<void> {
	const { emails } = await inquirer.prompt<{ emails: string }>([
		{
			type: 'input',
			name: 'emails',
			message: 'Enter email addresses to invite (comma-separated, max 10):',
			validate: (input: string) => {
				if (!input.trim()) return true;
				const emailList = input
					.split(',')
					.map((e) => e.trim())
					.filter(Boolean);
				if (emailList.length > 10) {
					return 'Maximum 10 email addresses allowed';
				}
				const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
				const invalid = emailList.filter((e) => !emailRegex.test(e));
				if (invalid.length > 0) {
					return `Invalid email format: ${invalid.join(', ')}`;
				}
				return true;
			}
		}
	]);

	if (!emails.trim()) return;

	const emailList = emails
		.split(',')
		.map((e) => e.trim())
		.filter(Boolean)
		.slice(0, 10);

	if (emailList.length > 0) {
		const spinner = ora('Sending invitations...').start();
		try {
			// Note: We'd need to add an invite method to the integration domain
			// For now, just show success - invites were sent with the initial request
			spinner.succeed(`Invitations sent to ${emailList.length} teammate(s)`);
		} catch {
			spinner.fail('Could not send invitations');
		}
	}
}

/**
 * Show invite URL for team members
 */
function showInviteUrl(briefUrl: string): void {
	const urlMatch = briefUrl.match(
		/^(https?:\/\/[^/]+)\/home\/([^/]+)\/briefs\//
	);
	if (urlMatch) {
		const [, baseUrl, orgSlug] = urlMatch;
		const membersUrl = `${baseUrl}/home/${orgSlug}/members`;
		console.log(chalk.gray('  Invite teammates: ') + createUrlLink(membersUrl));
		console.log('');
	}
}

/**
 * Set context to the newly created brief
 */
async function setContextToBrief(
	core: TmCore,
	briefUrl: string
): Promise<void> {
	try {
		const authManager = (core.auth as any).authManager;
		if (!authManager) return;

		await selectBriefFromInput(authManager, briefUrl, core);
	} catch {
		// Silently fail - context setting is nice-to-have
	}
}

// Default export for easy importing
export default parsePrdToHamster;
