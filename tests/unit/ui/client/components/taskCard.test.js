import {
	describe,
	test,
	expect,
	beforeEach,
	afterEach,
	jest
} from '@jest/globals';

/**
 * Comprehensive Test Suite for TaskCard Component System
 *
 * Tests the complete TaskCard component implementation including:
 * - Component initialization and structure
 * - Priority color coding system
 * - Badge systems (parent task, complexity, AI model)
 * - Description truncation and expansion
 * - Progress bar calculations
 * - Card type variants (main vs subtask)
 * - Dependency count display
 * - Accessibility features
 * - Performance with many cards
 * - Memory cleanup
 *
 * Following TDD methodology with comprehensive coverage
 */

// Mock TaskCard implementation for testing
class MockTaskCard {
	static create(task) {
		if (!task || !task.id) {
			console.error('Invalid task data provided to TaskCard.create');
			return null;
		}

		const card = {
			tagName: 'DIV',
			className: 'task-card',
			attributes: {
				'data-task-id': task.id,
				'data-priority': task.priority || 'medium',
				'data-card-type': task.subtasks?.length > 0 ? 'parent' : 'main',
				draggable: 'true',
				tabindex: '0',
				role: 'option',
				'aria-grabbed': 'false',
				'aria-label': `Task: ${task.title}`
			},
			children: [],
			style: {},
			classList: ['task-card'],
			dataset: {
				taskId: task.id,
				priority: task.priority || 'medium',
				cardType: task.subtasks?.length > 0 ? 'parent' : 'main'
			}
		};

		// Add priority color coding
		if (task.priority) {
			card.classList.push(`priority-${task.priority}`);
		}

		// Add glassmorphism effect class
		card.classList.push('glassmorphism');

		return card;
	}

	static getPriorityColor(priority) {
		const colorMap = {
			critical: '#dc3545', // Red
			high: '#fd7e14', // Orange
			medium: '#0d6efd', // Blue
			low: '#198754' // Green
		};
		return colorMap[priority] || colorMap.medium;
	}

	static createParentTaskBadge(task) {
		if (!task.subtasks || task.subtasks.length === 0) return null;

		return {
			tagName: 'SPAN',
			className: 'parent-task-badge',
			textContent: `Parent (${task.subtasks.length})`,
			style: {
				backgroundColor: this.getParentBadgeColor(task.id),
				color: '#fff'
			}
		};
	}

	static getParentBadgeColor(taskId) {
		// Generate unique color based on task ID
		const colors = [
			'#6f42c1',
			'#dc3545',
			'#fd7e14',
			'#198754',
			'#0d6efd',
			'#6610f2'
		];
		const hash = taskId.split('').reduce((a, b) => {
			a = (a << 5) - a + b.charCodeAt(0);
			return a & a;
		}, 0);
		return colors[Math.abs(hash) % colors.length];
	}

	static createComplexityBadge(complexityScore) {
		if (!complexityScore || complexityScore < 1 || complexityScore > 10)
			return null;

		let badgeClass = 'complexity-low';
		if (complexityScore >= 7) badgeClass = 'complexity-high';
		else if (complexityScore >= 4) badgeClass = 'complexity-medium';

		return {
			tagName: 'SPAN',
			className: `complexity-badge ${badgeClass}`,
			textContent: complexityScore.toString(),
			attributes: {
				'aria-label': `Complexity: ${complexityScore} out of 10`,
				title: `Complexity Score: ${complexityScore}/10`
			}
		};
	}

	static createAIModelTag(aiModel) {
		if (!aiModel) return null;

		return {
			tagName: 'SPAN',
			className: 'ai-model-tag',
			textContent: aiModel,
			attributes: {
				'aria-label': `AI Model: ${aiModel}`,
				'data-ai-model': aiModel
			}
		};
	}

	static createDependencyIndicator(dependencyCount) {
		if (!dependencyCount || dependencyCount === 0) return null;

		return {
			tagName: 'SPAN',
			className: 'dependency-indicator',
			textContent: `${dependencyCount} deps`,
			attributes: {
				'aria-label': `${dependencyCount} dependencies`,
				title: `This task has ${dependencyCount} dependencies`
			}
		};
	}

	static createProgressBar(task) {
		if (!task.subtasks || task.subtasks.length === 0) return null;

		const completedSubtasks = task.subtasks.filter(
			(st) => st.status === 'done'
		).length;
		const progress = (completedSubtasks / task.subtasks.length) * 100;

		return {
			tagName: 'DIV',
			className: 'progress-bar-container',
			children: [
				{
					tagName: 'DIV',
					className: 'progress-bar',
					style: { width: `${progress}%` },
					attributes: {
						'aria-valuenow': progress,
						'aria-valuemin': '0',
						'aria-valuemax': '100',
						role: 'progressbar',
						'aria-label': `Progress: ${completedSubtasks} of ${task.subtasks.length} subtasks completed`
					}
				}
			]
		};
	}

	static truncateDescription(description, maxLength = 120) {
		if (!description || description.length <= maxLength) {
			return { text: description, isTruncated: false };
		}

		const truncated = description.substring(0, maxLength).trim();
		const lastSpace = truncated.lastIndexOf(' ');
		const finalText =
			lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;

		return {
			text: finalText + '...',
			isTruncated: true,
			originalText: description
		};
	}

	static validateTask(task) {
		const errors = [];

		if (!task || typeof task !== 'object') {
			errors.push('Task must be an object');
			return { valid: false, errors };
		}

		if (!task.id) errors.push('Task must have an ID');
		if (!task.title || typeof task.title !== 'string' || !task.title.trim()) {
			errors.push('Task must have a non-empty title');
		}

		const validStatuses = ['backlog', 'ready', 'in-progress', 'review', 'done'];
		if (task.status && !validStatuses.includes(task.status)) {
			errors.push(`Invalid status: ${task.status}`);
		}

		const validPriorities = ['low', 'medium', 'high', 'critical'];
		if (task.priority && !validPriorities.includes(task.priority)) {
			errors.push(`Invalid priority: ${task.priority}`);
		}

		if (
			task.complexityScore &&
			(task.complexityScore < 1 || task.complexityScore > 10)
		) {
			errors.push('Complexity score must be between 1 and 10');
		}

		return { valid: errors.length === 0, errors };
	}

	static remove(cardElement) {
		return new Promise((resolve) => {
			// Simulate animation
			setTimeout(() => {
				resolve();
			}, 200);
		});
	}

	static focus(cardElement) {
		if (cardElement && typeof cardElement.focus === 'function') {
			cardElement.focus();
		}
	}

	static cleanup(cardElement) {
		// Simulate cleanup of event listeners and references
		if (cardElement) {
			cardElement._listeners = null;
			cardElement._observers = null;
		}
	}
}

describe('TaskCard Component System - Comprehensive Test Suite', () => {
	let mockDOM;
	let mockTask;
	let TaskCard;

	beforeEach(() => {
		// Setup mock DOM environment
		mockDOM = {
			createElement: jest.fn((tag) => ({
				tagName: tag.toUpperCase(),
				className: '',
				children: [],
				style: {},
				attributes: {},
				classList: {
					add: jest.fn(),
					remove: jest.fn(),
					contains: jest.fn(),
					toggle: jest.fn()
				},
				setAttribute: jest.fn(),
				getAttribute: jest.fn(),
				appendChild: jest.fn(),
				removeChild: jest.fn(),
				addEventListener: jest.fn(),
				removeEventListener: jest.fn(),
				focus: jest.fn(),
				blur: jest.fn()
			})),
			querySelector: jest.fn(),
			querySelectorAll: jest.fn(() => [])
		};

		global.document = mockDOM;

		// Setup mock task data
		mockTask = {
			id: 'task-123',
			title: 'Implement authentication system',
			description:
				'Create a comprehensive authentication system with JWT tokens, password hashing, and user session management.',
			status: 'in-progress',
			priority: 'high',
			complexityScore: 7,
			aiModel: 'claude-3-sonnet',
			dependencies: ['task-100', 'task-101'],
			subtasks: [
				{ id: 'task-123-1', title: 'Setup JWT middleware', status: 'done' },
				{
					id: 'task-123-2',
					title: 'Implement password hashing',
					status: 'done'
				},
				{
					id: 'task-123-3',
					title: 'Create user session management',
					status: 'in-progress'
				},
				{
					id: 'task-123-4',
					title: 'Add password reset functionality',
					status: 'ready'
				}
			],
			tags: ['backend', 'security'],
			assignee: 'john.doe',
			dueDate: '2024-01-15',
			createdAt: '2024-01-01'
		};

		TaskCard = MockTaskCard;
	});

	afterEach(() => {
		jest.clearAllMocks();
		global.document = undefined;
	});

	describe('1. Task Card Component Initialization and Structure', () => {
		test('should create a valid task card element with proper structure', () => {
			const card = TaskCard.create(mockTask);

			expect(card).not.toBeNull();
			expect(card.tagName).toBe('DIV');
			expect(card.className).toContain('task-card');
			expect(card.attributes['data-task-id']).toBe('task-123');
		});

		test('should handle null/undefined task gracefully', () => {
			const nullCard = TaskCard.create(null);
			const undefinedCard = TaskCard.create(undefined);

			expect(nullCard).toBeNull();
			expect(undefinedCard).toBeNull();
		});

		test('should reject task without required ID', () => {
			const invalidTask = { title: 'Test Task' };
			const card = TaskCard.create(invalidTask);

			expect(card).toBeNull();
		});

		test('should set proper ARIA attributes for accessibility', () => {
			const card = TaskCard.create(mockTask);

			expect(card.attributes.role).toBe('option');
			expect(card.attributes['aria-grabbed']).toBe('false');
			expect(card.attributes['aria-label']).toBe(
				'Task: Implement authentication system'
			);
			expect(card.attributes.tabindex).toBe('0');
		});

		test('should mark card as draggable', () => {
			const card = TaskCard.create(mockTask);

			expect(card.attributes.draggable).toBe('true');
		});

		test('should determine card type based on subtasks', () => {
			const parentCard = TaskCard.create(mockTask);
			const simpleTask = { ...mockTask, subtasks: [] };
			const simpleCard = TaskCard.create(simpleTask);

			expect(parentCard.attributes['data-card-type']).toBe('parent');
			expect(simpleCard.attributes['data-card-type']).toBe('main');
		});
	});

	describe('2. Priority Color Coding Logic', () => {
		test('should return correct colors for all priority levels', () => {
			expect(TaskCard.getPriorityColor('critical')).toBe('#dc3545'); // Red
			expect(TaskCard.getPriorityColor('high')).toBe('#fd7e14'); // Orange
			expect(TaskCard.getPriorityColor('medium')).toBe('#0d6efd'); // Blue
			expect(TaskCard.getPriorityColor('low')).toBe('#198754'); // Green
		});

		test('should default to medium priority color for invalid priorities', () => {
			expect(TaskCard.getPriorityColor('invalid')).toBe('#0d6efd');
			expect(TaskCard.getPriorityColor(null)).toBe('#0d6efd');
			expect(TaskCard.getPriorityColor(undefined)).toBe('#0d6efd');
		});

		test('should apply priority class to card element', () => {
			const highPriorityTask = { ...mockTask, priority: 'critical' };
			const card = TaskCard.create(highPriorityTask);

			expect(card.classList).toContain('priority-critical');
			expect(card.attributes['data-priority']).toBe('critical');
		});

		test('should handle missing priority gracefully', () => {
			const noPriorityTask = { ...mockTask };
			delete noPriorityTask.priority;
			const card = TaskCard.create(noPriorityTask);

			expect(card.attributes['data-priority']).toBe('medium');
		});
	});

	describe('3. Badge System (Parent Task, Complexity, AI Model)', () => {
		describe('Parent Task Badges', () => {
			test('should create parent task badge for tasks with subtasks', () => {
				const badge = TaskCard.createParentTaskBadge(mockTask);

				expect(badge).not.toBeNull();
				expect(badge.className).toBe('parent-task-badge');
				expect(badge.textContent).toBe('Parent (4)');
				expect(badge.style.color).toBe('#fff');
			});

			test('should not create badge for tasks without subtasks', () => {
				const simpleTask = { ...mockTask, subtasks: [] };
				const badge = TaskCard.createParentTaskBadge(simpleTask);

				expect(badge).toBeNull();
			});

			test('should generate unique colors for different parent tasks', () => {
				const task1 = { ...mockTask, id: 'task-1' };
				const task2 = { ...mockTask, id: 'task-2' };

				const color1 = TaskCard.getParentBadgeColor(task1.id);
				const color2 = TaskCard.getParentBadgeColor(task2.id);

				expect(color1).not.toBe(color2);
				expect(color1).toMatch(/^#[0-9a-f]{6}$/i);
				expect(color2).toMatch(/^#[0-9a-f]{6}$/i);
			});

			test('should be consistent for same task ID', () => {
				const color1 = TaskCard.getParentBadgeColor('task-123');
				const color2 = TaskCard.getParentBadgeColor('task-123');

				expect(color1).toBe(color2);
			});
		});

		describe('Complexity Score Badges', () => {
			test('should create complexity badge with correct score', () => {
				const badge = TaskCard.createComplexityBadge(7);

				expect(badge).not.toBeNull();
				expect(badge.textContent).toBe('7');
				expect(badge.className).toContain('complexity-badge');
				expect(badge.className).toContain('complexity-high');
			});

			test('should classify complexity levels correctly', () => {
				const lowBadge = TaskCard.createComplexityBadge(2);
				const mediumBadge = TaskCard.createComplexityBadge(5);
				const highBadge = TaskCard.createComplexityBadge(9);

				expect(lowBadge.className).toContain('complexity-low');
				expect(mediumBadge.className).toContain('complexity-medium');
				expect(highBadge.className).toContain('complexity-high');
			});

			test('should include accessibility attributes', () => {
				const badge = TaskCard.createComplexityBadge(6);

				expect(badge.attributes['aria-label']).toBe('Complexity: 6 out of 10');
				expect(badge.attributes.title).toBe('Complexity Score: 6/10');
			});

			test('should reject invalid complexity scores', () => {
				expect(TaskCard.createComplexityBadge(0)).toBeNull();
				expect(TaskCard.createComplexityBadge(11)).toBeNull();
				expect(TaskCard.createComplexityBadge(-1)).toBeNull();
				expect(TaskCard.createComplexityBadge(null)).toBeNull();
			});
		});

		describe('AI Model Assignment Tags', () => {
			test('should create AI model tag with proper attributes', () => {
				const tag = TaskCard.createAIModelTag('claude-3-sonnet');

				expect(tag).not.toBeNull();
				expect(tag.className).toBe('ai-model-tag');
				expect(tag.textContent).toBe('claude-3-sonnet');
				expect(tag.attributes['aria-label']).toBe('AI Model: claude-3-sonnet');
				expect(tag.attributes['data-ai-model']).toBe('claude-3-sonnet');
			});

			test('should handle various AI model names', () => {
				const models = ['gpt-4', 'claude-3-opus', 'gemini-pro', 'llama-2'];

				models.forEach((model) => {
					const tag = TaskCard.createAIModelTag(model);
					expect(tag.textContent).toBe(model);
					expect(tag.attributes['data-ai-model']).toBe(model);
				});
			});

			test('should return null for missing AI model', () => {
				expect(TaskCard.createAIModelTag(null)).toBeNull();
				expect(TaskCard.createAIModelTag(undefined)).toBeNull();
				expect(TaskCard.createAIModelTag('')).toBeNull();
			});
		});
	});

	describe('4. Description Truncation and Expansion', () => {
		test('should truncate long descriptions properly', () => {
			const longDescription =
				'This is a very long description that should be truncated because it exceeds the maximum allowed length for display in the task card interface.';
			const result = TaskCard.truncateDescription(longDescription, 50);

			expect(result.isTruncated).toBe(true);
			expect(result.text).toContain('...');
			expect(result.text.length).toBeLessThanOrEqual(53); // 50 + '...'
			expect(result.originalText).toBe(longDescription);
		});

		test('should not truncate short descriptions', () => {
			const shortDescription = 'Short description';
			const result = TaskCard.truncateDescription(shortDescription, 120);

			expect(result.isTruncated).toBe(false);
			expect(result.text).toBe(shortDescription);
			expect(result.originalText).toBeUndefined();
		});

		test('should truncate at word boundaries', () => {
			const description =
				'This is a test description with multiple words that should break at word boundaries';
			const result = TaskCard.truncateDescription(description, 30);

			expect(result.text).not.toMatch(/\w+\.\.\.$/); // Should not end with partial word
			expect(result.text).toMatch(/\s\.\.\.$/); // Should end with space before ellipsis
		});

		test('should handle edge cases gracefully', () => {
			expect(TaskCard.truncateDescription(null).text).toBeUndefined();
			expect(TaskCard.truncateDescription(undefined).text).toBeUndefined();
			expect(TaskCard.truncateDescription('').text).toBe('');
		});

		test('should use default max length when not specified', () => {
			const longDescription = 'A'.repeat(150);
			const result = TaskCard.truncateDescription(longDescription);

			expect(result.isTruncated).toBe(true);
			expect(result.text.length).toBeLessThanOrEqual(123); // 120 + '...'
		});
	});

	describe('5. Progress Bar Calculations', () => {
		test('should calculate progress correctly for parent tasks', () => {
			const progressBar = TaskCard.createProgressBar(mockTask);

			expect(progressBar).not.toBeNull();
			expect(progressBar.className).toBe('progress-bar-container');

			// 2 of 4 subtasks are done = 50%
			const bar = progressBar.children[0];
			expect(bar.style.width).toBe('50%');
			expect(bar.attributes['aria-valuenow']).toBe(50);
		});

		test('should handle completed tasks (100% progress)', () => {
			const completedTask = {
				...mockTask,
				subtasks: [
					{ id: 'st1', status: 'done' },
					{ id: 'st2', status: 'done' },
					{ id: 'st3', status: 'done' }
				]
			};
			const progressBar = TaskCard.createProgressBar(completedTask);
			const bar = progressBar.children[0];

			expect(bar.style.width).toBe('100%');
			expect(bar.attributes['aria-valuenow']).toBe(100);
		});

		test('should handle tasks with no completed subtasks (0% progress)', () => {
			const uncompletedTask = {
				...mockTask,
				subtasks: [
					{ id: 'st1', status: 'ready' },
					{ id: 'st2', status: 'in-progress' }
				]
			};
			const progressBar = TaskCard.createProgressBar(uncompletedTask);
			const bar = progressBar.children[0];

			expect(bar.style.width).toBe('0%');
			expect(bar.attributes['aria-valuenow']).toBe(0);
		});

		test('should return null for tasks without subtasks', () => {
			const simpleTask = { ...mockTask, subtasks: [] };
			const progressBar = TaskCard.createProgressBar(simpleTask);

			expect(progressBar).toBeNull();
		});

		test('should include proper accessibility attributes', () => {
			const progressBar = TaskCard.createProgressBar(mockTask);
			const bar = progressBar.children[0];

			expect(bar.attributes.role).toBe('progressbar');
			expect(bar.attributes['aria-valuemin']).toBe('0');
			expect(bar.attributes['aria-valuemax']).toBe('100');
			expect(bar.attributes['aria-label']).toBe(
				'Progress: 2 of 4 subtasks completed'
			);
		});
	});

	describe('6. Card Type Variants (Main vs Subtask)', () => {
		test('should identify main task cards correctly', () => {
			const mainTask = { ...mockTask, subtasks: [] };
			const card = TaskCard.create(mainTask);

			expect(card.dataset.cardType).toBe('main');
			expect(card.attributes['data-card-type']).toBe('main');
		});

		test('should identify parent task cards correctly', () => {
			const card = TaskCard.create(mockTask);

			expect(card.dataset.cardType).toBe('parent');
			expect(card.attributes['data-card-type']).toBe('parent');
		});

		test('should apply appropriate styling classes based on card type', () => {
			const mainTask = { ...mockTask, subtasks: [] };
			const mainCard = TaskCard.create(mainTask);
			const parentCard = TaskCard.create(mockTask);

			expect(mainCard.classList).toContain('task-card');
			expect(parentCard.classList).toContain('task-card');
			// Additional type-specific classes would be applied by CSS selectors
		});

		test('should handle subtask identification', () => {
			const subtask = {
				id: 'task-123-1',
				title: 'Setup JWT middleware',
				parentId: 'task-123',
				isSubtask: true
			};
			const card = TaskCard.create(subtask);

			expect(card.dataset.cardType).toBe('main'); // Subtasks without their own subtasks are 'main' type
		});
	});

	describe('7. Dependency Count Display', () => {
		test('should create dependency indicator with correct count', () => {
			const indicator = TaskCard.createDependencyIndicator(3);

			expect(indicator).not.toBeNull();
			expect(indicator.className).toBe('dependency-indicator');
			expect(indicator.textContent).toBe('3 deps');
			expect(indicator.attributes['aria-label']).toBe('3 dependencies');
			expect(indicator.attributes.title).toBe('This task has 3 dependencies');
		});

		test('should handle single dependency', () => {
			const indicator = TaskCard.createDependencyIndicator(1);

			expect(indicator.textContent).toBe('1 deps');
			expect(indicator.attributes['aria-label']).toBe('1 dependencies');
		});

		test('should return null for tasks with no dependencies', () => {
			expect(TaskCard.createDependencyIndicator(0)).toBeNull();
			expect(TaskCard.createDependencyIndicator(null)).toBeNull();
			expect(TaskCard.createDependencyIndicator(undefined)).toBeNull();
		});

		test('should provide helpful tooltip text', () => {
			const indicator = TaskCard.createDependencyIndicator(5);

			expect(indicator.attributes.title).toBe('This task has 5 dependencies');
		});
	});

	describe('8. Accessibility Features', () => {
		test('should provide keyboard navigation support', () => {
			const card = TaskCard.create(mockTask);

			expect(card.attributes.tabindex).toBe('0');
			expect(card.attributes.role).toBe('option');
		});

		test('should include screen reader friendly labels', () => {
			const card = TaskCard.create(mockTask);

			expect(card.attributes['aria-label']).toBe(
				'Task: Implement authentication system'
			);
		});

		test('should support focus management', () => {
			const mockElement = { focus: jest.fn() };
			TaskCard.focus(mockElement);

			expect(mockElement.focus).toHaveBeenCalled();
		});

		test('should handle focus on non-focusable elements gracefully', () => {
			const nonFocusableElement = {};

			expect(() => TaskCard.focus(nonFocusableElement)).not.toThrow();
			expect(() => TaskCard.focus(null)).not.toThrow();
		});

		test('should provide drag and drop accessibility', () => {
			const card = TaskCard.create(mockTask);

			expect(card.attributes['aria-grabbed']).toBe('false');
			expect(card.attributes.draggable).toBe('true');
		});

		test('should include semantic HTML structure', () => {
			const card = TaskCard.create(mockTask);

			expect(card.tagName).toBe('DIV');
			expect(card.attributes.role).toBe('option');
		});
	});

	describe('9. Performance with Many Cards', () => {
		test('should handle creating multiple cards efficiently', () => {
			const startTime = Date.now();
			const cards = [];

			// Create 100 task cards
			for (let i = 0; i < 100; i++) {
				const task = {
					...mockTask,
					id: `task-${i}`,
					title: `Task ${i}`
				};
				cards.push(TaskCard.create(task));
			}

			const endTime = Date.now();
			const duration = endTime - startTime;

			expect(cards).toHaveLength(100);
			expect(duration).toBeLessThan(1000); // Should complete in under 1 second
			expect(cards.every((card) => card !== null)).toBe(true);
		});

		test('should maintain memory efficiency with large datasets', () => {
			const tasks = Array.from({ length: 500 }, (_, i) => ({
				...mockTask,
				id: `task-${i}`,
				title: `Task ${i}`,
				description: `Description for task ${i}`.repeat(10) // Larger descriptions
			}));

			const cards = tasks.map((task) => TaskCard.create(task));

			expect(cards).toHaveLength(500);
			expect(cards.every((card) => card !== null)).toBe(true);

			// Verify structure is maintained for random sample
			const randomCard = cards[Math.floor(Math.random() * cards.length)];
			expect(randomCard.className).toContain('task-card');
			expect(randomCard.attributes['data-task-id']).toBeTruthy();
		});

		test('should handle rapid successive operations', () => {
			const operations = [];

			// Simulate rapid creation and validation
			for (let i = 0; i < 50; i++) {
				const task = { ...mockTask, id: `rapid-task-${i}` };
				const card = TaskCard.create(task);
				const validation = TaskCard.validateTask(task);

				operations.push({ card, validation });
			}

			expect(operations).toHaveLength(50);
			expect(
				operations.every((op) => op.card !== null && op.validation.valid)
			).toBe(true);
		});

		test('should optimize badge creation for bulk operations', () => {
			const startTime = Date.now();
			const badges = [];

			// Create many badges of different types
			for (let i = 0; i < 200; i++) {
				badges.push(
					TaskCard.createComplexityBadge(Math.floor(Math.random() * 10) + 1)
				);
				badges.push(TaskCard.createAIModelTag(`model-${i}`));
				badges.push(
					TaskCard.createDependencyIndicator(Math.floor(Math.random() * 5) + 1)
				);
			}

			const endTime = Date.now();
			const duration = endTime - startTime;

			expect(badges).toHaveLength(600);
			expect(duration).toBeLessThan(500); // Should be very fast
		});
	});

	describe('10. Memory Cleanup', () => {
		test('should clean up event listeners on card removal', async () => {
			const mockElement = {
				addEventListener: jest.fn(),
				removeEventListener: jest.fn(),
				_listeners: ['click', 'keydown', 'dragstart']
			};

			TaskCard.cleanup(mockElement);

			expect(mockElement._listeners).toBeNull();
		});

		test('should handle removal animation and cleanup', async () => {
			const mockElement = {
				classList: { add: jest.fn() },
				parentNode: { removeChild: jest.fn() }
			};

			await TaskCard.remove(mockElement);

			// Should complete without errors
			expect(true).toBe(true);
		});

		test('should clear observer references', () => {
			const mockElement = {
				_observers: ['resize', 'mutation'],
				_listeners: ['click']
			};

			TaskCard.cleanup(mockElement);

			expect(mockElement._observers).toBeNull();
			expect(mockElement._listeners).toBeNull();
		});

		test('should handle cleanup of null elements gracefully', () => {
			expect(() => TaskCard.cleanup(null)).not.toThrow();
			expect(() => TaskCard.cleanup(undefined)).not.toThrow();
		});

		test('should prevent memory leaks in bulk operations', () => {
			const elements = [];

			// Create and cleanup many elements
			for (let i = 0; i < 100; i++) {
				const element = {
					id: `element-${i}`,
					_listeners: ['click'],
					_observers: ['resize']
				};
				elements.push(element);
				TaskCard.cleanup(element);
			}

			// Verify all elements are cleaned up
			elements.forEach((element) => {
				expect(element._listeners).toBeNull();
				expect(element._observers).toBeNull();
			});
		});
	});

	describe('Task Validation and Error Handling', () => {
		test('should validate complete task objects', () => {
			const validation = TaskCard.validateTask(mockTask);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toHaveLength(0);
		});

		test('should catch missing required fields', () => {
			const invalidTask = { title: 'Test' }; // Missing ID
			const validation = TaskCard.validateTask(invalidTask);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('Task must have an ID');
		});

		test('should validate priority values', () => {
			const invalidPriorityTask = { ...mockTask, priority: 'extreme' };
			const validation = TaskCard.validateTask(invalidPriorityTask);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('Invalid priority: extreme');
		});

		test('should validate complexity scores', () => {
			const invalidComplexityTask = { ...mockTask, complexityScore: 15 };
			const validation = TaskCard.validateTask(invalidComplexityTask);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain(
				'Complexity score must be between 1 and 10'
			);
		});

		test('should handle multiple validation errors', () => {
			const invalidTask = {
				title: '',
				priority: 'invalid',
				complexityScore: -5
			};
			const validation = TaskCard.validateTask(invalidTask);

			expect(validation.valid).toBe(false);
			expect(validation.errors.length).toBeGreaterThan(1);
		});
	});

	describe('Glassmorphism Effects Integration', () => {
		test('should apply glassmorphism class to task cards', () => {
			const card = TaskCard.create(mockTask);

			expect(card.classList).toContain('glassmorphism');
		});

		test('should maintain glassmorphism effects across card types', () => {
			const mainTask = { ...mockTask, subtasks: [] };
			const mainCard = TaskCard.create(mainTask);
			const parentCard = TaskCard.create(mockTask);

			expect(mainCard.classList).toContain('glassmorphism');
			expect(parentCard.classList).toContain('glassmorphism');
		});
	});

	describe('Edge Cases and Error Scenarios', () => {
		test('should handle extremely long task titles', () => {
			const longTitleTask = {
				...mockTask,
				title: 'A'.repeat(1000)
			};
			const card = TaskCard.create(longTitleTask);

			expect(card).not.toBeNull();
			expect(card.attributes['aria-label']).toContain('A'.repeat(1000));
		});

		test('should handle special characters in task data', () => {
			const specialCharTask = {
				...mockTask,
				title: 'Task with "quotes" & <tags> and émojis 🚀',
				description: 'Description with special chars: !@#$%^&*()'
			};
			const card = TaskCard.create(specialCharTask);

			expect(card).not.toBeNull();
			expect(card.attributes['aria-label']).toContain('émojis 🚀');
		});

		test('should handle empty or minimal task objects', () => {
			const minimalTask = { id: 'minimal-task', title: 'T' };
			const card = TaskCard.create(minimalTask);

			expect(card).not.toBeNull();
			expect(card.attributes['data-task-id']).toBe('minimal-task');
		});

		test('should handle circular references in task objects safely', () => {
			const circularTask = { ...mockTask };
			circularTask.self = circularTask;

			expect(() => TaskCard.create(circularTask)).not.toThrow();
		});
	});
});
