import boxen from 'boxen';
import chalk from 'chalk';
import ora from 'ora';
import type { BaseBridgeParams } from './bridge-types.js';
import { checkStorageType } from './bridge-utils.js';

/**
 * Parameters for the update bridge function
 */
export interface UpdateBridgeParams extends BaseBridgeParams {
	/** Task ID (can be numeric "1", alphanumeric "TAS-49", or dotted "1.2" or "TAS-49.1") */
	taskId: string | number;
	/** Update prompt for AI */
	prompt: string;
	/** Whether to append or full update (default: false) */
	appendMode?: boolean;
}

/**
 * Result returned when API storage handles the update
 */
export interface RemoteUpdateResult {
	success: boolean;
	taskId: string | number;
	message: string;
	telemetryData: null;
	tagInfo: null;
}

/**
 * Shared bridge function for update-task and update-subtask commands.
 * Checks if using API storage and delegates to remote AI service if so.
 *
 * In API storage, tasks and subtasks are treated identically - there's no
 * parent/child hierarchy, so update-task and update-subtask can be used
 * interchangeably.
 *
 * @param params - Bridge parameters
 * @returns Result object if API storage handled it, null if should fall through to file storage
 */
export async function tryUpdateViaRemote(
	params: UpdateBridgeParams
): Promise<RemoteUpdateResult | null> {
	const {
		taskId,
		prompt,
		projectRoot,
		tag,
		appendMode = false,
		isMCP = false,
		outputFormat = 'text',
		report
	} = params;

	// Check storage type using shared utility
	const { isApiStorage, tmCore } = await checkStorageType(
		projectRoot,
		report,
		'falling back to file-based update'
	);

	if (!isApiStorage || !tmCore) {
		// Not API storage - signal caller to fall through to file-based logic
		return null;
	}

	// API STORAGE PATH: Delegate to remote AI service
	report('info', `Delegating update to Hamster for task ${taskId}`);

	const mode = appendMode ? 'append' : 'update';

	// Show CLI output if not MCP
	if (!isMCP && outputFormat === 'text') {
		const showDebug = process.env.TM_DEBUG === '1';
		const promptPreview = showDebug
			? `${prompt.substring(0, 60)}${prompt.length > 60 ? '...' : ''}`
			: '[hidden]';

		console.log(
			boxen(
				chalk.blue.bold(`Updating Task via Hamster`) +
					'\n\n' +
					chalk.white(`Task ID: ${taskId}`) +
					'\n' +
					chalk.white(`Mode: ${mode}`) +
					'\n' +
					chalk.white(`Prompt: ${promptPreview}`),
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
			? ora({ text: 'Updating task on Hamster...', color: 'cyan' }).start()
			: null;

	try {
		// Call the API storage method which handles the remote update
		await tmCore.tasks.updateWithPrompt(String(taskId), prompt, tag, {
			mode
		});

		if (spinner) {
			spinner.succeed('Task updated successfully');
		}

		if (outputFormat === 'text') {
			console.log(
				boxen(
					chalk.green(`Successfully updated task ${taskId} via remote AI`) +
						'\n\n' +
						chalk.white('The task has been updated on the remote server.') +
						'\n' +
						chalk.white(
							`Run ${chalk.yellow(`task-master show ${taskId}`)} to view the updated task.`
						),
					{
						padding: 1,
						borderColor: 'green',
						borderStyle: 'round'
					}
				)
			);
		}

		// Return success result - signals that we handled it
		return {
			success: true,
			taskId: taskId,
			message: 'Task updated via remote AI service',
			telemetryData: null,
			tagInfo: null
		};
	} catch (updateError) {
		if (spinner) {
			spinner.fail('Update failed');
		}

		// tm-core already formatted the error properly, just re-throw
		throw updateError;
	}
}
