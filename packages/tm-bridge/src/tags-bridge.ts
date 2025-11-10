import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import { createTmCore, type TmCore } from '@tm/core';
import { ui } from '@tm/cli';

/**
 * Tag information with task statistics
 */
export interface TagInfo {
	/** Tag name */
	name: string;
	/** Whether this is the current/active tag */
	isCurrent: boolean;
	/** Total number of tasks in this tag */
	taskCount: number;
	/** Number of completed tasks */
	completedTasks: number;
	/** Breakdown of tasks by status */
	statusBreakdown: Record<string, number>;
	/** Subtask counts if available */
	subtaskCounts?: {
		totalSubtasks: number;
		subtasksByStatus: Record<string, number>;
	};
	/** Tag creation date */
	created?: string;
	/** Tag description */
	description?: string;
	/** Brief/Tag status (for API storage briefs) */
	status?: string;
	/** Brief ID/UUID (for API storage) */
	briefId?: string;
}

/**
 * Parameters for the tags bridge function
 */
export interface TagsBridgeParams {
	/** Project root directory */
	projectRoot: string;
	/** Whether to show metadata (default: false) */
	showMetadata?: boolean;
	/** Whether called from MCP context (default: false) */
	isMCP?: boolean;
	/** Output format (default: 'text') */
	outputFormat?: 'text' | 'json';
	/** Logging function */
	report: (level: string, ...args: unknown[]) => void;
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
	const { projectRoot, isMCP = false, outputFormat = 'text', report } = params;

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
			`TmCore check failed, falling back to file-based tags: ${errorMessage}`
		);
		// Return null to signal fall-through to file storage logic
		return null;
	}

	// Check if we're using API storage (use resolved storage type, not config)
	const storageType = tmCore.tasks.getStorageType();

	if (storageType !== 'api') {
		// Not API storage - signal caller to fall through to file-based logic
		report('info', `Using file storage - processing tags locally`);
		return null;
	}

	// API STORAGE PATH: Get briefs with stats from remote
	report('info', `Fetching tags (briefs) from Hamster`);

	// Show CLI output if not MCP
	if (!isMCP && outputFormat === 'text') {
		console.log(
			boxen(chalk.blue.bold(`Fetching Tags from Hamster`), {
				padding: 1,
				borderColor: 'blue',
				borderStyle: 'round',
				margin: { top: 1, bottom: 1 }
			})
		);
	}

	try {
		// Get tags with statistics from tm-core
		// This will be implemented in the next step
		const tagsResult = await tmCore.tasks.getTagsWithStats();

		// Sort tags: current tag first, then alphabetically
		tagsResult.tags.sort((a, b) => {
			if (a.isCurrent) return -1;
			if (b.isCurrent) return 1;
			return a.name.localeCompare(b.name);
		});

		if (outputFormat === 'text' && !isMCP) {
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
				// Create table headers
				const headers = [
					chalk.cyan.bold('Tag Name'),
					chalk.cyan.bold('Status'),
					chalk.cyan.bold('Tasks'),
					chalk.cyan.bold('Completed')
				];

				// Calculate dynamic column widths based on terminal width
				const terminalWidth = Math.max(
					(process.stdout.columns as number) || 120,
					80
				);
				const usableWidth = Math.floor(terminalWidth * 0.95);

				// Column order: Tag Name, Status (UUID), Tasks, Completed
				const widths = [0.4, 0.38, 0.1, 0.12];
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
