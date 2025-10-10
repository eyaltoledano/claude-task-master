import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommitPhaseOrchestrator } from './commit-phase-orchestrator.js';

describe('CommitPhaseOrchestrator', () => {
  let orchestrator: CommitPhaseOrchestrator;
  let mockGitAdapter: any;
  let mockCommitGenerator: any;

  beforeEach(() => {
    mockGitAdapter = {
      stageFiles: vi.fn(),
      createCommit: vi.fn()
    };

    mockCommitGenerator = {
      generateMessage: vi.fn()
    };

    orchestrator = new CommitPhaseOrchestrator(mockGitAdapter, mockCommitGenerator);
  });

  describe('executeCommitPhase', () => {
    it('should execute COMMIT phase successfully', async () => {
      const subtaskContext = {
        taskId: '6.3',
        subtaskId: '6.3.1',
        description: 'Test COMMIT phase'
      };

      const changedFiles = ['src/feature.ts', 'src/feature.test.ts'];
      const testResults = { passCount: 5, failureCount: 0 };

      mockCommitGenerator.generateMessage.mockReturnValue('feat(core): add feature');
      mockGitAdapter.stageFiles.mockResolvedValue({ success: true });
      mockGitAdapter.createCommit.mockResolvedValue({ success: true, commitHash: 'abc123' });

      const result = await orchestrator.executeCommitPhase(
        subtaskContext,
        changedFiles,
        testResults
      );

      expect(result.success).toBe(true);
      expect(result.phase).toBe('COMMIT');
      expect(result.commitHash).toBe('abc123');
      expect(mockGitAdapter.stageFiles).toHaveBeenCalledWith(changedFiles);
      expect(mockGitAdapter.createCommit).toHaveBeenCalled();
    });

    it('should handle empty changed files', async () => {
      const subtaskContext = {
        taskId: '6.3',
        subtaskId: '6.3.1',
        description: 'Test COMMIT phase'
      };

      const result = await orchestrator.executeCommitPhase(subtaskContext, [], {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('No files to commit');
    });

    it('should handle git staging errors', async () => {
      const subtaskContext = {
        taskId: '6.3',
        subtaskId: '6.3.1',
        description: 'Test COMMIT phase'
      };

      mockCommitGenerator.generateMessage.mockReturnValue('commit message');
      mockGitAdapter.stageFiles.mockRejectedValue(new Error('Staging failed'));

      const result = await orchestrator.executeCommitPhase(
        subtaskContext,
        ['file.ts'],
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Staging failed');
    });
  });
});
