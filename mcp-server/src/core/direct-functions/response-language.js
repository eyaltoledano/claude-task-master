/**
 * response-language.js
 * Direct function for managing response language via MCP
 */

import { setResponseLanguage } from '../../../../scripts/modules/task-manager.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import { createLogWrapper } from '../../tools/utils.js';

export async function responseLanguageDirect(args, log, context = {}) {
	const { projectRoot, language } = args;
	const mcpLog = createLogWrapper(log);

	log.info(
		`Executing response-language_direct with args: ${JSON.stringify(args)}`
	);
	log.info(`Using project root: ${projectRoot}`);

	try {
		enableSilentMode();
		return setResponseLanguage(language, {
			mcpLog,
			projectRoot
		});
	} catch (error) {
		return {
			success: false,
			error: {
				code: 'DIRECT_FUNCTION_ERROR',
				message: error.message,
				details: error.stack
			}
		};
	} finally {
		disableSilentMode();
	}
}
