/**
 * StateManager - Manages optimistic UI updates with rollback capabilities
 * Provides <200ms response time for drag-and-drop operations
 *
 * @module StateManager
 */

class StateManager {
	/**
	 * Create a new StateManager instance
	 * @param {Object} options - Configuration options
	 * @param {number} options.maxHistorySize - Maximum number of history states to keep (default: 10)
	 * @param {number} options.debounceDelay - Delay for debouncing DOM updates in ms (default: 0)
	 * @param {boolean} options.enableAnimations - Enable visual animations (default: true)
	 */
	constructor(options = {}) {
		this.options = {
			maxHistorySize: 10,
			debounceDelay: 0,
			enableAnimations: true,
			...options
		};

		// State tracking
		this.currentState = {};
		this.pendingChanges = [];
		this.history = [];

		// Performance optimization
		this.updateTimer = null;
		this.batchedUpdates = [];
		this.rafId = null;

		// Change tracking
		this.changeCounter = 0;

		// Event handlers
		this.listeners = {
			change: [],
			rollback: [],
			confirm: [],
			error: []
		};

		// Bind methods
		this.performDOMUpdate = this.performDOMUpdate.bind(this);
	}

	/**
	 * Initialize the state manager and capture initial DOM state
	 */
	init() {
		this.captureInitialState();
		this.attachEventListeners();
		console.log(
			'StateManager initialized with',
			Object.keys(this.currentState).length,
			'tasks'
		);
	}

	/**
	 * Capture the initial state from DOM
	 * @private
	 */
	captureInitialState() {
		const cards = document.querySelectorAll(
			'.task-card, .main-task-card, .subtask-card'
		);

		cards.forEach((card, index) => {
			const id =
				card.getAttribute('data-task-id') ||
				card.getAttribute('data-id') ||
				card.id;

			if (!id) return;

			const status =
				card.getAttribute('data-status') ||
				card.closest('.task-container')?.getAttribute('data-column') ||
				'backlog';

			const container = card.closest('.task-container');
			const columnId = container?.getAttribute('data-column') || status;

			// Calculate position within column
			const siblings = container ? Array.from(container.children) : [];
			const position = siblings.indexOf(card);

			this.currentState[id] = {
				id,
				status,
				position: position >= 0 ? position : index,
				columnId,
				element: card,
				originalParent: card.parentElement,
				originalIndex: Array.from(card.parentElement.children).indexOf(card)
			};
		});
	}

	/**
	 * Attach event listeners for state changes
	 * @private
	 */
	attachEventListeners() {
		// Listen for programmatic changes
		document.addEventListener('taskStatusChanged', (event) => {
			this.handleExternalChange(event.detail);
		});
	}

	/**
	 * Get current state snapshot
	 * @returns {Object} Current state object
	 */
	getCurrentState() {
		return JSON.parse(JSON.stringify(this.currentState));
	}

	/**
	 * Save current state to history
	 * @private
	 */
	saveState() {
		const snapshot = {
			state: this.getCurrentState(),
			timestamp: Date.now()
		};

		this.history.push(snapshot);

		// Limit history size to prevent memory leaks
		if (this.history.length > this.options.maxHistorySize) {
			this.history.shift();
		}
	}

	/**
	 * Apply an optimistic update to the UI
	 * @param {Object} change - Change object
	 * @param {string} change.taskId - ID of the task being changed
	 * @param {string} change.fromStatus - Original status
	 * @param {string} change.toStatus - New status
	 * @param {string} [change.changeId] - Unique identifier for this change
	 * @returns {Promise<void>} Resolves when DOM update is complete
	 */
	async applyOptimisticUpdate(change) {
		const startTime = performance.now();

		// Save state before change with current timestamp
		this.saveState();

		// Generate change ID if not provided
		change.changeId = change.changeId || this.generateChangeId();
		// Set timestamp AFTER saving state to ensure rollback can find the previous state
		change.timestamp = Date.now() + 1; // Add 1ms to ensure it's after the saved state

		// Add to pending changes
		this.pendingChanges.push(change);

		// Update internal state immediately
		if (this.currentState[change.taskId]) {
			const taskState = this.currentState[change.taskId];
			taskState.previousStatus = taskState.status;
			taskState.status = change.toStatus;
			taskState.columnId = change.toStatus;
			taskState.isPending = true;
		}

		// Schedule DOM update
		await this.scheduleDOMUpdate(change);

		// Add visual feedback
		this.addPendingFeedback(change.taskId);

		// Emit change event
		this.emit('change', change);

		const endTime = performance.now();
		const updateTime = endTime - startTime;

		if (updateTime > 200) {
			console.warn(`Optimistic update took ${updateTime}ms (target: <200ms)`);
		}

		return change.changeId;
	}

	/**
	 * Apply multiple updates as a batch
	 * @param {Array} changes - Array of change objects
	 * @returns {Promise<string>} Batch ID
	 */
	async applyBatchUpdate(changes) {
		const batchId = `batch-${this.generateChangeId()}`;

		// Save state once before all changes
		this.saveState();

		// Apply all changes with the same batch ID
		const promises = changes.map((change) => {
			change.batchId = batchId;
			return this.applyOptimisticUpdate(change);
		});

		await Promise.all(promises);

		return batchId;
	}

	/**
	 * Schedule a DOM update using requestAnimationFrame
	 * @private
	 */
	async scheduleDOMUpdate(change) {
		this.batchedUpdates.push(change);

		// Cancel any pending update
		if (this.rafId) {
			cancelAnimationFrame(this.rafId);
		}

		// Use debouncing if configured
		if (this.options.debounceDelay > 0) {
			clearTimeout(this.updateTimer);

			return new Promise((resolve) => {
				this.updateTimer = setTimeout(() => {
					this.performDOMUpdate().then(resolve);
				}, this.options.debounceDelay);
			});
		}

		// Use requestAnimationFrame for immediate updates
		return new Promise((resolve) => {
			this.rafId = requestAnimationFrame(() => {
				this.performDOMUpdate().then(resolve);
			});
		});
	}

	/**
	 * Perform batched DOM updates
	 * @private
	 */
	async performDOMUpdate() {
		if (this.batchedUpdates.length === 0) return;

		const updates = [...this.batchedUpdates];
		this.batchedUpdates = [];

		// Group updates by task to avoid duplicate moves
		const updateMap = new Map();
		updates.forEach((update) => {
			updateMap.set(update.taskId, update);
		});

		// Apply each unique update
		updateMap.forEach((update) => {
			this.updateTaskDOM(update);
		});

		// Clear RAF ID
		this.rafId = null;
	}

	/**
	 * Update a single task in the DOM
	 * @private
	 */
	updateTaskDOM(change) {
		const taskState = this.currentState[change.taskId];
		if (!taskState || !taskState.element) return;

		const card = taskState.element;
		const targetContainer = document.querySelector(
			`[data-column="${change.toStatus}"]`
		);

		if (!targetContainer) {
			console.error(
				`Target container not found for status: ${change.toStatus}`
			);
			return;
		}

		// Update data attributes
		card.setAttribute('data-status', change.toStatus);

		// Move card if needed
		if (card.parentElement !== targetContainer) {
			// Add transition class for smooth animation
			if (this.options.enableAnimations) {
				card.classList.add('transitioning');
			}

			// Move the card
			targetContainer.appendChild(card);

			// Remove transition class after animation
			if (this.options.enableAnimations) {
				setTimeout(() => {
					card.classList.remove('transitioning');
				}, 300);
			}
		}

		// Update state reference
		taskState.element = card;
	}

	/**
	 * Add visual feedback for pending updates
	 * @private
	 */
	addPendingFeedback(taskId) {
		const taskState = this.currentState[taskId];
		if (!taskState || !taskState.element) return;

		const card = taskState.element;

		// Add pending class
		card.classList.add('pending-update');

		// Add loading indicator if not exists
		if (!card.querySelector('.update-loader')) {
			const loader = document.createElement('div');
			loader.className = 'update-loader';
			loader.innerHTML = '<span class="spinner"></span>';
			card.appendChild(loader);
		}
	}

	/**
	 * Remove visual feedback for pending updates
	 * @private
	 */
	removePendingFeedback(taskId) {
		const taskState = this.currentState[taskId];
		if (!taskState || !taskState.element) return;

		const card = taskState.element;

		// Remove pending class
		card.classList.remove('pending-update');

		// Remove loader
		const loader = card.querySelector('.update-loader');
		if (loader) {
			loader.remove();
		}

		// Clear pending flag
		taskState.isPending = false;
	}

	/**
	 * Rollback a specific change
	 * @param {string} changeId - ID of the change to rollback
	 * @returns {boolean} True if rollback was successful
	 */
	rollback(changeId) {
		const changeIndex = this.pendingChanges.findIndex(
			(c) => c.changeId === changeId
		);

		if (changeIndex === -1) {
			console.warn(`Change ${changeId} not found for rollback`);
			return false;
		}

		const change = this.pendingChanges[changeIndex];

		// Find the state before this change
		const previousState = this.findStateBeforeChange(change);

		if (previousState && previousState[change.taskId]) {
			// Restore previous state
			const taskState = this.currentState[change.taskId];
			const prevTaskState = previousState[change.taskId];

			// Update internal state
			taskState.status = prevTaskState.status;
			taskState.columnId = prevTaskState.columnId;
			taskState.position = prevTaskState.position;

			// Update DOM
			requestAnimationFrame(() => {
				if (taskState.element) {
					// Find the correct container - try both data-column and class-based selectors
					let targetContainer =
						document.querySelector(
							`[data-column="${prevTaskState.status}"] .task-container`
						) ||
						document.querySelector(`[data-column="${prevTaskState.status}"]`);

					if (targetContainer) {
						taskState.element.setAttribute('data-status', prevTaskState.status);

						// Move the element back to the original container
						if (taskState.element.parentNode !== targetContainer) {
							// Restore to original position if possible
							if (
								prevTaskState.originalIndex >= 0 &&
								targetContainer.children[prevTaskState.originalIndex]
							) {
								targetContainer.insertBefore(
									taskState.element,
									targetContainer.children[prevTaskState.originalIndex]
								);
							} else {
								targetContainer.appendChild(taskState.element);
							}
						}
					}
				}
			});
		}

		// Remove from pending changes
		this.pendingChanges.splice(changeIndex, 1);

		// Remove visual feedback
		this.removePendingFeedback(change.taskId);

		// Emit rollback event
		this.emit('rollback', change);

		return true;
	}

	/**
	 * Rollback all changes in a batch
	 * @param {string} batchId - ID of the batch to rollback
	 * @returns {number} Number of changes rolled back
	 */
	rollbackBatch(batchId) {
		const batchChanges = this.pendingChanges.filter(
			(c) => c.batchId === batchId
		);

		// Rollback in reverse order
		let rolledBack = 0;
		batchChanges.reverse().forEach((change) => {
			if (this.rollback(change.changeId)) {
				rolledBack++;
			}
		});

		return rolledBack;
	}

	/**
	 * Find the state before a specific change
	 * @private
	 */
	findStateBeforeChange(change) {
		// Look for the most recent history entry before this change
		for (let i = this.history.length - 1; i >= 0; i--) {
			const entry = this.history[i];
			if (entry.timestamp < change.timestamp) {
				return entry.state;
			}
		}

		// If no history found, return current state
		return this.getCurrentState();
	}

	/**
	 * Confirm a pending change as successful
	 * @param {string} changeId - ID of the change to confirm
	 */
	confirmChange(changeId) {
		const changeIndex = this.pendingChanges.findIndex(
			(c) => c.changeId === changeId
		);

		if (changeIndex !== -1) {
			const change = this.pendingChanges[changeIndex];

			// Remove from pending
			this.pendingChanges.splice(changeIndex, 1);

			// Remove visual feedback
			this.removePendingFeedback(change.taskId);

			// Emit confirm event
			this.emit('confirm', change);
		}
	}

	/**
	 * Confirm all changes in a batch
	 * @param {string} batchId - ID of the batch to confirm
	 */
	confirmBatch(batchId) {
		const batchChanges = this.pendingChanges.filter(
			(c) => c.batchId === batchId
		);

		batchChanges.forEach((change) => {
			this.confirmChange(change.changeId);
		});
	}

	/**
	 * Reset the state manager
	 */
	reset() {
		// Clear all pending changes
		this.pendingChanges.forEach((change) => {
			this.removePendingFeedback(change.taskId);
		});

		this.pendingChanges = [];
		this.history = [];
		this.batchedUpdates = [];

		// Clear timers
		clearTimeout(this.updateTimer);
		if (this.rafId) {
			cancelAnimationFrame(this.rafId);
		}
	}

	/**
	 * Serialize state for persistence
	 * @returns {Object} Serialized state
	 */
	serialize() {
		return {
			currentState: this.getCurrentState(),
			pendingChanges: this.pendingChanges,
			history: this.history,
			timestamp: Date.now()
		};
	}

	/**
	 * Restore from serialized state
	 * @param {Object} data - Serialized state data
	 */
	restore(data) {
		if (data.currentState) {
			this.currentState = data.currentState;

			// Reconnect element references
			Object.values(this.currentState).forEach((taskState) => {
				const element = document.querySelector(
					`[data-task-id="${taskState.id}"]`
				);
				if (element) {
					taskState.element = element;
				}
			});
		}

		if (data.pendingChanges) {
			this.pendingChanges = data.pendingChanges;

			// Restore visual feedback for pending changes
			this.pendingChanges.forEach((change) => {
				this.addPendingFeedback(change.taskId);
			});
		}

		if (data.history) {
			this.history = data.history;
		}
	}

	/**
	 * Handle external state changes
	 * @private
	 */
	handleExternalChange(detail) {
		const { taskId, newStatus } = detail;

		if (this.currentState[taskId]) {
			this.currentState[taskId].status = newStatus;
			this.currentState[taskId].columnId = newStatus;
		}
	}

	/**
	 * Generate a unique change ID
	 * @private
	 */
	generateChangeId() {
		return `change-${Date.now()}-${++this.changeCounter}`;
	}

	/**
	 * Add event listener
	 * @param {string} event - Event name
	 * @param {Function} handler - Event handler
	 */
	on(event, handler) {
		if (!this.listeners[event]) {
			this.listeners[event] = [];
		}
		this.listeners[event].push(handler);
	}

	/**
	 * Remove event listener
	 * @param {string} event - Event name
	 * @param {Function} handler - Event handler
	 */
	off(event, handler) {
		if (!this.listeners[event]) return;

		const index = this.listeners[event].indexOf(handler);
		if (index > -1) {
			this.listeners[event].splice(index, 1);
		}
	}

	/**
	 * Emit an event
	 * @private
	 */
	emit(event, data) {
		if (!this.listeners[event]) return;

		this.listeners[event].forEach((handler) => {
			try {
				handler(data);
			} catch (error) {
				console.error(`Error in ${event} handler:`, error);
			}
		});
	}

	/**
	 * Get pending changes count
	 * @returns {number} Number of pending changes
	 */
	getPendingCount() {
		return this.pendingChanges.length;
	}

	/**
	 * Check if there are pending changes
	 * @returns {boolean} True if there are pending changes
	 */
	hasPendingChanges() {
		return this.pendingChanges.length > 0;
	}

	/**
	 * Destroy the state manager and clean up
	 */
	destroy() {
		this.reset();

		// Remove event listeners
		document.removeEventListener(
			'taskStatusChanged',
			this.handleExternalChange
		);

		// Clear state
		this.currentState = {};
		this.listeners = {};
	}
}

// Export for use in browser
if (typeof window !== 'undefined') {
	window.StateManager = StateManager;
}

// Export for ES6 modules
export default StateManager;
