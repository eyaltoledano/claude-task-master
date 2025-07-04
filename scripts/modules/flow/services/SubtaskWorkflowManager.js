/**
 * SubtaskWorkflowManager Service
 * 
 * Coordinates subtask status changes with git workflow and progress logging.
 * Integrates Phase 1 git workflow with Phase 2 progress logging.
 */

import { ImplementationLogger } from './ImplementationLogger.js';

export class SubtaskWorkflowManager {
	constructor(backend, gitWorkflowManager = null) {
		this.backend = backend;
		this.gitWorkflowManager = gitWorkflowManager;
		this.implementationLogger = new ImplementationLogger(backend);
	}

	/**
	 * Start subtask implementation with proper workflow
	 * @param {string} subtaskId - Subtask ID (e.g., "1.2")
	 * @param {string} worktreePath - Optional worktree path for git integration
	 * @param {Object} options - Additional options
	 * @returns {Promise<Object>} Workflow result
	 */
	async startSubtaskImplementation(subtaskId, worktreePath = null, options = {}) {
		try {
			// 1. Get current subtask state
			const progressResult = await this.backend.getSubtaskProgress(subtaskId);
			if (!progressResult.success) {
				return {
					success: false,
					error: 'Failed to get subtask progress'
				};
			}

			const { subtask, progress, phase } = progressResult.data;

			// 2. Check if exploration is needed
			if (phase === 'needs-exploration') {
				return {
					success: false,
					reason: 'exploration-needed',
					message: 'Subtask needs exploration phase before implementation can begin',
					suggestedAction: 'Start exploration and planning'
				};
			}

			// 3. Set status to in-progress
			const statusResult = await this.backend.setSubtaskStatus(subtaskId, 'in-progress');
			if (!statusResult.success) {
				return {
					success: false,
					error: 'Failed to set subtask status to in-progress'
				};
			}

			// 4. Log implementation start
			await this.implementationLogger.logImplementationProgress(subtaskId, {
				whatWorked: ['Implementation started'],
				whatDidntWork: [],
				codeChanges: [],
				decisions: [`Started working on subtask ${subtaskId}`],
				nextSteps: ['Begin code implementation']
			});

			// 5. Check git status if worktree provided
			let gitStatus = null;
			if (worktreePath && this.gitWorkflowManager) {
				gitStatus = await this.gitWorkflowManager.getGitStatus(worktreePath);
			}

			return {
				success: true,
				data: {
					subtask,
					phase: 'starting-implementation',
					gitStatus,
					message: 'Subtask implementation started successfully'
				}
			};
		} catch (error) {
			console.error('Error starting subtask implementation:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Complete subtask implementation with proper workflow
	 * @param {string} subtaskId - Subtask ID
	 * @param {string} worktreePath - Optional worktree path for git integration
	 * @param {Object} completionSummary - Completion summary data
	 * @returns {Promise<Object>} Workflow result
	 */
	async completeSubtaskImplementation(subtaskId, worktreePath = null, completionSummary = {}) {
		try {
			// 1. Log completion details
			const completionResult = await this.implementationLogger.logCompletion(
				subtaskId, 
				completionSummary
			);

			if (!completionResult.success) {
				console.warn('Failed to log completion details:', completionResult.error);
			}

			// 2. Commit changes if in worktree
			if (worktreePath && this.gitWorkflowManager) {
				try {
					await this.gitWorkflowManager.commitSubtaskProgress(
						worktreePath,
						subtaskId,
						`Complete subtask ${subtaskId} implementation`,
						{ 
							includeDetails: true,
							completionSummary 
						}
					);
				} catch (gitError) {
					console.warn('Git commit failed:', gitError.message);
					// Continue with status update even if git commit fails
				}
			}

			// 3. Set status to done
			const statusResult = await this.backend.setSubtaskStatus(subtaskId, 'done');
			if (!statusResult.success) {
				return {
					success: false,
					error: 'Failed to set subtask status to done'
				};
			}

			return {
				success: true,
				data: {
					subtaskId,
					phase: 'completed',
					message: 'Subtask implementation completed successfully'
				}
			};
		} catch (error) {
			console.error('Error completing subtask implementation:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Log subtask progress without changing status
	 * @param {string} subtaskId - Subtask ID
	 * @param {Object} progressUpdate - Progress update data
	 * @returns {Promise<Object>} Update result
	 */
	async logSubtaskProgress(subtaskId, progressUpdate) {
		return await this.implementationLogger.logImplementationProgress(
			subtaskId, 
			progressUpdate
		);
	}

	/**
	 * Log exploration phase for subtask
	 * @param {string} subtaskId - Subtask ID
	 * @param {Object} explorationFindings - Exploration findings
	 * @returns {Promise<Object>} Update result
	 */
	async logExplorationPhase(subtaskId, explorationFindings) {
		return await this.implementationLogger.logExplorationPhase(
			subtaskId,
			explorationFindings
		);
	}

	/**
	 * Quick progress update with simple message
	 * @param {string} subtaskId - Subtask ID
	 * @param {string} message - Progress message
	 * @returns {Promise<Object>} Update result
	 */
	async logQuickProgress(subtaskId, message) {
		return await this.implementationLogger.logQuickProgress(subtaskId, message);
	}

	/**
	 * Get subtask workflow status and suggested next action
	 * @param {string} subtaskId - Subtask ID
	 * @returns {Promise<Object>} Workflow status
	 */
	async getSubtaskWorkflowStatus(subtaskId) {
		try {
			const progressResult = await this.backend.getSubtaskProgress(subtaskId);
			if (!progressResult.success) {
				return {
					success: false,
					error: 'Failed to get subtask progress'
				};
			}

			const { subtask, progress, phase } = progressResult.data;
			const suggestedAction = this.implementationLogger.getSuggestedNextAction(subtask);

			return {
				success: true,
				data: {
					subtask,
					progress,
					phase,
					suggestedAction,
					workflowState: this.determineWorkflowState(subtask, progress)
				}
			};
		} catch (error) {
			console.error('Error getting subtask workflow status:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Transition subtask to next logical workflow state
	 * @param {string} subtaskId - Subtask ID
	 * @param {string} worktreePath - Optional worktree path
	 * @param {Object} transitionData - Data for the transition
	 * @returns {Promise<Object>} Transition result
	 */
	async transitionSubtaskWorkflow(subtaskId, worktreePath = null, transitionData = {}) {
		const statusResult = await this.getSubtaskWorkflowStatus(subtaskId);
		if (!statusResult.success) {
			return statusResult;
		}

		const { phase, suggestedAction } = statusResult.data;

		switch (suggestedAction.action) {
			case 'explore':
				if (transitionData.explorationFindings) {
					return await this.logExplorationPhase(subtaskId, transitionData.explorationFindings);
				}
				return {
					success: false,
					reason: 'exploration-data-needed',
					message: 'Exploration findings required to proceed'
				};

			case 'start-implementation':
				return await this.startSubtaskImplementation(subtaskId, worktreePath);

			case 'log-initial-progress':
			case 'continue-progress':
				if (transitionData.progressUpdate) {
					return await this.logSubtaskProgress(subtaskId, transitionData.progressUpdate);
				}
				return {
					success: false,
					reason: 'progress-data-needed',
					message: 'Progress update data required'
				};

			case 'log-completion':
				return await this.completeSubtaskImplementation(
					subtaskId, 
					worktreePath, 
					transitionData.completionSummary || {}
				);

			default:
				return {
					success: false,
					reason: 'unknown-transition',
					message: `Unknown workflow transition: ${suggestedAction.action}`
				};
		}
	}

	/**
	 * Determine overall workflow state
	 * @param {Object} subtask - Subtask object
	 * @param {Object} progress - Progress information
	 * @returns {Object} Workflow state
	 */
	determineWorkflowState(subtask, progress) {
		const { status } = subtask;
		const journey = this.implementationLogger.parseImplementationJourney(subtask.details || '');

		return {
			status,
			hasExploration: journey.hasExploration,
			hasProgress: journey.hasProgress,
			hasCompletion: journey.hasCompletion,
			progressEntries: journey.progressEntries.length,
			lastUpdate: journey.timestamps.length > 0 ? 
				Math.max(...journey.timestamps.map(t => t.getTime())) : null,
			isComplete: status === 'done' && journey.hasCompletion,
			readyForImplementation: journey.hasExploration && status === 'pending',
			needsDocumentation: status === 'done' && !journey.hasCompletion
		};
	}

	/**
	 * Create progress template for a specific phase
	 * @param {string} phase - Implementation phase
	 * @returns {Object} Progress template
	 */
	createProgressTemplate(phase) {
		return this.implementationLogger.createProgressTemplate(phase);
	}

	/**
	 * Validate workflow transition
	 * @param {string} fromPhase - Current phase
	 * @param {string} toPhase - Target phase
	 * @param {Object} subtask - Subtask object
	 * @returns {Object} Validation result
	 */
	validateWorkflowTransition(fromPhase, toPhase, subtask) {
		const validTransitions = {
			'needs-exploration': ['exploration', 'ready-to-implement'],
			'ready-to-implement': ['starting-implementation'],
			'starting-implementation': ['implementing'],
			'implementing': ['implementing', 'completed'],
			'completed': ['review-complete']
		};

		const allowed = validTransitions[fromPhase] || [];
		const isValid = allowed.includes(toPhase);

		return {
			valid: isValid,
			message: isValid ? 
				`Transition from ${fromPhase} to ${toPhase} is valid` :
				`Invalid transition from ${fromPhase} to ${toPhase}. Allowed: ${allowed.join(', ')}`
		};
	}
} 