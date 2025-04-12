/**
 * workspace-scanner.test.js
 * Unit tests for the workspace scanner module
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { scanWorkspace } from '../../scripts/modules/workspace-scanner.js';
import { callLLMWithRetry } from '../../scripts/modules/ai-services.js';
import { parsePRD } from '../../scripts/modules/task-manager.js';

// Mock dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('../../scripts/modules/ai-services.js');
jest.mock('../../scripts/modules/task-manager.js', () => ({
  parsePRD: jest.fn().mockResolvedValue([
    { id: '1', title: 'Task from PRD 1' },
    { id: '2', title: 'Task from PRD 2' }
  ]),
  createTask: jest.fn()
}));
jest.mock('../../scripts/modules/ui.js', () => ({
  log: jest.fn(),
  error: jest.fn(),
  colorize: {
    yellow: jest.fn(str => str),
    green: jest.fn(str => str)
  }
}));
jest.mock('../../scripts/modules/utils.js', () => ({
  saveTasksToFile: jest.fn().mockResolvedValue(true),
  validateTasks: jest.fn(tasks => tasks)
}));

describe('Workspace Scanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up basic file system mocks
    fs.statSync.mockReturnValue({ isDirectory: () => true });
    fs.existsSync.mockReturnValue(true);
    fs.readdirSync.mockReturnValue(['file1.js', 'file2.js', 'subdir']);
    fs.readFileSync.mockReturnValue('mock file content');
    fs.promises = {
      readdir: jest.fn().mockResolvedValue(['file1.js', 'file2.js', 'subdir']),
      readFile: jest.fn().mockResolvedValue('mock file content'),
      writeFile: jest.fn().mockResolvedValue(undefined),
      mkdir: jest.fn().mockResolvedValue(undefined)
    };
    fs.promises.stat = jest.fn().mockImplementation(path => {
      if (path.includes('subdir')) {
        return Promise.resolve({ isDirectory: () => true, isFile: () => false });
      }
      return Promise.resolve({ isDirectory: () => false, isFile: () => true });
    });
    path.extname.mockReturnValue('.js');
    path.join.mockImplementation((...args) => args.join('/'));
    path.basename.mockImplementation((path) => path.split('/').pop());
    path.dirname.mockImplementation((path) => path.split('/').slice(0, -1).join('/'));
  });

  describe('scanWorkspace function', () => {
    it('should generate a PRD and use it to create tasks by default', async () => {
      // Set up expected LLM response for PRD generation
      const mockPRDResponse = {
        content: `# Project Requirements Document
This is a mock PRD with project requirements.`
      };
      
      callLLMWithRetry.mockResolvedValue(mockPRDResponse);
      
      // Call the function with default options (generatePRD = true)
      const workspacePath = '/mock/workspace';
      const result = await scanWorkspace(workspacePath, {
        outputPath: 'tasks/tasks.json'
      });
      
      // Verify results
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Task from PRD 1');
      expect(result[1].title).toBe('Task from PRD 2');
      
      // Verify PRD was generated
      expect(callLLMWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            { role: 'system', content: expect.stringContaining('expert software architect') },
            { role: 'user', content: expect.stringContaining('Create a Product Requirements Document') }
          ])
        })
      );
      
      // Verify PRD was written to file
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        '/mock/workspace/scripts/prd.txt',
        expect.any(String)
      );
      
      // Verify parsePRD was called
      expect(parsePRD).toHaveBeenCalledWith(
        '/mock/workspace/scripts/prd.txt',
        'tasks/tasks.json',
        expect.any(Number)
      );
    });
    
    it('should directly generate tasks when generatePRD is false', async () => {
      // Set up expected LLM response for direct task generation
      const mockLLMResponse = {
        content: `
          [
            {
              "title": "Task 1",
              "description": "Description 1",
              "details": "Implementation details 1",
              "testStrategy": "Test strategy 1",
              "priority": "high",
              "dependencies": []
            },
            {
              "title": "Task 2",
              "description": "Description 2",
              "details": "Implementation details 2",
              "testStrategy": "Test strategy 2",
              "priority": "medium",
              "dependencies": [0]
            }
          ]
        `
      };
      
      callLLMWithRetry.mockResolvedValue(mockLLMResponse);
      
      // Call the function with generatePRD = false
      const workspacePath = '/mock/workspace';
      const result = await scanWorkspace(workspacePath, {
        outputPath: 'tasks/tasks.json',
        generatePRD: false
      });
      
      // Verify the result
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[0].title).toBe('Task 1');
      expect(result[1].id).toBe('2');
      expect(result[1].title).toBe('Task 2');
      expect(result[1].dependencies).toEqual(['1']);
      
      // Verify that task generation was called directly
      expect(callLLMWithRetry).toHaveBeenCalledWith(expect.objectContaining({
        messages: expect.arrayContaining([
          { role: 'system', content: expect.stringContaining('software development expert') },
          { role: 'user', content: expect.stringContaining('generate a set of tasks') }
        ]),
      }));
      
      // Verify that parsePRD was NOT called
      expect(parsePRD).not.toHaveBeenCalled();
    });
    
    it('should handle errors during PRD generation', async () => {
      // Mock the PRD generation to fail
      callLLMWithRetry.mockRejectedValueOnce(new Error('PRD generation failed'));
      
      await expect(scanWorkspace('/mock/workspace')).rejects.toThrow('Workspace scanning failed');
    });
    
    it('should validate workspace path', async () => {
      fs.statSync.mockReturnValueOnce({ isDirectory: () => false });
      
      await expect(scanWorkspace('/not-a-directory')).rejects.toThrow('Workspace path is not a directory');
    });
  });
}); 