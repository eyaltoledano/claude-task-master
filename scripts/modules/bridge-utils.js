import { getDebugFlag } from './config-manager.js';
import { log as consoleLog, isSilentMode } from './utils.js';

/**
 * Create a unified logger and report function for bridge operations
 * Handles both MCP and CLI contexts consistently
 *
 * @param {Object} mcpLog - Optional MCP logger object
 * @param {Object} [session] - Optional session object for debug flag checking
 * @returns {Object} Object containing logger, report function, and isMCP flag
 */
export function createBridgeLogger(mcpLog, session) {
	const isMCP = !!mcpLog;

	// Create logger that works in both contexts
	const logger = mcpLog || {
		info: (msg) => !isSilentMode() && consoleLog('info', msg),
		warn: (msg) => !isSilentMode() && consoleLog('warn', msg),
		error: (msg) => !isSilentMode() && consoleLog('error', msg),
		debug: (msg) =>
			!isSilentMode() && getDebugFlag(session) && consoleLog('debug', msg)
	};

	// Create report function compatible with bridge
	const report = (level, ...args) => {
		if (isMCP) {
			if (typeof logger[level] === 'function') logger[level](...args);
			else logger.info(...args);
		} else if (!isSilentMode()) {
			consoleLog(level, ...args);
		}
	};

	return { logger, report, isMCP };
}
