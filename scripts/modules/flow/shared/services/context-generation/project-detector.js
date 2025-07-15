/**
 * Project Detector - Detects git repositories and GitHub remotes in project root
 * 
 * This service determines if the current project root is a git repository
 * and provides information about remotes, branches, and sync status.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export class ProjectDetector {
  constructor(projectRoot) {
    this.projectRoot = path.resolve(projectRoot);
  }

  async detectProjectRepo() {
    // Check if projectRoot is already a git repository
    const gitStatus = await this.checkGitRepository();
    
    if (gitStatus.isGitRepo) {
      const repoInfo = await this.getRepositoryInfo();
      
      return {
        type: 'local-git',
        available: true,
        path: this.projectRoot,
        githubUrl: repoInfo.remoteUrl,
        branch: repoInfo.currentBranch,
        hasRemote: !!repoInfo.remoteUrl,
        isGitHub: this.isGitHubUrl(repoInfo.remoteUrl),
        needsSync: await this.needsSync(),
        astReady: true, // Can use AST immediately
        hasUncommittedChanges: repoInfo.hasUncommittedChanges
      };
    } else {
      return {
        type: 'no-git',
        available: false,
        path: this.projectRoot,
        suggestions: await this.suggestSetup()
      };
    }
  }

  async checkGitRepository() {
    const gitDir = path.join(this.projectRoot, '.git');
    
    if (!fs.existsSync(gitDir)) {
      return { isGitRepo: false };
    }
    
    try {
      // Verify it's a valid git repo
      await execAsync('git status', { cwd: this.projectRoot });
      return { isGitRepo: true };
    } catch (error) {
      return { isGitRepo: false, error: error.message };
    }
  }

  async getRepositoryInfo() {
    try {
      // Get remote URL
      let remoteUrl = null;
      try {
        const { stdout } = await execAsync(
          'git config --get remote.origin.url',
          { cwd: this.projectRoot }
        );
        remoteUrl = stdout.trim();
      } catch {
        // No remote configured
      }
      
      // Get current branch
      const { stdout: branch } = await execAsync(
        'git rev-parse --abbrev-ref HEAD',
        { cwd: this.projectRoot }
      );
      
      // Get repo status
      const { stdout: status } = await execAsync(
        'git status --porcelain',
        { cwd: this.projectRoot }
      );
      
      return {
        remoteUrl,
        currentBranch: branch.trim(),
        hasUncommittedChanges: !!status.trim(),
        path: this.projectRoot
      };
    } catch (error) {
      throw new Error(`Failed to get repository info: ${error.message}`);
    }
  }

  async needsSync() {
    if (!await this.hasRemote()) return false;
    
    try {
      // Fetch to check for updates (without actually updating local refs)
      await execAsync('git fetch --dry-run', { cwd: this.projectRoot });
      
      // Check if behind remote
      const { stdout } = await execAsync(
        'git rev-list HEAD...@{upstream} --count',
        { cwd: this.projectRoot }
      );
      
      return parseInt(stdout.trim()) > 0;
    } catch {
      return false;
    }
  }

  async hasRemote() {
    try {
      await execAsync('git remote get-url origin', { cwd: this.projectRoot });
      return true;
    } catch {
      return false;
    }
  }

  isGitHubUrl(url) {
    if (!url) return false;
    return url.includes('github.com');
  }

  async suggestSetup() {
    // Check if there are files that suggest this could be a project
    const hasPackageJson = fs.existsSync(path.join(this.projectRoot, 'package.json'));
    const hasReadme = fs.existsSync(path.join(this.projectRoot, 'README.md'));
    const hasGitignore = fs.existsSync(path.join(this.projectRoot, '.gitignore'));
    
    return {
      hasPackageJson,
      hasReadme,
      hasGitignore,
      looksLikeProject: hasPackageJson || hasReadme,
      suggestions: [
        'Initialize git: git init',
        'Add GitHub remote: git remote add origin <github-url>',
        'Or run: flow sync-project <github-url>'
      ]
    };
  }
} 