/**
 * @fileoverview Shared brief selection utilities
 * Reusable functions for selecting briefs interactively or via URL/ID
 */

import search from '@inquirer/search';
import type { AuthManager } from '@tm/core';
import { formatRelativeTime } from '@tm/core';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { getBriefStatusWithColor } from '../ui/formatters/status-formatters.js';
import * as ui from './ui.js';

export interface BriefSelectionResult {
	success: boolean;
	briefId?: string;
	briefName?: string;
	orgId?: string;
	orgName?: string;
	message?: string;
}

/**
 * Select a brief interactively using search
 */
export async function selectBriefInteractive(
	authManager: AuthManager,
	orgId: string
): Promise<BriefSelectionResult> {
	const spinner = ora('Fetching briefs...').start();

	try {
		// Fetch briefs from API
		const briefs = await authManager.getBriefs(orgId);
		spinner.stop();

		if (briefs.length === 0) {
			ui.displayWarning('No briefs available in this organization');
			return {
				success: false,
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

				// Filter briefs based on search term
				const filteredBriefs = briefs.filter((brief) => {
					if (!searchTerm) return true;

					const title = brief.document?.title || '';
					const shortId = brief.id.slice(0, 8);
					const lastChars = brief.id.slice(-8);

					// Search by title, full UUID, first 8 chars, or last 8 chars
					return (
						title.toLowerCase().includes(searchTerm) ||
						brief.id.toLowerCase().includes(searchTerm) ||
						shortId.toLowerCase().includes(searchTerm) ||
						lastChars.toLowerCase().includes(searchTerm)
					);
				});

				// Group briefs by status
				const briefsByStatus = filteredBriefs.reduce(
					(acc, brief) => {
						const status = brief.status || 'unknown';
						if (!acc[status]) {
							acc[status] = [];
						}
						acc[status].push(brief);
						return acc;
					},
					{} as Record<string, typeof briefs>
				);

				// Define status order (most active first)
				const statusOrder = [
					'delivering',
					'aligned',
					'refining',
					'draft',
					'delivered',
					'done',
					'archived'
				];

				// Build grouped options
				const groupedOptions: any[] = [];

				for (const status of statusOrder) {
					const statusBriefs = briefsByStatus[status];
					if (!statusBriefs || statusBriefs.length === 0) continue;

					// Add status header as separator
					const statusHeader = getBriefStatusWithColor(status);
					groupedOptions.push({
						type: 'separator',
						separator: `\n${statusHeader}`
					});

					// Add briefs under this status
					statusBriefs.forEach((brief) => {
						const title =
							brief.document?.title || `Brief ${brief.id.slice(-8)}`;
						const shortId = brief.id.slice(-8);
						const description = brief.document?.description || '';
						const taskCountDisplay =
							brief.taskCount !== undefined && brief.taskCount > 0
								? chalk.gray(
										` (${brief.taskCount} ${brief.taskCount === 1 ? 'task' : 'tasks'})`
									)
								: '';

						const updatedAtDisplay = brief.updatedAt
							? chalk.gray(` • ${formatRelativeTime(brief.updatedAt)}`)
							: '';

						groupedOptions.push({
							name: `  ${title}${taskCountDisplay} ${chalk.gray(`(${shortId})`)}${updatedAtDisplay}`,
							value: brief,
							description: description
								? chalk.gray(`  ${description.slice(0, 80)}`)
								: undefined
						});
					});
				}

				// Handle any briefs with statuses not in our order
				const unorderedStatuses = Object.keys(briefsByStatus).filter(
					(s) => !statusOrder.includes(s)
				);
				for (const status of unorderedStatuses) {
					const statusBriefs = briefsByStatus[status];
					if (!statusBriefs || statusBriefs.length === 0) continue;

					const statusHeader = getBriefStatusWithColor(status);
					groupedOptions.push({
						type: 'separator',
						separator: `\n${statusHeader}`
					});

					statusBriefs.forEach((brief) => {
						const title =
							brief.document?.title || `Brief ${brief.id.slice(-8)}`;
						const shortId = brief.id.slice(-8);
						const description = brief.document?.description || '';
						const taskCountDisplay =
							brief.taskCount !== undefined && brief.taskCount > 0
								? chalk.gray(
										` (${brief.taskCount} ${brief.taskCount === 1 ? 'task' : 'tasks'})`
									)
								: '';

						const updatedAtDisplay = brief.updatedAt
							? chalk.gray(` • ${formatRelativeTime(brief.updatedAt)}`)
							: '';

						groupedOptions.push({
							name: `  ${title}${taskCountDisplay} ${chalk.gray(`(${shortId})`)}${updatedAtDisplay}`,
							value: brief,
							description: description
								? chalk.gray(`  ${description.slice(0, 80)}`)
								: undefined
						});
					});
				}

				return [noBriefOption, ...groupedOptions];
			}
		});

		if (selectedBrief) {
			// Update context with brief
			const briefName =
				selectedBrief.document?.title ||
				`Brief ${selectedBrief.id.slice(0, 8)}`;
			await authManager.updateContext({
				briefId: selectedBrief.id,
				briefName: briefName,
				briefStatus: selectedBrief.status,
				briefUpdatedAt: selectedBrief.updatedAt
			});

			ui.displaySuccess(`Selected brief: ${briefName}`);

			return {
				success: true,
				briefId: selectedBrief.id,
				briefName,
				message: `Selected brief: ${briefName}`
			};
		} else {
			// Clear brief selection
			await authManager.updateContext({
				briefId: undefined,
				briefName: undefined,
				briefStatus: undefined,
				briefUpdatedAt: undefined
			});

			ui.displaySuccess('Cleared brief selection (organization level)');

			return {
				success: true,
				message: 'Cleared brief selection'
			};
		}
	} catch (error) {
		spinner.fail('Failed to fetch briefs');
		throw error;
	}
}

/**
 * Select a brief from any input format (URL, ID, name) using tm-core
 * Presentation layer - handles display and context updates only
 *
 * All business logic (URL parsing, ID matching, name resolution) is in tm-core
 */
export async function selectBriefFromInput(
	authManager: AuthManager,
	input: string,
	tmCore: any
): Promise<BriefSelectionResult> {
	let spinner: Ora | undefined;
	try {
		spinner = ora('Resolving brief...');
		spinner.start();

		// Let tm-core handle ALL business logic:
		// - URL parsing
		// - ID extraction
		// - UUID matching (full or last 8 chars)
		// - Name matching
		const brief = await tmCore.tasks.resolveBrief(input);

		// Fetch org to get a friendly name and slug (optional)
		let orgName: string | undefined;
		let orgSlug: string | undefined;
		try {
			const org = await authManager.getOrganization(brief.accountId);
			orgName = org?.name;
			orgSlug = org?.slug;
		} catch {
			// Non-fatal if org lookup fails
		}

		// Update context: set org and brief
		const briefName = brief.document?.title || `Brief ${brief.id.slice(0, 8)}`;
		await authManager.updateContext({
			orgId: brief.accountId,
			orgName,
			orgSlug,
			briefId: brief.id,
			briefName,
			briefStatus: brief.status,
			briefUpdatedAt: brief.updatedAt
		});

		spinner.succeed('Context set from brief');
		console.log(
			chalk.gray(
				`  Organization: ${orgName || brief.accountId}\n  Brief: ${briefName}`
			)
		);

		return {
			success: true,
			briefId: brief.id,
			briefName,
			orgId: brief.accountId,
			orgName,
			message: 'Context set from brief'
		};
	} catch (error) {
		try {
			if (spinner?.isSpinning) spinner.stop();
		} catch {}
		throw error;
	}
}
