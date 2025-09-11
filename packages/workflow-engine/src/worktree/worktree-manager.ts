/**
 * @fileoverview Worktree Manager
 * Manages git worktree lifecycle for task execution
 */

import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { WorktreeInfo } from '../types/workflow.types.js';
import { WorktreeError } from '../errors/workflow.errors.js';

export interface WorktreeManagerConfig {
  /** Base directory for all worktrees */
  worktreeBase: string;
  /** Project root directory */
  projectRoot: string;
  /** Auto-cleanup on process exit */
  autoCleanup: boolean;
}

/**
 * WorktreeManager handles git worktree operations
 * Single responsibility: Git worktree lifecycle management
 */
export class WorktreeManager {
  private config: WorktreeManagerConfig;
  private activeWorktrees = new Map<string, WorktreeInfo>();

  constructor(config: WorktreeManagerConfig) {
    this.config = config;
    
    if (config.autoCleanup) {
      this.setupCleanupHandlers();
    }
  }

  /**
   * Create a new worktree for task execution
   */
  async createWorktree(taskId: string, branchName?: string): Promise<WorktreeInfo> {
    const sanitizedTaskId = this.sanitizeTaskId(taskId);
    const worktreePath = path.join(this.config.worktreeBase, `task-${sanitizedTaskId}`);
    
    // Ensure base directory exists
    await fs.mkdir(this.config.worktreeBase, { recursive: true });

    // Generate unique branch name if not provided
    const branch = branchName || `task/${sanitizedTaskId}-${Date.now()}`;

    try {
      // Check if worktree path already exists
      if (await this.pathExists(worktreePath)) {
        throw new WorktreeError(`Worktree path already exists: ${worktreePath}`);
      }

      // Create the worktree
      await this.executeGitCommand(['worktree', 'add', '-b', branch, worktreePath], {
        cwd: this.config.projectRoot
      });

      const worktreeInfo: WorktreeInfo = {
        path: worktreePath,
        branch,
        createdAt: new Date(),
        taskId,
        locked: false
      };

      // Get commit hash
      try {
        const commit = await this.executeGitCommand(['rev-parse', 'HEAD'], {
          cwd: worktreePath
        });
        worktreeInfo.commit = commit.trim();
      } catch (error) {
        console.warn('Failed to get commit hash for worktree:', error);
      }

      this.activeWorktrees.set(taskId, worktreeInfo);
      return worktreeInfo;

    } catch (error) {
      throw new WorktreeError(
        `Failed to create worktree for task ${taskId}`,
        worktreePath,
        error as Error
      );
    }
  }

  /**
   * Remove a worktree and clean up
   */
  async removeWorktree(taskId: string, force = false): Promise<void> {
    const worktreeInfo = this.activeWorktrees.get(taskId);
    if (!worktreeInfo) {
      throw new WorktreeError(`No active worktree found for task ${taskId}`);
    }

    try {
      // Remove the worktree
      const args = ['worktree', 'remove', worktreeInfo.path];
      if (force) {
        args.push('--force');
      }

      await this.executeGitCommand(args, {
        cwd: this.config.projectRoot
      });

      // Remove branch if it's a task-specific branch
      if (worktreeInfo.branch.startsWith('task/')) {
        try {
          await this.executeGitCommand(['branch', '-D', worktreeInfo.branch], {
            cwd: this.config.projectRoot
          });
        } catch (error) {
          console.warn(`Failed to delete branch ${worktreeInfo.branch}:`, error);
        }
      }

      this.activeWorktrees.delete(taskId);

    } catch (error) {
      throw new WorktreeError(
        `Failed to remove worktree for task ${taskId}`,
        worktreeInfo.path,
        error as Error
      );
    }
  }

  /**
   * List all active worktrees for this project
   */
  async listWorktrees(): Promise<WorktreeInfo[]> {
    try {
      const output = await this.executeGitCommand(['worktree', 'list', '--porcelain'], {
        cwd: this.config.projectRoot
      });

      const worktrees: WorktreeInfo[] = [];
      const lines = output.trim().split('\n');
      
      let currentWorktree: Partial<WorktreeInfo> = {};
      
      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          if (currentWorktree.path) {
            // Complete previous worktree
            worktrees.push(this.completeWorktreeInfo(currentWorktree));
          }
          currentWorktree = { path: line.substring(9) };
        } else if (line.startsWith('HEAD ')) {
          currentWorktree.commit = line.substring(5);
        } else if (line.startsWith('branch ')) {
          currentWorktree.branch = line.substring(7).replace('refs/heads/', '');
        } else if (line === 'locked') {
          currentWorktree.locked = true;
        } else if (line.startsWith('locked ')) {
          currentWorktree.locked = true;
          currentWorktree.lockReason = line.substring(7);
        }
      }

      // Add the last worktree
      if (currentWorktree.path) {
        worktrees.push(this.completeWorktreeInfo(currentWorktree));
      }

      // Filter to only our task worktrees
      return worktrees.filter(wt => 
        wt.path.startsWith(this.config.worktreeBase) &&
        wt.branch?.startsWith('task/')
      );

    } catch (error) {
      throw new WorktreeError('Failed to list worktrees', undefined, error as Error);
    }
  }

  /**
   * Get worktree info for a specific task
   */
  getWorktreeInfo(taskId: string): WorktreeInfo | undefined {
    return this.activeWorktrees.get(taskId);
  }

  /**
   * Lock a worktree to prevent cleanup
   */
  async lockWorktree(taskId: string, reason?: string): Promise<void> {
    const worktreeInfo = this.activeWorktrees.get(taskId);
    if (!worktreeInfo) {
      throw new WorktreeError(`No active worktree found for task ${taskId}`);
    }

    try {
      const args = ['worktree', 'lock', worktreeInfo.path];
      if (reason) {
        args.push('--reason', reason);
      }

      await this.executeGitCommand(args, {
        cwd: this.config.projectRoot
      });

      worktreeInfo.locked = true;
      worktreeInfo.lockReason = reason;

    } catch (error) {
      throw new WorktreeError(
        `Failed to lock worktree for task ${taskId}`,
        worktreeInfo.path,
        error as Error
      );
    }
  }

  /**
   * Unlock a worktree
   */
  async unlockWorktree(taskId: string): Promise<void> {
    const worktreeInfo = this.activeWorktrees.get(taskId);
    if (!worktreeInfo) {
      throw new WorktreeError(`No active worktree found for task ${taskId}`);
    }

    try {
      await this.executeGitCommand(['worktree', 'unlock', worktreeInfo.path], {
        cwd: this.config.projectRoot
      });

      worktreeInfo.locked = false;
      delete worktreeInfo.lockReason;

    } catch (error) {
      throw new WorktreeError(
        `Failed to unlock worktree for task ${taskId}`,
        worktreeInfo.path,
        error as Error
      );
    }
  }

  /**
   * Clean up all task-related worktrees
   */
  async cleanupAll(force = false): Promise<void> {
    const worktrees = await this.listWorktrees();
    
    for (const worktree of worktrees) {
      if (worktree.taskId) {
        try {
          await this.removeWorktree(worktree.taskId, force);
        } catch (error) {
          console.error(`Failed to cleanup worktree for task ${worktree.taskId}:`, error);
        }
      }
    }
  }

  /**
   * Execute git command and return output
   */
  private async executeGitCommand(
    args: string[], 
    options: { cwd: string }
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, {
        cwd: options.cwd,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      git.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Git command failed (${code}): ${stderr || stdout}`));
        }
      });

      git.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Sanitize task ID for use in filesystem paths
   */
  private sanitizeTaskId(taskId: string): string {
    return taskId.replace(/[^a-zA-Z0-9.-]/g, '-');
  }

  /**
   * Check if path exists
   */
  private async pathExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Complete worktree info with defaults
   */
  private completeWorktreeInfo(partial: Partial<WorktreeInfo>): WorktreeInfo {
    const branch = partial.branch || 'unknown';
    const taskIdMatch = branch.match(/^task\/(.+?)-/);
    
    return {
      path: partial.path || '',
      branch,
      createdAt: partial.createdAt || new Date(),
      taskId: taskIdMatch?.[1] || partial.taskId || 'unknown',
      commit: partial.commit,
      locked: partial.locked || false,
      lockReason: partial.lockReason
    };
  }

  /**
   * Setup cleanup handlers for graceful shutdown
   */
  private setupCleanupHandlers(): void {
    const cleanup = () => {
      console.log('Cleaning up worktrees...');
      this.cleanupAll(true).catch(console.error);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
  }
}