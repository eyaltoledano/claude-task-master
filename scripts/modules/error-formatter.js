/**
 * error-formatter.js
 * Professional error message formatting with context-specific hints and sanitization
 */

import boxen from 'boxen';
import chalk from 'chalk';

/**
 * Error type categories for context-specific handling
 */
export const ERROR_TYPES = {
	AUTHENTICATION: 'authentication',
	VALIDATION: 'validation',
	NETWORK: 'network',
	API: 'api',
	FILE_SYSTEM: 'file_system',
	TASK: 'task',
	PERMISSION: 'permission',
	TIMEOUT: 'timeout',
	GENERIC: 'generic'
};

/**
 * Sensitive data patterns to sanitize from error messages
 */
const SENSITIVE_PATTERNS = [
	// API Keys and tokens
	/\b[A-Za-z0-9_-]{20,}\b/g, // Generic token pattern
	/sk-[A-Za-z0-9]{32,}/g, // OpenAI-style keys
	/api[_-]?key[:\s=]+[^\s]+/gi,
	/bearer\s+[^\s]+/gi,
	/token[:\s=]+[^\s]+/gi,

	// File paths that might contain user info
	/\/Users\/[^/]+/g,
	/C:\\Users\\[^\\]+/g,
	/\/home\/[^/]+/g,

	// Email addresses
	/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

	// URLs with auth
	/https?:\/\/[^:]+:[^@]+@/g
];

/**
 * Sanitize sensitive information from error messages
 * @param {string} message - The message to sanitize
 * @returns {string} Sanitized message
 */
function sanitizeMessage(message) {
	if (!message || typeof message !== 'string') return message;

	let sanitized = message;

	// Replace sensitive patterns
	for (const pattern of SENSITIVE_PATTERNS) {
		sanitized = sanitized.replace(pattern, '***REDACTED***');
	}

	return sanitized;
}

/**
 * Determine error type from error object
 * @param {Error|Object} error - Error object
 * @returns {string} Error type from ERROR_TYPES
 */
function categorizeError(error) {
	if (!error) return ERROR_TYPES.GENERIC;

	const message = (error.message || '').toLowerCase();
	const code = (error.code || '').toLowerCase();

	// Authentication errors
	if (
		message.includes('auth') ||
		message.includes('unauthorized') ||
		message.includes('forbidden') ||
		message.includes('api key') ||
		message.includes('token') ||
		code.includes('auth')
	) {
		return ERROR_TYPES.AUTHENTICATION;
	}

	// Validation errors
	if (
		message.includes('invalid') ||
		message.includes('validation') ||
		message.includes('required') ||
		message.includes('must be') ||
		code.includes('validation')
	) {
		return ERROR_TYPES.VALIDATION;
	}

	// Network errors
	if (
		message.includes('network') ||
		message.includes('connection') ||
		message.includes('econnrefused') ||
		message.includes('enotfound') ||
		code.includes('network') ||
		code.includes('econnrefused') ||
		code.includes('enotfound')
	) {
		return ERROR_TYPES.NETWORK;
	}

	// Timeout errors
	if (
		message.includes('timeout') ||
		message.includes('timed out') ||
		code.includes('timeout')
	) {
		return ERROR_TYPES.TIMEOUT;
	}

	// API errors
	if (
		message.includes('api') ||
		message.includes('rate limit') ||
		message.includes('quota') ||
		code.includes('api')
	) {
		return ERROR_TYPES.API;
	}

	// File system errors
	if (
		message.includes('enoent') ||
		message.includes('eacces') ||
		message.includes('file') ||
		message.includes('directory') ||
		code.includes('enoent') ||
		code.includes('eacces')
	) {
		return ERROR_TYPES.FILE_SYSTEM;
	}

	// Permission errors
	if (
		message.includes('permission') ||
		message.includes('access denied') ||
		code.includes('eperm')
	) {
		return ERROR_TYPES.PERMISSION;
	}

	// Task-specific errors
	if (message.includes('task') || message.includes('subtask')) {
		return ERROR_TYPES.TASK;
	}

	return ERROR_TYPES.GENERIC;
}

/**
 * Generate context-specific hints for an error
 * @param {string} errorType - Error type from ERROR_TYPES
 * @param {Error|Object} error - Original error object
 * @param {string} context - Additional context about what was being attempted
 * @returns {string[]} Array of hint strings
 */
function generateHints(errorType, error, context) {
	const hints = [];
	const message = (error.message || '').toLowerCase();

	switch (errorType) {
		case ERROR_TYPES.AUTHENTICATION:
			if (message.includes('api key')) {
				hints.push('Check that your API key is correctly set in the .env file');
				hints.push('Verify the API key has not expired or been revoked');
			} else if (message.includes('token')) {
				hints.push('Your authentication token may have expired');
				hints.push('Try running: tm auth refresh');
			} else {
				hints.push('Verify your credentials are correctly configured');
				hints.push('Check the authentication status with: tm auth status');
			}
			break;

		case ERROR_TYPES.VALIDATION:
			if (message.includes('brief id')) {
				hints.push('Brief IDs are case-insensitive (e.g., "ham32" = "HAM-32")');
				hints.push('Check the brief ID format: usually LETTERS-NUMBERS');
			} else if (
				message.includes('task id') ||
				message.includes('invalid id')
			) {
				hints.push('Task IDs should be numbers (e.g., 1, 2, 3)');
				hints.push('Subtask IDs use dot notation (e.g., 1.1, 2.3)');
			} else {
				hints.push('Check that all required parameters are provided');
				hints.push('Verify parameter values match expected formats');
			}
			break;

		case ERROR_TYPES.NETWORK:
			if (message.includes('econnrefused')) {
				hints.push('Could not connect to the server');
				hints.push('Check your internet connection');
				hints.push('Verify the API endpoint URL is correct');
			} else if (message.includes('enotfound')) {
				hints.push('Could not resolve the server hostname');
				hints.push('Check your internet connection');
			} else {
				hints.push('Check your network connection');
				hints.push('Verify firewall settings are not blocking the request');
			}
			break;

		case ERROR_TYPES.TIMEOUT:
			hints.push('The operation took too long to complete');
			hints.push('Try again with a simpler request');
			hints.push('Check your network speed and stability');
			break;

		case ERROR_TYPES.API:
			if (message.includes('rate limit')) {
				hints.push('You have exceeded the API rate limit');
				hints.push('Wait a few minutes before trying again');
			} else if (message.includes('quota')) {
				hints.push('You have reached your API quota');
				hints.push('Check your account usage and limits');
			} else {
				hints.push('The API returned an error');
				hints.push('Try again in a few moments');
			}
			break;

		case ERROR_TYPES.FILE_SYSTEM:
			if (message.includes('enoent')) {
				hints.push('The specified file or directory does not exist');
				hints.push('Check the file path and ensure it is correct');
				if (context.includes('tasks.json')) {
					hints.push('Initialize the project with: tm init');
				}
			} else if (message.includes('eacces')) {
				hints.push('Permission denied to access the file');
				hints.push('Check file permissions or run with appropriate privileges');
			} else {
				hints.push('Check that the file or directory exists and is accessible');
			}
			break;

		case ERROR_TYPES.PERMISSION:
			hints.push('You do not have permission to perform this operation');
			hints.push('Check file/directory permissions');
			hints.push('You may need elevated privileges (sudo)');
			break;

		case ERROR_TYPES.TASK:
			if (message.includes('not found')) {
				hints.push('The specified task does not exist');
				hints.push('Use: tm list to see all available tasks');
			} else if (
				message.includes('dependency') ||
				message.includes('circular')
			) {
				hints.push('Task dependencies form a circular reference');
				hints.push('Use: tm validate-dependencies to identify issues');
			} else {
				hints.push('Check that the task ID is correct');
				hints.push('Use: tm show <id> to view task details');
			}
			break;

		default:
			hints.push('Check the error message for specific details');
			if (context) {
				hints.push(`Operation failed while: ${context}`);
			}
	}

	// Limit to 2 hints max
	return hints.slice(0, 2);
}

/**
 * Format an error with context-specific hints and professional styling
 * @param {Error|Object|string} error - The error to format
 * @param {Object} options - Formatting options
 * @param {string} [options.context] - Context about what was being attempted
 * @param {boolean} [options.debug] - Include stack trace
 * @param {string} [options.command] - Command that was being executed
 * @returns {Object} Formatted error object
 */
export function formatError(error, options = {}) {
	const { context = '', debug = false, command = '' } = options;

	// Handle string errors
	if (typeof error === 'string') {
		error = new Error(error);
	}

	// Ensure error object
	if (!error || typeof error !== 'object') {
		error = new Error('An unknown error occurred');
	}

	// Sanitize the error message
	const sanitizedMessage = sanitizeMessage(error.message || 'Unknown error');

	// Categorize the error
	const errorType = categorizeError(error);

	// Generate context-specific hints
	const hints = generateHints(errorType, error, context);

	// Build formatted error object
	const formattedError = {
		type: errorType,
		message: sanitizedMessage,
		context: context || 'Unknown operation',
		hints,
		command: command || null,
		code: error.code || null,
		stack: debug ? sanitizeMessage(error.stack) : null
	};

	return formattedError;
}

/**
 * Display a formatted error message in the terminal
 * @param {Error|Object|string} error - The error to display
 * @param {Object} options - Display options
 * @param {string} [options.context] - Context about what was being attempted
 * @param {boolean} [options.debug] - Include stack trace
 * @param {string} [options.command] - Command that was being executed
 */
export function displayFormattedError(error, options = {}) {
	const formattedError = formatError(error, options);

	// Build error message content
	let content = chalk.red.bold('✗ Error\n\n');

	// Add error message
	content += chalk.white(formattedError.message) + '\n\n';

	// Add context if available
	if (
		formattedError.context &&
		formattedError.context !== 'Unknown operation'
	) {
		content +=
			chalk.gray('Context: ') + chalk.white(formattedError.context) + '\n\n';
	}

	// Add command if available
	if (formattedError.command) {
		content +=
			chalk.gray('Command: ') + chalk.cyan(formattedError.command) + '\n\n';
	}

	// Add hints
	if (formattedError.hints && formattedError.hints.length > 0) {
		content += chalk.yellow.bold('Suggestions:\n');
		formattedError.hints.forEach((hint, index) => {
			content += chalk.yellow(`  ${index + 1}. ${hint}\n`);
		});
	}

	// Add error code if available
	if (formattedError.code) {
		content += '\n' + chalk.gray(`Error Code: ${formattedError.code}`);
	}

	// Display in a box
	console.log(
		'\n' +
			boxen(content.trim(), {
				padding: { top: 1, bottom: 1, left: 2, right: 2 },
				borderStyle: 'round',
				borderColor: 'red'
			}) +
			'\n'
	);

	// Display stack trace in debug mode
	if (options.debug && formattedError.stack) {
		console.log(chalk.gray('Stack Trace:'));
		console.log(chalk.dim(formattedError.stack));
		console.log();
	}
}

/**
 * Display a warning message
 * @param {string} message - Warning message
 * @param {string[]} [hints] - Optional hints
 */
export function displayWarning(message, hints = []) {
	let content = chalk.yellow.bold('⚠ Warning\n\n');
	content += chalk.white(message);

	if (hints && hints.length > 0) {
		content += '\n\n' + chalk.yellow.bold('Suggestions:\n');
		hints.forEach((hint, index) => {
			content += chalk.yellow(`  ${index + 1}. ${hint}\n`);
		});
	}

	console.log(
		'\n' +
			boxen(content.trim(), {
				padding: { top: 1, bottom: 1, left: 2, right: 2 },
				borderStyle: 'round',
				borderColor: 'yellow'
			}) +
			'\n'
	);
}

/**
 * Display an informational message
 * @param {string} message - Info message
 * @param {string} [title] - Optional title
 */
export function displayInfo(message, title = 'Info') {
	let content = chalk.blue.bold(`ℹ ${title}\n\n`);
	content += chalk.white(message);

	console.log(
		'\n' +
			boxen(content.trim(), {
				padding: { top: 1, bottom: 1, left: 2, right: 2 },
				borderStyle: 'round',
				borderColor: 'blue'
			}) +
			'\n'
	);
}

/**
 * Display a success message
 * @param {string} message - Success message
 * @param {string[]} [nextSteps] - Optional next steps
 */
export function displaySuccess(message, nextSteps = []) {
	let content = chalk.green.bold('✓ Success\n\n');
	content += chalk.white(message);

	if (nextSteps && nextSteps.length > 0) {
		content += '\n\n' + chalk.cyan.bold('Next Steps:\n');
		nextSteps.forEach((step, index) => {
			content += chalk.cyan(`  ${index + 1}. ${step}\n`);
		});
	}

	console.log(
		'\n' +
			boxen(content.trim(), {
				padding: { top: 1, bottom: 1, left: 2, right: 2 },
				borderStyle: 'round',
				borderColor: 'green'
			}) +
			'\n'
	);
}
