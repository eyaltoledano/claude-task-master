/**
 * Hook Context - provides rich context data and services to hooks
 */

/**
 * Create a hook context object
 */
export function createHookContext(baseContext) {
	const context = {
		// Event information
		event: baseContext.event,
		hookName: baseContext.hookName,
		timestamp: new Date().toISOString(),
		
		// Hook configuration
		config: baseContext.config || {},
		
		// Storage service
		storage: baseContext.storage,
		
		// Session data (if available)
		session: baseContext.session || null,
		
		// Task data (if available)
		task: baseContext.task || null,
		
		// Worktree data (if available)
		worktree: baseContext.worktree || null,
		
		// Services
		services: createServiceProxy(baseContext),
		
		// Utilities
		utils: createUtilities(),
		
		// Spread any additional context (excluding duplicates)
		...Object.fromEntries(
			Object.entries(baseContext).filter(([key]) => 
				!['config', 'storage', 'backend', 'research', 'git'].includes(key)
			)
		)
	};

	return context;
}

/**
 * Create a proxy for services to provide controlled access
 */
function createServiceProxy(baseContext) {
	const services = {};

	// Backend service (if available)
	if (baseContext.backend) {
		services.backend = createBackendProxy(baseContext.backend);
	}

	// Research service (if available)
	if (baseContext.research) {
		services.research = baseContext.research;
	}

	// Git service (if available)
	if (baseContext.git) {
		services.git = baseContext.git;
	}

	// Storage service
	if (baseContext.storage) {
		services.storage = baseContext.storage;
	}

	return services;
}

/**
 * Create a controlled proxy for backend service
 */
function createBackendProxy(backend) {
	// Only expose safe methods that hooks should be able to use
	const safeMethods = [
		'getTask',
		'getTasks',
		'updateTask',
		'updateSubtask',
		'setTaskStatus',
		'research',
		'getClaudeCodeConfig',
		'saveClaudeCodeConfig',
		'getTaskWorktrees',
		'createWorktreeForTask',
		'createWorktreeForSubtask'
	];

	const proxy = {};
	
	for (const method of safeMethods) {
		if (typeof backend[method] === 'function') {
			proxy[method] = backend[method].bind(backend);
		}
	}

	return proxy;
}

/**
 * Create utility functions for hooks
 */
function createUtilities() {
	return {
		/**
		 * Extract research information from task details
		 */
		extractResearchFromTask(task) {
			if (!task || !task.details) return null;

			// Look for research markers in task details
			const researchPattern = /<info added on ([^>]+)>\s*(.*?)\s*<\/info added on [^>]+>/gs;
			const matches = [...task.details.matchAll(researchPattern)];
			
			if (matches.length === 0) return null;

			const research = matches.map(match => ({
				timestamp: match[1],
				content: match[2].trim()
			}));

			// Find the most recent research entry
			const latestResearch = research.sort((a, b) => 
				new Date(b.timestamp) - new Date(a.timestamp)
			)[0];

			return {
				hasResearch: true,
				lastUpdated: latestResearch.timestamp,
				content: latestResearch.content,
				allEntries: research
			};
		},

		/**
		 * Check if task needs research based on content analysis
		 */
		analyzeTaskForResearch(task) {
			if (!task) return { needed: false, confidence: 0 };

			const text = `${task.title} ${task.description} ${task.details || ''}`.toLowerCase();
			
			// Keywords that suggest research might be helpful
			const researchIndicators = [
				'new', 'latest', 'best practices', 'modern', 'current',
				'framework', 'library', 'api', 'integration', 'setup',
				'configure', 'implement', 'architecture', 'design pattern',
				'security', 'performance', 'optimization', 'testing'
			];

			// Technology keywords that often need research
			const techKeywords = [
				'react', 'vue', 'angular', 'node', 'python', 'go', 'rust',
				'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'firebase',
				'mongodb', 'postgresql', 'redis', 'graphql', 'rest api'
			];

			const foundKeywords = [];
			const score = researchIndicators.reduce((acc, keyword) => {
				if (text.includes(keyword)) {
					foundKeywords.push(keyword);
					return acc + 1;
				}
				return acc;
			}, 0) + techKeywords.reduce((acc, keyword) => {
				if (text.includes(keyword)) {
					foundKeywords.push(keyword);
					return acc + 0.5;
				}
				return acc;
			}, 0);

			// Calculate confidence based on score
			const confidence = Math.min(score / 3, 1); // Normalize to 0-1

			return {
				needed: confidence > 0.3,
				confidence: Math.round(confidence * 100),
				score,
				keywords: foundKeywords,
				suggestions: this.generateResearchQueries(task, foundKeywords)
			};
		},

		/**
		 * Generate research queries for a task
		 */
		generateResearchQueries(task, keywords = []) {
			const queries = [];
			const baseText = task.title + ' ' + task.description;

			// Generic queries
			queries.push(`Best practices for ${baseText}`);
			queries.push(`How to implement ${task.title.toLowerCase()}`);

			// Technology-specific queries
			if (keywords.length > 0) {
				const techKeywords = keywords.filter(k => 
					['react', 'vue', 'angular', 'node', 'python', 'go', 'rust'].includes(k)
				);
				
				if (techKeywords.length > 0) {
					queries.push(`${techKeywords[0]} ${baseText} tutorial`);
					queries.push(`Latest ${techKeywords[0]} patterns for ${task.title.toLowerCase()}`);
				}
			}

			return queries.slice(0, 3); // Limit to 3 queries
		},

		/**
		 * Format timestamp for display
		 */
		formatTimestamp(timestamp) {
			try {
				return new Date(timestamp).toLocaleString();
			} catch (error) {
				return timestamp;
			}
		},

		/**
		 * Generate a unique ID
		 */
		generateId() {
			return `hook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		},

		/**
		 * Safely parse JSON
		 */
		safeJsonParse(str, defaultValue = null) {
			try {
				return JSON.parse(str);
			} catch (error) {
				return defaultValue;
			}
		},

		/**
		 * Deep clone an object
		 */
		deepClone(obj) {
			if (obj === null || typeof obj !== 'object') return obj;
			if (obj instanceof Date) return new Date(obj.getTime());
			if (Array.isArray(obj)) return obj.map(item => this.deepClone(item));
			if (typeof obj === 'object') {
				const cloned = {};
				for (const key in obj) {
					if (obj.hasOwnProperty(key)) {
						cloned[key] = this.deepClone(obj[key]);
					}
				}
				return cloned;
			}
		}
	};
}

/**
 * Validate context before passing to hooks
 */
export function validateContext(context) {
	const errors = [];

	if (!context.event) {
		errors.push('Context must include event');
	}

	if (!context.hookName) {
		errors.push('Context must include hookName');
	}

	if (!context.timestamp) {
		errors.push('Context must include timestamp');
	}

	return {
		valid: errors.length === 0,
		errors
	};
} 