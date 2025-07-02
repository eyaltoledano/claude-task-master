import path from 'path';
import fs from 'fs';
import {
	getConfig,
	isConfigFilePresent,
	writeConfig
} from '../config-manager.js';

function setResponseLanguage(lang, options = {}) {
	const { mcpLog, projectRoot } = options;

	const report = (level, ...args) => {
		if (mcpLog && typeof mcpLog[level] === 'function') {
			mcpLog[level](...args);
		}
	};

	let configPath;
	let configExists = false;

	if (projectRoot) {
		configPath = path.join(projectRoot, '.taskmasterconfig');
		configExists = fs.existsSync(configPath);
		report(
			'info',
			`Checking for .taskmasterconfig at: ${configPath}, exists: ${configExists}`
		);
	} else {
		configExists = isConfigFilePresent();
		report(
			'info',
			`Checking for .taskmasterconfig using isConfigFilePresent(), exists: ${configExists}`
		);
	}

	if (!configExists) {
		return {
			success: false,
			error: {
				code: 'CONFIG_MISSING',
				message:
					'The .taskmasterconfig file is missing. Run "task-master models --setup" to create it.'
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
					message: 'Error writing updated configuration to .taskmasterconfig'
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
