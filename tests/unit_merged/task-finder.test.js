/**
 * Task finder tests
 */

import { findTaskById } from '../../scripts/modules/utils.js';
import { sampleTasks, emptySampleTasks } from '../fixtures/sample-tasks.js';

describe('Task Finder', () => {
  describe('findTaskById function', () => {
    test('should find a task by numeric ID', () => {
      const task = findTaskById(sampleTasks.tasks, 2);
      expect(task).toBeDefined();
      expect(task.id).toBe(2);
      expect(task.title).toBe('Create Core Functionality');
    });

    test('should find a task by string ID', () => {
      const task = findTaskById(sampleTasks.tasks, '2');
      expect(task).toBeDefined();
      expect(task.id).toBe(2);
    });

    test('should find a subtask using dot notation', () => {
      const subtask = findTaskById(sampleTasks.tasks, '3.1');
      expect(subtask).toBeDefined();
      expect(subtask.id).toBe(1);
      expect(subtask.title).toBe('Create Header Component');
    });

    test('should return null for non-existent task ID', () => {
      const task = findTaskById(sampleTasks.tasks, 99);
      expect(task).toBeNull();
    });

    test('should return null for non-existent subtask ID', () => {
      const subtask = findTaskById(sampleTasks.tasks, '3.99');
      expect(subtask).toBeNull();
    });

    test('should return null for non-existent parent task ID in subtask notation', () => {
      const subtask = findTaskById(sampleTasks.tasks, '99.1');
      expect(subtask).toBeNull();
    });

    test('should return null when tasks array is empty', () => {
      const task = findTaskById(emptySampleTasks.tasks, 1);
      expect(task).toBeNull();
    });
  });
}); 