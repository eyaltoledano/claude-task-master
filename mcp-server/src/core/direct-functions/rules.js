/**
 * rules.js
 * Direct function implementation for adding or removing rules
 */

import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import {
	removeBrandRules,
	convertAllRulesToBrandRules,
	BRAND_NAMES,
	isValidBrand,
	getBrandProfile
} from '../../../../src/utils/rule-transformer.js';
import path from 'path';
import fs from 'fs';

/**
 * Direct function wrapper for adding or removing rules.
 * @param {Object} args - Command arguments
 * @param {"add"|"remove"} args.action - Action to perform: add or remove rules
 * @param {string[]} args.rules - List of rules to add or remove
 * @param {string} args.projectRoot - Absolute path to the project root
 * @param {boolean} [args.yes=true] - Run non-interactively
 * @param {Object} log - Logger object
 * @param {Object} context - Additional context (session)
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }
 */
export async function rulesDirect(args, log, context = {}) {
	enableSilentMode();
	try {
		const { action, rules, projectRoot, yes } = args;
		if (
			!action ||
			!Array.isArray(rules) ||
			rules.length === 0 ||
			!projectRoot
		) {
			return {
				success: false,
				error: {
					code: 'MISSING_ARGUMENT',
					message: 'action, rules, and projectRoot are required.'
				}
			};
		}

		const removalResults = [];
		const addResults = [];

		if (action === 'remove') {
			for (const brand of rules) {
				if (!isValidBrand(brand)) {
					removalResults.push({
						brandName: brand,
						success: false,
						error: `The requested rules for '${brand}' are unavailable. Supported rules are: ${BRAND_NAMES.join(', ')}.`
					});
					continue;
				}
				const profile = getBrandProfile(brand);
				const result = removeBrandRules(projectRoot, profile);
				removalResults.push(result);
			}
			const successes = removalResults
				.filter((r) => r.success)
				.map((r) => r.brandName);
			const skipped = removalResults
				.filter((r) => r.skipped)
				.map((r) => r.brandName);
			const errors = removalResults.filter(
				(r) => r.error && !r.success && !r.skipped
			);

			let summary = '';
			if (successes.length > 0) {
				summary += `Successfully removed rules: ${successes.join(', ')}.`;
			}
			if (skipped.length > 0) {
				summary += `Skipped (default or protected): ${skipped.join(', ')}.`;
			}
			if (errors.length > 0) {
				summary += errors
					.map((r) => `Error removing ${r.brandName}: ${r.error}`)
					.join(' ');
			}
			disableSilentMode();
			return {
				success: errors.length === 0,
				data: { summary, results: removalResults }
			};
		} else if (action === 'add') {
			for (const brand of rules) {
				if (!isValidBrand(brand)) {
					addResults.push({
						brandName: brand,
						success: false,
						error: `Profile not found: static import missing for '${brand}'. Valid brands: ${BRAND_NAMES.join(', ')}`
					});
					continue;
				}
				const profile = getBrandProfile(brand);
				const { success, failed } = convertAllRulesToBrandRules(
					projectRoot,
					profile
				);

				// Determine paths
				const rulesDir = profile.rulesDir;
				const brandRulesDir = path.join(projectRoot, rulesDir);
				const brandDir = profile.brandDir;
				const mcpConfig = profile.mcpConfig !== false;
				const mcpConfigName = profile.mcpConfigName || 'mcp.json';
				const mcpPath = path.join(projectRoot, brandDir, mcpConfigName);

				// Check what was created
				const mcpConfigCreated = mcpConfig ? fs.existsSync(mcpPath) : undefined;
				const rulesDirCreated = fs.existsSync(brandRulesDir);
				const brandFolderCreated = fs.existsSync(
					path.join(projectRoot, brandDir)
				);

				const error =
					failed > 0 ? `${failed} rule files failed to convert.` : null;
				const resultObj = {
					brandName: brand,
					mcpConfigCreated,
					rulesDirCreated,
					brandFolderCreated,
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
				.map((r) => r.brandName);
			const errors = addResults.filter((r) => r.error && !r.success);

			let summary = '';
			if (successes.length > 0) {
				summary += `Successfully added rules: ${successes.join(', ')}.`;
			}
			if (errors.length > 0) {
				summary += errors
					.map((r) => ` Error adding ${r.brandName}: ${r.error}`)
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
					message: 'Unknown action. Use "add" or "remove".'
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
