import { ui } from '@tm/cli';
import type { TagInfo } from '@tm/core';
import boxen from 'boxen';
import chalk from 'chalk';
import Table from 'cli-table3';
import type { BaseBridgeParams } from './bridge-types.js';
import { checkStorageType } from './bridge-utils.js';

// Re-export for convenience
export type { TagInfo };

/**
 * Parameters for the tags bridge function
 */
export interface TagsBridgeParams extends BaseBridgeParams {
	/** Whether to show metadata (default: false) */
	showMetadata?: boolean;
	/** Skip table display (when interactive selection will follow) */
	skipTableDisplay?: boolean;
}

/**
 * Result returned when API storage handles the tags listing
 */
export interface RemoteTagsResult {
	success: boolean;
	tags: TagInfo[];
	currentTag: string | null;
	totalTags: number;
	message: string;
}

/**
 * Shared bridge function for list-tags command.
 * Checks if using API storage and delegates to remote service if so.
 *
 * For API storage, tags are called "briefs" and task counts are fetched
 * from the remote database.
 *
 * @param params - Bridge parameters
 * @returns Result object if API storage handled it, null if should fall through to file storage
 */
export async function tryListTagsViaRemote(
	params: TagsBridgeParams
): Promise<RemoteTagsResult | null> {
	const {
		projectRoot,
		isMCP = false,
		outputFormat = 'text',
		report,
		skipTableDisplay = false
	} = params;

	// Check storage type using shared utility
	const { isApiStorage, tmCore } = await checkStorageType(
		projectRoot,
		report,
		'falling back to file-based tags'
	);

	if (!isApiStorage || !tmCore) {
		// Not API storage - signal caller to fall through to file-based logic
		return null;
	}

	try {
		// Get tags with statistics from tm-core
		// Tags are already sorted by status and updatedAt from brief-service
		const tagsResult = await tmCore.tasks.getTagsWithStats();

		// Sort tags: current tag first, then preserve status/updatedAt ordering from service
		tagsResult.tags.sort((a, b) => {
			// Always keep current tag at the top
			if (a.isCurrent) return -1;
			if (b.isCurrent) return 1;
			// For non-current tags, preserve the status/updatedAt ordering already applied
			return 0;
		});

		if (outputFormat === 'text' && !isMCP && !skipTableDisplay) {
			// Display results in a table format
			if (tagsResult.tags.length === 0) {
				console.log(
					boxen(chalk.yellow('No tags found'), {
						padding: 1,
						borderColor: 'yellow',
						borderStyle: 'round',
						margin: { top: 1, bottom: 1 }
					})
				);
			} else {
				// Create table headers (with temporary Updated column)
				const headers = [
					chalk.cyan.bold('Tag Name'),
					chalk.cyan.bold('Status'),
					chalk.cyan.bold('Updated'),
					chalk.cyan.bold('Tasks'),
					chalk.cyan.bold('Completed')
				];

				// Calculate dynamic column widths based on terminal width
				const terminalWidth = Math.max(
					(process.stdout.columns as number) || 120,
					80
				);
				const usableWidth = Math.floor(terminalWidth * 0.95);

				// Column order: Tag Name, Status, Updated, Tasks, Completed
				const widths = [0.35, 0.25, 0.2, 0.1, 0.1];
				const colWidths = widths.map((w, i) =>
					Math.max(Math.floor(usableWidth * w), i === 0 ? 20 : 8)
				);

				const table = new Table({
					head: headers,
					colWidths: colWidths,
					wordWrap: true
				});

				// Add rows
				tagsResult.tags.forEach((tag) => {
					const row = [];

					// Tag name with current indicator and short ID (last 8 chars)
					const shortId = tag.briefId ? tag.briefId.slice(-8) : 'unknown';
					const tagDisplay = tag.isCurrent
						? `${chalk.green('●')} ${chalk.green.bold(tag.name)} ${chalk.gray(`(current - ${shortId})`)}`
						: `  ${tag.name} ${chalk.gray(`(${shortId})`)}`;
					row.push(tagDisplay);

					row.push(ui.getBriefStatusWithColor(tag.status, true));

					// Updated date (temporary for validation)
					const updatedDate = tag.updatedAt
						? new Date(tag.updatedAt).toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric',
								year: 'numeric',
								hour: '2-digit',
								minute: '2-digit'
							})
						: chalk.gray('N/A');
					row.push(chalk.gray(updatedDate));

					// Task counts
					row.push(chalk.white(tag.taskCount.toString()));
					row.push(chalk.green(tag.completedTasks.toString()));

					table.push(row);
				});

				console.log(table.toString());
			}
		}

		// Return success result - signals that we handled it
		return {
			success: true,
			tags: tagsResult.tags,
			currentTag: tagsResult.currentTag,
			totalTags: tagsResult.totalTags,
			message: `Found ${tagsResult.totalTags} tag(s)`
		};
	} catch (error) {
		// tm-core already formatted the error properly, just re-throw
		throw error;
	}
}
