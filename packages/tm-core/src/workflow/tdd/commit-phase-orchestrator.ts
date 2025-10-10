/**
 * CommitPhaseOrchestrator - Coordinates the COMMIT phase of TDD cycle
 *
 * The COMMIT phase creates a git commit with the implemented changes.
 */

import type { SubtaskContext } from './red-phase-orchestrator.js';

export interface CommitPhaseResult {
  success: boolean;
  phase: 'COMMIT';
  commitHash?: string;
  filesStaged: string[];
  error?: string;
  timestamp: Date;
}

export class CommitPhaseOrchestrator {
  constructor(
    private gitAdapter: any,
    private commitGenerator: any
  ) {}

  async executeCommitPhase(
    subtaskContext: SubtaskContext,
    changedFiles: string[],
    testResults: any
  ): Promise<CommitPhaseResult> {
    try {
      if (changedFiles.length === 0) {
        return {
          success: false,
          phase: 'COMMIT',
          filesStaged: [],
          error: 'No files to commit',
          timestamp: new Date()
        };
      }

      // Generate commit message
      const message = this.commitGenerator.generateMessage({
        type: 'feat',
        description: subtaskContext.description,
        changedFiles,
        taskId: subtaskContext.taskId,
        phase: 'GREEN',
        testsPassing: testResults.passCount,
        testsFailing: testResults.failureCount
      });

      // Stage files
      await this.gitAdapter.stageFiles(changedFiles);

      // Create commit
      const commitResult = await this.gitAdapter.createCommit(message);

      return {
        success: true,
        phase: 'COMMIT',
        commitHash: commitResult.commitHash,
        filesStaged: changedFiles,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        phase: 'COMMIT',
        filesStaged: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }
}
