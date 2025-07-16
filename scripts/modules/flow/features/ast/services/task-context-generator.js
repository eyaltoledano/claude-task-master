/**
 * Task Context Generator - Main orchestrator for context generation
 *
 * This service coordinates all context generation components to create
 * comprehensive context for Claude Code or VibeKit agents.
 */

import { ProjectDetector } from '../../../shared/services/context-generation/project-detector.js';
import { TaskEnhancer } from '../../../shared/services/context-generation/task-enhancer.js';
import { GitContextGenerator } from '../../../shared/services/context-generation/git-context-generator.js';
import { ProjectStructureAnalyzer } from './project-structure-analyzer.js';
import { MarkdownFormatter } from '../../../shared/services/context-generation/markdown-formatter.js';

export class TaskContextGenerator {
	constructor(options = {}) {
		this.backend = options.backend;
		this.projectRoot = options.projectRoot || process.cwd();

		// AST is optional - detect capability
		this.astMode = this.detectASTMode(options);
		this.astAvailable = false;

		// Initialize generators
		this.taskEnhancer = new TaskEnhancer(this.backend);
		this.gitGenerator = new GitContextGenerator(this.projectRoot);
		this.projectAnalyzer = new ProjectStructureAnalyzer(
			this.projectRoot,
			this.astMode
		);
		this.markdownFormatter = new MarkdownFormatter();

		// Project detection
		this.projectDetector = new ProjectDetector(this.projectRoot);
		this.projectInfo = null;
	}

	detectASTMode(options) {
		if (options.disableAST === true) return 'none';
		if (options.astMode) return options.astMode;

		// Default to optional - will try to use AST if available
		return 'optional';
	}

	async initialize() {
		try {
			// Detect project info and AST capability
			this.projectInfo = await this.projectDetector.detectProjectRepo();

			// Update AST availability based on project detection
			if (this.projectInfo.available && this.projectInfo.astReady) {
				this.astAvailable = true;

				// Update project analyzer with confirmed AST mode
				if (this.astMode === 'optional') {
					this.projectAnalyzer = new ProjectStructureAnalyzer(
						this.projectRoot,
						this.astAvailable ? 'full' : 'none'
					);
				}
			}

			return {
				success: true,
				projectInfo: this.projectInfo,
				astAvailable: this.astAvailable,
				astMode: this.astMode
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	async generateContext(options = {}) {
		const {
			tasks = [],
			includeGitContext = true,
			includeProjectStructure = true,
			executionOptions = {},
			format = 'markdown', // 'markdown', 'minimal', 'json'
			customSections = []
		} = options;

		try {
			// Initialize if not done already
			if (!this.projectInfo) {
				const initResult = await this.initialize();
				if (!initResult.success) {
					throw new Error(`Initialization failed: ${initResult.error}`);
				}
			}

			// Parallel data gathering
			const contextPromises = [];

			// Always enhance tasks
			if (tasks.length > 0) {
				contextPromises.push(
					this.enhanceTasks(tasks).then((result) => ({
						type: 'tasks',
						data: result
					}))
				);
			}

			// Git context
			if (includeGitContext) {
				contextPromises.push(
					this.gitGenerator
						.generateGitContext()
						.then((result) => ({ type: 'git', data: result }))
				);
			}

			// Project structure
			if (includeProjectStructure) {
				contextPromises.push(
					this.projectAnalyzer
						.analyzeProject()
						.then((result) => ({ type: 'project', data: result }))
				);
			}

			// Wait for all context gathering
			const contextResults = await Promise.all(contextPromises);

			// Organize results
			const context = {
				projectInfo: this.getProjectInfo(),
				enhancedTasks: [],
				taskHierarchy: null,
				gitContext: null,
				projectAnalysis: null,
				executionOptions,
				customSections,
				metadata: {
					generated: new Date().toISOString(),
					astMode: this.astMode,
					astAvailable: this.astAvailable
				}
			};

			contextResults.forEach((result) => {
				switch (result.type) {
					case 'tasks':
						context.enhancedTasks = result.data.enhanced;
						context.taskHierarchy = result.data.hierarchy;
						break;
					case 'git':
						context.gitContext = result.data;
						break;
					case 'project':
						context.projectAnalysis = result.data;
						break;
				}
			});

			// Format output based on requested format
			return this.formatContext(context, format);
		} catch (error) {
			throw new Error(`Context generation failed: ${error.message}`);
		}
	}

	async enhanceTasks(tasks) {
		try {
			// Enhance tasks with parent information
			const enhancedTasks = await this.taskEnhancer.enhanceTasks(tasks);

			// Organize into hierarchy
			const taskHierarchy =
				this.taskEnhancer.organizeTaskHierarchy(enhancedTasks);

			return {
				enhanced: enhancedTasks,
				hierarchy: taskHierarchy
			};
		} catch (error) {
			console.warn('Task enhancement failed:', error.message);
			return {
				enhanced: tasks,
				hierarchy: null
			};
		}
	}

	formatContext(context, format) {
		switch (format) {
			case 'minimal':
				return this.markdownFormatter.generateMinimalContext(context);

			case 'json':
				return {
					format: 'json',
					data: context
				};

			default:
				return {
					format: 'markdown',
					content: this.markdownFormatter.generateClaudeMarkdown(context),
					data: context
				};
		}
	}

	getProjectInfo() {
		if (!this.projectInfo) return { path: this.projectRoot };

		return {
			name: this.extractProjectName(),
			path: this.projectRoot,
			type: this.projectInfo.type,
			hasRemote: this.projectInfo.hasRemote,
			isGitHub: this.projectInfo.isGitHub,
			githubUrl: this.projectInfo.githubUrl,
			branch: this.projectInfo.branch,
			astAvailable: this.astAvailable
		};
	}

	extractProjectName() {
		// Try to get name from package.json first
		try {
			const packagePath = require('path').join(
				this.projectRoot,
				'package.json'
			);
			const packageInfo = require(packagePath);
			if (packageInfo.name) return packageInfo.name;
		} catch {
			// Fall back to directory name
		}

		return require('path').basename(this.projectRoot);
	}

	/**
	 * Generate context for specific task(s)
	 */
	async generateTaskSpecificContext(taskIds, options = {}) {
		try {
			// Get tasks from backend
			const tasks = await Promise.all(
				taskIds.map(async (id) => {
					try {
						return await this.backend.getTask(id);
					} catch (error) {
						console.warn(`Failed to load task ${id}:`, error.message);
						return null;
					}
				})
			);

			const validTasks = tasks.filter(Boolean);

			if (validTasks.length === 0) {
				throw new Error('No valid tasks found');
			}

			// Extract keywords from tasks for targeted analysis
			const taskKeywords = validTasks.flatMap((task) =>
				this.taskEnhancer.extractTaskKeywords(task)
			);

			// Generate context with task-specific focus
			const context = await this.generateContext({
				...options,
				tasks: validTasks
			});

			// Add task-specific project analysis if available
			if (this.astAvailable && taskKeywords.length > 0) {
				try {
					const taskSpecificProject =
						await this.projectAnalyzer.getTaskSpecificContext(taskKeywords);
					context.data.projectAnalysis = {
						...context.data.projectAnalysis,
						taskSpecific: taskSpecificProject
					};
				} catch (error) {
					console.warn(
						'Failed to get task-specific project context:',
						error.message
					);
				}
			}

			return context;
		} catch (error) {
			throw new Error(
				`Task-specific context generation failed: ${error.message}`
			);
		}
	}

	/**
	 * Get project status for UI display
	 */
	async getProjectStatus() {
		try {
			if (!this.projectInfo) {
				await this.initialize();
			}

			return {
				projectPath: this.projectRoot,
				projectName: this.extractProjectName(),
				gitRepo: this.projectInfo?.available || false,
				hasRemote: this.projectInfo?.hasRemote || false,
				isGitHub: this.projectInfo?.isGitHub || false,
				astAvailable: this.astAvailable,
				astMode: this.astMode,
				needsSync: this.projectInfo?.needsSync || false,
				hasUncommittedChanges: this.projectInfo?.hasUncommittedChanges || false,
				branch: this.projectInfo?.branch || 'unknown',
				lastUpdated: new Date().toISOString()
			};
		} catch (error) {
			return {
				error: error.message,
				projectPath: this.projectRoot,
				lastUpdated: new Date().toISOString()
			};
		}
	}

	/**
	 * Quick context generation for immediate use
	 */
	async generateQuickContext(taskId = null) {
		try {
			const tasks = [];

			if (taskId) {
				try {
					const task = await this.backend.getTask(taskId);
					if (task) tasks.push(task);
				} catch (error) {
					console.warn(`Failed to load task ${taskId}:`, error.message);
				}
			}

			// Get minimal git context only
			const gitContext = await this.gitGenerator.generateGitContext();

			return this.markdownFormatter.generateMinimalContext({
				enhancedTasks: tasks,
				projectInfo: this.getProjectInfo(),
				gitContext
			});
		} catch (error) {
			throw new Error(`Quick context generation failed: ${error.message}`);
		}
	}
}
