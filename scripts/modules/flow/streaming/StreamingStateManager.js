/**
 * Streaming State Manager for Task Master Flow
 * Inspired by Gemini CLI's streaming context pattern
 */

export class StreamingStateManager {
	constructor() {
		this.reset();
		this.operationQueue = [];
		this.isProcessing = false;
	}

	reset() {
		this.state = 'idle';
		this.operation = null;
		this.startTime = null;
		this.elapsedTime = 0;
		this.message = '';
		this.context = {};
		this.abortController = null;
		this.onStateChange = null;
		this.onMessage = null;
		this.onComplete = null;
		this.onError = null;
		this.onCancel = null;
		this.currentPhase = '';
		this.phases = [];
		this.thinkingMessage = '';
	}

	// State transitions
	setState(newState, message = '', context = {}) {
		const prevState = this.state;
		this.state = newState;
		this.message = message;
		this.context = { ...this.context, ...context };

		if (newState === 'processing' && prevState !== 'processing') {
			this.startTime = Date.now();
			this.startElapsedTimer();
		}

		if (['completed', 'cancelled', 'error'].includes(newState)) {
			this.stopElapsedTimer();
		}

		this.notifyStateChange();
	}

	// Start an operation
	async startOperation(operationType, options = {}) {
		if (this.isProcessing) {
			// Queue the operation
			return new Promise((resolve, reject) => {
				this.operationQueue.push({ operationType, options, resolve, reject });
			});
		}

		return this.executeOperation(operationType, options);
	}

	async executeOperation(operationType, options = {}) {
		this.isProcessing = true;
		this.operation = operationType;
		this.abortController = new AbortController();

		// Set up operation-specific context
		const operationConfig = this.getOperationConfig(operationType);
		this.phases = operationConfig.phases;
		this.currentPhase = this.phases[0];

		try {
			this.setState('preparing', operationConfig.preparingMessage, {
				operationType,
				totalPhases: this.phases.length
			});

			// Simulate preparation time for better UX
			await this.delay(500);

			if (this.abortController.signal.aborted) {
				throw new Error('Operation cancelled');
			}

			this.setState('processing', operationConfig.processingMessage);

			// Execute the actual operation
			const result = await options.execute(this.abortController.signal, {
				onPhaseChange: (phase, message) => this.setPhase(phase, message),
				onThinking: (thinking) => this.setThinking(thinking),
				onProgress: (message) => this.setMessage(message)
			});

			this.setState('completed', operationConfig.completedMessage, { result });
			this.onComplete?.(result);

			return result;
		} catch (error) {
			if (error.message === 'Operation cancelled' || this.abortController.signal.aborted) {
				this.setState('cancelled', 'Operation cancelled by user');
				this.onCancel?.();
			} else {
				this.setState('error', `Error: ${error.message}`, { error });
				this.onError?.(error);
			}
			throw error;
		} finally {
			this.isProcessing = false;
			this.processQueue();
		}
	}

	// Process queued operations
	async processQueue() {
		if (this.operationQueue.length > 0 && !this.isProcessing) {
			const { operationType, options, resolve, reject } = this.operationQueue.shift();
			try {
				const result = await this.executeOperation(operationType, options);
				resolve(result);
			} catch (error) {
				reject(error);
			}
		}
	}

	// Cancel current operation
	cancel() {
		if (this.abortController && !this.abortController.signal.aborted) {
			this.abortController.abort();
		}
	}

	// Set current phase
	setPhase(phase, message = '') {
		this.currentPhase = phase;
		if (message) {
			this.setMessage(message);
		}
		this.notifyStateChange();
	}

	// Set thinking message
	setThinking(thinking) {
		this.thinkingMessage = thinking;
		this.notifyStateChange();
	}

	// Set progress message
	setMessage(message) {
		this.message = message;
		this.notifyStateChange();
	}

	// Elapsed time management
	startElapsedTimer() {
		this.elapsedTimer = setInterval(() => {
			if (this.startTime) {
				this.elapsedTime = Date.now() - this.startTime;
				this.notifyStateChange();
			}
		}, 100);
	}

	stopElapsedTimer() {
		if (this.elapsedTimer) {
			clearInterval(this.elapsedTimer);
			this.elapsedTimer = null;
		}
	}

	// Format elapsed time
	getFormattedElapsedTime() {
		const seconds = Math.floor(this.elapsedTime / 1000);
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;

		if (minutes > 0) {
			return `${minutes}m ${remainingSeconds}s`;
		}
		return `${remainingSeconds}s`;
	}

	// Notify state change
	notifyStateChange() {
		this.onStateChange?.({
			state: this.state,
			operation: this.operation,
			message: this.message,
			context: this.context,
			elapsedTime: this.elapsedTime,
			formattedElapsedTime: this.getFormattedElapsedTime(),
			currentPhase: this.currentPhase,
			phases: this.phases,
			thinkingMessage: this.thinkingMessage,
			canCancel: ['preparing', 'processing'].includes(this.state)
		});
	}

	// Operation configurations with contextual messages
	getOperationConfig(operationType) {
		const configs = {
			parse_prd: {
				phases: ['analyzing', 'generating', 'structuring'],
				preparingMessage: 'Preparing to parse Product Requirements Document...',
				processingMessage: 'Analyzing document structure and generating tasks...',
				completedMessage: 'Successfully generated tasks from PRD',
				thinkingMessages: [
					'Reading through the document sections...',
					'Identifying key features and requirements...',
					'Breaking down into implementable tasks...',
					'Organizing tasks by priority and dependencies...'
				]
			},
			analyze_complexity: {
				phases: ['scanning', 'evaluating', 'scoring'],
				preparingMessage: 'Preparing complexity analysis...',
				processingMessage: 'Analyzing task complexity with AI insights...',
				completedMessage: 'Complexity analysis complete',
				thinkingMessages: [
					'Scanning all task descriptions...',
					'Evaluating implementation complexity...',
					'Considering technical dependencies...',
					'Calculating complexity scores...'
				]
			},
			expand_task: {
				phases: ['planning', 'expanding', 'organizing'],
				preparingMessage: 'Preparing task expansion...',
				processingMessage: 'Breaking down task into detailed subtasks...',
				completedMessage: 'Task successfully expanded into subtasks',
				thinkingMessages: [
					'Understanding task requirements...',
					'Planning implementation approach...',
					'Identifying subtask boundaries...',
					'Organizing subtasks logically...'
				]
			},
			expand_all: {
				phases: ['planning', 'expanding', 'organizing'],
				preparingMessage: 'Preparing to expand all tasks...',
				processingMessage: 'Expanding multiple tasks with AI assistance...',
				completedMessage: 'All tasks successfully expanded',
				thinkingMessages: [
					'Analyzing all pending tasks...',
					'Planning expansion strategy...',
					'Generating subtasks for each task...',
					'Ensuring consistency across expansions...'
				]
			}
		};

		return configs[operationType] || {
			phases: ['processing'],
			preparingMessage: 'Preparing operation...',
			processingMessage: 'Processing...',
			completedMessage: 'Operation completed',
			thinkingMessages: ['Working on your request...']
		};
	}

	// Utility delay function
	delay(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	// Event handlers
	onStateChange(callback) {
		this.onStateChange = callback;
	}

	onMessage(callback) {
		this.onMessage = callback;
	}

	onComplete(callback) {
		this.onComplete = callback;
	}

	onError(callback) {
		this.onError = callback;
	}

	onCancel(callback) {
		this.onCancel = callback;
	}

	// Cleanup
	destroy() {
		this.stopElapsedTimer();
		this.cancel();
		this.reset();
	}
}

// Global instance
export const streamingStateManager = new StreamingStateManager(); 