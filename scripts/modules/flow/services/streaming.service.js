/**
 * @fileoverview Streaming Service - Phase 4 Implementation
 *
 * Implements real-time streaming for task execution output, progress tracking,
 * and live updates using modern JavaScript patterns based on 2024-2025 best practices.
 */

import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';

/**
 * Message types for streaming updates
 */
export const MESSAGE_TYPES = {
	PROGRESS: 'progress',
	LOG: 'log',
	STATUS: 'status',
	ERROR: 'error',
	PHASE: 'phase'
};

/**
 * Log levels for structured logging
 */
const STREAMING_LOG_LEVELS = {
	DEBUG: 'debug',
	INFO: 'info',
	WARN: 'warn',
	ERROR: 'error'
};

/**
 * Create a structured streaming message
 * @param {string} type - Message type from MESSAGE_TYPES
 * @param {string} executionId - Execution ID
 * @param {Object} data - Message data
 * @returns {Object} Formatted message
 */
function createMessage(type, executionId, data) {
	return {
		type,
		executionId,
		timestamp: new Date().toISOString(),
		data: data || {}
	};
}

/**
 * Message formatter for consistent streaming message structure
 */
export const MessageFormatter = {
	/**
	 * Create a structured streaming message
	 */
	createMessage,

	/**
	 * Create a progress message
	 */
	progress(executionId, progress, phase = null, message = null) {
		return createMessage(MESSAGE_TYPES.PROGRESS, executionId, {
			progress: Math.round(progress),
			phase,
			message
		});
	},

	/**
	 * Create a log message
	 */
	log(executionId, level, message, details = null) {
		return createMessage(MESSAGE_TYPES.LOG, executionId, {
			log: {
				level,
				message,
				details
			}
		});
	},

	/**
	 * Create a status message
	 */
	status(executionId, status, phase = null) {
		return createMessage(MESSAGE_TYPES.STATUS, executionId, {
			status,
			phase
		});
	},

	/**
	 * Create an error message
	 */
	error(executionId, error, phase = null) {
		return createMessage(MESSAGE_TYPES.ERROR, executionId, {
			error: {
				message: error.message,
				name: error.name,
				stack: error.stack
			},
			phase
		});
	},

	/**
	 * Create a phase transition message
	 */
	phase(executionId, phase, message = null) {
		return createMessage(MESSAGE_TYPES.PHASE, executionId, {
			phase,
			message
		});
	}
};

/**
 * Progress tracker with throttling to prevent flooding
 */
export class ProgressTracker {
	constructor(executionId, emitter, throttleMs = 100) {
		this.executionId = executionId;
		this.emitter = emitter;
		this.throttleMs = throttleMs;
		this.lastEmitted = 0;
		this.pendingUpdate = null;
		this.currentProgress = 0;
		this.currentPhase = null;
	}

	/**
	 * Update progress with throttling
	 */
	updateProgress(progress, phase = null, message = null) {
		this.currentProgress = progress;
		this.currentPhase = phase;

		const now = Date.now();

		// If enough time has passed, emit immediately
		if (now - this.lastEmitted >= this.throttleMs) {
			this._emitProgress(progress, phase, message);
			return;
		}

		// Otherwise, schedule a throttled update
		if (this.pendingUpdate) {
			clearTimeout(this.pendingUpdate);
		}

		this.pendingUpdate = setTimeout(
			() => {
				this._emitProgress(this.currentProgress, this.currentPhase, message);
				this.pendingUpdate = null;
			},
			this.throttleMs - (now - this.lastEmitted)
		);
	}

	/**
	 * Force immediate progress emission (for completion, etc.)
	 */
	forceProgress(progress, phase = null, message = null) {
		if (this.pendingUpdate) {
			clearTimeout(this.pendingUpdate);
			this.pendingUpdate = null;
		}
		this._emitProgress(progress, phase, message);
	}

	_emitProgress(progress, phase, message) {
		this.lastEmitted = Date.now();
		const progressMessage = MessageFormatter.progress(
			this.executionId,
			progress,
			phase,
			message
		);
		this.emitter.emit('message', progressMessage);
	}

	cleanup() {
		if (this.pendingUpdate) {
			clearTimeout(this.pendingUpdate);
			this.pendingUpdate = null;
		}
	}
}

/**
 * Task output stream - Node.js Readable stream for CLI integration
 */
export class TaskOutputStream extends Readable {
	constructor(executionId, options = {}) {
		super({ objectMode: true, ...options });
		this.executionId = executionId;
		this.isEnded = false;
		this.messageBuffer = [];
	}

	_read() {
		// Readable stream will call this when ready for data
		// We'll push data via external methods
	}

	/**
	 * Push a streaming message to the stream
	 */
	pushMessage(message) {
		if (this.isEnded) return false;

		return this.push(message);
	}

	/**
	 * Push raw text output
	 */
	pushText(text) {
		if (this.isEnded) return false;

		const message = MessageFormatter.log(
			this.executionId,
			STREAMING_LOG_LEVELS.INFO,
			text
		);
		return this.push(message);
	}

	/**
	 * End the stream gracefully
	 */
	endStream() {
		if (!this.isEnded) {
			this.isEnded = true;
			this.push(null); // Signal end of stream
		}
	}

	/**
	 * Handle stream errors
	 */
	emitError(error) {
		if (!this.isEnded) {
			const errorMessage = MessageFormatter.error(this.executionId, error);
			this.push(errorMessage);
		}
		this.emit('error', error);
	}
}

/**
 * Main streaming service for managing real-time task execution streaming
 */
export class StreamingService {
	constructor() {
		this.executionEmitters = new Map(); // executionId -> EventEmitter
		this.outputStreams = new Map(); // executionId -> TaskOutputStream
		this.progressTrackers = new Map(); // executionId -> ProgressTracker
		this.subscriptions = new Map(); // executionId -> Set of listeners
	}

	/**
	 * Start streaming for an execution
	 */
	startStream(executionId) {
		if (this.executionEmitters.has(executionId)) {
			throw new Error(`Stream already started for execution ${executionId}`);
		}

		const emitter = new EventEmitter();
		const outputStream = new TaskOutputStream(executionId);
		const progressTracker = new ProgressTracker(executionId, emitter);

		// Forward emitter messages to output stream
		emitter.on('message', (message) => {
			outputStream.pushMessage(message);

			// Also emit to any direct listeners
			const listeners = this.subscriptions.get(executionId);
			if (listeners) {
				listeners.forEach((listener) => listener(message));
			}
		});

		this.executionEmitters.set(executionId, emitter);
		this.outputStreams.set(executionId, outputStream);
		this.progressTrackers.set(executionId, progressTracker);
		this.subscriptions.set(executionId, new Set());

		return {
			emitter,
			outputStream,
			progressTracker
		};
	}

	/**
	 * Stop streaming for an execution
	 */
	stopStream(executionId) {
		const emitter = this.executionEmitters.get(executionId);
		const outputStream = this.outputStreams.get(executionId);
		const progressTracker = this.progressTrackers.get(executionId);

		if (outputStream) {
			outputStream.endStream();
		}

		if (progressTracker) {
			progressTracker.cleanup();
		}

		if (emitter) {
			emitter.removeAllListeners();
		}

		this.executionEmitters.delete(executionId);
		this.outputStreams.delete(executionId);
		this.progressTrackers.delete(executionId);
		this.subscriptions.delete(executionId);
	}

	/**
	 * Get the output stream for an execution
	 */
	getOutputStream(executionId) {
		return this.outputStreams.get(executionId);
	}

	/**
	 * Get the progress tracker for an execution
	 */
	getProgressTracker(executionId) {
		return this.progressTrackers.get(executionId);
	}

	/**
	 * Subscribe to streaming messages for an execution
	 */
	subscribe(executionId, listener) {
		const listeners = this.subscriptions.get(executionId);
		if (listeners) {
			listeners.add(listener);
			return () => listeners.delete(listener); // Return unsubscribe function
		}
		return null;
	}

	/**
	 * Emit a log message
	 */
	emitLog(executionId, level, message, details = null) {
		const emitter = this.executionEmitters.get(executionId);
		if (emitter) {
			const logMessage = MessageFormatter.log(
				executionId,
				level,
				message,
				details
			);
			emitter.emit('message', logMessage);
		}
	}

	/**
	 * Emit a status change
	 */
	emitStatus(executionId, status, phase = null) {
		const emitter = this.executionEmitters.get(executionId);
		if (emitter) {
			const statusMessage = MessageFormatter.status(executionId, status, phase);
			emitter.emit('message', statusMessage);
		}
	}

	/**
	 * Emit a phase transition
	 */
	emitPhase(executionId, phase, message = null) {
		const emitter = this.executionEmitters.get(executionId);
		if (emitter) {
			const phaseMessage = MessageFormatter.phase(executionId, phase, message);
			emitter.emit('message', phaseMessage);
		}
	}

	/**
	 * Emit an error
	 */
	emitError(executionId, error, phase = null) {
		const emitter = this.executionEmitters.get(executionId);
		if (emitter) {
			const errorMessage = MessageFormatter.error(executionId, error, phase);
			emitter.emit('message', errorMessage);
		}
	}

	/**
	 * Update progress (throttled)
	 */
	updateProgress(executionId, progress, phase = null, message = null) {
		const progressTracker = this.progressTrackers.get(executionId);
		if (progressTracker) {
			progressTracker.updateProgress(progress, phase, message);
		}
	}

	/**
	 * Force immediate progress update
	 */
	forceProgress(executionId, progress, phase = null, message = null) {
		const progressTracker = this.progressTrackers.get(executionId);
		if (progressTracker) {
			progressTracker.forceProgress(progress, phase, message);
		}
	}

	/**
	 * Get async iterator for streaming messages
	 */
	async *streamMessages(executionId) {
		const outputStream = this.getOutputStream(executionId);
		if (!outputStream) {
			throw new Error(`No stream found for execution ${executionId}`);
		}

		try {
			for await (const message of outputStream) {
				yield message;
			}
		} catch (error) {
			// Stream error, emit error message and rethrow
			this.emitError(executionId, error);
			throw error;
		}
	}

	/**
	 * Check if streaming is active for execution
	 */
	isStreaming(executionId) {
		return this.executionEmitters.has(executionId);
	}

	/**
	 * Get list of active streams
	 */
	getActiveStreams() {
		return Array.from(this.executionEmitters.keys());
	}

	/**
	 * Clean up all streams
	 */
	cleanup() {
		for (const executionId of this.executionEmitters.keys()) {
			this.stopStream(executionId);
		}
	}
}

// Singleton instance for the service
export const streamingService = new StreamingService();
