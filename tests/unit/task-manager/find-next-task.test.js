/**
 * Tests for the findNextTask function
 */

import { jest } from '@jest/globals';
import fs from 'fs'; // Keep fs mock if needed by setup or other potential tests in this file
import path from 'path'; // Keep path mock

// Mock implementations
const mockLog = jest.fn();
const mockReadFileSync = jest.fn();
const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockDirname = jest.fn();
const mockIsTaskDependentOn = jest.fn().mockReturnValue(false);
const mockGetAvailableAIModel = jest.fn();

// Define the findTaskById mock function directly
const mockFindTaskById = jest.fn((tasks, id) => {
  // Removed console.log for cleanup
  const foundTask = tasks?.find(t => t.id === parseInt(id));
  return { task: foundTask }; 
});

// Mock utils module using unstable_mockModule BEFORE other imports
// jest.unstable_mockModule('../../../scripts/modules/utils.js', () => ({
//   log: mockLog,
//   CONFIG: { 
//     debug: false
//   },
//   findTaskById: mockFindTaskById
// }));

// Now import the function being tested (which depends on the mocked utils)
import { findNextTask } from '../../../scripts/modules/task-manager.js';

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

// Define a mock task provider
let mockTaskProvider;

describe('findNextTask function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Add any specific setup needed for findNextTask tests

    // Reset and configure mock task provider for each test
    mockTaskProvider = {
      getTasks: jest.fn()
    };
    // Reset the direct mock function before each test
    mockFindTaskById.mockClear(); 
  });

  test('should return the highest priority task with all dependencies satisfied', async () => {
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

    // Configure the mock provider for this test
    mockTaskProvider.getTasks.mockImplementation(async (options) => {
      if (options && options.status === 'pending') {
        return { tasks: tasks.filter(t => t.status === 'pending') };
      }
      return { tasks }; // Return all tasks for dependency check
    });

    // Pass the mock function in options
    const nextTask = await findNextTask(null, { 
      taskProvider: mockTaskProvider, 
      findTaskByIdFunc: mockFindTaskById // Pass the mock function
    });

    expect(mockTaskProvider.getTasks).toHaveBeenCalledTimes(2);
    expect(nextTask).toBeDefined();
    expect(nextTask.id).toBe(2);
    expect(nextTask.title).toBe('Implement Core Features');
  });

  test('should prioritize by priority level when dependencies are equal', async () => {
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

    // Configure the mock provider
    mockTaskProvider.getTasks.mockImplementation(async (options) => {
      if (options && options.status === 'pending') {
        return { tasks: tasks.filter(t => t.status === 'pending') };
      }
      return { tasks };
    });

    // Pass the mock function in options
    const nextTask = await findNextTask(null, { 
      taskProvider: mockTaskProvider, 
      findTaskByIdFunc: mockFindTaskById // Pass the mock function
    });

    expect(mockTaskProvider.getTasks).toHaveBeenCalledTimes(2);
    expect(nextTask.id).toBe(4);
    expect(nextTask.priority).toBe('high');
  });

  test('should return null when all tasks are completed', async () => {
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

    // Configure the mock provider
    mockTaskProvider.getTasks.mockImplementation(async (options) => {
      if (options && options.status === 'pending') {
        return { tasks: tasks.filter(t => t.status === 'pending') };
      }
      return { tasks };
    });

    // Pass the mock function in options
    const nextTask = await findNextTask(null, { 
      taskProvider: mockTaskProvider, 
      findTaskByIdFunc: mockFindTaskById // Pass the mock function
    });

    expect(mockTaskProvider.getTasks).toHaveBeenCalledTimes(1);
    expect(nextTask).toBeNull();
  });

  test('should return null when all pending tasks have unsatisfied dependencies', async () => {
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

    // Configure the mock provider
    mockTaskProvider.getTasks.mockImplementation(async (options) => {
      if (options && options.status === 'pending') {
        return { tasks: tasks.filter(t => t.status === 'pending') };
      }
      return { tasks };
    });

    // Pass the mock function in options
    const nextTask = await findNextTask(null, { 
      taskProvider: mockTaskProvider, 
      findTaskByIdFunc: mockFindTaskById // Pass the mock function
    });

    expect(mockTaskProvider.getTasks).toHaveBeenCalledTimes(2);
    expect(nextTask).toBeNull();
  });

  test('should handle empty tasks array', async () => {
    // Configure the mock provider
    mockTaskProvider.getTasks.mockResolvedValue({ tasks: [] });

    // Pass the mock function in options
    const nextTask = await findNextTask(null, { 
      taskProvider: mockTaskProvider, 
      findTaskByIdFunc: mockFindTaskById // Pass the mock function
    });

    expect(mockTaskProvider.getTasks).toHaveBeenCalledTimes(1);
    expect(nextTask).toBeNull();
  });

  // Add more specific tests for findNextTask if needed
}); 