import boxen from 'boxen';
import chalk from 'chalk';
import ora from 'ora';
import type { BaseBridgeParams } from './bridge-types.js';
import { checkStorageType } from './bridge-utils.js';

/**
 * Parameters for the use-tag bridge function
 */
export interface UseTagBridgeParams extends BaseBridgeParams {
	/** Tag name to switch to */
	tagName: string;
}

/**
 * Result returned when API storage handles the tag switch
 */
export interface RemoteUseTagResult {
	success: boolean;
	previousTag: string | null;
	currentTag: string;
	switched: boolean;
	taskCount: number;
	message: string;
}

/**
 * Shared bridge function for use-tag command.
 * Checks if using API storage and delegates to remote service if so.
 *
 * For API storage, tags are called "briefs" and switching tags means
 * changing the current brief context.
 *
 * @param params - Bridge parameters
 * @returns Result object if API storage handled it, null if should fall through to file storage
 */
export async function tryUseTagViaRemote(
	params: UseTagBridgeParams
): Promise<RemoteUseTagResult | null> {
	const {
		tagName,
		projectRoot,
		isMCP = false,
		outputFormat = 'text',
		report
	} = params;

	// Check storage type using shared utility
	const { isApiStorage, tmCore } = await checkStorageType(
		projectRoot,
		report,
		'falling back to file-based tag switching'
	);

	if (!isApiStorage || !tmCore) {
		// Not API storage - signal caller to fall through to file-based logic
		return null;
	}

	// API STORAGE PATH: Switch brief in Hamster
	report('info', `Switching to tag (brief) "${tagName}" in Hamster`);

	// Show CLI output if not MCP
	if (!isMCP && outputFormat === 'text') {
		console.log(
			boxen(chalk.blue.bold(`Switching Tag in Hamster`), {
				padding: 1,
				borderColor: 'blue',
				borderStyle: 'round',
				margin: { top: 1, bottom: 1 }
			})
		);
	}

	const spinner =
		!isMCP && outputFormat === 'text'
			? ora({ text: `Switching to tag "${tagName}"...`, color: 'cyan' }).start()
			: null;

	try {
		// Get current context before switching
		const previousContext = tmCore.auth.getContext();
		const previousTag = previousContext?.briefName || null;

		// Switch to the new tag/brief
		// This will look up the brief by name and update the context
		await tmCore.tasks.switchTag(tagName);

		// Get updated context after switching
		const newContext = tmCore.auth.getContext();
		const currentTag = newContext?.briefName || tagName;

		// Get task count for the new tag
		const tasks = await tmCore.tasks.list();
		const taskCount = tasks.tasks.length;

		if (spinner) {
			spinner.succeed(`Switched to tag "${currentTag}"`);
		}

		if (outputFormat === 'text' && !isMCP) {
			// Display success message
			const briefId = newContext?.briefId
				? newContext.briefId.slice(-8)
				: 'unknown';
			console.log(
				boxen(
					chalk.green.bold('✓ Tag Switched Successfully') +
						'\n\n' +
						(previousTag
							? chalk.white(`Previous Tag: ${chalk.cyan(previousTag)}\n`)
							: '') +
						chalk.white(`Current Tag: ${chalk.green.bold(currentTag)}`) +
						'\n' +
						chalk.gray(`Brief ID: ${briefId}`) +
						'\n' +
						chalk.white(`Available Tasks: ${chalk.yellow(taskCount)}`),
					{
						padding: 1,
						borderColor: 'green',
						borderStyle: 'round',
						margin: { top: 1, bottom: 0 }
					}
				)
			);
		}

		// Return success result - signals that we handled it
		return {
			success: true,
			previousTag,
			currentTag,
			switched: true,
			taskCount,
			message: `Successfully switched to tag "${currentTag}"`
		};
	} catch (error) {
		if (spinner) {
			spinner.fail('Failed to switch tag');
		}

		// tm-core already formatted the error properly, just re-throw
		throw error;
	}
}
