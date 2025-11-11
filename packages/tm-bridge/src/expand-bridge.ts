import boxen from 'boxen';
import chalk from 'chalk';
import ora from 'ora';
import type { BaseBridgeParams } from './bridge-types.js';
import { checkStorageType } from './bridge-utils.js';

/**
 * Parameters for the expand bridge function
 */
export interface ExpandBridgeParams extends BaseBridgeParams {
	/** Task ID (can be numeric "1" or alphanumeric "TAS-49") */
	taskId: string | number;
	/** Number of subtasks to generate (optional) */
	numSubtasks?: number;
	/** Whether to use research AI */
	useResearch?: boolean;
	/** Additional context for generation */
	additionalContext?: string;
	/** Force regeneration even if subtasks exist */
	force?: boolean;
}

/**
 * Result returned when API storage handles the expansion
 */
export interface RemoteExpandResult {
	success: boolean;
	taskId: string | number;
	message: string;
	telemetryData: null;
	tagInfo: null;
}

/**
 * Shared bridge function for expand-task command.
 * Checks if using API storage and delegates to remote AI service if so.
 *
 * @param params - Bridge parameters
 * @returns Result object if API storage handled it, null if should fall through to file storage
 */
export async function tryExpandViaRemote(
	params: ExpandBridgeParams
): Promise<RemoteExpandResult | null> {
	const {
		taskId,
		numSubtasks,
		useResearch = false,
		additionalContext,
		force = false,
		projectRoot,
		tag,
		isMCP = false,
		outputFormat = 'text',
		report
	} = params;

	// Check storage type using shared utility
	const { isApiStorage, tmCore } = await checkStorageType(
		projectRoot,
		report,
		'falling back to file-based expansion'
	);

	if (!isApiStorage || !tmCore) {
		// Not API storage - signal caller to fall through to file-based logic
		return null;
	}

	// API STORAGE PATH: Delegate to remote AI service
	report('info', `Delegating expansion to Hamster for task ${taskId}`);

	// Show CLI output if not MCP
	if (!isMCP && outputFormat === 'text') {
		const showDebug = process.env.TM_DEBUG === '1';
		const contextPreview =
			showDebug && additionalContext
				? `${additionalContext.substring(0, 60)}${additionalContext.length > 60 ? '...' : ''}`
				: additionalContext
					? '[provided]'
					: '[none]';

		console.log(
			boxen(
				chalk.blue.bold(`Expanding Task via Hamster`) +
					'\n\n' +
					chalk.white(`Task ID: ${taskId}`) +
					'\n' +
					chalk.white(`Subtasks: ${numSubtasks || 'auto'}`) +
					'\n' +
					chalk.white(`Use Research: ${useResearch ? 'yes' : 'no'}`) +
					'\n' +
					chalk.white(`Force: ${force ? 'yes' : 'no'}`) +
					'\n' +
					chalk.white(`Context: ${contextPreview}`),
				{
					padding: 1,
					borderColor: 'blue',
					borderStyle: 'round',
					margin: { top: 1, bottom: 1 }
				}
			)
		);
	}

	const spinner =
		!isMCP && outputFormat === 'text'
			? ora({ text: 'Expanding task on Hamster...', color: 'cyan' }).start()
			: null;

	try {
		// Call the API storage method which handles the remote expansion
		const result = await tmCore.tasks.expand(String(taskId), tag, {
			numSubtasks,
			useResearch,
			additionalContext,
			force
		});

		if (spinner) {
			spinner.succeed('Task expansion queued successfully');
		}

		if (outputFormat === 'text') {
			// Build message conditionally based on result
			let messageLines = [
				chalk.green(`Successfully queued expansion for task ${taskId}`),
				'',
				chalk.white('The task expansion has been queued on Hamster'),
				chalk.white('Subtasks will be generated in the background.')
			];

			// Add task link if available
			if (result?.taskLink) {
				messageLines.push('');
				messageLines.push(
					chalk.white('View task: ') + chalk.blue.underline(result.taskLink)
				);
			}

			// Always add CLI alternative
			messageLines.push('');
			messageLines.push(
				chalk.dim(`Or run: ${chalk.yellow(`task-master show ${taskId}`)}`)
			);

			console.log(
				boxen(messageLines.join('\n'), {
					padding: 1,
					borderColor: 'green',
					borderStyle: 'round'
				})
			);
		}

		// Return success result - signals that we handled it
		return {
			success: true,
			taskId: taskId,
			message: result?.message || 'Task expansion queued via remote AI service',
			telemetryData: null,
			tagInfo: null
		};
	} catch (expandError) {
		if (spinner) {
			spinner.fail('Expansion failed');
		}

		// tm-core already formatted the error properly, just re-throw
		throw expandError;
	}
}
