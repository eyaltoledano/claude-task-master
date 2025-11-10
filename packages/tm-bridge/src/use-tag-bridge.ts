import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import { createTmCore, type TmCore } from '@tm/core';

/**
 * Parameters for the use-tag bridge function
 */
export interface UseTagBridgeParams {
	/** Tag name to switch to */
	tagName: string;
	/** Project root directory */
	projectRoot: string;
	/** Whether called from MCP context (default: false) */
	isMCP?: boolean;
	/** Output format (default: 'text') */
	outputFormat?: 'text' | 'json';
	/** Logging function */
	report: (level: string, ...args: unknown[]) => void;
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

	let tmCore: TmCore;

	try {
		tmCore = await createTmCore({
			projectPath: projectRoot || process.cwd()
		});
	} catch (tmCoreError) {
		const errorMessage =
			tmCoreError instanceof Error ? tmCoreError.message : String(tmCoreError);
		report(
			'warn',
			`TmCore check failed, falling back to file-based tag switching: ${errorMessage}`
		);
		// Return null to signal fall-through to file storage logic
		return null;
	}

	// Check if we're using API storage (use resolved storage type, not config)
	const storageType = tmCore.tasks.getStorageType();

	if (storageType !== 'api') {
		// Not API storage - signal caller to fall through to file-based logic
		report('info', `Using file storage - switching tags locally`);
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
