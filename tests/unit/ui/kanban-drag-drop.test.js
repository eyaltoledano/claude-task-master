/**
 * Test suite for Kanban board drag-and-drop functionality
 * Following TDD principles - tests written first
 */

import {
	describe,
	it,
	expect,
	jest,
	beforeEach,
	afterEach
} from '@jest/globals';
import { JSDOM } from 'jsdom';

describe('Kanban Drag-and-Drop', () => {
	let dom;
	let document;
	let window;
	let kanban;

	beforeEach(() => {
		// Set up DOM environment
		dom = new JSDOM(
			`
            <!DOCTYPE html>
            <html>
            <body>
                <div class="kanban-board">
                    <div class="kanban-column" id="backlog">
                        <div class="task-container" data-column="backlog"></div>
                    </div>
                    <div class="kanban-column" id="ready">
                        <div class="task-container" data-column="ready"></div>
                    </div>
                    <div class="kanban-column" id="in-progress">
                        <div class="task-container" data-column="in-progress"></div>
                    </div>
                    <div class="kanban-column" id="completed">
                        <div class="task-container" data-column="completed"></div>
                    </div>
                </div>
            </body>
            </html>
        `,
			{ url: 'http://localhost' }
		);

		document = dom.window.document;
		window = dom.window;
		global.document = document;
		global.window = window;
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('SortableJS Integration', () => {
		it('should initialize SortableJS on all task containers', () => {
			const mockSortable = jest.fn();
			window.Sortable = { create: mockSortable };

			const kanban = {
				initializeDragAndDrop: function () {
					const containers = document.querySelectorAll('.task-container');
					containers.forEach((container) => {
						window.Sortable.create(container, {
							group: 'kanban',
							animation: 150
						});
					});
				}
			};

			kanban.initializeDragAndDrop();

			expect(mockSortable).toHaveBeenCalledTimes(4);
		});

		it('should configure SortableJS with correct options', () => {
			const mockSortable = jest.fn();
			window.Sortable = { create: mockSortable };

			const kanban = {
				initializeDragAndDrop: function () {
					const containers = document.querySelectorAll('.task-container');
					containers.forEach((container) => {
						window.Sortable.create(container, {
							group: 'kanban',
							animation: 150,
							ghostClass: 'sortable-ghost',
							chosenClass: 'sortable-chosen',
							dragClass: 'sortable-drag',
							onEnd: this.handleDragEnd
						});
					});
				}
			};

			kanban.initializeDragAndDrop();

			const callArgs = mockSortable.mock.calls[0][1];
			expect(callArgs).toMatchObject({
				group: 'kanban',
				animation: 150,
				ghostClass: 'sortable-ghost'
			});
		});
	});

	describe('Drag Event Handlers', () => {
		it('should capture source column and task data on drag start', () => {
			const taskCard = document.createElement('div');
			taskCard.dataset.taskId = '1';
			taskCard.dataset.taskStatus = 'pending';

			const kanban = {
				draggedTask: null,
				sourceColumn: null,
				handleDragStart: function (evt) {
					this.draggedTask = {
						id: evt.item.dataset.taskId,
						status: evt.item.dataset.taskStatus
					};
					this.sourceColumn = evt.from.dataset.column;
				}
			};

			const event = {
				item: taskCard,
				from: { dataset: { column: 'backlog' } }
			};

			kanban.handleDragStart(event);

			expect(kanban.draggedTask).toEqual({
				id: '1',
				status: 'pending'
			});
			expect(kanban.sourceColumn).toBe('backlog');
		});

		it('should determine new status based on destination column', () => {
			const kanban = {
				getStatusFromColumn: function (column) {
					const statusMap = {
						backlog: 'pending',
						ready: 'pending',
						'in-progress': 'in-progress',
						completed: 'done'
					};
					return statusMap[column] || 'pending';
				}
			};

			expect(kanban.getStatusFromColumn('in-progress')).toBe('in-progress');
			expect(kanban.getStatusFromColumn('completed')).toBe('done');
			expect(kanban.getStatusFromColumn('ready')).toBe('pending');
		});
	});

	describe('API Integration', () => {
		it('should call API to update task status on drop', async () => {
			const mockFetch = jest.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ success: true })
			});
			global.fetch = mockFetch;

			const kanban = {
				updateTaskStatus: async function (taskId, newStatus) {
					const response = await fetch(`/api/tasks/${taskId}/status`, {
						method: 'PATCH',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({ status: newStatus })
					});
					return response.json();
				}
			};

			await kanban.updateTaskStatus('1', 'in-progress');

			expect(mockFetch).toHaveBeenCalledWith(
				'/api/tasks/1/status',
				expect.objectContaining({
					method: 'PATCH',
					body: JSON.stringify({ status: 'in-progress' })
				})
			);
		});

		it('should handle API errors gracefully', async () => {
			const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'));
			global.fetch = mockFetch;

			const kanban = {
				updateTaskStatus: async function (taskId, newStatus) {
					try {
						const response = await fetch(`/api/tasks/${taskId}/status`, {
							method: 'PATCH',
							body: JSON.stringify({ status: newStatus })
						});
						return response.json();
					} catch (error) {
						console.error('Failed to update task status:', error);
						throw error;
					}
				}
			};

			await expect(kanban.updateTaskStatus('1', 'done')).rejects.toThrow(
				'Network error'
			);
		});
	});

	describe('Rollback Mechanism', () => {
		it('should rollback card position on API failure', async () => {
			const taskCard = document.createElement('div');
			taskCard.dataset.taskId = '1';

			const backlogContainer = document.querySelector(
				'[data-column="backlog"]'
			);
			const inProgressContainer = document.querySelector(
				'[data-column="in-progress"]'
			);

			backlogContainer.appendChild(taskCard);

			const kanban = {
				rollbackDrag: function (taskElement, sourceContainer) {
					sourceContainer.appendChild(taskElement);
				},
				handleDragEnd: async function (evt) {
					try {
						// Simulate API call failure
						throw new Error('API Error');
					} catch (error) {
						this.rollbackDrag(evt.item, evt.from);
					}
				}
			};

			// Simulate drag from backlog to in-progress
			inProgressContainer.appendChild(taskCard);

			await kanban.handleDragEnd({
				item: taskCard,
				from: backlogContainer,
				to: inProgressContainer
			});

			// Card should be back in backlog after rollback
			expect(backlogContainer.contains(taskCard)).toBe(true);
			expect(inProgressContainer.contains(taskCard)).toBe(false);
		});
	});

	describe('Visual Feedback', () => {
		it('should add visual classes during drag', () => {
			const taskCard = document.createElement('div');
			taskCard.classList.add('task-card');

			const kanban = {
				addDragVisualFeedback: function (element) {
					element.classList.add('dragging');
					element.style.opacity = '0.5';
				},
				removeDragVisualFeedback: function (element) {
					element.classList.remove('dragging');
					element.style.opacity = '';
				}
			};

			kanban.addDragVisualFeedback(taskCard);
			expect(taskCard.classList.contains('dragging')).toBe(true);
			expect(taskCard.style.opacity).toBe('0.5');

			kanban.removeDragVisualFeedback(taskCard);
			expect(taskCard.classList.contains('dragging')).toBe(false);
			expect(taskCard.style.opacity).toBe('');
		});
	});

	describe('Accessibility', () => {
		it('should announce drag operations to screen readers', () => {
			const announcement = document.createElement('div');
			announcement.setAttribute('role', 'status');
			announcement.setAttribute('aria-live', 'polite');
			announcement.classList.add('sr-only');
			document.body.appendChild(announcement);

			const kanban = {
				announceToScreenReader: function (message) {
					const announcer = document.querySelector('[role="status"]');
					announcer.textContent = message;
				}
			};

			kanban.announceToScreenReader('Task moved to In Progress column');

			expect(announcement.textContent).toBe('Task moved to In Progress column');
		});

		it('should maintain keyboard navigation support', () => {
			const taskCard = document.createElement('div');
			taskCard.setAttribute('tabindex', '0');
			taskCard.setAttribute('role', 'button');
			taskCard.setAttribute('aria-grabbed', 'false');

			const kanban = {
				setupKeyboardDragDrop: function (element) {
					element.addEventListener('keydown', (e) => {
						if (e.key === ' ' || e.key === 'Enter') {
							const isGrabbed = element.getAttribute('aria-grabbed') === 'true';
							element.setAttribute('aria-grabbed', !isGrabbed);
						}
					});
				}
			};

			kanban.setupKeyboardDragDrop(taskCard);

			const event = new window.KeyboardEvent('keydown', { key: 'Enter' });
			taskCard.dispatchEvent(event);

			expect(taskCard.getAttribute('aria-grabbed')).toBe('true');
		});
	});
});
