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
function getToolsConfiguration() {
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
 */
export function registerTaskMasterTools(server) {
	try {
		const enabledTools = getToolsConfiguration();
		let toolsToRegister = [];
		
		const lowerCaseConfig = enabledTools.toLowerCase();
		
		switch(lowerCaseConfig) {
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
				const requestedTools = enabledTools.split(',')
					.map(t => t.trim())
					.filter(t => t.length > 0);
				
				toolsToRegister = requestedTools.filter(toolName => {
					if (toolRegistry[toolName]) {
						return true;
					} else {
						logger.warn(`Unknown tool specified: "${toolName}"`);
						return false;
					}
				});
				
				if (toolsToRegister.length === 0) {
					logger.warn(`No valid tools found in custom list. Loading all tools as fallback.`);
					toolsToRegister = Object.keys(toolRegistry);
				} else {
					logger.info(`Loading ${toolsToRegister.length} custom tools from list`);
				}
				break;
		}
		
		logger.info(`Registering ${toolsToRegister.length} MCP tools (mode: ${enabledTools})`);

		let successCount = 0;
		let failedTools = [];

		toolsToRegister.forEach(toolName => {
			try {
				if (toolRegistry[toolName]) {
					toolRegistry[toolName](server);
					logger.debug(`Registered tool: ${toolName}`);
					successCount++;
				} else {
					logger.warn(`Tool ${toolName} not found in registry`);
					failedTools.push(toolName);
				}
			} catch (error) {
				logger.error(`Failed to register tool ${toolName}: ${error.message}`);
				failedTools.push(toolName);
			}
		});

		logger.info(`Successfully registered ${successCount}/${toolsToRegister.length} tools`);
		if (failedTools.length > 0) {
			logger.warn(`Failed tools: ${failedTools.join(', ')}`);
		}
		
	} catch (error) {
		logger.error(`Error parsing TASK_MASTER_TOOLS environment variable: ${error.message}`);
		logger.info('Falling back to loading all tools');
		
		const fallbackTools = Object.keys(toolRegistry);
		let registeredCount = 0;
		for (const toolName of fallbackTools) {
			const registerFunction = getToolRegistration(toolName);
			if (registerFunction) {
				registerFunction(server);
				registeredCount++;
			} else {
				logger.warn(`Tool '${toolName}' not found in registry`);
			}
		}
		logger.info(`Successfully registered ${registeredCount} fallback tools`);
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
