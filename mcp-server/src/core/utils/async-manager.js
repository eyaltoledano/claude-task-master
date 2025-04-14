import { v4 as uuidv4 } from 'uuid';

class AsyncOperationManager {
	constructor() {
		this.operations = new Map(); // Stores active operation state
		this.completedOperations = new Map(); // Stores completed operations
		this.maxCompletedOperations = 100; // Maximum number of completed operations to store
		this.listeners = new Map(); // For potential future notifications
	}

	/**
	 * Adds an operation to be executed asynchronously.
	 * @param {Function} operationFn - The async function to execute (e.g., a Direct function).
	 * @param {Object} args - Arguments to pass to the operationFn.
	 * @param {Object} context - The MCP tool context { log, reportProgress, session }.
	 * @returns {string} The unique ID assigned to this operation.
	 */
	addOperation(operationFn, args, context) {
		const operationId = `op-${uuidv4()}`;
		const operation = {
			id: operationId,
			status: 'pending',
			startTime: Date.now(),
			endTime: null,
			result: null,
			error: null,
			// Store necessary parts of context, especially log for background execution
			log: context.log,
			reportProgress: context.reportProgress, // Pass reportProgress through
			session: context.session // Pass session through if needed by the operationFn
		};
		this.operations.set(operationId, operation);
		this.log(operationId, 'info', `Operation added.`);

		// Start execution in the background (don't await here)
		this._runOperation(operationId, operationFn, args, context).catch((err) => {
			// Catch unexpected errors during the async execution setup itself
			this.log(
				operationId,
				'error',
				`Critical error starting operation: ${err.message}`,
				{ stack: err.stack }
			);
			operation.status = 'failed';
			operation.error = {
				code: 'MANAGER_EXECUTION_ERROR',
				message: err.message
			};
			operation.endTime = Date.now();

			// Move to completed operations
			this._moveToCompleted(operationId);
		});

		return operationId;
	}

	/**
	 * Internal function to execute the operation.
	 * @param {string} operationId - The ID of the operation.
	 * @param {Function} operationFn - The async function to execute.
	 * @param {Object} args - Arguments for the function.
	 * @param {Object} context - The original MCP tool context.
	 */
	async _runOperation(operationId, operationFn, args, context) {
		const operation = this.operations.get(operationId);
		if (!operation) return; // Should not happen

		operation.status = 'running';
		this.log(operationId, 'info', `Operation running.`);
		this.emit('statusChanged', { operationId, status: 'running' });

		try {
			// Pass the necessary context parts to the direct function
			// The direct function needs to be adapted if it needs reportProgress
			// We pass the original context's log, plus our wrapped reportProgress
			const result = await operationFn(args, operation.log, {
				reportProgress: (progress) =>
					this._handleProgress(operationId, progress),
				mcpLog: operation.log, // Pass log as mcpLog if direct fn expects it
				session: operation.session
			});

			operation.status = result.success ? 'completed' : 'failed';
			operation.result = result.success ? result.data : null;
			operation.error = result.success ? null : result.error;
			this.log(
				operationId,
				'info',
				`Operation finished with status: ${operation.status}`
			);
		} catch (error) {
			this.log(
				operationId,
				'error',
				`Operation failed with error: ${error.message}`,
				{ stack: error.stack }
			);
			operation.status = 'failed';
			operation.error = {
				code: 'OPERATION_EXECUTION_ERROR',
				message: error.message
			};
		} finally {
			operation.endTime = Date.now();
			this.emit('statusChanged', {
				operationId,
				status: operation.status,
				result: operation.result,
				error: operation.error
			});

			// Move to completed operations if done or failed
			if (operation.status === 'completed' || operation.status === 'failed') {
				this._moveToCompleted(operationId);
			}
		}
	}

	/**
	 * Move an operation from active operations to completed operations history.
	 * @param {string} operationId - The ID of the operation to move.
	 * @private
	 */
	_moveToCompleted(operationId) {
		const operation = this.operations.get(operationId);
		if (!operation) return;

		// Store only the necessary data in completed operations
		const completedData = {
			id: operation.id,
			status: operation.status,
			startTime: operation.startTime,
			endTime: operation.endTime,
			result: operation.result,
			error: operation.error
		};

		this.completedOperations.set(operationId, completedData);
		this.operations.delete(operationId);

		// Trim completed operations if exceeding maximum
		if (this.completedOperations.size > this.maxCompletedOperations) {
			// Get the oldest operation (sorted by endTime)
			const oldest = [...this.completedOperations.entries()].sort(
				(a, b) => a[1].endTime - b[1].endTime
			)[0];

			if (oldest) {
				this.completedOperations.delete(oldest[0]);
			}
		}
	}

	/**
	 * Handles progress updates from the running operation and forwards them.
	 * @param {string} operationId - The ID of the operation reporting progress.
	 * @param {Object} progress - The progress object { progress, total? }.
	 */
	_handleProgress(operationId, progress) {
		const operation = this.operations.get(operationId);
		if (operation && operation.reportProgress) {
			try {
				// Use the reportProgress function captured from the original context
				operation.reportProgress(progress);
				this.log(
					operationId,
					'debug',
					`Reported progress: ${JSON.stringify(progress)}`
				);
			} catch (err) {
				this.log(
					operationId,
					'warn',
					`Failed to report progress: ${err.message}`
				);
				// Don't stop the operation, just log the reporting failure
			}
		}
	}

	/**
	 * Retrieves the status and result/error of an operation.
	 * @param {string} operationId - The ID of the operation.
	 * @returns {Object | null} The operation details or null if not found.
	 */
	getStatus(operationId) {
		// First check active operations
		const operation = this.operations.get(operationId);
		if (operation) {
			return {
				id: operation.id,
				status: operation.status,
				startTime: operation.startTime,
				endTime: operation.endTime,
				result: operation.result,
				error: operation.error
			};
		}

		// Then check completed operations
		const completedOperation = this.completedOperations.get(operationId);
		if (completedOperation) {
			return completedOperation;
		}

		// Operation not found in either active or completed
		return {
			error: {
				code: 'OPERATION_NOT_FOUND',
				message: `Operation ID ${operationId} not found. It may have been completed and removed from history, or the ID may be invalid.`
			},
			status: 'not_found'
		};
	}

	/**
	 * Internal logging helper to prefix logs with the operation ID.
	 * @param {string} operationId - The ID of the operation.
	 * @param {'info'|'warn'|'error'|'debug'} level - Log level.
	 * @param {string} message - Log message.
	 * @param {Object} [meta] - Additional metadata.
	 */
	log(operationId, level, message, meta = {}) {
		const operation = this.operations.get(operationId);
		// Use the logger instance associated with the operation if available, otherwise console
		const logger = operation?.log || console;
		const logFn = logger[level] || logger.log || console.log; // Fallback
		logFn(`[AsyncOp ${operationId}] ${message}`, meta);
	}

	// --- Basic Event Emitter ---
	on(eventName, listener) {
		if (!this.listeners.has(eventName)) {
			this.listeners.set(eventName, []);
		}
		this.listeners.get(eventName).push(listener);
	}

	emit(eventName, data) {
		if (this.listeners.has(eventName)) {
			this.listeners.get(eventName).forEach((listener) => listener(data));
		}
	}
}

// Export a singleton instance
const asyncOperationManager = new AsyncOperationManager();

// Export the manager and potentially the class if needed elsewhere
export { asyncOperationManager, AsyncOperationManager };
