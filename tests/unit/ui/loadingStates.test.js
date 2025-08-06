/**
 * Unit tests for Loading States System
 * Tests loading indicators, skeleton screens, and progress feedback
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

describe('Loading States System', () => {
	let dom;
	let document;
	let window;
	let LoadingManager;

	beforeEach(() => {
		// Set up DOM environment
		dom = new JSDOM(
			`
            <!DOCTYPE html>
            <html>
            <body>
                <div id="app">
                    <div class="kanban-board">
                        <div class="column" data-status="backlog">
                            <div class="column-content"></div>
                        </div>
                        <div class="column" data-status="ready">
                            <div class="column-content"></div>
                        </div>
                    </div>
                    <button class="btn-primary" id="save-btn">Save</button>
                    <div class="task-list"></div>
                </div>
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
	});

	// Helper to load the LoadingManager
	const loadLoadingManager = async () => {
		// Import the actual implementation when it exists
		const module = await import(
			'../../../src/ui/client/js/components/loadingManager.js'
		);
		return module.default;
	};

	describe('Initialization', () => {
		it('should initialize with default options', async () => {
			LoadingManager = await loadLoadingManager();
			const manager = new LoadingManager();

			expect(manager).toBeDefined();
			expect(manager.activeLoaders).toBeDefined();
			expect(manager.options.showOverlay).toBe(true);
		});

		it('should accept custom options', async () => {
			LoadingManager = await loadLoadingManager();
			const manager = new LoadingManager({
				showOverlay: false,
				minDuration: 500,
				skeletonClass: 'custom-skeleton'
			});

			expect(manager.options.showOverlay).toBe(false);
			expect(manager.options.minDuration).toBe(500);
			expect(manager.options.skeletonClass).toBe('custom-skeleton');
		});
	});

	describe('Basic Loading States', () => {
		it('should show loading state on element', async () => {
			LoadingManager = await loadLoadingManager();
			const manager = new LoadingManager();

			const button = document.getElementById('save-btn');
			const loaderId = manager.startLoading(button);

			expect(loaderId).toBeDefined();
			expect(button.classList.contains('loading')).toBe(true);
			expect(button.disabled).toBe(true);
		});

		it('should hide loading state on element', async () => {
			LoadingManager = await loadLoadingManager();
			const manager = new LoadingManager();

			const button = document.getElementById('save-btn');
			const loaderId = manager.startLoading(button);

			manager.stopLoading(loaderId);

			expect(button.classList.contains('loading')).toBe(false);
			expect(button.disabled).toBe(false);
		});

		it('should add loading spinner to element', async () => {
			LoadingManager = await loadLoadingManager();
			const manager = new LoadingManager({ showSpinner: true });

			const element = document.querySelector('.task-list');
			manager.startLoading(element);

			const spinner = element.querySelector('.loading-spinner');
			expect(spinner).toBeTruthy();
		});
	});

	describe('Loading Overlay', () => {
		it('should show full-screen loading overlay', async () => {
			LoadingManager = await loadLoadingManager();
			const manager = new LoadingManager();

			const loaderId = manager.showOverlay('Loading data...');

			const overlay = document.querySelector('.loading-overlay');
			expect(overlay).toBeTruthy();
			expect(overlay.textContent).toContain('Loading data...');

			manager.hideOverlay(loaderId);
		});

		it('should stack multiple overlays', async () => {
			LoadingManager = await loadLoadingManager();
			const manager = new LoadingManager();

			const id1 = manager.showOverlay('Loading 1...');
			const id2 = manager.showOverlay('Loading 2...');

			const overlays = document.querySelectorAll('.loading-overlay');
			expect(overlays.length).toBe(2);

			manager.hideOverlay(id1);
			jest.runAllTimers();
			expect(document.querySelectorAll('.loading-overlay').length).toBe(1);

			manager.hideOverlay(id2);
			jest.runAllTimers();
			expect(document.querySelectorAll('.loading-overlay').length).toBe(0);
		});

		it('should prevent interactions when overlay is shown', async () => {
			LoadingManager = await loadLoadingManager();
			const manager = new LoadingManager();

			manager.showOverlay();

			const overlay = document.querySelector('.loading-overlay');
			expect(overlay.style.pointerEvents).toBe('all');
			expect(parseInt(overlay.style.zIndex)).toBeGreaterThan(1000);
		});
	});

	describe('Skeleton Screens', () => {
		it('should show skeleton screen while loading', async () => {
			LoadingManager = await loadLoadingManager();
			const manager = new LoadingManager();

			const container = document.querySelector('.task-list');
			manager.showSkeleton(container, 'task');

			const skeletons = container.querySelectorAll('.skeleton-item');
			expect(skeletons.length).toBeGreaterThan(0);
			expect(container.classList.contains('skeleton-loading')).toBe(true);
		});

		it('should support different skeleton types', async () => {
			LoadingManager = await loadLoadingManager();
			const manager = new LoadingManager();

			const container = document.querySelector('.column-content');

			// Task skeleton
			manager.showSkeleton(container, 'task', { count: 3 });
			let skeletons = container.querySelectorAll('.skeleton-task');
			expect(skeletons.length).toBe(3);

			manager.hideSkeleton(container);

			// Card skeleton
			manager.showSkeleton(container, 'card', { count: 2 });
			skeletons = container.querySelectorAll('.skeleton-card');
			expect(skeletons.length).toBe(2);
		});

		it('should replace skeleton with actual content', async () => {
			LoadingManager = await loadLoadingManager();
			const manager = new LoadingManager();

			const container = document.querySelector('.task-list');
			manager.showSkeleton(container, 'task');

			// Simulate content loaded
			const content = '<div class="task">Real Task</div>';
			manager.replaceSkeleton(container, content);

			expect(container.innerHTML).toBe(content);
			expect(container.classList.contains('skeleton-loading')).toBe(false);
		});
	});

	describe('Button Loading States', () => {
		it('should show loading spinner in button', async () => {
			LoadingManager = await loadLoadingManager();
			const manager = new LoadingManager();

			const button = document.getElementById('save-btn');
			const originalText = button.textContent;

			const loaderId = manager.startButtonLoading(button, 'Saving...');

			expect(button.textContent).toBe('Saving...');
			expect(button.querySelector('.button-spinner')).toBeTruthy();
			expect(button.disabled).toBe(true);

			manager.stopButtonLoading(loaderId, originalText);

			expect(button.textContent).toBe(originalText);
			expect(button.querySelector('.button-spinner')).toBeFalsy();
			expect(button.disabled).toBe(false);
		});

		it('should handle button loading with icon', async () => {
			LoadingManager = await loadLoadingManager();
			const manager = new LoadingManager();

			const button = document.getElementById('save-btn');
			button.innerHTML = '<i class="icon">💾</i> Save';

			manager.startButtonLoading(button);

			const spinner = button.querySelector('.button-spinner');
			expect(spinner).toBeTruthy();
			expect(button.querySelector('.icon')).toBeFalsy(); // Icon replaced by spinner
		});
	});

	describe('Progress Indicators', () => {
		it('should show progress bar', async () => {
			LoadingManager = await loadLoadingManager();
			const manager = new LoadingManager();

			const progressId = manager.showProgress({
				title: 'Uploading files...',
				progress: 0
			});

			const progressBar = document.querySelector('.loading-progress');
			expect(progressBar).toBeTruthy();

			// Update progress
			manager.updateProgress(progressId, 50);
			const bar = progressBar.querySelector('.progress-bar');
			expect(bar.style.width).toBe('50%');

			// Complete
			manager.updateProgress(progressId, 100);
			jest.advanceTimersByTime(1000);

			expect(document.querySelector('.loading-progress')).toBeFalsy();
		});

		it('should show indeterminate progress', async () => {
			LoadingManager = await loadLoadingManager();
			const manager = new LoadingManager();

			manager.showProgress({
				title: 'Processing...',
				indeterminate: true
			});

			const progressBar = document.querySelector('.loading-progress');
			expect(progressBar.classList.contains('indeterminate')).toBe(true);
		});
	});

	describe('Minimum Duration', () => {
		it('should respect minimum loading duration', async () => {
			LoadingManager = await loadLoadingManager();
			const manager = new LoadingManager({ minDuration: 1000 });

			const button = document.getElementById('save-btn');
			const loaderId = manager.startLoading(button);

			// Try to stop immediately
			manager.stopLoading(loaderId);

			// Should still be loading
			expect(button.classList.contains('loading')).toBe(true);

			// After min duration
			jest.advanceTimersByTime(1000);
			expect(button.classList.contains('loading')).toBe(false);
		});
	});

	describe('Loading State Management', () => {
		it('should track active loaders', async () => {
			LoadingManager = await loadLoadingManager();
			const manager = new LoadingManager();

			const id1 = manager.startLoading(document.getElementById('save-btn'));
			const id2 = manager.showOverlay();

			expect(manager.isLoading()).toBe(true);
			expect(manager.getActiveLoaders().length).toBe(2);

			manager.stopLoading(id1);
			manager.hideOverlay(id2);

			expect(manager.isLoading()).toBe(false);
			expect(manager.getActiveLoaders().length).toBe(0);
		});

		it('should stop all loaders at once', async () => {
			LoadingManager = await loadLoadingManager();
			const manager = new LoadingManager();

			manager.startLoading(document.getElementById('save-btn'));
			manager.showOverlay();
			manager.showSkeleton(document.querySelector('.task-list'));

			expect(manager.getActiveLoaders().length).toBe(3);

			manager.stopAll();

			expect(manager.getActiveLoaders().length).toBe(0);
			expect(document.querySelector('.loading')).toBeFalsy();
			expect(document.querySelector('.loading-overlay')).toBeFalsy();
			expect(document.querySelector('.skeleton-loading')).toBeFalsy();
		});
	});

	describe('Accessibility', () => {
		it('should add appropriate ARIA attributes', async () => {
			LoadingManager = await loadLoadingManager();
			const manager = new LoadingManager();

			const button = document.getElementById('save-btn');
			manager.startLoading(button);

			expect(button.getAttribute('aria-busy')).toBe('true');
			expect(button.getAttribute('aria-disabled')).toBe('true');

			const loaderId = button.getAttribute('data-loader-id');
			manager.stopLoading(loaderId);

			expect(button.getAttribute('aria-busy')).toBe('false');
			expect(button.getAttribute('aria-disabled')).toBe('false');
		});

		it('should announce loading state to screen readers', async () => {
			LoadingManager = await loadLoadingManager();
			const manager = new LoadingManager();

			manager.showOverlay('Loading tasks...');

			const announcement = document.querySelector('[role="status"]');
			expect(announcement).toBeTruthy();
			expect(announcement.textContent).toBe('Loading tasks...');
			expect(announcement.getAttribute('aria-live')).toBe('polite');
		});
	});

	describe('Error States', () => {
		it('should handle loading errors gracefully', async () => {
			LoadingManager = await loadLoadingManager();
			const manager = new LoadingManager();

			const button = document.getElementById('save-btn');
			const loaderId = manager.startLoading(button);

			// Simulate error
			manager.showError(loaderId, 'Failed to save');

			expect(button.classList.contains('loading')).toBe(false);
			expect(button.classList.contains('error')).toBe(true);

			// Clear error after delay
			jest.advanceTimersByTime(3000);
			expect(button.classList.contains('error')).toBe(false);
		});
	});
});
