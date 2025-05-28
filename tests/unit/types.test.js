/**
 * Type assertion tests for TypeScript interfaces
 * These tests verify that our TypeScript types compile correctly and behave as expected
 */

import { describe, it, expect } from '@jest/globals';
import { 
  isTask, 
  isSubtask, 
  validateTask, 
  validateSubtask,
  parseTaskId,
  findCircularDependencies,
  isValidTaskStatus,
  isValidTaskPriority,
  Ok,
  Err
} from '../../types/index.js';

describe('Type Guards', () => {
  describe('isTask', () => {
    it('should identify valid Task objects', () => {
      const task = {
        id: '1',
        title: 'Test Task',
        description: 'A test task',
        status: 'pending',
        priority: 'high',
        dependencies: [],
        subtasks: []
      };
      
      expect(isTask(task)).toBe(true);
    });
    
    it('should reject Subtask objects', () => {
      const subtask = {
        id: '1.1',
        taskId: '1',
        title: 'Test Subtask',
        description: 'A test subtask',
        status: 'pending',
        dependencies: []
      };
      
      expect(isTask(subtask)).toBe(false);
    });
  });
  
  describe('isSubtask', () => {
    it('should identify valid Subtask objects', () => {
      const subtask = {
        id: '1.1',
        taskId: '1',
        title: 'Test Subtask',
        description: 'A test subtask',
        status: 'pending',
        dependencies: []
      };
      
      expect(isSubtask(subtask)).toBe(true);
    });
    
    it('should reject Task objects', () => {
      const task = {
        id: '1',
        title: 'Test Task',
        description: 'A test task',
        status: 'pending',
        priority: 'high',
        dependencies: []
      };
      
      expect(isSubtask(task)).toBe(false);
    });
  });
  
  describe('Status and Priority Validators', () => {
    it('should validate correct task statuses', () => {
      expect(isValidTaskStatus('pending')).toBe(true);
      expect(isValidTaskStatus('in_progress')).toBe(true);
      expect(isValidTaskStatus('completed')).toBe(true);
      expect(isValidTaskStatus('cancelled')).toBe(true);
    });
    
    it('should reject invalid task statuses', () => {
      expect(isValidTaskStatus('invalid')).toBe(false);
      expect(isValidTaskStatus('')).toBe(false);
      expect(isValidTaskStatus(null)).toBe(false);
      expect(isValidTaskStatus(123)).toBe(false);
    });
    
    it('should validate correct task priorities', () => {
      expect(isValidTaskPriority('low')).toBe(true);
      expect(isValidTaskPriority('medium')).toBe(true);
      expect(isValidTaskPriority('high')).toBe(true);
    });
    
    it('should reject invalid task priorities', () => {
      expect(isValidTaskPriority('urgent')).toBe(false);
      expect(isValidTaskPriority('')).toBe(false);
      expect(isValidTaskPriority(null)).toBe(false);
    });
  });
});

describe('Validation Functions', () => {
  describe('validateTask', () => {
    it('should validate a complete valid task', () => {
      const task = {
        id: '1',
        title: 'Valid Task',
        description: 'This is a valid task',
        status: 'pending',
        priority: 'medium',
        dependencies: ['0'],
        subtasks: []
      };
      
      const result = validateTask(task);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toEqual(task);
      }
    });
    
    it('should reject task with missing required fields', () => {
      const task = {
        id: '1',
        // missing title
        description: 'Missing title',
        status: 'pending',
        priority: 'medium',
        dependencies: []
      };
      
      const result = validateTask(task);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual(
          expect.objectContaining({ field: 'title' })
        );
      }
    });
    
    it('should reject task with invalid status', () => {
      const task = {
        id: '1',
        title: 'Invalid Status Task',
        description: 'Task with invalid status',
        status: 'invalid-status',
        priority: 'high',
        dependencies: []
      };
      
      const result = validateTask(task);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual(
          expect.objectContaining({ field: 'status' })
        );
      }
    });
    
    it('should reject task with invalid dependencies', () => {
      const task = {
        id: '1',
        title: 'Invalid Dependencies',
        description: 'Task with invalid dependencies',
        status: 'pending',
        priority: 'high',
        dependencies: ['valid', 123, null] // mixed types
      };
      
      const result = validateTask(task);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual(
          expect.objectContaining({ field: 'dependencies' })
        );
      }
    });
  });
  
  describe('validateSubtask', () => {
    it('should validate a complete valid subtask', () => {
      const subtask = {
        id: '1.1',
        taskId: '1',
        title: 'Valid Subtask',
        description: 'This is a valid subtask',
        status: 'pending',
        dependencies: []
      };
      
      const result = validateSubtask(subtask);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toEqual(subtask);
      }
    });
    
    it('should reject subtask without taskId', () => {
      const subtask = {
        id: '1.1',
        // missing taskId
        title: 'Invalid Subtask',
        description: 'Subtask without taskId',
        status: 'pending',
        dependencies: []
      };
      
      const result = validateSubtask(subtask);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual(
          expect.objectContaining({ field: 'taskId' })
        );
      }
    });
  });
});

describe('ID Parsing', () => {
  describe('parseTaskId', () => {
    it('should parse main task IDs correctly', () => {
      const result = parseTaskId('5');
      expect(result).toEqual({
        isValid: true,
        isMainTask: true,
        isSubtask: false,
        isSubSubtask: false,
        level: 1,
        parts: ['5'],
        parent: undefined
      });
    });
    
    it('should parse subtask IDs correctly', () => {
      const result = parseTaskId('5.3');
      expect(result).toEqual({
        isValid: true,
        isMainTask: false,
        isSubtask: true,
        isSubSubtask: false,
        level: 2,
        parts: ['5', '3'],
        parent: '5'
      });
    });
    
    it('should parse sub-subtask IDs correctly', () => {
      const result = parseTaskId('5.3.1');
      expect(result).toEqual({
        isValid: true,
        isMainTask: false,
        isSubtask: false,
        isSubSubtask: true,
        level: 3,
        parts: ['5', '3', '1'],
        parent: '5.3'
      });
    });
    
    it('should detect invalid IDs', () => {
      expect(parseTaskId('abc').isValid).toBe(false);
      expect(parseTaskId('1.abc').isValid).toBe(false);
      expect(parseTaskId('0.1').isValid).toBe(false); // IDs start at 1
      expect(parseTaskId('').isValid).toBe(false);
    });
  });
});

describe('Circular Dependency Detection', () => {
  it('should detect simple circular dependencies', () => {
    const tasks = [
      { id: '1', title: 'Task 1', status: 'pending', dependencies: ['2'] },
      { id: '2', title: 'Task 2', status: 'pending', dependencies: ['1'] }
    ];
    
    const cycles = findCircularDependencies(tasks);
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0]).toContain('1 -> 2 -> 1');
  });
  
  it('should detect complex circular dependencies', () => {
    const tasks = [
      { id: '1', title: 'Task 1', status: 'pending', dependencies: ['2'] },
      { id: '2', title: 'Task 2', status: 'pending', dependencies: ['3'] },
      { id: '3', title: 'Task 3', status: 'pending', dependencies: ['1'] },
      { id: '4', title: 'Task 4', status: 'pending', dependencies: [] }
    ];
    
    const cycles = findCircularDependencies(tasks);
    expect(cycles.length).toBeGreaterThan(0);
  });
  
  it('should not detect cycles when there are none', () => {
    const tasks = [
      { id: '1', title: 'Task 1', status: 'pending', dependencies: [] },
      { id: '2', title: 'Task 2', status: 'pending', dependencies: ['1'] },
      { id: '3', title: 'Task 3', status: 'pending', dependencies: ['1', '2'] }
    ];
    
    const cycles = findCircularDependencies(tasks);
    expect(cycles).toEqual([]);
  });
});

describe('Result Type', () => {
  it('should create success results', () => {
    const data = { id: 1, name: 'test' };
    const result = Ok(data);
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual(data);
  });
  
  it('should create error results', () => {
    const error = new Error('Test error');
    const result = Err(error);
    
    expect(result.success).toBe(false);
    expect(result.error).toBe(error);
  });
});

describe('Type Compatibility', () => {
  it('should allow Task objects to have optional fields', () => {
    const minimalTask = {
      id: '1',
      title: 'Minimal Task',
      description: '',
      status: 'pending',
      priority: 'low',
      dependencies: []
    };
    
    const fullTask = {
      ...minimalTask,
      subtasks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      complexity: 5,
      estimatedHours: 8,
      tags: ['typescript', 'testing']
    };
    
    expect(validateTask(minimalTask).valid).toBe(true);
    expect(validateTask(fullTask).valid).toBe(true);
  });
  
  it('should maintain type safety for dates', () => {
    const task = {
      id: '1',
      title: 'Date Test',
      description: 'Testing date fields',
      status: 'completed',
      priority: 'high',
      dependencies: [],
      createdAt: new Date('2024-01-01'),
      completedAt: new Date('2024-01-02')
    };
    
    const result = validateTask(task);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.createdAt).toBeInstanceOf(Date);
      expect(result.data.completedAt).toBeInstanceOf(Date);
    }
  });
});