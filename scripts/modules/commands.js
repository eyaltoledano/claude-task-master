/**
 * commands.js
 * Command-line interface for the Task Master CLI
 */

import fs from 'fs';
import path from 'path';
import boxen from 'boxen';
import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';

// Import command registry and utilities from @tm/cli
import {
	checkForUpdate,
	displayError,
	displayUpgradeNotification,
	performAutoUpdate,
	registerAllCommands,
	restartWithNewVersion,
	runInteractiveSetup
} from '@tm/cli';
import { findProjectRoot, log, readJSON } from './utils.js';

import {
	addSubtask,
	addTask,
	analyzeTaskComplexity,
	clearSubtasks,
	expandAllTasks,
	expandTask,
	findTaskById,
	migrateProject,
	moveTask,
	parsePRD,
	removeSubtask,
	removeTask,
	scopeDownTask,
	scopeUpTask,
	setResponseLanguage,
	taskExists,
	updateSubtaskById,
	updateTaskById,
	updateTasks,
	validateStrength
} from './task-manager.js';

import { moveTasksBetweenTags } from './task-manager/move-task.js';

import {
	copyTag,
	createTag,
	deleteTag,
	renameTag,
	tags,
	useTag
} from './task-manager/tag-management.js';

import {
	addDependency,
	fixDependenciesCommand,
	removeDependency,
	validateDependenciesCommand
} from './dependency-manager.js';

import { checkAndBlockIfAuthenticated, ensureOrgSelected } from '@tm/cli';
import { LOCAL_ONLY_COMMANDS } from '@tm/core';

import {
	ConfigurationError,
	getConfig,
	getDebugFlag,
	getDefaultNumTasks,
	isApiKeySet,
	isConfigFilePresent
} from './config-manager.js';

import {
	displayFormattedError,
	displayInfo,
	displaySuccess,
	displayWarning
} from './error-formatter.js';

import {
	AuthDomain,
	AuthManager,
	CUSTOM_PROVIDERS,
	createTmCore
} from '@tm/core';

import {
	COMPLEXITY_REPORT_FILE,
	TASKMASTER_DOCS_DIR,
	TASKMASTER_TASKS_FILE
} from '../../src/constants/paths.js';

import { initTaskMaster } from '../../src/task-master.js';

import {
	confirmProfilesRemove,
	confirmRemoveAllRemainingProfiles
} from '../../src/ui/confirm.js';
import {
	getInstalledProfiles,
	wouldRemovalLeaveNoProfiles
} from '../../src/utils/profiles.js';
import {
	confirmTaskOverwrite,
	displayApiKeyStatus,
	displayAvailableModels,
	displayBanner,
	displayComplexityReport,
	displayCrossTagDependencyError,
	displayCurrentTagIndicator,
	displayDependencyValidationHints,
	displayHelp,
	displayInvalidTagCombinationError,
	displayModelConfiguration,
	displaySubtaskMoveError,
	displayTaggedTasksFYI,
	getStatusWithColor,
	startLoadingIndicator,
	stopLoadingIndicator
} from './ui.js';

import { RULE_PROFILES } from '../../src/constants/profiles.js';
import {
	RULES_ACTIONS,
	RULES_SETUP_ACTION,
	isValidRulesAction
} from '../../src/constants/rules-actions.js';
import { getTaskMasterVersion } from '../../src/utils/getVersion.js';
import {
	categorizeProfileResults,
	categorizeRemovalResults,
	generateProfileRemovalSummary,
	generateProfileSummary,
	runInteractiveProfilesSetup
} from '../../src/utils/profiles.js';
import {
	convertAllRulesToProfileRules,
	getRulesProfile,
	isValidProfile,
	removeProfileRules
} from '../../src/utils/rule-transformer.js';
import { initializeProject } from '../init.js';

/**
 * Check if the user is connected to a Hamster brief
 * @returns {boolean} True if connected to Hamster (has brief context OR has API storage configured)
 */
function isConnectedToHamster() {
	try {
		const authManager = AuthManager.getInstance();
		const context = authManager.getContext();

		// Check if user has a brief context
		if (context && context.briefId) {
			return true;
		}

		// Fallback: Check if storage type is 'api' (user selected Hamster during init)
		try {
			const config = getConfig();
			if (config?.storage?.type === 'api') {
				return true;
			}
		} catch {
			// Config check failed, continue
		}

		return false;
	} catch {
		return false;
	}
}

/**
 * Prompt user about using Hamster for collaborative PRD management
 * Only shown to users who are not already connected to Hamster
 * @returns {Promise<'local'|'hamster'>} User's choice
 */
async function promptHamsterCollaboration() {
	// Skip prompt in non-interactive mode only
	if (!process.stdin.isTTY) {
		return 'local';
	}

	console.log(
		'\n' +
			chalk.bold.white(
				'Your tasks are only as good as the context behind them.'
			) +
			'\n\n' +
			chalk.dim(
				'Parse locally and tasks will be stored in a JSON file. Bring it to Hamster and your brief\nbecomes part of a living system connected to your team, your codebase and your agents.\nNow your entire team can go as fast as you can with Taskmaster.'
			) +
			'\n'
	);

	const { choice } = await inquirer.prompt([
		{
			type: 'list',
			name: 'choice',
			message: chalk.cyan('How would you like to parse your PRD?\n'),
			choices: [
				{
					name: [
						chalk.bold('Parse locally'),
						'',
						chalk.white(
							'   • Your PRD becomes a task list in a local JSON file'
						),
						chalk.white(
							'   • Great for quick prototyping and for vibing on your own'
						),
						chalk.white('   • You can always export to Hamster later'),
						''
					].join('\n'),
					value: 'local',
					short: 'Parse locally'
				},
				{
					name: [
						chalk.bold('Bring it to Hamster'),
						'',
						chalk.white(
							'   • Your PRD will become a living brief you can refine with your team'
						),
						chalk.white(
							'   • Hamster will generate tasks automatically, ready to execute in Taskmaster'
						),
						chalk.white(
							'   • Hamster will automatically analyze complexity and expand tasks as needed'
						),
						chalk.white(
							'   • Invite your teammates to collaborate on a single source of truth'
						),
						chalk.white(
							'   • AI inference handled by Hamster, no API keys needed - just a Hamster account!'
						),
						''
					].join('\n'),
					value: 'hamster',
					short: 'Bring it to Hamster'
				}
			],
			default: 'local',
			pageSize: 20
		}
	]);

	return choice;
}

/**
 * Handle parsing PRD to Hamster
 * Creates a brief from the PRD content and sets context
 * @param {string} prdPath - Path to the PRD file
 */
async function handleParsePrdToHamster(prdPath) {
	const ora = (await import('ora')).default;
	const open = (await import('open')).default;
	let spinner;
	let authSpinner;

	try {
		// Check if user is authenticated
		const authDomain = new AuthDomain();
		const isAuthenticated = await authDomain.hasValidSession();

		if (!isAuthenticated) {
			console.log('');
			console.log(chalk.yellow('🔒 Authentication Required'));
			console.log('');

			const { shouldLogin } = await inquirer.prompt([
				{
					type: 'confirm',
					name: 'shouldLogin',
					message: "You're not logged in. Log in to create a brief on Hamster?",
					default: true
				}
			]);

			if (!shouldLogin) {
				console.log(chalk.gray('\n  Cancelled.\n'));
				return;
			}

			// 10 minute timeout to allow for email confirmation during sign-up
			const AUTH_TIMEOUT_MS = 10 * 60 * 1000;
			let countdownInterval = null;

			const startCountdown = (totalMs) => {
				const startTime = Date.now();
				const endTime = startTime + totalMs;

				const updateCountdown = () => {
					const remaining = Math.max(0, endTime - Date.now());
					const mins = Math.floor(remaining / 60000);
					const secs = Math.floor((remaining % 60000) / 1000);
					const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

					if (authSpinner) {
						authSpinner.text = `Waiting for authentication... ${chalk.cyan(timeStr)} remaining`;
					}

					if (remaining <= 0 && countdownInterval) {
						clearInterval(countdownInterval);
					}
				};

				authSpinner = ora({
					text: `Waiting for authentication... ${chalk.cyan('10:00')} remaining`,
					spinner: 'dots'
				}).start();

				countdownInterval = setInterval(updateCountdown, 1000);
			};

			const stopCountdown = (success) => {
				if (countdownInterval) {
					clearInterval(countdownInterval);
					countdownInterval = null;
				}
				if (authSpinner) {
					if (success) {
						authSpinner.succeed('Authentication successful!');
					} else {
						authSpinner.fail('Authentication failed');
					}
					authSpinner = null;
				}
			};

			// Trigger OAuth flow
			try {
				await authDomain.authenticateWithOAuth({
					openBrowser: async (authUrl) => {
						await open(authUrl);
					},
					timeout: AUTH_TIMEOUT_MS,
					onAuthUrl: (authUrl) => {
						console.log(chalk.blue.bold('\n[auth] Browser Authentication\n'));
						console.log(
							chalk.white('  Opening your browser to authenticate...')
						);
						console.log(chalk.gray("  If the browser doesn't open, visit:"));
						console.log(chalk.cyan.underline(`  ${authUrl}\n`));
					},
					onWaitingForAuth: () => {
						console.log(
							chalk.dim(
								'  If you signed up, check your email to confirm your account.'
							)
						);
						console.log(
							chalk.dim(
								'  The CLI will automatically detect when you log in.\n'
							)
						);
						startCountdown(AUTH_TIMEOUT_MS);
					},
					onSuccess: () => {
						stopCountdown(true);
					},
					onError: () => {
						stopCountdown(false);
					}
				});
			} catch (authError) {
				stopCountdown(false);
				console.error(
					chalk.red(
						`\n  Authentication failed: ${authError.message || 'Unknown error'}\n`
					)
				);
				return;
			}
		}

		const authManager = AuthManager.getInstance();

		// Always prompt for organization selection for parse-prd
		// This allows users to choose which org to create the brief in
		// even if they have one already selected in context
		const orgResult = await ensureOrgSelected(authManager, {
			promptMessage: 'Select an organization to create the brief in:',
			forceSelection: true
		});
		if (!orgResult.success) {
			console.error(
				chalk.red(
					`\n  ${orgResult.message || 'Organization selection cancelled.'}\n`
				)
			);
			return;
		}

		// Read PRD file content
		const prdContent = fs.readFileSync(prdPath, 'utf-8');
		if (!prdContent.trim()) {
			console.error(chalk.red('\n  PRD file is empty.\n'));
			return;
		}

		// Initialize TmCore
		const projectRoot = findProjectRoot() || process.cwd();
		const tmCore = await createTmCore({ projectPath: projectRoot });

		// Ask about inviting collaborators BEFORE creating brief
		let inviteEmails = [];
		const { wantsToInvite } = await inquirer.prompt([
			{
				type: 'confirm',
				name: 'wantsToInvite',
				message: 'Want to invite teammates to collaborate on this brief?',
				default: false
			}
		]);

		if (wantsToInvite) {
			const { emails } = await inquirer.prompt([
				{
					type: 'input',
					name: 'emails',
					message: 'Enter email addresses to invite (comma-separated, max 10):',
					validate: (input) => {
						if (!input.trim()) return true;
						const emailList = input
							.split(',')
							.map((e) => e.trim())
							.filter(Boolean);
						if (emailList.length > 10) {
							return 'Maximum 10 email addresses allowed';
						}
						return true;
					}
				}
			]);
			inviteEmails = emails
				.split(',')
				.map((e) => e.trim())
				.filter(Boolean)
				.slice(0, 10);
		}

		// Create brief from PRD (invitations are sent separately now)
		spinner = ora('Creating brief from your PRD...').start();

		const result = await tmCore.integration.generateBriefFromPrd({
			prdContent,
			options: {
				generateTitle: true,
				generateDescription: true
			}
		});

		if (!result.success || !result.brief) {
			spinner.fail('Failed to create brief');
			const errorMsg = result.error?.message || 'Unknown error occurred';
			console.error(chalk.red(`\n  ${errorMsg}\n`));
			return;
		}

		// Brief created! Show it immediately
		spinner.succeed('Brief created!');
		console.log('');
		console.log(
			chalk.green('  ✓ ') + chalk.white.bold(result.brief.title || 'New Brief')
		);
		console.log('');
		// Create clickable URL
		const briefUrl = result.brief.url;
		// ANSI hyperlink: \x1b]8;;URL\x07TEXT\x1b]8;;\x07
		const clickableUrl = `\x1b]8;;${briefUrl}\x07${chalk.cyan.underline(briefUrl)}\x1b]8;;\x07`;
		console.log(`  ${clickableUrl}`);
		console.log('');

		// Send invitations immediately after brief creation (before polling)
		// Extract org slug from brief URL for invitations
		const urlMatch = result.brief.url.match(
			/^(https?:\/\/[^/]+)\/home\/([^/]+)\/briefs\//
		);
		const orgSlug = urlMatch ? urlMatch[2] : null;

		if (inviteEmails.length > 0 && orgSlug) {
			const inviteSpinner = ora('Sending invitations...').start();
			try {
				const inviteResult = await tmCore.integration.sendTeamInvitations(
					orgSlug,
					inviteEmails,
					'member'
				);

				if (inviteResult.success && inviteResult.invitations) {
					inviteSpinner.succeed('Invitations sent!');
					console.log('');
					console.log(chalk.cyan('  Team Invitations:'));
					for (const inv of inviteResult.invitations) {
						if (inv.status === 'sent') {
							console.log(chalk.green(`    ${inv.email}: Invitation sent`));
						} else if (inv.status === 'already_member') {
							console.log(
								chalk.gray(`    ${inv.email}: Already a team member`)
							);
						} else if (inv.status === 'failed') {
							console.log(chalk.red(`    ${inv.email}: Failed to send`));
						} else if (inv.status === 'already_invited') {
							console.log(chalk.gray(`    ${inv.email}: Already invited`));
						}
					}
					console.log('');
				} else {
					inviteSpinner.fail('Failed to send invitations');
					const errorMsg =
						inviteResult.error?.message || 'Unknown error occurred';
					console.error(chalk.red(`  ${errorMsg}`));
					console.log('');
				}
			} catch (inviteError) {
				inviteSpinner.fail('Failed to send invitations');
				console.error(chalk.red(`  ${inviteError.message}`));
				console.log('');
			}
		}

		// Now poll for task generation
		spinner = ora('Generating tasks from your PRD...').start();
		const briefId = result.brief.id;
		const maxWait = 180000; // 3 minutes
		const pollInterval = 3000; // 3 seconds between polls
		const startTime = Date.now();
		let taskCount = 0;
		let briefStatus = result.brief.status;

		// Progress calculation helper
		const calculateProgress = (prog) => {
			if (!prog) return 0;
			const phase = prog.phase || prog.currentPhase || '';
			const parentGen =
				prog.parentTasksGenerated || prog.progress?.parentTasksGenerated || 0;
			const parentProc =
				prog.parentTasksProcessed || prog.progress?.parentTasksProcessed || 0;
			const totalParent =
				prog.totalParentTasks || prog.progress?.totalParentTasks || 0;

			if (phase === 'queued') return 0;
			if (phase === 'analyzing') return 5;
			if (phase === 'generating_tasks' && totalParent > 0) {
				return 10 + Math.floor((parentGen / totalParent) * 40);
			}
			if (phase === 'processing_tasks' && totalParent > 0) {
				return 50 + Math.floor((parentProc / totalParent) * 40);
			}
			if (phase === 'generating_subtasks') return 90;
			if (phase === 'complete') return 100;
			return 0;
		};

		// Progress bar renderer
		const renderProgressBar = (percent, width = 30) => {
			const filled = Math.floor((percent / 100) * width);
			const empty = width - filled;
			return chalk.cyan('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
		};

		// Poll until status is 'ready' or 'failed' or we timeout
		const isStillGenerating = (s) =>
			s === 'generating' || s === 'pending' || s === 'pending_plan';

		while (isStillGenerating(briefStatus) && Date.now() - startTime < maxWait) {
			await new Promise((resolve) => setTimeout(resolve, pollInterval));

			try {
				const statusResult = await tmCore.integration.getBriefStatus(briefId);
				if (statusResult.success && statusResult.status) {
					const status = statusResult.status;
					briefStatus = status.status;

					// Update spinner with progress bar
					if (status.progress) {
						const prog = status.progress;
						const parentGen =
							prog.parentTasksGenerated ||
							prog.progress?.parentTasksGenerated ||
							0;
						const parentProc =
							prog.parentTasksProcessed ||
							prog.progress?.parentTasksProcessed ||
							0;
						const totalParent =
							prog.totalParentTasks || prog.progress?.totalParentTasks || 0;
						const subtaskGen =
							prog.subtasksGenerated || prog.progress?.subtasksGenerated || 0;
						taskCount = parentGen + subtaskGen;

						const percent = calculateProgress(prog);
						const progressBar = renderProgressBar(percent);
						const phase = prog.phase || prog.currentPhase || 'generating';

						let statusText = `${progressBar} ${percent}%`;
						if (phase === 'generating_tasks' && totalParent > 0) {
							statusText += ` • Generating tasks (${parentGen}/${totalParent})`;
						} else if (phase === 'processing_tasks' && totalParent > 0) {
							statusText += ` • Processing (${parentProc}/${totalParent})`;
							if (subtaskGen > 0) {
								statusText += ` • ${subtaskGen} subtasks`;
							}
						} else if (phase === 'generating_subtasks') {
							statusText += ` • ${subtaskGen} subtasks generated`;
						} else if (prog.message) {
							statusText += ` • ${prog.message}`;
						}

						spinner.text = statusText;
					}

					// Check for completion states
					if (status.status === 'ready' || status.status === 'completed') {
						break;
					}
					if (status.status === 'failed') {
						spinner.fail('Task generation failed');
						const errorMsg =
							status.error || 'Task generation failed on Hamster.';
						console.error(chalk.red(`\n  ${errorMsg}\n`));
						return;
					}
				}
			} catch {
				// Continue polling on error
			}
		}

		// Check if we timed out while still generating
		if (isStillGenerating(briefStatus)) {
			spinner.warn('Task generation is still in progress');
			console.log('');
			console.log(
				chalk.yellow('  Tasks are still being generated in the background.')
			);
			console.log(chalk.white('  Check the brief URL above for progress.'));
		} else {
			spinner.succeed(
				taskCount > 0
					? `Done! ${taskCount} tasks generated`
					: 'Task generation complete'
			);
		}
		console.log('');

		// Show invite URL for adding more teammates later (orgSlug already extracted above)
		if (orgSlug) {
			const urlParts = result.brief.url.match(/^(https?:\/\/[^/]+)/);
			const baseUrl = urlParts ? urlParts[1] : '';
			const membersUrl = `${baseUrl}/home/${orgSlug}/members`;
			const clickableMembersUrl = `\x1b]8;;${membersUrl}\x07${chalk.cyan.underline(membersUrl)}\x1b]8;;\x07`;
			console.log(
				chalk.gray('  Invite more teammates: ') + clickableMembersUrl
			);
			console.log('');
		}

		// Set context to the new brief using resolveBrief (same as tm context <url>)
		try {
			const brief = await tmCore.tasks.resolveBrief(result.brief.url);
			const briefName =
				brief.document?.title || `Brief ${brief.id.slice(0, 8)}`;

			// Get org info for complete context
			let orgName;
			try {
				const org = await authManager.getOrganization(brief.accountId);
				orgName = org?.name;
			} catch {
				// Non-fatal if org lookup fails
			}

			await authManager.updateContext({
				orgId: brief.accountId,
				orgName,
				orgSlug,
				briefId: brief.id,
				briefName,
				briefStatus: brief.status,
				briefUpdatedAt: brief.updatedAt
			});

			console.log(
				chalk.green('  ✓ ') +
					chalk.white('Context set! Run ') +
					chalk.cyan('tm list') +
					chalk.white(' to see your tasks.')
			);
		} catch (contextError) {
			// Log the actual error for debugging
			log('debug', `Context auto-set failed: ${contextError.message}`);
			console.log(
				chalk.yellow('  Could not auto-set context. Run ') +
					chalk.cyan(`tm context ${result.brief.url}`) +
					chalk.yellow(' to connect.')
			);
		}
		console.log('');
	} catch (error) {
		if (spinner?.isSpinning) spinner.fail('Failed');
		console.error(chalk.red(`\n  Error: ${error.message}\n`));
	}
}

/**
 * Helper to create aligned command entries
 */
function createCommandEntry(command, description, indent = '  ') {
	const cmdColumn = 47; // Fixed column width for commands
	const paddingNeeded = Math.max(1, cmdColumn - indent.length - command.length);
	return (
		chalk.cyan(indent + command) +
		' '.repeat(paddingNeeded) +
		chalk.gray(description)
	);
}

/**
 * Display Hamster-specific help (simplified command list)
 */
function displayHamsterHelp() {
	// Calculate box width (use 90% of terminal width, min 80, max 120)
	const terminalWidth = process.stdout.columns || 80;
	const boxWidth = Math.min(120, Math.max(80, Math.floor(terminalWidth * 0.9)));

	console.log(
		boxen(
			chalk.cyan.bold('Taskmaster CLI - Connected to Hamster\n\n') +
				chalk.white(
					'Taskmaster syncs tasks from your Hamster brief and provides a CLI\n'
				) +
				chalk.white(
					'interface to execute the plan. Commands can be used by humans or AI agents.\n\n'
				) +
				chalk.dim(
					'Tasks are managed in Hamster Studio. Changes sync automatically.\n'
				) +
				chalk.dim(
					'Use these commands to view tasks and update their status:\n\n'
				) +
				boxen('  Task Management  ', {
					padding: 0,
					borderStyle: 'round',
					borderColor: 'yellow'
				}) +
				'\n' +
				createCommandEntry('list', 'View all tasks from the brief\n') +
				createCommandEntry(
					'list <status>',
					'Filter by status (e.g., pending, done, in-progress)\n'
				) +
				createCommandEntry(
					'list all',
					'View all tasks with subtasks expanded\n'
				) +
				createCommandEntry('show <id>', 'Show detailed task/subtask info\n') +
				createCommandEntry('next', 'See the next task to work on\n') +
				createCommandEntry(
					'set-status|status <id> <status>',
					'Update task status (pending, in-progress, done)\n'
				) +
				createCommandEntry(
					'update-task <id> <prompt>',
					'Add information to a task\n'
				) +
				'\n' +
				boxen('  Authentication & Context  ', {
					padding: 0,
					borderStyle: 'round',
					borderColor: 'yellow'
				}) +
				'\n' +
				createCommandEntry('auth login', 'Log in to Hamster\n') +
				createCommandEntry('auth logout', 'Log out from Hamster\n') +
				createCommandEntry('auth refresh', 'Refresh authentication token\n') +
				createCommandEntry('auth status', 'Check authentication status\n') +
				createCommandEntry('briefs', 'View and select from your briefs\n') +
				createCommandEntry('context', 'Show current brief context\n') +
				createCommandEntry('context org', 'Switch organization\n') +
				createCommandEntry(
					'context brief <url>',
					'Switch to a different brief\n'
				) +
				'\n' +
				boxen('  Configuration  ', {
					padding: 0,
					borderStyle: 'round',
					borderColor: 'yellow'
				}) +
				'\n' +
				createCommandEntry(
					'rules --setup',
					'Configure AI IDE rules for better integration\n\n'
				) +
				boxen('  Examples  ', {
					padding: 0,
					borderStyle: 'round',
					borderColor: 'yellow'
				}) +
				'\n' +
				createCommandEntry('tm list', 'See all tasks\n', '  ').replace(
					chalk.cyan('  tm'),
					chalk.dim('  tm')
				) +
				createCommandEntry(
					'tm list done',
					'See completed tasks\n',
					'  '
				).replace(chalk.cyan('  tm'), chalk.dim('  tm')) +
				createCommandEntry(
					'tm list in-progress',
					'See tasks in progress\n',
					'  '
				).replace(chalk.cyan('  tm'), chalk.dim('  tm')) +
				createCommandEntry(
					'tm list all',
					'View with all subtasks\n',
					'  '
				).replace(chalk.cyan('  tm'), chalk.dim('  tm')) +
				createCommandEntry(
					'tm show HAM-1,HAM-2',
					'View multiple tasks\n',
					'  '
				).replace(chalk.cyan('  tm'), chalk.dim('  tm')) +
				createCommandEntry(
					'tm status HAM-1,HAM-2 in-progress',
					'Start tasks\n',
					'  '
				).replace(chalk.cyan('  tm'), chalk.dim('  tm')) +
				createCommandEntry(
					'tm status HAM-1 done',
					'Mark task complete\n',
					'  '
				).replace(chalk.cyan('  tm'), chalk.dim('  tm')) +
				createCommandEntry(
					'tm update-task HAM-1 <content>',
					'Add info/context/breadcrumbs to task\n',
					'  '
				).replace(chalk.cyan('  tm'), chalk.dim('  tm')) +
				createCommandEntry(
					'tm briefs',
					'View briefs and select one\n\n',
					'  '
				).replace(chalk.cyan('  tm'), chalk.dim('  tm')) +
				chalk.white.bold('» Need more commands?\n') +
				chalk.gray(
					'Advanced features (models, tags, PRD parsing) are managed in Hamster Studio.'
				),
			{
				padding: 1,
				margin: { top: 1 },
				borderStyle: 'round',
				borderColor: 'cyan',
				width: boxWidth
			}
		)
	);
}

/**
 * Configure and register CLI commands
 * @param {Object} program - Commander program instance
 */
function registerCommands(programInstance) {
	// Add global error handler for unknown options
	programInstance.on('option:unknown', function (unknownOption) {
		const commandName = this._name || 'unknown';
		displayFormattedError(new Error(`Unknown option '${unknownOption}'`), {
			context: `Running command: ${commandName}`,
			command: `task-master ${commandName}`,
			debug: getDebugFlag()
		});
		process.exit(1);
	});

	// Add help command alias - context-aware (Hamster vs Local)
	programInstance
		.command('help')
		.description('Show help information (Hamster-aware)')
		.action(() => {
			if (isConnectedToHamster()) {
				displayHamsterHelp();
			} else {
				programInstance.help();
			}
		});

	// Override default help to be Hamster-aware
	programInstance.configureHelp({
		helpWidth: 120,
		sortSubcommands: false
	});
	const originalHelp = programInstance.help.bind(programInstance);
	programInstance.help = function () {
		if (isConnectedToHamster()) {
			displayHamsterHelp();
		} else {
			originalHelp();
		}
	};

	// Add global command guard for local-only commands
	programInstance.hook('preAction', async (thisCommand, actionCommand) => {
		const commandName = actionCommand.name();

		// Only check if it's a local-only command
		if (LOCAL_ONLY_COMMANDS.includes(commandName)) {
			const taskMaster = initTaskMaster(actionCommand.opts());
			const isBlocked = await checkAndBlockIfAuthenticated(
				commandName,
				taskMaster.getProjectRoot()
			);
			if (isBlocked) {
				process.exit(1);
			}
		}
	});

	// parse-prd command
	programInstance
		.command('parse-prd')
		.description('Parse a PRD file and generate tasks')
		.argument('[file]', 'Path to the PRD file')
		.option(
			'-i, --input <file>',
			'Path to the PRD file (alternative to positional argument)'
		)
		.option('-o, --output <file>', 'Output file path')
		.option(
			'-n, --num-tasks <number>',
			'Number of tasks to generate',
			getDefaultNumTasks()
		)
		.option('-f, --force', 'Skip confirmation when overwriting existing tasks')
		.option(
			'--append',
			'Append new tasks to existing tasks.json instead of overwriting'
		)
		.option(
			'-r, --research',
			'Use Perplexity AI for research-backed task generation, providing more comprehensive and accurate task breakdown'
		)
		.option('--tag <tag>', 'Specify tag context for task operations')
		.action(async (file, options) => {
			// Resolve PRD path: prioritize --input option, then positional argument
			const prdPath = options.input || file;

			// Initialize TaskMaster
			let taskMaster;
			try {
				const initOptions = {
					prdPath: prdPath || true,
					tag: options.tag
				};
				// Only include tasksPath if output is explicitly specified
				if (options.output) {
					initOptions.tasksPath = options.output;
				}
				taskMaster = initTaskMaster(initOptions);
			} catch (error) {
				displayFormattedError(error, {
					context: 'Initializing Task Master for PRD parsing',
					command: 'task-master parse-prd',
					debug: getDebugFlag()
				});

				// Show usage help after error
				displayInfo(
					`${chalk.cyan('Usage:')}\n  task-master parse-prd <prd-file.txt> [options]\n\n${chalk.cyan('Options:')}\n  -i, --input <file>       Path to the PRD file\n  -o, --output <file>      Output file path\n  -n, --num-tasks <number> Number of tasks to generate\n  -f, --force              Skip confirmation\n  --append                 Append to existing tasks\n  -r, --research           Use Perplexity AI\n\n${chalk.cyan('Examples:')}\n  task-master parse-prd requirements.txt --num-tasks 15\n  task-master parse-prd --input=requirements.txt\n  task-master parse-prd requirements.txt --research`,
					'Parse PRD Help'
				);
				process.exit(1);
			}

			const numTasks = parseInt(options.numTasks, 10);
			const force = options.force || false;
			const append = options.append || false;
			const research = options.research || false;
			let useForce = force;
			const useAppend = append;

			// Resolve tag using standard pattern
			const tag = taskMaster.getCurrentTag();

			// Show current tag context
			await displayCurrentTagIndicator(tag);

			// Prompt about Hamster collaboration (only for local users)
			const collaborationChoice = await promptHamsterCollaboration();
			if (collaborationChoice === 'hamster') {
				// User chose Hamster - send PRD to Hamster for brief creation
				await handleParsePrdToHamster(taskMaster.getPrdPath());
				return;
			}

			// Helper function to check if there are existing tasks in the target tag and confirm overwrite
			async function confirmOverwriteIfNeeded() {
				// Check if there are existing tasks in the target tag
				let hasExistingTasksInTag = false;
				const tasksPath = taskMaster.getTasksPath();
				if (fs.existsSync(tasksPath)) {
					try {
						// Read the entire file to check if the tag exists
						const existingFileContent = fs.readFileSync(tasksPath, 'utf8');
						const allData = JSON.parse(existingFileContent);

						// Check if the target tag exists and has tasks
						if (
							allData[tag] &&
							Array.isArray(allData[tag].tasks) &&
							allData[tag].tasks.length > 0
						) {
							hasExistingTasksInTag = true;
						}
					} catch (error) {
						// If we can't read the file or parse it, assume no existing tasks in this tag
						hasExistingTasksInTag = false;
					}
				}

				// Only show confirmation if there are existing tasks in the target tag
				if (hasExistingTasksInTag && !useForce && !useAppend) {
					const overwrite = await confirmTaskOverwrite(tasksPath);
					if (!overwrite) {
						log('info', 'Operation cancelled.');
						return false;
					}
					// If user confirms 'y', we should set useForce = true for the parsePRD call
					// Only overwrite if not appending
					useForce = true;
				}
				return true;
			}

			try {
				if (!(await confirmOverwriteIfNeeded())) return;

				console.log(chalk.blue(`Parsing PRD file: ${taskMaster.getPrdPath()}`));
				console.log(chalk.blue(`Generating ${numTasks} tasks...`));
				if (append) {
					console.log(chalk.blue('Appending to existing tasks...'));
				}
				if (research) {
					console.log(
						chalk.blue(
							'Using Perplexity AI for research-backed task generation'
						)
					);
				}

				// Handle case where getTasksPath() returns null
				const outputPath =
					taskMaster.getTasksPath() ||
					path.join(taskMaster.getProjectRoot(), TASKMASTER_TASKS_FILE);
				await parsePRD(taskMaster.getPrdPath(), outputPath, numTasks, {
					append: useAppend,
					force: useForce,
					research: research,
					projectRoot: taskMaster.getProjectRoot(),
					tag: tag
				});
			} catch (error) {
				console.error(chalk.red(`Error parsing PRD: ${error.message}`));
				process.exit(1);
			}
		});

	// update command
	programInstance
		.command('update')
		.description(
			'Update multiple tasks with ID >= "from" based on new information or implementation changes'
		)
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			TASKMASTER_TASKS_FILE
		)
		.option(
			'--from <id>',
			'Task ID to start updating from (tasks with ID >= this value will be updated)',
			'1'
		)
		.option(
			'-p, --prompt <text>',
			'Prompt explaining the changes or new context (required)'
		)
		.option(
			'-r, --research',
			'Use Perplexity AI for research-backed task updates'
		)
		.option('--tag <tag>', 'Specify tag context for task operations')
		.action(async (options) => {
			// Initialize TaskMaster
			const taskMaster = initTaskMaster({
				tasksPath: options.file || true,
				tag: options.tag
			});

			const fromId = parseInt(options.from, 10); // Validation happens here
			const prompt = options.prompt;
			const useResearch = options.research || false;

			const tasksPath = taskMaster.getTasksPath();

			// Resolve tag using standard pattern
			const tag = taskMaster.getCurrentTag();

			// Show current tag context
			await displayCurrentTagIndicator(tag);

			// Check if there's an 'id' option which is a common mistake (instead of 'from')
			if (
				process.argv.includes('--id') ||
				process.argv.some((arg) => arg.startsWith('--id='))
			) {
				console.error(
					chalk.red('Error: The update command uses --from=<id>, not --id=<id>')
				);
				console.log(chalk.yellow('\nTo update multiple tasks:'));
				console.log(
					`  task-master update --from=${fromId} --prompt="Your prompt here"`
				);
				console.log(
					chalk.yellow(
						'\nTo update a single specific task, use the update-task command instead:'
					)
				);
				console.log(
					`  task-master update-task --id=<id> --prompt="Your prompt here"`
				);
				process.exit(1);
			}

			if (!prompt) {
				console.error(
					chalk.red(
						'Error: --prompt parameter is required. Please provide information about the changes.'
					)
				);
				process.exit(1);
			}

			console.log(
				chalk.blue(
					`Updating tasks from ID >= ${fromId} with prompt: "${prompt}"`
				)
			);

			// Only show tasks file path for local storage
			if (!isConnectedToHamster()) {
				console.log(chalk.blue(`Tasks file: ${tasksPath}`));
			}

			if (useResearch) {
				console.log(
					chalk.blue('Using Perplexity AI for research-backed task updates')
				);
			}

			// Call core updateTasks, passing context for CLI
			await updateTasks(
				taskMaster.getTasksPath(),
				fromId,
				prompt,
				useResearch,
				{ projectRoot: taskMaster.getProjectRoot(), tag } // Pass context with projectRoot and tag
			);
		});

	// update-task command
	programInstance
		.command('update-task')
		.description('Update a single specific task by ID with new information')
		.argument('[id]', 'Task ID to update (e.g., 1, 1.1, TAS-123)')
		.argument('[prompt...]', 'Update prompt - multiple words, no quotes needed')
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			TASKMASTER_TASKS_FILE
		)
		.option(
			'-i, --id <id>',
			'Task ID to update (fallback if not using positional)'
		)
		.option('-p, --prompt <text>', 'Prompt (fallback if not using positional)')
		.option(
			'-r, --research',
			'Use Perplexity AI for research-backed task updates'
		)
		.option(
			'--append',
			'Append timestamped information to task details instead of full update'
		)
		.option('--tag <tag>', 'Specify tag context for task operations')
		.action(async (idArg, promptWords, options) => {
			try {
				// Initialize TaskMaster
				const taskMaster = initTaskMaster({
					tasksPath: options.file || true,
					tag: options.tag
				});
				const tasksPath = taskMaster.getTasksPath();

				// Resolve tag using standard pattern
				const tag = taskMaster.getCurrentTag();

				// Show current tag context
				await displayCurrentTagIndicator(tag);

				// Prioritize positional arguments over options
				const taskId = idArg || options.id;
				const prompt =
					promptWords.length > 0 ? promptWords.join(' ') : options.prompt;

				// Validate required parameters
				if (!taskId) {
					console.error(chalk.red('Error: Task ID is required'));
					console.log(
						chalk.yellow(
							'Usage examples:\n' +
								'  tm update-task 1 Added implementation details\n' +
								'  tm update-task TAS-123 Fixed the auth bug\n' +
								'  tm update-task --id=23 --prompt="Update with new information"'
						)
					);
					process.exit(1);
				}

				// Parse the task ID and validate it's a number or a string like ham-123 or tas-456
				// Accept valid task IDs:
				// - positive integers (e.g. 1,2,3)
				// - strings like ham-123, ham-1, tas-456, etc
				// Disallow decimals and invalid formats
				const validId =
					/^\d+$/.test(taskId) || // plain positive integer
					/^[a-z]+-\d+$/i.test(taskId); // label-number format (e.g., ham-123)

				if (!validId) {
					console.error(
						chalk.red(
							`Error: Invalid task ID: ${taskId}. Task ID must be a positive integer or in the form "ham-123".`
						)
					);
					console.log(
						chalk.yellow(
							'Usage examples:\n' +
								'  tm update-task 1 Added implementation details\n' +
								'  tm update-task TAS-123 Fixed the auth bug'
						)
					);
					process.exit(1);
				}

				if (!prompt) {
					console.error(
						chalk.red(
							'Error: Prompt is required. Please provide information about the changes.'
						)
					);
					console.log(
						chalk.yellow(
							'Usage examples:\n' +
								'  tm update-task 1 Added implementation details\n' +
								'  tm update-task 23 "Update with new information"'
						)
					);
					process.exit(1);
				}
				const useResearch = options.research || false;

				// Validate tasks file exists
				if (!fs.existsSync(tasksPath)) {
					console.error(
						chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
					);
					if (tasksPath === TASKMASTER_TASKS_FILE) {
						console.log(
							chalk.yellow(
								'Hint: Run task-master init or task-master parse-prd to create tasks.json first'
							)
						);
					} else {
						console.log(
							chalk.yellow(
								`Hint: Check if the file path is correct: ${tasksPath}`
							)
						);
					}
					process.exit(1);
				}

				console.log(
					chalk.blue(`Updating task ${taskId} with prompt: "${prompt}"`)
				);

				// Only show tasks file path for local storage
				if (!isConnectedToHamster()) {
					console.log(chalk.blue(`Tasks file: ${tasksPath}`));
				}

				if (useResearch) {
					// Verify Perplexity API key exists if using research
					if (!isApiKeySet('perplexity')) {
						console.log(
							chalk.yellow(
								'Warning: PERPLEXITY_API_KEY environment variable is missing. Research-backed updates will not be available.'
							)
						);
						console.log(
							chalk.yellow('Falling back to Claude AI for task update.')
						);
					} else {
						console.log(
							chalk.blue('Using Perplexity AI for research-backed task update')
						);
					}
				}

				// Force append mode when connected to Hamster
				const shouldAppend = isConnectedToHamster()
					? true
					: options.append || false;

				const result = await updateTaskById(
					taskMaster.getTasksPath(),
					taskId,
					prompt,
					useResearch,
					{ projectRoot: taskMaster.getProjectRoot(), tag },
					'text',
					shouldAppend
				);

				// If the task wasn't updated (e.g., if it was already marked as done)
				if (!result) {
					console.log(
						chalk.yellow(
							'\nTask update was not completed. Review the messages above for details.'
						)
					);
				}
			} catch (error) {
				console.error(chalk.red(`Error: ${error.message}`));

				// Provide more helpful error messages for common issues
				if (
					error.message.includes('task') &&
					error.message.includes('not found')
				) {
					console.log(chalk.yellow('\nTo fix this issue:'));
					console.log(
						'  1. Run task-master list to see all available task IDs'
					);
					console.log('  2. Use a valid task ID with the --id parameter');
				} else if (error.message.includes('API key')) {
					console.log(
						chalk.yellow(
							'\nThis error is related to API keys. Check your environment variables.'
						)
					);
				}

				// Use getDebugFlag getter instead of CONFIG.debug
				if (getDebugFlag()) {
					console.error(error);
				}

				process.exit(1);
			}
		});

	// update-subtask command
	programInstance
		.command('update-subtask')
		.description(
			'Update a subtask by appending additional timestamped information'
		)
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			TASKMASTER_TASKS_FILE
		)
		.option(
			'-i, --id <id>',
			'Subtask ID to update in format "parentId.subtaskId" (required)'
		)
		.option(
			'-p, --prompt <text>',
			'Prompt explaining what information to add (required)'
		)
		.option('-r, --research', 'Use Perplexity AI for research-backed updates')
		.option('--tag <tag>', 'Specify tag context for task operations')
		.action(async (options) => {
			try {
				// Initialize TaskMaster
				const taskMaster = initTaskMaster({
					tasksPath: options.file || true,
					tag: options.tag
				});
				const tasksPath = taskMaster.getTasksPath();

				// Resolve tag using standard pattern
				const tag = taskMaster.getCurrentTag();

				// Show current tag context
				await displayCurrentTagIndicator(tag);

				// Validate required parameters
				if (!options.id) {
					console.error(chalk.red('Error: --id parameter is required'));
					console.log(
						chalk.yellow(
							'Usage example: task-master update-subtask --id=5.2 --prompt="Add more details about the API endpoint"'
						)
					);
					process.exit(1);
				}

				// Validate subtask ID format (should contain a dot)
				const subtaskId = options.id;
				if (!subtaskId.includes('.')) {
					console.error(
						chalk.red(
							`Error: Invalid subtask ID format: ${subtaskId}. Subtask ID must be in format "parentId.subtaskId"`
						)
					);
					console.log(
						chalk.yellow(
							'Usage example: task-master update-subtask --id=5.2 --prompt="Add more details about the API endpoint"'
						)
					);
					process.exit(1);
				}

				if (!options.prompt) {
					console.error(
						chalk.red(
							'Error: --prompt parameter is required. Please provide information to add to the subtask.'
						)
					);
					console.log(
						chalk.yellow(
							'Usage example: task-master update-subtask --id=5.2 --prompt="Add more details about the API endpoint"'
						)
					);
					process.exit(1);
				}

				const prompt = options.prompt;
				const useResearch = options.research || false;

				// Validate tasks file exists
				if (!fs.existsSync(tasksPath)) {
					console.error(
						chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
					);
					if (tasksPath === TASKMASTER_TASKS_FILE) {
						console.log(
							chalk.yellow(
								'Hint: Run task-master init or task-master parse-prd to create tasks.json first'
							)
						);
					} else {
						console.log(
							chalk.yellow(
								`Hint: Check if the file path is correct: ${tasksPath}`
							)
						);
					}
					process.exit(1);
				}

				console.log(
					chalk.blue(`Updating subtask ${subtaskId} with prompt: "${prompt}"`)
				);

				// Only show tasks file path for local storage
				if (!isConnectedToHamster()) {
					console.log(chalk.blue(`Tasks file: ${tasksPath}`));
				}

				if (useResearch) {
					// Verify Perplexity API key exists if using research
					if (!isApiKeySet('perplexity')) {
						console.log(
							chalk.yellow(
								'Warning: PERPLEXITY_API_KEY environment variable is missing. Research-backed updates will not be available.'
							)
						);
						console.log(
							chalk.yellow('Falling back to Claude AI for subtask update.')
						);
					} else {
						console.log(
							chalk.blue(
								'Using Perplexity AI for research-backed subtask update'
							)
						);
					}
				}

				const result = await updateSubtaskById(
					taskMaster.getTasksPath(),
					subtaskId,
					prompt,
					useResearch,
					{ projectRoot: taskMaster.getProjectRoot(), tag }
				);

				if (!result) {
					console.log(
						chalk.yellow(
							'\nSubtask update was not completed. Review the messages above for details.'
						)
					);
				}
			} catch (error) {
				console.error(chalk.red(`Error: ${error.message}`));

				// Provide more helpful error messages for common issues
				if (
					error.message.includes('subtask') &&
					error.message.includes('not found')
				) {
					console.log(chalk.yellow('\nTo fix this issue:'));
					console.log(
						'  1. Run task-master list --with-subtasks to see all available subtask IDs'
					);
					console.log(
						'  2. Use a valid subtask ID with the --id parameter in format "parentId.subtaskId"'
					);
				} else if (error.message.includes('API key')) {
					console.log(
						chalk.yellow(
							'\nThis error is related to API keys. Check your environment variables.'
						)
					);
				}

				// Use getDebugFlag getter instead of CONFIG.debug
				if (getDebugFlag()) {
					console.error(error);
				}

				process.exit(1);
			}
		});

	// scope-up command
	programInstance
		.command('scope-up')
		.description('Increase task complexity with AI assistance')
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			TASKMASTER_TASKS_FILE
		)
		.option(
			'-i, --id <ids>',
			'Comma-separated task/subtask IDs to scope up (required)'
		)
		.option(
			'-s, --strength <level>',
			'Complexity increase strength: light, regular, heavy',
			'regular'
		)
		.option(
			'-p, --prompt <text>',
			'Custom instructions for targeted scope adjustments'
		)
		.option('-r, --research', 'Use research AI for more informed adjustments')
		.option('--tag <tag>', 'Specify tag context for task operations')
		.action(async (options) => {
			try {
				// Initialize TaskMaster
				const taskMaster = initTaskMaster({
					tasksPath: options.file || true,
					tag: options.tag
				});
				const tasksPath = taskMaster.getTasksPath();
				const tag = taskMaster.getCurrentTag();

				// Show current tag context
				await displayCurrentTagIndicator(tag);

				// Validate required parameters
				if (!options.id) {
					console.error(chalk.red('Error: --id parameter is required'));
					console.log(
						chalk.yellow(
							'Usage example: task-master scope-up --id=1,2,3 --strength=regular'
						)
					);
					process.exit(1);
				}

				// Parse and validate task IDs
				const taskIds = options.id.split(',').map((id) => {
					const parsed = parseInt(id.trim(), 10);
					if (Number.isNaN(parsed) || parsed <= 0) {
						console.error(chalk.red(`Error: Invalid task ID: ${id.trim()}`));
						process.exit(1);
					}
					return parsed;
				});

				// Validate strength level
				if (!validateStrength(options.strength)) {
					console.error(
						chalk.red(
							`Error: Invalid strength level: ${options.strength}. Must be one of: light, regular, heavy`
						)
					);
					process.exit(1);
				}

				// Validate tasks file exists
				if (!fs.existsSync(tasksPath)) {
					console.error(
						chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
					);
					process.exit(1);
				}

				console.log(
					chalk.blue(
						`Scoping up ${taskIds.length} task(s): ${taskIds.join(', ')}`
					)
				);
				console.log(chalk.blue(`Strength level: ${options.strength}`));
				if (options.prompt) {
					console.log(chalk.blue(`Custom instructions: ${options.prompt}`));
				}

				const context = {
					projectRoot: taskMaster.getProjectRoot(),
					tag,
					commandName: 'scope-up',
					outputType: 'cli',
					research: options.research || false
				};

				const result = await scopeUpTask(
					tasksPath,
					taskIds,
					options.strength,
					options.prompt || null,
					context,
					'text'
				);

				console.log(
					chalk.green(
						`✅ Successfully scoped up ${result.updatedTasks.length} task(s)`
					)
				);
			} catch (error) {
				console.error(chalk.red(`Error: ${error.message}`));

				if (error.message.includes('not found')) {
					console.log(chalk.yellow('\nTo fix this issue:'));
					console.log(
						'  1. Run task-master list to see all available task IDs'
					);
					console.log('  2. Use valid task IDs with the --id parameter');
				}

				if (getDebugFlag()) {
					console.error(error);
				}

				process.exit(1);
			}
		});

	// scope-down command
	programInstance
		.command('scope-down')
		.description('Decrease task complexity with AI assistance')
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			TASKMASTER_TASKS_FILE
		)
		.option(
			'-i, --id <ids>',
			'Comma-separated task/subtask IDs to scope down (required)'
		)
		.option(
			'-s, --strength <level>',
			'Complexity decrease strength: light, regular, heavy',
			'regular'
		)
		.option(
			'-p, --prompt <text>',
			'Custom instructions for targeted scope adjustments'
		)
		.option('-r, --research', 'Use research AI for more informed adjustments')
		.option('--tag <tag>', 'Specify tag context for task operations')
		.action(async (options) => {
			try {
				// Initialize TaskMaster
				const taskMaster = initTaskMaster({
					tasksPath: options.file || true,
					tag: options.tag
				});
				const tasksPath = taskMaster.getTasksPath();
				const tag = taskMaster.getCurrentTag();

				// Show current tag context
				await displayCurrentTagIndicator(tag);

				// Validate required parameters
				if (!options.id) {
					console.error(chalk.red('Error: --id parameter is required'));
					console.log(
						chalk.yellow(
							'Usage example: task-master scope-down --id=1,2,3 --strength=regular'
						)
					);
					process.exit(1);
				}

				// Parse and validate task IDs
				const taskIds = options.id.split(',').map((id) => {
					const parsed = parseInt(id.trim(), 10);
					if (Number.isNaN(parsed) || parsed <= 0) {
						console.error(chalk.red(`Error: Invalid task ID: ${id.trim()}`));
						process.exit(1);
					}
					return parsed;
				});

				// Validate strength level
				if (!validateStrength(options.strength)) {
					console.error(
						chalk.red(
							`Error: Invalid strength level: ${options.strength}. Must be one of: light, regular, heavy`
						)
					);
					process.exit(1);
				}

				// Validate tasks file exists
				if (!fs.existsSync(tasksPath)) {
					console.error(
						chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
					);
					process.exit(1);
				}

				console.log(
					chalk.blue(
						`Scoping down ${taskIds.length} task(s): ${taskIds.join(', ')}`
					)
				);
				console.log(chalk.blue(`Strength level: ${options.strength}`));
				if (options.prompt) {
					console.log(chalk.blue(`Custom instructions: ${options.prompt}`));
				}

				const context = {
					projectRoot: taskMaster.getProjectRoot(),
					tag,
					commandName: 'scope-down',
					outputType: 'cli',
					research: options.research || false
				};

				const result = await scopeDownTask(
					tasksPath,
					taskIds,
					options.strength,
					options.prompt || null,
					context,
					'text'
				);

				console.log(
					chalk.green(
						`✅ Successfully scoped down ${result.updatedTasks.length} task(s)`
					)
				);
			} catch (error) {
				console.error(chalk.red(`Error: ${error.message}`));

				if (error.message.includes('not found')) {
					console.log(chalk.yellow('\nTo fix this issue:'));
					console.log(
						'  1. Run task-master list to see all available task IDs'
					);
					console.log('  2. Use valid task IDs with the --id parameter');
				}

				if (getDebugFlag()) {
					console.error(error);
				}

				process.exit(1);
			}
		});

	// ========================================
	// Register All Commands from @tm/cli
	// ========================================
	// Use the centralized command registry to register all CLI commands
	// This replaces individual command registrations and reduces duplication
	registerAllCommands(programInstance);

	// expand command
	programInstance
		.command('expand')
		.description('Expand a task into subtasks using AI')
		.option('-i, --id <id>', 'ID of the task to expand')
		.option(
			'-a, --all',
			'Expand all pending tasks based on complexity analysis'
		)
		.option(
			'-n, --num <number>',
			'Number of subtasks to generate (uses complexity analysis by default if available)'
		)
		.option(
			'-r, --research',
			'Enable research-backed generation (e.g., using Perplexity)',
			false
		)
		.option('-p, --prompt <text>', 'Additional context for subtask generation')
		.option('-f, --force', 'Force expansion even if subtasks exist', false) // Ensure force option exists
		.option(
			'--file <file>',
			'Path to the tasks file (relative to project root)',
			TASKMASTER_TASKS_FILE // Allow file override
		) // Allow file override
		.option(
			'-cr, --complexity-report <file>',
			'Path to the complexity report file (use this to specify the complexity report, not --file)'
			// Removed default value to allow tag-specific auto-detection
		)
		.option('--tag <tag>', 'Specify tag context for task operations')
		.action(async (options) => {
			// Initialize TaskMaster
			const initOptions = {
				tasksPath: options.file || true,
				tag: options.tag
			};

			if (options.complexityReport) {
				initOptions.complexityReportPath = options.complexityReport;
			}

			const taskMaster = initTaskMaster(initOptions);

			const tag = taskMaster.getCurrentTag();

			// Show current tag context
			await displayCurrentTagIndicator(tag);

			if (options.all) {
				// --- Handle expand --all ---
				console.log(chalk.blue('Expanding all pending tasks...'));
				// Updated call to the refactored expandAllTasks
				try {
					const result = await expandAllTasks(
						taskMaster.getTasksPath(),
						options.num, // Pass num
						options.research, // Pass research flag
						options.prompt, // Pass additional context
						options.force, // Pass force flag
						{
							projectRoot: taskMaster.getProjectRoot(),
							tag,
							complexityReportPath: taskMaster.getComplexityReportPath()
						} // Pass context with projectRoot and tag
						// outputFormat defaults to 'text' in expandAllTasks for CLI
					);
				} catch (error) {
					console.error(
						chalk.red(`Error expanding all tasks: ${error.message}`)
					);
					process.exit(1);
				}
			} else if (options.id) {
				// --- Handle expand --id <id> (Should be correct from previous refactor) ---
				if (!options.id) {
					console.error(
						chalk.red('Error: Task ID is required unless using --all.')
					);
					process.exit(1);
				}

				console.log(chalk.blue(`Expanding task ${options.id}...`));
				try {
					// Call the refactored expandTask function
					await expandTask(
						taskMaster.getTasksPath(),
						options.id,
						options.num,
						options.research,
						options.prompt,
						{
							projectRoot: taskMaster.getProjectRoot(),
							tag,
							complexityReportPath: taskMaster.getComplexityReportPath()
						}, // Pass context with projectRoot and tag
						options.force // Pass the force flag down
					);
					// expandTask logs its own success/failure for single task
				} catch (error) {
					console.error(
						chalk.red(`Error expanding task ${options.id}: ${error.message}`)
					);
					process.exit(1);
				}
			} else {
				console.error(
					chalk.red('Error: You must specify either a task ID (--id) or --all.')
				);
				programInstance.help(); // Show help
			}
		});

	// analyze-complexity command
	programInstance
		.command('analyze-complexity')
		.description(
			`Analyze tasks and generate expansion recommendations${chalk.reset('')}`
		)
		.option('-o, --output <file>', 'Output file path for the report')
		.option(
			'-m, --model <model>',
			'LLM model to use for analysis (defaults to configured model)'
		)
		.option(
			'-t, --threshold <number>',
			'Minimum complexity score to recommend expansion (1-10)',
			'5'
		)
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			TASKMASTER_TASKS_FILE
		)
		.option(
			'-r, --research',
			'Use configured research model for research-backed complexity analysis'
		)
		.option(
			'-i, --id <ids>',
			'Comma-separated list of specific task IDs to analyze (e.g., "1,3,5")'
		)
		.option('--from <id>', 'Starting task ID in a range to analyze')
		.option('--to <id>', 'Ending task ID in a range to analyze')
		.option('--tag <tag>', 'Specify tag context for task operations')
		.action(async (options) => {
			// Initialize TaskMaster
			const initOptions = {
				tasksPath: options.file || true, // Tasks file is required to analyze
				tag: options.tag
			};
			// Only include complexityReportPath if output is explicitly specified
			if (options.output) {
				initOptions.complexityReportPath = options.output;
			}

			const taskMaster = initTaskMaster(initOptions);

			const modelOverride = options.model;
			const thresholdScore = parseFloat(options.threshold);
			const useResearch = options.research || false;

			// Use the provided tag, or the current active tag, or default to 'master'
			const targetTag = taskMaster.getCurrentTag();

			// Show current tag context
			await displayCurrentTagIndicator(targetTag);

			// Use user's explicit output path if provided, otherwise use tag-aware default
			const outputPath = taskMaster.getComplexityReportPath();

			console.log(
				chalk.blue(
					`Analyzing task complexity from: ${taskMaster.getTasksPath()}`
				)
			);
			console.log(chalk.blue(`Output report will be saved to: ${outputPath}`));

			if (options.id) {
				console.log(chalk.blue(`Analyzing specific task IDs: ${options.id}`));
			} else if (options.from || options.to) {
				const fromStr = options.from ? options.from : 'first';
				const toStr = options.to ? options.to : 'last';
				console.log(
					chalk.blue(`Analyzing tasks in range: ${fromStr} to ${toStr}`)
				);
			}

			if (useResearch) {
				console.log(
					chalk.blue(
						'Using Perplexity AI for research-backed complexity analysis'
					)
				);
			}

			// Update options with tag-aware output path and context
			const updatedOptions = {
				...options,
				output: outputPath,
				tag: targetTag,
				projectRoot: taskMaster.getProjectRoot(),
				file: taskMaster.getTasksPath()
			};

			await analyzeTaskComplexity(updatedOptions);
		});

	// research command
	programInstance
		.command('research')
		.description('Perform AI-powered research queries with project context')
		.argument('[prompt]', 'Research prompt to investigate')
		.option('--file <file>', 'Path to the tasks file')
		.option(
			'-i, --id <ids>',
			'Comma-separated task/subtask IDs to include as context (e.g., "15,16.2")'
		)
		.option(
			'-f, --files <paths>',
			'Comma-separated file paths to include as context'
		)
		.option(
			'-c, --context <text>',
			'Additional custom context to include in the research prompt'
		)
		.option(
			'-t, --tree',
			'Include project file tree structure in the research context'
		)
		.option(
			'-s, --save <file>',
			'Save research results to the specified task/subtask(s)'
		)
		.option(
			'-d, --detail <level>',
			'Output detail level: low, medium, high',
			'medium'
		)
		.option(
			'--save-to <id>',
			'Automatically save research results to specified task/subtask ID (e.g., "15" or "15.2")'
		)
		.option(
			'--save-file',
			'Save research results to .taskmaster/docs/research/ directory'
		)
		.option('--tag <tag>', 'Specify tag context for task operations')
		.action(async (prompt, options) => {
			// Initialize TaskMaster
			const initOptions = {
				tasksPath: options.file || true,
				tag: options.tag
			};

			const taskMaster = initTaskMaster(initOptions);

			// Parameter validation
			if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
				console.error(
					chalk.red('Error: Research prompt is required and cannot be empty')
				);
				showResearchHelp();
				process.exit(1);
			}

			// Validate detail level
			const validDetailLevels = ['low', 'medium', 'high'];
			if (
				options.detail &&
				!validDetailLevels.includes(options.detail.toLowerCase())
			) {
				console.error(
					chalk.red(
						`Error: Detail level must be one of: ${validDetailLevels.join(', ')}`
					)
				);
				process.exit(1);
			}

			// Validate and parse task IDs if provided
			let taskIds = [];
			if (options.id) {
				try {
					taskIds = options.id.split(',').map((id) => {
						const trimmedId = id.trim();
						// Support both task IDs (e.g., "15") and subtask IDs (e.g., "15.2")
						if (!/^\d+(\.\d+)?$/.test(trimmedId)) {
							throw new Error(
								`Invalid task ID format: "${trimmedId}". Expected format: "15" or "15.2"`
							);
						}
						return trimmedId;
					});
				} catch (error) {
					console.error(chalk.red(`Error parsing task IDs: ${error.message}`));
					process.exit(1);
				}
			}

			// Validate and parse file paths if provided
			let filePaths = [];
			if (options.files) {
				try {
					filePaths = options.files.split(',').map((filePath) => {
						const trimmedPath = filePath.trim();
						if (trimmedPath.length === 0) {
							throw new Error('Empty file path provided');
						}
						return trimmedPath;
					});
				} catch (error) {
					console.error(
						chalk.red(`Error parsing file paths: ${error.message}`)
					);
					process.exit(1);
				}
			}

			// Validate save-to option if provided
			if (options.saveTo) {
				const saveToId = options.saveTo.trim();
				if (saveToId.length === 0) {
					console.error(chalk.red('Error: Save-to ID cannot be empty'));
					process.exit(1);
				}
				// Validate ID format: number or number.number
				if (!/^\d+(\.\d+)?$/.test(saveToId)) {
					console.error(
						chalk.red(
							'Error: Save-to ID must be in format "15" for task or "15.2" for subtask'
						)
					);
					process.exit(1);
				}
			}

			// Validate save option if provided (legacy file save)
			if (options.save) {
				const saveTarget = options.save.trim();
				if (saveTarget.length === 0) {
					console.error(chalk.red('Error: Save target cannot be empty'));
					process.exit(1);
				}
				// Check if it's a valid file path (basic validation)
				if (saveTarget.includes('..') || saveTarget.startsWith('/')) {
					console.error(
						chalk.red(
							'Error: Save path must be relative and cannot contain ".."'
						)
					);
					process.exit(1);
				}
			}

			const tag = taskMaster.getCurrentTag();

			// Show current tag context
			await displayCurrentTagIndicator(tag);

			// Validate tasks file exists if task IDs are specified
			if (taskIds.length > 0) {
				try {
					const tasksData = readJSON(
						taskMaster.getTasksPath(),
						taskMaster.getProjectRoot(),
						tag
					);
					if (!tasksData || !tasksData.tasks) {
						console.error(
							chalk.red(
								`Error: No valid tasks found in ${taskMaster.getTasksPath()} for tag '${tag}'`
							)
						);
						process.exit(1);
					}
				} catch (error) {
					console.error(
						chalk.red(`Error reading tasks file: ${error.message}`)
					);
					process.exit(1);
				}
			}

			// Validate file paths exist if specified
			if (filePaths.length > 0) {
				for (const filePath of filePaths) {
					const fullPath = path.isAbsolute(filePath)
						? filePath
						: path.join(taskMaster.getProjectRoot(), filePath);
					if (!fs.existsSync(fullPath)) {
						console.error(chalk.red(`Error: File not found: ${filePath}`));
						process.exit(1);
					}
				}
			}

			// Create validated parameters object
			const validatedParams = {
				prompt: prompt.trim(),
				taskIds: taskIds,
				filePaths: filePaths,
				customContext: options.context ? options.context.trim() : null,
				includeProjectTree: !!options.tree,
				saveTarget: options.save ? options.save.trim() : null,
				saveToId: options.saveTo ? options.saveTo.trim() : null,
				allowFollowUp: true, // Always allow follow-up in CLI
				detailLevel: options.detail ? options.detail.toLowerCase() : 'medium',
				tasksPath: taskMaster.getTasksPath(),
				projectRoot: taskMaster.getProjectRoot()
			};

			// Display what we're about to do
			console.log(chalk.blue(`Researching: "${validatedParams.prompt}"`));

			if (validatedParams.taskIds.length > 0) {
				console.log(
					chalk.gray(`Task context: ${validatedParams.taskIds.join(', ')}`)
				);
			}

			if (validatedParams.filePaths.length > 0) {
				console.log(
					chalk.gray(`File context: ${validatedParams.filePaths.join(', ')}`)
				);
			}

			if (validatedParams.customContext) {
				console.log(
					chalk.gray(
						`Custom context: ${validatedParams.customContext.substring(0, 50)}${validatedParams.customContext.length > 50 ? '...' : ''}`
					)
				);
			}

			if (validatedParams.includeProjectTree) {
				console.log(chalk.gray('Including project file tree'));
			}

			console.log(chalk.gray(`Detail level: ${validatedParams.detailLevel}`));

			try {
				// Import the research function
				const { performResearch } = await import('./task-manager/research.js');

				// Prepare research options
				const researchOptions = {
					taskIds: validatedParams.taskIds,
					filePaths: validatedParams.filePaths,
					customContext: validatedParams.customContext || '',
					includeProjectTree: validatedParams.includeProjectTree,
					detailLevel: validatedParams.detailLevel,
					projectRoot: validatedParams.projectRoot,
					saveToFile: !!options.saveFile,
					tag: tag
				};

				// Execute research
				const result = await performResearch(
					validatedParams.prompt,
					researchOptions,
					{
						commandName: 'research',
						outputType: 'cli',
						tag: tag
					},
					'text',
					validatedParams.allowFollowUp // Pass follow-up flag
				);

				// Auto-save to task/subtask if requested and no interactive save occurred
				if (validatedParams.saveToId && !result.interactiveSaveOccurred) {
					try {
						const isSubtask = validatedParams.saveToId.includes('.');

						// Format research content for saving
						const researchContent = `## Research Query: ${validatedParams.prompt}

**Detail Level:** ${result.detailLevel}
**Context Size:** ${result.contextSize} characters
**Timestamp:** ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}

### Results

${result.result}`;

						if (isSubtask) {
							// Save to subtask
							const { updateSubtaskById } = await import(
								'./task-manager/update-subtask-by-id.js'
							);

							await updateSubtaskById(
								validatedParams.tasksPath,
								validatedParams.saveToId,
								researchContent,
								false, // useResearch = false for simple append
								{
									commandName: 'research-save',
									outputType: 'cli',
									projectRoot: validatedParams.projectRoot,
									tag: tag
								},
								'text'
							);

							console.log(
								chalk.green(
									`✅ Research saved to subtask ${validatedParams.saveToId}`
								)
							);
						} else {
							// Save to task
							const updateTaskById = (
								await import('./task-manager/update-task-by-id.js')
							).default;

							const taskIdNum = parseInt(validatedParams.saveToId, 10);
							await updateTaskById(
								validatedParams.tasksPath,
								taskIdNum,
								researchContent,
								false, // useResearch = false for simple append
								{
									commandName: 'research-save',
									outputType: 'cli',
									projectRoot: validatedParams.projectRoot,
									tag: tag
								},
								'text',
								true // appendMode = true
							);

							console.log(
								chalk.green(
									`✅ Research saved to task ${validatedParams.saveToId}`
								)
							);
						}
					} catch (saveError) {
						console.log(
							chalk.red(`❌ Error saving to task/subtask: ${saveError.message}`)
						);
					}
				}

				// Save results to file if requested (legacy)
				if (validatedParams.saveTarget) {
					const saveContent = `# Research Query: ${validatedParams.prompt}

**Detail Level:** ${result.detailLevel}
**Context Size:** ${result.contextSize} characters
**Timestamp:** ${new Date().toISOString()}

## Results

${result.result}
`;

					fs.writeFileSync(validatedParams.saveTarget, saveContent, 'utf-8');
					console.log(
						chalk.green(`\n💾 Results saved to: ${validatedParams.saveTarget}`)
					);
				}
			} catch (error) {
				console.error(chalk.red(`\n❌ Research failed: ${error.message}`));
				process.exit(1);
			}
		});

	// clear-subtasks command
	programInstance
		.command('clear-subtasks')
		.description('Clear subtasks from specified tasks')
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			TASKMASTER_TASKS_FILE
		)
		.option(
			'-i, --id <ids>',
			'Task IDs (comma-separated) to clear subtasks from'
		)
		.option('--all', 'Clear subtasks from all tasks')
		.option('--tag <tag>', 'Specify tag context for task operations')
		.action(async (options) => {
			const taskIds = options.id;
			const all = options.all;

			// Initialize TaskMaster
			const taskMaster = initTaskMaster({
				tasksPath: options.file || true,
				tag: options.tag
			});

			const tag = taskMaster.getCurrentTag();

			// Show current tag context
			await displayCurrentTagIndicator(tag);

			if (!taskIds && !all) {
				console.error(
					chalk.red(
						'Error: Please specify task IDs with --id=<ids> or use --all to clear all tasks'
					)
				);
				process.exit(1);
			}

			if (all) {
				// If --all is specified, get all task IDs
				const data = readJSON(
					taskMaster.getTasksPath(),
					taskMaster.getProjectRoot(),
					tag
				);
				if (!data || !data.tasks) {
					console.error(chalk.red('Error: No valid tasks found'));
					process.exit(1);
				}
				const allIds = data.tasks.map((t) => t.id).join(',');
				clearSubtasks(taskMaster.getTasksPath(), allIds, {
					projectRoot: taskMaster.getProjectRoot(),
					tag
				});
			} else {
				clearSubtasks(taskMaster.getTasksPath(), taskIds, {
					projectRoot: taskMaster.getProjectRoot(),
					tag
				});
			}
		});

	// add-task command
	programInstance
		.command('add-task')
		.description('Add a new task using AI, optionally providing manual details')
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			TASKMASTER_TASKS_FILE
		)
		.option(
			'-p, --prompt <prompt>',
			'Description of the task to add (required if not using manual fields)'
		)
		.option('-t, --title <title>', 'Task title (for manual task creation)')
		.option(
			'-d, --description <description>',
			'Task description (for manual task creation)'
		)
		.option(
			'--details <details>',
			'Implementation details (for manual task creation)'
		)
		.option(
			'--dependencies <dependencies>',
			'Comma-separated list of task IDs this task depends on'
		)
		.option(
			'--priority <priority>',
			'Task priority (high, medium, low)',
			'medium'
		)
		.option(
			'-r, --research',
			'Whether to use research capabilities for task creation'
		)
		.option('--tag <tag>', 'Specify tag context for task operations')
		.action(async (options) => {
			const isManualCreation = options.title && options.description;

			// Validate that either prompt or title+description are provided
			if (!options.prompt && !isManualCreation) {
				console.error(
					chalk.red(
						'Error: Either --prompt or both --title and --description must be provided'
					)
				);
				process.exit(1);
			}

			const tasksPath = options.file || TASKMASTER_TASKS_FILE;

			if (!fs.existsSync(tasksPath)) {
				console.error(
					`❌ No tasks.json file found. Please run "task-master init" or create a tasks.json file at ${TASKMASTER_TASKS_FILE}`
				);
				process.exit(1);
			}

			// Correctly determine projectRoot
			// Initialize TaskMaster
			const taskMaster = initTaskMaster({
				tasksPath: options.file || true,
				tag: options.tag
			});

			const projectRoot = taskMaster.getProjectRoot();

			const tag = taskMaster.getCurrentTag();

			// Show current tag context
			await displayCurrentTagIndicator(tag);

			let manualTaskData = null;
			if (isManualCreation) {
				manualTaskData = {
					title: options.title,
					description: options.description,
					details: options.details || '',
					testStrategy: options.testStrategy || ''
				};
				// Restore specific logging for manual creation
				console.log(
					chalk.blue(`Creating task manually with title: "${options.title}"`)
				);
			} else {
				// Restore specific logging for AI creation
				console.log(
					chalk.blue(`Creating task with AI using prompt: "${options.prompt}"`)
				);
			}

			// Log dependencies and priority if provided (restored)
			const dependenciesArray = options.dependencies
				? options.dependencies.split(',').map((id) => id.trim())
				: [];
			if (dependenciesArray.length > 0) {
				console.log(
					chalk.blue(`Dependencies: [${dependenciesArray.join(', ')}]`)
				);
			}
			if (options.priority) {
				console.log(chalk.blue(`Priority: ${options.priority}`));
			}

			const context = {
				projectRoot,
				tag,
				commandName: 'add-task',
				outputType: 'cli'
			};

			try {
				const { newTaskId, telemetryData } = await addTask(
					taskMaster.getTasksPath(),
					options.prompt,
					dependenciesArray,
					options.priority,
					context,
					'text',
					manualTaskData,
					options.research
				);

				// addTask handles detailed CLI success logging AND telemetry display when outputFormat is 'text'
				// No need to call displayAiUsageSummary here anymore.
			} catch (error) {
				console.error(chalk.red(`Error adding task: ${error.message}`));
				if (error.details) {
					console.error(chalk.red(error.details));
				}
				process.exit(1);
			}
		});

	// add-dependency command
	programInstance
		.command('add-dependency')
		.description('Add a dependency to a task')
		.option('-i, --id <id>', 'Task ID to add dependency to')
		.option('-d, --depends-on <id>', 'Task ID that will become a dependency')
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			TASKMASTER_TASKS_FILE
		)
		.option('--tag <tag>', 'Specify tag context for task operations')
		.action(async (options) => {
			const initOptions = {
				tasksPath: options.file || true,
				tag: options.tag
			};

			// Initialize TaskMaster
			const taskMaster = initTaskMaster(initOptions);

			const taskId = options.id;
			const dependencyId = options.dependsOn;

			// Resolve tag using standard pattern
			const tag = taskMaster.getCurrentTag();

			// Show current tag context
			await displayCurrentTagIndicator(tag);

			if (!taskId || !dependencyId) {
				console.error(
					chalk.red('Error: Both --id and --depends-on are required')
				);
				process.exit(1);
			}

			// Handle subtask IDs correctly by preserving the string format for IDs containing dots
			// Only use parseInt for simple numeric IDs
			const formattedTaskId = taskId.includes('.')
				? taskId
				: parseInt(taskId, 10);
			const formattedDependencyId = dependencyId.includes('.')
				? dependencyId
				: parseInt(dependencyId, 10);

			await addDependency(
				taskMaster.getTasksPath(),
				formattedTaskId,
				formattedDependencyId,
				{
					projectRoot: taskMaster.getProjectRoot(),
					tag
				}
			);
		});

	// remove-dependency command
	programInstance
		.command('remove-dependency')
		.description('Remove a dependency from a task')
		.option('-i, --id <id>', 'Task ID to remove dependency from')
		.option('-d, --depends-on <id>', 'Task ID to remove as a dependency')
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			TASKMASTER_TASKS_FILE
		)
		.option('--tag <tag>', 'Specify tag context for task operations')
		.action(async (options) => {
			const initOptions = {
				tasksPath: options.file || true,
				tag: options.tag
			};

			// Initialize TaskMaster
			const taskMaster = initTaskMaster(initOptions);

			const taskId = options.id;
			const dependencyId = options.dependsOn;

			// Resolve tag using standard pattern
			const tag = taskMaster.getCurrentTag();

			// Show current tag context
			await displayCurrentTagIndicator(tag);

			if (!taskId || !dependencyId) {
				console.error(
					chalk.red('Error: Both --id and --depends-on are required')
				);
				process.exit(1);
			}

			// Handle subtask IDs correctly by preserving the string format for IDs containing dots
			// Only use parseInt for simple numeric IDs
			const formattedTaskId = taskId.includes('.')
				? taskId
				: parseInt(taskId, 10);
			const formattedDependencyId = dependencyId.includes('.')
				? dependencyId
				: parseInt(dependencyId, 10);

			await removeDependency(
				taskMaster.getTasksPath(),
				formattedTaskId,
				formattedDependencyId,
				{
					projectRoot: taskMaster.getProjectRoot(),
					tag
				}
			);
		});

	// validate-dependencies command
	programInstance
		.command('validate-dependencies')
		.description(
			`Identify invalid dependencies without fixing them${chalk.reset('')}`
		)
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			TASKMASTER_TASKS_FILE
		)
		.option('--tag <tag>', 'Specify tag context for task operations')
		.action(async (options) => {
			const initOptions = {
				tasksPath: options.file || true,
				tag: options.tag
			};

			// Initialize TaskMaster
			const taskMaster = initTaskMaster(initOptions);

			// Resolve tag using standard pattern
			const tag = taskMaster.getCurrentTag();

			// Show current tag context
			await displayCurrentTagIndicator(tag);

			await validateDependenciesCommand(taskMaster.getTasksPath(), {
				context: { projectRoot: taskMaster.getProjectRoot(), tag }
			});
		});

	// fix-dependencies command
	programInstance
		.command('fix-dependencies')
		.description(`Fix invalid dependencies automatically${chalk.reset('')}`)
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			TASKMASTER_TASKS_FILE
		)
		.option('--tag <tag>', 'Specify tag context for task operations')
		.action(async (options) => {
			const initOptions = {
				tasksPath: options.file || true,
				tag: options.tag
			};

			// Initialize TaskMaster
			const taskMaster = initTaskMaster(initOptions);

			// Resolve tag using standard pattern
			const tag = taskMaster.getCurrentTag();

			// Show current tag context
			await displayCurrentTagIndicator(tag);

			await fixDependenciesCommand(taskMaster.getTasksPath(), {
				context: { projectRoot: taskMaster.getProjectRoot(), tag }
			});
		});

	// complexity-report command
	programInstance
		.command('complexity-report')
		.description(`Display the complexity analysis report${chalk.reset('')}`)
		.option(
			'-f, --file <file>',
			'Path to the report file',
			COMPLEXITY_REPORT_FILE
		)
		.option('--tag <tag>', 'Specify tag context for task operations')
		.action(async (options) => {
			const initOptions = {
				tag: options.tag
			};

			if (options.file && options.file !== COMPLEXITY_REPORT_FILE) {
				initOptions.complexityReportPath = options.file;
			}

			// Initialize TaskMaster
			const taskMaster = initTaskMaster(initOptions);

			// Show current tag context
			await displayCurrentTagIndicator(taskMaster.getCurrentTag());

			await displayComplexityReport(taskMaster.getComplexityReportPath());
		});

	// add-subtask command
	programInstance
		.command('add-subtask')
		.description('Add a subtask to an existing task')
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			TASKMASTER_TASKS_FILE
		)
		.option('-p, --parent <id>', 'Parent task ID (required)')
		.option('-i, --task-id <id>', 'Existing task ID to convert to subtask')
		.option(
			'-t, --title <title>',
			'Title for the new subtask (when creating a new subtask)'
		)
		.option('-d, --description <text>', 'Description for the new subtask')
		.option('--details <text>', 'Implementation details for the new subtask')
		.option(
			'--dependencies <ids>',
			'Comma-separated list of dependency IDs for the new subtask'
		)
		.option('-s, --status <status>', 'Status for the new subtask', 'pending')
		.option('--generate', 'Regenerate task files after adding subtask')
		.option('--tag <tag>', 'Specify tag context for task operations')
		.action(async (options) => {
			// Initialize TaskMaster
			const taskMaster = initTaskMaster({
				tasksPath: options.file || true,
				tag: options.tag
			});

			const parentId = options.parent;
			const existingTaskId = options.taskId;
			const generateFiles = options.generate || false;

			// Resolve tag using standard pattern
			const tag = taskMaster.getCurrentTag();

			// Show current tag context
			await displayCurrentTagIndicator(tag);

			if (!parentId) {
				console.error(
					chalk.red(
						'Error: --parent parameter is required. Please provide a parent task ID.'
					)
				);
				showAddSubtaskHelp();
				process.exit(1);
			}

			// Parse dependencies if provided
			let dependencies = [];
			if (options.dependencies) {
				dependencies = options.dependencies.split(',').map((id) => {
					// Handle both regular IDs and dot notation
					return id.includes('.') ? id.trim() : parseInt(id.trim(), 10);
				});
			}

			try {
				if (existingTaskId) {
					// Convert existing task to subtask
					console.log(
						chalk.blue(
							`Converting task ${existingTaskId} to a subtask of ${parentId}...`
						)
					);
					await addSubtask(
						taskMaster.getTasksPath(),
						parentId,
						existingTaskId,
						null,
						generateFiles,
						{ projectRoot: taskMaster.getProjectRoot(), tag }
					);
					console.log(
						chalk.green(
							`✓ Task ${existingTaskId} successfully converted to a subtask of task ${parentId}`
						)
					);
				} else if (options.title) {
					// Create new subtask with provided data
					console.log(
						chalk.blue(`Creating new subtask for parent task ${parentId}...`)
					);

					const newSubtaskData = {
						title: options.title,
						description: options.description || '',
						details: options.details || '',
						status: options.status || 'pending',
						dependencies: dependencies
					};

					const subtask = await addSubtask(
						taskMaster.getTasksPath(),
						parentId,
						null,
						newSubtaskData,
						generateFiles,
						{ projectRoot: taskMaster.getProjectRoot(), tag }
					);
					console.log(
						chalk.green(
							`✓ New subtask ${parentId}.${subtask.id} successfully created`
						)
					);

					// Display success message and suggested next steps
					console.log(
						boxen(
							chalk.white.bold(
								`Subtask ${parentId}.${subtask.id} Added Successfully`
							) +
								'\n\n' +
								chalk.white(`Title: ${subtask.title}`) +
								'\n' +
								chalk.white(`Status: ${getStatusWithColor(subtask.status)}`) +
								'\n' +
								(dependencies.length > 0
									? chalk.white(`Dependencies: ${dependencies.join(', ')}`) +
										'\n'
									: '') +
								'\n' +
								chalk.white.bold('Next Steps:') +
								'\n' +
								chalk.cyan(
									`1. Run ${chalk.yellow(`task-master show ${parentId}`)} to see the parent task with all subtasks`
								) +
								'\n' +
								chalk.cyan(
									`2. Run ${chalk.yellow(`tm set-status ${parentId}.${subtask.id} in-progress`)} to start working on it`
								),
							{
								padding: 1,
								borderColor: 'green',
								borderStyle: 'round',
								margin: { top: 1 }
							}
						)
					);
				} else {
					console.error(
						chalk.red('Error: Either --task-id or --title must be provided.')
					);
					console.log(
						boxen(
							chalk.white.bold('Usage Examples:') +
								'\n\n' +
								chalk.white('Convert existing task to subtask:') +
								'\n' +
								chalk.yellow(
									`  task-master add-subtask --parent=5 --task-id=8`
								) +
								'\n\n' +
								chalk.white('Create new subtask:') +
								'\n' +
								chalk.yellow(
									`  task-master add-subtask --parent=5 --title="Implement login UI" --description="Create the login form"`
								) +
								'\n\n',
							{ padding: 1, borderColor: 'blue', borderStyle: 'round' }
						)
					);
					process.exit(1);
				}
			} catch (error) {
				console.error(chalk.red(`Error: ${error.message}`));
				showAddSubtaskHelp();
				process.exit(1);
			}
		})
		.on('error', function (err) {
			console.error(chalk.red(`Error: ${err.message}`));
			showAddSubtaskHelp();
			process.exit(1);
		});

	// Helper function to show add-subtask command help
	function showAddSubtaskHelp() {
		console.log(
			boxen(
				`${chalk.white.bold('Add Subtask Command Help')}\n\n${chalk.cyan('Usage:')}\n  task-master add-subtask --parent=<id> [options]\n\n${chalk.cyan('Options:')}\n  -p, --parent <id>         Parent task ID (required)\n  -i, --task-id <id>        Existing task ID to convert to subtask\n  -t, --title <title>       Title for the new subtask\n  -d, --description <text>  Description for the new subtask\n  --details <text>          Implementation details for the new subtask\n  --dependencies <ids>      Comma-separated list of dependency IDs\n  -s, --status <status>     Status for the new subtask (default: "pending")\n  -f, --file <file>         Path to the tasks file (default: "${TASKMASTER_TASKS_FILE}")\n  --generate                Regenerate task files after adding subtask\n\n${chalk.cyan('Examples:')}\n  task-master add-subtask --parent=5 --task-id=8\n  task-master add-subtask -p 5 -t "Implement login UI" -d "Create the login form" --generate`,
				{ padding: 1, borderColor: 'blue', borderStyle: 'round' }
			)
		);
	}

	// remove-subtask command
	programInstance
		.command('remove-subtask')
		.description('Remove a subtask from its parent task')
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			TASKMASTER_TASKS_FILE
		)
		.option(
			'-i, --id <id>',
			'Subtask ID(s) to remove in format "parentId.subtaskId" (can be comma-separated for multiple subtasks)'
		)
		.option(
			'-c, --convert',
			'Convert the subtask to a standalone task instead of deleting it'
		)
		.option('--generate', 'Regenerate task files after removing subtask')
		.option('--tag <tag>', 'Specify tag context for task operations')
		.action(async (options) => {
			// Initialize TaskMaster
			const taskMaster = initTaskMaster({
				tasksPath: options.file || true,
				tag: options.tag
			});

			const subtaskIds = options.id;
			const convertToTask = options.convert || false;
			const generateFiles = options.generate || false;
			const tag = taskMaster.getCurrentTag();

			if (!subtaskIds) {
				console.error(
					chalk.red(
						'Error: --id parameter is required. Please provide subtask ID(s) in format "parentId.subtaskId".'
					)
				);
				showRemoveSubtaskHelp();
				process.exit(1);
			}

			try {
				// Split by comma to support multiple subtask IDs
				const subtaskIdArray = subtaskIds.split(',').map((id) => id.trim());

				for (const subtaskId of subtaskIdArray) {
					// Validate subtask ID format
					if (!subtaskId.includes('.')) {
						console.error(
							chalk.red(
								`Error: Subtask ID "${subtaskId}" must be in format "parentId.subtaskId"`
							)
						);
						showRemoveSubtaskHelp();
						process.exit(1);
					}

					console.log(chalk.blue(`Removing subtask ${subtaskId}...`));
					if (convertToTask) {
						console.log(
							chalk.blue('The subtask will be converted to a standalone task')
						);
					}

					const result = await removeSubtask(
						taskMaster.getTasksPath(),
						subtaskId,
						convertToTask,
						generateFiles,
						{ projectRoot: taskMaster.getProjectRoot(), tag }
					);

					if (convertToTask && result) {
						// Display success message and next steps for converted task
						console.log(
							boxen(
								chalk.white.bold(
									`Subtask ${subtaskId} Converted to Task #${result.id}`
								) +
									'\n\n' +
									chalk.white(`Title: ${result.title}`) +
									'\n' +
									chalk.white(`Status: ${getStatusWithColor(result.status)}`) +
									'\n' +
									chalk.white(
										`Dependencies: ${result.dependencies.join(', ')}`
									) +
									'\n\n' +
									chalk.white.bold('Next Steps:') +
									'\n' +
									chalk.cyan(
										`1. Run ${chalk.yellow(`task-master show ${result.id}`)} to see details of the new task`
									) +
									'\n' +
									chalk.cyan(
										`2. Run ${chalk.yellow(`tm set-status ${result.id} in-progress`)} to start working on it`
									),
								{
									padding: 1,
									borderColor: 'green',
									borderStyle: 'round',
									margin: { top: 1 }
								}
							)
						);
					} else {
						// Display success message for deleted subtask
						console.log(
							boxen(
								chalk.white.bold(`Subtask ${subtaskId} Removed`) +
									'\n\n' +
									chalk.white('The subtask has been successfully deleted.'),
								{
									padding: 1,
									borderColor: 'green',
									borderStyle: 'round',
									margin: { top: 1 }
								}
							)
						);
					}
				}
			} catch (error) {
				console.error(chalk.red(`Error: ${error.message}`));
				showRemoveSubtaskHelp();
				process.exit(1);
			}
		})
		.on('error', function (err) {
			console.error(chalk.red(`Error: ${err.message}`));
			showRemoveSubtaskHelp();
			process.exit(1);
		});

	// Helper function to show remove-subtask command help
	function showRemoveSubtaskHelp() {
		console.log(
			boxen(
				chalk.white.bold('Remove Subtask Command Help') +
					'\n\n' +
					chalk.cyan('Usage:') +
					'\n' +
					`  task-master remove-subtask --id=<parentId.subtaskId> [options]\n\n` +
					chalk.cyan('Options:') +
					'\n' +
					'  -i, --id <id>       Subtask ID(s) to remove in format "parentId.subtaskId" (can be comma-separated, required)\n' +
					'  -c, --convert       Convert the subtask to a standalone task instead of deleting it\n' +
					'  -f, --file <file>   Path to the tasks file (default: "' +
					TASKMASTER_TASKS_FILE +
					'")\n' +
					'  --skip-generate     Skip regenerating task files\n\n' +
					chalk.cyan('Examples:') +
					'\n' +
					'  task-master remove-subtask --id=5.2\n' +
					'  task-master remove-subtask --id=5.2,6.3,7.1\n' +
					'  task-master remove-subtask --id=5.2 --convert',
				{ padding: 1, borderColor: 'blue', borderStyle: 'round' }
			)
		);
	}

	// Helper function to show tags command help
	function showTagsHelp() {
		console.log(
			boxen(
				chalk.white.bold('Tags Command Help') +
					'\n\n' +
					chalk.cyan('Usage:') +
					'\n' +
					`  task-master tags [options]\n\n` +
					chalk.cyan('Options:') +
					'\n' +
					'  -f, --file <file>   Path to the tasks file (default: "' +
					TASKMASTER_TASKS_FILE +
					'")\n' +
					'  --show-metadata     Show detailed metadata for each tag\n\n' +
					chalk.cyan('Examples:') +
					'\n' +
					'  task-master tags\n' +
					'  task-master tags --show-metadata\n\n' +
					chalk.cyan('Related Commands:') +
					'\n' +
					'  task-master add-tag <name>      Create a new tag\n' +
					'  task-master use-tag <name>      Switch to a tag\n' +
					'  task-master delete-tag <name>   Delete a tag',
				{ padding: 1, borderColor: 'blue', borderStyle: 'round' }
			)
		);
	}

	// Helper function to show add-tag command help
	function showAddTagHelp() {
		console.log(
			boxen(
				chalk.white.bold('Add Tag Command Help') +
					'\n\n' +
					chalk.cyan('Usage:') +
					'\n' +
					`  task-master add-tag <tagName> [options]\n\n` +
					chalk.cyan('Options:') +
					'\n' +
					'  -f, --file <file>        Path to the tasks file (default: "' +
					TASKMASTER_TASKS_FILE +
					'")\n' +
					'  --copy-from-current      Copy tasks from the current tag to the new tag\n' +
					'  --copy-from <tag>        Copy tasks from the specified tag to the new tag\n' +
					'  -d, --description <text> Optional description for the tag\n\n' +
					chalk.cyan('Examples:') +
					'\n' +
					'  task-master add-tag feature-xyz\n' +
					'  task-master add-tag feature-xyz --copy-from-current\n' +
					'  task-master add-tag feature-xyz --copy-from master\n' +
					'  task-master add-tag feature-xyz -d "Feature XYZ development"',
				{ padding: 1, borderColor: 'blue', borderStyle: 'round' }
			)
		);
	}

	// Helper function to show delete-tag command help
	function showDeleteTagHelp() {
		console.log(
			boxen(
				chalk.white.bold('Delete Tag Command Help') +
					'\n\n' +
					chalk.cyan('Usage:') +
					'\n' +
					`  task-master delete-tag <tagName> [options]\n\n` +
					chalk.cyan('Options:') +
					'\n' +
					'  -f, --file <file>   Path to the tasks file (default: "' +
					TASKMASTER_TASKS_FILE +
					'")\n' +
					'  -y, --yes           Skip confirmation prompts\n\n' +
					chalk.cyan('Examples:') +
					'\n' +
					'  task-master delete-tag feature-xyz\n' +
					'  task-master delete-tag feature-xyz --yes\n\n' +
					chalk.yellow('Warning:') +
					'\n' +
					'  This will permanently delete the tag and all its tasks!',
				{ padding: 1, borderColor: 'blue', borderStyle: 'round' }
			)
		);
	}

	// Helper function to show use-tag command help
	function showUseTagHelp() {
		console.log(
			boxen(
				chalk.white.bold('Use Tag Command Help') +
					'\n\n' +
					chalk.cyan('Usage:') +
					'\n' +
					`  task-master use-tag <tagName> [options]\n\n` +
					chalk.cyan('Options:') +
					'\n' +
					'  -f, --file <file>   Path to the tasks file (default: "' +
					TASKMASTER_TASKS_FILE +
					'")\n\n' +
					chalk.cyan('Examples:') +
					'\n' +
					'  task-master use-tag feature-xyz\n' +
					'  task-master use-tag master\n\n' +
					chalk.cyan('Related Commands:') +
					'\n' +
					'  task-master tags                 List all available tags\n' +
					'  task-master add-tag <name>       Create a new tag',
				{ padding: 1, borderColor: 'blue', borderStyle: 'round' }
			)
		);
	}

	// Helper function to show research command help
	function showResearchHelp() {
		console.log(
			boxen(
				chalk.white.bold('Research Command Help') +
					'\n\n' +
					chalk.cyan('Usage:') +
					'\n' +
					`  task-master research "<query>" [options]\n\n` +
					chalk.cyan('Required:') +
					'\n' +
					'  <query>             Research question or prompt (required)\n\n' +
					chalk.cyan('Context Options:') +
					'\n' +
					'  -i, --id <ids>      Comma-separated task/subtask IDs for context (e.g., "15,23.2")\n' +
					'  -f, --files <paths> Comma-separated file paths for context\n' +
					'  -c, --context <text> Additional custom context text\n' +
					'  --tree              Include project file tree structure\n\n' +
					chalk.cyan('Output Options:') +
					'\n' +
					'  -d, --detail <level> Detail level: low, medium, high (default: medium)\n' +
					'  --save-to <id>      Auto-save results to task/subtask ID (e.g., "15" or "15.2")\n' +
					'  --tag <tag>         Specify tag context for task operations\n\n' +
					chalk.cyan('Examples:') +
					'\n' +
					'  task-master research "How should I implement user authentication?"\n' +
					'  task-master research "What\'s the best approach?" --id=15,23.2\n' +
					'  task-master research "How does auth work?" --files=src/auth.js --tree\n' +
					'  task-master research "Implementation steps?" --save-to=15.2 --detail=high',
				{ padding: 1, borderColor: 'blue', borderStyle: 'round' }
			)
		);
	}

	// remove-task command
	programInstance
		.command('remove-task')
		.description('Remove one or more tasks or subtasks permanently')
		.option(
			'-i, --id <ids>',
			'ID(s) of the task(s) or subtask(s) to remove (e.g., "5", "5.2", or "5,6.1,7")'
		)
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			TASKMASTER_TASKS_FILE
		)
		.option('-y, --yes', 'Skip confirmation prompt', false)
		.option('--tag <tag>', 'Specify tag context for task operations')
		.action(async (options) => {
			// Initialize TaskMaster
			const taskMaster = initTaskMaster({
				tasksPath: options.file || true,
				tag: options.tag
			});

			const taskIdsString = options.id;

			// Resolve tag using standard pattern
			const tag = taskMaster.getCurrentTag();

			// Show current tag context
			await displayCurrentTagIndicator(tag);

			if (!taskIdsString) {
				console.error(chalk.red('Error: Task ID(s) are required'));
				console.error(
					chalk.yellow(
						'Usage: task-master remove-task --id=<taskId1,taskId2...>'
					)
				);
				process.exit(1);
			}

			const taskIdsToRemove = taskIdsString
				.split(',')
				.map((id) => id.trim())
				.filter(Boolean);

			if (taskIdsToRemove.length === 0) {
				console.error(chalk.red('Error: No valid task IDs provided.'));
				process.exit(1);
			}

			try {
				// Read data once for checks and confirmation
				const tasksPath = taskMaster.getTasksPath();
				const data = readJSON(tasksPath, taskMaster.getProjectRoot(), tag);
				if (!data || !data.tasks) {
					console.error(
						chalk.red(`Error: No valid tasks found in ${tasksPath}`)
					);
					process.exit(1);
				}

				const existingTasksToRemove = [];
				const nonExistentIds = [];
				let totalSubtasksToDelete = 0;
				const dependentTaskMessages = [];

				for (const taskId of taskIdsToRemove) {
					if (!taskExists(data.tasks, taskId)) {
						nonExistentIds.push(taskId);
					} else {
						// Correctly extract the task object from the result of findTaskById
						const findResult = findTaskById(data.tasks, taskId);
						const taskObject = findResult.task; // Get the actual task/subtask object

						if (taskObject) {
							existingTasksToRemove.push({ id: taskId, task: taskObject }); // Push the actual task object

							// If it's a main task, count its subtasks and check dependents
							if (!taskObject.isSubtask) {
								// Check the actual task object
								if (taskObject.subtasks && taskObject.subtasks.length > 0) {
									totalSubtasksToDelete += taskObject.subtasks.length;
								}
								const dependentTasks = data.tasks.filter(
									(t) =>
										t.dependencies &&
										t.dependencies.includes(parseInt(taskId, 10))
								);
								if (dependentTasks.length > 0) {
									dependentTaskMessages.push(
										`  - Task ${taskId}: ${dependentTasks.length} dependent tasks (${dependentTasks.map((t) => t.id).join(', ')})`
									);
								}
							}
						} else {
							// Handle case where findTaskById returned null for the task property (should be rare)
							nonExistentIds.push(`${taskId} (error finding details)`);
						}
					}
				}

				if (nonExistentIds.length > 0) {
					console.warn(
						chalk.yellow(
							`Warning: The following task IDs were not found: ${nonExistentIds.join(', ')}`
						)
					);
				}

				if (existingTasksToRemove.length === 0) {
					console.log(chalk.blue('No existing tasks found to remove.'));
					process.exit(0);
				}

				// Skip confirmation if --yes flag is provided
				if (!options.yes) {
					console.log();
					console.log(
						chalk.red.bold(
							`⚠️ WARNING: This will permanently delete the following ${existingTasksToRemove.length} item(s):`
						)
					);
					console.log();

					existingTasksToRemove.forEach(({ id, task }) => {
						if (!task) return; // Should not happen due to taskExists check, but safeguard
						if (task.isSubtask) {
							// Subtask - title is directly on the task object
							console.log(
								chalk.white(`  Subtask ${id}: ${task.title || '(no title)'}`)
							);
							// Optionally show parent context if available
							if (task.parentTask) {
								console.log(
									chalk.gray(
										`    (Parent: ${task.parentTask.id} - ${task.parentTask.title || '(no title)'})`
									)
								);
							}
						} else {
							// Main task - title is directly on the task object
							console.log(
								chalk.white.bold(`  Task ${id}: ${task.title || '(no title)'}`)
							);
						}
					});

					if (totalSubtasksToDelete > 0) {
						console.log(
							chalk.yellow(
								`⚠️ This will also delete ${totalSubtasksToDelete} subtasks associated with the selected main tasks!`
							)
						);
					}

					if (dependentTaskMessages.length > 0) {
						console.log(
							chalk.yellow(
								'⚠️ Warning: Dependencies on the following tasks will be removed:'
							)
						);
						dependentTaskMessages.forEach((msg) =>
							console.log(chalk.yellow(msg))
						);
					}

					console.log();

					const { confirm } = await inquirer.prompt([
						{
							type: 'confirm',
							name: 'confirm',
							message: chalk.red.bold(
								`Are you sure you want to permanently delete these ${existingTasksToRemove.length} item(s)?`
							),
							default: false
						}
					]);

					if (!confirm) {
						console.log(chalk.blue('Task deletion cancelled.'));
						process.exit(0);
					}
				}

				const indicator = startLoadingIndicator(
					`Removing ${existingTasksToRemove.length} task(s)/subtask(s)...`
				);

				// Use the string of existing IDs for the core function
				const existingIdsString = existingTasksToRemove
					.map(({ id }) => id)
					.join(',');
				const result = await removeTask(
					taskMaster.getTasksPath(),
					existingIdsString,
					{
						projectRoot: taskMaster.getProjectRoot(),
						tag
					}
				);

				stopLoadingIndicator(indicator);

				if (result.success) {
					console.log(
						boxen(
							chalk.green(
								`Successfully removed ${result.removedTasks.length} task(s)/subtask(s).`
							) +
								(result.message ? `\n\nDetails:\n${result.message}` : '') +
								(result.error
									? `\n\nWarnings:\n${chalk.yellow(result.error)}`
									: ''),
							{ padding: 1, borderColor: 'green', borderStyle: 'round' }
						)
					);
				} else {
					console.error(
						boxen(
							chalk.red(
								`Operation completed with errors. Removed ${result.removedTasks.length} task(s)/subtask(s).`
							) +
								(result.message ? `\n\nDetails:\n${result.message}` : '') +
								(result.error ? `\n\nErrors:\n${chalk.red(result.error)}` : ''),
							{
								padding: 1,
								borderColor: 'red',
								borderStyle: 'round'
							}
						)
					);
					process.exit(1); // Exit with error code if any part failed
				}

				// Log any initially non-existent IDs again for clarity
				if (nonExistentIds.length > 0) {
					console.warn(
						chalk.yellow(
							`Note: The following IDs were not found initially and were skipped: ${nonExistentIds.join(', ')}`
						)
					);

					// Exit with error if any removals failed
					if (result.removedTasks.length === 0) {
						process.exit(1);
					}
				}
			} catch (error) {
				console.error(
					chalk.red(`Error: ${error.message || 'An unknown error occurred'}`)
				);
				process.exit(1);
			}
		});

	// init command (Directly calls the implementation from init.js)
	programInstance
		.command('init')
		.description('Initialize a new project with Task Master structure')
		.option('-y, --yes', 'Skip prompts and use default values')
		.option('-n, --name <name>', 'Project name')
		.option('-d, --description <description>', 'Project description')
		.option('-v, --version <version>', 'Project version', '0.1.0') // Set default here
		.option('-a, --author <author>', 'Author name')
		.option(
			'-r, --rules <rules...>',
			'List of rules to add (roo, windsurf, cursor, ...). Accepts comma or space separated values.'
		)
		.option('--skip-install', 'Skip installing dependencies')
		.option('--dry-run', 'Show what would be done without making changes')
		.option('--aliases', 'Add shell aliases (tm, taskmaster, hamster, ham)')
		.option('--no-aliases', 'Skip shell aliases (tm, taskmaster, hamster, ham)')
		.option('--git', 'Initialize Git repository')
		.option('--no-git', 'Skip Git repository initialization')
		.option('--git-tasks', 'Store tasks in Git')
		.option('--no-git-tasks', 'No Git storage of tasks')
		.action(async (cmdOptions) => {
			// cmdOptions contains parsed arguments
			// Parse rules: accept space or comma separated, default to all available rules
			let selectedProfiles = RULE_PROFILES;
			let rulesExplicitlyProvided = false;

			if (cmdOptions.rules && Array.isArray(cmdOptions.rules)) {
				const userSpecifiedProfiles = cmdOptions.rules
					.flatMap((r) => r.split(','))
					.map((r) => r.trim())
					.filter(Boolean);
				// Only override defaults if user specified valid rules
				if (userSpecifiedProfiles.length > 0) {
					selectedProfiles = userSpecifiedProfiles;
					rulesExplicitlyProvided = true;
				}
			}

			cmdOptions.rules = selectedProfiles;
			cmdOptions.rulesExplicitlyProvided = rulesExplicitlyProvided;

			try {
				// Directly call the initializeProject function, passing the parsed options
				await initializeProject(cmdOptions);
				// initializeProject handles its own flow, including potential process.exit()
			} catch (error) {
				console.error(
					chalk.red(`Error during initialization: ${error.message}`)
				);
				process.exit(1);
			}
		});

	// models command
	programInstance
		.command('models')
		.description('Manage AI model configurations')
		.option(
			'--set-main <model_id>',
			'Set the primary model for task generation/updates'
		)
		.option(
			'--set-research <model_id>',
			'Set the model for research-backed operations'
		)
		.option(
			'--set-fallback <model_id>',
			'Set the model to use if the primary fails'
		)
		.option('--setup', 'Run interactive setup to configure models')
		.option(
			'--openrouter',
			'Allow setting a custom OpenRouter model ID (use with --set-*) '
		)
		.option(
			'--ollama',
			'Allow setting a custom Ollama model ID (use with --set-*) '
		)
		.option(
			'--bedrock',
			'Allow setting a custom Bedrock model ID (use with --set-*) '
		)
		.option(
			'--claude-code',
			'Allow setting a Claude Code model ID (use with --set-*)'
		)
		.option(
			'--azure',
			'Allow setting a custom Azure OpenAI model ID (use with --set-*) '
		)
		.option(
			'--vertex',
			'Allow setting a custom Vertex AI model ID (use with --set-*) '
		)
		.option(
			'--gemini-cli',
			'Allow setting a Gemini CLI model ID (use with --set-*)'
		)
		.option(
			'--codex-cli',
			'Allow setting a Codex CLI model ID (use with --set-*)'
		)
		.option(
			'--lmstudio',
			'Allow setting a custom LM Studio model ID (use with --set-*)'
		)
		.option(
			'--openai-compatible',
			'Allow setting a custom OpenAI-compatible model ID (use with --set-*)'
		)
		.option(
			'--baseURL <url>',
			'Custom base URL for openai-compatible, lmstudio, or ollama providers (e.g., http://localhost:8000/v1)'
		)
		.addHelpText(
			'after',
			`
Examples:
  $ task-master models                              # View current configuration
  $ task-master models --set-main gpt-4o             # Set main model (provider inferred)
  $ task-master models --set-research sonar-pro       # Set research model
  $ task-master models --set-fallback claude-3-5-sonnet-20241022 # Set fallback
  $ task-master models --set-main my-custom-model --ollama  # Set custom Ollama model for main role
  $ task-master models --set-main anthropic.claude-3-sonnet-20240229-v1:0 --bedrock # Set custom Bedrock model for main role
  $ task-master models --set-main some/other-model --openrouter # Set custom OpenRouter model for main role
  $ task-master models --set-main sonnet --claude-code           # Set Claude Code model for main role
  $ task-master models --set-main gpt-4o --azure # Set custom Azure OpenAI model for main role
  $ task-master models --set-main claude-3-5-sonnet@20241022 --vertex # Set custom Vertex AI model for main role
  $ task-master models --set-main gemini-2.5-pro --gemini-cli # Set Gemini CLI model for main role
  $ task-master models --set-main gpt-5-codex --codex-cli     # Set Codex CLI model for main role
  $ task-master models --set-main qwen3-vl-4b --lmstudio      # Set LM Studio model for main role (defaults to http://localhost:1234/v1)
  $ task-master models --set-main qwen3-vl-4b --lmstudio --baseURL http://localhost:8000/v1 # Set LM Studio model with custom base URL
  $ task-master models --set-main my-model --openai-compatible --baseURL http://localhost:8000/v1 # Set custom OpenAI-compatible model with custom endpoint
  $ task-master models --setup                            # Run interactive setup`
		)
		.action(async (options) => {
			// Initialize TaskMaster
			const taskMaster = initTaskMaster({
				tasksPath: options.file || false
			});

			const projectRoot = taskMaster.getProjectRoot();

			// Validate flags: cannot use multiple provider flags simultaneously
			const providerFlags = [
				options.openrouter,
				options.ollama,
				options.bedrock,
				options.claudeCode,
				options.geminiCli,
				options.codexCli,
				options.lmstudio,
				options.openaiCompatible
			].filter(Boolean).length;
			if (providerFlags > 1) {
				console.error(
					chalk.red(
						'Error: Cannot use multiple provider flags (--openrouter, --ollama, --bedrock, --claude-code, --gemini-cli, --codex-cli, --lmstudio, --openai-compatible) simultaneously.'
					)
				);
				process.exit(1);
			}

			// Determine the primary action based on flags
			const isSetup = options.setup;
			const isSetOperation =
				options.setMain || options.setResearch || options.setFallback;

			// --- Execute Action ---

			if (isSetup) {
				// Action 1: Run Interactive Setup
				console.log(chalk.blue('Starting interactive model setup...')); // Added feedback
				try {
					await runInteractiveSetup(taskMaster.getProjectRoot());
					// runInteractiveSetup logs its own completion/error messages
				} catch (setupError) {
					console.error(
						chalk.red('\\nInteractive setup failed unexpectedly:'),
						setupError.message
					);
				}
				// --- IMPORTANT: Exit after setup ---
				return; // Stop execution here
			}

			if (isSetOperation) {
				// Action 2: Perform Direct Set Operations
				let updateOccurred = false; // Track if any update actually happened

				if (options.setMain) {
					const result = await setModel('main', options.setMain, {
						projectRoot,
						providerHint: options.openrouter
							? 'openrouter'
							: options.ollama
								? 'ollama'
								: options.bedrock
									? 'bedrock'
									: options.claudeCode
										? 'claude-code'
										: options.geminiCli
											? 'gemini-cli'
											: options.codexCli
												? 'codex-cli'
												: options.lmstudio
													? 'lmstudio'
													: options.openaiCompatible
														? 'openai-compatible'
														: undefined,
						baseURL: options.baseURL
					});
					if (result.success) {
						console.log(chalk.green(`✅ ${result.data.message}`));
						if (result.data.warning)
							console.log(chalk.yellow(result.data.warning));
						updateOccurred = true;
					} else {
						console.error(
							chalk.red(`❌ Error setting main model: ${result.error.message}`)
						);
					}
				}
				if (options.setResearch) {
					const result = await setModel('research', options.setResearch, {
						projectRoot,
						providerHint: options.openrouter
							? 'openrouter'
							: options.ollama
								? 'ollama'
								: options.bedrock
									? 'bedrock'
									: options.claudeCode
										? 'claude-code'
										: options.geminiCli
											? 'gemini-cli'
											: options.codexCli
												? 'codex-cli'
												: options.lmstudio
													? 'lmstudio'
													: options.openaiCompatible
														? 'openai-compatible'
														: undefined,
						baseURL: options.baseURL
					});
					if (result.success) {
						console.log(chalk.green(`✅ ${result.data.message}`));
						if (result.data.warning)
							console.log(chalk.yellow(result.data.warning));
						updateOccurred = true;
					} else {
						console.error(
							chalk.red(
								`❌ Error setting research model: ${result.error.message}`
							)
						);
					}
				}
				if (options.setFallback) {
					const result = await setModel('fallback', options.setFallback, {
						projectRoot,
						providerHint: options.openrouter
							? 'openrouter'
							: options.ollama
								? 'ollama'
								: options.bedrock
									? 'bedrock'
									: options.claudeCode
										? 'claude-code'
										: options.geminiCli
											? 'gemini-cli'
											: options.codexCli
												? 'codex-cli'
												: options.lmstudio
													? 'lmstudio'
													: options.openaiCompatible
														? 'openai-compatible'
														: undefined,
						baseURL: options.baseURL
					});
					if (result.success) {
						console.log(chalk.green(`✅ ${result.data.message}`));
						if (result.data.warning)
							console.log(chalk.yellow(result.data.warning));
						updateOccurred = true;
					} else {
						console.error(
							chalk.red(
								`❌ Error setting fallback model: ${result.error.message}`
							)
						);
					}
				}

				// Optional: Add a final confirmation if any update occurred
				if (updateOccurred) {
					console.log(chalk.blue('\nModel configuration updated.'));
				} else {
					console.log(
						chalk.yellow(
							'\nNo model configuration changes were made (or errors occurred).'
						)
					);
				}

				// --- IMPORTANT: Exit after set operations ---
				return; // Stop execution here
			}

			// Action 3: Display Full Status (Only runs if no setup and no set flags)
			console.log(chalk.blue('Fetching current model configuration...')); // Added feedback
			const configResult = await getModelConfiguration({ projectRoot });
			const availableResult = await getAvailableModelsList({ projectRoot });
			const apiKeyStatusResult = await getApiKeyStatusReport({ projectRoot });

			// 1. Display Active Models
			if (!configResult.success) {
				console.error(
					chalk.red(
						`❌ Error fetching configuration: ${configResult.error.message}`
					)
				);
			} else {
				displayModelConfiguration(
					configResult.data,
					availableResult.data?.models || []
				);
			}

			// 2. Display API Key Status
			if (apiKeyStatusResult.success) {
				displayApiKeyStatus(apiKeyStatusResult.data.report);
			} else {
				console.error(
					chalk.yellow(
						`⚠️ Warning: Could not display API Key status: ${apiKeyStatusResult.error.message}`
					)
				);
			}

			// 3. Display Other Available Models (Filtered)
			if (availableResult.success) {
				const activeIds = configResult.success
					? [
							configResult.data.activeModels.main.modelId,
							configResult.data.activeModels.research.modelId,
							configResult.data.activeModels.fallback?.modelId
						].filter(Boolean)
					: [];
				const displayableAvailable = availableResult.data.models.filter(
					(m) => !activeIds.includes(m.modelId) && !m.modelId.startsWith('[')
				);
				displayAvailableModels(displayableAvailable);
			} else {
				console.error(
					chalk.yellow(
						`⚠️ Warning: Could not display available models: ${availableResult.error.message}`
					)
				);
			}

			// 4. Conditional Hint if Config File is Missing
			const configExists = isConfigFilePresent(projectRoot);
			if (!configExists) {
				console.log(
					chalk.yellow(
						"\\nHint: Run 'task-master models --setup' to create or update your configuration."
					)
				);
			}
			// --- IMPORTANT: Exit after displaying status ---
			return; // Stop execution here
		});

	// response-language command
	programInstance
		.command('lang')
		.description('Manage response language settings')
		.option('--response <response_language>', 'Set the response language')
		.option('--setup', 'Run interactive setup to configure response language')
		.action(async (options) => {
			const taskMaster = initTaskMaster({});
			const projectRoot = taskMaster.getProjectRoot(); // Find project root for context
			const { response, setup } = options;
			let responseLanguage = response !== undefined ? response : 'English';
			if (setup) {
				console.log(
					chalk.blue('Starting interactive response language setup...')
				);
				try {
					const userResponse = await inquirer.prompt([
						{
							type: 'input',
							name: 'responseLanguage',
							message: 'Input your preferred response language',
							default: 'English'
						}
					]);

					console.log(
						chalk.blue(
							'Response language set to:',
							userResponse.responseLanguage
						)
					);
					responseLanguage = userResponse.responseLanguage;
				} catch (setupError) {
					console.error(
						chalk.red('\\nInteractive setup failed unexpectedly:'),
						setupError.message
					);
				}
			}

			const result = setResponseLanguage(responseLanguage, {
				projectRoot
			});

			if (result.success) {
				console.log(chalk.green(`✅ ${result.data.message}`));
			} else {
				console.error(
					chalk.red(
						`❌ Error setting response language: ${result.error.message}`
					)
				);
				process.exit(1);
			}
		});

	// move-task command
	programInstance
		.command('move')
		.description(
			'Move tasks between tags or reorder within tags. Supports cross-tag moves with dependency resolution options.'
		)
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			TASKMASTER_TASKS_FILE
		)
		.option(
			'--from <id>',
			'ID of the task/subtask to move (e.g., "5" or "5.2"). Can be comma-separated to move multiple tasks (e.g., "5,6,7")'
		)
		.option(
			'--to <id>',
			'ID of the destination (e.g., "7" or "7.3"). Must match the number of source IDs if comma-separated'
		)
		.option('--tag <tag>', 'Specify tag context for task operations')
		.option('--from-tag <tag>', 'Source tag for cross-tag moves')
		.option('--to-tag <tag>', 'Target tag for cross-tag moves')
		.option('--with-dependencies', 'Move dependent tasks along with main task')
		.option('--ignore-dependencies', 'Break cross-tag dependencies during move')
		.action(async (options) => {
			// Helper function to show move command help - defined in scope for proper encapsulation
			function showMoveHelp() {
				console.log(
					chalk.white.bold('Move Command Help') +
						'\n\n' +
						chalk.cyan('Move tasks between tags or reorder within tags.') +
						'\n\n' +
						chalk.yellow.bold('Within-Tag Moves:') +
						'\n' +
						chalk.white('  task-master move --from=5 --to=7') +
						'\n' +
						chalk.white('  task-master move --from=5.2 --to=7.3') +
						'\n' +
						chalk.white('  task-master move --from=5,6,7 --to=10,11,12') +
						'\n\n' +
						chalk.yellow.bold('Cross-Tag Moves:') +
						'\n' +
						chalk.white(
							'  task-master move --from=5 --from-tag=backlog --to-tag=in-progress'
						) +
						'\n' +
						chalk.white(
							'  task-master move --from=5,6 --from-tag=backlog --to-tag=done'
						) +
						'\n\n' +
						chalk.yellow.bold('Dependency Resolution:') +
						'\n' +
						chalk.white('  # Move with dependencies') +
						'\n' +
						chalk.white(
							'  task-master move --from=5 --from-tag=backlog --to-tag=in-progress --with-dependencies'
						) +
						'\n\n' +
						chalk.white('  # Break dependencies') +
						'\n' +
						chalk.white(
							'  task-master move --from=5 --from-tag=backlog --to-tag=in-progress --ignore-dependencies'
						) +
						'\n\n' +
						'\n' +
						chalk.yellow.bold('Best Practices:') +
						'\n' +
						chalk.white(
							'  • Use --with-dependencies to move dependent tasks together'
						) +
						'\n' +
						chalk.white(
							'  • Use --ignore-dependencies to break cross-tag dependencies'
						) +
						'\n' +
						chalk.white(
							'  • Check dependencies first: task-master validate-dependencies'
						) +
						'\n' +
						chalk.white(
							'  • Fix dependency issues: task-master fix-dependencies'
						) +
						'\n\n' +
						chalk.yellow.bold('Error Resolution:') +
						'\n' +
						chalk.white(
							'  • Cross-tag dependency conflicts: Use --with-dependencies or --ignore-dependencies'
						) +
						'\n' +
						chalk.white(
							'  • Subtask movement: Promote subtask first with remove-subtask --convert'
						) +
						'\n' +
						chalk.white(
							'  • Invalid tags: Check available tags with task-master tags'
						) +
						'\n\n' +
						chalk.gray('For more help, run: task-master move --help')
				);
			}

			// Helper function to handle cross-tag move logic
			async function handleCrossTagMove(moveContext, options) {
				const { sourceId, sourceTag, toTag, taskMaster } = moveContext;

				if (!sourceId) {
					console.error(
						chalk.red('Error: --from parameter is required for cross-tag moves')
					);
					showMoveHelp();
					process.exit(1);
				}

				const sourceIds = sourceId.split(',').map((id) => id.trim());
				const moveOptions = {
					withDependencies: options.withDependencies || false,
					ignoreDependencies: options.ignoreDependencies || false
				};

				console.log(
					chalk.blue(
						`Moving tasks ${sourceIds.join(', ')} from "${sourceTag}" to "${toTag}"...`
					)
				);

				const result = await moveTasksBetweenTags(
					taskMaster.getTasksPath(),
					sourceIds,
					sourceTag,
					toTag,
					moveOptions,
					{ projectRoot: taskMaster.getProjectRoot() }
				);

				console.log(chalk.green(`✓ ${result.message}`));

				// Print any tips returned from the move operation (e.g., after ignoring dependencies)
				if (Array.isArray(result.tips) && result.tips.length > 0) {
					console.log('\n' + chalk.yellow.bold('Next Steps:'));
					result.tips.forEach((t) => console.log(chalk.white(`  • ${t}`)));
				}
			}

			// Helper function to handle within-tag move logic
			async function handleWithinTagMove(moveContext) {
				const { sourceId, destinationId, tag, taskMaster } = moveContext;

				if (!sourceId || !destinationId) {
					console.error(
						chalk.red(
							'Error: Both --from and --to parameters are required for within-tag moves'
						)
					);
					console.log(
						chalk.yellow(
							'Usage: task-master move --from=<sourceId> --to=<destinationId>'
						)
					);
					process.exit(1);
				}

				// Check if we're moving multiple tasks (comma-separated IDs)
				const sourceIds = sourceId.split(',').map((id) => id.trim());
				const destinationIds = destinationId.split(',').map((id) => id.trim());

				// Validate that the number of source and destination IDs match
				if (sourceIds.length !== destinationIds.length) {
					console.error(
						chalk.red(
							'Error: The number of source and destination IDs must match'
						)
					);
					console.log(
						chalk.yellow('Example: task-master move --from=5,6,7 --to=10,11,12')
					);
					process.exit(1);
				}

				// If moving multiple tasks
				if (sourceIds.length > 1) {
					console.log(
						chalk.blue(
							`Moving multiple tasks: ${sourceIds.join(', ')} to ${destinationIds.join(', ')}...`
						)
					);

					// Read tasks data once to validate destination IDs
					const tasksData = readJSON(
						taskMaster.getTasksPath(),
						taskMaster.getProjectRoot(),
						tag
					);
					if (!tasksData || !tasksData.tasks) {
						console.error(
							chalk.red(
								`Error: Invalid or missing tasks file at ${taskMaster.getTasksPath()}`
							)
						);
						process.exit(1);
					}

					// Collect errors during move attempts
					const moveErrors = [];
					const successfulMoves = [];

					// Move tasks one by one
					for (let i = 0; i < sourceIds.length; i++) {
						const fromId = sourceIds[i];
						const toId = destinationIds[i];

						// Skip if source and destination are the same
						if (fromId === toId) {
							console.log(
								chalk.yellow(`Skipping ${fromId} -> ${toId} (same ID)`)
							);
							continue;
						}

						console.log(
							chalk.blue(`Moving task/subtask ${fromId} to ${toId}...`)
						);
						try {
							await moveTask(
								taskMaster.getTasksPath(),
								fromId,
								toId,
								i === sourceIds.length - 1,
								{ projectRoot: taskMaster.getProjectRoot(), tag }
							);
							console.log(
								chalk.green(
									`✓ Successfully moved task/subtask ${fromId} to ${toId}`
								)
							);
							successfulMoves.push({ fromId, toId });
						} catch (error) {
							const errorInfo = {
								fromId,
								toId,
								error: error.message
							};
							moveErrors.push(errorInfo);
							console.error(
								chalk.red(`Error moving ${fromId} to ${toId}: ${error.message}`)
							);
							// Continue with the next task rather than exiting
						}
					}

					// Display summary after all moves are attempted
					if (moveErrors.length > 0) {
						console.log(chalk.yellow('\n--- Move Operation Summary ---'));
						console.log(
							chalk.green(
								`✓ Successfully moved: ${successfulMoves.length} tasks`
							)
						);
						console.log(
							chalk.red(`✗ Failed to move: ${moveErrors.length} tasks`)
						);

						if (successfulMoves.length > 0) {
							console.log(chalk.cyan('\nSuccessful moves:'));
							successfulMoves.forEach(({ fromId, toId }) => {
								console.log(chalk.cyan(`  ${fromId} → ${toId}`));
							});
						}

						console.log(chalk.red('\nFailed moves:'));
						moveErrors.forEach(({ fromId, toId, error }) => {
							console.log(chalk.red(`  ${fromId} → ${toId}: ${error}`));
						});

						console.log(
							chalk.yellow(
								'\nNote: Some tasks were moved successfully. Check the errors above for failed moves.'
							)
						);
					} else {
						console.log(chalk.green('\n✓ All tasks moved successfully!'));
					}
				} else {
					// Moving a single task (existing logic)
					console.log(
						chalk.blue(`Moving task/subtask ${sourceId} to ${destinationId}...`)
					);

					const result = await moveTask(
						taskMaster.getTasksPath(),
						sourceId,
						destinationId,
						true,
						{ projectRoot: taskMaster.getProjectRoot(), tag }
					);
					console.log(
						chalk.green(
							`✓ Successfully moved task/subtask ${sourceId} to ${destinationId}`
						)
					);
				}
			}

			// Helper function to handle move errors
			function handleMoveError(error, moveContext) {
				console.error(chalk.red(`Error: ${error.message}`));

				// Enhanced error handling with structured error objects
				if (error.code === 'CROSS_TAG_DEPENDENCY_CONFLICTS') {
					// Use structured error data
					const conflicts = error.data.conflicts || [];
					const taskIds = error.data.taskIds || [];
					displayCrossTagDependencyError(
						conflicts,
						moveContext.sourceTag,
						moveContext.toTag,
						taskIds.join(', ')
					);
				} else if (error.code === 'CANNOT_MOVE_SUBTASK') {
					// Use structured error data
					const taskId =
						error.data.taskId || moveContext.sourceId?.split(',')[0];
					displaySubtaskMoveError(
						taskId,
						moveContext.sourceTag,
						moveContext.toTag
					);
				} else if (
					error.code === 'SOURCE_TARGET_TAGS_SAME' ||
					error.code === 'SAME_SOURCE_TARGET_TAG'
				) {
					displayInvalidTagCombinationError(
						moveContext.sourceTag,
						moveContext.toTag,
						'Source and target tags are identical'
					);
				} else {
					// General error - show dependency validation hints
					displayDependencyValidationHints('after-error');
				}

				process.exit(1);
			}

			// Initialize TaskMaster
			const taskMaster = initTaskMaster({
				tasksPath: options.file || true,
				tag: options.tag
			});

			const sourceId = options.from;
			const destinationId = options.to;
			const fromTag = options.fromTag;
			const toTag = options.toTag;

			const tag = taskMaster.getCurrentTag();

			// Get the source tag - fallback to current tag if not provided
			const sourceTag = fromTag || taskMaster.getCurrentTag();

			// Check if this is a cross-tag move (different tags)
			const isCrossTagMove = sourceTag && toTag && sourceTag !== toTag;

			// Initialize move context with all relevant data
			const moveContext = {
				sourceId,
				destinationId,
				sourceTag,
				toTag,
				tag,
				taskMaster
			};

			try {
				if (isCrossTagMove) {
					// Cross-tag move logic
					await handleCrossTagMove(moveContext, options);
				} else {
					// Within-tag move logic
					await handleWithinTagMove(moveContext);
				}
			} catch (error) {
				const errMsg = String(error && (error.message || error));
				if (errMsg.includes('already exists in target tag')) {
					console.error(chalk.red(`Error: ${errMsg}`));
					console.log(
						'\n' +
							chalk.yellow.bold('Conflict: ID already exists in target tag') +
							'\n' +
							chalk.white(
								'  • Choose a different target tag without conflicting IDs'
							) +
							'\n' +
							chalk.white(
								'  • Move a different set of IDs (avoid existing ones)'
							) +
							'\n' +
							chalk.white(
								'  • If needed, move within-tag to a new ID first, then cross-tag move'
							)
					);
					process.exit(1);
				}
				handleMoveError(error, moveContext);
			}
		});

	// Add/remove profile rules command
	programInstance
		.command('rules [action] [profiles...]')
		.description(
			`Add or remove rules for one or more profiles. Valid actions: ${Object.values(RULES_ACTIONS).join(', ')} (e.g., task-master rules ${RULES_ACTIONS.ADD} windsurf roo)`
		)
		.option(
			'-f, --force',
			'Skip confirmation prompt when removing rules (dangerous)'
		)
		.option(
			`--${RULES_SETUP_ACTION}`,
			'Run interactive setup to select rule profiles to add'
		)
		.addHelpText(
			'after',
			`
		Examples:
		$ task-master rules ${RULES_ACTIONS.ADD} windsurf roo          # Add Windsurf and Roo rule sets
		$ task-master rules ${RULES_ACTIONS.REMOVE} windsurf          # Remove Windsurf rule set
		$ task-master rules --${RULES_SETUP_ACTION}                  # Interactive setup to select rule profiles`
		)
		.action(async (action, profiles, options) => {
			const taskMaster = initTaskMaster({});
			const projectRoot = taskMaster.getProjectRoot();
			if (!projectRoot) {
				console.error(chalk.red('Error: Could not find project root.'));
				process.exit(1);
			}

			/**
			 * 'task-master rules --setup' action:
			 *
			 * Launches an interactive prompt to select which rule profiles to add to the current project.
			 * This does NOT perform project initialization or ask about shell aliases—only rules selection.
			 *
			 * Example usage:
			 *   $ task-master rules --setup
			 *
			 * Useful for adding rules after project creation.
			 *
			 * The list of profiles is always up-to-date with the available profiles.
			 */
			if (options[RULES_SETUP_ACTION]) {
				// Run interactive rules setup ONLY (no project init)
				const selectedRuleProfiles = await runInteractiveProfilesSetup();

				if (!selectedRuleProfiles || selectedRuleProfiles.length === 0) {
					console.log(chalk.yellow('No profiles selected. Exiting.'));
					return;
				}

				console.log(
					chalk.blue(
						`Installing ${selectedRuleProfiles.length} selected profile(s)...`
					)
				);

				for (let i = 0; i < selectedRuleProfiles.length; i++) {
					const profile = selectedRuleProfiles[i];
					console.log(
						chalk.blue(
							`Processing profile ${i + 1}/${selectedRuleProfiles.length}: ${profile}...`
						)
					);

					if (!isValidProfile(profile)) {
						console.warn(
							`Rule profile for "${profile}" not found. Valid profiles: ${RULE_PROFILES.join(', ')}. Skipping.`
						);
						continue;
					}
					const profileConfig = getRulesProfile(profile);

					const addResult = convertAllRulesToProfileRules(
						projectRoot,
						profileConfig
					);

					console.log(chalk.green(generateProfileSummary(profile, addResult)));
				}

				console.log(
					chalk.green(
						`\nCompleted installation of all ${selectedRuleProfiles.length} profile(s).`
					)
				);
				return;
			}

			// Validate action for non-setup mode
			if (!action || !isValidRulesAction(action)) {
				console.error(
					chalk.red(
						`Error: Invalid or missing action '${action || 'none'}'. Valid actions are: ${Object.values(RULES_ACTIONS).join(', ')}`
					)
				);
				console.error(
					chalk.yellow(
						`For interactive setup, use: task-master rules --${RULES_SETUP_ACTION}`
					)
				);
				process.exit(1);
			}

			if (!profiles || profiles.length === 0) {
				console.error(
					'Please specify at least one rule profile (e.g., windsurf, roo).'
				);
				process.exit(1);
			}

			// Support both space- and comma-separated profile lists
			const expandedProfiles = profiles
				.flatMap((b) => b.split(',').map((s) => s.trim()))
				.filter(Boolean);

			if (action === RULES_ACTIONS.REMOVE) {
				let confirmed = true;
				if (!options.force) {
					// Check if this removal would leave no profiles remaining
					if (wouldRemovalLeaveNoProfiles(projectRoot, expandedProfiles)) {
						const installedProfiles = getInstalledProfiles(projectRoot);
						confirmed = await confirmRemoveAllRemainingProfiles(
							expandedProfiles,
							installedProfiles
						);
					} else {
						confirmed = await confirmProfilesRemove(expandedProfiles);
					}
				}
				if (!confirmed) {
					console.log(chalk.yellow('Aborted: No rules were removed.'));
					return;
				}
			}

			const removalResults = [];
			const addResults = [];

			for (const profile of expandedProfiles) {
				if (!isValidProfile(profile)) {
					console.warn(
						`Rule profile for "${profile}" not found. Valid profiles: ${RULE_PROFILES.join(', ')}. Skipping.`
					);
					continue;
				}
				const profileConfig = getRulesProfile(profile);

				if (action === RULES_ACTIONS.ADD) {
					console.log(chalk.blue(`Adding rules for profile: ${profile}...`));
					const addResult = convertAllRulesToProfileRules(
						projectRoot,
						profileConfig
					);
					console.log(
						chalk.blue(`Completed adding rules for profile: ${profile}`)
					);

					// Store result with profile name for summary
					addResults.push({
						profileName: profile,
						success: addResult.success,
						failed: addResult.failed
					});

					console.log(chalk.green(generateProfileSummary(profile, addResult)));
				} else if (action === RULES_ACTIONS.REMOVE) {
					console.log(chalk.blue(`Removing rules for profile: ${profile}...`));
					const result = removeProfileRules(projectRoot, profileConfig);
					removalResults.push(result);
					console.log(
						chalk.green(generateProfileRemovalSummary(profile, result))
					);
				} else {
					console.error(
						`Unknown action. Use "${RULES_ACTIONS.ADD}" or "${RULES_ACTIONS.REMOVE}".`
					);
					process.exit(1);
				}
			}

			// Print summary for additions
			if (action === RULES_ACTIONS.ADD && addResults.length > 0) {
				const { allSuccessfulProfiles, totalSuccess, totalFailed } =
					categorizeProfileResults(addResults);

				if (allSuccessfulProfiles.length > 0) {
					console.log(
						chalk.green(
							`\nSuccessfully processed profiles: ${allSuccessfulProfiles.join(', ')}`
						)
					);

					// Create a descriptive summary
					if (totalSuccess > 0) {
						console.log(
							chalk.green(
								`Total: ${totalSuccess} files processed, ${totalFailed} failed.`
							)
						);
					} else {
						console.log(
							chalk.green(
								`Total: ${allSuccessfulProfiles.length} profile(s) set up successfully.`
							)
						);
					}
				}
			}

			// Print summary for removals
			if (action === RULES_ACTIONS.REMOVE && removalResults.length > 0) {
				const {
					successfulRemovals,
					skippedRemovals,
					failedRemovals,
					removalsWithNotices
				} = categorizeRemovalResults(removalResults);

				if (successfulRemovals.length > 0) {
					console.log(
						chalk.green(
							`\nSuccessfully removed profiles for: ${successfulRemovals.join(', ')}`
						)
					);
				}
				if (skippedRemovals.length > 0) {
					console.log(
						chalk.yellow(
							`Skipped (default or protected): ${skippedRemovals.join(', ')}`
						)
					);
				}
				if (failedRemovals.length > 0) {
					console.log(chalk.red('\nErrors occurred:'));
					failedRemovals.forEach((r) => {
						console.log(chalk.red(`  ${r.profileName}: ${r.error}`));
					});
				}
				// Display notices about preserved files/configurations
				if (removalsWithNotices.length > 0) {
					console.log(chalk.cyan('\nNotices:'));
					removalsWithNotices.forEach((r) => {
						console.log(chalk.cyan(`  ${r.profileName}: ${r.notice}`));
					});
				}

				// Overall summary
				const totalProcessed = removalResults.length;
				const totalSuccessful = successfulRemovals.length;
				const totalSkipped = skippedRemovals.length;
				const totalFailed = failedRemovals.length;

				console.log(
					chalk.blue(
						`\nTotal: ${totalProcessed} profile(s) processed - ${totalSuccessful} removed, ${totalSkipped} skipped, ${totalFailed} failed.`
					)
				);
			}
		});

	programInstance
		.command('migrate')
		.description(
			'Migrate existing project to use the new .taskmaster directory structure'
		)
		.option(
			'-f, --force',
			'Force migration even if .taskmaster directory already exists'
		)
		.option(
			'--backup',
			'Create backup of old files before migration (default: false)',
			false
		)
		.option(
			'--cleanup',
			'Remove old files after successful migration (default: true)',
			true
		)
		.option('-y, --yes', 'Skip confirmation prompts')
		.option(
			'--dry-run',
			'Show what would be migrated without actually moving files'
		)
		.action(async (options) => {
			try {
				await migrateProject(options);
			} catch (error) {
				console.error(chalk.red('Error during migration:'), error.message);
				process.exit(1);
			}
		});

	// sync-readme command
	programInstance
		.command('sync-readme')
		.description('Sync the current task list to README.md in the project root')
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			TASKMASTER_TASKS_FILE
		)
		.option('--with-subtasks', 'Include subtasks in the README output')
		.option(
			'-s, --status <status>',
			'Show only tasks matching this status (e.g., pending, done)'
		)
		.option('-t, --tag <tag>', 'Tag to use for the task list (default: master)')
		.action(async (options) => {
			// Initialize TaskMaster
			const taskMaster = initTaskMaster({
				tasksPath: options.file || true,
				tag: options.tag
			});

			const withSubtasks = options.withSubtasks || false;
			const status = options.status || null;

			const tag = taskMaster.getCurrentTag();

			console.log(
				chalk.blue(
					`📝 Syncing tasks to README.md${withSubtasks ? ' (with subtasks)' : ''}${status ? ` (status: ${status})` : ''}...`
				)
			);

			const success = await syncTasksToReadme(taskMaster.getProjectRoot(), {
				withSubtasks,
				status,
				tasksPath: taskMaster.getTasksPath(),
				tag
			});

			if (!success) {
				console.error(chalk.red('❌ Failed to sync tasks to README.md'));
				process.exit(1);
			}
		});

	// ===== TAG MANAGEMENT COMMANDS =====

	// add-tag command (DEPRECATED - use `tm tags add` instead)
	programInstance
		.command('add-tag')
		.description(
			'[DEPRECATED] Create a new tag context for organizing tasks (use "tm tags add" instead)'
		)
		.argument(
			'[tagName]',
			'Name of the new tag to create (optional when using --from-branch)'
		)
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			TASKMASTER_TASKS_FILE
		)
		.option(
			'--copy-from-current',
			'Copy tasks from the current tag to the new tag'
		)
		.option(
			'--copy-from <tag>',
			'Copy tasks from the specified tag to the new tag'
		)
		.option(
			'--from-branch',
			'Create tag name from current git branch (ignores tagName argument)'
		)
		.option('-d, --description <text>', 'Optional description for the tag')
		.action(async (tagName, options) => {
			// Show deprecation warning
			console.warn(
				chalk.yellow(
					'⚠ Warning: "tm add-tag" is deprecated. Use "tm tags add" instead.'
				)
			);
			console.log(
				chalk.gray('  This command will be removed in a future version.\n')
			);

			try {
				// Initialize TaskMaster
				const taskMaster = initTaskMaster({
					tasksPath: options.file || true
				});
				const tasksPath = taskMaster.getTasksPath();

				// Validate tasks file exists
				if (!fs.existsSync(tasksPath)) {
					console.error(
						chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
					);
					console.log(
						chalk.yellow(
							'Hint: Run task-master init or task-master parse-prd to create tasks.json first'
						)
					);
					process.exit(1);
				}

				// Validate that either tagName is provided or --from-branch is used
				if (!tagName && !options.fromBranch) {
					console.error(
						chalk.red(
							'Error: Either tagName argument or --from-branch option is required.'
						)
					);
					console.log(chalk.yellow('Usage examples:'));
					console.log(chalk.cyan('  task-master add-tag my-tag'));
					console.log(chalk.cyan('  task-master add-tag --from-branch'));
					process.exit(1);
				}

				const context = {
					projectRoot: taskMaster.getProjectRoot(),
					commandName: 'add-tag',
					outputType: 'cli'
				};

				// Handle --from-branch option
				if (options.fromBranch) {
					const { createTagFromBranch } = await import(
						'./task-manager/tag-management.js'
					);
					const gitUtils = await import('./utils/git-utils.js');

					// Check if we're in a git repository
					if (!(await gitUtils.isGitRepository(context.projectRoot))) {
						console.error(
							chalk.red(
								'Error: Not in a git repository. Cannot use --from-branch option.'
							)
						);
						process.exit(1);
					}

					// Get current git branch
					const currentBranch = await gitUtils.getCurrentBranch(
						context.projectRoot
					);
					if (!currentBranch) {
						console.error(
							chalk.red('Error: Could not determine current git branch.')
						);
						process.exit(1);
					}

					// Create tag from branch
					const branchOptions = {
						copyFromCurrent: options.copyFromCurrent || false,
						copyFromTag: options.copyFrom,
						description:
							options.description ||
							`Tag created from git branch "${currentBranch}"`
					};

					await createTagFromBranch(
						taskMaster.getTasksPath(),
						currentBranch,
						branchOptions,
						context,
						'text'
					);
				} else {
					// Regular tag creation
					const createOptions = {
						copyFromCurrent: options.copyFromCurrent || false,
						copyFromTag: options.copyFrom,
						description: options.description
					};

					await createTag(
						taskMaster.getTasksPath(),
						tagName,
						createOptions,
						context,
						'text'
					);
				}

				// Handle auto-switch if requested
				if (options.autoSwitch) {
					const { useTag } = await import('./task-manager/tag-management.js');
					const finalTagName = options.fromBranch
						? (await import('./utils/git-utils.js')).sanitizeBranchNameForTag(
								await (await import('./utils/git-utils.js')).getCurrentBranch(
									projectRoot
								)
							)
						: tagName;
					await useTag(
						taskMaster.getTasksPath(),
						finalTagName,
						{},
						context,
						'text'
					);
				}
			} catch (error) {
				console.error(chalk.red(`Error creating tag: ${error.message}`));
				showAddTagHelp();
				process.exit(1);
			}
		})
		.on('error', function (err) {
			console.error(chalk.red(`Error: ${err.message}`));
			showAddTagHelp();
			process.exit(1);
		});

	// delete-tag command (DEPRECATED - use `tm tags remove` instead)
	programInstance
		.command('delete-tag')
		.description(
			'[DEPRECATED] Delete an existing tag and all its tasks (use "tm tags remove" instead)'
		)
		.argument('<tagName>', 'Name of the tag to delete')
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			TASKMASTER_TASKS_FILE
		)
		.option('-y, --yes', 'Skip confirmation prompts')
		.action(async (tagName, options) => {
			// Show deprecation warning
			console.warn(
				chalk.yellow(
					'⚠ Warning: "tm delete-tag" is deprecated. Use "tm tags remove" instead.'
				)
			);
			console.log(
				chalk.gray('  This command will be removed in a future version.\n')
			);

			try {
				// Initialize TaskMaster
				const taskMaster = initTaskMaster({
					tasksPath: options.file || true
				});
				const tasksPath = taskMaster.getTasksPath();

				// Validate tasks file exists
				if (!fs.existsSync(tasksPath)) {
					console.error(
						chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
					);
					process.exit(1);
				}

				const deleteOptions = {
					yes: options.yes || false
				};

				const context = {
					projectRoot: taskMaster.getProjectRoot(),
					commandName: 'delete-tag',
					outputType: 'cli'
				};

				await deleteTag(
					taskMaster.getTasksPath(),
					tagName,
					deleteOptions,
					context,
					'text'
				);
			} catch (error) {
				console.error(chalk.red(`Error deleting tag: ${error.message}`));
				showDeleteTagHelp();
				process.exit(1);
			}
		})
		.on('error', function (err) {
			console.error(chalk.red(`Error: ${err.message}`));
			showDeleteTagHelp();
			process.exit(1);
		});

	// tags command - REMOVED
	// This command has been replaced by the new CommandRegistry-based TagsCommand
	// in apps/cli/src/commands/tags.command.ts
	// The old implementation is no longer needed

	// use-tag command (DEPRECATED - use `tm tags use` instead)
	programInstance
		.command('use-tag')
		.description(
			'[DEPRECATED] Switch to a different tag context (use "tm tags use" instead)'
		)
		.argument('<tagName>', 'Name of the tag to switch to')
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			TASKMASTER_TASKS_FILE
		)
		.action(async (tagName, options) => {
			// Show deprecation warning
			console.warn(
				chalk.yellow(
					'⚠ Warning: "tm use-tag" is deprecated. Use "tm tags use" instead.'
				)
			);
			console.log(
				chalk.gray('  This command will be removed in a future version.\n')
			);

			try {
				// Initialize TaskMaster
				const taskMaster = initTaskMaster({
					tasksPath: options.file || true
				});
				const tasksPath = taskMaster.getTasksPath();

				// Validate tasks file exists
				if (!fs.existsSync(tasksPath)) {
					console.error(
						chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
					);
					process.exit(1);
				}

				const context = {
					projectRoot: taskMaster.getProjectRoot(),
					commandName: 'use-tag',
					outputType: 'cli'
				};

				await useTag(taskMaster.getTasksPath(), tagName, {}, context, 'text');
			} catch (error) {
				console.error(chalk.red(`Error switching tag: ${error.message}`));
				showUseTagHelp();
				process.exit(1);
			}
		})
		.on('error', function (err) {
			console.error(chalk.red(`Error: ${err.message}`));
			showUseTagHelp();
			process.exit(1);
		});

	// rename-tag command (DEPRECATED - use `tm tags rename` instead)
	programInstance
		.command('rename-tag')
		.description(
			'[DEPRECATED] Rename an existing tag (use "tm tags rename" instead)'
		)
		.argument('<oldName>', 'Current name of the tag')
		.argument('<newName>', 'New name for the tag')
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			TASKMASTER_TASKS_FILE
		)
		.action(async (oldName, newName, options) => {
			// Show deprecation warning
			console.warn(
				chalk.yellow(
					'⚠ Warning: "tm rename-tag" is deprecated. Use "tm tags rename" instead.'
				)
			);
			console.log(
				chalk.gray('  This command will be removed in a future version.\n')
			);

			try {
				// Initialize TaskMaster
				const taskMaster = initTaskMaster({
					tasksPath: options.file || true
				});
				const tasksPath = taskMaster.getTasksPath();

				// Validate tasks file exists
				if (!fs.existsSync(tasksPath)) {
					console.error(
						chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
					);
					process.exit(1);
				}

				const context = {
					projectRoot: taskMaster.getProjectRoot(),
					commandName: 'rename-tag',
					outputType: 'cli'
				};

				await renameTag(
					taskMaster.getTasksPath(),
					oldName,
					newName,
					{},
					context,
					'text'
				);
			} catch (error) {
				console.error(chalk.red(`Error renaming tag: ${error.message}`));
				process.exit(1);
			}
		})
		.on('error', function (err) {
			console.error(chalk.red(`Error: ${err.message}`));
			process.exit(1);
		});

	// copy-tag command (DEPRECATED - use `tm tags copy` instead)
	programInstance
		.command('copy-tag')
		.description(
			'[DEPRECATED] Copy an existing tag to create a new tag with the same tasks (use "tm tags copy" instead)'
		)
		.argument('<sourceName>', 'Name of the source tag to copy from')
		.argument('<targetName>', 'Name of the new tag to create')
		.option(
			'-f, --file <file>',
			'Path to the tasks file',
			TASKMASTER_TASKS_FILE
		)
		.option('-d, --description <text>', 'Optional description for the new tag')
		.action(async (sourceName, targetName, options) => {
			// Show deprecation warning
			console.warn(
				chalk.yellow(
					'⚠ Warning: "tm copy-tag" is deprecated. Use "tm tags copy" instead.'
				)
			);
			console.log(
				chalk.gray('  This command will be removed in a future version.\n')
			);

			try {
				// Initialize TaskMaster
				const taskMaster = initTaskMaster({
					tasksPath: options.file || true
				});
				const tasksPath = taskMaster.getTasksPath();

				// Validate tasks file exists
				if (!fs.existsSync(tasksPath)) {
					console.error(
						chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
					);
					process.exit(1);
				}

				const copyOptions = {
					description: options.description
				};

				const context = {
					projectRoot: taskMaster.getProjectRoot(),
					commandName: 'copy-tag',
					outputType: 'cli'
				};

				await copyTag(
					tasksPath,
					sourceName,
					targetName,
					copyOptions,
					context,
					'text'
				);
			} catch (error) {
				console.error(chalk.red(`Error copying tag: ${error.message}`));
				process.exit(1);
			}
		})
		.on('error', function (err) {
			console.error(chalk.red(`Error: ${err.message}`));
			process.exit(1);
		});

	// tui / repl command - launches the interactive TUI
	programInstance
		.command('tui')
		.alias('repl')
		.description('Launch the interactive TUI/REPL mode')
		.action(async () => {
			await launchREPL();
		});

	return programInstance;
}

/**
 * Launch the interactive TUI REPL
 */
async function launchREPL() {
	const React = await import('react');
	const tui = await loadTUI();

	if (!tui) {
		// Fallback to help if TUI not available
		console.log(
			chalk.yellow('TUI mode not available. Install @tm/tui to enable.')
		);
		console.log(chalk.dim('Showing help instead...\n'));
		if (isConnectedToHamster()) {
			displayHamsterHelp();
		} else {
			displayHelp();
		}
		return;
	}

	const { render, Shell } = tui;

	// Get current context
	let tag = 'master';
	let storageType = 'local';
	let brief = undefined;
	let authState = { isAuthenticated: false };
	let projectRoot = process.cwd();

	try {
		const taskMaster = initTaskMaster({});
		tag = taskMaster.getCurrentTag();
		projectRoot = taskMaster.getProjectRoot() || process.cwd();

		// Check if connected to Hamster
		const authManager = AuthManager.getInstance();
		const context = authManager.getContext();
		const storedContext = authManager.getStoredContext();

		// Build auth state from stored context
		if (storedContext && storedContext.email) {
			authState = {
				isAuthenticated: true,
				email: storedContext.email,
				userId: storedContext.userId
			};
		}

		if (context && context.briefId) {
			storageType = 'api';
			brief = {
				id: context.briefId,
				name: context.briefName || tag
			};
		}
	} catch (error) {
		// Use defaults
	}

	// Check if stdin supports raw mode (required for interactive TUI)
	const isInteractive =
		process.stdin.isTTY && typeof process.stdin.setRawMode === 'function';

	// Clear screen
	console.clear();

	// Shell props with interactive flag and auth state
	const shellProps = {
		showBanner: true,
		showSplash: isInteractive,
		initialTag: tag,
		storageType: storageType,
		brief: brief,
		authState: authState,
		isInteractive: isInteractive,
		projectRoot: projectRoot,
		onExit: () => {
			console.log(chalk.dim('\nGoodbye! 👋'));
			process.exit(0);
		}
	};

	const instance = render(React.createElement(Shell, shellProps));

	// In non-interactive mode, wait for render then exit
	if (!isInteractive) {
		setTimeout(() => {
			instance.unmount();
			console.log(
				chalk.dim('\n💡 Run in an interactive terminal for full REPL mode.')
			);
			process.exit(0);
		}, 200);
	}
}

/**
 * Setup the CLI application
 * @returns {Object} Configured Commander program
 */
function setupCLI() {
	// Create a new program instance
	const programInstance = new Command()
		.name('task-master')
		.description('AI-driven development task management')
		.version(process.env.TM_PUBLIC_VERSION || 'unknown')
		.helpOption('-h, --help', 'Display help')
		.addHelpCommand(false); // Disable default help command

	// Only override help for the main program, not for individual commands
	const originalHelpInformation =
		programInstance.helpInformation.bind(programInstance);
	programInstance.helpInformation = function () {
		// If this is being called for a subcommand, use the default Commander.js help
		if (this.parent && this.parent !== programInstance) {
			return originalHelpInformation();
		}
		// If this is the main program help, use our custom display
		// Check if connected to Hamster and show appropriate help
		if (isConnectedToHamster()) {
			displayHamsterHelp();
		} else {
			displayHelp();
		}
		return '';
	};

	// Register commands
	registerCommands(programInstance);

	return programInstance;
}

/**
 * Parse arguments and run the CLI
 * @param {Array} argv - Command-line arguments
 */
async function runCLI(argv = process.argv) {
	try {
		// If no arguments provided, launch the TUI REPL (which has its own banner)
		if (argv.length <= 2) {
			await launchREPL();
			return;
		}

		// Display banner if not in a pipe (except for init/start/repl commands which have their own)
		const isInitCommand = argv.includes('init');
		const isREPLCommand = argv.includes('tui') || argv.includes('repl');
		if (process.stdout.isTTY && !isInitCommand && !isREPLCommand) {
			displayBanner();
		}

		// Check for updates BEFORE executing the command
		const currentVersion = getTaskMasterVersion();
		const updateInfo = await checkForUpdate(currentVersion);

		if (updateInfo.needsUpdate) {
			// Display the upgrade notification first
			displayUpgradeNotification(
				updateInfo.currentVersion,
				updateInfo.latestVersion,
				updateInfo.highlights
			);

			// Automatically perform the update
			const updateSuccess = await performAutoUpdate(updateInfo.latestVersion);
			if (updateSuccess) {
				// Restart with the new version - this will execute the user's command
				restartWithNewVersion(argv);
				return; // Never reached, but for clarity
			}
			// If update fails, continue with current version
		}

		// Setup and parse
		// NOTE: getConfig() might be called during setupCLI->registerCommands if commands need config
		// This means the ConfigurationError might be thrown here if configuration file is missing.
		const programInstance = setupCLI();
		await programInstance.parseAsync(argv);

		// Check if migration has occurred and show FYI notice once
		try {
			// Use initTaskMaster with no required fields - will only fail if no project root
			const taskMaster = initTaskMaster({});

			const tasksPath = taskMaster.getTasksPath();
			const statePath = taskMaster.getStatePath();

			if (tasksPath && fs.existsSync(tasksPath)) {
				// Read raw file to check if it has master key (bypassing tag resolution)
				const rawData = fs.readFileSync(tasksPath, 'utf8');
				const parsedData = JSON.parse(rawData);

				if (parsedData && parsedData.master) {
					// Migration has occurred, check if we've shown the notice
					let stateData = { migrationNoticeShown: false };
					if (statePath && fs.existsSync(statePath)) {
						// Read state.json directly without tag resolution since it's not a tagged file
						const rawStateData = fs.readFileSync(statePath, 'utf8');
						stateData = JSON.parse(rawStateData) || stateData;
					}

					if (!stateData.migrationNoticeShown) {
						displayTaggedTasksFYI({ _migrationHappened: true });

						// Mark as shown
						stateData.migrationNoticeShown = true;
						// Write state.json directly without tag resolution since it's not a tagged file
						if (statePath) {
							fs.writeFileSync(statePath, JSON.stringify(stateData, null, 2));
						}
					}
				}
			}
		} catch (error) {
			// Silently ignore errors checking for migration notice
		}
	} catch (error) {
		// ** Specific catch block for missing configuration file **
		if (error instanceof ConfigurationError) {
			console.error(
				boxen(
					chalk.red.bold('Configuration Update Required!') +
						'\n\n' +
						chalk.white('Taskmaster now uses a ') +
						chalk.yellow.bold('configuration file') +
						chalk.white(
							' in your project for AI model choices and settings.\n\n' +
								'This file appears to be '
						) +
						chalk.red.bold('missing') +
						chalk.white('. No worries though.\n\n') +
						chalk.cyan.bold('To create this file, run the interactive setup:') +
						'\n' +
						chalk.green('   task-master models --setup') +
						'\n\n' +
						chalk.white.bold('Key Points:') +
						'\n' +
						chalk.white('*   ') +
						chalk.yellow.bold('Configuration file') +
						chalk.white(
							': Stores your AI model settings (do not manually edit)\n'
						) +
						chalk.white('*   ') +
						chalk.yellow.bold('.env & .mcp.json') +
						chalk.white(': Still used ') +
						chalk.red.bold('only') +
						chalk.white(' for your AI provider API keys.\n\n') +
						chalk.cyan(
							'`task-master models` to check your config & available models\n'
						) +
						chalk.cyan(
							'`task-master models --setup` to adjust the AI models used by Taskmaster'
						),
					{
						padding: 1,
						margin: { top: 1 },
						borderColor: 'red',
						borderStyle: 'round'
					}
				)
			);
		} else {
			// Generic error handling for other errors
			displayError(error);
		}

		process.exit(1);
	}
}

/**
 * Resolve the final complexity-report path.
 * Rules:
 *  1. If caller passes --output, always respect it.
 *  2. If no explicit output AND tag === 'master' → default report file
 *  3. If no explicit output AND tag !== 'master' → append _<tag>.json
 *
 * @param {string|undefined} outputOpt  --output value from CLI (may be undefined)
 * @param {string} targetTag            resolved tag (defaults to 'master')
 * @param {string} projectRoot          absolute project root
 * @returns {string} absolute path for the report
 */
export function resolveComplexityReportPath({
	projectRoot,
	tag = 'master',
	output // may be undefined
}) {
	// 1. user knows best
	if (output) {
		return path.isAbsolute(output) ? output : path.join(projectRoot, output);
	}

	// 2. default naming
	const base = path.join(projectRoot, COMPLEXITY_REPORT_FILE);
	return tag !== 'master' ? base.replace('.json', `_${tag}.json`) : base;
}

export { registerCommands, setupCLI, runCLI, launchREPL };
