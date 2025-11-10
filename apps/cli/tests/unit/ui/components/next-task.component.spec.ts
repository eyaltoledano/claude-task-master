/**
 * @fileoverview Tests for next-task component UI consistency
 * Ensures all boxen components maintain consistent alignment
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

// Mock dependencies before imports
vi.mock('chalk', () => {
	const createChalkMock = () => {
		const fn = vi.fn((text: string) => text);
		fn.bold = vi.fn((text: string) => text);
		return fn;
	};

	return {
		default: {
			yellow: createChalkMock(),
			hex: vi.fn(() => createChalkMock()),
			cyan: createChalkMock(),
			gray: createChalkMock(),
			red: createChalkMock(),
			white: createChalkMock(),
			blue: createChalkMock(),
			bold: {
				yellow: vi.fn((text: string) => text)
			}
		}
	};
});

vi.mock('boxen', () => ({
	default: vi.fn((content: string, options: unknown) => {
		return `[BOXED: ${content}]`;
	})
}));

vi.mock('../../../../src/utils/ui.js', () => ({
	getComplexityWithColor: vi.fn((complexity: number) => `${complexity}`),
	getBoxWidth: vi.fn((percentage: number = 0.9) => {
		// Simulate terminal width calculation
		const terminalWidth = 100;
		return Math.floor(terminalWidth * percentage);
	})
}));

describe('next-task.component', () => {
	let consoleLogSpy: Mock;
	let boxen: Mock;
	let getBoxWidth: Mock;

	beforeEach(async () => {
		// Reset all mocks
		vi.clearAllMocks();

		// Spy on console.log
		consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		// Get mocked functions
		const boxenModule = await import('boxen');
		boxen = boxenModule.default as Mock;

		const uiModule = await import('../../../../src/utils/ui.js');
		getBoxWidth = uiModule.getBoxWidth as Mock;
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
	});

	describe('displayRecommendedNextTask', () => {
		it('should render no tasks available box with consistent width configuration', async () => {
			const { displayRecommendedNextTask } = await import(
				'../../../../src/ui/components/next-task.component.js'
			);

			// Act - call with undefined to trigger "no tasks available" path
			displayRecommendedNextTask(undefined);

			// Assert - verify boxen was called
			expect(boxen).toHaveBeenCalledTimes(1);

			// Get the options passed to boxen
			const boxenOptions = boxen.mock.calls[0][1];

			// Verify width property is present and uses getBoxWidth
			expect(boxenOptions).toHaveProperty('width');
			expect(getBoxWidth).toHaveBeenCalledWith(0.97);
			expect(boxenOptions.width).toBe(97); // 100 * 0.97

			// Verify fullscreen is set to false for consistent rendering
			expect(boxenOptions).toHaveProperty('fullscreen');
			expect(boxenOptions.fullscreen).toBe(false);

			// Verify other styling consistency
			expect(boxenOptions.padding).toBe(1);
			expect(boxenOptions.borderStyle).toBe('round');
			expect(boxenOptions.borderColor).toBe('yellow');
			expect(boxenOptions.titleAlignment).toBe('center');
		});

		it('should render recommended task box with consistent width configuration', async () => {
			const { displayRecommendedNextTask } = await import(
				'../../../../src/ui/components/next-task.component.js'
			);

			// Arrange - create a task
			const task = {
				id: '1.2',
				title: 'Implement feature',
				priority: 'high',
				status: 'pending',
				dependencies: ['1.1'],
				description: 'A test task',
				complexity: 5
			};

			// Act
			displayRecommendedNextTask(task);

			// Assert - verify boxen was called
			expect(boxen).toHaveBeenCalledTimes(1);

			// Get the options passed to boxen
			const boxenOptions = boxen.mock.calls[0][1];

			// Verify width property is present and uses getBoxWidth
			expect(boxenOptions).toHaveProperty('width');
			expect(getBoxWidth).toHaveBeenCalledWith(0.97);
			expect(boxenOptions.width).toBe(97); // 100 * 0.97

			// Verify fullscreen is set to false
			expect(boxenOptions).toHaveProperty('fullscreen');
			expect(boxenOptions.fullscreen).toBe(false);

			// Verify other styling
			expect(boxenOptions.padding).toBe(1);
			expect(boxenOptions.borderStyle).toBe('round');
		});

		it('should use the same width percentage for both box types', async () => {
			const { displayRecommendedNextTask } = await import(
				'../../../../src/ui/components/next-task.component.js'
			);

			// Test no tasks available box
			displayRecommendedNextTask(undefined);
			const noTasksCall = getBoxWidth.mock.calls[0];

			// Reset mocks
			vi.clearAllMocks();

			// Test recommended task box
			const task = {
				id: '1',
				title: 'Test',
				status: 'pending'
			};
			displayRecommendedNextTask(task);
			const taskBoxCall = getBoxWidth.mock.calls[0];

			// Both should use same percentage
			expect(noTasksCall[0]).toBe(taskBoxCall[0]);
			expect(noTasksCall[0]).toBe(0.97);
		});
	});
});
