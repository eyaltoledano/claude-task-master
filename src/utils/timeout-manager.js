import { StreamingError, STREAMING_ERROR_CODES } from './stream-parser.js';

/**
 * Utility class for managing timeouts in async operations
 * Reduces code duplication for timeout handling patterns
 */
export class TimeoutManager {
	/**
	 * Wraps a promise with a timeout that will reject if not resolved in time
	 *
	 * @param {Promise} promise - The promise to wrap with timeout
	 * @param {number} timeoutMs - Timeout duration in milliseconds
	 * @param {string} operationName - Name of the operation for error messages
	 * @returns {Promise} The result of the promise or throws timeout error
	 *
	 * @example
	 * const result = await TimeoutManager.withTimeout(
	 *   fetchData(),
	 *   5000,
	 *   'Data fetch operation'
	 * );
	 */
	static async withTimeout(promise, timeoutMs, operationName = 'Operation') {
		let timeoutHandle;

		const timeoutPromise = new Promise((_, reject) => {
			timeoutHandle = setTimeout(() => {
				reject(
					new StreamingError(
						`${operationName} timed out after ${timeoutMs / 1000} seconds`,
						STREAMING_ERROR_CODES.STREAM_PROCESSING_FAILED
					)
				);
			}, timeoutMs);
		});

		try {
			// Race between the actual promise and the timeout
			const result = await Promise.race([promise, timeoutPromise]);
			// Clear timeout if promise resolved first
			clearTimeout(timeoutHandle);
			return result;
		} catch (error) {
			// Always clear timeout on error
			clearTimeout(timeoutHandle);
			throw error;
		}
	}

	/**
	 * Wraps a promise with a timeout, but returns undefined instead of throwing on timeout
	 * Useful for optional operations that shouldn't fail the main flow
	 *
	 * @param {Promise} promise - The promise to wrap with timeout
	 * @param {number} timeoutMs - Timeout duration in milliseconds
	 * @param {*} defaultValue - Value to return on timeout (default: undefined)
	 * @returns {Promise} The result of the promise or defaultValue on timeout
	 *
	 * @example
	 * const usage = await TimeoutManager.withSoftTimeout(
	 *   getUsageStats(),
	 *   1000,
	 *   { tokens: 0 }
	 * );
	 */
	static async withSoftTimeout(promise, timeoutMs, defaultValue = undefined) {
		let timeoutHandle;

		const timeoutPromise = new Promise((resolve) => {
			timeoutHandle = setTimeout(() => {
				resolve(defaultValue);
			}, timeoutMs);
		});

		try {
			const result = await Promise.race([promise, timeoutPromise]);
			clearTimeout(timeoutHandle);
			return result;
		} catch (error) {
			// On error, clear timeout and return default value
			clearTimeout(timeoutHandle);
			return defaultValue;
		}
	}

	/**
	 * Creates a reusable timeout controller for multiple operations
	 * Useful when you need to apply the same timeout to multiple promises
	 *
	 * @param {number} timeoutMs - Timeout duration in milliseconds
	 * @param {string} operationName - Base name for operations
	 * @returns {Object} Controller with wrap method
	 *
	 * @example
	 * const controller = TimeoutManager.createController(60000, 'AI Service');
	 * const result1 = await controller.wrap(service.call1(), 'call 1');
	 * const result2 = await controller.wrap(service.call2(), 'call 2');
	 */
	static createController(timeoutMs, operationName = 'Operation') {
		return {
			timeoutMs,
			operationName,

			async wrap(promise, specificName = null) {
				const fullName = specificName
					? `${operationName} - ${specificName}`
					: operationName;
				return TimeoutManager.withTimeout(promise, timeoutMs, fullName);
			},

			async wrapSoft(promise, defaultValue = undefined) {
				return TimeoutManager.withSoftTimeout(promise, timeoutMs, defaultValue);
			}
		};
	}

	/**
	 * Checks if an error is a timeout error from this manager
	 *
	 * @param {Error} error - The error to check
	 * @returns {boolean} True if this is a timeout error
	 */
	static isTimeoutError(error) {
		return (
			error instanceof StreamingError &&
			error.code === STREAMING_ERROR_CODES.STREAM_PROCESSING_FAILED &&
			error.message.includes('timed out')
		);
	}
}

/**
 * Duration helper class for more readable timeout specifications
 */
export class Duration {
	constructor(value, unit = 'ms') {
		this.milliseconds = this._toMilliseconds(value, unit);
	}

	static milliseconds(value) {
		return new Duration(value, 'ms');
	}

	static seconds(value) {
		return new Duration(value, 's');
	}

	static minutes(value) {
		return new Duration(value, 'm');
	}

	static hours(value) {
		return new Duration(value, 'h');
	}

	get seconds() {
		return this.milliseconds / 1000;
	}

	get minutes() {
		return this.milliseconds / 60000;
	}

	get hours() {
		return this.milliseconds / 3600000;
	}

	toString() {
		if (this.milliseconds < 1000) {
			return `${this.milliseconds}ms`;
		} else if (this.milliseconds < 60000) {
			return `${this.seconds}s`;
		} else if (this.milliseconds < 3600000) {
			return `${Math.floor(this.minutes)}m ${Math.floor(this.seconds % 60)}s`;
		} else {
			return `${Math.floor(this.hours)}h ${Math.floor(this.minutes % 60)}m`;
		}
	}

	_toMilliseconds(value, unit) {
		const conversions = {
			ms: 1,
			s: 1000,
			m: 60000,
			h: 3600000
		};
		return value * (conversions[unit] || 1);
	}
}
