/**
 * context-gatherer.ts
 * Comprehensive context gathering utility for Task Master AI operations
 * Supports task context, file context, project tree, and custom context
 */

import fs from 'fs';
import path from 'path';
import { GPTTokens } from 'gpt-tokens';
import Fuse from 'fuse.js';
import type { IFuseOptions, FuseResult } from 'fuse.js';
import type { Task, Subtask } from '../../../common/types/index.js';

export interface ContextGathererOptions {
	tasks?: string[];
	files?: string[];
	customContext?: string;
	includeProjectTree?: boolean;
	format?: 'research' | 'chat' | 'system-prompt';
	includeTokenCounts?: boolean;
	semanticQuery?: string;
	maxSemanticResults?: number;
	dependencyTasks?: number[];
}

export interface TokenInfo {
	tokens: number;
	characters: number;
}

export interface TaskTokenInfo extends TokenInfo {
	id: string;
	type: 'task' | 'subtask';
	title: string;
	parentTitle?: string;
}

export interface FileTokenInfo {
	path: string;
	sizeKB: number;
	tokens: number;
	characters: number;
}

export interface ProjectTreeTokenInfo {
	tokens: number;
	characters: number;
	fileCount: number;
	dirCount: number;
}

export interface TokenBreakdown {
	total: number;
	customContext: TokenInfo | null;
	tasks: TaskTokenInfo[];
	files: FileTokenInfo[];
	projectTree: ProjectTreeTokenInfo | null;
}

export interface AnalysisData {
	highRelevance: Task[];
	mediumRelevance: Task[];
	recentTasks: Task[];
	allRelevantTasks: Task[];
}

export interface ContextResult {
	context: string;
	analysisData?: AnalysisData;
	contextSections: number;
	finalTaskIds: string[];
	tokenBreakdown?: TokenBreakdown;
}

interface ParsedTaskId {
	type: 'task' | 'subtask';
	taskId?: string;
	parentId?: string;
	subtaskId?: string | number;
	fullId: string;
}

interface FileData {
	path: string;
	size: number;
	content: string;
	lastModified: Date;
}

interface FileTreeNode {
	name: string;
	type: 'file' | 'directory';
	size?: number;
	children?: FileTreeNode[];
	fileCount?: number;
	dirCount?: number;
}

interface DependencyGraphNode extends Omit<Task, 'dependencies'> {
	dependencies: DependencyGraphNode[];
}

interface TaskContextResult {
	context: string | null;
	breakdown: TaskTokenInfo[];
}

interface FileContextResult {
	context: string | null;
	breakdown: FileTokenInfo[];
}

interface ProjectTreeContextResult {
	context: string | null;
	breakdown: ProjectTreeTokenInfo | null;
}

interface SemanticSearchResult {
	tasks: Task[];
	analysisData: AnalysisData;
}

interface DependencyGraphResult {
	allRelatedTaskIds: Set<string>;
	graphs: DependencyGraphNode[];
	depthMap: Map<string, number>;
}

// Placeholder utility functions that need to be imported from utils
function readJSON(tasksPath: string): { tasks: Task[] } | null {
	try {
		const content = fs.readFileSync(tasksPath, 'utf-8');
		return JSON.parse(content);
	} catch {
		return null;
	}
}

function findTaskById(tasks: Task[], taskId: string | number): { task: Task | null } {
	const task = tasks.find(t => String(t.id) === String(taskId));
	return { task: task || null };
}

function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return text.substring(0, maxLength) + '...';
}

/**
 * Context Gatherer class for collecting and formatting context from various sources
 */
export class ContextGatherer {
	private projectRoot: string;
	private tasksPath: string;
	private tag: string; // kept for future use
	private allTasks: Task[];

	constructor(projectRoot: string, _tag: string) {
		this.projectRoot = projectRoot;
		this.tasksPath = path.join(
			projectRoot,
			'.taskmaster',
			'tasks',
			'tasks.json'
		);
		this.tag = _tag;
		this.allTasks = this._loadAllTasks();
	}

	private _loadAllTasks(): Task[] {
		try {
			const data = readJSON(this.tasksPath);
			const tasks = data?.tasks || [];
			return tasks;
		} catch (error) {
			console.warn(
				`Warning: Could not load tasks for ContextGatherer: ${(error as Error).message}`
			);
			return [];
		}
	}

	/**
	 * Count tokens in a text string using gpt-tokens
	 * @param text - Text to count tokens for
	 * @returns Token count
	 */
	countTokens(text: string | null): number {
		if (!text || typeof text !== 'string') {
			return 0;
		}
		try {
			return GPTTokens.contentUsedTokens('gpt-3.5-turbo', text);
		} catch (error) {
			// Fallback to rough character-based estimation if tokenizer fails
			// Rough estimate: ~4 characters per token for English text
			return Math.ceil(text.length / 4);
		}
	}

	/**
	 * Main method to gather context from multiple sources
	 * @param options - Context gathering options
	 * @returns Object with context string and analysis data
	 */
	async gather(options: ContextGathererOptions = {}): Promise<ContextResult> {
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

		const contextSections: string[] = [];
		const finalTaskIds = new Set(tasks.map(String));
		let analysisData: AnalysisData | undefined = undefined;
		let tokenBreakdown: TokenBreakdown | undefined = undefined;

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
			const dependencyResults = this._buildDependencyGraphs(dependencyTasks.map(String));
			dependencyResults.allRelatedTaskIds.forEach((id) =>
				finalTaskIds.add(id)
			);
		}

		// Add custom context first
		if (customContext && customContext.trim()) {
			const formattedCustomContext = this._formatCustomContext(
				customContext,
				format
			);
			contextSections.push(formattedCustomContext);

			// Calculate tokens for custom context if requested
			if (includeTokenCounts && tokenBreakdown) {
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
				if (includeTokenCounts && tokenBreakdown && taskContextResult.breakdown) {
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
				if (includeTokenCounts && tokenBreakdown && fileContextResult.breakdown) {
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
				if (includeTokenCounts && tokenBreakdown && treeContextResult.breakdown) {
					tokenBreakdown.projectTree = treeContextResult.breakdown;
					tokenBreakdown.total += treeContextResult.breakdown.tokens;
				}
			}
		}

		const finalContext = this._joinContextSections(contextSections, format);

		const result: ContextResult = {
			context: finalContext,
			analysisData: analysisData,
			contextSections: contextSections.length,
			finalTaskIds: Array.from(finalTaskIds)
		};

		// Only include tokenBreakdown if it was requested
		if (includeTokenCounts && tokenBreakdown) {
			result.tokenBreakdown = tokenBreakdown;
		}

		return result;
	}

	private _performSemanticSearch(query: string, maxResults: number): SemanticSearchResult {
		type SearchableTask = Task & { dependencyTitles: string };

		const searchableTasks: SearchableTask[] = this.allTasks.map((task) => {
			const dependencyTitles =
				task.dependencies?.length ?? 0 > 0
					? task.dependencies!
							.map((depId) => this.allTasks.find((t) => t.id === depId)?.title)
							.filter(Boolean)
							.join(' ')
					: '';
			return { ...task, dependencyTitles };
		});

		// Use the exact same approach as add-task.js
		const searchOptions: IFuseOptions<any> = {
			includeScore: true,
			threshold: 0.4,
			keys: [
				{ name: 'title', weight: 1.5 },
				{ name: 'description', weight: 2 },
				{ name: 'details', weight: 3 },
				{ name: 'dependencyTitles', weight: 0.5 }
			],
			shouldSort: true,
			useExtendedSearch: true
		};

		// Create search index using Fuse.js
		const fuse = new Fuse(searchableTasks, searchOptions);

		// Extract significant words and phrases from the prompt
		const promptWords = query
			.toLowerCase()
			.replace(/[^\w\s-]/g, ' ')
			.split(/\s+/)
			.filter((word) => word.length > 3);

		// Use the user's prompt for fuzzy search
		const fuzzyResults = fuse.search(query);

		// Also search for each significant word to catch different aspects
		const wordResults: FuseResult<any>[] = [];
		for (const word of promptWords) {
			if (word.length > 5) {
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
			.filter((result) => (result.score ?? 1) < 0.25)
			.map((result) => result.item);

		const mediumRelevance = mergedResults
			.filter((result) => (result.score ?? 1) >= 0.25 && (result.score ?? 1) < 0.4)
			.map((result) => result.item);

		// Get recent tasks (newest first)
		const recentTasks = [...this.allTasks]
			.sort((a, b) => {
				// Handle both numeric and string IDs
				const aNum = Number(a.id);
				const bNum = Number(b.id);
				if (!isNaN(aNum) && !isNaN(bNum)) {
					return bNum - aNum;
				}
				// Fallback to string comparison for non-numeric IDs
				return String(b.id).localeCompare(String(a.id));
			})
			.slice(0, 5)
			.map((task): SearchableTask => ({ ...task, dependencyTitles: '' }));

		// Combine high relevance, medium relevance, and recent tasks
		const allRelevantTasks: SearchableTask[] = [...highRelevance];

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

	private _buildDependencyGraphs(taskIds: string[]): DependencyGraphResult {
		const visited = new Set<string>();
		const depthMap = new Map<string, number>();
		const graphs: DependencyGraphNode[] = [];

		for (const id of taskIds) {
			const graph = this._buildDependencyGraph(id, visited, depthMap);
			if (graph) graphs.push(graph);
		}

		return { allRelatedTaskIds: visited, graphs, depthMap };
	}

	private _buildDependencyGraph(
		taskId: string,
		visited: Set<string>,
		depthMap: Map<string, number>,
		depth = 0
	): DependencyGraphNode | null {
		if (visited.has(taskId) || depth > 5) return null;
		const task = this.allTasks.find((t) => String(t.id) === String(taskId));
		if (!task) return null;

		visited.add(String(task.id));
		if (!depthMap.has(String(task.id)) || depth < depthMap.get(String(task.id))!) {
			depthMap.set(String(task.id), depth);
		}

		const dependencies =
			task.dependencies
				?.map((depId) =>
					this._buildDependencyGraph(String(depId), visited, depthMap, depth + 1)
				)
				.filter((node): node is DependencyGraphNode => node !== null) || [];

		return { ...task, dependencies };
	}

	/**
	 * Parse task ID strings into structured format
	 * Supports formats: "15", "15.2", "16,17.1"
	 * @param taskIds - Array of task ID strings
	 * @returns Parsed task identifiers
	 */
	private _parseTaskIds(taskIds: string[]): ParsedTaskId[] {
		const parsed: ParsedTaskId[] = [];

		for (const idStr of taskIds) {
			if (idStr.includes('.')) {
				// Subtask format: "15.2" or "HAM-123.2"
				const [parentId, subtaskId] = idStr.split('.');
				parsed.push({
					type: 'subtask',
					parentId: parentId,
					subtaskId: isNaN(Number(subtaskId)) ? subtaskId : parseInt(subtaskId, 10),
					fullId: idStr
				});
			} else {
				// Task format: "15" or "HAM-123"
				parsed.push({
					type: 'task',
					taskId: idStr,
					fullId: idStr
				});
			}
		}

		return parsed;
	}

	/**
	 * Gather context from tasks and subtasks
	 * @param taskIds - Task/subtask IDs
	 * @param format - Output format
	 * @param includeTokenCounts - Whether to include token breakdown
	 * @returns Task context result with breakdown
	 */
	private async _gatherTaskContext(
		taskIds: string[],
		format: string,
		includeTokenCounts = false
	): Promise<TaskContextResult> {
		try {
			if (!this.allTasks || this.allTasks.length === 0) {
				return { context: null, breakdown: [] };
			}

			const parsedIds = this._parseTaskIds(taskIds);
			const contextItems: string[] = [];
			const breakdown: TaskTokenInfo[] = [];

			for (const parsed of parsedIds) {
				let formattedItem: string | null = null;
				let itemInfo: TaskTokenInfo | null = null;

				if (parsed.type === 'task' && parsed.taskId) {
					const result = findTaskById(this.allTasks, parsed.taskId);
					if (result.task) {
						formattedItem = this._formatTaskForContext(result.task);
						itemInfo = {
							id: parsed.fullId,
							type: 'task',
							title: result.task.title,
							tokens: includeTokenCounts ? this.countTokens(formattedItem) : 0,
							characters: formattedItem.length
						};
					}
				} else if (parsed.type === 'subtask' && parsed.parentId && parsed.subtaskId !== undefined) {
					const parentResult = findTaskById(this.allTasks, parsed.parentId);
					if (parentResult.task && parentResult.task.subtasks) {
						const subtask = parentResult.task.subtasks.find(
							(st) => String(st.id) === String(parsed.subtaskId)
						);
						if (subtask) {
							formattedItem = this._formatSubtaskForContext(
								subtask,
								parentResult.task,
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
			console.warn(`Warning: Could not gather task context: ${(error as Error).message}`);
			return { context: null, breakdown: [] };
		}
	}

	/**
	 * Format a task for context inclusion
	 * @param task - Task object
	 * @returns Formatted task context
	 */
	private _formatTaskForContext(task: Task): string {
		const sections: string[] = [];

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
	 * @param subtask - Subtask object
	 * @param parentTask - Parent task object
	 * @returns Formatted subtask context
	 */
	private _formatSubtaskForContext(subtask: Subtask, parentTask: Task): string {
		const sections: string[] = [];

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
	 * @param filePaths - File paths to read
	 * @param format - Output format
	 * @param includeTokenCounts - Whether to include token breakdown
	 * @returns File context result with breakdown
	 */
	private async _gatherFileContext(
		filePaths: string[],
		format: string,
		includeTokenCounts = false
	): Promise<FileContextResult> {
		const fileContents: FileData[] = [];
		const breakdown: FileTokenInfo[] = [];

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

				const fileData: FileData = {
					path: relativePath,
					size: stats.size,
					content: content,
					lastModified: stats.mtime
				};

				fileContents.push(fileData);

				// Calculate tokens for this individual file if requested
				if (includeTokenCounts) {
					const formattedFile = this._formatSingleFileForContext(
						fileData);
					breakdown.push({
						path: relativePath,
						sizeKB: Math.round(stats.size / 1024),
						tokens: this.countTokens(formattedFile),
						characters: formattedFile.length
					});
				}
			} catch (error) {
				console.warn(
					`Warning: Could not read file ${filePath}: ${(error as Error).message}`
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
	 * @param format - Output format
	 * @param includeTokenCounts - Whether to include token breakdown
	 * @returns Project tree context result with breakdown
	 */
	private async _gatherProjectTreeContext(
		format: string,
		includeTokenCounts = false
	): Promise<ProjectTreeContextResult> {
		try {
			const tree = this._generateFileTree(this.projectRoot, 5);
			const finalContext = this._formatProjectTreeSection(tree, format);

			const breakdown = includeTokenCounts && tree
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
				`Warning: Could not generate project tree: ${(error as Error).message}`
			);
			return { context: null, breakdown: null };
		}
	}

	/**
	 * Format a single file for context (used for token counting)
	 * @param fileData - File data object
	 * @returns Formatted file context
	 */
	private _formatSingleFileForContext(fileData: FileData): string{
		const header = `**File: ${fileData.path}** (${Math.round(fileData.size / 1024)}KB)`;
		const content = `\`\`\`\n${fileData.content}\n\`\`\``;
		return `${header}\n\n${content}`;
	}

	/**
	 * Generate file tree structure
	 * @param dirPath - Directory path
	 * @param maxDepth - Maximum depth to traverse
	 * @param currentDepth - Current depth
	 * @returns File tree structure
	 */
	private _generateFileTree(
		dirPath: string,
		maxDepth: number,
		currentDepth = 0
	): FileTreeNode | null {
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
			const tree: FileTreeNode = {
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
					tree.dirCount!++;
					if (currentDepth < maxDepth - 1) {
						const subtree = this._generateFileTree(
							itemPath,
							maxDepth,
							currentDepth + 1
						);
						if (subtree) {
							tree.children!.push(subtree);
						}
					}
				} else {
					tree.fileCount!++;
					tree.children!.push({
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
	 * @param customContext - Custom context string
	 * @param format - Output format
	 * @returns Formatted custom context
	 */
	private _formatCustomContext(customContext: string, format: string): string {
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
	 * @param taskItems - Formatted task items
	 * @param format - Output format
	 * @returns Formatted task context section
	 */
	private _formatTaskContextSection(taskItems: string[], format: string): string {
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
	 * @param fileContents - File content objects
	 * @param format - Output format
	 * @returns Formatted file context section
	 */
	private _formatFileContextSection(fileContents: FileData[], format: string): string {
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
	 * @param tree - File tree structure
	 * @param format - Output format
	 * @returns Formatted project tree section
	 */
	private _formatProjectTreeSection(tree: FileTreeNode | null, format: string): string {
		if (!tree) return '';

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
	 * @param tree - File tree structure
	 * @param prefix - Current prefix for indentation
	 * @returns Rendered tree string
	 */
	private _renderFileTree(tree: FileTreeNode, prefix = ''): string {
		let result = `${prefix}${tree.name}/`;

		if ((tree.fileCount ?? 0) > 0 || (tree.dirCount ?? 0) > 0) {
			result += ` (${tree.fileCount} files, ${tree.dirCount} dirs)`;
		}

		result += '\n';

		if (tree.children) {
			tree.children.forEach((child, index) => {
				const isLast = index === tree.children!.length - 1;
				const childPrefix = prefix + (isLast ? '└── ' : '├── ');

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
	 * @param sections - Context sections
	 * @param format - Output format
	 * @returns Joined context string
	 */
	private _joinContextSections(sections: string[], format: string): string {
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
 * @param projectRoot - Project root directory
 * @param tag - Tag for the task
 * @returns Context gatherer instance
 * @throws Error if tag is not provided
 */
export function createContextGatherer(projectRoot: string, tag: string): ContextGatherer {
	if (!tag) {
		throw new Error('Tag is required');
	}
	return new ContextGatherer(projectRoot, tag);
}

export default ContextGatherer;
