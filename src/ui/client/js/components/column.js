/**
 * Column - Component for managing Kanban board columns
 * Handles column state, task containers, and column-specific interactions
 */
class Column {
	/**
	 * Column configuration
	 */
	static config = {
		backlog: {
			title: 'Backlog',
			description: 'Tasks that are not yet ready to be worked on',
			color: '#6f42c1',
			icon: '📋',
			emptyMessage: 'No tasks in backlog'
		},
		ready: {
			title: 'Ready',
			description: 'Tasks that are ready to be started',
			color: '#007bff',
			icon: '🚀',
			emptyMessage: 'Ready to start'
		},
		'in-progress': {
			title: 'In Progress',
			description: 'Tasks currently being worked on',
			color: '#fd7e14',
			icon: '⚡',
			emptyMessage: 'Nothing in progress'
		},
		review: {
			title: 'Review',
			description: 'Tasks waiting for review or testing',
			color: '#ffc107',
			icon: '👀',
			emptyMessage: 'No tasks to review'
		},
		done: {
			title: 'Done',
			description: 'Completed tasks',
			color: '#28a745',
			icon: '✅',
			emptyMessage: 'No completed tasks'
		}
	};

	/**
	 * Initialize all columns
	 */
	static initializeAll() {
		const columns = document.querySelectorAll('.kanban-column');

		columns.forEach((column) => {
			const columnId = column.getAttribute('data-column');
			this.initialize(column, columnId);
		});
	}

	/**
	 * Initialize a single column
	 */
	static initialize(columnElement, columnId) {
		if (!columnElement || !columnId) {
			console.error('Invalid column element or ID provided');
			return;
		}

		const config = this.config[columnId];
		if (!config) {
			console.warn(`No configuration found for column: ${columnId}`);
			return;
		}

		// Set up column attributes
		this.setupColumnAttributes(columnElement, columnId, config);

		// Set up task container
		this.setupTaskContainer(columnElement, columnId, config);

		// Set up column header
		this.setupColumnHeader(columnElement, columnId, config);

		// Set up add task button
		this.setupAddTaskButton(columnElement, columnId, config);

		// Set up event listeners
		this.setupEventListeners(columnElement, columnId);

		console.log(`Column initialized: ${columnId}`);
	}

	/**
	 * Setup column attributes for accessibility
	 */
	static setupColumnAttributes(columnElement, columnId, config) {
		columnElement.setAttribute('role', 'region');
		columnElement.setAttribute('aria-labelledby', `${columnId}-title`);
		columnElement.setAttribute('aria-describedby', `${columnId}-description`);

		// Add description for screen readers
		let descriptionElement = columnElement.querySelector('.column-description');
		if (!descriptionElement) {
			descriptionElement = document.createElement('div');
			descriptionElement.id = `${columnId}-description`;
			descriptionElement.className = 'sr-only column-description';
			descriptionElement.textContent = config.description;
			columnElement.appendChild(descriptionElement);
		}
	}

	/**
	 * Setup task container with proper attributes
	 */
	static setupTaskContainer(columnElement, columnId, config) {
		const container = columnElement.querySelector('.task-container');
		if (!container) {
			console.error(`Task container not found for column: ${columnId}`);
			return;
		}

		// Set accessibility attributes
		container.setAttribute('role', 'listbox');
		container.setAttribute('aria-label', `${config.title} tasks`);
		container.setAttribute('aria-multiselectable', 'false');
		container.setAttribute('data-column', columnId);
		container.setAttribute('data-droppable', 'true');
		container.setAttribute('aria-dropeffect', 'move');

		// Set empty message data attribute
		container.setAttribute('data-empty-message', config.emptyMessage);
	}

	/**
	 * Setup column header elements
	 */
	static setupColumnHeader(columnElement, columnId, config) {
		const header = columnElement.querySelector('.column-header');
		if (!header) {
			console.error(`Column header not found for column: ${columnId}`);
			return;
		}

		// Setup title
		const title = header.querySelector('.column-title');
		if (title) {
			title.id = `${columnId}-title`;
			title.textContent = config.title;
		}

		// Setup task count
		const taskCount = header.querySelector('.task-count');
		if (taskCount) {
			taskCount.setAttribute('aria-label', '0 tasks');
			taskCount.textContent = '0';
		}

		// Setup menu button
		const menuButton = header.querySelector('.column-menu-btn');
		if (menuButton) {
			menuButton.setAttribute(
				'aria-label',
				`Column options for ${config.title}`
			);
			menuButton.setAttribute('aria-haspopup', 'menu');
			menuButton.setAttribute('data-column', columnId);
		}
	}

	/**
	 * Setup add task button
	 */
	static setupAddTaskButton(columnElement, columnId, config) {
		const addButton = columnElement.querySelector('.add-task-btn');
		if (!addButton) {
			console.error(`Add task button not found for column: ${columnId}`);
			return;
		}

		addButton.setAttribute('aria-label', `Add new task to ${config.title}`);
		addButton.setAttribute('data-column', columnId);
		addButton.setAttribute('type', 'button');
	}

	/**
	 * Setup column-specific event listeners
	 */
	static setupEventListeners(columnElement, columnId) {
		const container = columnElement.querySelector('.task-container');
		const menuButton = columnElement.querySelector('.column-menu-btn');

		// Task container events
		if (container) {
			container.addEventListener('dragenter', (event) => {
				this.handleDragEnter(event, columnId);
			});

			container.addEventListener('dragleave', (event) => {
				this.handleDragLeave(event, columnId);
			});

			container.addEventListener('dragover', (event) => {
				this.handleDragOver(event, columnId);
			});

			container.addEventListener('drop', (event) => {
				this.handleDrop(event, columnId);
			});

			// Keyboard navigation within column
			container.addEventListener('keydown', (event) => {
				this.handleKeyDown(event, columnId);
			});
		}

		// Menu button events
		if (menuButton) {
			menuButton.addEventListener('click', (event) => {
				this.handleMenuClick(event, columnId);
			});
		}
	}

	/**
	 * Handle drag enter events
	 */
	static handleDragEnter(event, columnId) {
		event.preventDefault();
		const container = event.currentTarget;

		container.classList.add('drag-over');
		container.setAttribute('data-drag-over', 'true');

		// Announce to screen reader
		this.announceToScreenReader(
			`Entering ${this.config[columnId].title} column`
		);
	}

	/**
	 * Handle drag leave events
	 */
	static handleDragLeave(event, columnId) {
		// Only remove drag state if we're actually leaving the container
		if (!event.currentTarget.contains(event.relatedTarget)) {
			const container = event.currentTarget;
			container.classList.remove('drag-over');
			container.removeAttribute('data-drag-over');
		}
	}

	/**
	 * Handle drag over events
	 */
	static handleDragOver(event, columnId) {
		event.preventDefault();
		event.dataTransfer.dropEffect = 'move';

		const container = event.currentTarget;
		container.classList.add('drag-over');
		container.setAttribute('data-drag-over', 'true');
	}

	/**
	 * Handle drop events
	 */
	static handleDrop(event, columnId) {
		event.preventDefault();

		const container = event.currentTarget;
		container.classList.remove('drag-over');
		container.removeAttribute('data-drag-over');

		// The actual drop handling is done in the main KanbanBoard class
		// This just cleans up the visual state
	}

	/**
	 * Handle keyboard navigation within column
	 */
	static handleKeyDown(event, columnId) {
		const container = event.currentTarget;
		const tasks = container.querySelectorAll('.task-card');

		switch (event.key) {
			case 'Home':
				if (tasks.length > 0) {
					tasks[0].focus();
					event.preventDefault();
				}
				break;

			case 'End':
				if (tasks.length > 0) {
					tasks[tasks.length - 1].focus();
					event.preventDefault();
				}
				break;
		}
	}

	/**
	 * Handle column menu button clicks
	 */
	static handleMenuClick(event, columnId) {
		event.preventDefault();

		const config = this.config[columnId];
		const button = event.currentTarget;

		// Create context menu
		this.showColumnMenu(button, columnId, config);
	}

	/**
	 * Show column context menu
	 */
	static showColumnMenu(buttonElement, columnId, config) {
		// Remove any existing menus
		this.hideColumnMenu();

		const menu = document.createElement('div');
		menu.className = 'column-menu';
		menu.setAttribute('role', 'menu');
		menu.setAttribute('aria-labelledby', `${columnId}-menu-btn`);
		menu.id = `${columnId}-menu`;

		const menuItems = [
			{ label: 'Add Task', action: 'add-task', icon: '➕' },
			{ label: 'Clear Column', action: 'clear-column', icon: '🗑️' },
			{ label: 'Sort Tasks', action: 'sort-tasks', icon: '📊' },
			{ type: 'separator' },
			{ label: 'Column Settings', action: 'settings', icon: '⚙️' }
		];

		menuItems.forEach((item) => {
			if (item.type === 'separator') {
				const separator = document.createElement('hr');
				separator.className = 'menu-separator';
				separator.setAttribute('role', 'separator');
				menu.appendChild(separator);
			} else {
				const menuItem = document.createElement('button');
				menuItem.className = 'menu-item';
				menuItem.setAttribute('role', 'menuitem');
				menuItem.setAttribute('data-action', item.action);
				menuItem.innerHTML = `<span class="menu-icon">${item.icon}</span> ${item.label}`;

				menuItem.addEventListener('click', (event) => {
					this.handleMenuItemClick(event, columnId, item.action);
				});

				menu.appendChild(menuItem);
			}
		});

		// Position menu
		const rect = buttonElement.getBoundingClientRect();
		menu.style.position = 'fixed';
		menu.style.top = `${rect.bottom + 5}px`;
		menu.style.right = `${window.innerWidth - rect.right}px`;
		menu.style.zIndex = '1000';

		document.body.appendChild(menu);

		// Focus first menu item
		const firstItem = menu.querySelector('.menu-item');
		if (firstItem) {
			firstItem.focus();
		}

		// Setup keyboard navigation for menu
		this.setupMenuKeyboardNavigation(menu);

		// Close menu when clicking outside
		setTimeout(() => {
			document.addEventListener('click', this.handleDocumentClick.bind(this), {
				once: true
			});
		}, 0);

		// Mark button as expanded
		buttonElement.setAttribute('aria-expanded', 'true');
		buttonElement.id = `${columnId}-menu-btn`;
	}

	/**
	 * Hide column menu
	 */
	static hideColumnMenu() {
		const existingMenu = document.querySelector('.column-menu');
		if (existingMenu) {
			existingMenu.remove();
		}

		// Reset button states
		document.querySelectorAll('.column-menu-btn').forEach((btn) => {
			btn.removeAttribute('aria-expanded');
		});
	}

	/**
	 * Handle menu item clicks
	 */
	static handleMenuItemClick(event, columnId, action) {
		event.preventDefault();

		const config = this.config[columnId];

		switch (action) {
			case 'add-task':
				this.addTaskToColumn(columnId);
				break;
			case 'clear-column':
				this.clearColumn(columnId);
				break;
			case 'sort-tasks':
				this.sortTasks(columnId);
				break;
			case 'settings':
				this.showColumnSettings(columnId);
				break;
		}

		this.hideColumnMenu();

		// Announce action to screen reader
		this.announceToScreenReader(
			`${action.replace('-', ' ')} for ${config.title} column`
		);
	}

	/**
	 * Setup keyboard navigation for menu
	 */
	static setupMenuKeyboardNavigation(menu) {
		const items = menu.querySelectorAll('.menu-item');

		menu.addEventListener('keydown', (event) => {
			const currentIndex = Array.from(items).indexOf(document.activeElement);

			switch (event.key) {
				case 'ArrowDown':
					event.preventDefault();
					const nextIndex = (currentIndex + 1) % items.length;
					items[nextIndex].focus();
					break;

				case 'ArrowUp':
					event.preventDefault();
					const prevIndex = (currentIndex - 1 + items.length) % items.length;
					items[prevIndex].focus();
					break;

				case 'Escape':
					event.preventDefault();
					this.hideColumnMenu();
					break;

				case 'Tab':
					event.preventDefault();
					this.hideColumnMenu();
					break;
			}
		});
	}

	/**
	 * Handle document click to close menu
	 */
	static handleDocumentClick(event) {
		const menu = document.querySelector('.column-menu');
		if (menu && !menu.contains(event.target)) {
			this.hideColumnMenu();
		}
	}

	/**
	 * Add task to specific column
	 */
	static addTaskToColumn(columnId) {
		// Trigger add task modal with specific column
		const event = new CustomEvent('column-add-task', {
			detail: { columnId }
		});
		document.dispatchEvent(event);
	}

	/**
	 * Clear all tasks from column
	 */
	static clearColumn(columnId) {
		const config = this.config[columnId];

		const confirmed = confirm(
			`Are you sure you want to clear all tasks from ${config.title}?`
		);
		if (confirmed) {
			const event = new CustomEvent('column-clear', {
				detail: { columnId }
			});
			document.dispatchEvent(event);
		}
	}

	/**
	 * Sort tasks in column
	 */
	static sortTasks(columnId) {
		const event = new CustomEvent('column-sort', {
			detail: { columnId }
		});
		document.dispatchEvent(event);
	}

	/**
	 * Show column settings
	 */
	static showColumnSettings(columnId) {
		const event = new CustomEvent('column-settings', {
			detail: { columnId }
		});
		document.dispatchEvent(event);
	}

	/**
	 * Update task count for a column
	 */
	static updateTaskCount(columnId, count) {
		const column = document.querySelector(`[data-column="${columnId}"]`);
		if (!column) return;

		const countElement = column.querySelector('.task-count');
		if (countElement) {
			countElement.textContent = count.toString();
			countElement.setAttribute(
				'aria-label',
				`${count} task${count !== 1 ? 's' : ''}`
			);
		}

		// Update column accessibility
		const config = this.config[columnId];
		if (config) {
			const container = column.querySelector('.task-container');
			if (container) {
				container.setAttribute(
					'aria-label',
					`${config.title} tasks, ${count} item${count !== 1 ? 's' : ''}`
				);
			}
		}
	}

	/**
	 * Show loading state in column
	 */
	static showLoading(columnId, show = true) {
		const column = document.querySelector(`[data-column="${columnId}"]`);
		if (!column) return;

		const container = column.querySelector('.task-container');
		if (!container) return;

		if (show) {
			// Add loading indicator
			if (!container.querySelector('.column-loading')) {
				const loading = document.createElement('div');
				loading.className = 'column-loading';
				loading.setAttribute('aria-live', 'polite');
				loading.innerHTML = `
                    <div class="spinner"></div>
                    <span class="sr-only">Loading tasks...</span>
                `;
				container.appendChild(loading);
			}
		} else {
			// Remove loading indicator
			const loading = container.querySelector('.column-loading');
			if (loading) {
				loading.remove();
			}
		}
	}

	/**
	 * Show empty state in column
	 */
	static showEmptyState(columnId, show = true) {
		const column = document.querySelector(`[data-column="${columnId}"]`);
		if (!column) return;

		const container = column.querySelector('.task-container');
		if (!container) return;

		if (show && container.children.length === 0) {
			const config = this.config[columnId];
			if (config) {
				const emptyState = document.createElement('div');
				emptyState.className = 'empty-state';
				emptyState.innerHTML = `
                    <div class="empty-icon">${config.icon}</div>
                    <p class="empty-message">${config.emptyMessage}</p>
                `;
				container.appendChild(emptyState);
			}
		} else {
			// Remove empty state
			const emptyState = container.querySelector('.empty-state');
			if (emptyState) {
				emptyState.remove();
			}
		}
	}

	/**
	 * Highlight column for keyboard navigation
	 */
	static highlight(columnId, highlight = true) {
		const column = document.querySelector(`[data-column="${columnId}"]`);
		if (!column) return;

		if (highlight) {
			column.classList.add('keyboard-target');
			column.setAttribute('aria-current', 'location');
		} else {
			column.classList.remove('keyboard-target');
			column.removeAttribute('aria-current');
		}
	}

	/**
	 * Get column element by ID
	 */
	static getById(columnId) {
		return document.querySelector(`[data-column="${columnId}"]`);
	}

	/**
	 * Get all column elements
	 */
	static getAll() {
		return document.querySelectorAll('.kanban-column');
	}

	/**
	 * Get task container for column
	 */
	static getTaskContainer(columnId) {
		const column = this.getById(columnId);
		return column ? column.querySelector('.task-container') : null;
	}

	/**
	 * Get tasks in column
	 */
	static getTasks(columnId) {
		const container = this.getTaskContainer(columnId);
		return container ? container.querySelectorAll('.task-card') : [];
	}

	/**
	 * Check if column is empty
	 */
	static isEmpty(columnId) {
		const tasks = this.getTasks(columnId);
		return tasks.length === 0;
	}

	/**
	 * Get column configuration
	 */
	static getConfig(columnId) {
		return this.config[columnId] || null;
	}

	/**
	 * Get all column IDs
	 */
	static getAllIds() {
		return Object.keys(this.config);
	}

	/**
	 * Validate column ID
	 */
	static isValidColumnId(columnId) {
		return this.config.hasOwnProperty(columnId);
	}

	/**
	 * Get next column in sequence
	 */
	static getNextColumn(currentColumnId) {
		const columnIds = this.getAllIds();
		const currentIndex = columnIds.indexOf(currentColumnId);

		if (currentIndex >= 0 && currentIndex < columnIds.length - 1) {
			return columnIds[currentIndex + 1];
		}

		return null;
	}

	/**
	 * Get previous column in sequence
	 */
	static getPreviousColumn(currentColumnId) {
		const columnIds = this.getAllIds();
		const currentIndex = columnIds.indexOf(currentColumnId);

		if (currentIndex > 0) {
			return columnIds[currentIndex - 1];
		}

		return null;
	}

	/**
	 * Announce message to screen reader
	 */
	static announceToScreenReader(message) {
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
	 * Setup responsive behavior for columns
	 */
	static setupResponsiveBehavior() {
		const handleResize = () => {
			const width = window.innerWidth;
			const columns = this.getAll();

			columns.forEach((column) => {
				const columnId = column.getAttribute('data-column');
				const config = this.config[columnId];

				if (width <= 768) {
					// Mobile view adjustments
					column.classList.add('mobile-view');

					// Update accessibility labels for mobile
					const container = column.querySelector('.task-container');
					if (container && config) {
						container.setAttribute('aria-label', `${config.title} section`);
					}
				} else {
					column.classList.remove('mobile-view');

					// Restore desktop accessibility labels
					const container = column.querySelector('.task-container');
					if (container && config) {
						const taskCount = this.getTasks(columnId).length;
						container.setAttribute(
							'aria-label',
							`${config.title} tasks, ${taskCount} item${taskCount !== 1 ? 's' : ''}`
						);
					}
				}
			});
		};

		// Initial setup
		handleResize();

		// Listen for resize events
		window.addEventListener('resize', this.debounce(handleResize, 250));
	}

	/**
	 * Debounce utility function
	 */
	static debounce(func, wait) {
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
	module.exports = Column;
}
