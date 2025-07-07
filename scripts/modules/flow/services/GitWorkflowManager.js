/**
 * Git Workflow Manager for Task Master Flow
 * Handles systematic git operations following dev_workflow.mdc patterns
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export class GitWorkflowManager {
	constructor(projectRoot, options = {}) {
		this.projectRoot = projectRoot;
		this.options = {
			defaultCommitType: 'feat',
			includeFileStats: true,
			validateBeforeCommit: true,
			...options
		};
	}

	/**
	 * Validate if worktree is ready for commit operations
	 * @param {string} worktreePath - Path to the worktree
	 * @returns {Promise<Object>} Validation result with git status
	 */
	async validateCommitReadiness(worktreePath) {
		try {
			const gitStatus = await this.getGitStatus(worktreePath);

			return {
				ready: true,
				gitStatus,
				hasUncommittedChanges: gitStatus.hasChanges,
				hasUntrackedFiles: gitStatus.untrackedFiles.length > 0,
				hasStagedChanges: gitStatus.stagedFiles.length > 0,
				canCommit: gitStatus.hasChanges || gitStatus.untrackedFiles.length > 0
			};
		} catch (error) {
			return {
				ready: false,
				error: error.message,
				hasUncommittedChanges: false,
				hasUntrackedFiles: false,
				hasStagedChanges: false,
				canCommit: false
			};
		}
	}

	/**
	 * Get detailed git status for a worktree
	 * @param {string} worktreePath - Path to the worktree
	 * @returns {Promise<Object>} Detailed git status information
	 */
	async getGitStatus(worktreePath) {
		try {
			// Get porcelain status for parsing
			const statusOutput = execSync('git status --porcelain', {
				cwd: worktreePath,
				encoding: 'utf8'
			});

			// Get branch information
			const branchOutput = execSync('git branch --show-current', {
				cwd: worktreePath,
				encoding: 'utf8'
			}).trim();

			// Parse status output
			const lines = statusOutput
				.trim()
				.split('\n')
				.filter((line) => line.trim());
			const stagedFiles = [];
			const modifiedFiles = [];
			const untrackedFiles = [];

			lines.forEach((line) => {
				const status = line.substring(0, 2);
				const file = line.substring(3);

				if (status[0] !== ' ' && status[0] !== '?') {
					stagedFiles.push({ file, status: status[0] });
				}
				if (status[1] !== ' ' && status[1] !== '?') {
					modifiedFiles.push({ file, status: status[1] });
				}
				if (status === '??') {
					untrackedFiles.push(file);
				}
			});

			// Get commit count
			let commitCount = 0;
			try {
				const countOutput = execSync('git rev-list --count HEAD', {
					cwd: worktreePath,
					encoding: 'utf8'
				});
				commitCount = parseInt(countOutput.trim(), 10);
			} catch {
				// No commits yet
			}

			return {
				currentBranch: branchOutput,
				hasChanges: lines.length > 0,
				stagedFiles,
				modifiedFiles,
				untrackedFiles,
				totalFiles: lines.length,
				commitCount,
				isClean: lines.length === 0
			};
		} catch (error) {
			throw new Error(`Failed to get git status: ${error.message}`);
		}
	}

	/**
	 * Commit subtask progress with proper formatting
	 * @param {string} worktreePath - Path to the worktree
	 * @param {Object} subtaskInfo - Subtask information
	 * @param {Object} options - Commit options
	 * @returns {Promise<Object>} Commit result
	 */
	async commitSubtaskProgress(worktreePath, subtaskInfo, options = {}) {
		try {
			const {
				customMessage,
				includeDetails = true,
				stageAll = true,
				commitType = 'feat'
			} = options;

			// Validate readiness
			const readiness = await this.validateCommitReadiness(worktreePath);
			if (!readiness.canCommit) {
				return {
					success: false,
					reason: 'no-changes',
					message: 'No changes to commit'
				};
			}

			// Stage files if requested
			if (stageAll) {
				execSync('git add -A', { cwd: worktreePath, stdio: 'pipe' });
			}

			// Generate commit message
			const commitMessage = this.generateCommitMessage(
				commitType,
				subtaskInfo,
				customMessage,
				includeDetails
			);

			// Create commit
			execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
				cwd: worktreePath,
				stdio: 'pipe'
			});

			// Get commit hash
			const commitHash = execSync('git rev-parse HEAD', {
				cwd: worktreePath,
				encoding: 'utf8'
			}).trim();

			return {
				success: true,
				commitHash,
				commitMessage,
				branch: readiness.gitStatus.currentBranch,
				filesChanged: readiness.gitStatus.totalFiles
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Commit tests separately following dev_workflow.mdc pattern
	 * @param {string} worktreePath - Path to the worktree
	 * @param {Object} taskInfo - Task information
	 * @param {Object} testDetails - Test details
	 * @returns {Promise<Object>} Commit result
	 */
	async commitTestsForTask(worktreePath, taskInfo, testDetails = {}) {
		try {
			// Check if there are test files to commit
			const gitStatus = await this.getGitStatus(worktreePath);
			const testFiles = [
				...gitStatus.stagedFiles,
				...gitStatus.modifiedFiles,
				...gitStatus.untrackedFiles
			].filter((item) => {
				const file = typeof item === 'string' ? item : item.file;
				return (
					file.includes('test') ||
					file.includes('spec') ||
					file.endsWith('.test.js') ||
					file.endsWith('.spec.js')
				);
			});

			if (testFiles.length === 0) {
				return {
					success: false,
					reason: 'no-test-files',
					message: 'No test files found to commit'
				};
			}

			// Stage test files specifically
			for (const testFile of testFiles) {
				const file = typeof testFile === 'string' ? testFile : testFile.file;
				execSync(`git add "${file}"`, { cwd: worktreePath, stdio: 'pipe' });
			}

			// Generate test commit message
			const testCommitMessage = this.generateTestCommitMessage(
				taskInfo,
				testDetails
			);

			// Create test commit
			execSync(`git commit -m "${testCommitMessage.replace(/"/g, '\\"')}"`, {
				cwd: worktreePath,
				stdio: 'pipe'
			});

			// Get commit hash
			const commitHash = execSync('git rev-parse HEAD', {
				cwd: worktreePath,
				encoding: 'utf8'
			}).trim();

			return {
				success: true,
				commitHash,
				commitMessage: testCommitMessage,
				testFiles: testFiles.map((f) => (typeof f === 'string' ? f : f.file)),
				filesChanged: testFiles.length
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Generate proper commit message following dev_workflow.mdc patterns
	 * @param {string} type - Commit type (feat, fix, test, etc.)
	 * @param {Object} taskInfo - Task/subtask information
	 * @param {string} customMessage - Custom message override
	 * @param {boolean} includeDetails - Include detailed information
	 * @returns {string} Formatted commit message
	 */
	generateCommitMessage(type, taskInfo, customMessage, includeDetails = true) {
		const { id, title, parentId, details } = taskInfo;

		// Determine if this is a subtask
		const isSubtask = parentId || id.toString().includes('.');
		const taskId = isSubtask ? parentId || id.split('.')[0] : id;
		const fullId = isSubtask ? id : id;

		// Build commit title
		let commitTitle;
		if (customMessage) {
			commitTitle = `${type}(task-${taskId}): ${customMessage}`;
		} else if (isSubtask) {
			commitTitle = `${type}(task-${taskId}): Complete subtask ${fullId} - ${title}`;
		} else {
			commitTitle = `${type}(task-${taskId}): ${title}`;
		}

		if (!includeDetails) {
			return commitTitle;
		}

		// Build commit body
		const bodyParts = [];

		// Add implementation details if available
		if (details) {
			const detailLines = details.split('\n').slice(0, 3); // First 3 lines
			bodyParts.push('- ' + detailLines.join('\n- '));
		}

		// Add task reference
		if (isSubtask) {
			bodyParts.push(`\nSubtask ${fullId}: ${title}`);
			if (parentId) {
				bodyParts.push(`Relates to Task ${taskId}`);
			}
		} else {
			bodyParts.push(`\nTask ${fullId}: ${title}`);
		}

		return bodyParts.length > 0
			? `${commitTitle}\n\n${bodyParts.join('\n')}`
			: commitTitle;
	}

	/**
	 * Generate test commit message
	 * @param {Object} taskInfo - Task information
	 * @param {Object} testDetails - Test details
	 * @returns {string} Test commit message
	 */
	generateTestCommitMessage(taskInfo, testDetails) {
		const { id, title } = taskInfo;
		const taskId = id.toString().includes('.') ? id.split('.')[0] : id;

		let message = `test(task-${taskId}): Add comprehensive tests for Task ${id}`;

		if (testDetails.description) {
			message += `\n\n${testDetails.description}`;
		}

		const testTypes = [];
		if (testDetails.unitTests)
			testTypes.push('Unit tests for core functionality');
		if (testDetails.integrationTests)
			testTypes.push('Integration tests for API endpoints');
		if (testDetails.e2eTests)
			testTypes.push('End-to-end tests for user workflows');

		if (testTypes.length > 0) {
			message += `\n\n- ${testTypes.join('\n- ')}`;
		}

		if (testDetails.coverage) {
			message += `\n- Test coverage: ${testDetails.coverage}`;
		}

		message += `\n\nTask ${id}: ${title} - Testing complete`;

		return message;
	}

	/**
	 * Check if there are uncommitted changes in worktree
	 * @param {string} worktreePath - Path to the worktree
	 * @returns {Promise<boolean>} True if there are uncommitted changes
	 */
	async hasUncommittedChanges(worktreePath) {
		try {
			const gitStatus = await this.getGitStatus(worktreePath);
			return gitStatus.hasChanges;
		} catch {
			return false;
		}
	}

	/**
	 * Get commit history for worktree
	 * @param {string} worktreePath - Path to the worktree
	 * @param {number} limit - Number of commits to retrieve
	 * @returns {Promise<Array>} Array of commit information
	 */
	async getCommitHistory(worktreePath, limit = 10) {
		try {
			const output = execSync(
				`git log --oneline -${limit} --pretty=format:"%h|%s|%an|%ad" --date=short`,
				{
					cwd: worktreePath,
					encoding: 'utf8'
				}
			);

			return output
				.trim()
				.split('\n')
				.map((line) => {
					const [hash, subject, author, date] = line.split('|');
					return { hash, subject, author, date };
				});
		} catch (error) {
			return [];
		}
	}

	/**
	 * Validate git repository state
	 * @param {string} worktreePath - Path to the worktree
	 * @returns {Promise<Object>} Repository state validation
	 */
	async validateRepositoryState(worktreePath) {
		try {
			// Check if it's a git repository
			execSync('git rev-parse --git-dir', {
				cwd: worktreePath,
				stdio: 'ignore'
			});

			// Check if there are any commits
			let hasCommits = true;
			try {
				execSync('git rev-parse HEAD', { cwd: worktreePath, stdio: 'ignore' });
			} catch {
				hasCommits = false;
			}

			// Check current branch
			const currentBranch = execSync('git branch --show-current', {
				cwd: worktreePath,
				encoding: 'utf8'
			}).trim();

			return {
				isGitRepo: true,
				hasCommits,
				currentBranch,
				valid: true
			};
		} catch (error) {
			return {
				isGitRepo: false,
				hasCommits: false,
				currentBranch: null,
				valid: false,
				error: error.message
			};
		}
	}
}
