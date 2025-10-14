/**
 * tools/index.js
 * Export all Task Master CLI tools for MCP server
 */

import logger from '../logger.js';
import {
	toolRegistry,
	coreTools,
	standardTools,
	getAvailableTools,
	getToolRegistration,
	isValidTool
} from './tool-registry.js';

/**
 * Helper function to safely read and normalize the TASK_MASTER_TOOLS environment variable
 * @returns {string} The tools configuration string, defaults to 'all'
 */
export function getToolsConfiguration() {
	const rawValue = process.env.TASK_MASTER_TOOLS;

	if (!rawValue || rawValue.trim() === '') {
		logger.debug('No TASK_MASTER_TOOLS env var found, defaulting to "all"');
		return 'all';
	}

	const normalizedValue = rawValue.trim();
	logger.debug(`TASK_MASTER_TOOLS env var: "${normalizedValue}"`);
	return normalizedValue;
}

/**
 * Register Task Master tools with the MCP server
 * Supports selective tool loading via TASK_MASTER_TOOLS environment variable
 * @param {Object} server - FastMCP server instance
 * @param {string} toolMode - The tool mode configuration (defaults to 'all')
 * @returns {Object} Object containing registered tools, failed tools, and normalized mode
 */
export function registerTaskMasterTools(server, toolMode = 'all') {
	const registeredTools = [];
	const failedTools = [];

	try {
		const enabledTools = toolMode.trim();
		let toolsToRegister = [];

		const lowerCaseConfig = enabledTools.toLowerCase();

		switch (lowerCaseConfig) {
			case 'all':
				toolsToRegister = Object.keys(toolRegistry);
				logger.info('Loading all available tools');
				break;
			case 'core':
			case 'lean':
				toolsToRegister = coreTools;
				logger.info('Loading core tools only');
				break;
			case 'standard':
				toolsToRegister = standardTools;
				logger.info('Loading standard tools');
				break;
			default:
				const requestedTools = enabledTools
					.split(',')
					.map((t) => t.trim())
					.filter((t) => t.length > 0);

				const uniqueTools = new Set();
				const unknownTools = [];

				const aliasMap = {
					response_language: 'response-language'
				};

				for (const toolName of requestedTools) {
					let resolvedName = null;
					const lowerToolName = toolName.toLowerCase();

					if (aliasMap[lowerToolName]) {
						const aliasTarget = aliasMap[lowerToolName];
						for (const registryKey of Object.keys(toolRegistry)) {
							if (registryKey.toLowerCase() === aliasTarget.toLowerCase()) {
								resolvedName = registryKey;
								break;
							}
						}
					}

					if (!resolvedName) {
						for (const registryKey of Object.keys(toolRegistry)) {
							if (registryKey.toLowerCase() === lowerToolName) {
								resolvedName = registryKey;
								break;
							}
						}
					}

					if (!resolvedName) {
						const withHyphens = lowerToolName.replace(/_/g, '-');
						for (const registryKey of Object.keys(toolRegistry)) {
							if (registryKey.toLowerCase() === withHyphens) {
								resolvedName = registryKey;
								break;
							}
						}
					}

					if (!resolvedName) {
						const withUnderscores = lowerToolName.replace(/-/g, '_');
						for (const registryKey of Object.keys(toolRegistry)) {
							if (registryKey.toLowerCase() === withUnderscores) {
								resolvedName = registryKey;
								break;
							}
						}
					}

					if (resolvedName) {
						uniqueTools.add(resolvedName);
						logger.debug(`Resolved tool "${toolName}" to "${resolvedName}"`);
					} else {
						unknownTools.push(toolName);
						logger.warn(`Unknown tool specified: "${toolName}"`);
					}
				}

				toolsToRegister = Array.from(uniqueTools);

				if (unknownTools.length > 0) {
					logger.warn(`Unknown tools: ${unknownTools.join(', ')}`);
				}

				if (toolsToRegister.length === 0) {
					logger.warn(
						`No valid tools found in custom list. Loading all tools as fallback.`
					);
					toolsToRegister = Object.keys(toolRegistry);
				} else {
					logger.info(
						`Loading ${toolsToRegister.length} custom tools from list (${uniqueTools.size} unique after normalization)`
					);
				}
				break;
		}

		logger.info(
			`Registering ${toolsToRegister.length} MCP tools (mode: ${enabledTools})`
		);

		toolsToRegister.forEach((toolName) => {
			try {
				const registerFunction = getToolRegistration(toolName);
				if (registerFunction) {
					registerFunction(server);
					logger.debug(`Registered tool: ${toolName}`);
					registeredTools.push(toolName);
				} else {
					logger.warn(`Tool ${toolName} not found in registry`);
					failedTools.push(toolName);
				}
			} catch (error) {
				if (error.message && error.message.includes('already registered')) {
					logger.debug(`Tool ${toolName} already registered, skipping`);
					registeredTools.push(toolName);
				} else {
					logger.error(`Failed to register tool ${toolName}: ${error.message}`);
					failedTools.push(toolName);
				}
			}
		});

		logger.info(
			`Successfully registered ${registeredTools.length}/${toolsToRegister.length} tools`
		);
		if (failedTools.length > 0) {
			logger.warn(`Failed tools: ${failedTools.join(', ')}`);
		}

		return {
			registeredTools,
			failedTools,
			normalizedMode: lowerCaseConfig
		};
	} catch (error) {
		logger.error(
			`Error parsing TASK_MASTER_TOOLS environment variable: ${error.message}`
		);
		logger.info('Falling back to loading all tools');

		const fallbackTools = Object.keys(toolRegistry);
		for (const toolName of fallbackTools) {
			const registerFunction = getToolRegistration(toolName);
			if (registerFunction) {
				try {
					registerFunction(server);
					registeredTools.push(toolName);
				} catch (err) {
					if (err.message && err.message.includes('already registered')) {
						logger.debug(
							`Fallback tool ${toolName} already registered, skipping`
						);
						registeredTools.push(toolName);
					} else {
						logger.warn(
							`Failed to register fallback tool '${toolName}': ${err.message}`
						);
						failedTools.push(toolName);
					}
				}
			} else {
				logger.warn(`Tool '${toolName}' not found in registry`);
				failedTools.push(toolName);
			}
		}
		logger.info(
			`Successfully registered ${registeredTools.length} fallback tools`
		);

		return {
			registeredTools,
			failedTools,
			normalizedMode: 'all'
		};
	}
}

export {
	toolRegistry,
	coreTools,
	standardTools,
	getAvailableTools,
	getToolRegistration,
	isValidTool
};

export default {
	registerTaskMasterTools
};
