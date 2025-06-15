/**
 * fuzzyTaskSearch.js
 * Reusable fuzzy search utility for finding relevant tasks based on semantic similarity
 */

import Fuse from 'fuse.js';

/**
 * Configuration for different search contexts
 */
const SEARCH_CONFIGS = {
	research: {
		threshold: 0.5, // More lenient for research (broader context)
		limit: 20,
		keys: [
			{ name: 'title', weight: 2.0 },
			{ name: 'description', weight: 1.0 },
			{ name: 'details', weight: 0.5 },
			{ name: 'dependencyTitles', weight: 0.5 }
		]
	},
	addTask: {
		threshold: 0.4, // Stricter for add-task (more precise context)
		limit: 15,
		keys: [
			{ name: 'title', weight: 2.0 },
			{ name: 'description', weight: 1.5 },
			{ name: 'details', weight: 0.8 },
			{ name: 'dependencyTitles', weight: 0.5 }
		]
	},
	default: {
		threshold: 0.4,
		limit: 15,
		keys: [
			{ name: 'title', weight: 2.0 },
			{ name: 'description', weight: 1.5 },
			{ name: 'details', weight: 1.0 },
			{ name: 'dependencyTitles', weight: 0.5 }
		]
	}
};

/**
 * Purpose categories for pattern-based task matching
 */
const PURPOSE_CATEGORIES = [
	{ pattern: /(command|cli|flag)/i, label: 'CLI commands' },
	{ pattern: /(task|subtask|add)/i, label: 'Task management' },
	{ pattern: /(dependency|depend)/i, label: 'Dependency handling' },
	{ pattern: /(AI|model|prompt|research)/i, label: 'AI integration' },
	{ pattern: /(UI|display|show|interface)/i, label: 'User interface' },
	{ pattern: /(schedule|time|cron)/i, label: 'Scheduling' },
	{ pattern: /(config|setting|option)/i, label: 'Configuration' },
	{ pattern: /(test|testing|spec)/i, label: 'Testing' },
	{ pattern: /(auth|login|user)/i, label: 'Authentication' },
	{ pattern: /(database|db|data)/i, label: 'Data management' },
	{ pattern: /(api|endpoint|route)/i, label: 'API development' },
	{ pattern: /(deploy|build|release)/i, label: 'Deployment' },
	{ pattern: /(security|auth|login|user)/i, label: 'Security' },
	{ pattern: /.*/, label: 'Other' }
];

/**
 * Relevance score thresholds
 */
const RELEVANCE_THRESHOLDS = {
	high: 0.25,
	medium: 0.4,
	low: 0.6
};

/**
 * Fuzzy search utility class for finding relevant tasks
 */
export class FuzzyTaskSearch {
	constructor(tasks, searchType = 'default') {
		this.tasks = tasks;
		this.config = SEARCH_CONFIGS[searchType] || SEARCH_CONFIGS.default;
		this.searchableTasks = this._prepareSearchableTasks(tasks);
		this.fuse = new Fuse(this.searchableTasks, {
			includeScore: true,
			threshold: this.config.threshold,
			keys: this.config.keys,
			shouldSort: true,
			useExtendedSearch: true,
			limit: this.config.limit
		});
	}

	/**
	 * Prepare tasks for searching by expanding dependency titles
	 * @param {Array} tasks - Array of task objects
	 * @returns {Array} Tasks with expanded dependency information
	 */
	_prepareSearchableTasks(tasks) {
		return tasks.map((task) => {
			// Get titles of this task's dependencies if they exist
			const dependencyTitles =
				task.dependencies?.length > 0
					? task.dependencies
							.map((depId) => {
								const depTask = tasks.find((t) => t.id === depId);
								return depTask ? depTask.title : '';
							})
							.filter((title) => title)
							.join(' ')
					: '';

			return {
				...task,
				dependencyTitles
			};
		});
	}

	/**
	 * Extract significant words from a prompt
	 * @param {string} prompt - The search prompt
	 * @returns {Array<string>} Array of significant words
	 */
	_extractPromptWords(prompt) {
		return prompt
			.toLowerCase()
			.replace(/[^\w\s-]/g, ' ') // Replace non-alphanumeric chars with spaces
			.split(/\s+/)
			.filter((word) => word.length > 3); // Words at least 4 chars
	}

	/**
	 * Find tasks related to a prompt using fuzzy search
	 * @param {string} prompt - The search prompt
	 * @param {Object} options - Search options
	 * @param {number} [options.maxResults=8] - Maximum number of results to return
	 * @param {boolean} [options.includeRecent=true] - Include recent tasks in results
	 * @param {boolean} [options.includeCategoryMatches=true] - Include category-based matches
	 * @returns {Object} Search results with relevance breakdown
	 */
	findRelevantTasks(prompt, options = {}) {
		const {
			maxResults = 8,
			includeRecent = true,
			includeCategoryMatches = true
		} = options;

		// Extract significant words from prompt
		const promptWords = this._extractPromptWords(prompt);

		// Perform fuzzy search with full prompt
		const fuzzyResults = this.fuse.search(prompt);

		// Also search for each significant word to catch different aspects
		let wordResults = [];
		for (const word of promptWords) {
			if (word.length > 5) {
				// Only use significant words
				const results = this.fuse.search(word);
				if (results.length > 0) {
					wordResults.push(...results);
				}
			}
		}

		// Merge and deduplicate results
		const mergedResults = [...fuzzyResults];

		// Add word results that aren't already in fuzzyResults
		for (const wordResult of wordResults) {
			if (!mergedResults.some((r) => r.item.id === wordResult.item.id)) {
				mergedResults.push(wordResult);
			}
		}

		// Group search results by relevance
		const highRelevance = mergedResults
			.filter((result) => result.score < RELEVANCE_THRESHOLDS.high)
			.map((result) => ({ ...result.item, score: result.score }));

		const mediumRelevance = mergedResults
			.filter(
				(result) =>
					result.score >= RELEVANCE_THRESHOLDS.high &&
					result.score < RELEVANCE_THRESHOLDS.medium
			)
			.map((result) => ({ ...result.item, score: result.score }));

		const lowRelevance = mergedResults
			.filter(
				(result) =>
					result.score >= RELEVANCE_THRESHOLDS.medium &&
					result.score < RELEVANCE_THRESHOLDS.low
			)
			.map((result) => ({ ...result.item, score: result.score }));

		// Get recent tasks (newest first) if requested
		const recentTasks = includeRecent
			? [...this.tasks].sort((a, b) => b.id - a.id).slice(0, 5)
			: [];

		// Find category-based matches if requested
		let categoryTasks = [];
		let promptCategory = null;
		if (includeCategoryMatches) {
			promptCategory = PURPOSE_CATEGORIES.find((cat) =>
				cat.pattern.test(prompt)
			);
			categoryTasks = promptCategory
				? this.tasks
						.filter(
							(t) =>
								promptCategory.pattern.test(t.title) ||
								promptCategory.pattern.test(t.description) ||
								(t.details && promptCategory.pattern.test(t.details))
						)
						.slice(0, 3)
				: [];
		}

		// Combine all relevant tasks, prioritizing by relevance
		const allRelevantTasks = [...highRelevance];

		// Add medium relevance if not already included
		for (const task of mediumRelevance) {
			if (!allRelevantTasks.some((t) => t.id === task.id)) {
				allRelevantTasks.push(task);
			}
		}

		// Add low relevance if not already included
		for (const task of lowRelevance) {
			if (!allRelevantTasks.some((t) => t.id === task.id)) {
				allRelevantTasks.push(task);
			}
		}

		// Add category tasks if not already included
		for (const task of categoryTasks) {
			if (!allRelevantTasks.some((t) => t.id === task.id)) {
				allRelevantTasks.push(task);
			}
		}

		// Add recent tasks if not already included
		for (const task of recentTasks) {
			if (!allRelevantTasks.some((t) => t.id === task.id)) {
				allRelevantTasks.push(task);
			}
		}

		// Get top N results for final output
		const finalResults = allRelevantTasks.slice(0, maxResults);

		return {
			results: finalResults,
			breakdown: {
				highRelevance,
				mediumRelevance,
				lowRelevance,
				categoryTasks,
				recentTasks,
				promptCategory,
				promptWords
			},
			metadata: {
				totalSearched: this.tasks.length,
				fuzzyMatches: fuzzyResults.length,
				wordMatches: wordResults.length,
				finalCount: finalResults.length
			}
		};
	}

	/**
	 * Get task IDs from search results
	 * @param {Object} searchResults - Results from findRelevantTasks
	 * @returns {Array<string>} Array of task ID strings
	 */
	getTaskIds(searchResults) {
		return searchResults.results.map((task) => task.id.toString());
	}

	/**
	 * Get task IDs including subtasks from search results
	 * @param {Object} searchResults - Results from findRelevantTasks
	 * @param {boolean} [includeSubtasks=false] - Whether to include subtask IDs
	 * @returns {Array<string>} Array of task and subtask ID strings
	 */
	getTaskIdsWithSubtasks(searchResults, includeSubtasks = false) {
		const taskIds = [];

		for (const task of searchResults.results) {
			taskIds.push(task.id.toString());

			if (includeSubtasks && task.subtasks && task.subtasks.length > 0) {
				for (const subtask of task.subtasks) {
					taskIds.push(`${task.id}.${subtask.id}`);
				}
			}
		}

		return taskIds;
	}

	/**
	 * Format search results for display
	 * @param {Object} searchResults - Results from findRelevantTasks
	 * @param {Object} options - Formatting options
	 * @returns {string} Formatted search results summary
	 */
	formatSearchSummary(searchResults, options = {}) {
		const { includeScores = false, includeBreakdown = false } = options;
		const { results, breakdown, metadata } = searchResults;

		let summary = `Found ${results.length} relevant tasks from ${metadata.totalSearched} total tasks`;

		if (includeBreakdown && breakdown) {
			const parts = [];
			if (breakdown.highRelevance.length > 0)
				parts.push(`${breakdown.highRelevance.length} high relevance`);
			if (breakdown.mediumRelevance.length > 0)
				parts.push(`${breakdown.mediumRelevance.length} medium relevance`);
			if (breakdown.lowRelevance.length > 0)
				parts.push(`${breakdown.lowRelevance.length} low relevance`);
			if (breakdown.categoryTasks.length > 0)
				parts.push(`${breakdown.categoryTasks.length} category matches`);

			if (parts.length > 0) {
				summary += ` (${parts.join(', ')})`;
			}

			if (breakdown.promptCategory) {
				summary += `\nCategory detected: ${breakdown.promptCategory.label}`;
			}
		}

		return summary;
	}
}

/**
 * Factory function to create a fuzzy search instance
 * @param {Array} tasks - Array of task objects
 * @param {string} [searchType='default'] - Type of search configuration to use
 * @returns {FuzzyTaskSearch} Fuzzy search instance
 */
export function createFuzzyTaskSearch(tasks, searchType = 'default') {
	return new FuzzyTaskSearch(tasks, searchType);
}

/**
 * Quick utility function to find relevant task IDs for a prompt
 * @param {Array} tasks - Array of task objects
 * @param {string} prompt - Search prompt
 * @param {Object} options - Search options
 * @returns {Array<string>} Array of relevant task ID strings
 */
export function findRelevantTaskIds(tasks, prompt, options = {}) {
	const {
		searchType = 'default',
		maxResults = 8,
		includeSubtasks = false
	} = options;

	const fuzzySearch = new FuzzyTaskSearch(tasks, searchType);
	const results = fuzzySearch.findRelevantTasks(prompt, { maxResults });

	return includeSubtasks
		? fuzzySearch.getTaskIdsWithSubtasks(results, true)
		: fuzzySearch.getTaskIds(results);
}

export default FuzzyTaskSearch;
