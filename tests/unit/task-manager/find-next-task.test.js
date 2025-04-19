/**
 * Tests for the findNextTask function
 */

import { jest } from '@jest/globals';
import fs from 'fs'; // Keep fs mock if needed by setup or other potential tests in this file
import path from 'path'; // Keep path mock

// Import the specific function being tested
import { findNextTask } from '../../../scripts/modules/task-manager.js';

// Mock implementations (Copy relevant mocks from the original file)
const mockReadFileSync = jest.fn();
const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockDirname = jest.fn();
const mockLog = jest.fn();
const mockIsTaskDependentOn = jest.fn().mockReturnValue(false);
const mockGetAvailableAIModel = jest.fn();
// Add any other mocks specifically used by findNextTask or its dependencies if necessary

// Mock fs module
jest.mock('fs', () => ({
  readFileSync: mockReadFileSync,
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  writeFileSync: jest.fn() // Keep other mocks if potentially needed by setup
}));

// Mock path module
jest.mock('path', () => ({
  dirname: mockDirname,
  join: jest.fn((dir, file) => `${dir}/${file}`)
}));

// Mock ui (Only include mocks relevant to findNextTask or its dependencies)
jest.mock('../../../scripts/modules/ui.js', () => ({
  // Add mocks if findNextTask uses UI functions directly or indirectly
}));

// Mock dependency-manager (Only include mocks relevant to findNextTask)
jest.mock('../../../scripts/modules/dependency-manager.js', () => ({
  // Add mocks if findNextTask uses dependency manager functions directly
}));

// Mock utils (Include mocks relevant to findNextTask)
jest.mock('../../../scripts/modules/utils.js', () => ({
  log: mockLog,
  CONFIG: { // Provide necessary config defaults if used by findNextTask
    debug: false
    // Add other CONFIG properties if needed
  },
  findTaskById: jest.fn((tasks, id) => // Keep if findNextTask uses it
    tasks.find(t => t.id === parseInt(id))
  ),
  // Add other mocks if needed
}));

// Mock AI services (Only include mocks relevant to findNextTask)
jest.mock('../../../scripts/modules/ai-services.js', () => ({
  getAvailableAIModel: mockGetAvailableAIModel
  // Add other mocks if needed
}));


// Mock the task-manager module itself ONLY if findNextTask calls other functions *within* task-manager.js
// jest.mock('../../../scripts/modules/task-manager.js', () => {
//   const originalModule = jest.requireActual(
//     '../../../scripts/modules/task-manager.js'
//   );
//   return {
//     ...originalModule,
//     // Mock specific functions if needed
//     isTaskDependentOn: mockIsTaskDependentOn // Example
//   };
// });


describe('findNextTask function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Add any specific setup needed for findNextTask tests
  });

  test('should return the highest priority task with all dependencies satisfied', () => {
    const tasks = [
      {
        id: 1,
        title: 'Setup Project',
        status: 'done',
        dependencies: [],
        priority: 'high'
      },
      {
        id: 2,
        title: 'Implement Core Features',
        status: 'pending',
        dependencies: [1],
        priority: 'high'
      },
      {
        id: 3,
        title: 'Create Documentation',
        status: 'pending',
        dependencies: [1],
        priority: 'medium'
      },
      {
        id: 4,
        title: 'Deploy Application',
        status: 'pending',
        dependencies: [2, 3],
        priority: 'high'
      }
    ];

    const nextTask = findNextTask(tasks);

    expect(nextTask).toBeDefined();
    expect(nextTask.id).toBe(2);
    expect(nextTask.title).toBe('Implement Core Features');
  });

  test('should prioritize by priority level when dependencies are equal', () => {
    const tasks = [
      {
        id: 1,
        title: 'Setup Project',
        status: 'done',
        dependencies: [],
        priority: 'high'
      },
      {
        id: 2,
        title: 'Low Priority Task',
        status: 'pending',
        dependencies: [1],
        priority: 'low'
      },
      {
        id: 3,
        title: 'Medium Priority Task',
        status: 'pending',
        dependencies: [1],
        priority: 'medium'
      },
      {
        id: 4,
        title: 'High Priority Task',
        status: 'pending',
        dependencies: [1],
        priority: 'high'
      }
    ];

    const nextTask = findNextTask(tasks);

    expect(nextTask.id).toBe(4);
    expect(nextTask.priority).toBe('high');
  });

  test('should return null when all tasks are completed', () => {
    const tasks = [
      {
        id: 1,
        title: 'Setup Project',
        status: 'done',
        dependencies: [],
        priority: 'high'
      },
      {
        id: 2,
        title: 'Implement Features',
        status: 'done',
        dependencies: [1],
        priority: 'high'
      }
    ];

    const nextTask = findNextTask(tasks);

    expect(nextTask).toBeNull();
  });

  test('should return null when all pending tasks have unsatisfied dependencies', () => {
    const tasks = [
      {
        id: 1,
        title: 'Setup Project',
        status: 'pending',
        dependencies: [2], // Circular or unsatisfied
        priority: 'high'
      },
      {
        id: 2,
        title: 'Implement Features',
        status: 'pending',
        dependencies: [1], // Circular or unsatisfied
        priority: 'high'
      }
    ];
    // Mock findTaskById specifically for this test case if needed
     jest.requireMock('../../../scripts/modules/utils.js').findTaskById.mockImplementation((taskList, taskId) => {
       if (taskList && taskList.length > 0) {
         return taskList.find(t => t.id === taskId);
       }
       return null; // Ensure it handles empty task lists correctly
     });


    const nextTask = findNextTask(tasks);

    expect(nextTask).toBeNull();
  });

  test('should handle empty tasks array', () => {
    const nextTask = findNextTask([]);

    expect(nextTask).toBeNull();
  });

  // Add more specific tests for findNextTask if needed
}); 