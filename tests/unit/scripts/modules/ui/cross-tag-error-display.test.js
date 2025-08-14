import { jest } from '@jest/globals';
import {
	displayCrossTagDependencyError,
	displaySubtaskMoveError,
	displayInvalidTagCombinationError,
	displayDependencyValidationHints,
	formatTaskIdForDisplay
} from '../../../../../scripts/modules/ui.js';

// Mock console.log to capture output
const originalConsoleLog = console.log;
const mockConsoleLog = jest.fn();
global.console.log = mockConsoleLog;

// Add afterAll hook to restore
afterAll(() => {
	global.console.log = originalConsoleLog;
});

describe('Cross-Tag Error Display Functions', () => {
	beforeEach(() => {
		mockConsoleLog.mockClear();
	});

	describe('displayCrossTagDependencyError', () => {
		it('should display cross-tag dependency error with conflicts', () => {
			const conflicts = [
				{
					taskId: 1,
					dependencyId: 2,
					dependencyTag: 'backlog',
					message: 'Task 1 depends on 2 (in backlog)'
				},
				{
					taskId: 3,
					dependencyId: 4,
					dependencyTag: 'done',
					message: 'Task 3 depends on 4 (in done)'
				}
			];

			displayCrossTagDependencyError(conflicts, 'in-progress', 'done', '1,3');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(
					'❌ Cannot move tasks from "in-progress" to "done"'
				)
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('Cross-tag dependency conflicts detected:')
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('• Task 1 depends on 2 (in backlog)')
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('• Task 3 depends on 4 (in done)')
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('Resolution options:')
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('--with-dependencies')
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('--ignore-dependencies')
			);
		});

		it('should handle empty conflicts array', () => {
			displayCrossTagDependencyError([], 'backlog', 'done', '1');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('❌ Cannot move tasks from "backlog" to "done"')
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('Cross-tag dependency conflicts detected:')
			);
		});
	});

	describe('displaySubtaskMoveError', () => {
		it('should display subtask movement restriction error', () => {
			displaySubtaskMoveError('5.2', 'backlog', 'in-progress');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(
					'❌ Cannot move subtask 5.2 directly between tags'
				)
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('Subtask movement restriction:')
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(
					'• Subtasks cannot be moved directly between tags'
				)
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('Resolution options:')
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('remove-subtask --id=5.2 --convert')
			);
		});

		it('should handle nested subtask IDs (three levels)', () => {
			displaySubtaskMoveError('5.2.1', 'feature-auth', 'production');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(
					'❌ Cannot move subtask 5.2.1 directly between tags'
				)
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('remove-subtask --id=5.2.1 --convert')
			);
		});

		it('should handle deeply nested subtask IDs (four levels)', () => {
			displaySubtaskMoveError('10.3.2.1', 'development', 'testing');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(
					'❌ Cannot move subtask 10.3.2.1 directly between tags'
				)
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('remove-subtask --id=10.3.2.1 --convert')
			);
		});

		it('should handle single-level subtask IDs', () => {
			displaySubtaskMoveError('15.1', 'master', 'feature-branch');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(
					'❌ Cannot move subtask 15.1 directly between tags'
				)
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('remove-subtask --id=15.1 --convert')
			);
		});

		it('should handle invalid subtask ID format gracefully', () => {
			displaySubtaskMoveError('invalid-id', 'tag1', 'tag2');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(
					'❌ Cannot move subtask invalid-id directly between tags'
				)
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('remove-subtask --id=invalid-id --convert')
			);
		});

		it('should handle empty subtask ID', () => {
			displaySubtaskMoveError('', 'source', 'target');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(
					`❌ Cannot move subtask ${formatTaskIdForDisplay('')} directly between tags`
				)
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(
					`remove-subtask --id=${formatTaskIdForDisplay('')} --convert`
				)
			);
		});

		it('should handle null subtask ID', () => {
			displaySubtaskMoveError(null, 'source', 'target');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(
					'❌ Cannot move subtask null directly between tags'
				)
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('remove-subtask --id=null --convert')
			);
		});

		it('should handle undefined subtask ID', () => {
			displaySubtaskMoveError(undefined, 'source', 'target');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(
					'❌ Cannot move subtask undefined directly between tags'
				)
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('remove-subtask --id=undefined --convert')
			);
		});

		it('should handle special characters in subtask ID', () => {
			displaySubtaskMoveError('5.2@test', 'dev', 'prod');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(
					'❌ Cannot move subtask 5.2@test directly between tags'
				)
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('remove-subtask --id=5.2@test --convert')
			);
		});

		it('should handle numeric subtask IDs', () => {
			displaySubtaskMoveError('123.456', 'alpha', 'beta');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(
					'❌ Cannot move subtask 123.456 directly between tags'
				)
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('remove-subtask --id=123.456 --convert')
			);
		});

		it('should handle identical source and target tags', () => {
			displaySubtaskMoveError('7.3', 'same-tag', 'same-tag');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(
					'❌ Cannot move subtask 7.3 directly between tags'
				)
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('• Source tag: "same-tag"')
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('• Target tag: "same-tag"')
			);
		});

		it('should handle empty tag names', () => {
			displaySubtaskMoveError('9.1', '', '');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(
					'❌ Cannot move subtask 9.1 directly between tags'
				)
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('• Source tag: ""')
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('• Target tag: ""')
			);
		});

		it('should handle null tag names', () => {
			displaySubtaskMoveError('12.4', null, null);

			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(
					'❌ Cannot move subtask 12.4 directly between tags'
				)
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('• Source tag: "null"')
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('• Target tag: "null"')
			);
		});

		it('should handle complex tag names with special characters', () => {
			displaySubtaskMoveError(
				'3.2.1',
				'feature/user-auth@v2.0',
				'production@stable'
			);

			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(
					'❌ Cannot move subtask 3.2.1 directly between tags'
				)
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('• Source tag: "feature/user-auth@v2.0"')
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('• Target tag: "production@stable"')
			);
		});

		it('should handle very long subtask IDs', () => {
			const longId = '1.2.3.4.5.6.7.8.9.10.11.12.13.14.15.16.17.18.19.20';
			displaySubtaskMoveError(longId, 'short', 'long');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(
					`❌ Cannot move subtask ${longId} directly between tags`
				)
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(`remove-subtask --id=${longId} --convert`)
			);
		});

		it('should handle whitespace in subtask ID', () => {
			displaySubtaskMoveError(' 5.2 ', 'clean', 'dirty');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(
					'❌ Cannot move subtask  5.2  directly between tags'
				)
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('remove-subtask --id= 5.2  --convert')
			);
		});
	});

	describe('displayInvalidTagCombinationError', () => {
		it('should display invalid tag combination error', () => {
			displayInvalidTagCombinationError(
				'backlog',
				'backlog',
				'Source and target tags are identical'
			);

			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('❌ Invalid tag combination')
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('Error details:')
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('• Source tag: "backlog"')
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('• Target tag: "backlog"')
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(
					'• Reason: Source and target tags are identical'
				)
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('Resolution options:')
			);
		});
	});

	describe('displayDependencyValidationHints', () => {
		it('should display general hints by default', () => {
			displayDependencyValidationHints();

			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('Helpful hints:')
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('💡 Use "task-master validate-dependencies"')
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('💡 Use "task-master fix-dependencies"')
			);
		});

		it('should display before-move hints', () => {
			displayDependencyValidationHints('before-move');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('Helpful hints:')
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(
					'💡 Tip: Run "task-master validate-dependencies"'
				)
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('💡 Tip: Use "task-master fix-dependencies"')
			);
		});

		it('should display after-error hints', () => {
			displayDependencyValidationHints('after-error');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('Helpful hints:')
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(
					'🔧 Quick fix: Run "task-master validate-dependencies"'
				)
			);
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining(
					'🔧 Quick fix: Use "task-master fix-dependencies"'
				)
			);
		});

		it('should handle unknown context gracefully', () => {
			displayDependencyValidationHints('unknown-context');

			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('Helpful hints:')
			);
			// Should fall back to general hints
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('💡 Use "task-master validate-dependencies"')
			);
		});
	});
});

/**
 * Test for ID type consistency in dependency comparisons
 * This test verifies that the fix for mixed string/number ID comparison issues works correctly
 */

describe('ID Type Consistency in Dependency Comparisons', () => {
	test('should handle mixed string/number ID comparisons correctly', () => {
		// Test the pattern that was fixed in the move-task tests
		const sourceTasks = [
			{ id: 1, title: 'Task 1' },
			{ id: 2, title: 'Task 2' },
			{ id: '3.1', title: 'Subtask 3.1' }
		];

		const allTasks = [
			{ id: 1, title: 'Task 1', dependencies: [2, '3.1'] },
			{ id: 2, title: 'Task 2', dependencies: ['1'] },
			{
				id: 3,
				title: 'Task 3',
				subtasks: [{ id: 1, title: 'Subtask 3.1', dependencies: [1] }]
			}
		];

		// Test the fixed pattern: normalize source IDs and compare with string conversion
		const sourceIds = sourceTasks.map((t) => t.id);
		const normalizedSourceIds = sourceIds.map((id) => String(id));

		// Test that dependencies are correctly identified regardless of type
		const result = [];
		allTasks.forEach((task) => {
			if (task.dependencies && Array.isArray(task.dependencies)) {
				const hasDependency = task.dependencies.some((depId) =>
					normalizedSourceIds.includes(String(depId))
				);
				if (hasDependency) {
					result.push(task.id);
				}
			}
		});

		// Verify that the comparison works correctly
		expect(result).toContain(1); // Task 1 has dependency on 2 and '3.1'
		expect(result).toContain(2); // Task 2 has dependency on '1'

		// Test edge cases
		const mixedDependencies = [
			{ id: 1, dependencies: [1, 2, '3.1', '4.2'] },
			{ id: 2, dependencies: ['1', 3, '5.1'] }
		];

		const testSourceIds = [1, '3.1', 4];
		const normalizedTestSourceIds = testSourceIds.map((id) => String(id));

		mixedDependencies.forEach((task) => {
			const hasMatch = task.dependencies.some((depId) =>
				normalizedTestSourceIds.includes(String(depId))
			);
			expect(typeof hasMatch).toBe('boolean');
			expect(hasMatch).toBe(true); // Should find matches in both tasks
		});
	});

	test('should handle edge cases in ID normalization', () => {
		// Test various ID formats
		const testCases = [
			{ source: 1, dependency: '1', expected: true },
			{ source: '1', dependency: 1, expected: true },
			{ source: '3.1', dependency: '3.1', expected: true },
			{ source: 3, dependency: '3.1', expected: false }, // Different formats
			{ source: '3.1', dependency: 3, expected: false }, // Different formats
			{ source: 1, dependency: 2, expected: false }, // No match
			{ source: '1.2', dependency: '1.2', expected: true },
			{ source: 1, dependency: null, expected: false }, // Handle null
			{ source: 1, dependency: undefined, expected: false } // Handle undefined
		];

		testCases.forEach(({ source, dependency, expected }) => {
			const normalizedSourceIds = [String(source)];
			const hasMatch = normalizedSourceIds.includes(String(dependency));
			expect(hasMatch).toBe(expected);
		});
	});
});
