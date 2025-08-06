/**
 * KanbanBoard - Main class for managing the Kanban board functionality
 * Handles initialization, task management, drag & drop, and UI interactions
 */
class KanbanBoard {
	constructor() {
		this.columns = ['backlog', 'ready', 'in-progress', 'completed'];
		this.tasks = [];
		this.isInitialized = false;
		this.isDragging = false;
		this.draggedTask = null;
		this.currentTheme = 'light';
		this.keyboardMoveMode = false;
		this.selectedTask = null;
		this.focusedColumn = 0;
		this.focusedTask = 0;
		this.sortableInstances = [];
		this.useSortableJS = typeof Sortable !== 'undefined';

		// Initialize StateManager for optimistic updates
		this.stateManager = null;

		// Initialize enhanced API client with retry logic
		this.apiClient = null;

		// Bind methods to preserve 'this' context
		this.handleDragStart = this.handleDragStart.bind(this);
		this.handleDragOver = this.handleDragOver.bind(this);
		this.handleDragLeave = this.handleDragLeave.bind(this);
		this.handleDrop = this.handleDrop.bind(this);
		this.handleDragEnd = this.handleDragEnd.bind(this);
		this.handleKeyboardNavigation = this.handleKeyboardNavigation.bind(this);
		this.handleTaskClick = this.handleTaskClick.bind(this);
		this.handleAddTaskClick = this.handleAddTaskClick.bind(this);
		this.handleThemeToggle = this.handleThemeToggle.bind(this);
		this.handleResize = this.handleResize.bind(this);
		this.announceToScreenReader = this.announceToScreenReader.bind(this);

		// SortableJS handlers
		this.handleSortableStart = this.handleSortableStart.bind(this);
		this.handleSortableEnd = this.handleSortableEnd.bind(this);
		this.handleSortableMove = this.handleSortableMove.bind(this);
	}

	/**
	 * Initialize the Kanban board
	 */
	async init() {
		try {
			this.showLoading(true);
			this.announceToScreenReader('Initializing Kanban board...');

			// Initialize StateManager for optimistic updates
			if (typeof StateManager !== 'undefined') {
				this.stateManager = new StateManager({
					maxHistorySize: 20,
					debounceDelay: 0, // No debounce for immediate updates
					enableAnimations: true
				});
				this.stateManager.init();

				// Listen for state events
				this.stateManager.on('rollback', (change) => {
					console.log('State rolled back:', change);
					this.showNotification('Change rolled back due to error', 'warning');
				});

				console.log('StateManager initialized');
			}

			// Initialize enhanced API client with retry logic
			if (typeof APIClient !== 'undefined') {
				this.apiClient = new APIClient({
					maxRetries: 3,
					retryDelay: 1000,
					backoffMultiplier: 2,
					maxDelay: 10000,
					timeout: 30000,
					enableQueuing: true
				});
				console.log('Enhanced APIClient initialized');
			}

			// Initialize theme
			this.initializeTheme();

			// Setup event listeners
			this.setupEventListeners();

			// Load tasks from API
			await this.loadTasks();

			// Render initial state
			this.renderTasks();
			this.updateTaskCounts();

			// Setup drag and drop functionality
			this.setupDragAndDrop();

			// Setup accessibility features
			this.setupAccessibility();

			this.isInitialized = true;
			this.showLoading(false);
			this.announceToScreenReader('Kanban board loaded successfully');

			console.log('KanbanBoard initialized successfully');
		} catch (error) {
			console.error('Error initializing KanbanBoard:', error);
			this.showError('Failed to initialize Kanban board: ' + error.message);
			this.showLoading(false);
		}
	}

	/**
	 * Load tasks from the API
	 */
	async loadTasks() {
		try {
			const response = await TaskAPI.getTasks();
			this.tasks = response.tasks || [];

			// Ensure all tasks have required properties
			this.tasks.forEach((task) => {
				if (!task.id) task.id = 'task-' + Date.now() + Math.random();
				if (!task.status) task.status = 'backlog';
				if (!task.priority) task.priority = 'medium';
				if (!task.title) task.title = 'Untitled Task';
			});

			console.log(`Loaded ${this.tasks.length} tasks`);
		} catch (error) {
			console.error('Error loading tasks:', error);
			this.showError('Failed to load tasks. Working offline with cached data.');

			// Use cached data or empty array as fallback
			this.tasks = this.getCachedTasks() || [];
		}
	}

	/**
	 * Handle updates from polling manager
	 * @param {Object} data - Updated task data from polling
	 */
	handlePollingUpdate(data) {
		// Check if data has actually changed
		const newTasks = data.tasks || [];
		const hasChanges = this.detectTaskChanges(this.tasks, newTasks);

		if (hasChanges) {
			console.log('Polling detected changes, updating tasks');
			this.tasks = newTasks;

			// Ensure all tasks have required properties
			this.tasks.forEach((task) => {
				if (!task.id) task.id = 'task-' + Date.now() + Math.random();
				if (!task.status) task.status = 'backlog';
				if (!task.priority) task.priority = 'medium';
				if (!task.title) task.title = 'Untitled Task';
			});

			// Re-render the board
			this.renderTasks();

			// Show subtle notification
			this.showNotification('Tasks updated', 'info');
		}
	}

	/**
	 * Detect if tasks have changed
	 * @param {Array} oldTasks - Current tasks
	 * @param {Array} newTasks - New tasks from polling
	 * @returns {boolean} True if changes detected
	 */
	detectTaskChanges(oldTasks, newTasks) {
		// Quick length check
		if (oldTasks.length !== newTasks.length) {
			return true;
		}

		// Create maps for efficient comparison
		const oldMap = new Map(oldTasks.map((t) => [t.id, t]));

		// Check for changes in existing tasks
		for (const newTask of newTasks) {
			const oldTask = oldMap.get(newTask.id);

			if (!oldTask) {
				// New task found
				return true;
			}

			// Check for status or title changes
			if (
				oldTask.status !== newTask.status ||
				oldTask.title !== newTask.title ||
				oldTask.priority !== newTask.priority
			) {
				return true;
			}

			// Check subtasks if present
			if (newTask.subtasks || oldTask.subtasks) {
				const oldSubtasks = oldTask.subtasks || [];
				const newSubtasks = newTask.subtasks || [];

				if (oldSubtasks.length !== newSubtasks.length) {
					return true;
				}

				// Check subtask changes
				for (let i = 0; i < newSubtasks.length; i++) {
					if (
						oldSubtasks[i].status !== newSubtasks[i].status ||
						oldSubtasks[i].title !== newSubtasks[i].title
					) {
						return true;
					}
				}
			}
		}

		return false;
	}

	/**
	 * Show connection status indicator
	 * @param {string} status - Status type ('online', 'offline', 'error')
	 */
	showConnectionStatus(status) {
		// Remove existing status indicators
		const existingStatus = document.querySelector('.connection-status');
		if (existingStatus) {
			existingStatus.remove();
		}

		// Create status indicator
		const statusDiv = document.createElement('div');
		statusDiv.className = `connection-status connection-${status}`;

		const statusMessages = {
			online: '✓ Connected',
			offline: '⚠ Offline',
			error: '✗ Connection Error'
		};

		statusDiv.textContent = statusMessages[status] || status;

		// Add to header
		const header = document.querySelector('.kanban-header');
		if (header) {
			header.appendChild(statusDiv);
		}

		// Auto-hide success status after 3 seconds
		if (status === 'online') {
			setTimeout(() => {
				statusDiv.remove();
			}, 3000);
		}
	}

	/**
	 * Show notification message
	 * @param {string} message - Message to display
	 * @param {string} type - Type of notification ('info', 'success', 'error')
	 */
	showNotification(message, type = 'info') {
		const notification = document.createElement('div');
		notification.className = `notification notification-${type}`;
		notification.textContent = message;

		// Add to body
		document.body.appendChild(notification);

		// Animate in
		setTimeout(() => {
			notification.classList.add('show');
		}, 10);

		// Auto-remove after 3 seconds
		setTimeout(() => {
			notification.classList.remove('show');
			setTimeout(() => {
				notification.remove();
			}, 300);
		}, 3000);
	}

	/**
	 * Render all tasks in their respective columns
	 */
	renderTasks() {
		// Clear all task containers
		this.columns.forEach((columnId) => {
			const container = this.getTaskContainer(columnId);
			if (container) {
				container.innerHTML = '';
				container.setAttribute('data-column', columnId);
			}
		});

		// Create a flat list of all cards to render
		const cardsToRender = [];

		console.log('Processing tasks:', this.tasks.length);

		// Process each task
		this.tasks.forEach((task) => {
			if (task.subtasks && task.subtasks.length > 0) {
				// This is a parent task - create subtask cards
				task.subtasks.forEach((subtask) => {
					// Create a proper subtask object with full ID
					const subtaskWithId = {
						...subtask,
						id: `${task.id}.${subtask.id}`, // Create proper subtask ID
						status: subtask.status || task.status || 'backlog',
						priority: subtask.priority || task.priority || 'medium',
						dependencies: subtask.dependencies || [] // Preserve dependencies
					};

					cardsToRender.push({
						task: subtaskWithId,
						parentTask: task,
						status: subtaskWithId.status
					});
				});
			} else {
				// This is a main task without subtasks
				cardsToRender.push({
					task: task,
					parentTask: null,
					status: task.status || 'backlog'
				});
			}
		});

		// Group cards by status
		const cardsByStatus = {};
		this.columns.forEach((col) => (cardsByStatus[col] = []));

		// Determine column based on status AND dependencies
		console.log('Cards to render:', cardsToRender.length);

		cardsToRender.forEach((card) => {
			const columnId = this.determineColumn(card.task, this.tasks);

			// Skip cancelled tasks (determineColumn returns null for them)
			if (columnId === null) {
				return; // Skip this card
			}

			if (cardsByStatus[columnId]) {
				cardsByStatus[columnId].push(card);
			} else {
				cardsByStatus['backlog'].push(card);
			}
		});

		console.log(
			'Cards by status:',
			Object.keys(cardsByStatus).map((k) => `${k}: ${cardsByStatus[k].length}`)
		);

		// Render cards in each column
		this.columns.forEach((columnId) => {
			const cards = cardsByStatus[columnId] || [];
			const container = this.getTaskContainer(columnId);

			if (container) {
				console.log(`Rendering ${cards.length} cards in ${columnId}`);
				cards.forEach(({ task, parentTask }) => {
					try {
						const taskElement = TaskCard.create(task, parentTask);
						if (taskElement) {
							container.appendChild(taskElement);
						} else {
							console.error('Failed to create card for task:', task);
						}
					} catch (error) {
						console.error('Error creating card:', error, task);
					}
				});

				// Add empty state if no tasks
				if (cards.length === 0) {
					this.showEmptyState(container, columnId);
				}
			} else {
				console.error(`Container not found for column: ${columnId}`);
			}
		});

		this.updateTaskCounts();

		// Reinitialize SortableJS after rendering tasks
		if (this.useSortableJS && this.isInitialized) {
			this.initializeSortableJS();
		}
	}

	/**
	 * Determine which column a task should be placed in based on status and dependencies
	 * @param {Object} task - The task or subtask to place
	 * @param {Array} allTasks - All tasks for dependency checking
	 * @returns {string} - The column ID
	 */
	determineColumn(task, allTasks) {
		const status = task.status || 'pending';

		// Skip cancelled tasks entirely - they shouldn't appear on the board
		if (status === 'cancelled') {
			return null; // Will be filtered out
		}

		// Status "done" always goes to completed column
		if (status === 'done') {
			return 'completed';
		}

		// Status "in-progress" always goes to in-progress column
		if (status === 'in-progress') {
			return 'in-progress';
		}

		// Deferred tasks always go to backlog regardless of dependencies
		if (status === 'deferred') {
			return 'backlog';
		}

		// For pending tasks, check dependencies
		if (status === 'pending' || !status) {
			// Check if task has dependencies
			if (!task.dependencies || task.dependencies.length === 0) {
				// No dependencies - ready to start
				return 'ready';
			}

			// Has dependencies - check if all are done
			const allDependenciesDone = task.dependencies.every((depId) => {
				// For subtask dependencies, we need to resolve them properly
				let resolvedDepId = depId;

				// First, try to find the dependency as a main task
				const mainTask = this.findTaskById(depId, allTasks);
				if (mainTask) {
					return mainTask.status === 'done';
				}

				// If not found as main task and this is a subtask, check for sibling subtask
				if (String(task.id).includes('.') && !String(depId).includes('.')) {
					// Get parent ID from the subtask's composite ID
					const parentId = String(task.id).split('.')[0];

					// Try to find as a sibling subtask
					const siblingId = `${parentId}.${depId}`;
					const siblingTask = this.findTaskById(siblingId, allTasks);
					if (siblingTask) {
						return siblingTask.status === 'done';
					}
				}

				// If we can't find the dependency, assume it's not done
				// This prevents tasks from appearing ready when dependencies are missing
				console.warn(`Dependency ${depId} not found for task ${task.id}`);
				return false;
			});

			if (allDependenciesDone) {
				return 'ready';
			} else {
				return 'backlog';
			}
		}

		// Default to backlog for any other status
		return 'backlog';
	}

	/**
	 * Find a task by ID, including checking subtasks
	 * @param {string|number} taskId - The task ID to find
	 * @param {Array} allTasks - All tasks to search
	 * @returns {Object|null} - The found task or null
	 */
	findTaskById(taskId, allTasks) {
		// Convert to string for comparison
		const searchId = String(taskId);

		// First check main tasks
		for (const task of allTasks) {
			if (String(task.id) === searchId) {
				return task;
			}

			// Check subtasks
			if (task.subtasks) {
				for (const subtask of task.subtasks) {
					// Check both the subtask's own ID and the composite ID
					if (
						String(subtask.id) === searchId ||
						`${task.id}.${subtask.id}` === searchId
					) {
						// Return the actual subtask object with its real status
						return subtask;
					}
				}
			}
		}

		return null;
	}

	/**
	 * Group tasks by their status
	 */
	groupTasksByStatus() {
		const grouped = {};

		this.columns.forEach((column) => {
			grouped[column] = [];
		});

		this.tasks.forEach((task) => {
			const status = task.status || 'backlog';
			if (grouped[status]) {
				grouped[status].push(task);
			} else {
				grouped['backlog'].push(task);
			}
		});

		return grouped;
	}

	/**
	 * Update task counts in column headers
	 */
	updateTaskCounts() {
		// Count cards (not tasks) per column
		const counts = {};
		this.columns.forEach((col) => (counts[col] = 0));

		// Count all cards that will be rendered
		this.tasks.forEach((task) => {
			if (task.subtasks && task.subtasks.length > 0) {
				// Count subtasks
				task.subtasks.forEach((subtask) => {
					const subtaskWithId = {
						...subtask,
						id: `${task.id}.${subtask.id}`,
						status: subtask.status || task.status || 'pending',
						dependencies: subtask.dependencies || []
					};
					const columnId = this.determineColumn(subtaskWithId, this.tasks);
					if (counts[columnId] !== undefined) {
						counts[columnId]++;
					} else {
						counts['backlog']++;
					}
				});
			} else {
				// Count main task
				const columnId = this.determineColumn(task, this.tasks);
				if (counts[columnId] !== undefined) {
					counts[columnId]++;
				} else {
					counts['backlog']++;
				}
			}
		});

		// Update UI
		this.columns.forEach((columnId) => {
			const countElement = document.querySelector(
				`[data-column="${columnId}"] .task-count`
			);
			if (countElement) {
				const count = counts[columnId] || 0;
				countElement.textContent = count;
				countElement.setAttribute('aria-label', `${count} tasks`);
			}
		});
	}

	/**
	 * Setup drag and drop functionality
	 */
	setupDragAndDrop() {
		if (this.useSortableJS) {
			this.initializeSortableJS();
		} else {
			console.warn(
				'SortableJS not available, falling back to HTML5 drag-and-drop'
			);
			// HTML5 drag-and-drop will be setup via setupEventListeners()
		}
	}

	/**
	 * Initialize SortableJS on all task containers
	 */
	initializeSortableJS() {
		// Clean up existing instances
		this.destroySortableInstances();

		this.columns.forEach((columnId) => {
			const container = this.getTaskContainer(columnId);
			if (container) {
				const sortableInstance = Sortable.create(container, {
					group: 'kanban-tasks', // Allow drag between columns
					animation: 150, // Animation duration
					ghostClass: 'sortable-ghost', // Ghost element class
					chosenClass: 'sortable-chosen', // Selected element class
					dragClass: 'sortable-drag', // Dragging element class
					filter: '.add-task-btn, .empty-state', // Elements to ignore
					preventOnFilter: false,
					dataIdAttr: 'data-task-id',
					onStart: this.handleSortableStart,
					onEnd: this.handleSortableEnd,
					onMove: this.handleSortableMove
				});

				this.sortableInstances.push({
					columnId,
					instance: sortableInstance
				});

				console.log(`SortableJS initialized for column: ${columnId}`);
			}
		});
	}

	/**
	 * Destroy all SortableJS instances
	 */
	destroySortableInstances() {
		this.sortableInstances.forEach(({ instance }) => {
			if (instance && typeof instance.destroy === 'function') {
				instance.destroy();
			}
		});
		this.sortableInstances = [];
	}

	/**
	 * Handle SortableJS drag start
	 */
	handleSortableStart(evt) {
		const taskCard = evt.item;
		const taskId = taskCard.getAttribute('data-task-id');
		this.draggedTask =
			this.tasks.find((task) => task.id === taskId) ||
			this.findTaskById(taskId, this.tasks);

		if (this.draggedTask) {
			this.isDragging = true;
			taskCard.setAttribute('aria-grabbed', 'true');
			this.announceToScreenReader(
				`${this.draggedTask.title} grabbed for moving`
			);
			console.log('SortableJS drag started for task:', taskId);
		}
	}

	/**
	 * Handle SortableJS drag end
	 */
	async handleSortableEnd(evt) {
		const taskCard = evt.item;
		const taskId = taskCard.getAttribute('data-task-id');
		const newColumn = evt.to.closest('.kanban-column');
		const oldColumn = evt.from.closest('.kanban-column');

		if (!newColumn || !oldColumn) {
			this.cleanupSortableState();
			return;
		}

		const newStatus = this.mapColumnToStatus(
			newColumn.getAttribute('data-column')
		);
		const oldStatus = this.mapColumnToStatus(
			oldColumn.getAttribute('data-column')
		);

		// Reset ARIA attribute
		taskCard.setAttribute('aria-grabbed', 'false');

		if (newStatus === oldStatus) {
			this.cleanupSortableState();
			return;
		}

		if (!this.draggedTask) {
			console.warn('No dragged task found for SortableJS drop');
			this.cleanupSortableState();
			return;
		}

		// Apply optimistic update via StateManager if available
		let changeId = null;
		if (this.stateManager) {
			changeId = await this.stateManager.applyOptimisticUpdate({
				taskId: taskId,
				fromStatus: oldStatus,
				toStatus: newStatus
			});
		}

		try {
			// Update task status immediately in memory
			this.draggedTask.status = newStatus;

			// Use enhanced API client if available, otherwise fall back to standard API
			if (this.apiClient) {
				// Enhanced API with retry logic and request queuing
				const result = await this.apiClient.updateTaskStatus(taskId, newStatus);

				// Confirm the change in StateManager
				if (this.stateManager && changeId) {
					this.stateManager.confirmChange(changeId);
				}

				console.log('Task status updated with enhanced API client:', result);
			} else {
				// Fallback to standard API
				await this.updateTaskStatus(taskId, newStatus);
			}

			// Announce success
			const columnNames = {
				backlog: 'Backlog',
				ready: 'Ready',
				'in-progress': 'In Progress',
				completed: 'Done'
			};

			this.announceToScreenReader(
				`${this.draggedTask.title} moved from ${columnNames[oldStatus]} to ${columnNames[newStatus]}`
			);

			this.showSuccess(`Task moved to ${columnNames[newStatus]}`);
			this.updateTaskCounts();

			console.log(
				`SortableJS task ${taskId} moved from ${oldStatus} to ${newStatus}`
			);
		} catch (error) {
			console.error('Error updating task status via SortableJS:', error);

			// Rollback optimistic update if StateManager is available
			if (this.stateManager && changeId) {
				this.stateManager.rollback(changeId);
			} else {
				// Manual rollback: move card back to original column
				const originalContainer = this.getTaskContainer(
					this.mapStatusToColumn(oldStatus)
				);
				if (originalContainer && taskCard.parentNode !== originalContainer) {
					originalContainer.appendChild(taskCard);
				}
			}

			// Restore original status
			if (this.draggedTask) {
				this.draggedTask.status = oldStatus;
			}

			// Show appropriate error message based on error type
			const errorMessage =
				error.context?.errorType === 'timeout'
					? 'Request timed out. Please try again.'
					: error.context?.attempt > 1
						? `Failed to move task after ${error.context.attempt} attempts`
						: 'Failed to move task';

			this.showError(errorMessage);
			this.updateTaskCounts();
		}

		this.cleanupSortableState();
	}

	/**
	 * Handle SortableJS move validation
	 */
	handleSortableMove(evt) {
		const taskCard = evt.dragged;
		const targetColumn = evt.to.closest('.kanban-column');

		if (!taskCard || !targetColumn) return true;

		const taskId = taskCard.getAttribute('data-task-id');
		const task = this.findTaskById(taskId, this.tasks);

		if (!task) return true;

		const targetColumnId = targetColumn.getAttribute('data-column');
		const targetStatus = this.mapColumnToStatus(targetColumnId);

		// Check business rules
		// 1. Tasks with unmet dependencies cannot go to In Progress
		if (
			targetStatus === 'in-progress' &&
			task.dependencies &&
			task.dependencies.length > 0
		) {
			const hasUnmetDependencies = !this.checkAllDependenciesMet(
				task,
				this.tasks
			);
			if (hasUnmetDependencies) {
				evt.to.classList.add('cannot-drop');
				setTimeout(() => evt.to.classList.remove('cannot-drop'), 500);
				this.showError(
					'Cannot move task with unmet dependencies to In Progress'
				);
				return false;
			}
		}

		// 2. Deferred tasks should only go to Backlog
		if (task.status === 'deferred' && targetColumnId !== 'backlog') {
			this.showError('Deferred tasks must remain in Backlog');
			return false;
		}

		// 3. Add visual feedback for valid drop
		evt.to.classList.add('can-drop');
		setTimeout(() => evt.to.classList.remove('can-drop'), 500);

		return true;
	}

	/**
	 * Check if all dependencies are met for a task
	 */
	checkAllDependenciesMet(task, allTasks) {
		if (!task.dependencies || task.dependencies.length === 0) {
			return true;
		}

		return task.dependencies.every((depId) => {
			// First, try to find the dependency as a main task
			const depTask = this.findTaskById(depId, allTasks);
			if (depTask) {
				return depTask.status === 'done';
			}

			// If not found as main task and this is a subtask, check for sibling
			if (String(task.id).includes('.') && !String(depId).includes('.')) {
				const parentId = String(task.id).split('.')[0];
				const siblingId = `${parentId}.${depId}`;
				const siblingTask = this.findTaskById(siblingId, allTasks);
				if (siblingTask) {
					return siblingTask.status === 'done';
				}
			}

			// Dependency not found
			return false;
		});
	}

	/**
	 * Clean up SortableJS drag state
	 */
	cleanupSortableState() {
		this.isDragging = false;
		this.draggedTask = null;
	}

	/**
	 * Map column ID to status value
	 */
	mapColumnToStatus(columnId) {
		const mapping = {
			backlog: 'backlog',
			ready: 'ready',
			'in-progress': 'in-progress',
			completed: 'done'
		};
		return mapping[columnId] || 'backlog';
	}

	/**
	 * Map status value to column ID
	 */
	mapStatusToColumn(status) {
		const mapping = {
			backlog: 'backlog',
			ready: 'ready',
			'in-progress': 'in-progress',
			done: 'completed',
			pending: 'ready', // Default for pending tasks
			deferred: 'backlog'
		};
		return mapping[status] || 'backlog';
	}

	/**
	 * Setup all event listeners
	 */
	setupEventListeners() {
		// Only setup HTML5 drag-and-drop if SortableJS is not available
		if (!this.useSortableJS) {
			// Drag and drop events
			document.addEventListener('dragstart', this.handleDragStart);
			document.addEventListener('dragover', this.handleDragOver);
			document.addEventListener('dragleave', this.handleDragLeave);
			document.addEventListener('drop', this.handleDrop);
			document.addEventListener('dragend', this.handleDragEnd);
		}

		// Keyboard navigation
		document.addEventListener('keydown', this.handleKeyboardNavigation);

		// Click events
		document.addEventListener('click', this.handleTaskClick);

		// Add task button events
		document.querySelectorAll('.add-task-btn').forEach((btn) => {
			btn.addEventListener('click', this.handleAddTaskClick);
		});

		// Theme toggle
		const themeToggle = document.querySelector('.theme-toggle');
		if (themeToggle) {
			themeToggle.addEventListener('click', this.handleThemeToggle);
		}

		// Window events
		window.addEventListener('resize', this.debounce(this.handleResize, 250));
		window.addEventListener('beforeunload', this.saveCachedTasks.bind(this));

		// Touch events for mobile
		if (this.isTouchDevice()) {
			this.setupTouchEvents();
		}
	}

	/**
	 * Handle drag start event
	 */
	handleDragStart(event) {
		const taskCard = event.target.closest('.task-card');
		if (!taskCard) return;

		const taskId = taskCard.getAttribute('data-task-id');
		this.draggedTask = this.tasks.find((task) => task.id === taskId);

		if (!this.draggedTask) return;

		this.isDragging = true;
		taskCard.classList.add('dragging');
		taskCard.setAttribute('aria-grabbed', 'true');

		// Set drag data
		event.dataTransfer.setData('text/plain', taskId);
		event.dataTransfer.effectAllowed = 'move';

		// Announce to screen reader
		this.announceToScreenReader(`${this.draggedTask.title} grabbed for moving`);

		console.log('Drag started for task:', taskId);
	}

	/**
	 * Handle drag over event
	 */
	handleDragOver(event) {
		if (!this.isDragging) return;

		event.preventDefault();
		event.dataTransfer.dropEffect = 'move';

		const dropTarget = event.target.closest('.task-container');
		if (dropTarget) {
			dropTarget.setAttribute('data-drag-over', 'true');
			dropTarget.classList.add('drag-over');
		}
	}

	/**
	 * Handle drag leave event
	 */
	handleDragLeave(event) {
		const dropTarget = event.target.closest('.task-container');
		if (dropTarget) {
			dropTarget.removeAttribute('data-drag-over');
			dropTarget.classList.remove('drag-over');
		}
	}

	/**
	 * Handle drop event
	 */
	async handleDrop(event) {
		event.preventDefault();

		if (!this.isDragging || !this.draggedTask) return;

		const dropTarget = event.target.closest('.task-container');
		if (!dropTarget) return;

		const targetColumn = dropTarget.closest('.kanban-column');
		if (!targetColumn) return;

		const newStatus = targetColumn.getAttribute('data-column');
		const oldStatus = this.draggedTask.status;

		if (newStatus === oldStatus) {
			this.cleanupDragState();
			return;
		}

		try {
			// Update task status
			await this.updateTaskStatus(this.draggedTask.id, newStatus);

			// Announce to screen reader
			const columnNames = {
				backlog: 'Backlog',
				ready: 'Ready',
				'in-progress': 'In Progress',
				review: 'Review',
				done: 'Done'
			};

			this.announceToScreenReader(
				`${this.draggedTask.title} moved from ${columnNames[oldStatus]} to ${columnNames[newStatus]}`
			);

			this.showSuccess(`Task moved to ${columnNames[newStatus]}`);
		} catch (error) {
			console.error('Error updating task status:', error);
			this.showError('Failed to move task');
		}

		this.cleanupDragState();
	}

	/**
	 * Handle drag end event
	 */
	handleDragEnd(event) {
		this.cleanupDragState();
	}

	/**
	 * Clean up drag state
	 */
	cleanupDragState() {
		this.isDragging = false;
		this.draggedTask = null;

		// Remove drag classes
		document.querySelectorAll('.dragging').forEach((el) => {
			el.classList.remove('dragging');
			el.setAttribute('aria-grabbed', 'false');
		});

		document.querySelectorAll('.drag-over, [data-drag-over]').forEach((el) => {
			el.classList.remove('drag-over');
			el.removeAttribute('data-drag-over');
		});
	}

	/**
	 * Handle keyboard navigation
	 */
	handleKeyboardNavigation(event) {
		const activeElement = document.activeElement;

		// Handle keyboard alternatives to drag and drop
		if (event.ctrlKey && event.key === 'Enter') {
			const taskCard = activeElement.closest('.task-card');
			if (taskCard) {
				this.enterKeyboardMoveMode(taskCard);
				event.preventDefault();
				return;
			}
		}

		// Handle escape key
		if (event.key === 'Escape') {
			if (this.keyboardMoveMode) {
				this.exitKeyboardMoveMode();
				event.preventDefault();
				return;
			}
		}

		// Navigation in move mode
		if (this.keyboardMoveMode) {
			this.handleKeyboardMoveNavigation(event);
			return;
		}

		// Regular navigation
		switch (event.key) {
			case 'ArrowRight':
				this.navigateColumns(1);
				event.preventDefault();
				break;
			case 'ArrowLeft':
				this.navigateColumns(-1);
				event.preventDefault();
				break;
			case 'ArrowDown':
				this.navigateTasks(1);
				event.preventDefault();
				break;
			case 'ArrowUp':
				this.navigateTasks(-1);
				event.preventDefault();
				break;
			case 'Home':
				this.navigateToFirstTask();
				event.preventDefault();
				break;
			case 'End':
				this.navigateToLastTask();
				event.preventDefault();
				break;
		}
	}

	/**
	 * Enter keyboard move mode for accessibility
	 */
	enterKeyboardMoveMode(taskCard) {
		this.keyboardMoveMode = true;
		this.selectedTask = taskCard;
		taskCard.classList.add('keyboard-selected');
		taskCard.setAttribute('aria-grabbed', 'true');

		const taskId = taskCard.getAttribute('data-task-id');
		const task = this.tasks.find((t) => t.id === taskId);

		this.announceToScreenReader(
			`Keyboard move mode activated for ${task.title}. Use arrow keys to navigate columns, Enter to drop, Escape to cancel.`
		);
	}

	/**
	 * Exit keyboard move mode
	 */
	exitKeyboardMoveMode() {
		if (this.selectedTask) {
			this.selectedTask.classList.remove('keyboard-selected');
			this.selectedTask.setAttribute('aria-grabbed', 'false');
			this.selectedTask.focus();
		}

		this.keyboardMoveMode = false;
		this.selectedTask = null;
		this.announceToScreenReader('Move cancelled');
	}

	/**
	 * Handle keyboard navigation in move mode
	 */
	async handleKeyboardMoveNavigation(event) {
		if (!this.selectedTask) return;

		const currentColumn = this.selectedTask.closest('.kanban-column');
		const currentStatus = currentColumn.getAttribute('data-column');
		let targetStatus = null;

		switch (event.key) {
			case 'ArrowRight':
				targetStatus = this.getNextColumn(currentStatus);
				break;
			case 'ArrowLeft':
				targetStatus = this.getPreviousColumn(currentStatus);
				break;
			case 'Enter':
				// Complete the move
				const newColumn = document.querySelector(
					'.kanban-column.keyboard-target'
				);
				if (newColumn) {
					targetStatus = newColumn.getAttribute('data-column');
				}
				break;
		}

		if (targetStatus && targetStatus !== currentStatus) {
			const taskId = this.selectedTask.getAttribute('data-task-id');

			try {
				await this.updateTaskStatus(taskId, targetStatus);
				this.exitKeyboardMoveMode();

				const columnNames = {
					backlog: 'Backlog',
					ready: 'Ready',
					'in-progress': 'In Progress',
					review: 'Review',
					done: 'Done'
				};

				this.announceToScreenReader(
					`Task moved to ${columnNames[targetStatus]}`
				);
			} catch (error) {
				this.showError('Failed to move task');
				this.exitKeyboardMoveMode();
			}
		}

		// Update visual indicators
		if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
			this.updateKeyboardMoveIndicators(targetStatus);
			event.preventDefault();
		}
	}

	/**
	 * Update visual indicators for keyboard move mode
	 */
	updateKeyboardMoveIndicators(targetStatus) {
		// Remove previous indicators
		document.querySelectorAll('.keyboard-target').forEach((el) => {
			el.classList.remove('keyboard-target');
		});

		// Add indicator to target column
		if (targetStatus) {
			const targetColumn = document.querySelector(
				`[data-column="${targetStatus}"]`
			);
			if (targetColumn) {
				targetColumn.classList.add('keyboard-target');
			}
		}
	}

	/**
	 * Get next column in sequence
	 */
	getNextColumn(currentStatus) {
		const currentIndex = this.columns.indexOf(currentStatus);
		return currentIndex < this.columns.length - 1
			? this.columns[currentIndex + 1]
			: null;
	}

	/**
	 * Get previous column in sequence
	 */
	getPreviousColumn(currentStatus) {
		const currentIndex = this.columns.indexOf(currentStatus);
		return currentIndex > 0 ? this.columns[currentIndex - 1] : null;
	}

	/**
	 * Navigate between columns
	 */
	navigateColumns(direction) {
		const columns = document.querySelectorAll('.kanban-column');
		this.focusedColumn = Math.max(
			0,
			Math.min(columns.length - 1, this.focusedColumn + direction)
		);

		const targetColumn = columns[this.focusedColumn];
		const firstTask = targetColumn.querySelector('.task-card');

		if (firstTask) {
			firstTask.focus();
			this.focusedTask = 0;
		} else {
			targetColumn.querySelector('.add-task-btn')?.focus();
		}
	}

	/**
	 * Navigate between tasks in current column
	 */
	navigateTasks(direction) {
		const activeElement = document.activeElement;
		const currentColumn = activeElement.closest('.kanban-column');
		if (!currentColumn) return;

		const tasks = currentColumn.querySelectorAll('.task-card');
		if (tasks.length === 0) return;

		this.focusedTask = Math.max(
			0,
			Math.min(tasks.length - 1, this.focusedTask + direction)
		);
		tasks[this.focusedTask].focus();
	}

	/**
	 * Navigate to first task in current column
	 */
	navigateToFirstTask() {
		const activeElement = document.activeElement;
		const currentColumn = activeElement.closest('.kanban-column');
		if (!currentColumn) return;

		const firstTask = currentColumn.querySelector('.task-card');
		if (firstTask) {
			firstTask.focus();
			this.focusedTask = 0;
		}
	}

	/**
	 * Navigate to last task in current column
	 */
	navigateToLastTask() {
		const activeElement = document.activeElement;
		const currentColumn = activeElement.closest('.kanban-column');
		if (!currentColumn) return;

		const tasks = currentColumn.querySelectorAll('.task-card');
		if (tasks.length > 0) {
			const lastTask = tasks[tasks.length - 1];
			lastTask.focus();
			this.focusedTask = tasks.length - 1;
		}
	}

	/**
	 * Handle task card clicks
	 */
	handleTaskClick(event) {
		const taskCard = event.target.closest('.task-card');
		if (!taskCard) return;

		const taskId = taskCard.getAttribute('data-task-id');
		const task = this.tasks.find((t) => t.id === taskId);

		if (task) {
			this.openTaskModal(task);
		}
	}

	/**
	 * Handle add task button clicks
	 */
	handleAddTaskClick(event) {
		const button = event.target.closest('.add-task-btn');
		if (!button) return;

		const column = button.closest('.kanban-column');
		const columnId = column.getAttribute('data-column');

		this.openAddTaskModal(columnId);
	}

	/**
	 * Open task modal for editing
	 */
	openTaskModal(task) {
		const modal = this.createTaskModal(task);
		document.body.appendChild(modal);

		// Focus management
		const titleInput = modal.querySelector('#task-title-input');
		if (titleInput) {
			titleInput.focus();
			titleInput.select();
		}

		// Trap focus in modal
		this.trapFocus(modal);
	}

	/**
	 * Open add task modal
	 */
	openAddTaskModal(columnId) {
		const modal = this.createTaskModal(null, columnId);
		document.body.appendChild(modal);

		// Focus management
		const titleInput = modal.querySelector('#task-title-input');
		if (titleInput) {
			titleInput.focus();
		}

		// Trap focus in modal
		this.trapFocus(modal);
	}

	/**
	 * Create task modal from template
	 */
	createTaskModal(task = null, defaultColumn = 'backlog') {
		const template = document.getElementById('task-modal-template');
		const modal = template.content
			.cloneNode(true)
			.querySelector('.modal-overlay');

		// Set modal title
		const title = modal.querySelector('.modal-title');
		title.textContent = task ? 'Edit Task' : 'Add Task';
		title.id = 'modal-title-' + Date.now();
		modal.setAttribute('aria-labelledby', title.id);

		// Populate form if editing
		if (task) {
			modal.querySelector('#task-title-input').value = task.title || '';
			modal.querySelector('#task-description-input').value =
				task.description || '';
			modal.querySelector('#task-priority-input').value =
				task.priority || 'medium';
		}

		// Handle form submission
		const form = modal.querySelector('.task-form');
		form.addEventListener('submit', async (event) => {
			event.preventDefault();
			await this.handleTaskFormSubmit(event, task, defaultColumn);
			this.closeModal(modal);
		});

		// Handle modal close
		modal.querySelector('.modal-close').addEventListener('click', () => {
			this.closeModal(modal);
		});

		modal.querySelector('.modal-cancel').addEventListener('click', () => {
			this.closeModal(modal);
		});

		// Handle escape key
		modal.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') {
				this.closeModal(modal);
			}
		});

		// Handle backdrop click
		modal.addEventListener('click', (event) => {
			if (event.target === modal) {
				this.closeModal(modal);
			}
		});

		return modal;
	}

	/**
	 * Handle task form submission
	 */
	async handleTaskFormSubmit(event, existingTask, defaultColumn) {
		const form = event.target;
		const formData = new FormData(form);

		const taskData = {
			title: formData.get('title').trim(),
			description: formData.get('description').trim(),
			priority: formData.get('priority'),
			status: existingTask ? existingTask.status : defaultColumn
		};

		// Validation
		if (!taskData.title) {
			this.showError('Task title is required');
			return;
		}

		try {
			if (existingTask) {
				// Update existing task
				await this.updateTask(existingTask.id, taskData);
				this.showSuccess('Task updated successfully');
			} else {
				// Create new task
				await this.addTask(taskData);
				this.showSuccess('Task created successfully');
			}
		} catch (error) {
			console.error('Error saving task:', error);
			this.showError('Failed to save task');
		}
	}

	/**
	 * Add new task
	 */
	async addTask(taskData) {
		try {
			const response = await TaskAPI.createTask(taskData);
			const newTask = response.task;

			this.tasks.push(newTask);
			this.renderTasks();
			this.saveCachedTasks();

			console.log('Task added:', newTask);
		} catch (error) {
			// Fallback to local creation
			const newTask = {
				id:
					'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
				...taskData,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};

			this.tasks.push(newTask);
			this.renderTasks();
			this.saveCachedTasks();

			throw error; // Re-throw to show error message
		}
	}

	/**
	 * Update existing task
	 */
	async updateTask(taskId, updates) {
		try {
			const response = await TaskAPI.updateTask(taskId, updates);
			const updatedTask = response.task;

			const index = this.tasks.findIndex((t) => t.id === taskId);
			if (index !== -1) {
				this.tasks[index] = { ...this.tasks[index], ...updatedTask };
				this.renderTasks();
				this.saveCachedTasks();
			}

			console.log('Task updated:', updatedTask);
		} catch (error) {
			// Fallback to local update
			const index = this.tasks.findIndex((t) => t.id === taskId);
			if (index !== -1) {
				this.tasks[index] = {
					...this.tasks[index],
					...updates,
					updatedAt: new Date().toISOString()
				};
				this.renderTasks();
				this.saveCachedTasks();
			}

			throw error; // Re-throw to show error message
		}
	}

	/**
	 * Update task status (for drag & drop)
	 */
	async updateTaskStatus(taskId, newStatus) {
		await this.updateTask(taskId, { status: newStatus });
	}

	/**
	 * Close modal and restore focus
	 */
	closeModal(modal) {
		// Restore focus to the element that opened the modal
		const lastFocused =
			document.querySelector('.task-card:focus, .add-task-btn:focus') ||
			document.querySelector('.add-task-btn');

		modal.remove();

		if (lastFocused) {
			lastFocused.focus();
		}
	}

	/**
	 * Trap focus within modal for accessibility
	 */
	trapFocus(modal) {
		const focusableElements = modal.querySelectorAll(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		);

		const firstElement = focusableElements[0];
		const lastElement = focusableElements[focusableElements.length - 1];

		modal.addEventListener('keydown', (event) => {
			if (event.key === 'Tab') {
				if (event.shiftKey) {
					if (document.activeElement === firstElement) {
						lastElement.focus();
						event.preventDefault();
					}
				} else {
					if (document.activeElement === lastElement) {
						firstElement.focus();
						event.preventDefault();
					}
				}
			}
		});
	}

	/**
	 * Handle theme toggle
	 */
	handleThemeToggle() {
		this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
		document.documentElement.setAttribute('data-theme', this.currentTheme);

		// Update theme toggle icon
		const themeToggle = document.querySelector('.theme-toggle .theme-icon');
		if (themeToggle) {
			themeToggle.textContent = this.currentTheme === 'light' ? '🌙' : '☀️';
		}

		// Save preference
		localStorage.setItem('kanban-theme', this.currentTheme);

		this.announceToScreenReader(`Switched to ${this.currentTheme} mode`);
	}

	/**
	 * Initialize theme from user preference
	 */
	initializeTheme() {
		// Check for saved preference
		const savedTheme = localStorage.getItem('kanban-theme');

		// Check system preference
		const prefersDark = window.matchMedia(
			'(prefers-color-scheme: dark)'
		).matches;

		this.currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
		document.documentElement.setAttribute('data-theme', this.currentTheme);

		// Update theme toggle icon
		const themeToggle = document.querySelector('.theme-toggle .theme-icon');
		if (themeToggle) {
			themeToggle.textContent = this.currentTheme === 'light' ? '🌙' : '☀️';
		}

		// Listen for system theme changes
		window
			.matchMedia('(prefers-color-scheme: dark)')
			.addEventListener('change', (e) => {
				if (!localStorage.getItem('kanban-theme')) {
					this.currentTheme = e.matches ? 'dark' : 'light';
					document.documentElement.setAttribute(
						'data-theme',
						this.currentTheme
					);

					const themeToggle = document.querySelector(
						'.theme-toggle .theme-icon'
					);
					if (themeToggle) {
						themeToggle.textContent =
							this.currentTheme === 'light' ? '🌙' : '☀️';
					}
				}
			});
	}

	/**
	 * Handle window resize for responsive behavior
	 */
	handleResize() {
		// Update layout calculations if needed
		this.updateTaskCounts();

		// Announce layout changes for screen readers
		if (window.innerWidth <= 768) {
			this.announceToScreenReader('Layout changed to mobile view');
		} else if (window.innerWidth <= 1200) {
			this.announceToScreenReader('Layout changed to tablet view');
		} else {
			this.announceToScreenReader('Layout changed to desktop view');
		}
	}

	/**
	 * Setup accessibility features
	 */
	setupAccessibility() {
		// Add aria-labels to task cards
		document.querySelectorAll('.task-card').forEach((card) => {
			const taskId = card.getAttribute('data-task-id');
			const task = this.tasks.find((t) => t.id === taskId);
			if (task) {
				card.setAttribute('aria-label', `Task: ${task.title}`);
				card.setAttribute('role', 'option');
				card.setAttribute('tabindex', '0');
				card.setAttribute('aria-grabbed', 'false');
			}
		});

		// Add live region for announcements
		if (!document.getElementById('sr-announcements')) {
			const liveRegion = document.createElement('div');
			liveRegion.id = 'sr-announcements';
			liveRegion.className = 'sr-only';
			liveRegion.setAttribute('aria-live', 'polite');
			liveRegion.setAttribute('aria-atomic', 'true');
			liveRegion.setAttribute('role', 'status');
			document.body.appendChild(liveRegion);
		}
	}

	/**
	 * Setup touch events for mobile devices
	 */
	setupTouchEvents() {
		let touchStartTime = 0;
		let touchStartTarget = null;

		document.addEventListener('touchstart', (event) => {
			touchStartTime = Date.now();
			touchStartTarget = event.target.closest('.task-card');
		});

		document.addEventListener('touchend', (event) => {
			const touchEndTime = Date.now();
			const touchDuration = touchEndTime - touchStartTime;

			// Long press for context menu (500ms)
			if (touchDuration > 500 && touchStartTarget) {
				event.preventDefault();
				this.showTaskContextMenu(touchStartTarget, event);
			}
		});

		// Swipe gestures for moving tasks
		let touchStartX = 0;
		let touchStartY = 0;

		document.addEventListener('touchstart', (event) => {
			if (event.touches.length === 1) {
				touchStartX = event.touches[0].clientX;
				touchStartY = event.touches[0].clientY;
			}
		});

		document.addEventListener(
			'touchmove',
			(event) => {
				// Prevent default scrolling during swipe
				if (Math.abs(event.touches[0].clientX - touchStartX) > 10) {
					event.preventDefault();
				}
			},
			{ passive: false }
		);

		document.addEventListener('touchend', (event) => {
			if (!touchStartTarget) return;

			const touchEndX = event.changedTouches[0].clientX;
			const touchEndY = event.changedTouches[0].clientY;

			const deltaX = touchEndX - touchStartX;
			const deltaY = touchEndY - touchStartY;

			// Check for horizontal swipe (minimum 50px, more horizontal than vertical)
			if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
				const taskCard = touchStartTarget;
				const currentColumn = taskCard.closest('.kanban-column');
				const currentStatus = currentColumn.getAttribute('data-column');

				let targetStatus = null;

				if (deltaX > 0) {
					// Swipe right - next column
					targetStatus = this.getNextColumn(currentStatus);
				} else {
					// Swipe left - previous column
					targetStatus = this.getPreviousColumn(currentStatus);
				}

				if (targetStatus) {
					const taskId = taskCard.getAttribute('data-task-id');
					this.updateTaskStatus(taskId, targetStatus).catch((error) => {
						this.showError('Failed to move task');
					});
				}
			}
		});
	}

	/**
	 * Show context menu for task (mobile)
	 */
	showTaskContextMenu(taskCard, event) {
		// Implementation for mobile context menu
		const taskId = taskCard.getAttribute('data-task-id');
		const task = this.tasks.find((t) => t.id === taskId);

		if (task) {
			this.openTaskModal(task);
		}
	}

	/**
	 * Check if device supports touch
	 */
	isTouchDevice() {
		return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
	}

	/**
	 * Show empty state in column
	 */
	showEmptyState(container, columnId) {
		const emptyState = document.createElement('div');
		emptyState.className = 'empty-state';

		const emptyIcon = document.createElement('div');
		emptyIcon.className = 'empty-icon';

		const emptyMessage = document.createElement('p');
		emptyMessage.className = 'empty-message';

		const messages = {
			backlog: { icon: '📋', text: 'No tasks in backlog' },
			ready: { icon: '🚀', text: 'Ready to start' },
			'in-progress': { icon: '⚡', text: 'Nothing in progress' },
			review: { icon: '👀', text: 'No tasks to review' },
			done: { icon: '✅', text: 'No completed tasks' }
		};

		const message = messages[columnId] || { icon: '📝', text: 'No tasks' };

		emptyIcon.textContent = message.icon;
		emptyMessage.textContent = message.text;

		emptyState.appendChild(emptyIcon);
		emptyState.appendChild(emptyMessage);

		container.appendChild(emptyState);
	}

	/**
	 * Get task container element
	 */
	getTaskContainer(columnId) {
		return document.querySelector(
			`[data-column="${columnId}"] .task-container`
		);
	}

	/**
	 * Show loading state
	 */
	showLoading(show) {
		const loadingOverlay = document.getElementById('loading-overlay');
		if (loadingOverlay) {
			loadingOverlay.style.display = show ? 'flex' : 'none';
		}
	}

	/**
	 * Show error message
	 */
	showError(message) {
		const errorContainer = document.getElementById('error-container');
		const errorMessage = document.querySelector('.error-message');

		if (errorContainer && errorMessage) {
			errorMessage.textContent = message;
			errorContainer.style.display = 'block';

			// Auto-hide after 5 seconds
			setTimeout(() => {
				errorContainer.style.display = 'none';
			}, 5000);
		}

		// Also announce to screen reader
		this.announceToScreenReader('Error: ' + message);
	}

	/**
	 * Show success message
	 */
	showSuccess(message) {
		const successContainer = document.getElementById('success-container');
		const successMessage = document.querySelector('.success-message');

		if (successContainer && successMessage) {
			successMessage.textContent = message;
			successContainer.style.display = 'block';

			// Auto-hide after 3 seconds
			setTimeout(() => {
				successContainer.style.display = 'none';
			}, 3000);
		}

		// Also announce to screen reader
		this.announceToScreenReader('Success: ' + message);
	}

	/**
	 * Announce message to screen reader
	 */
	announceToScreenReader(message) {
		const announcements = document.getElementById('sr-announcements');
		if (announcements) {
			announcements.textContent = message;

			// Clear after announcement
			setTimeout(() => {
				announcements.textContent = '';
			}, 1000);
		}
	}

	/**
	 * Cache tasks in localStorage
	 */
	saveCachedTasks() {
		try {
			localStorage.setItem('kanban-tasks', JSON.stringify(this.tasks));
		} catch (error) {
			console.warn('Failed to cache tasks:', error);
		}
	}

	/**
	 * Get cached tasks from localStorage
	 */
	getCachedTasks() {
		try {
			const cached = localStorage.getItem('kanban-tasks');
			return cached ? JSON.parse(cached) : null;
		} catch (error) {
			console.warn('Failed to load cached tasks:', error);
			return null;
		}
	}

	/**
	 * Debounce utility function
	 */
	debounce(func, wait) {
		let timeout;
		return function executedFunction(...args) {
			const later = () => {
				clearTimeout(timeout);
				func(...args);
			};
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
		};
	}
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
	module.exports = KanbanBoard;
}
