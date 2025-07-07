/**
 * TaskStatusManager Unit Tests - Phase 4/5 Implementation
 * 
 * Tests systematic task status management following dev_workflow.mdc patterns
 * Coverage: workflow step updates, status transitions, metadata management
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { TaskStatusManager } from '../../services/TaskStatusManager.js';

// Mock DirectBackend
const mockBackend = {
  setTaskStatus: jest.fn(),
  updateTask: jest.fn(),
  updateSubtask: jest.fn(),
  getTask: jest.fn(),
  setSubtaskStatus: jest.fn()
};

jest.mock('../../backends/direct-backend.js', () => ({
  DirectBackend: jest.fn(() => mockBackend)
}));

describe('TaskStatusManager - Phase 4/5 Tests', () => {
  let statusManager;

  beforeEach(() => {
    jest.clearAllMocks();
    statusManager = new TaskStatusManager();
    
    // Default mock responses
    mockBackend.setTaskStatus.mockResolvedValue({ success: true, data: {} });
    mockBackend.updateTask.mockResolvedValue({ success: true, data: {} });
    mockBackend.updateSubtask.mockResolvedValue({ success: true, data: {} });
    mockBackend.getTask.mockResolvedValue({
      id: '4',
      status: 'pending',
      details: 'Sample task',
      subtasks: []
    });
  });

  describe('Workflow Step Management', () => {
    test('should handle start-implementation step', async () => {
      const result = await statusManager.updateStatusForWorkflowStep(
        '4',
        'start-implementation',
        {
          worktree: {
            branch: 'task-4',
            path: '/path/to/worktree'
          }
        }
      );

      expect(result).toBeDefined();
      expect(mockBackend.setTaskStatus).toHaveBeenCalledWith('4', 'in-progress');
    });

    test('should handle commit-progress step', async () => {
      const result = await statusManager.updateStatusForWorkflowStep(
        '4.1',
        'commit-progress',
        {
          commitMessage: 'feat(task-4): Complete subtask 4.1',
          findings: 'Successfully implemented JWT authentication',
          decisions: 'Used express-jwt middleware for token validation'
        }
      );

      expect(result).toBeDefined();
      expect(mockBackend.updateSubtask).toHaveBeenCalledWith(
        '4.1',
        expect.stringContaining('Progress committed')
      );
    });

    test('should handle complete-implementation step', async () => {
      const result = await statusManager.updateStatusForWorkflowStep(
        '4',
        'complete-implementation',
        {
          completionSummary: 'All subtasks completed successfully'
        }
      );

      expect(result).toBeDefined();
      expect(mockBackend.setTaskStatus).toHaveBeenCalledWith('4', 'done');
    });

    test('should handle pr-created step', async () => {
      const result = await statusManager.updateStatusForWorkflowStep(
        '4',
        'pr-created',
        {
          prUrl: 'https://github.com/user/repo/pull/123',
          branch: 'task-4',
          commitHash: 'abc123'
        }
      );

      expect(result).toBeDefined();
      expect(mockBackend.updateTask).toHaveBeenCalledWith(
        '4',
        expect.stringContaining('PR created: https://github.com/user/repo/pull/123')
      );
    });

    test('should handle merged step', async () => {
      const result = await statusManager.updateStatusForWorkflowStep(
        '4',
        'merged',
        {
          mergeCommit: 'def456',
          prUrl: 'https://github.com/user/repo/pull/123'
        }
      );

      expect(result).toBeDefined();
      expect(mockBackend.setTaskStatus).toHaveBeenCalledWith('4', 'done');
    });

    test('should handle subtask-progress step', async () => {
      const result = await statusManager.updateStatusForWorkflowStep(
        '4.2',
        'subtask-progress',
        {
          phase: 'implementation',
          findings: 'Database connection established',
          nextSteps: 'Implement user model'
        }
      );

      expect(result).toBeDefined();
      expect(mockBackend.updateSubtask).toHaveBeenCalledWith(
        '4.2',
        expect.stringContaining('Database connection established')
      );
    });

    test('should reject unknown workflow step', async () => {
      await expect(statusManager.updateStatusForWorkflowStep(
        '4',
        'unknown-step'
      )).rejects.toThrow('Unknown workflow step: unknown-step');
    });
  });

  describe('Status Transition Validation', () => {
    test('should validate valid status transitions', () => {
      const validCases = [
        { from: 'pending', to: 'in-progress', step: 'start-implementation' },
        { from: 'in-progress', to: 'done', step: 'complete-implementation' },
        { from: 'in-progress', to: 'review', step: 'request-review' },
        { from: 'review', to: 'done', step: 'approve-review' },
        { from: 'done', to: 'pending', step: 'reopen-task' }
      ];

      validCases.forEach(({ from, to, step }) => {
        const validation = statusManager.validateStatusTransition(from, to, step);
        expect(validation.isValid).toBe(true);
        expect(validation.step).toBe(step);
      });
    });

    test('should reject invalid status transitions', () => {
      const invalidCases = [
        { from: 'pending', to: 'done', step: 'invalid-jump' },
        { from: 'done', to: 'cancelled', step: 'invalid-cancel' },
        { from: 'cancelled', to: 'in-progress', step: 'invalid-resume' }
      ];

      invalidCases.forEach(({ from, to, step }) => {
        const validation = statusManager.validateStatusTransition(from, to, step);
        expect(validation.isValid).toBe(false);
        expect(validation.reason).toContain('Invalid transition');
      });
    });

    test('should provide valid transition options', () => {
      const validation = statusManager.validateStatusTransition(
        'pending',
        'cancelled',
        'invalid-step'
      );

      expect(validation.isValid).toBe(false);
      expect(validation.validOptions).toContain('in-progress');
      expect(validation.validOptions).toContain('deferred');
    });
  });

  describe('Workflow Steps Tracking', () => {
    test('should get workflow steps for task', async () => {
      mockBackend.getTask.mockResolvedValue({
        id: '4',
        status: 'in-progress',
        details: 'Task details\n\nPR created: https://github.com/user/repo/pull/123\nMerged: def456'
      });

      const steps = await statusManager.getWorkflowStepsForTask('4');

      expect(steps).toContain('start-implementation');
      expect(steps).toContain('pr-created');
      expect(steps).toContain('merged');
    });

    test('should handle task not found', async () => {
      mockBackend.getTask.mockResolvedValue(null);

      await expect(statusManager.getWorkflowStepsForTask('nonexistent'))
        .rejects.toThrow('Task nonexistent not found');
    });

    test('should return empty steps for basic task', async () => {
      mockBackend.getTask.mockResolvedValue({
        id: '4',
        status: 'pending',
        details: 'Simple task'
      });

      const steps = await statusManager.getWorkflowStepsForTask('4');

      expect(steps).toHaveLength(0);
    });
  });

  describe('Metadata Management', () => {
    test('should update task with workflow metadata', async () => {
      const result = await statusManager.updateTaskWithMetadata('4', {
        branch: 'task-4',
        worktreePath: '/path/to/worktree',
        assignee: 'developer@example.com'
      });

      expect(mockBackend.updateTask).toHaveBeenCalledWith(
        '4',
        expect.stringContaining('Branch: task-4')
      );
    });

    test('should update subtask with structured progress', async () => {
      const result = await statusManager.updateSubtaskWithProgress('4.1', {
        phase: 'exploration',
        findings: 'Authentication flow analyzed',
        decisions: 'Will use JWT with refresh tokens',
        nextSteps: 'Implement token generation'
      });

      expect(mockBackend.updateSubtask).toHaveBeenCalledWith(
        '4.1',
        expect.stringContaining('## Implementation Progress')
      );
    });

    test('should format progress update with timestamp', async () => {
      const mockDate = new Date('2025-01-04T12:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      await statusManager.updateSubtaskWithProgress('4.1', {
        phase: 'implementation',
        findings: 'API endpoints created'
      });

      const updateCall = mockBackend.updateSubtask.mock.calls[0][1];
      expect(updateCall).toContain('2025-01-04');
      expect(updateCall).toContain('API endpoints created');

      jest.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    test('should handle backend failures gracefully', async () => {
      mockBackend.setTaskStatus.mockRejectedValue(new Error('Backend error'));

      await expect(statusManager.updateStatusForWorkflowStep(
        '4',
        'start-implementation'
      )).rejects.toThrow('Backend error');
    });

    test('should handle missing task data', async () => {
      mockBackend.getTask.mockResolvedValue(null);

      const steps = await statusManager.getWorkflowStepsForTask('missing');
      expect(steps).toHaveLength(0);
    });

    test('should validate required parameters', async () => {
      await expect(statusManager.updateStatusForWorkflowStep(
        null,
        'start-implementation'
      )).rejects.toThrow();

      await expect(statusManager.updateStatusForWorkflowStep(
        '4',
        null
      )).rejects.toThrow();
    });
  });

  describe('Integration Features', () => {
    test('should support batch status updates', async () => {
      const taskIds = ['4.1', '4.2', '4.3'];
      const results = await Promise.all(
        taskIds.map(id => statusManager.updateStatusForWorkflowStep(
          id,
          'complete-implementation'
        ))
      );

      results.forEach(result => {
        expect(result).toBeDefined();
      });

      expect(mockBackend.setTaskStatus).toHaveBeenCalledTimes(3);
    });

    test('should handle concurrent updates', async () => {
      const updates = [
        statusManager.updateStatusForWorkflowStep('4.1', 'start-implementation'),
        statusManager.updateStatusForWorkflowStep('4.2', 'commit-progress', { commitMessage: 'test' }),
        statusManager.updateStatusForWorkflowStep('4.3', 'complete-implementation')
      ];

      const results = await Promise.all(updates);
      
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    test('should support workflow rollback', async () => {
      const result = await statusManager.updateStatusForWorkflowStep(
        '4',
        'start-implementation',
        {
          rollback: true,
          previousStatus: 'pending'
        }
      );

      expect(result).toBeDefined();
      expect(mockBackend.setTaskStatus).toHaveBeenCalledWith('4', 'in-progress');
    });
  });
}); 