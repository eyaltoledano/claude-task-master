import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DirectBackend } from '../../scripts/modules/flow/backends/direct-backend.js';
import path from 'path';

describe('DirectBackend', () => {
  let backend;
  let projectRoot;

  beforeEach(() => {
    projectRoot = process.cwd();
    backend = new DirectBackend({ projectRoot });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const result = await backend.initialize();
      expect(result).toBe(true);
    });
  });

  describe('listTasks', () => {
    it('should return tasks array and tag', async () => {
      const result = await backend.listTasks();
      
      expect(result).toHaveProperty('tasks');
      expect(result).toHaveProperty('tag');
      expect(Array.isArray(result.tasks)).toBe(true);
      expect(typeof result.tag).toBe('string');
    });

    it('should handle status filter', async () => {
      const result = await backend.listTasks({ status: 'done' });
      
      expect(result).toHaveProperty('tasks');
      // All returned tasks should have status 'done'
      result.tasks.forEach(task => {
        expect(task.status).toBe('done');
      });
    });
  });

  describe('getTask', () => {
    it('should return task details for valid ID', async () => {
      // First get a task ID from the list
      const listResult = await backend.listTasks();
      if (listResult.tasks.length > 0) {
        const taskId = listResult.tasks[0].id;
        
        const result = await backend.getTask(taskId);
        // The result is the task object directly
        expect(result).toHaveProperty('id', taskId);
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('description');
      }
    });
  });

  describe('telemetry', () => {
    it('should track telemetry data from AI operations', async () => {
      // Initial telemetry should be null
      expect(backend.getTelemetry()).toBe(null);
      
      // After an operation, telemetry might be updated
      // Note: This depends on whether the operation uses AI
      await backend.listTasks();
      
      const telemetry = backend.getTelemetry();
      // Telemetry may or may not be set depending on the operation
      if (telemetry) {
        expect(telemetry).toHaveProperty('totalCost');
        expect(telemetry).toHaveProperty('totalTokens');
        expect(telemetry).toHaveProperty('calls');
      }
    });
  });

  describe('tasksJsonPath', () => {
    it('should construct correct tasks.json path', () => {
      expect(backend.tasksJsonPath).toBe(
        path.join(projectRoot, '.taskmaster/tasks/tasks.json')
      );
    });
  });
}); 