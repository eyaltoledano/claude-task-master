/**
 * Research Integration Hook - analyzes tasks and manages research workflow
 */
export default class ResearchIntegrationHook {
	constructor() {
		this.version = '1.0.0';
		this.description =
			'Analyzes tasks for research needs and manages research workflow';
		this.events = ['pre-research', 'post-research'];
		this.timeout = 30000; // 30 seconds
	}

	/**
	 * Pre-research hook - analyze if research is needed
	 */
	async onPreResearch(context) {
		const { task, action, config, utils } = context;

		if (!task) {
			return { error: 'No task provided' };
		}

		// If this is just checking if research is needed
		if (action === 'check-needed') {
			return await this.analyzeResearchNeeds(task, utils, config, context);
		}

		// Otherwise, prepare for research execution
		return this.prepareResearch(task, utils, config);
	}

	/**
	 * Post-research hook - process research results
	 */
	async onPostResearch(context) {
		const { task, researchResults, config, services } = context;

		if (!task || !researchResults) {
			return { error: 'Missing task or research results' };
		}

		try {
			// Update task with research findings
			if (config.updateTaskDetails && services.backend) {
				await this.updateTaskWithResearch(
					task,
					researchResults,
					services.backend
				);
			}

			// Cache research results if configured
			if (config.cacheResults && services.storage) {
				await this.cacheResearchResults(
					task,
					researchResults,
					services.storage
				);
			}

			return {
				success: true,
				updated: config.updateTaskDetails,
				cached: config.cacheResults,
				timestamp: new Date().toISOString()
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Analyze if task needs research
	 */
	async analyzeResearchNeeds(task, utils, config, context = {}) {
		try {
			// Check if research already exists in the current task
			const existingResearch = utils.extractResearchFromTask(task);

			// Check if this is a subtask (ID contains a dot)
			const isSubtask = task.id && String(task.id).includes('.');
			let parentTaskResearch = null;

			if (isSubtask && context.backend) {
				// For subtasks, also check the parent task for research
				const parentTaskId = String(task.id).split('.')[0];
				try {
					const parentTask = await context.backend.getTask(parentTaskId);
					if (parentTask) {
						parentTaskResearch = utils.extractResearchFromTask(parentTask);
					}
				} catch (error) {
					console.warn(`Failed to fetch parent task ${parentTaskId}:`, error);
				}
			}

			// Determine if research exists (in either subtask or parent)
			const hasResearchInSubtask = !!(existingResearch);
			const hasResearchInParent = !!(parentTaskResearch);
			const hasAnyResearch = hasResearchInSubtask || hasResearchInParent;

			if (hasAnyResearch && config.autoDetectExisting) {
				let message;
				let sessionInfo;
				let lastUpdatedInfo;

				if (hasResearchInSubtask) {
					// Research found in subtask
					sessionInfo = existingResearch.sessionCount > 1 
						? `${existingResearch.sessionCount} research sessions found in subtask`
						: 'Research session found in subtask';
				
					lastUpdatedInfo = existingResearch.format === 'current'
					? `Last updated: ${existingResearch.lastUpdated}`
					: `Last updated: ${existingResearch.lastUpdated} (legacy format)`;

					message = `${sessionInfo}. ${lastUpdatedInfo}`;
				} else if (hasResearchInParent) {
					// Research found in parent task
					sessionInfo = parentTaskResearch.sessionCount > 1 
						? `${parentTaskResearch.sessionCount} research sessions found in parent task`
						: 'Research session found in parent task';
					
					lastUpdatedInfo = parentTaskResearch.format === 'current'
						? `Last updated: ${parentTaskResearch.lastUpdated}`
						: `Last updated: ${parentTaskResearch.lastUpdated} (legacy format)`;

					message = `${sessionInfo}. ${lastUpdatedInfo}`;
				}

				return {
					researchStatus: {
						needed: false,
						reason: 'existing-research-found',
						hasExisting: true,
						lastUpdated: (existingResearch || parentTaskResearch).lastUpdated,
						sessionCount: (existingResearch || parentTaskResearch).sessionCount || 1,
						format: (existingResearch || parentTaskResearch).format || 'legacy',
						confidence: 100,
						message,
						source: hasResearchInSubtask ? 'subtask' : 'parent'
					}
				};
			}

			// Simple check: if no existing research pattern found in either place, recommend research
			if (!hasAnyResearch) {
				const searchLocation = isSubtask ? 'subtask or parent task' : 'task';
				return {
					researchStatus: {
						needed: true,
						reason: 'no-research-found',
						hasExisting: false,
						confidence: 85,
						message: `No existing research found in ${searchLocation}. Research recommended to gather current best practices and implementation guidance.`
					}
				};
			} else {
				// Research pattern exists somewhere - no additional research needed
				return {
					researchStatus: {
						needed: false,
						reason: 'existing-research-found',
						hasExisting: true,
						confidence: 100,
						message: 'Existing research found.'
					}
				};
			}

		} catch (error) {
			return {
				researchStatus: {
					needed: false,
					reason: 'analysis-error',
					error: error.message,
					confidence: 0
				}
			};
		}
	}

	/**
	 * Prepare for research execution
	 */
	prepareResearch(task, utils, config) {
		try {
			// Generate research queries
			const analysis = utils.analyzeTaskForResearch(task);
			const queries = analysis.suggestions.slice(
				0,
				config.maxSuggestedQueries || 3
			);

			// Add context-specific queries
			const contextQueries = this.generateContextQueries(task);

			const allQueries = [...queries, ...contextQueries]
				.filter((query, index, arr) => arr.indexOf(query) === index) // Remove duplicates
				.slice(0, 5); // Limit total queries

			return {
				success: true,
				queries: allQueries,
				keywords: analysis.keywords,
				confidence: analysis.confidence,
				prepared: new Date().toISOString()
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Generate context-specific research queries
	 */
	generateContextQueries(task) {
		const queries = [];
		const text =
			`${task.title} ${task.description} ${task.details || ''}`.toLowerCase();

		// Security-related queries
		if (
			text.includes('security') ||
			text.includes('auth') ||
			text.includes('login')
		) {
			queries.push('Security best practices for authentication implementation');
		}

		// Performance-related queries
		if (
			text.includes('performance') ||
			text.includes('optimization') ||
			text.includes('speed')
		) {
			queries.push('Performance optimization techniques and best practices');
		}

		// Testing-related queries
		if (text.includes('test') || text.includes('testing')) {
			queries.push('Modern testing strategies and frameworks');
		}

		// Database-related queries
		if (
			text.includes('database') ||
			text.includes('db') ||
			text.includes('sql')
		) {
			queries.push('Database design patterns and optimization');
		}

		return queries;
	}

	/**
	 * Update task with research findings
	 */
	async updateTaskWithResearch(task, researchResults, backend) {
		try {
			// Format research content for task details
			const researchSummary = this.formatResearchForTask(researchResults);

			// Determine if this is a task or subtask
			const isSubtask = task.id && task.id.toString().includes('.');

			if (isSubtask) {
				// Update subtask
				await backend.updateSubtask(task.id, researchSummary);
			} else {
				// Update main task
				await backend.updateTask(task.id, researchSummary, { append: true });
			}

			return true;
		} catch (error) {
			console.error('Failed to update task with research:', error);
			return false;
		}
	}

	/**
	 * Format research results for task details
	 */
	formatResearchForTask(researchResults) {
		const timestamp = new Date().toISOString();

		let summary = `Research completed on ${new Date().toLocaleDateString()}:\n\n`;

		if (researchResults.query) {
			summary += `**Research Query:** ${researchResults.query}\n\n`;
		}

		if (researchResults.summary) {
			summary += `**Key Findings:**\n${researchResults.summary}\n\n`;
		}

		if (
			researchResults.recommendations &&
			researchResults.recommendations.length > 0
		) {
			summary += `**Recommendations:**\n`;
			researchResults.recommendations.forEach((rec, index) => {
				summary += `${index + 1}. ${rec}\n`;
			});
			summary += '\n';
		}

		if (researchResults.sources && researchResults.sources.length > 0) {
			summary += `**Sources:**\n`;
			researchResults.sources.forEach((source, index) => {
				summary += `${index + 1}. ${source}\n`;
			});
		}

		return summary;
	}

	/**
	 * Cache research results for future use
	 */
	async cacheResearchResults(task, researchResults, storage) {
		try {
			const cacheKey = `research-${task.id}`;
			const cacheData = {
				taskId: task.id,
				taskTitle: task.title,
				results: researchResults,
				timestamp: new Date().toISOString()
			};

			await storage.set('research-integration', cacheKey, cacheData);
			return true;
		} catch (error) {
			console.error('Failed to cache research results:', error);
			return false;
		}
	}

	/**
	 * Get cached research for a task
	 */
	async getCachedResearch(taskId, storage) {
		try {
			const cacheKey = `research-${taskId}`;
			return await storage.get('research-integration', cacheKey);
		} catch (error) {
			console.error('Failed to get cached research:', error);
			return null;
		}
	}
}
