/**
 * contextGatherer.js
 * Comprehensive context gathering utility for Task Master AI operations
 * Supports task context, file context, project tree, and custom context
 */

import fs from 'fs';
import path from 'path';
import pkg from 'gpt-tokens';
import { readJSON, findTaskById, truncate } from '../utils.js';

const { encode } = pkg;

/**
 * Context Gatherer class for collecting and formatting context from various sources
 */
export class ContextGatherer {
	constructor(projectRoot) {
		this.projectRoot = projectRoot;
		this.tasksPath = path.join(projectRoot, 'tasks', 'tasks.json');
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
	 * @returns {Promise<string>} Formatted context string
	 */
	async gather(options = {}) {
		const {
			tasks = [],
			files = [],
			customContext = '',
			includeProjectTree = false,
			format = 'research',
			includeTokenCounts = false
		} = options;

		const contextSections = [];
		const tokenBreakdown = {
			customContext: null,
			tasks: [],
			files: [],
			projectTree: null,
			total: 0
		};

		// Add custom context first if provided
		if (customContext && customContext.trim()) {
			const formattedCustom = this._formatCustomContext(customContext, format);
			contextSections.push(formattedCustom);
			if (includeTokenCounts) {
				tokenBreakdown.customContext = {
					tokens: this.countTokens(formattedCustom),
					characters: formattedCustom.length
				};
			}
		}

		// Add task context
		if (tasks.length > 0) {
			const taskContextResult = await this._gatherTaskContext(
				tasks,
				format,
				includeTokenCounts
			);
			if (taskContextResult.context) {
				contextSections.push(taskContextResult.context);
				if (includeTokenCounts) {
					tokenBreakdown.tasks = taskContextResult.breakdown;
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
				if (includeTokenCounts) {
					tokenBreakdown.files = fileContextResult.breakdown;
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
				if (includeTokenCounts) {
					tokenBreakdown.projectTree = treeContextResult.breakdown;
				}
			}
		}

		// Join all sections based on format
		const finalContext = this._joinContextSections(contextSections, format);

		if (includeTokenCounts) {
			tokenBreakdown.total = this.countTokens(finalContext);
			return {
				context: finalContext,
				tokenBreakdown: tokenBreakdown
			};
		}

		return finalContext;
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
			const tasksData = readJSON(this.tasksPath);
			if (!tasksData || !tasksData.tasks) {
				return { context: null, breakdown: [] };
			}

			const parsedIds = this._parseTaskIds(taskIds);
			const contextItems = [];
			const breakdown = [];

			for (const parsed of parsedIds) {
				let formattedItem = null;
				let itemInfo = null;

				if (parsed.type === 'task') {
					const result = findTaskById(tasksData.tasks, parsed.taskId);
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
					const parentResult = findTaskById(tasksData.tasks, parsed.parentId);
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
					console.warn(`Warning: File not found: ${filePath}`);
					continue;
				}

				const stats = fs.statSync(fullPath);
				if (!stats.isFile()) {
					console.warn(`Warning: Path is not a file: ${filePath}`);
					continue;
				}

				// Check file size (limit to 50KB for context)
				if (stats.size > 50 * 1024) {
					console.warn(
						`Warning: File too large, skipping: ${filePath} (${Math.round(stats.size / 1024)}KB)`
					);
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
