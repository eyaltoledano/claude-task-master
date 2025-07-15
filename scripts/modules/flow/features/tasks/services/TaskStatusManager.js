/**
 * TaskStatusManager - Systematic task status management following dev_workflow.mdc patterns
 *
 * Handles task status updates throughout the development workflow:
 * - Start implementation (pending -> in-progress)
 * - Progress logging (update subtask details)
 * - Implementation completion (in-progress -> done)
 * - PR creation (log PR URL)
 * - Merge completion (ensure status is done)
 */

import { flowLogger } from '../../../shared/logging/flow-logger.js';
import { DirectBackend } from '../../../infra/backends/direct-backend.js';

const logger = {
	info: (msg) => flowLogger.log('info', msg),
	error: (msg) => flowLogger.log('error', msg),
	debug: (msg) => flowLogger.log('debug', msg),
	success: (msg) => flowLogger.log('info', msg) // success maps to info
};

export class TaskStatusManager {
	constructor() {
		this.backend = new DirectBackend();
	}

	/**
	 * Update task status based on workflow step
	 * @param {string} taskId - Task ID (e.g., '4' or '4.1' for subtask)
	 * @param {string} step - Workflow step
	 * @param {Object} additionalInfo - Additional context information
	 * @returns {Promise<Object>} Update result
	 */
	async updateStatusForWorkflowStep(taskId, step, additionalInfo = {}) {
		try {
			console.log(
				`[TaskStatusManager] Updating status for ${taskId}, step: ${step}`
			);

			switch (step) {
				case 'start-implementation':
					return await this._handleStartImplementation(taskId, additionalInfo);

				case 'commit-progress':
					return await this._handleCommitProgress(taskId, additionalInfo);

				case 'complete-implementation':
					return await this._handleCompleteImplementation(
						taskId,
						additionalInfo
					);

				case 'pr-created':
					return await this._handlePRCreated(taskId, additionalInfo);

				case 'merged':
					return await this._handleMerged(taskId, additionalInfo);

				case 'subtask-progress':
					return await this._handleSubtaskProgress(taskId, additionalInfo);

				default:
					throw new Error(`Unknown workflow step: ${step}`);
			}
		} catch (error) {
			console.error(
				`[TaskStatusManager] Error updating status for ${taskId}:`,
				error
			);
			throw error;
		}
	}

	/**
	 * Validate that a status transition is valid
	 * @param {string} currentStatus - Current task status
	 * @param {string} newStatus - Proposed new status
	 * @param {string} step - Workflow step
	 * @returns {Object} Validation result
	 */
	validateStatusTransition(currentStatus, newStatus, step) {
		const validTransitions = {
			pending: ['in-progress', 'deferred', 'cancelled'],
			'in-progress': ['done', 'pending', 'review', 'deferred', 'cancelled'],
			review: ['done', 'in-progress', 'pending'],
			done: ['pending', 'in-progress'], // Allow reopening if needed
			deferred: ['pending', 'in-progress'],
			cancelled: ['pending']
		};

		const allowed = validTransitions[currentStatus] || [];
		const isValid = allowed.includes(newStatus);

		return {
			isValid,
			reason: isValid
				? null
				: `Invalid transition from ${currentStatus} to ${newStatus}`,
			step,
			validOptions: allowed
		};
	}

	/**
	 * Get workflow steps completed for a task
	 * @param {string} taskId - Task ID
	 * @returns {Promise<Array>} Array of completed workflow steps
	 */
	async getWorkflowStepsForTask(taskId) {
		try {
			const task = await this.backend.getTask(taskId);
			if (!task) {
				throw new Error(`Task ${taskId} not found`);
			}

			// Parse workflow steps from task details/history
			const steps = [];

			// Check current status
			if (task.status === 'in-progress') {
				steps.push('start-implementation');
			}
			if (task.status === 'done') {
				steps.push('complete-implementation');
			}

			// Parse details for workflow metadata
			if (task.details && task.details.includes('PR created:')) {
				steps.push('pr-created');
			}
			if (task.details && task.details.includes('Merged:')) {
				steps.push('merged');
			}

			return steps;
		} catch (error) {
			console.error(
				`[TaskStatusManager] Error getting workflow steps for ${taskId}:`,
				error
			);
			return [];
		}
	}

	/**
	 * Update subtask with progress information
	 * @param {string} subtaskId - Subtask ID (e.g., '4.1')
	 * @param {Object} progressInfo - Progress information
	 * @returns {Promise<Object>} Update result
	 */
	async updateSubtaskWithProgress(subtaskId, progressInfo) {
		try {
			const timestamp = new Date().toISOString();
			let progressEntry = `\n\n### Progress Update - ${timestamp}\n${progressInfo.message}`;

			if (progressInfo.findings) {
				progressEntry += `\n\n**Findings:**\n${progressInfo.findings}`;
			}
			if (progressInfo.decisions) {
				progressEntry += `\n\n**Decisions Made:**\n${progressInfo.decisions}`;
			}
			if (progressInfo.nextSteps) {
				progressEntry += `\n\n**Next Steps:**\n${progressInfo.nextSteps}`;
			}

			return await this.backend.updateSubtask(subtaskId, progressEntry);
		} catch (error) {
			console.error(
				`[TaskStatusManager] Error updating subtask progress for ${subtaskId}:`,
				error
			);
			throw error;
		}
	}

	/**
	 * Update task with workflow metadata
	 * @param {string} taskId - Task ID
	 * @param {Object} metadata - Workflow metadata
	 * @returns {Promise<Object>} Update result
	 */
	async updateTaskWithMetadata(taskId, metadata) {
		try {
			const timestamp = new Date().toISOString();
			let updateMessage = `\n\n### Workflow Update - ${timestamp}\n`;

			if (metadata.prUrl) {
				updateMessage += `**PR Created:** ${metadata.prUrl}\n`;
			}
			if (metadata.commitHash) {
				updateMessage += `**Commit:** ${metadata.commitHash}\n`;
			}
			if (metadata.branch) {
				updateMessage += `**Branch:** ${metadata.branch}\n`;
			}
			if (metadata.mergeDetails) {
				updateMessage += `**Merge Details:** ${metadata.mergeDetails}\n`;
			}

			return await this.backend.updateTask(taskId, updateMessage);
		} catch (error) {
			console.error(
				`[TaskStatusManager] Error updating task metadata for ${taskId}:`,
				error
			);
			throw error;
		}
	}

	// Private helper methods for handling specific workflow steps

	async _handleStartImplementation(taskId, additionalInfo) {
		const result = await this.backend.setTaskStatus(taskId, 'in-progress');

		if (additionalInfo.worktree) {
			await this.updateTaskWithMetadata(taskId, {
				branch: additionalInfo.worktree.branch,
				worktreePath: additionalInfo.worktree.path
			});
		}

		return result;
	}

	async _handleCommitProgress(taskId, additionalInfo) {
		const progressInfo = {
			message: `Progress committed: ${additionalInfo.commitMessage}`,
			findings: additionalInfo.findings,
			decisions: additionalInfo.decisions
		};

		if (taskId.includes('.')) {
			// This is a subtask
			return await this.updateSubtaskWithProgress(taskId, progressInfo);
		} else {
			// This is a main task
			return await this.updateTaskWithMetadata(taskId, {
				commitHash: additionalInfo.commitHash,
				commitMessage: additionalInfo.commitMessage
			});
		}
	}

	async _handleCompleteImplementation(taskId, additionalInfo) {
		await this.backend.setTaskStatus(taskId, 'done');

		const completionInfo = {
			message: 'Implementation completed',
			summary: additionalInfo.summary || 'Task implementation finished',
			testingStatus: additionalInfo.testingStatus || 'Tests completed'
		};

		if (taskId.includes('.')) {
			return await this.updateSubtaskWithProgress(taskId, completionInfo);
		} else {
			return await this.updateTaskWithMetadata(taskId, {
				completionTime: new Date().toISOString(),
				summary: additionalInfo.summary
			});
		}
	}

	async _handlePRCreated(taskId, additionalInfo) {
		const metadata = {
			prUrl: additionalInfo.prUrl,
			branch: additionalInfo.branch,
			commitHash: additionalInfo.commitHash
		};

		return await this.updateTaskWithMetadata(taskId, metadata);
	}

	async _handleMerged(taskId, additionalInfo) {
		await this.backend.setTaskStatus(taskId, 'done');

		const metadata = {
			mergeDetails: `Merged ${additionalInfo.branch} to ${additionalInfo.targetBranch || 'main'}`,
			mergeTime: new Date().toISOString(),
			mergeType: additionalInfo.mergeType || 'local'
		};

		return await this.updateTaskWithMetadata(taskId, metadata);
	}

	async _handleSubtaskProgress(taskId, additionalInfo) {
		const progressInfo = {
			message: additionalInfo.message || 'Subtask progress update',
			findings: additionalInfo.findings,
			implementation: additionalInfo.implementation,
			challenges: additionalInfo.challenges,
			nextSteps: additionalInfo.nextSteps
		};

		return await this.updateSubtaskWithProgress(taskId, progressInfo);
	}
}
