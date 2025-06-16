/**
 * contextGatherer.js
 * Comprehensive context gathering utility for Task Master AI operations
 * Supports task context, file context, project tree, and custom context
 */

import fs from 'fs';
import path from 'path';
import pkg from 'gpt-tokens';
import Fuse from 'fuse.js';
import {
	readJSON,
	findTaskById,
	truncate,
	flattenTasksWithSubtasks
} from '../utils.js';

const { encode } = pkg;

/**
 * Context Gatherer class for collecting and formatting context from various sources
 */
export class ContextGatherer {
	constructor(projectRoot) {
		this.projectRoot = projectRoot;
		this.tasksPath = path.join(
			projectRoot,
			'.taskmaster',
			'tasks',
			'tasks.json'
		);
		this.allTasks = this._loadAllTasks();
	}

	_loadAllTasks() {
		try {
			const data = readJSON(this.tasksPath, this.projectRoot);
			const tasks = data?.tasks || [];
			return tasks;
		} catch (error) {
			console.warn(
				`Warning: Could not load tasks for ContextGatherer: ${error.message}`
			);
			return [];
		}
	}

	/**
	 * Count tokens in a text string using gpt-tokens
	 * @param {string} text - Text to count tokens for
	 * @returns {number} Token count
	 */
	countTokens(text) {
		if (!text || typeof text !== 'string') {
			return 0;
		}
		try {
			return encode(text).length;
		} catch (error) {
			// Fallback to rough character-based estimation if tokenizer fails
			// Rough estimate: ~4 characters per token for English text
			return Math.ceil(text.length / 4);
		}
	}

	/**
	 * Main method to gather context from multiple sources
	 * @param {Object} options - Context gathering options
	 * @param {Array<string>} [options.tasks] - Task/subtask IDs to include
	 * @param {Array<string>} [options.files] - File paths to include
	 * @param {string} [options.customContext] - Additional custom context
	 * @param {boolean} [options.includeProjectTree] - Include project file tree
	 * @param {string} [options.format] - Output format: 'research', 'chat', 'system-prompt'
	 * @param {boolean} [options.includeTokenCounts] - Whether to include token breakdown
	 * @param {string} [options.semanticQuery] - A query string for semantic task searching.
	 * @param {number} [options.maxSemanticResults] - Max number of semantic results.
	 * @param {Array<number>} [options.dependencyTasks] - Array of task IDs to build dependency graphs from.
	 * @returns {Promise<Object>} Object with context string and analysis data
	 */
	async gather(options = {}) {
		const {
			tasks = [],
			files = [],
			customContext = '',
			includeProjectTree = false,
			format = 'research',
			includeTokenCounts = false,
			semanticQuery,
			maxSemanticResults = 10,
			dependencyTasks = []
		} = options;

		const contextSections = [];
		const finalTaskIds = new Set(tasks.map(String));
		let analysisData = null;
		let tokenBreakdown = null;

		// Initialize token breakdown if requested
		if (includeTokenCounts) {
			tokenBreakdown = {
				total: 0,
				customContext: null,
				tasks: [],
				files: [],
				projectTree: null
			};
		}

		// Semantic Search
		if (semanticQuery && this.allTasks.length > 0) {
			const semanticResults = this._performSemanticSearch(
				semanticQuery,
				maxSemanticResults
			);

			// Store the analysis data for UI display
			analysisData = semanticResults.analysisData;

			semanticResults.tasks.forEach((task) => {
				finalTaskIds.add(String(task.id));
			});
		}

		// Dependency Graph Analysis
		if (dependencyTasks.length > 0) {
			const dependencyResults = this._buildDependencyContext(dependencyTasks);
			dependencyResults.allRelatedTaskIds.forEach((id) =>
				finalTaskIds.add(String(id))
			);
			// We can format and add dependencyResults.graphVisualization later if needed
		}

		// Add custom context first
		if (customContext && customContext.trim()) {
			const formattedCustomContext = this._formatCustomContext(
				customContext,
				format
			);
			contextSections.push(formattedCustomContext);

			// Calculate tokens for custom context if requested
			if (includeTokenCounts) {
				tokenBreakdown.customContext = {
					tokens: this.countTokens(formattedCustomContext),
					characters: formattedCustomContext.length
				};
				tokenBreakdown.total += tokenBreakdown.customContext.tokens;
			}
		}

		// Gather context for the final list of tasks
		if (finalTaskIds.size > 0) {
			const taskContextResult = await this._gatherTaskContext(
				Array.from(finalTaskIds),
				format,
				includeTokenCounts
			);
			if (taskContextResult.context) {
				contextSections.push(taskContextResult.context);

				// Add task breakdown if token counting is enabled
				if (includeTokenCounts && taskContextResult.breakdown) {
					tokenBreakdown.tasks = taskContextResult.breakdown;
					const taskTokens = taskContextResult.breakdown.reduce(
						(sum, task) => sum + task.tokens,
						0
					);
					tokenBreakdown.total += taskTokens;
				}
			}
		}

		// Add file context
		if (files.length > 0) {
			const fileContextResult = await this._gatherFileContext(
				files,
				format,
				includeTokenCounts
			);
			if (fileContextResult.context) {
				contextSections.push(fileContextResult.context);

				// Add file breakdown if token counting is enabled
				if (includeTokenCounts && fileContextResult.breakdown) {
					tokenBreakdown.files = fileContextResult.breakdown;
					const fileTokens = fileContextResult.breakdown.reduce(
						(sum, file) => sum + file.tokens,
						0
					);
					tokenBreakdown.total += fileTokens;
				}
			}
		}

		// Add project tree context
		if (includeProjectTree) {
			const treeContextResult = await this._gatherProjectTreeContext(
				format,
				includeTokenCounts
			);
			if (treeContextResult.context) {
				contextSections.push(treeContextResult.context);

				// Add tree breakdown if token counting is enabled
				if (includeTokenCounts && treeContextResult.breakdown) {
					tokenBreakdown.projectTree = treeContextResult.breakdown;
					tokenBreakdown.total += treeContextResult.breakdown.tokens;
				}
			}
		}

		const finalContext = this._joinContextSections(contextSections, format);

		const result = {
			context: finalContext,
			analysisData: analysisData,
			contextSections: contextSections.length,
			finalTaskIds: Array.from(finalTaskIds)
		};

		// Only include tokenBreakdown if it was requested
		if (includeTokenCounts) {
			result.tokenBreakdown = tokenBreakdown;
		}

		return result;
	}

	_performSemanticSearch(query, maxResults) {
		const searchableTasks = this.allTasks.map((task) => {
			const dependencyTitles =
				task.dependencies?.length > 0
					? task.dependencies
							.map((depId) => this.allTasks.find((t) => t.id === depId)?.title)
							.filter(Boolean)
							.join(' ')
					: '';
			return { ...task, dependencyTitles };
		});

		// Use the exact same approach as add-task.js
		const searchOptions = {
			includeScore: true, // Return match scores
			threshold: 0.4, // Lower threshold = stricter matching (range 0-1)
			keys: [
				{ name: 'title', weight: 1.5 }, // Title is most important
				{ name: 'description', weight: 2 }, // Description is very important
				{ name: 'details', weight: 3 }, // Details is most important
				// Search dependencies to find tasks that depend on similar things
				{ name: 'dependencyTitles', weight: 0.5 }
			],
			// Sort matches by score (lower is better)
			shouldSort: true,
			// Allow searching in nested properties
			useExtendedSearch: true,
			// Return up to 50 matches
			limit: 50
		};

		// Create search index using Fuse.js
		const fuse = new Fuse(searchableTasks, searchOptions);

		// Extract significant words and phrases from the prompt (like add-task.js does)
		const promptWords = query
			.toLowerCase()
			.replace(/[^\w\s-]/g, ' ') // Replace non-alphanumeric chars with spaces
			.split(/\s+/)
			.filter((word) => word.length > 3); // Words at least 4 chars

		// Use the user's prompt for fuzzy search
		const fuzzyResults = fuse.search(query);

		// Also search for each significant word to catch different aspects
		const wordResults = [];
		for (const word of promptWords) {
			if (word.length > 5) {
				// Only use significant words
				const results = fuse.search(word);
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
			.filter((result) => result.score < 0.25)
			.map((result) => result.item);

		const mediumRelevance = mergedResults
			.filter((result) => result.score >= 0.25 && result.score < 0.4)
			.map((result) => result.item);

		// Get recent tasks (newest first)
		const recentTasks = [...this.allTasks]
			.sort((a, b) => b.id - a.id)
			.slice(0, 5);

		// Combine high relevance, medium relevance, and recent tasks
		// Prioritize high relevance first
		const allRelevantTasks = [...highRelevance];

		// Add medium relevance if not already included
		for (const task of mediumRelevance) {
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

		// Get top N results for context
		const finalResults = allRelevantTasks.slice(0, maxResults);
		return {
			tasks: finalResults,
			analysisData: {
				highRelevance: highRelevance,
				mediumRelevance: mediumRelevance,
				recentTasks: recentTasks,
				allRelevantTasks: allRelevantTasks
			}
		};
	}

	_buildDependencyContext(taskIds) {
		const { allRelatedTaskIds, graphs, depthMap } =
			this._buildDependencyGraphs(taskIds);
		if (allRelatedTaskIds.size === 0) return '';

		const dependentTasks = Array.from(allRelatedTaskIds)
			.map((id) => this.allTasks.find((t) => t.id === id))
			.filter(Boolean)
			.sort((a, b) => (depthMap.get(a.id) || 0) - (depthMap.get(b.id) || 0));

		const uniqueDetailedTasks = dependentTasks.slice(0, 8);

		let context = `\nThis task relates to a dependency structure with ${dependentTasks.length} related tasks in the chain.`;

		const directDeps = this.allTasks.filter((t) => taskIds.includes(t.id));
		if (directDeps.length > 0) {
			context += `\n\nDirect dependencies:\n${directDeps
				.map((t) => `- Task ${t.id}: ${t.title} - ${t.description}`)
				.join('\n')}`;
		}

		const indirectDeps = dependentTasks.filter((t) => !taskIds.includes(t.id));
		if (indirectDeps.length > 0) {
			context += `\n\nIndirect dependencies (dependencies of dependencies):\n${indirectDeps
				.slice(0, 5)
				.map((t) => `- Task ${t.id}: ${t.title} - ${t.description}`)
				.join('\n')}`;
			if (indirectDeps.length > 5)
				context += `\n- ... and ${
					indirectDeps.length - 5
				} more indirect dependencies`;
		}

		context += `\n\nDetailed information about dependencies:`;
		for (const depTask of uniqueDetailedTasks) {
			const isDirect = taskIds.includes(depTask.id)
				? ' [DIRECT DEPENDENCY]'
				: '';
			context += `\n\n------ Task ${depTask.id}${isDirect}: ${depTask.title} ------\n`;
			context += `Description: ${depTask.description}\n`;
			if (depTask.dependencies?.length) {
				context += `Dependencies: ${depTask.dependencies.join(', ')}\n`;
			}
			if (depTask.details) {
				context += `Implementation Details: ${truncate(
					depTask.details,
					400
				)}\n`;
			}
		}

		if (graphs.length > 0) {
			context += '\n\nDependency Chain Visualization:';
			context += graphs
				.map((graph) => this._formatDependencyChain(graph))
				.join('');
		}

		return context;
	}

	_buildDependencyGraphs(taskIds) {
		const visited = new Set();
		const depthMap = new Map();
		const graphs = [];

		for (const id of taskIds) {
			const graph = this._buildDependencyGraph(id, visited, depthMap);
			if (graph) graphs.push(graph);
		}

		return { allRelatedTaskIds: visited, graphs, depthMap };
	}

	_buildDependencyGraph(taskId, visited, depthMap, depth = 0) {
		if (visited.has(taskId) || depth > 5) return null; // Limit recursion depth
		const task = this.allTasks.find((t) => t.id === taskId);
		if (!task) return null;

		visited.add(taskId);
		if (!depthMap.has(taskId) || depth < depthMap.get(taskId)) {
			depthMap.set(taskId, depth);
		}

		const dependencies =
			task.dependencies
				?.map((depId) =>
					this._buildDependencyGraph(depId, visited, depthMap, depth + 1)
				)
				.filter(Boolean) || [];

		return { ...task, dependencies };
	}

	_formatDependencyChain(node, prefix = '', isLast = true, depth = 0) {
		if (depth > 3) return '';
		const connector = isLast ? '└── ' : '├── ';
		let result = `${prefix}${connector}Task ${node.id}: ${node.title}`;
		if (node.dependencies?.length) {
			const childPrefix = prefix + (isLast ? '    ' : '│   ');
			result += node.dependencies
				.map((dep, index) =>
					this._formatDependencyChain(
						dep,
						childPrefix,
						index === node.dependencies.length - 1,
						depth + 1
					)
				)
				.join('');
		}
		return '\n' + result;
	}

	/**
	 * Parse task ID strings into structured format
	 * Supports formats: "15", "15.2", "16,17.1"
	 * @param {Array<string>} taskIds - Array of task ID strings
	 * @returns {Array<Object>} Parsed task identifiers
	 */
	_parseTaskIds(taskIds) {
		const parsed = [];

		for (const idStr of taskIds) {
			if (idStr.includes('.')) {
				// Subtask format: "15.2"
				const [parentId, subtaskId] = idStr.split('.');
				parsed.push({
					type: 'subtask',
					parentId: parseInt(parentId, 10),
					subtaskId: parseInt(subtaskId, 10),
					fullId: idStr
				});
			} else {
				// Task format: "15"
				parsed.push({
					type: 'task',
					taskId: parseInt(idStr, 10),
					fullId: idStr
				});
			}
		}

		return parsed;
	}

	/**
	 * Gather context from tasks and subtasks
	 * @param {Array<string>} taskIds - Task/subtask IDs
	 * @param {string} format - Output format
	 * @param {boolean} includeTokenCounts - Whether to include token breakdown
	 * @returns {Promise<Object>} Task context result with breakdown
	 */
	async _gatherTaskContext(taskIds, format, includeTokenCounts = false) {
		try {
			if (!this.allTasks || this.allTasks.length === 0) {
				return { context: null, breakdown: [] };
			}

			const parsedIds = this._parseTaskIds(taskIds);
			const contextItems = [];
			const breakdown = [];

			for (const parsed of parsedIds) {
				let formattedItem = null;
				let itemInfo = null;

				if (parsed.type === 'task') {
					const result = findTaskById(this.allTasks, parsed.taskId);
					if (result.task) {
						formattedItem = this._formatTaskForContext(result.task, format);
						itemInfo = {
							id: parsed.fullId,
							type: 'task',
							title: result.task.title,
							tokens: includeTokenCounts ? this.countTokens(formattedItem) : 0,
							characters: formattedItem.length
						};
					}
				} else if (parsed.type === 'subtask') {
					const parentResult = findTaskById(this.allTasks, parsed.parentId);
					if (parentResult.task && parentResult.task.subtasks) {
						const subtask = parentResult.task.subtasks.find(
							(st) => st.id === parsed.subtaskId
						);
						if (subtask) {
							formattedItem = this._formatSubtaskForContext(
								subtask,
								parentResult.task,
								format
							);
							itemInfo = {
								id: parsed.fullId,
								type: 'subtask',
								title: subtask.title,
								parentTitle: parentResult.task.title,
								tokens: includeTokenCounts
									? this.countTokens(formattedItem)
									: 0,
								characters: formattedItem.length
							};
						}
					}
				}

				if (formattedItem && itemInfo) {
					contextItems.push(formattedItem);
					if (includeTokenCounts) {
						breakdown.push(itemInfo);
					}
				}
			}

			if (contextItems.length === 0) {
				return { context: null, breakdown: [] };
			}

			const finalContext = this._formatTaskContextSection(contextItems, format);
			return {
				context: finalContext,
				breakdown: includeTokenCounts ? breakdown : []
			};
		} catch (error) {
			console.warn(`Warning: Could not gather task context: ${error.message}`);
			return { context: null, breakdown: [] };
		}
	}

	/**
	 * Format a task for context inclusion
	 * @param {Object} task - Task object
	 * @param {string} format - Output format
	 * @returns {string} Formatted task context
	 */
	_formatTaskForContext(task, format) {
		const sections = [];

		sections.push(`**Task ${task.id}: ${task.title}**`);
		sections.push(`Description: ${task.description}`);
		sections.push(`Status: ${task.status || 'pending'}`);
		sections.push(`Priority: ${task.priority || 'medium'}`);

		if (task.dependencies && task.dependencies.length > 0) {
			sections.push(`Dependencies: ${task.dependencies.join(', ')}`);
		}

		if (task.details) {
			const details = truncate(task.details, 500);
			sections.push(`Implementation Details: ${details}`);
		}

		if (task.testStrategy) {
			const testStrategy = truncate(task.testStrategy, 300);
			sections.push(`Test Strategy: ${testStrategy}`);
		}

		if (task.subtasks && task.subtasks.length > 0) {
			sections.push(`Subtasks: ${task.subtasks.length} subtasks defined`);
		}

		return sections.join('\n');
	}

	/**
	 * Format a subtask for context inclusion
	 * @param {Object} subtask - Subtask object
	 * @param {Object} parentTask - Parent task object
	 * @param {string} format - Output format
	 * @returns {string} Formatted subtask context
	 */
	_formatSubtaskForContext(subtask, parentTask, format) {
		const sections = [];

		sections.push(
			`**Subtask ${parentTask.id}.${subtask.id}: ${subtask.title}**`
		);
		sections.push(`Parent Task: ${parentTask.title}`);
		sections.push(`Description: ${subtask.description}`);
		sections.push(`Status: ${subtask.status || 'pending'}`);

		if (subtask.dependencies && subtask.dependencies.length > 0) {
			sections.push(`Dependencies: ${subtask.dependencies.join(', ')}`);
		}

		if (subtask.details) {
			const details = truncate(subtask.details, 500);
			sections.push(`Implementation Details: ${details}`);
		}

		return sections.join('\n');
	}

	/**
	 * Gather context from files
	 * @param {Array<string>} filePaths - File paths to read
	 * @param {string} format - Output format
	 * @param {boolean} includeTokenCounts - Whether to include token breakdown
	 * @returns {Promise<Object>} File context result with breakdown
	 */
	async _gatherFileContext(filePaths, format, includeTokenCounts = false) {
		const fileContents = [];
		const breakdown = [];

		for (const filePath of filePaths) {
			try {
				const fullPath = path.isAbsolute(filePath)
					? filePath
					: path.join(this.projectRoot, filePath);

				if (!fs.existsSync(fullPath)) {
					continue;
				}

				const stats = fs.statSync(fullPath);
				if (!stats.isFile()) {
					continue;
				}

				// Check file size (limit to 50KB for context)
				if (stats.size > 50 * 1024) {
					continue;
				}

				const content = fs.readFileSync(fullPath, 'utf-8');
				const relativePath = path.relative(this.projectRoot, fullPath);

				const fileData = {
					path: relativePath,
					size: stats.size,
					content: content,
					lastModified: stats.mtime
				};

				fileContents.push(fileData);

				// Calculate tokens for this individual file if requested
				if (includeTokenCounts) {
					const formattedFile = this._formatSingleFileForContext(
						fileData,
						format
					);
					breakdown.push({
						path: relativePath,
						sizeKB: Math.round(stats.size / 1024),
						tokens: this.countTokens(formattedFile),
						characters: formattedFile.length
					});
				}
			} catch (error) {
				console.warn(
					`Warning: Could not read file ${filePath}: ${error.message}`
				);
			}
		}

		if (fileContents.length === 0) {
			return { context: null, breakdown: [] };
		}

		const finalContext = this._formatFileContextSection(fileContents, format);
		return {
			context: finalContext,
			breakdown: includeTokenCounts ? breakdown : []
		};
	}

	/**
	 * Generate project file tree context
	 * @param {string} format - Output format
	 * @param {boolean} includeTokenCounts - Whether to include token breakdown
	 * @returns {Promise<Object>} Project tree context result with breakdown
	 */
	async _gatherProjectTreeContext(format, includeTokenCounts = false) {
		try {
			const tree = this._generateFileTree(this.projectRoot, 5); // Max depth 5
			const finalContext = this._formatProjectTreeSection(tree, format);

			const breakdown = includeTokenCounts
				? {
						tokens: this.countTokens(finalContext),
						characters: finalContext.length,
						fileCount: tree.fileCount || 0,
						dirCount: tree.dirCount || 0
					}
				: null;

			return {
				context: finalContext,
				breakdown: breakdown
			};
		} catch (error) {
			console.warn(
				`Warning: Could not generate project tree: ${error.message}`
			);
			return { context: null, breakdown: null };
		}
	}

	/**
	 * Format a single file for context (used for token counting)
	 * @param {Object} fileData - File data object
	 * @param {string} format - Output format
	 * @returns {string} Formatted file context
	 */
	_formatSingleFileForContext(fileData, format) {
		const header = `**File: ${fileData.path}** (${Math.round(fileData.size / 1024)}KB)`;
		const content = `\`\`\`\n${fileData.content}\n\`\`\``;
		return `${header}\n\n${content}`;
	}

	/**
	 * Generate file tree structure
	 * @param {string} dirPath - Directory path
	 * @param {number} maxDepth - Maximum depth to traverse
	 * @param {number} currentDepth - Current depth
	 * @returns {Object} File tree structure
	 */
	_generateFileTree(dirPath, maxDepth, currentDepth = 0) {
		const ignoreDirs = [
			'.git',
			'node_modules',
			'.env',
			'coverage',
			'dist',
			'build'
		];
		const ignoreFiles = ['.DS_Store', '.env', '.env.local', '.env.production'];

		if (currentDepth >= maxDepth) {
			return null;
		}

		try {
			const items = fs.readdirSync(dirPath);
			const tree = {
				name: path.basename(dirPath),
				type: 'directory',
				children: [],
				fileCount: 0,
				dirCount: 0
			};

			for (const item of items) {
				if (ignoreDirs.includes(item) || ignoreFiles.includes(item)) {
					continue;
				}

				const itemPath = path.join(dirPath, item);
				const stats = fs.statSync(itemPath);

				if (stats.isDirectory()) {
					tree.dirCount++;
					if (currentDepth < maxDepth - 1) {
						const subtree = this._generateFileTree(
							itemPath,
							maxDepth,
							currentDepth + 1
						);
						if (subtree) {
							tree.children.push(subtree);
						}
					}
				} else {
					tree.fileCount++;
					tree.children.push({
						name: item,
						type: 'file',
						size: stats.size
					});
				}
			}

			return tree;
		} catch (error) {
			return null;
		}
	}

	/**
	 * Format custom context section
	 * @param {string} customContext - Custom context string
	 * @param {string} format - Output format
	 * @returns {string} Formatted custom context
	 */
	_formatCustomContext(customContext, format) {
		switch (format) {
			case 'research':
				return `## Additional Context\n\n${customContext}`;
			case 'chat':
				return `**Additional Context:**\n${customContext}`;
			case 'system-prompt':
				return `Additional context: ${customContext}`;
			default:
				return customContext;
		}
	}

	/**
	 * Format task context section
	 * @param {Array<string>} taskItems - Formatted task items
	 * @param {string} format - Output format
	 * @returns {string} Formatted task context section
	 */
	_formatTaskContextSection(taskItems, format) {
		switch (format) {
			case 'research':
				return `## Task Context\n\n${taskItems.join('\n\n---\n\n')}`;
			case 'chat':
				return `**Task Context:**\n\n${taskItems.join('\n\n')}`;
			case 'system-prompt':
				return `Task context: ${taskItems.join(' | ')}`;
			default:
				return taskItems.join('\n\n');
		}
	}

	/**
	 * Format file context section
	 * @param {Array<Object>} fileContents - File content objects
	 * @param {string} format - Output format
	 * @returns {string} Formatted file context section
	 */
	_formatFileContextSection(fileContents, format) {
		const fileItems = fileContents.map((file) => {
			const header = `**File: ${file.path}** (${Math.round(file.size / 1024)}KB)`;
			const content = `\`\`\`\n${file.content}\n\`\`\``;
			return `${header}\n\n${content}`;
		});

		switch (format) {
			case 'research':
				return `## File Context\n\n${fileItems.join('\n\n---\n\n')}`;
			case 'chat':
				return `**File Context:**\n\n${fileItems.join('\n\n')}`;
			case 'system-prompt':
				return `File context: ${fileContents.map((f) => `${f.path} (${f.content.substring(0, 200)}...)`).join(' | ')}`;
			default:
				return fileItems.join('\n\n');
		}
	}

	/**
	 * Format project tree section
	 * @param {Object} tree - File tree structure
	 * @param {string} format - Output format
	 * @returns {string} Formatted project tree section
	 */
	_formatProjectTreeSection(tree, format) {
		const treeString = this._renderFileTree(tree);

		switch (format) {
			case 'research':
				return `## Project Structure\n\n\`\`\`\n${treeString}\n\`\`\``;
			case 'chat':
				return `**Project Structure:**\n\`\`\`\n${treeString}\n\`\`\``;
			case 'system-prompt':
				return `Project structure: ${treeString.replace(/\n/g, ' | ')}`;
			default:
				return treeString;
		}
	}

	/**
	 * Render file tree as string
	 * @param {Object} tree - File tree structure
	 * @param {string} prefix - Current prefix for indentation
	 * @returns {string} Rendered tree string
	 */
	_renderFileTree(tree, prefix = '') {
		let result = `${prefix}${tree.name}/`;

		if (tree.fileCount > 0 || tree.dirCount > 0) {
			result += ` (${tree.fileCount} files, ${tree.dirCount} dirs)`;
		}

		result += '\n';

		if (tree.children) {
			tree.children.forEach((child, index) => {
				const isLast = index === tree.children.length - 1;
				const childPrefix = prefix + (isLast ? '└── ' : '├── ');
				const nextPrefix = prefix + (isLast ? '    ' : '│   ');

				if (child.type === 'directory') {
					result += this._renderFileTree(child, childPrefix);
				} else {
					result += `${childPrefix}${child.name}\n`;
				}
			});
		}

		return result;
	}

	/**
	 * Join context sections based on format
	 * @param {Array<string>} sections - Context sections
	 * @param {string} format - Output format
	 * @returns {string} Joined context string
	 */
	_joinContextSections(sections, format) {
		if (sections.length === 0) {
			return '';
		}

		switch (format) {
			case 'research':
				return sections.join('\n\n---\n\n');
			case 'chat':
				return sections.join('\n\n');
			case 'system-prompt':
				return sections.join(' ');
			default:
				return sections.join('\n\n');
		}
	}
}

/**
 * Factory function to create a context gatherer instance
 * @param {string} projectRoot - Project root directory
 * @returns {ContextGatherer} Context gatherer instance
 */
export function createContextGatherer(projectRoot) {
	return new ContextGatherer(projectRoot);
}

export default ContextGatherer;
