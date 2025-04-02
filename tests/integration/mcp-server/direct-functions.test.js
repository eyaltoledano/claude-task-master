/**
 * Integration test for direct function imports in MCP server
 */

import { jest } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the current module's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the direct functions
import { listTasksDirect } from '../../../mcp-server/src/core/task-master-core.js';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
};

// Test file paths
const testProjectRoot = path.join(__dirname, '../../fixture');
const testTasksPath = path.join(testProjectRoot, 'test-tasks.json');

describe('MCP Server Direct Functions', () => {
  // Create test data before tests
  beforeAll(() => {
    // Create test directory if it doesn't exist
    if (!fs.existsSync(testProjectRoot)) {
      fs.mkdirSync(testProjectRoot, { recursive: true });
    }
    
    // Create a sample tasks.json file for testing
    const sampleTasks = {
      meta: {
        projectName: 'Test Project',
        version: '1.0.0'
      },
      tasks: [
        {
          id: 1,
          title: 'Task 1',
          description: 'First task',
          status: 'done',
          dependencies: [],
          priority: 'high'
        },
        {
          id: 2,
          title: 'Task 2',
          description: 'Second task',
          status: 'in-progress',
          dependencies: [1],
          priority: 'medium',
          subtasks: [
            {
              id: 1,
              title: 'Subtask 2.1',
              description: 'First subtask',
              status: 'done'
            },
            {
              id: 2,
              title: 'Subtask 2.2',
              description: 'Second subtask',
              status: 'pending'
            }
          ]
        },
        {
          id: 3,
          title: 'Task 3',
          description: 'Third task',
          status: 'pending',
          dependencies: [1, 2],
          priority: 'low'
        }
      ]
    };
    
    fs.writeFileSync(testTasksPath, JSON.stringify(sampleTasks, null, 2));
  });
  
  // Clean up after tests
  afterAll(() => {
    // Remove test tasks file
    if (fs.existsSync(testTasksPath)) {
      fs.unlinkSync(testTasksPath);
    }
    
    // Try to remove the directory (will only work if empty)
    try {
      fs.rmdirSync(testProjectRoot);
    } catch (error) {
      // Ignore errors if the directory isn't empty
    }
  });
  
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('listTasksDirect', () => {
    test('should return all tasks when no filter is provided', async () => {
      // Arrange
      const args = {
        projectRoot: testProjectRoot,
        file: testTasksPath
      };
      
      // Act
      const result = await listTasksDirect(args, mockLogger);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.data.tasks.length).toBe(3);
      expect(result.data.stats.total).toBe(3);
      expect(result.data.stats.completed).toBe(1);
      expect(result.data.stats.inProgress).toBe(1);
      expect(result.data.stats.pending).toBe(1);
      expect(mockLogger.info).toHaveBeenCalled();
    });
    
    test('should filter tasks by status', async () => {
      // Arrange
      const args = {
        projectRoot: testProjectRoot,
        file: testTasksPath,
        status: 'pending'
      };
      
      // Act
      const result = await listTasksDirect(args, mockLogger);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.data.tasks.length).toBe(1);
      expect(result.data.tasks[0].id).toBe(3);
      expect(result.data.filter).toBe('pending');
    });
    
    test('should include subtasks when requested', async () => {
      // Arrange
      const args = {
        projectRoot: testProjectRoot,
        file: testTasksPath,
        withSubtasks: true
      };
      
      // Act
      const result = await listTasksDirect(args, mockLogger);
      
      // Assert
      expect(result.success).toBe(true);
      
      // Verify subtasks are included
      const taskWithSubtasks = result.data.tasks.find(t => t.id === 2);
      expect(taskWithSubtasks.subtasks).toBeDefined();
      expect(taskWithSubtasks.subtasks.length).toBe(2);
      
      // Verify subtask details
      expect(taskWithSubtasks.subtasks[0].id).toBe(1);
      expect(taskWithSubtasks.subtasks[0].title).toBe('Subtask 2.1');
      expect(taskWithSubtasks.subtasks[0].status).toBe('done');
    });
    
    test('should handle errors gracefully', async () => {
      // Arrange
      const args = {
        projectRoot: testProjectRoot,
        file: 'non-existent-file.json'
      };
      
      // Act
      const result = await listTasksDirect(args, mockLogger);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBeDefined();
      expect(result.error.message).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
}); 