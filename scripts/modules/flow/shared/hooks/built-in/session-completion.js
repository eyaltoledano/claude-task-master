/**
 * Session Completion Hook - handles post-session cleanup and PR creation
 */
import { CodeQualityAnalyzer } from '../quality/code-quality-analyzer.js';
import {
	formatForTaskUpdate,
	formatForPRDescription
} from '../quality/quality-insights-formatter.js';

export default class SessionCompletionHook {
	constructor() {
		this.version = '1.0.0';
		this.description = 'Handles session completion, cleanup, and PR creation';
		this.events = [
			'session-completed',
			'session-failed',
			'pre-pr',
			'pr-created'
		];
		this.timeout = 30000; // 30 seconds

		// Initialize quality analyzer
		this.qualityAnalyzer = new CodeQualityAnalyzer();
	}

	/**
	 * Handle session completion
	 */
	async onSessionCompleted(context) {
		const { session, config, task, worktree, services } = context;

		try {
			const completionResult = {
				success: true,
				session: {
					id: session.sessionId || session.operationId,
					startTime: session.startTime,
					endTime: new Date().toISOString(),
					duration: this.calculateSessionDuration(session)
				},
				task: {
					id: task.id,
					type: task.isSubtask ? 'subtask' : 'task',
					title: task.title,
					status: task.status
				},
				worktree: {
					path: worktree.path,
					branch: worktree.branch || worktree.name
				},
				statistics: {},
				qualityMetrics: null,
				recommendations: [],
				actions: []
			};

			// Collect session statistics
			completionResult.statistics = await this.collectSessionStatistics(
				session,
				worktree,
				services
			);

			// Run code quality analysis
			try {
				completionResult.qualityMetrics = await this.analyzeCodeQuality(
					session,
					task,
					worktree,
					services
				);

				// Generate quality-based recommendations
				if (completionResult.qualityMetrics) {
					const qualityInsights = this.generateQualityInsights(
						completionResult.qualityMetrics
					);
					completionResult.recommendations.push(...qualityInsights);
				}
			} catch (qualityError) {
				console.warn('Code quality analysis failed:', qualityError.message);
				completionResult.qualityMetrics = {
					error: qualityError.message,
					timestamp: new Date().toISOString()
				};
			}

			// Update task status if configured
			if (config.autoUpdateTaskStatus) {
				await this.updateTaskStatus(task, session, services);
				completionResult.actions.push('task-status-updated');
			}

			// Update task with quality metrics
			if (
				completionResult.qualityMetrics &&
				completionResult.qualityMetrics.hasChanges
			) {
				await this.updateTaskWithQualityMetrics(
					task,
					completionResult.qualityMetrics,
					services
				);
				completionResult.actions.push('quality-metrics-added');
			}

			// Generate completion summary
			if (config.generateSummary) {
				const summary = await this.generateCompletionSummary(
					session,
					task,
					worktree
				);
				completionResult.summary = summary;
				completionResult.actions.push('summary-generated');
			}

			// Check if PR should be created
			if (config.autoCreatePR && this.shouldCreatePR(session, config)) {
				const prResult = await this.handlePRCreation(
					session,
					task,
					worktree,
					services,
					completionResult.qualityMetrics
				);
				completionResult.prResult = prResult;
				completionResult.actions.push('pr-created');
			}

			return completionResult;
		} catch (error) {
			return {
				success: false,
				error: error.message,
				actions: [],
				timestamp: new Date().toISOString()
			};
		}
	}

	/**
	 * Handle session failure
	 */
	async onSessionFailed(context) {
		const { session, error, task, worktree, services } = context;

		try {
			const failureResult = {
				success: true,
				actions: [],
				analysis: {},
				recommendations: []
			};

			// Analyze failure
			failureResult.analysis = await this.analyzeFailure(session, error, task);

			// Save failure context
			if (session && task) {
				await this.saveFailureContext(session, error, task, services);
				failureResult.actions.push('failure-context-saved');
			}

			// Generate recovery recommendations
			failureResult.recommendations = this.generateRecoveryRecommendations(
				error,
				session,
				task
			);

			// Clean up if needed
			if (worktree && session?.metadata?.cleanupOnFailure) {
				await this.cleanupOnFailure(worktree, services);
				failureResult.actions.push('cleanup-performed');
			}

			return failureResult;
		} catch (cleanupError) {
			return {
				success: false,
				error: cleanupError.message,
				originalError: error?.message,
				actions: []
			};
		}
	}

	/**
	 * Pre-PR validation
	 */
	async onPrePr(context) {
		const { session, task, worktree, config, services } = context;

		try {
			const validation = {
				canCreatePR: true,
				warnings: [],
				errors: [],
				checks: {}
			};

			// Check if worktree has changes
			validation.checks.changes = await this.checkWorktreeChanges(
				worktree,
				services
			);
			if (!validation.checks.changes.hasChanges) {
				validation.warnings.push('No changes detected in worktree');
			}

			// Validate git status
			validation.checks.git = await this.validateGitForPR(worktree, services);
			if (!validation.checks.git.valid) {
				validation.errors.push('Git validation failed for PR creation');
				validation.canCreatePR = false;
			}

			// Check for conflicts
			validation.checks.conflicts = await this.checkForConflicts(
				worktree,
				services
			);
			if (validation.checks.conflicts.hasConflicts) {
				validation.warnings.push(
					'Merge conflicts detected - PR may need manual resolution'
				);
			}

			// Validate task completion
			validation.checks.task = this.validateTaskCompletion(task, session);
			if (!validation.checks.task.complete) {
				validation.warnings.push('Task may not be fully complete');
			}

			return {
				validation,
				canProceed: validation.canCreatePR,
				timestamp: new Date().toISOString()
			};
		} catch (error) {
			return {
				validation: {
					canCreatePR: false,
					errors: [`PR validation failed: ${error.message}`],
					warnings: [],
					checks: {}
				},
				canProceed: false,
				error: error.message
			};
		}
	}

	/**
	 * Handle PR creation completion
	 */
	async onPrCreated(context) {
		const { prResult, session, task, worktree, services } = context;

		try {
			const result = {
				success: true,
				actions: [],
				prInfo: {}
			};

			if (prResult && prResult.success) {
				// Store PR information
				result.prInfo = {
					prNumber: prResult.prNumber,
					prUrl: prResult.prUrl,
					title: prResult.title,
					description: prResult.description
				};

				// Update task with PR reference
				if (task && services.backend) {
					await this.updateTaskWithPR(task, prResult, services);
					result.actions.push('task-updated-with-pr');
				}

				// Notify team if configured
				if (prResult.notifyTeam) {
					await this.notifyTeamOfPR(prResult, task, services);
					result.actions.push('team-notified');
				}

				// Clean up worktree if configured
				if (prResult.cleanupWorktree && worktree) {
					await this.cleanupWorktreeAfterPR(worktree, services);
					result.actions.push('worktree-cleaned');
				}
			}

			return result;
		} catch (error) {
			return {
				success: false,
				error: error.message,
				actions: []
			};
		}
	}

	/**
	 * Helper methods
	 */
	async collectSessionStatistics(session, worktree, services) {
		const stats = {
			duration: 0,
			turns: 0,
			maxTurns: 0,
			fileChanges: 0,
			linesAdded: 0,
			linesRemoved: 0,
			totalCost: 0,
			tokensUsed: 0
		};

		try {
			// Extract from session metadata
			if (session.metadata) {
				stats.turns = session.metadata.turns || 0;
				stats.maxTurns = session.metadata.maxTurns || 0;
				stats.totalCost = session.metadata.totalCost || 0;
				stats.tokensUsed = session.metadata.tokensUsed || 0;
			}

			// Calculate duration
			if (session.startTime && session.endTime) {
				stats.duration = Math.round(
					(new Date(session.endTime) - new Date(session.startTime)) / 1000
				);
			}

			// Count file changes in worktree
			if (worktree && services.git) {
				const changes = await this.getWorktreeChanges(worktree, services);
				stats.fileChanges = changes.files.length;
				stats.linesAdded = changes.additions;
				stats.linesRemoved = changes.deletions;
			}
		} catch (error) {
			console.warn('Failed to collect complete statistics:', error);
		}

		return stats;
	}

	async updateTaskStatus(task, session, services) {
		// Task status updates are now handled by claude-code-stop hook
		// This method remains for backward compatibility but delegates to the main workflow
		console.log(
			'🔄 [SessionCompletionHook] Task status update delegated to claude-code-stop hook'
		);
	}

	async generateCompletionSummary(session, task, worktree) {
		const summary = {
			task: {
				id: task?.id,
				title: task?.title,
				type: task?.isSubtask ? 'subtask' : 'task'
			},
			session: {
				id: session?.id || session?.operationId,
				status: session?.status,
				persona: session?.metadata?.persona
			},
			worktree: {
				name: worktree?.name,
				branch: worktree?.branch,
				path: worktree?.path
			},
			timestamp: new Date().toISOString()
		};

		return summary;
	}

	shouldCreatePR(session, config) {
		// Check global PR setting
		if (!config.globalPRSetting) return false;

		// Check if session was successful
		if (session.status !== 'completed') return false;

		// Check if there are actual changes
		// This would be determined by checking git status

		return true;
	}

	async handlePRCreation(
		session,
		task,
		worktree,
		services,
		qualityMetrics = null
	) {
		if (!services.backend || !worktree) {
			throw new Error(
				'Backend service or worktree not available for PR creation'
			);
		}

		try {
			const prTitle = `Task ${task.id}: ${task.title}`;
			const prDescription = this.generatePRDescription(
				session,
				task,
				qualityMetrics
			);

			const result = await services.backend.completeSubtaskWithPR(
				worktree.name,
				{
					createPR: true,
					prTitle,
					prDescription
				}
			);

			return {
				success: true,
				prNumber: result.prNumber,
				prUrl: result.prUrl,
				title: prTitle,
				description: prDescription
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	generatePRDescription(session, task, qualityMetrics = null) {
		const parts = [
			`Implemented by Claude Code`,
			``,
			`**Task:** ${task.title}`,
			task.description ? `**Description:** ${task.description}` : null,
			``,
			`**Session Details:**`,
			`- Persona: ${session.metadata?.persona || 'Unknown'}`,
			`- Operation ID: ${session.id || session.operationId}`,
			session.metadata?.turns
				? `- Turns: ${session.metadata.turns}/${session.metadata.maxTurns}`
				: null,
			session.metadata?.totalCost
				? `- Cost: $${session.metadata.totalCost.toFixed(4)}`
				: null
		].filter(Boolean);

		// Add quality metrics if available
		if (qualityMetrics && qualityMetrics.hasChanges) {
			const qualitySection = formatForPRDescription(qualityMetrics);
			if (qualitySection) {
				parts.push('');
				parts.push(qualitySection);
			}
		}

		return parts.join('\n');
	}

	generateRecommendations(session, task, config) {
		const recommendations = [];

		// Session-based recommendations
		if (session.metadata?.turns >= session.metadata?.maxTurns * 0.8) {
			recommendations.push({
				type: 'session',
				level: 'info',
				message:
					'Session used most of the available turns. Consider increasing max turns for complex tasks.'
			});
		}

		// Task-based recommendations
		if (task.subtasks && task.subtasks.length > 0) {
			const pendingSubtasks = task.subtasks.filter(
				(st) => st.status !== 'done'
			);
			if (pendingSubtasks.length > 0) {
				recommendations.push({
					type: 'task',
					level: 'warning',
					message: `${pendingSubtasks.length} subtasks still pending. Consider running additional sessions.`
				});
			}
		}

		return recommendations;
	}

	async analyzeFailure(session, error, task) {
		const analysis = {
			errorType: 'unknown',
			category: 'session',
			severity: 'medium',
			recoverable: true,
			cause: null
		};

		try {
			// Analyze error message
			if (error?.message) {
				if (error.message.includes('timeout')) {
					analysis.errorType = 'timeout';
					analysis.severity = 'low';
					analysis.recoverable = true;
				} else if (error.message.includes('rate limit')) {
					analysis.errorType = 'rate-limit';
					analysis.severity = 'low';
					analysis.recoverable = true;
				} else if (error.message.includes('authentication')) {
					analysis.errorType = 'auth';
					analysis.severity = 'high';
					analysis.recoverable = false;
				} else if (error.message.includes('network')) {
					analysis.errorType = 'network';
					analysis.severity = 'medium';
					analysis.recoverable = true;
				}
			}

			// Analyze session context
			if (session?.metadata) {
				if (session.metadata.turns >= session.metadata.maxTurns) {
					analysis.cause = 'max-turns-reached';
				}
			}
		} catch (analysisError) {
			console.warn('Failed to analyze failure:', analysisError);
		}

		return analysis;
	}

	async saveFailureContext(session, error, task, services) {
		if (!services.backend) return;

		try {
			const failureInfo = `
<failure-context added="${new Date().toISOString()}">
Session failed: ${error?.message || 'Unknown error'}
Operation ID: ${session?.id || session?.operationId}
Error Type: ${error?.name || 'Error'}
Stack: ${error?.stack ? error.stack.split('\n')[0] : 'No stack trace'}
</failure-context>
`;

			const isSubtask = task.isSubtask || String(task.id).includes('.');

			if (isSubtask) {
				await services.backend.updateSubtask({
					id: task.id,
					prompt: failureInfo,
					research: false
				});
			} else {
				await services.backend.updateTask({
					id: task.id,
					prompt: failureInfo,
					research: false
				});
			}
		} catch (updateError) {
			console.warn('Failed to save failure context:', updateError);
		}
	}

	generateRecoveryRecommendations(error, session, task) {
		const recommendations = [];

		if (error?.message?.includes('timeout')) {
			recommendations.push({
				type: 'recovery',
				action: 'retry',
				message:
					'Session timed out. Try running again with a more specific prompt.'
			});
		}

		if (error?.message?.includes('rate limit')) {
			recommendations.push({
				type: 'recovery',
				action: 'wait',
				message: 'Rate limit exceeded. Wait a few minutes before retrying.'
			});
		}

		if (session?.metadata?.turns >= session?.metadata?.maxTurns) {
			recommendations.push({
				type: 'recovery',
				action: 'continue',
				message: 'Max turns reached. Use resume to continue the session.'
			});
		}

		return recommendations;
	}

	// Additional helper methods would be implemented here
	async checkWorktreeChanges(worktree, services) {
		// Implementation would check git status in worktree
		return { hasChanges: true, files: [] };
	}

	async validateGitForPR(worktree, services) {
		// Implementation would validate git state
		return { valid: true };
	}

	async checkForConflicts(worktree, services) {
		// Implementation would check for merge conflicts
		return { hasConflicts: false };
	}

	validateTaskCompletion(task, session) {
		// Implementation would analyze if task is complete
		return { complete: true };
	}

	async getWorktreeChanges(worktree, services) {
		// Implementation would get git diff stats
		return { files: [], additions: 0, deletions: 0 };
	}

	async updateTaskWithPR(task, prResult, services) {
		// Implementation would add PR reference to task
	}

	async notifyTeamOfPR(prResult, task, services) {
		// Implementation would send notifications
	}

	async cleanupWorktreeAfterPR(worktree, services) {
		// Implementation would clean up worktree
	}

	async cleanupOnFailure(worktree, services) {
		// Implementation would perform failure cleanup
	}

	async updateTaskWithQualityMetrics(task, qualityMetrics, services) {
		if (!task || !services.backend || !qualityMetrics) return;

		try {
			const qualityReport = formatForTaskUpdate(qualityMetrics);
			const isSubtask = task.isSubtask || String(task.id).includes('.');

			const updateText = `
<quality-analysis added="${new Date().toISOString()}">
${qualityReport.summary}

${qualityReport.details}
</quality-analysis>
`;

			if (isSubtask) {
				await services.backend.updateSubtask({
					id: task.id,
					prompt: updateText,
					research: false
				});
			} else {
				await services.backend.updateTask({
					id: task.id,
					prompt: updateText,
					research: false
				});
			}
		} catch (error) {
			console.warn('Failed to update task with quality metrics:', error);
		}
	}

	async analyzeCodeQuality(session, task, worktree, services) {
		try {
			return await this.qualityAnalyzer.analyzeSession(
				session,
				task,
				worktree,
				services
			);
		} catch (error) {
			console.warn('Code quality analysis failed:', error.message);
			return {
				error: error.message,
				timestamp: new Date().toISOString()
			};
		}
	}

	generateQualityInsights(metrics) {
		const insights = [];

		if (!metrics || metrics.error) {
			return insights;
		}

		// Overall score insights
		if (metrics.overallScore >= 8) {
			insights.push('✅ High quality code generated');
		} else if (metrics.overallScore >= 6) {
			insights.push('⚠️ Code quality is acceptable but could be improved');
		} else {
			insights.push('🔧 Code quality needs attention');
		}

		// Complexity insights
		if (metrics.aggregateMetrics?.averageComplexity > 15) {
			insights.push(
				'⚠️ High complexity detected - consider breaking down functions'
			);
		}

		// Lint insights
		if (metrics.lintResults?.errorCount > 0) {
			insights.push(
				`🔧 ${metrics.lintResults.errorCount} linting errors found`
			);
		}
		if (metrics.lintResults?.warningCount > 0) {
			insights.push(
				`⚠️ ${metrics.lintResults.warningCount} linting warnings found`
			);
		}

		// Task alignment insights
		if (metrics.taskAlignment?.keywordCoverage < 0.5) {
			insights.push('📋 Code may not fully address task requirements');
		} else if (metrics.taskAlignment?.keywordCoverage > 0.8) {
			insights.push('✅ Code well-aligned with task requirements');
		}

		// Comment ratio insights
		if (metrics.aggregateMetrics?.averageCommentRatio < 0.1) {
			insights.push('📝 Consider adding more documentation/comments');
		}

		// Scope insights
		if (metrics.taskAlignment?.implementationScope === 'very-large') {
			insights.push(
				'📏 Large implementation - consider breaking into smaller tasks'
			);
		}

		return insights;
	}

	calculateSessionDuration(session) {
		if (!session.startTime) {
			return 0;
		}

		const start = new Date(session.startTime);
		const end = new Date();
		return Math.round((end - start) / 1000); // Duration in seconds
	}
}
