/**
 * @fileoverview Shared Organization Selection Utility
 * Provides reusable org selection flow for commands that require org context.
 */

import type { AuthManager } from '@tm/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import * as ui from './ui.js';

/**
 * Result of org selection
 */
export interface OrgSelectionResult {
	success: boolean;
	orgId?: string;
	orgName?: string;
	orgSlug?: string;
	message?: string;
}

/**
 * Options for ensureOrgSelected
 */
export interface EnsureOrgOptions {
	/** If true, suppress informational messages */
	silent?: boolean;
	/** Custom message to show when prompting */
	promptMessage?: string;
	/** If true, always prompt for org selection even if one is already set */
	forceSelection?: boolean;
}

/**
 * Ensure an organization is selected, prompting if necessary.
 *
 * This is a shared utility that can be used by any command that requires
 * an organization context. It will:
 * 1. Check if org is already selected in context
 * 2. If not, fetch orgs and auto-select if only one
 * 3. If multiple, prompt user to select
 *
 * @param authManager - The AuthManager instance
 * @param options - Optional configuration
 * @returns OrgSelectionResult with orgId if successful
 *
 * @example
 * ```typescript
 * const result = await ensureOrgSelected(authManager);
 * if (!result.success) {
 *   process.exit(1);
 * }
 * // Now we have result.orgId
 * ```
 */
export async function ensureOrgSelected(
	authManager: AuthManager,
	options: EnsureOrgOptions = {}
): Promise<OrgSelectionResult> {
	const { silent = false, promptMessage, forceSelection = false } = options;

	try {
		const context = authManager.getContext();

		// If org is already selected and we're not forcing selection, return it
		if (context?.orgId && !forceSelection) {
			return {
				success: true,
				orgId: context.orgId,
				orgName: context.orgName,
				orgSlug: context.orgSlug
			};
		}

		// Fetch available orgs
		const orgs = await authManager.getOrganizations();

		if (orgs.length === 0) {
			ui.displayError(
				'No organizations available. Please create or join an organization first.'
			);
			return {
				success: false,
				message: 'No organizations available'
			};
		}

		if (orgs.length === 1) {
			// Auto-select the only org
			await authManager.updateContext({
				orgId: orgs[0].id,
				orgName: orgs[0].name,
				orgSlug: orgs[0].slug
			});
			if (!silent) {
				console.log(
					chalk.gray(`  Auto-selected organization: ${orgs[0].name}`)
				);
			}
			return {
				success: true,
				orgId: orgs[0].id,
				orgName: orgs[0].name,
				orgSlug: orgs[0].slug
			};
		}

		// Multiple orgs - prompt for selection
		if (!silent && !context?.orgId) {
			console.log(chalk.yellow('No organization selected.'));
		}

		// Set default to current org if one is selected
		const defaultOrg = context?.orgId
			? orgs.findIndex((o) => o.id === context.orgId)
			: 0;

		const response = await inquirer.prompt<{ orgId: string }>([
			{
				type: 'list',
				name: 'orgId',
				message: promptMessage || 'Select an organization:',
				choices: orgs.map((org) => ({
					name: org.id === context?.orgId ? `${org.name} (current)` : org.name,
					value: org.id
				})),
				default: defaultOrg >= 0 ? defaultOrg : 0
			}
		]);

		const selectedOrg = orgs.find((o) => o.id === response.orgId);
		if (selectedOrg) {
			await authManager.updateContext({
				orgId: selectedOrg.id,
				orgName: selectedOrg.name,
				orgSlug: selectedOrg.slug
			});
			ui.displaySuccess(`Selected organization: ${selectedOrg.name}`);
			return {
				success: true,
				orgId: selectedOrg.id,
				orgName: selectedOrg.name,
				orgSlug: selectedOrg.slug
			};
		}

		return {
			success: false,
			message: 'Failed to select organization'
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		ui.displayError(`Failed to select organization: ${errorMessage}`);
		return {
			success: false,
			message: errorMessage
		};
	}
}

/**
 * Check if org is selected, returning the current org info without prompting.
 * Use this for non-interactive checks.
 */
export function getSelectedOrg(authManager: AuthManager): OrgSelectionResult {
	const context = authManager.getContext();

	if (context?.orgId) {
		return {
			success: true,
			orgId: context.orgId,
			orgName: context.orgName,
			orgSlug: context.orgSlug
		};
	}

	return {
		success: false,
		message: 'No organization selected'
	};
}
