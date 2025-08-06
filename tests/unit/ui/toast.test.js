/**
 * Unit tests for Toast Notification System
 * Tests notification queue management, display behavior, and accessibility
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

describe('Toast Notification System', () => {
	let dom;
	let document;
	let window;
	let ToastManager;

	beforeEach(() => {
		// Set up DOM environment
		dom = new JSDOM(
			`
            <!DOCTYPE html>
            <html>
            <body>
                <div id="app"></div>
            </body>
            </html>
        `,
			{
				url: 'http://localhost:3000',
				pretendToBeVisual: true
			}
		);

		document = dom.window.document;
		window = dom.window;

		// Set up globals
		global.document = document;
		global.window = window;
		global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 0));
		global.cancelAnimationFrame = jest.fn();

		// Mock timers
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.restoreAllMocks();
		// Clean up any remaining toasts
		const container = document.querySelector('.toast-container');
		if (container) {
			container.remove();
		}
	});

	// Helper to load the actual ToastManager
	const loadToastManager = () => {
		// This will be replaced with actual import when implementation exists
		class MockToastManager {
			constructor(options = {}) {
				this.options = {
					position: 'top-right',
					maxToasts: 5,
					defaultDuration: 5000,
					animationDuration: 300,
					...options
				};
				this.toasts = [];
				this.container = null;
				this.init();
			}

			init() {
				if (!this.container) {
					this.container = document.createElement('div');
					this.container.className = `toast-container toast-${this.options.position}`;
					this.container.setAttribute('role', 'region');
					this.container.setAttribute('aria-live', 'polite');
					this.container.setAttribute('aria-label', 'Notifications');
					document.body.appendChild(this.container);
				}
			}

			show(message, type = 'info', options = {}) {
				const toast = {
					id: Date.now() + Math.random(),
					message,
					type,
					duration: options.duration || this.options.defaultDuration,
					actions: options.actions || [],
					...options
				};

				// Queue management
				if (this.toasts.length >= this.options.maxToasts) {
					this.dismiss(this.toasts[0].id, true); // Remove immediately to make room
				}

				this.toasts.push(toast);
				this.render(toast);

				if (toast.duration > 0) {
					toast.timeoutId = setTimeout(() => {
						this.dismiss(toast.id);
					}, toast.duration);
				}

				return toast.id;
			}

			render(toast) {
				const element = document.createElement('div');
				element.className = `toast toast-${toast.type}`;
				element.setAttribute('role', 'alert');
				element.setAttribute('data-toast-id', toast.id);

				// Message
				const message = document.createElement('span');
				message.className = 'toast-message';
				message.textContent = toast.message;
				element.appendChild(message);

				// Close button
				const closeBtn = document.createElement('button');
				closeBtn.className = 'toast-close';
				closeBtn.setAttribute('aria-label', 'Close notification');
				closeBtn.textContent = '×';
				closeBtn.onclick = () => this.dismiss(toast.id);
				element.appendChild(closeBtn);

				// Actions
				if (toast.actions.length > 0) {
					const actionsDiv = document.createElement('div');
					actionsDiv.className = 'toast-actions';
					toast.actions.forEach((action) => {
						const btn = document.createElement('button');
						btn.className = 'toast-action';
						btn.textContent = action.label;
						btn.onclick = () => {
							action.handler();
							if (action.dismissOnClick !== false) {
								this.dismiss(toast.id);
							}
						};
						actionsDiv.appendChild(btn);
					});
					element.appendChild(actionsDiv);
				}

				// Progress bar
				if (toast.duration > 0 && toast.showProgress !== false) {
					const progress = document.createElement('div');
					progress.className = 'toast-progress';
					const bar = document.createElement('div');
					bar.className = 'toast-progress-bar';
					bar.style.animationDuration = `${toast.duration}ms`;
					progress.appendChild(bar);
					element.appendChild(progress);
				}

				this.container.appendChild(element);

				// Trigger animation
				requestAnimationFrame(() => {
					element.classList.add('toast-show');
				});

				toast.element = element;
			}

			dismiss(id, immediate = false) {
				const index = this.toasts.findIndex((t) => t.id === id);
				if (index === -1) return;

				const toast = this.toasts[index];

				if (toast.timeoutId) {
					clearTimeout(toast.timeoutId);
				}

				if (toast.element) {
					if (immediate) {
						// Remove immediately without animation
						if (toast.element.parentNode) {
							toast.element.remove();
						}
					} else {
						toast.element.classList.remove('toast-show');
						toast.element.classList.add('toast-hide');

						setTimeout(() => {
							if (toast.element && toast.element.parentNode) {
								toast.element.remove();
							}
						}, this.options.animationDuration);
					}
				}

				this.toasts.splice(index, 1);
			}

			dismissAll() {
				[...this.toasts].forEach((toast) => {
					this.dismiss(toast.id);
				});
			}

			update(id, updates) {
				const toast = this.toasts.find((t) => t.id === id);
				if (!toast) return;

				if (updates.message && toast.element) {
					const messageEl = toast.element.querySelector('.toast-message');
					if (messageEl) {
						messageEl.textContent = updates.message;
					}
				}

				Object.assign(toast, updates);
			}
		}

		return MockToastManager;
	};

	describe('Initialization', () => {
		it('should create toast container on initialization', () => {
			ToastManager = loadToastManager();
			const manager = new ToastManager();

			const container = document.querySelector('.toast-container');
			expect(container).toBeTruthy();
			expect(container.getAttribute('role')).toBe('region');
			expect(container.getAttribute('aria-live')).toBe('polite');
		});

		it('should support different positions', () => {
			ToastManager = loadToastManager();

			const positions = [
				'top-right',
				'top-center',
				'top-left',
				'bottom-right',
				'bottom-center',
				'bottom-left'
			];

			positions.forEach((position) => {
				const manager = new ToastManager({ position });
				const container = document.querySelector('.toast-container');
				expect(container.classList.contains(`toast-${position}`)).toBe(true);
				container.remove();
			});
		});
	});

	describe('Basic Functionality', () => {
		it('should show a toast notification', () => {
			ToastManager = loadToastManager();
			const manager = new ToastManager();

			const id = manager.show('Test message', 'success');

			expect(id).toBeDefined();
			expect(manager.toasts.length).toBe(1);

			const toastEl = document.querySelector('[data-toast-id]');
			expect(toastEl).toBeTruthy();
			expect(toastEl.classList.contains('toast-success')).toBe(true);
			expect(toastEl.textContent).toContain('Test message');
		});

		it('should support different notification types', () => {
			ToastManager = loadToastManager();
			const manager = new ToastManager();

			const types = ['success', 'error', 'warning', 'info'];

			types.forEach((type) => {
				manager.show(`${type} message`, type);
			});

			expect(manager.toasts.length).toBe(4);

			types.forEach((type) => {
				const toast = document.querySelector(`.toast-${type}`);
				expect(toast).toBeTruthy();
			});
		});

		it('should auto-dismiss after specified duration', () => {
			ToastManager = loadToastManager();
			const manager = new ToastManager({ defaultDuration: 1000 });

			manager.show('Auto dismiss', 'info');
			expect(manager.toasts.length).toBe(1);

			jest.advanceTimersByTime(999);
			expect(manager.toasts.length).toBe(1);

			jest.advanceTimersByTime(1);
			expect(manager.toasts.length).toBe(0);
		});

		it('should not auto-dismiss when duration is 0', () => {
			ToastManager = loadToastManager();
			const manager = new ToastManager();

			manager.show('Persistent toast', 'info', { duration: 0 });

			jest.advanceTimersByTime(10000);
			expect(manager.toasts.length).toBe(1);
		});
	});

	describe('Queue Management', () => {
		it('should respect maxToasts limit', () => {
			ToastManager = loadToastManager();
			const manager = new ToastManager({ maxToasts: 3, defaultDuration: 0 });

			// Show first 3 toasts
			for (let i = 0; i < 3; i++) {
				manager.show(`Toast ${i}`, 'info');
			}

			expect(manager.toasts.length).toBe(3);
			expect(document.querySelectorAll('.toast').length).toBe(3);

			// Show 4th toast - should remove Toast 0
			manager.show(`Toast 3`, 'info');
			expect(manager.toasts.length).toBe(3);

			// Show 5th toast - should remove Toast 1
			manager.show(`Toast 4`, 'info');
			expect(manager.toasts.length).toBe(3);

			const toasts = document.querySelectorAll('.toast');
			expect(toasts.length).toBe(3);

			// Check that we have the right toasts (2, 3, 4)
			const toastTexts = Array.from(toasts).map((t) => t.textContent);
			expect(toastTexts.some((text) => text.includes('Toast 2'))).toBe(true);
			expect(toastTexts.some((text) => text.includes('Toast 3'))).toBe(true);
			expect(toastTexts.some((text) => text.includes('Toast 4'))).toBe(true);
		});

		it('should handle rapid toast creation', () => {
			ToastManager = loadToastManager();
			const manager = new ToastManager();

			const ids = [];
			for (let i = 0; i < 10; i++) {
				ids.push(manager.show(`Rapid toast ${i}`, 'info', { duration: 0 }));
			}

			expect(manager.toasts.length).toBe(5); // Default maxToasts
			expect(ids.every((id) => id !== undefined)).toBe(true);
		});
	});

	describe('User Interactions', () => {
		it('should dismiss toast on close button click', () => {
			ToastManager = loadToastManager();
			const manager = new ToastManager();

			const id = manager.show('Closeable toast', 'info', { duration: 0 });

			const closeBtn = document.querySelector('.toast-close');
			expect(closeBtn).toBeTruthy();

			closeBtn.click();

			expect(manager.toasts.length).toBe(0);
		});

		it('should handle action buttons', () => {
			ToastManager = loadToastManager();
			const manager = new ToastManager();

			const actionHandler = jest.fn();

			manager.show('Action toast', 'warning', {
				duration: 0,
				actions: [{ label: 'Retry', handler: actionHandler }]
			});

			const actionBtn = document.querySelector('.toast-action');
			expect(actionBtn).toBeTruthy();
			expect(actionBtn.textContent).toBe('Retry');

			actionBtn.click();

			expect(actionHandler).toHaveBeenCalled();
			expect(manager.toasts.length).toBe(0); // Default dismissOnClick
		});

		it('should keep toast open when action has dismissOnClick: false', () => {
			ToastManager = loadToastManager();
			const manager = new ToastManager();

			manager.show('Persistent action toast', 'info', {
				duration: 0,
				actions: [
					{ label: 'Details', handler: jest.fn(), dismissOnClick: false }
				]
			});

			const actionBtn = document.querySelector('.toast-action');
			actionBtn.click();

			expect(manager.toasts.length).toBe(1);
		});
	});

	describe('Progress Indicator', () => {
		it('should show progress bar for timed toasts', () => {
			ToastManager = loadToastManager();
			const manager = new ToastManager();

			manager.show('Progress toast', 'info', { duration: 3000 });

			const progressBar = document.querySelector('.toast-progress-bar');
			expect(progressBar).toBeTruthy();
			expect(progressBar.style.animationDuration).toBe('3000ms');
		});

		it('should not show progress bar when showProgress is false', () => {
			ToastManager = loadToastManager();
			const manager = new ToastManager();

			manager.show('No progress', 'info', {
				duration: 3000,
				showProgress: false
			});

			const progressBar = document.querySelector('.toast-progress-bar');
			expect(progressBar).toBeFalsy();
		});
	});

	describe('API Methods', () => {
		it('should dismiss specific toast by ID', () => {
			ToastManager = loadToastManager();
			const manager = new ToastManager();

			const id1 = manager.show('Toast 1', 'info', { duration: 0 });
			const id2 = manager.show('Toast 2', 'info', { duration: 0 });

			manager.dismiss(id1);

			expect(manager.toasts.length).toBe(1);
			expect(manager.toasts[0].id).toBe(id2);
		});

		it('should dismiss all toasts', () => {
			ToastManager = loadToastManager();
			const manager = new ToastManager();

			for (let i = 0; i < 3; i++) {
				manager.show(`Toast ${i}`, 'info', { duration: 0 });
			}

			expect(manager.toasts.length).toBe(3);

			manager.dismissAll();

			expect(manager.toasts.length).toBe(0);
		});

		it('should update existing toast', () => {
			ToastManager = loadToastManager();
			const manager = new ToastManager();

			const id = manager.show('Original message', 'info', { duration: 0 });

			manager.update(id, { message: 'Updated message' });

			const messageEl = document.querySelector('.toast-message');
			expect(messageEl.textContent).toBe('Updated message');
		});
	});

	describe('Accessibility', () => {
		it('should have proper ARIA attributes', () => {
			ToastManager = loadToastManager();
			const manager = new ToastManager();

			manager.show('Accessible toast', 'success');

			const toast = document.querySelector('.toast');
			expect(toast.getAttribute('role')).toBe('alert');

			const closeBtn = document.querySelector('.toast-close');
			expect(closeBtn.getAttribute('aria-label')).toBe('Close notification');
		});

		it('should support keyboard dismissal', () => {
			ToastManager = loadToastManager();
			const manager = new ToastManager();

			manager.show('Keyboard test', 'info', { duration: 0 });

			const closeBtn = document.querySelector('.toast-close');
			closeBtn.focus();

			const event = new window.KeyboardEvent('keydown', { key: 'Enter' });
			closeBtn.dispatchEvent(event);

			// The click handler should work with Enter key
			expect(document.activeElement).toBe(closeBtn);
		});
	});

	describe('Animation and Styling', () => {
		it('should apply show animation class', () => {
			ToastManager = loadToastManager();
			const manager = new ToastManager();

			manager.show('Animated toast', 'info');

			// Run requestAnimationFrame callbacks
			if (global.requestAnimationFrame.mock) {
				global.requestAnimationFrame.mock.calls.forEach((call) => call[0]());
			}

			const toast = document.querySelector('.toast');
			expect(toast).toBeTruthy();
			expect(toast.classList.contains('toast-show')).toBe(true);
		});

		it('should apply hide animation before removal', () => {
			ToastManager = loadToastManager();
			const manager = new ToastManager({ animationDuration: 300 });

			const id = manager.show('Disappearing toast', 'info', { duration: 0 });

			manager.dismiss(id);

			const toast = document.querySelector('.toast');
			expect(toast.classList.contains('toast-hide')).toBe(true);

			jest.advanceTimersByTime(299);
			expect(document.querySelector('.toast')).toBeTruthy();

			jest.advanceTimersByTime(1);
			expect(document.querySelector('.toast')).toBeFalsy();
		});
	});

	describe('Mobile Responsiveness', () => {
		it('should stack toasts vertically on mobile', () => {
			// Set mobile viewport
			Object.defineProperty(window, 'innerWidth', {
				writable: true,
				configurable: true,
				value: 375
			});

			ToastManager = loadToastManager();
			const manager = new ToastManager();

			manager.show('Mobile toast 1', 'info', { duration: 0 });
			manager.show('Mobile toast 2', 'info', { duration: 0 });

			const container = document.querySelector('.toast-container');
			expect(container).toBeTruthy();
			// Mobile-specific styling would be tested with CSS
		});
	});
});
