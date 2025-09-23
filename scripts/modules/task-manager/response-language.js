import {
	getConfig,
	isConfigFilePresent,
	writeConfig
} from '../config-manager.js';
import { findConfigPath } from '../../../src/utils/path-utils.js';
import { log } from '../utils.js';

function setResponseLanguage(lang, options = {}) {
	const { mcpLog, projectRoot } = options;

	const report = (level, ...args) => {
		if (mcpLog && typeof mcpLog[level] === 'function') {
			mcpLog[level](...args);
		}
	};

	// Use centralized config path finding instead of hardcoded path
	const configPath = findConfigPath(null, { projectRoot });
	const configExists = isConfigFilePresent(projectRoot);

	log(
		'debug',
		`Checking for config file using findConfigPath, found: ${configPath}`
	);
	log(
		'debug',
		`Checking config file using isConfigFilePresent(), exists: ${configExists}`
	);

	if (!configExists) {
		return {
			success: false,
			error: {
				code: 'CONFIG_MISSING',
				message:
					'The configuration file is missing. Run "task-master init" to create it.'
			}
		};
	}

	// Validate response language
	if (typeof lang !== 'string' || lang.trim() === '') {
		return {
			success: false,
			error: {
				code: 'INVALID_RESPONSE_LANGUAGE',
				message: `Invalid response language: ${lang}. Must be a non-empty string.`
			}
		};
	}

	try {
		const currentConfig = getConfig(projectRoot);
		currentConfig.global.responseLanguage = lang;
		const writeResult = writeConfig(currentConfig, projectRoot);

		if (!writeResult) {
			return {
				success: false,
				error: {
					code: 'WRITE_ERROR',
					message: 'Error writing updated configuration to configuration file'
				}
			};
		}

		const successMessage = `Successfully set response language to: ${lang}`;
		report('info', successMessage);
		return {
			success: true,
			data: {
				responseLanguage: lang,
				message: successMessage
			}
		};
	} catch (error) {
		report('error', `Error setting response language: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'SET_RESPONSE_LANGUAGE_ERROR',
				message: error.message
			}
		};
	}
}

export default setResponseLanguage;
