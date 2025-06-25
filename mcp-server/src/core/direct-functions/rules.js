/**
 * rules.js
 * Direct function implementation for adding or removing rules
 */

import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import {
	convertAllRulesToProfileRules,
	removeProfileRules,
	getRulesProfile,
	isValidProfile
} from '../../../../src/utils/rule-transformer.js';
import { RULE_PROFILES } from '../../../../src/constants/profiles.js';
import { RULES_ACTIONS } from '../../../../src/constants/rules-actions.js';
import {
	wouldRemovalLeaveNoProfiles,
	getInstalledProfiles
} from '../../../../src/utils/profiles.js';
import path from 'path';
import fs from 'fs';

/**
 * Direct function wrapper for adding or removing rules.
 * @param {Object} args - Command arguments
 * @param {"add"|"remove"} args.action - Action to perform: add or remove rules
 * @param {string[]} args.profiles - List of profiles to add or remove
 * @param {string} args.projectRoot - Absolute path to the project root
 * @param {boolean} [args.yes=true] - Run non-interactively
 * @param {Object} log - Logger object
 * @param {Object} context - Additional context (session)
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }
 */
export async function rulesDirect(args, log, context = {}) {
	enableSilentMode();
	try {
		const { action, profiles, projectRoot, yes, force } = args;
		if (
			!action ||
			!Array.isArray(profiles) ||
			profiles.length === 0 ||
			!projectRoot
		) {
			return {
				success: false,
				error: {
					code: 'MISSING_ARGUMENT',
					message: 'action, profiles, and projectRoot are required.'
				}
			};
		}

		const removalResults = [];
		const addResults = [];

		if (action === RULES_ACTIONS.REMOVE) {
			// Safety check: Ensure this won't remove all rule profiles (unless forced)
			if (!force && wouldRemovalLeaveNoProfiles(projectRoot, profiles)) {
				const installedProfiles = getInstalledProfiles(projectRoot);
				const remainingProfiles = installedProfiles.filter(
					(profile) => !profiles.includes(profile)
				);
				return {
					success: false,
					error: {
						code: 'CRITICAL_REMOVAL_BLOCKED',
						message: `CRITICAL: This operation would remove ALL remaining rule profiles (${profiles.join(', ')}), leaving your project with no rules configurations. This could significantly impact functionality. Currently installed profiles: ${installedProfiles.join(', ')}. If you're certain you want to proceed, set force: true or use the CLI with --force flag.`
					}
				};
			}

			for (const profile of profiles) {
				if (!isValidProfile(profile)) {
					removalResults.push({
						profileName: profile,
						success: false,
						error: `The requested rule profile for '${profile}' is unavailable. Supported profiles are: ${RULE_PROFILES.join(', ')}.`
					});
					continue;
				}
				const profileConfig = getRulesProfile(profile);
				const result = removeProfileRules(projectRoot, profileConfig);
				removalResults.push(result);
			}
			const successes = removalResults
				.filter((r) => r.success)
				.map((r) => r.profileName);
			const skipped = removalResults
				.filter((r) => r.skipped)
				.map((r) => r.profileName);
			const errors = removalResults.filter(
				(r) => r.error && !r.success && !r.skipped
			);
			const withNotices = removalResults.filter((r) => r.notice);

			let summary = '';
			if (successes.length > 0) {
				summary += `Successfully removed Task Master rules: ${successes.join(', ')}.`;
			}
			if (skipped.length > 0) {
				summary += `Skipped (default or protected): ${skipped.join(', ')}.`;
			}
			if (errors.length > 0) {
				summary += errors
					.map((r) => `Error removing ${r.profileName}: ${r.error}`)
					.join(' ');
			}
			if (withNotices.length > 0) {
				summary += ` Notices: ${withNotices.map((r) => `${r.profileName} - ${r.notice}`).join('; ')}.`;
			}
			disableSilentMode();
			return {
				success: errors.length === 0,
				data: { summary, results: removalResults }
			};
		} else if (action === RULES_ACTIONS.ADD) {
			for (const profile of profiles) {
				if (!isValidProfile(profile)) {
					addResults.push({
						profileName: profile,
						success: false,
						error: `Profile not found: static import missing for '${profile}'. Valid profiles: ${RULE_PROFILES.join(', ')}`
					});
					continue;
				}
				const profileConfig = getRulesProfile(profile);
				const { success, failed } = convertAllRulesToProfileRules(
					projectRoot,
					profileConfig
				);

				// Determine paths
				const rulesDir = profileConfig.rulesDir;
				const profileRulesDir = path.join(projectRoot, rulesDir);
				const profileDir = profileConfig.profileDir;
				const mcpConfig = profileConfig.mcpConfig !== false;
				const mcpPath =
					mcpConfig && profileConfig.mcpConfigPath
						? path.join(projectRoot, profileConfig.mcpConfigPath)
						: null;

				// Check what was created
				const mcpConfigCreated =
					mcpConfig && mcpPath ? fs.existsSync(mcpPath) : undefined;
				const rulesDirCreated = fs.existsSync(profileRulesDir);
				const profileFolderCreated = fs.existsSync(
					path.join(projectRoot, profileDir)
				);

				const error =
					failed > 0 ? `${failed} rule files failed to convert.` : null;
				const resultObj = {
					profileName: profile,
					mcpConfigCreated,
					rulesDirCreated,
					profileFolderCreated,
					skipped: false,
					error,
					success:
						(mcpConfig ? mcpConfigCreated : true) &&
						rulesDirCreated &&
						success > 0 &&
						!error
				};
				addResults.push(resultObj);
			}

			const successes = addResults
				.filter((r) => r.success)
				.map((r) => r.profileName);
			const errors = addResults.filter((r) => r.error && !r.success);

			let summary = '';
			if (successes.length > 0) {
				summary += `Successfully added rules: ${successes.join(', ')}.`;
			}
			if (errors.length > 0) {
				summary += errors
					.map((r) => ` Error adding ${r.profileName}: ${r.error}`)
					.join(' ');
			}
			disableSilentMode();
			return {
				success: errors.length === 0,
				data: { summary, results: addResults }
			};
		} else {
			disableSilentMode();
			return {
				success: false,
				error: {
					code: 'INVALID_ACTION',
					message: `Unknown action. Use "${RULES_ACTIONS.ADD}" or "${RULES_ACTIONS.REMOVE}".`
				}
			};
		}
	} catch (error) {
		disableSilentMode();
		log.error(`[rulesDirect] Error: ${error.message}`);
		return {
			success: false,
			error: {
				code: error.code || 'RULES_ERROR',
				message: error.message
			}
		};
	}
}
