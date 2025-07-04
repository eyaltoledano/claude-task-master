import { EventEmitter } from 'events';

class BackgroundOperationsManager extends EventEmitter {
	constructor() {
		super();
		this.operations = new Map();
		this.operationResults = new Map();
	}

	// Register a new background operation
	registerOperation(operationId, operation) {
		this.operations.set(operationId, {
			id: operationId,
			status: 'running',
			startTime: new Date().toISOString(),
			operation,
			abortController: operation.abortController,
			messages: [],
			metadata: operation.metadata || {}
		});

		// Track messages
		if (operation.onMessage) {
			const originalOnMessage = operation.onMessage;
			operation.onMessage = (message) => {
				this.addMessage(operationId, message);
				originalOnMessage(message);
			};
		}

		this.emit('operation-started', operationId);
		return operationId;
	}

	// Add a message to an operation
	addMessage(operationId, message) {
		const op = this.operations.get(operationId);
		if (op) {
			op.messages.push(message);
			this.emit('operation-message', operationId, message);
		}
	}

	// Mark operation as completed
	completeOperation(operationId, result) {
		const op = this.operations.get(operationId);
		if (op) {
			op.status = 'completed';
			op.endTime = new Date().toISOString();
			op.result = result;
			this.operationResults.set(operationId, result);
			this.emit('operation-completed', operationId, result);
		}
	}

	// Mark operation as failed
	failOperation(operationId, error) {
		const op = this.operations.get(operationId);
		if (op) {
			op.status = 'failed';
			op.endTime = new Date().toISOString();
			op.error = error;
			this.emit('operation-failed', operationId, error);
		}
	}

	// Get operation status
	getOperation(operationId) {
		return this.operations.get(operationId);
	}

	// Get all operations
	getAllOperations() {
		return Array.from(this.operations.values());
	}

	// Get running operations
	getRunningOperations() {
		return this.getAllOperations().filter((op) => op.status === 'running');
	}

	// Check if any operations are running
	hasRunningOperations() {
		return this.getRunningOperations().length > 0;
	}

	// Abort a specific operation
	abortOperation(operationId) {
		const op = this.operations.get(operationId);
		if (op && op.status === 'running' && op.abortController) {
			op.abortController.abort();
			op.status = 'aborted';
			op.endTime = new Date().toISOString();
			this.emit('operation-aborted', operationId);
			return true;
		}
		return false;
	}

	// Get operation result if completed
	getOperationResult(operationId) {
		return this.operationResults.get(operationId);
	}

	// Clean up old operations (keep last 50)
	cleanup() {
		const ops = this.getAllOperations();
		if (ops.length > 50) {
			const toRemove = ops
				.sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
				.slice(0, ops.length - 50);

			toRemove.forEach((op) => {
				this.operations.delete(op.id);
				this.operationResults.delete(op.id);
			});
		}
	}
}

// Singleton instance
export const backgroundOperations = new BackgroundOperationsManager();
