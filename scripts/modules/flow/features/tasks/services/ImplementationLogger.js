/**
 * ImplementationLogger Service
 *
 * Centralized service for managing implementation journey tracking with structured logging patterns.
 * Follows the dev_workflow.mdc patterns for iterative subtask implementation.
 */

export class ImplementationLogger {
	constructor(backend) {
		this.backend = backend;
	}

	/**
	 * Log exploration phase findings
	 * @param {string} subtaskId - Subtask ID (e.g., "1.2")
	 * @param {Object} explorationFindings - Exploration findings object
	 * @returns {Promise<Object>} Update result
	 */
	async logExplorationPhase(subtaskId, explorationFindings) {
		const prompt = this.formatExplorationLog(explorationFindings);
		return await this.backend.updateSubtask(subtaskId, { prompt });
	}

	/**
	 * Log implementation progress
	 * @param {string} subtaskId - Subtask ID (e.g., "1.2")
	 * @param {Object} progressUpdate - Progress update object
	 * @returns {Promise<Object>} Update result
	 */
	async logImplementationProgress(subtaskId, progressUpdate) {
		const prompt = this.formatProgressLog(progressUpdate);
		return await this.backend.updateSubtask(subtaskId, { prompt });
	}

	/**
	 * Log implementation completion
	 * @param {string} subtaskId - Subtask ID (e.g., "1.2")
	 * @param {Object} completionSummary - Completion summary object
	 * @returns {Promise<Object>} Update result
	 */
	async logCompletion(subtaskId, completionSummary) {
		const prompt = this.formatCompletionLog(completionSummary);
		return await this.backend.updateSubtask(subtaskId, { prompt });
	}

	/**
	 * Quick progress log with simple message
	 * @param {string} subtaskId - Subtask ID
	 * @param {string} message - Simple progress message
	 * @returns {Promise<Object>} Update result
	 */
	async logQuickProgress(subtaskId, message) {
		const timestamp = new Date().toISOString();
		const prompt = `## Quick Progress Update

**${timestamp}:** ${message}`;

		return await this.backend.updateSubtask(subtaskId, { prompt });
	}

	/**
	 * Format exploration phase log
	 * @param {Object} findings - Exploration findings
	 * @returns {string} Formatted log
	 */
	formatExplorationLog(findings) {
		const {
			filesToModify = [],
			approach = '',
			challenges = [],
			implementationSteps = []
		} = findings;

		return `## Exploration Phase

**Files to modify:**
${filesToModify.map((f) => `- ${f.path}: ${f.description}`).join('\n') || '- None specified'}

**Proposed approach:**
${approach || 'Not specified'}

**Potential challenges:**
${challenges.map((c) => `- ${c}`).join('\n') || '- None identified'}

**Implementation plan:**
${implementationSteps.map((step, i) => `${i + 1}. ${step}`).join('\n') || '1. No steps defined'}`;
	}

	/**
	 * Format implementation progress log
	 * @param {Object} progress - Progress update
	 * @returns {string} Formatted log
	 */
	formatProgressLog(progress) {
		const {
			whatWorked = [],
			whatDidntWork = [],
			codeChanges = [],
			decisions = [],
			nextSteps = []
		} = progress;

		return `## Implementation Progress

**What worked:**
${whatWorked.map((item) => `- ${item}`).join('\n') || '- Nothing to report yet'}

**What didn't work:**
${
	whatDidntWork
		.map((item) =>
			typeof item === 'string' ? `- ${item}` : `- ${item.issue}: ${item.reason}`
		)
		.join('\n') || '- No issues encountered'
}

**Code changes made:**
${
	codeChanges
		.map((change) =>
			typeof change === 'string'
				? `- ${change}`
				: `- ${change.file}: ${change.description}`
		)
		.join('\n') || '- No code changes yet'
}

**Decisions made:**
${
	decisions
		.map((d) =>
			typeof d === 'string' ? `- ${d}` : `- ${d.decision}: ${d.reasoning}`
		)
		.join('\n') || '- No decisions made yet'
}

**Next steps:**
${nextSteps.map((step) => `- ${step}`).join('\n') || '- Continue implementation'}`;
	}

	/**
	 * Format completion log
	 * @param {Object} summary - Completion summary
	 * @returns {string} Formatted log
	 */
	formatCompletionLog(summary) {
		const {
			finalApproach = '',
			keyLearnings = [],
			codePatterns = [],
			testing = '',
			documentation = ''
		} = summary;

		return `## Implementation Complete

**Final approach used:**
${finalApproach || 'Not specified'}

**Key learnings:**
${keyLearnings.map((learning) => `- ${learning}`).join('\n') || '- No specific learnings documented'}

**Code patterns established:**
${codePatterns.map((pattern) => `- ${pattern}`).join('\n') || '- No new patterns established'}

**Testing completed:**
${testing || 'No testing information provided'}

**Documentation updated:**
${documentation || 'No documentation updates specified'}`;
	}

	/**
	 * Parse existing implementation journey from subtask details
	 * @param {string} details - Subtask details text
	 * @returns {Object} Parsed journey information
	 */
	parseImplementationJourney(details) {
		const journey = {
			hasExploration: false,
			hasProgress: false,
			hasCompletion: false,
			explorationContent: null,
			progressEntries: [],
			completionContent: null,
			timestamps: []
		};

		// Check for exploration phase
		const explorationMatch = details.match(
			/## Exploration Phase([\s\S]*?)(?=##|$)/
		);
		if (explorationMatch) {
			journey.hasExploration = true;
			journey.explorationContent = explorationMatch[1].trim();
		}

		// Check for implementation progress (multiple entries possible)
		const progressMatches = details.matchAll(
			/## Implementation Progress([\s\S]*?)(?=##|$)/g
		);
		for (const match of progressMatches) {
			journey.hasProgress = true;
			journey.progressEntries.push(match[1].trim());
		}

		// Check for completion
		const completionMatch = details.match(
			/## Implementation Complete([\s\S]*?)(?=##|$)/
		);
		if (completionMatch) {
			journey.hasCompletion = true;
			journey.completionContent = completionMatch[1].trim();
		}

		// Extract timestamps
		const timestampMatches = details.matchAll(/<info added on ([\d-T:.Z]+)>/g);
		for (const match of timestampMatches) {
			journey.timestamps.push(new Date(match[1]));
		}

		return journey;
	}

	/**
	 * Get suggested next action based on current journey state
	 * @param {Object} subtask - Subtask object
	 * @returns {Object} Suggested action
	 */
	getSuggestedNextAction(subtask) {
		const journey = this.parseImplementationJourney(subtask.details || '');
		const { status } = subtask;

		if (status === 'pending') {
			if (journey.hasExploration) {
				return {
					action: 'start-implementation',
					description: 'Begin implementation based on exploration plan',
					phase: 'implementation'
				};
			}
			return {
				action: 'explore',
				description: 'Start exploration and planning phase',
				phase: 'exploration'
			};
		}

		if (status === 'in-progress') {
			if (!journey.hasProgress) {
				return {
					action: 'log-initial-progress',
					description: 'Log initial implementation progress',
					phase: 'implementation'
				};
			}
			return {
				action: 'continue-progress',
				description: 'Continue logging implementation progress',
				phase: 'implementation'
			};
		}

		if (status === 'done') {
			if (!journey.hasCompletion) {
				return {
					action: 'log-completion',
					description: 'Document completion summary and learnings',
					phase: 'completion'
				};
			}
			return {
				action: 'review-complete',
				description: 'Implementation is complete and documented',
				phase: 'complete'
			};
		}

		return {
			action: 'review-status',
			description: 'Review subtask status and determine next steps',
			phase: 'unknown'
		};
	}

	/**
	 * Create a structured progress template based on phase
	 * @param {string} phase - Implementation phase
	 * @returns {Object} Template structure
	 */
	createProgressTemplate(phase) {
		const templates = {
			exploration: {
				filesToModify: [{ path: '', description: '' }],
				approach: '',
				challenges: [''],
				implementationSteps: ['']
			},
			implementation: {
				whatWorked: [''],
				whatDidntWork: [{ issue: '', reason: '' }],
				codeChanges: [{ file: '', description: '' }],
				decisions: [{ decision: '', reasoning: '' }],
				nextSteps: ['']
			},
			completion: {
				finalApproach: '',
				keyLearnings: [''],
				codePatterns: [''],
				testing: '',
				documentation: ''
			}
		};

		return templates[phase] || templates.implementation;
	}
}
