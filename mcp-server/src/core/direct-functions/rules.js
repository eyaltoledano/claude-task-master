/**
 * rules.js
 * Direct function implementation for adding or removing brand rules
 */

import { execSync } from 'child_process';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';

/**
 * Direct function wrapper for adding or removing brand rules.
 * @param {Object} args - Command arguments
 * @param {"add"|"remove"} args.action - Action to perform: add or remove rules
 * @param {string[]} args.rules - List of brand rules to add or remove
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
		const rulesList = rules.join(',');
		const cmd = `npx task-master rules ${action} ${rulesList}`.trim();
		log.info(`[rulesDirect] Running: ${cmd} in ${projectRoot}`);
		const output = execSync(cmd, { cwd: projectRoot, encoding: 'utf8' });
		log.info(`[rulesDirect] Output: ${output}`);
		disableSilentMode();
		return { success: true, data: { output } };
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
