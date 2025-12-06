/**
 * Centralized logging utility for Snowflake Cortex provider
 *
 * Provides consistent logging with debug-gated output based on
 * the DEBUG environment variable.
 */

/**
 * Check if debug mode is enabled for a specific namespace
 */
function isDebugEnabled(namespace: string): boolean {
	const debugEnv = process.env.DEBUG || '';
	return (
		debugEnv.includes(namespace) ||
		debugEnv.includes('snowflake:*') ||
		debugEnv === '*'
	);
}

/**
 * Logger instance for Snowflake Cortex provider
 */
export const logger = {
	/**
	 * Log a debug message (only shown when DEBUG includes the namespace)
	 */
	debug(namespace: string, message: string, ...args: unknown[]): void {
		if (isDebugEnabled(namespace)) {
			console.log(`[DEBUG ${namespace}]`, message, ...args);
		}
	},

	/**
	 * Log an info message
	 */
	info(message: string, ...args: unknown[]): void {
		console.log('[INFO snowflake]', message, ...args);
	},

	/**
	 * Log a warning message
	 */
	warn(message: string, ...args: unknown[]): void {
		console.warn('[WARN snowflake]', message, ...args);
	},

	/**
	 * Log an error message
	 */
	error(message: string, ...args: unknown[]): void {
		console.error('[ERROR snowflake]', message, ...args);
	},

	/**
	 * Log a warning only in debug mode for a specific namespace
	 */
	debugWarn(namespace: string, message: string, ...args: unknown[]): void {
		if (isDebugEnabled(namespace)) {
			console.warn(`[WARN ${namespace}]`, message, ...args);
		}
	}
};

export default logger;


