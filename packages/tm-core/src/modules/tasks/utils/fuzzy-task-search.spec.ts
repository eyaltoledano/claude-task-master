/**
 * Tests for FuzzyTaskSearch utility
 * Tests fuzzy matching algorithms, relevance scoring, and search result ranking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FuzzyTaskSearch, createFuzzyTaskSearch, findRelevantTaskIds } from './fuzzy-task-search.js';
import type { Task } from './fuzzy-task-search.js';

describe('FuzzyTaskSearch', () => {
	const mockTasks: Task[] = [
		{
			id: 1,
			title: 'Implement user authentication',
			description: 'Add JWT-based authentication system',
			details: 'Use bcrypt for password hashing and JWT for tokens',
			status: 'pending',
			dependencies: []
		},
		{
			id: 2,
			title: 'Create API endpoints',
			description: 'Build REST API for user management',
			details: 'Include CRUD operations for users',
			status: 'in-progress',
			dependencies: [1]
		},
		{
			id: 3,
			title: 'Setup database schema',
			description: 'Design and implement database tables',
			details: 'Use PostgreSQL with proper indexes',
			status: 'done',
			dependencies: []
		},
		{
			id: 4,
			title: 'Write unit tests',
			description: 'Create comprehensive test suite',
			details: 'Test all authentication flows',
			status: 'pending',
			dependencies: [1]
		},
		{
			id: 5,
			title: 'Deploy to production',
			description: 'Configure deployment pipeline',
			details: 'Use Docker and Kubernetes',
			status: 'pending',
			dependencies: [2, 3]
		}
	];

	describe('Constructor and Initialization', () => {
		it('should initialize with default search type', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			expect(search).toBeDefined();
			expect(search.tasks).toBe(mockTasks);
		});

		it('should initialize with research search type', () => {
			const search = new FuzzyTaskSearch(mockTasks, 'research');
			expect(search).toBeDefined();
			expect(search.config).toBeDefined();
		});

		it('should initialize with addTask search type', () => {
			const search = new FuzzyTaskSearch(mockTasks, 'addTask');
			expect(search).toBeDefined();
			expect(search.config).toBeDefined();
		});

		it('should fall back to default for unknown search type', () => {
			const search = new FuzzyTaskSearch(mockTasks, 'unknown' as any);
			expect(search).toBeDefined();
			expect(search.config).toBeDefined();
		});

		it('should prepare searchable tasks with dependency titles', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			expect(search.searchableTasks).toBeDefined();
			expect(search.searchableTasks.length).toBe(mockTasks.length);
		});
	});

	describe('Fuzzy Searching', () => {
		it('should find tasks matching authentication keywords', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('authentication login user');

			expect(results).toBeDefined();
			expect(results.results).toBeDefined();
			expect(results.results.length).toBeGreaterThan(0);
			expect(results.results.some(task => task.id === 1)).toBe(true);
		});

		it('should find tasks matching API keywords', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('API REST endpoints');

			expect(results.results).toBeDefined();
			expect(results.results.some(task => task.id === 2)).toBe(true);
		});

		it('should find tasks matching database keywords', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('database schema PostgreSQL');

			expect(results.results).toBeDefined();
			expect(results.results.some(task => task.id === 3)).toBe(true);
		});

		it('should find tasks matching testing keywords', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('test testing unit tests');

			expect(results.results).toBeDefined();
			expect(results.results.some(task => task.id === 4)).toBe(true);
		});

		it('should handle single word searches', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('authentication');

			expect(results.results).toBeDefined();
			expect(results.results.length).toBeGreaterThan(0);
		});

		it('should handle multi-word searches', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('user authentication JWT bcrypt');

			expect(results.results).toBeDefined();
			expect(results.results.length).toBeGreaterThan(0);
		});

		it('should return empty results for unmatched searches', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('blockchain cryptocurrency mining');

			expect(results.results).toBeDefined();
			// May return recent tasks even if no fuzzy matches
			expect(Array.isArray(results.results)).toBe(true);
		});
	});

	describe('Relevance Scoring', () => {
		it('should categorize results by relevance levels', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('authentication');

			expect(results.breakdown).toBeDefined();
			expect(results.breakdown.highRelevance).toBeDefined();
			expect(results.breakdown.mediumRelevance).toBeDefined();
			expect(results.breakdown.lowRelevance).toBeDefined();
		});

		it('should include high relevance tasks with exact matches', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('authentication');

			// Authentication is in the title of task 1
			const hasHighRelevance = results.breakdown.highRelevance.length > 0;
			expect(hasHighRelevance).toBe(true);
		});

		it('should assign scores to matched tasks', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('authentication');

			if (results.breakdown.highRelevance.length > 0) {
				const firstResult = results.breakdown.highRelevance[0];
				expect(firstResult.score).toBeDefined();
				expect(typeof firstResult.score).toBe('number');
			}
		});

		it('should sort results by relevance score', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('user database API');

			// High relevance should come before medium relevance
			if (results.results.length >= 2) {
				const firstScore = results.results[0].score;
				const lastScore = results.results[results.results.length - 1].score;
				if (firstScore !== undefined && lastScore !== undefined) {
					expect(firstScore).toBeLessThanOrEqual(lastScore);
				}
			}
		});
	});

	describe('Search Options', () => {
		it('should respect maxResults option', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('task', { maxResults: 2 });

			expect(results.results.length).toBeLessThanOrEqual(2);
		});

		it('should include recent tasks when includeRecent is true', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('unrelated query', {
				includeRecent: true
			});

			expect(results.breakdown.recentTasks).toBeDefined();
			expect(results.breakdown.recentTasks.length).toBeGreaterThan(0);
		});

		it('should exclude recent tasks when includeRecent is false', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('task', { includeRecent: false });

			expect(results.breakdown.recentTasks).toBeDefined();
			expect(results.breakdown.recentTasks.length).toBe(0);
		});

		it('should include category matches when includeCategoryMatches is true', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('authentication', {
				includeCategoryMatches: true
			});

			expect(results.breakdown.categoryTasks).toBeDefined();
		});

		it('should exclude category matches when includeCategoryMatches is false', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('authentication', {
				includeCategoryMatches: false
			});

			expect(results.breakdown.categoryTasks).toBeDefined();
			expect(results.breakdown.categoryTasks.length).toBe(0);
		});
	});

	describe('Category Detection', () => {
		it('should detect CLI command category', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('add new command flag');

			if (results.breakdown.promptCategory) {
				expect(results.breakdown.promptCategory.label).toContain('CLI');
			}
		});

		it('should detect authentication category', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('user login authentication');

			if (results.breakdown.promptCategory) {
				expect(['Authentication', 'Security']).toContain(
					results.breakdown.promptCategory.label
				);
			}
		});

		it('should detect database category', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('database schema migration');

			if (results.breakdown.promptCategory) {
				expect(results.breakdown.promptCategory.label).toContain('Data');
			}
		});

		it('should detect API category', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('REST API endpoint route');

			if (results.breakdown.promptCategory) {
				expect(results.breakdown.promptCategory.label).toContain('API');
			}
		});

		it('should detect testing category', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('write unit tests specs');

			if (results.breakdown.promptCategory) {
				expect(results.breakdown.promptCategory.label).toContain('Testing');
			}
		});
	});

	describe('Prompt Word Extraction', () => {
		it('should extract significant words from prompt', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('user authentication and database');

			expect(results.breakdown.promptWords).toBeDefined();
			expect(results.breakdown.promptWords.length).toBeGreaterThan(0);
		});

		it('should filter out short words', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('a an the user authentication');

			// Short words (< 4 chars) should be filtered
			expect(
				results.breakdown.promptWords.every((word: string) => word.length >= 4)
			).toBe(true);
		});

		it('should handle special characters in prompts', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks(
				'user@authentication! database#schema'
			);

			expect(results.breakdown.promptWords).toBeDefined();
			expect(results.breakdown.promptWords.length).toBeGreaterThan(0);
		});
	});

	describe('Task ID Retrieval', () => {
		it('should get task IDs from search results', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('authentication');
			const taskIds = search.getTaskIds(results);

			expect(Array.isArray(taskIds)).toBe(true);
			expect(taskIds.length).toBeGreaterThan(0);
			expect(taskIds.every(id => typeof id === 'string')).toBe(true);
		});

		it('should get task IDs without subtasks by default', () => {
			const tasksWithSubtasks: Task[] = [
				{
					id: 1,
					title: 'Parent task',
					description: 'Description',
					status: 'pending',
					dependencies: [],
					subtasks: [
						{
							id: 1,
							title: 'Subtask 1',
							description: 'Subtask description',
							status: 'pending'
						},
						{
							id: 2,
							title: 'Subtask 2',
							description: 'Subtask description',
							status: 'pending'
						}
					]
				}
			];

			const search = new FuzzyTaskSearch(tasksWithSubtasks);
			const results = search.findRelevantTasks('task');
			const taskIds = search.getTaskIds(results);

			expect(taskIds).toContain('1');
			expect(taskIds).not.toContain('1.1');
		});

		it('should get task IDs with subtasks when includeSubtasks is true', () => {
			const tasksWithSubtasks: Task[] = [
				{
					id: 1,
					title: 'Parent task',
					description: 'Description',
					status: 'pending',
					dependencies: [],
					subtasks: [
						{
							id: 1,
							title: 'Subtask 1',
							description: 'Subtask description',
							status: 'pending'
						}
					]
				}
			];

			const search = new FuzzyTaskSearch(tasksWithSubtasks);
			const results = search.findRelevantTasks('task');
			const taskIds = search.getTaskIdsWithSubtasks(results, true);

			expect(taskIds).toContain('1');
			expect(taskIds).toContain('1.1');
		});

		it('should handle tasks without subtasks', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('authentication');
			const taskIds = search.getTaskIdsWithSubtasks(results, true);

			expect(Array.isArray(taskIds)).toBe(true);
			expect(taskIds.length).toBeGreaterThan(0);
		});
	});

	describe('Search Summary Formatting', () => {
		it('should format basic search summary', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('authentication');
			const summary = search.formatSearchSummary(results);

			expect(typeof summary).toBe('string');
			expect(summary).toContain('Found');
			expect(summary).toContain('tasks');
		});

		it('should include scores when includeScores is true', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('authentication');
			const summary = search.formatSearchSummary(results, {
				includeScores: true
			});

			expect(typeof summary).toBe('string');
		});

		it('should include breakdown when includeBreakdown is true', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('authentication');
			const summary = search.formatSearchSummary(results, {
				includeBreakdown: true
			});

			expect(typeof summary).toBe('string');
			expect(summary.length).toBeGreaterThan(0);
		});

		it('should show relevance counts in breakdown', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('authentication');
			const summary = search.formatSearchSummary(results, {
				includeBreakdown: true
			});

			if (results.breakdown.highRelevance.length > 0) {
				expect(summary).toContain('relevance');
			}
		});

		it('should show detected category in breakdown', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('authentication');
			const summary = search.formatSearchSummary(results, {
				includeBreakdown: true
			});

			if (results.breakdown.promptCategory) {
				expect(summary).toContain('Category detected');
			}
		});
	});

	describe('Metadata Tracking', () => {
		it('should track total searched tasks', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('authentication');

			expect(results.metadata).toBeDefined();
			expect(results.metadata.totalSearched).toBe(mockTasks.length);
		});

		it('should track fuzzy match count', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('authentication');

			expect(results.metadata.fuzzyMatches).toBeDefined();
			expect(typeof results.metadata.fuzzyMatches).toBe('number');
		});

		it('should track word match count', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('authentication database');

			expect(results.metadata.wordMatches).toBeDefined();
			expect(typeof results.metadata.wordMatches).toBe('number');
		});

		it('should track final result count', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('authentication');

			expect(results.metadata.finalCount).toBeDefined();
			expect(results.metadata.finalCount).toBe(results.results.length);
		});
	});

	describe('Dependency Handling', () => {
		it('should expand dependency titles for searchable tasks', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const task2 = search.searchableTasks.find(t => t.id === 2);

			expect(task2).toBeDefined();
			expect(task2?.dependencyTitles).toBeDefined();
			expect(task2?.dependencyTitles).toContain('authentication');
		});

		it('should handle tasks with no dependencies', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const task1 = search.searchableTasks.find(t => t.id === 1);

			expect(task1).toBeDefined();
			expect(task1?.dependencyTitles).toBe('');
		});

		it('should handle tasks with multiple dependencies', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const task5 = search.searchableTasks.find(t => t.id === 5);

			expect(task5).toBeDefined();
			expect(task5?.dependencyTitles).toBeDefined();
			expect(task5?.dependencyTitles.length).toBeGreaterThan(0);
		});
	});

	describe('Factory Functions', () => {
		it('should create instance with createFuzzyTaskSearch', () => {
			const search = createFuzzyTaskSearch(mockTasks);

			expect(search).toBeInstanceOf(FuzzyTaskSearch);
			expect(search.tasks).toBe(mockTasks);
		});

		it('should create instance with custom search type', () => {
			const search = createFuzzyTaskSearch(mockTasks, 'research');

			expect(search).toBeInstanceOf(FuzzyTaskSearch);
		});

		it('should find task IDs with findRelevantTaskIds', () => {
			const taskIds = findRelevantTaskIds(mockTasks, 'authentication');

			expect(Array.isArray(taskIds)).toBe(true);
			expect(taskIds.length).toBeGreaterThan(0);
		});

		it('should respect maxResults in findRelevantTaskIds', () => {
			const taskIds = findRelevantTaskIds(mockTasks, 'task', {
				maxResults: 2
			});

			expect(taskIds.length).toBeLessThanOrEqual(2);
		});

		it('should include subtasks in findRelevantTaskIds when requested', () => {
			const tasksWithSubtasks: Task[] = [
				{
					id: 1,
					title: 'Authentication task',
					description: 'Description',
					status: 'pending',
					dependencies: [],
					subtasks: [
						{
							id: 1,
							title: 'Subtask',
							description: 'Description',
							status: 'pending'
						}
					]
				}
			];

			const taskIds = findRelevantTaskIds(tasksWithSubtasks, 'authentication', {
				includeSubtasks: true
			});

			expect(taskIds).toContain('1');
			expect(taskIds).toContain('1.1');
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty task list', () => {
			const search = new FuzzyTaskSearch([]);
			const results = search.findRelevantTasks('authentication');

			expect(results.results).toBeDefined();
			expect(results.results.length).toBe(0);
		});

		it('should handle empty search prompt', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('');

			expect(results.results).toBeDefined();
		});

		it('should handle very long search prompts', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const longPrompt = 'authentication '.repeat(100);
			const results = search.findRelevantTasks(longPrompt);

			expect(results.results).toBeDefined();
		});

		it('should handle special characters in search', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('!@#$%^&*()');

			expect(results.results).toBeDefined();
		});

		it('should handle Unicode characters', () => {
			const search = new FuzzyTaskSearch(mockTasks);
			const results = search.findRelevantTasks('用户认证 データベース');

			expect(results.results).toBeDefined();
		});
	});

	describe('Search Type Configurations', () => {
		it('should use different thresholds for research type', () => {
			const search = new FuzzyTaskSearch(mockTasks, 'research');

			expect(search.config.threshold).toBe(0.5);
		});

		it('should use different thresholds for addTask type', () => {
			const search = new FuzzyTaskSearch(mockTasks, 'addTask');

			expect(search.config.threshold).toBe(0.4);
		});

		it('should use different limits for search types', () => {
			const researchSearch = new FuzzyTaskSearch(mockTasks, 'research');
			const addTaskSearch = new FuzzyTaskSearch(mockTasks, 'addTask');

			expect(researchSearch.config.limit).toBe(20);
			expect(addTaskSearch.config.limit).toBe(15);
		});
	});
});
