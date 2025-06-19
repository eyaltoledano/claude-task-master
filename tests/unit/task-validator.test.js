import {
  validateTask,
  validateTasksArray,
  validateTasksFile,
  formatZodError, // Updated import
} from '../../scripts/modules/task-validator.js';
// Import Zod schemas for potential direct use or reference, though tests primarily use validators
import { taskSchema as ZodTaskSchema, tasksFileSchema as ZodTasksFileSchema } from '../../scripts/schemas/zod-schemas.js';
import { z } from 'zod';


// Minimal valid task for reuse
const createValidTask = (id = 1) => ({
  id,
  title: `Test Task ${id}`,
  description: `Description for task ${id}`,
  status: 'pending',
  dependencies: [],
  priority: 'medium',
  details: 'Some details about the task.',
  testStrategy: 'Strategy for testing this task.',
  subtasks: [],
  // Optional fields can be added here if needed for specific tests
  // previousStatus: 'some-status',
  // acceptanceCriteria: 'Criteria text',
  // parentTaskId: null, // or a number
});

// Minimal valid metadata for reuse
const createValidMetadata = () => ({
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
  description: 'Test metadata section.',
});

describe('task-validator.js with Zod', () => {
  describe('validateTask', () => {
    test('should return isValid: true for a valid task object', () => {
      const task = createValidTask();
      const result = validateTask(task);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
      expect(result.data).toBeDefined();
    });

    test('should return isValid: false if title is missing', () => {
      const task = { ...createValidTask(), title: undefined };
      const result = validateTask(task);
      expect(result.isValid).toBe(false);
      expect(result.data).toBeNull();
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Path: title - Issue: Required/), // Corrected: Zod default for undefined
        ])
      );
    });

    test('should return isValid: false if title is an empty string', () => {
      const task = { ...createValidTask(), title: "" };
      const result = validateTask(task);
      expect(result.isValid).toBe(false);
      expect(result.data).toBeNull();
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Path: title - Issue: Task title cannot be empty/),
        ])
      );
    });

    test('should return isValid: false for invalid status enum value', () => {
      const task = { ...createValidTask(), status: 'invalid_status' };
      const result = validateTask(task);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Path: status - Issue: Invalid enum value/),
        ])
      );
    });

    test('should return isValid: false for invalid priority enum value', () => {
      const task = { ...createValidTask(), priority: 'urgent' };
      const result = validateTask(task);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Path: priority - Issue: Invalid enum value/),
        ])
      );
    });

    test('should return isValid: false if dependencies contains non-integer', () => {
      const task = { ...createValidTask(), dependencies: ['not-a-number'] };
      const result = validateTask(task);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Path: dependencies.0 - Issue: Expected number, received string/), // Corrected: Zod reports actual received type
        ])
      );
    });

    test('should return isValid: false if a subtask is missing its title', () => {
      const task = {
        ...createValidTask(),
        subtasks: [{ ...createValidTask(2), title: undefined }],
      };
      const result = validateTask(task);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Path: subtasks.0.title - Issue: Required/), // Corrected: Zod default for undefined
        ])
      );
    });

    test('should return isValid: false if id is not positive', () => {
      const task = { ...createValidTask(), id: 0 };
      const result = validateTask(task);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Path: id - Issue: Task ID must be a positive integer/),
        ])
      );
    });
  });

  describe('validateTasksArray', () => {
    test('should return isValid: true for an array with one valid task', () => {
      const tasksArray = [createValidTask()];
      const result = validateTasksArray(tasksArray);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
      expect(result.data).toBeDefined();
    });

    test('should return isValid: false for an array with one invalid task (missing title)', () => {
      const tasksArray = [{ ...createValidTask(), title: undefined }];
      const result = validateTasksArray(tasksArray);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Path: 0.title - Issue: Required/), // Corrected: Zod default for undefined
        ])
      );
    });
  });

  describe('validateTasksFile', () => {
    test('should return isValid: true for a valid tasks file structure', () => {
      const tasksFile = {
        masterTag: {
          tasks: [createValidTask()],
          metadata: createValidMetadata(),
        },
      };
      const result = validateTasksFile(tasksFile);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
      expect(result.data).toBeDefined();
    });

    test('should return isValid: false if a tag object is missing metadata', () => {
      const tasksFile = {
        testTag: {
          tasks: [createValidTask()],
          // metadata is missing
        },
      };
      const result = validateTasksFile(tasksFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Path: testTag.metadata - Issue: Required/),
        ])
      );
    });

    test('should return isValid: false if a tag object has tasks as "not-an-array"', () => {
      const tasksFile = {
        testTag: {
          tasks: "not-an-array",
          metadata: createValidMetadata(),
        },
      };
      const result = validateTasksFile(tasksFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Path: testTag.tasks - Issue: Expected array, received string/),
        ])
      );
    });

    test('should return isValid: false if a tag contains an invalid task (e.g. id as string)', () => {
      const tasksFile = {
        badTaskTag: {
          tasks: [{ ...createValidTask(), id: 'not-a-number' }],
          metadata: createValidMetadata(),
        },
      };
      const result = validateTasksFile(tasksFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Path: badTaskTag.tasks.0.id - Issue: Expected number, received string/),
        ])
      );
    });

    test('should return isValid: false for a file with an empty string as tag name', () => {
      const tasksFile = {
        "": {
          tasks: [createValidTask()],
          metadata: createValidMetadata(),
        }
      };
      const result = validateTasksFile(tasksFile);
      expect(result.isValid).toBe(false);
       expect(result.errors).toEqual(
        expect.arrayContaining([
          // Zod's z.record key validation error message might vary slightly based on version or internal details.
          // This regex is more flexible.
          expect.stringMatching(/Path: (root|\[object Object\]) - Issue: Tag name cannot be empty/),
        ])
      );
    });
  });

  describe('formatZodError', () => {
    test('should format a ZodError with a single issue correctly', () => {
      const mockZodError = {
        issues: [
          { path: ['task', 'title'], message: 'Required field missing' }
        ]
      };
      const formatted = formatZodError(mockZodError);
      expect(formatted).toEqual(['Path: task.title - Issue: Required field missing']);
    });

    test('should format a ZodError with multiple issues correctly', () => {
      const mockZodError = {
        issues: [
          { path: ['task', 'id'], message: 'Expected number, received string' },
          { path: ['task', 'status'], message: 'Invalid enum value' }
        ]
      };
      const formatted = formatZodError(mockZodError);
      expect(formatted).toEqual([
        'Path: task.id - Issue: Expected number, received string',
        'Path: task.status - Issue: Invalid enum value'
      ]);
    });

    test('should use "root" for path if Zod issue path is empty', () => {
        const mockZodError = {
        issues: [
          { path: [], message: 'Invalid input type for the entire object' }
        ]
      };
      const formatted = formatZodError(mockZodError);
      expect(formatted).toEqual(['Path: root - Issue: Invalid input type for the entire object']);
    });

    test('should return null if zodError is null or has no issues', () => {
      expect(formatZodError(null)).toBeNull();
      expect(formatZodError({ issues: [] })).toBeNull();
      expect(formatZodError({})).toBeNull();
    });
  });
});
