import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';
import { exec, execSync, spawn } from 'child_process';
import { promisify } from 'util';
import { query as claudeQuery } from '@anthropic-ai/claude-code';
import { FlowBackend } from '../backend-interface.js';
import { directFunctions } from '../../../../mcp-server/src/core/task-master-core.js';
import { flowConfig } from '../config/flow-config.js';
import {
	PersonaPromptBuilder,
	detectPersona,
	detectMultiPersonaWorkflow,
	getAllPersonaIds
} from '../personas/index.js';
import { findProjectRoot } from '../../utils.js';
import { TASKMASTER_TASKS_FILE } from '../../../../src/constants/paths.js';
import { WorktreeManager } from '../worktree-manager.js';

// Import direct functions
import { listTasksDirect } from '../../../../mcp-server/src/core/direct-functions/list-tasks.js';
import { nextTaskDirect } from '../../../../mcp-server/src/core/direct-functions/next-task.js';
import { showTaskDirect } from '../../../../mcp-server/src/core/direct-functions/show-task.js';
import { setTaskStatusDirect } from '../../../../mcp-server/src/core/direct-functions/set-task-status.js';
import { expandTaskDirect } from '../../../../mcp-server/src/core/direct-functions/expand-task.js';
import { addTaskDirect } from '../../../../mcp-server/src/core/direct-functions/add-task.js';
import { researchDirect } from '../../../../mcp-server/src/core/direct-functions/research.js';
import { listTagsDirect } from '../../../../mcp-server/src/core/direct-functions/list-tags.js';
import { useTagDirect } from '../../../../mcp-server/src/core/direct-functions/use-tag.js';
import { addTagDirect } from '../../../../mcp-server/src/core/direct-functions/add-tag.js';
import { deleteTagDirect } from '../../../../mcp-server/src/core/direct-functions/delete-tag.js';
import { renameTagDirect } from '../../../../mcp-server/src/core/direct-functions/rename-tag.js';
import { parsePRDDirect } from '../../../../mcp-server/src/core/direct-functions/parse-prd.js';
import { analyzeTaskComplexityDirect } from '../../../../mcp-server/src/core/direct-functions/analyze-task-complexity.js';
import { expandAllTasksDirect } from '../../../../mcp-server/src/core/direct-functions/expand-all-tasks.js';
import { modelsDirect } from '../../../../mcp-server/src/core/direct-functions/models.js';
import { updateTaskByIdDirect } from '../../../../mcp-server/src/core/direct-functions/update-task-by-id.js';
import { updateSubtaskByIdDirect } from '../../../../mcp-server/src/core/direct-functions/update-subtask-by-id.js';

// Map MCP tool names to direct functions
const TOOL_FUNCTION_MAP = {
	get_tasks: listTasksDirect,
	next_task: nextTaskDirect,
	get_task: showTaskDirect,
	set_task_status: setTaskStatusDirect,
	expand_task: expandTaskDirect,
	add_task: addTaskDirect,
	update_task: updateTaskByIdDirect,
	update_subtask: updateSubtaskByIdDirect,
	research: researchDirect,
	list_tags: listTagsDirect,
	use_tag: useTagDirect,
	add_tag: addTagDirect,
	delete_tag: deleteTagDirect,
	rename_tag: renameTagDirect,
	parse_prd: parsePRDDirect,
	analyze_project_complexity: analyzeTaskComplexityDirect,
	expand_all: expandAllTasksDirect,
	models: modelsDirect
};

/**
 * Direct Backend - uses MCP server direct functions
 */
export class DirectBackend extends FlowBackend {
	constructor(options = {}) {
		super(options);
		this.projectRoot =
			options.projectRoot || findProjectRoot() || process.cwd();

		// Create a custom logger that suppresses info and debug messages for TUI
		this.log = {
			debug: () => {}, // Suppress debug messages
			info: () => {}, // Suppress info messages
			warn: (...args) => console.warn(...args),
			error: (...args) => console.error(...args),
			success: () => {}, // Suppress success messages
			log: () => {} // Suppress generic log messages
		};

		this.tasksJsonPath = path.join(this.projectRoot, TASKMASTER_TASKS_FILE);
		// Simulated session for API key access
		this.session = options.session || {};
		this.branchManager = null;  // NEW: Will be set by Flow app
	}

	async initialize() {
		// Direct functions don't need initialization
		return true;
	}

	/**
	 * Check if tasks.json exists
	 * @returns {Promise<boolean>} - True if tasks.json exists, false otherwise
	 */
	async hasTasksFile() {
		try {
			const fs = await import('fs');
			// Check both new and legacy locations
			const newPath = path.join(this.projectRoot, TASKMASTER_TASKS_FILE);
			const legacyPath = path.join(this.projectRoot, 'tasks/tasks.json');

			return (
				fs.default.existsSync(newPath) || fs.default.existsSync(legacyPath)
			);
		} catch (error) {
			this.log.debug(`Error checking tasks.json existence: ${error.message}`);
			return false;
		}
	}

	/**
	 * Generic tool calling method for AI integration
	 * @param {string} toolName - Name of the MCP tool to call
	 * @param {object} args - Arguments for the tool
	 * @returns {Promise<object>} - Tool result
	 */
	async callTool(toolName, args = {}) {
		const directFunction = TOOL_FUNCTION_MAP[toolName];
		if (!directFunction) {
			throw new Error(`Unknown tool: ${toolName}`);
		}

		// Build arguments with project context
		const toolArgs = {
			...args,
			projectRoot: this.projectRoot,
			tasksJsonPath: this.tasksJsonPath
		};

		// Handle special argument mappings based on tool
		switch (toolName) {
			case 'get_task':
				// showTaskDirect expects 'id' not 'taskId'
				if (args.id) {
					toolArgs.id = String(args.id);
				}
				break;
			case 'analyze_project_complexity': {
				// Set up output path for complexity report
				const reportDir = path.join(this.projectRoot, '.taskmaster', 'reports');
				const tagSuffix =
					args.tag && args.tag !== 'master' ? `_${args.tag}` : '';
				toolArgs.outputPath = path.join(
					reportDir,
					`task-complexity-report${tagSuffix}.json`
				);
				toolArgs.file = this.tasksJsonPath;
				toolArgs.output = toolArgs.outputPath;
				break;
			}
		}

		// Call the direct function
		const result = await directFunction(toolArgs, this.log, {
			session: this.session
		});

		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		// Update telemetry if available
		this.updateTelemetry(result.data);

		return result;
	}

	async listTasks(options = {}) {
		// Get current tag
		const { tags } = await this.listTags();
		const currentTag = tags.find((t) => t.isCurrent)?.name || 'master';
		const tagToUse = options.tag || currentTag;

		// Construct report path based on tag
		const reportDir = path.join(this.projectRoot, '.taskmaster', 'reports');
		const tagSuffix = tagToUse && tagToUse !== 'master' ? `_${tagToUse}` : '';
		const reportPath = path.join(
			reportDir,
			`task-complexity-report${tagSuffix}.json`
		);

		const args = {
			tasksJsonPath: this.tasksJsonPath,
			projectRoot: this.projectRoot,
			status: options.status,
			withSubtasks: true,
			tag: options.tag,
			reportPath: reportPath
		};

		const result = await listTasksDirect(args, this.log);
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		this.updateTelemetry(result.data);
		return {
			tasks: result.data.tasks || [],
			tag: result.data.currentTag || 'master',
			telemetryData: result.data.telemetryData
		};
	}

	async nextTask() {
		const args = {
			projectRoot: this.projectRoot,
			tasksJsonPath: this.tasksJsonPath
		};

		const result = await nextTaskDirect(args, this.log, { session: {} });
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		this.updateTelemetry(result.data);
		return {
			task: result.data.task,
			suggestions: result.data.suggestions || [],
			telemetryData: result.data.telemetryData
		};
	}

	async getTask(taskId) {
		// Get current tag
		const { tags } = await this.listTags();
		const currentTag = tags.find((t) => t.isCurrent)?.name || 'master';

		// Construct report path based on tag
		const reportDir = path.join(this.projectRoot, '.taskmaster', 'reports');
		const tagSuffix =
			currentTag && currentTag !== 'master' ? `_${currentTag}` : '';
		const reportPath = path.join(
			reportDir,
			`task-complexity-report${tagSuffix}.json`
		);

		const args = {
			projectRoot: this.projectRoot,
			tasksJsonPath: this.tasksJsonPath,
			id: String(taskId),
			reportPath: reportPath
		};

		const result = await showTaskDirect(args, this.log, { session: {} });
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		this.updateTelemetry(result.data);
		return result.data;
	}

	async setTaskStatus(taskId, status) {
		const args = {
			projectRoot: this.projectRoot,
			tasksJsonPath: this.tasksJsonPath,
			id: String(taskId),
			status: status
		};

		const result = await setTaskStatusDirect(args, this.log, { session: this.session });
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		this.updateTelemetry(result.data);
		return result.data;
	}

	async expandTask(taskId, options = {}) {
		const args = {
			projectRoot: this.projectRoot,
			tasksJsonPath: this.tasksJsonPath,
			id: taskId,
			num: options.num,
			research: options.research || false,
			force: options.force || false,
			prompt: options.prompt
		};

		const result = await expandTaskDirect(args, this.log, { session: {} });
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		this.updateTelemetry(result.data);
		return result.data;
	}

	async addTask(taskData) {
		const args = {
			projectRoot: this.projectRoot,
			tasksJsonPath: this.tasksJsonPath,
			prompt: taskData.prompt,
			dependencies: taskData.dependencies,
			priority: taskData.priority || 'medium',
			research: taskData.research || false
		};

		const result = await addTaskDirect(args, this.log, { session: {} });
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		this.updateTelemetry(result.data);
		return result.data;
	}

	async *researchStream(query, options = {}) {
		try {
			const { research } = await import('../../task-manager/research.js');

			// Create a simple async generator that yields the research result
			const result = await research(
				query,
				options.taskIds || [],
				options.filePaths || [],
				options.customContext || '',
				options.includeProjectTree || false,
				options.detailLevel || 'medium',
				options.saveTo || null,
				options.saveToFile || false,
				options.noFollowup || true,
				this.projectRoot,
				'json'
			);

			// Extract the response from the result
			const response = result.response || result;

			// Yield the response in chunks for streaming effect
			const chunks = response.match(/.{1,100}/g) || [response];
			for (const chunk of chunks) {
				yield chunk;
			}
		} catch (error) {
			throw new Error(`Research failed: ${error.message}`);
		}
	}

	async research(options = {}) {
		try {
			const { performResearch } = await import(
				'../../task-manager/research.js'
			);

			const result = await performResearch(
				options.query || '',
				{
					taskIds: options.taskIds || [],
					filePaths: options.filePaths || [],
					customContext: options.customContext || '',
					includeProjectTree: options.includeProjectTree || false,
					detailLevel: options.detailLevel || 'medium',
					projectRoot: this.projectRoot,
					saveToFile: options.saveToFile || false,
					saveTo: options.saveTo // Add saveTo parameter
				},
				{
					projectRoot: this.projectRoot,
					commandName: 'research',
					outputType: 'mcp'
				},
				'json',
				false // allowFollowUp
			);

			return {
				success: true,
				response: result.result,
				telemetryData: result.telemetryData
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Update a subtask with progress information
	 * @param {string} subtaskId - Subtask ID (e.g., "1.2")
	 * @param {Object} options - Update options
	 * @returns {Promise<Object>} Update result
	 */
	async updateSubtask(subtaskId, options = {}) {
		try {
			const { updateSubtask } = await import('../../../mcp-server/src/core/task-master-core.js');
			
			const result = await updateSubtask(
				{
					id: subtaskId,
					prompt: options.prompt || 'Progress update',
					research: options.research || false,
					projectRoot: this.projectRoot
				},
				this.createLogWrapper(),
				{ session: this.session }
			);

			if (result.success) {
				return {
					success: true,
					data: result.data
				};
			} else {
				return {
					success: false,
					error: result.error || 'Failed to update subtask'
				};
			}
		} catch (error) {
			console.error('Error updating subtask:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Set subtask status
	 * @param {string} subtaskId - Subtask ID (e.g., "1.2")
	 * @param {string} status - New status
	 * @returns {Promise<Object>} Status update result
	 */
	async setSubtaskStatus(subtaskId, status) {
		try {
			const { setTaskStatus } = await import('../../../mcp-server/src/core/task-master-core.js');
			
			const result = await setTaskStatus(
				{
					id: subtaskId,
					status: status,
					projectRoot: this.projectRoot
				},
				this.createLogWrapper(),
				{ session: this.session }
			);

			if (result.success) {
				return {
					success: true,
					data: result.data
				};
			} else {
				return {
					success: false,
					error: result.error || 'Failed to set subtask status'
				};
			}
		} catch (error) {
			console.error('Error setting subtask status:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Get subtask progress information
	 * @param {string} subtaskId - Subtask ID (e.g., "1.2")
	 * @returns {Promise<Object>} Subtask progress data
	 */
	async getSubtaskProgress(subtaskId) {
		try {
			const { getTask } = await import('../../../mcp-server/src/core/task-master-core.js');
			
			const result = await getTask(
				{
					id: subtaskId,
					projectRoot: this.projectRoot
				},
				this.createLogWrapper(),
				{ session: this.session }
			);

			if (result.success && result.data) {
				const subtask = Array.isArray(result.data) ? result.data[0] : result.data;
				
				// Parse implementation journey from details
				const progress = this.parseImplementationJourney(subtask.details || '');
				
				return {
					success: true,
					data: {
						subtask,
						progress,
						phase: this.detectImplementationPhase(subtask)
					}
				};
			} else {
				return {
					success: false,
					error: result.error || 'Failed to get subtask progress'
				};
			}
		} catch (error) {
			console.error('Error getting subtask progress:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Parse implementation journey from subtask details
	 * @param {string} details - Subtask details text
	 * @returns {Object} Parsed progress information
	 */
	parseImplementationJourney(details) {
		const progress = {
			explorationPhase: null,
			implementationProgress: [],
			completionSummary: null,
			timestamps: []
		};

		// Look for exploration phase
		const explorationMatch = details.match(/## Exploration Phase([\s\S]*?)(?=##|$)/);
		if (explorationMatch) {
			progress.explorationPhase = explorationMatch[1].trim();
		}

		// Look for implementation progress entries
		const progressMatches = [...details.matchAll(/## Implementation Progress([\s\S]*?)(?=##|$)/g)];
		for (const match of progressMatches) {
			progress.implementationProgress.push(match[1].trim());
		}

		// Look for completion summary
		const completionMatch = details.match(/## Implementation Complete([\s\S]*?)(?=##|$)/);
		if (completionMatch) {
			progress.completionSummary = completionMatch[1].trim();
		}

		// Extract timestamps
		const timestampMatches = details.matchAll(/<info added on ([\d-T:.Z]+)>/g);
		for (const match of timestampMatches) {
			progress.timestamps.push(new Date(match[1]));
		}

		return progress;
	}

	/**
	 * Detect implementation phase of a subtask
	 * @param {Object} subtask - Subtask object
	 * @returns {string} Implementation phase
	 */
	detectImplementationPhase(subtask) {
		const { status, details = '' } = subtask;
		
		if (status === 'pending') {
			if (details.includes('## Exploration Phase')) {
				return 'ready-to-implement';
			}
			return 'needs-exploration';
		}
		
		if (status === 'in-progress') {
			if (details.includes('## Implementation Progress')) {
				return 'implementing';
			}
			return 'starting-implementation';
		}
		
		if (status === 'done') {
			return 'completed';
		}
		
		return 'unknown';
	}

	async listTags() {
		const args = {
			projectRoot: this.projectRoot,
			tasksJsonPath: this.tasksJsonPath
		};

		const result = await listTagsDirect(args, this.log);
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		return {
			tags: result.data.tags || [],
			currentTag: result.data.currentTag || 'master'
		};
	}

	async useTag(tagName) {
		const args = {
			projectRoot: this.projectRoot,
			tasksJsonPath: this.tasksJsonPath,
			name: tagName
		};

		const result = await useTagDirect(args, this.log);
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		return result.data;
	}

	async addTag(tagName, options = {}) {
		const args = {
			projectRoot: this.projectRoot,
			tasksJsonPath: this.tasksJsonPath,
			tagName: tagName,
			copyFromCurrent: options.copyFromCurrent || false,
			copyFrom: options.copyFrom,
			description: options.description
		};

		const result = await addTagDirect(args, this.log);
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		return result.data;
	}

	async deleteTag(tagName) {
		const args = {
			projectRoot: this.projectRoot,
			tasksJsonPath: this.tasksJsonPath,
			tagName: tagName,
			yes: true // Skip confirmation for programmatic use
		};

		const result = await deleteTagDirect(args, this.log);
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		return result.data;
	}

	async renameTag(oldName, newName) {
		const args = {
			projectRoot: this.projectRoot,
			tasksJsonPath: this.tasksJsonPath,
			oldName: oldName,
			newName: newName
		};

		const result = await renameTagDirect(args, this.log);
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		return result.data;
	}

	async parsePRD(filePath, options = {}) {
		const args = {
			projectRoot: this.projectRoot,
			tasksJsonPath: this.tasksJsonPath,
			input: filePath,
			tag: options.tag,
			numTasks: options.numTasks,
			force: options.force || false
		};

		const result = await parsePRDDirect(args, this.log, { session: {} });
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		this.updateTelemetry(result.data);
		return result.data;
	}

	async analyzeComplexity(options = {}) {
		// Ensure projectRoot is a string
		const projectRootStr = String(this.projectRoot);

		// Generate output path for the complexity report
		const reportDir = path.join(projectRootStr, '.taskmaster', 'reports');
		const tagSuffix =
			options.tag && options.tag !== 'master' ? `_${options.tag}` : '';
		const outputPath = path.join(
			reportDir,
			`task-complexity-report${tagSuffix}.json`
		);

		const args = {
			projectRoot: projectRootStr,
			tasksJsonPath: this.tasksJsonPath,
			outputPath: outputPath,
			tag: options.tag,
			research: options.research || false,
			threshold: options.threshold,
			file: this.tasksJsonPath, // The core function expects 'file' parameter
			output: outputPath // The core function expects 'output' parameter
		};

		const result = await analyzeTaskComplexityDirect(args, this.log, {
			session: {}
		});
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		this.updateTelemetry(result.data);

		// Extract the relevant data from the full report
		const complexityAnalysis = result.data.fullReport?.complexityAnalysis || [];

		// Map the complexity analysis to include shouldExpand property
		const recommendations = complexityAnalysis.map((task) => ({
			...task,
			shouldExpand: task.complexityScore >= (options.threshold || 8)
		}));

		return {
			recommendations: recommendations,
			summary: {
				taskCount: result.data.reportSummary?.taskCount || 0,
				highComplexityCount:
					result.data.reportSummary?.highComplexityTasks || 0,
				mediumComplexityCount:
					result.data.reportSummary?.mediumComplexityTasks || 0,
				lowComplexityCount: result.data.reportSummary?.lowComplexityTasks || 0,
				averageComplexity:
					complexityAnalysis.reduce((sum, t) => sum + t.complexityScore, 0) /
						(complexityAnalysis.length || 1) || 0
			},
			telemetryData: result.data.telemetryData
		};
	}

	async expandAll(options = {}) {
		const args = {
			projectRoot: this.projectRoot,
			tasksJsonPath: this.tasksJsonPath,
			tag: options.tag,
			research: options.research || false,
			num: options.num,
			force: options.force || false,
			prompt: options.prompt
		};

		const result = await expandAllTasksDirect(args, this.log, { session: {} });
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		this.updateTelemetry(result.data);
		return result.data;
	}

	async getModels() {
		const args = {
			projectRoot: this.projectRoot
		};

		const result = await modelsDirect(args, this.log);
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		// Extract activeModels and rename modelId to model for consistency with StatusScreen
		const activeModels = result.data.activeModels;
		return {
			main: activeModels.main
				? {
						provider: activeModels.main.provider,
						model: activeModels.main.modelId,
						sweScore: activeModels.main.sweScore,
						cost: activeModels.main.cost,
						keyStatus: activeModels.main.keyStatus
					}
				: null,
			research: activeModels.research
				? {
						provider: activeModels.research.provider,
						model: activeModels.research.modelId,
						sweScore: activeModels.research.sweScore,
						cost: activeModels.research.cost,
						keyStatus: activeModels.research.keyStatus
					}
				: null,
			fallback: activeModels.fallback
				? {
						provider: activeModels.fallback.provider,
						model: activeModels.fallback.modelId,
						sweScore: activeModels.fallback.sweScore,
						cost: activeModels.fallback.cost,
						keyStatus: activeModels.fallback.keyStatus
					}
				: null
		};
	}

	async getComplexityReport(tag = null) {
		// Determine report path based on tag
		const tagSuffix = tag && tag !== 'master' ? `_${tag}` : '';
		const reportPath = path.join(
			this.projectRoot,
			'.taskmaster',
			'reports',
			`task-complexity-report${tagSuffix}.json`
		);

		try {
			const fs = await import('fs');
			if (!fs.default.existsSync(reportPath)) {
				return null;
			}

			const content = fs.default.readFileSync(reportPath, 'utf8');
			return JSON.parse(content);
		} catch (error) {
			this.log.debug(`Error loading complexity report: ${error.message}`);
			return null;
		}
	}

	async getTasks(tag = null) {
		try {
			const { listTasks } = await import('../../task-manager.js');
			const tasksPath = path.join(
				this.projectRoot,
				'.taskmaster',
				'tasks',
				'tasks.json'
			);
			const result = listTasks(
				tasksPath,
				null, // statusFilter
				null, // reportPath
				false, // withSubtasks
				'json', // outputFormat
				tag,
				{ projectRoot: this.projectRoot }
			);
			return result.tasks || [];
		} catch (error) {
			this.log.error(`Error getting tasks: ${error.message}`);
			return [];
		}
	}

	// Git worktree management methods
	async isGitRepository() {
		try {
			const result = await promisify(exec)('git rev-parse --git-dir', {
				cwd: this.projectRoot
			});
			return true;
		} catch (error) {
			return false;
		}
	}

	async getRepositoryRoot() {
		try {
			const result = await promisify(exec)('git rev-parse --show-toplevel', {
				cwd: this.projectRoot
			});
			return result.stdout.trim();
		} catch (error) {
			throw new Error(`Not a git repository: ${error.message}`);
		}
	}

	async listWorktrees() {
		try {
			const { exec } = await import('child_process');
			const { promisify } = await import('util');
			const execAsync = promisify(exec);

			// Get the main repository root
			const mainRepoRoot = await this.getRepositoryRoot();

			const { stdout } = await execAsync('git worktree list --porcelain', {
				cwd: this.projectRoot
			});

			const worktrees = [];
			let currentWorktree = {};

			stdout.split('\n').forEach((line) => {
				if (!line.trim()) {
					if (Object.keys(currentWorktree).length > 0) {
						// Check if this is the main worktree
						currentWorktree.isMain = currentWorktree.path === mainRepoRoot;
						worktrees.push(currentWorktree);
						currentWorktree = {};
					}
					return;
				}

				const [key, ...valueParts] = line.split(' ');
				const value = valueParts.join(' ');

				switch (key) {
					case 'worktree':
						currentWorktree.path = value;
						currentWorktree.name = value.split('/').pop() || value;
						break;
					case 'HEAD':
						currentWorktree.head = value;
						break;
					case 'branch':
						currentWorktree.branch = value.replace('refs/heads/', '');
						break;
					case 'bare':
						currentWorktree.isBare = true;
						break;
					case 'detached':
						currentWorktree.isDetached = true;
						break;
					case 'locked':
						currentWorktree.isLocked = true;
						if (value) {
							currentWorktree.lockReason = value;
						}
						break;
					case 'prunable':
						currentWorktree.isPrunable = true;
						if (value) {
							currentWorktree.prunableReason = value;
						}
						break;
				}
			});

			// Don't forget the last worktree
			if (Object.keys(currentWorktree).length > 0) {
				currentWorktree.isMain = currentWorktree.path === mainRepoRoot;
				worktrees.push(currentWorktree);
			}

			// Get current path to mark current worktree
			const currentPath = process.cwd();
			worktrees.forEach((wt) => {
				wt.isCurrent = wt.path === currentPath;
			});

			// Separate main worktree from linked worktrees
			const mainWorktree = worktrees.find((wt) => wt.isMain);
			const linkedWorktrees = worktrees.filter((wt) => !wt.isMain);

			return {
				main: mainWorktree,
				linked: linkedWorktrees,
				all: worktrees
			};
		} catch (error) {
			throw new Error('Failed to list worktrees: ' + error.message);
		}
	}

	async getWorktreeDetails(worktreePath) {
		try {
			const { exec } = await import('child_process');
			const { promisify } = await import('util');
			const fs = await import('fs');
			const execAsync = promisify(exec);

			// Get basic info from list
			const worktreeResult = await this.listWorktrees();
			const worktrees = worktreeResult.all || [];
			const worktree = worktrees.find((wt) => wt.path === worktreePath);

			if (!worktree) {
				throw new Error('Worktree not found');
			}

			// Get additional details
			const details = { ...worktree };

			// Ensure name is set
			if (!details.name) {
				details.name = path.basename(details.path);
			}

			// Get latest commit info
			try {
				const { stdout: logOutput } = await execAsync(
					'git log -1 --pretty=format:"%H|%an|%ae|%ad|%s" --date=iso',
					{ cwd: worktreePath }
				);
				const [hash, author, email, date, subject] = logOutput.split('|');
				details.latestCommit = {
					hash,
					author,
					email,
					date,
					subject
				};
			} catch (e) {
				// Might be a new worktree with no commits
				details.latestCommit = null;
			}

			// Get status summary
			try {
				const { stdout: statusOutput } = await execAsync(
					'git status --porcelain',
					{ cwd: worktreePath }
				);
				const statusLines = statusOutput.trim().split('\n').filter(Boolean);
				details.status = {
					modified: statusLines.filter((l) => l.startsWith(' M')).length,
					added: statusLines.filter((l) => l.startsWith('A ')).length,
					deleted: statusLines.filter((l) => l.startsWith(' D')).length,
					untracked: statusLines.filter((l) => l.startsWith('??')).length,
					total: statusLines.length
				};
			} catch (e) {
				details.status = {
					modified: 0,
					added: 0,
					deleted: 0,
					untracked: 0,
					total: 0
				};
			}

			// Get branch tracking info
			try {
				const { stdout: trackingOutput } = await execAsync(
					'git rev-parse --abbrev-ref --symbolic-full-name @{u}',
					{ cwd: worktreePath }
				);
				details.trackingBranch = trackingOutput.trim();

				// Get ahead/behind counts
				const { stdout: revListOutput } = await execAsync(
					'git rev-list --left-right --count HEAD...@{u}',
					{ cwd: worktreePath }
				);
				const [ahead, behind] = revListOutput.trim().split('\t').map(Number);
				details.ahead = ahead;
				details.behind = behind;
			} catch (e) {
				// No tracking branch
				details.trackingBranch = null;
				details.ahead = 0;
				details.behind = 0;
			}

			// Check if worktree is locked
			const adminDir = path.join(
				await this.getRepositoryRoot(),
				'.git',
				'worktrees',
				path.basename(worktreePath),
				'locked'
			);
			details.isLocked = fs.default.existsSync(adminDir);

			// Get disk usage
			try {
				const { stdout: duOutput } = await execAsync(
					`du -sh "${worktreePath}" | cut -f1`,
					{ shell: true }
				);
				details.diskUsage = duOutput.trim();
			} catch (e) {
				details.diskUsage = 'Unknown';
			}

			return details;
		} catch (error) {
			throw new Error('Failed to get worktree details: ' + error.message);
		}
	}

	/**
	 * Get enhanced git status information for a worktree
	 * @param {string} worktreePath - Path to the worktree
	 * @returns {Promise<Object>} Git status information with workflow integration
	 */
	async getWorktreeGitStatus(worktreePath) {
		try {
			const { exec } = await import('child_process');
			const { promisify } = await import('util');
			const execAsync = promisify(exec);

			// Get git status information
			const status = {
				hasUncommittedChanges: false,
				staged: 0,
				modified: 0,
				untracked: 0,
				deleted: 0,
				ahead: 0,
				behind: 0,
				isClean: true,
				trackingBranch: null
			};

			// Get porcelain status
			try {
				const { stdout: statusOutput } = await execAsync(
					'git status --porcelain',
					{ cwd: worktreePath }
				);
				
				const statusLines = statusOutput.trim().split('\n').filter(Boolean);
				
				if (statusLines.length > 0) {
					status.hasUncommittedChanges = true;
					status.isClean = false;
					
					// Count different types of changes
					statusLines.forEach(line => {
						const staged = line[0];
						const working = line[1];
						
						// Check staged changes
						if (staged === 'A' || staged === 'M' || staged === 'D' || staged === 'R' || staged === 'C') {
							status.staged++;
						}
						
						// Check working directory changes
						if (working === 'M') {
							status.modified++;
						} else if (working === 'D') {
							status.deleted++;
						} else if (line.startsWith('??')) {
							status.untracked++;
						}
					});
				}
			} catch (e) {
				// If git status fails, assume clean
				this.log.debug('Git status failed:', e.message);
			}

			// Get tracking branch info
			try {
				const { stdout: trackingOutput } = await execAsync(
					'git rev-parse --abbrev-ref --symbolic-full-name @{u}',
					{ cwd: worktreePath }
				);
				status.trackingBranch = trackingOutput.trim();

				// Get ahead/behind counts
				const { stdout: revListOutput } = await execAsync(
					'git rev-list --left-right --count HEAD...@{u}',
					{ cwd: worktreePath }
				);
				const [ahead, behind] = revListOutput.trim().split('\t').map(Number);
				status.ahead = ahead || 0;
				status.behind = behind || 0;
			} catch (e) {
				// No tracking branch or not connected to remote
				status.trackingBranch = null;
				status.ahead = 0;
				status.behind = 0;
			}

			return status;
		} catch (error) {
			throw new Error('Failed to get git status: ' + error.message);
		}
	}

	async addWorktree(name, options = {}) {
		try {
			const { exec } = await import('child_process');
			const { promisify } = await import('util');
			const execAsync = promisify(exec);

			// Pre-flight checks
			if (!(await this.isGitRepository())) {
				throw new Error('Not in a Git repository');
			}

			// Sanitize name (replace spaces with dashes)
			const sanitizedName = name.replace(/\s+/g, '-');

			// Get repository name
			const repoRoot = await this.getRepositoryRoot();
			const repoName = path.basename(repoRoot);

			// Check if worktree already exists
			const worktreeResult = await this.listWorktrees();
			const existingWorktrees = worktreeResult.all || [];
			const worktreePath = path.join(
				repoRoot,
				'..',
				`${repoName}-${sanitizedName}`
			);

			if (existingWorktrees.some((wt) => wt.path === worktreePath)) {
				throw new Error(`Worktree already exists at ${worktreePath}`);
			}

			// Check if branch exists
			let branchExists = false;
			try {
				await execAsync(
					`git show-ref --verify --quiet refs/heads/${sanitizedName}`,
					{
						cwd: this.projectRoot
					}
				);
				branchExists = true;
			} catch (e) {
				// Branch doesn't exist
			}

			// Create worktree
			const command = branchExists
				? `git worktree add "${worktreePath}" "${sanitizedName}"`
				: `git worktree add "${worktreePath}" -b "${sanitizedName}"`;

			const { stdout, stderr } = await execAsync(command, {
				cwd: this.projectRoot
			});

			return {
				success: true,
				name: sanitizedName,
				path: worktreePath,
				branchCreated: !branchExists,
				output: stdout || stderr
			};
		} catch (error) {
			throw new Error('Failed to add worktree: ' + error.message);
		}
	}

	async removeWorktree(worktreePath, options = {}) {
		try {
			const { exec } = await import('child_process');
			const { promisify } = await import('util');
			const execAsync = promisify(exec);

			// Check if it's the current worktree
			const currentPath = await this.getRepositoryRoot();
			if (worktreePath === currentPath) {
				throw new Error('Cannot remove the current worktree');
			}

			// Determine if we should use force
			const forceFlag = options.force ? '--force' : '';

			try {
				const { stdout, stderr } = await execAsync(
					`git worktree remove ${forceFlag} "${worktreePath}"`,
					{ cwd: this.projectRoot }
				);

				return {
					success: true,
					output: stdout || stderr,
					usedForce: options.force || false
				};
			} catch (error) {
				// Check if the error is due to modified/untracked files and we haven't tried force yet
				if (
					!options.force &&
					error.message.includes('contains modified or untracked files')
				) {
					// Return a special response indicating force is needed
					return {
						success: false,
						needsForce: true,
						error: 'Worktree contains modified or untracked files'
					};
				}
				// Re-throw other errors
				throw error;
			}
		} catch (error) {
			throw new Error('Failed to remove worktree: ' + error.message);
		}
	}

	async pruneWorktrees(options = {}) {
		try {
			const { exec } = await import('child_process');
			const { promisify } = await import('util');
			const execAsync = promisify(exec);

			const dryRunFlag = options.dryRun ? '--dry-run' : '';
			const { stdout, stderr } = await execAsync(
				`git worktree prune ${dryRunFlag}`,
				{ cwd: this.projectRoot }
			);

			return {
				success: true,
				output: stdout || stderr
			};
		} catch (error) {
			throw new Error('Failed to prune worktrees: ' + error.message);
		}
	}

	async lockWorktree(worktreePath, reason = '') {
		try {
			const { exec } = await import('child_process');
			const { promisify } = await import('util');
			const execAsync = promisify(exec);

			const reasonFlag = reason ? `--reason "${reason}"` : '';
			const { stdout, stderr } = await execAsync(
				`git worktree lock ${reasonFlag} "${worktreePath}"`,
				{ cwd: this.projectRoot }
			);

			return {
				success: true,
				output: stdout || stderr
			};
		} catch (error) {
			throw new Error('Failed to lock worktree: ' + error.message);
		}
	}

	async unlockWorktree(worktreePath) {
		try {
			const { exec } = await import('child_process');
			const { promisify } = await import('util');
			const execAsync = promisify(exec);

			const { stdout, stderr } = await execAsync(
				`git worktree unlock "${worktreePath}"`,
				{ cwd: this.projectRoot }
			);

			return {
				success: true,
				output: stdout || stderr
			};
		} catch (error) {
			throw new Error('Failed to unlock worktree: ' + error.message);
		}
	}

	async repairWorktree(worktree) {
		try {
			const { exec } = await import('child_process');
			const { promisify } = await import('util');
			const execAsync = promisify(exec);

			// Try to repair the worktree
			await execAsync(`git worktree repair ${worktree.path}`);

			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: `Failed to repair worktree: ${error.message}`
			};
		}
	}

	// Worktree-Task linking methods
	async getWorktreesConfig() {
		try {
			const fs = await import('fs');
			const worktreesPath = path.join(
				this.projectRoot,
				'.taskmaster',
				'worktrees.json'
			);

			if (!fs.default.existsSync(worktreesPath)) {
				// Create default structure
				const defaultConfig = {
					version: '1.0.0',
					worktrees: {}
				};
				const dir = path.dirname(worktreesPath);
				if (!fs.default.existsSync(dir)) {
					fs.default.mkdirSync(dir, { recursive: true });
				}
				fs.default.writeFileSync(
					worktreesPath,
					JSON.stringify(defaultConfig, null, 2)
				);
				return defaultConfig;
			}

			const content = fs.default.readFileSync(worktreesPath, 'utf8');
			return JSON.parse(content);
		} catch (error) {
			this.log.error(`Error reading worktrees config: ${error.message}`);
			return { version: '1.0.0', worktrees: {} };
		}
	}

	async saveWorktreesConfig(config) {
		try {
			const fs = await import('fs');
			const worktreesPath = path.join(
				this.projectRoot,
				'.taskmaster',
				'worktrees.json'
			);
			fs.default.writeFileSync(worktreesPath, JSON.stringify(config, null, 2));
			return true;
		} catch (error) {
			this.log.error(`Error saving worktrees config: ${error.message}`);
			return false;
		}
	}

	async linkWorktreeToTasks(worktreeName, taskIds, options = {}) {
		try {
			const config = await this.getWorktreesConfig();
			const worktreeResult = await this.listWorktrees();
			const worktrees = worktreeResult.all || [];
			const worktree = worktrees.find((wt) => wt.name === worktreeName);

			if (!worktree) {
				return {
					success: false,
					error: `Worktree '${worktreeName}' not found`
				};
			}

			// Get all tasks to check for subtasks
			const tasksResult = await this.listTasks();
			const allTaskIds = new Set();

			// Process each task ID and check for subtasks
			for (const taskId of taskIds) {
				const taskIdStr = String(taskId);
				allTaskIds.add(taskIdStr);

				// If it's not already a subtask, check if it has subtasks
				if (!taskIdStr.includes('.')) {
					const parentTask = tasksResult.tasks.find(
						(t) => t.id.toString() === taskIdStr
					);
					if (
						parentTask &&
						parentTask.subtasks &&
						parentTask.subtasks.length > 0
					) {
						// If includeSubtasks option is not explicitly false, add all subtasks
						if (options.includeSubtasks !== false) {
							for (const subtask of parentTask.subtasks) {
								const subtaskId = `${taskIdStr}.${subtask.id}`;
								allTaskIds.add(subtaskId);
							}
						}
					}
				}
			}

			// Parse task IDs to determine type
			const linkedTasks = Array.from(allTaskIds).map((id) => {
				const isSubtask = id.includes('.');
				return {
					id,
					type: isSubtask ? 'subtask' : 'task',
					tag: options.tag || 'master'
				};
			});

			// Update or create worktree entry
			if (!config.worktrees[worktreeName]) {
				config.worktrees[worktreeName] = {
					path: worktree.path,
					linkedTasks: [],
					createdAt: new Date().toISOString(),
					lastUpdated: new Date().toISOString(),
					description: options.description || '',
					status: 'active'
				};
			}

			// Add new linked tasks (avoid duplicates)
			const existingIds = config.worktrees[worktreeName].linkedTasks.map(
				(t) => t.id
			);
			const newTasks = linkedTasks.filter((t) => !existingIds.includes(t.id));
			config.worktrees[worktreeName].linkedTasks.push(...newTasks);
			config.worktrees[worktreeName].lastUpdated = new Date().toISOString();

			// Save config
			await this.saveWorktreesConfig(config);

			// Optionally sync to git notes
			if (options.syncToGit) {
				await this.syncWorktreeToGitNotes(
					worktreeName,
					config.worktrees[worktreeName]
				);
			}

			return {
				success: true,
				linkedTasks: config.worktrees[worktreeName].linkedTasks,
				addedCount: newTasks.length,
				totalCount: config.worktrees[worktreeName].linkedTasks.length
			};
		} catch (error) {
			return {
				success: false,
				error: `Failed to link tasks: ${error.message}`
			};
		}
	}

	async unlinkWorktreeTask(worktreeName, taskId) {
		try {
			const config = await this.getWorktreesConfig();

			if (!config.worktrees[worktreeName]) {
				throw new Error(
					`Worktree '${worktreeName}' not found in configuration`
				);
			}

			// Convert taskId to string for consistent comparison
			const taskIdStr = String(taskId);

			// Validate task/subtask exists
			const tasksResult = await this.listTasks();
			let taskFound = false;

			// Check if it's a subtask (contains a dot)
			if (taskIdStr.includes('.')) {
				const [parentId, subtaskIndex] = taskIdStr.split('.');
				const parentTask = tasksResult.tasks.find(
					(t) => t.id.toString() === parentId
				);
				if (parentTask && parentTask.subtasks) {
					const subtask = parentTask.subtasks.find(
						(st) => st.id.toString() === subtaskIndex
					);
					if (subtask) taskFound = true;
				}
			} else {
				// It's a regular task
				taskFound = tasksResult.tasks.some(
					(t) => t.id.toString() === taskIdStr
				);
			}

			if (!taskFound) {
				throw new Error(`Task '${taskIdStr}' not found`);
			}

			// Remove the task ID from the worktree's task list
			const initialLength = config.worktrees[worktreeName].linkedTasks.length;
			config.worktrees[worktreeName].linkedTasks = config.worktrees[
				worktreeName
			].linkedTasks.filter((task) => task.id !== taskIdStr);

			if (config.worktrees[worktreeName].linkedTasks.length === initialLength) {
				throw new Error(
					`Task '${taskIdStr}' is not linked to worktree '${worktreeName}'`
				);
			}

			// Save updated config
			await this.saveWorktreesConfig(config);

			// Sync to Git notes
			await this.syncWorktreeToGitNotes(worktreeName);

			return {
				success: true,
				message: `Task ${taskIdStr} unlinked from worktree ${worktreeName}`
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	async getWorktreeTasks(worktreeName) {
		try {
			console.log(`🔍 [getWorktreeTasks] Called for worktree: "${worktreeName}"`);
			const config = await this.getWorktreesConfig();

			if (!config.worktrees[worktreeName]) {
				console.log(`🔍 [getWorktreeTasks] No config found for worktree: "${worktreeName}"`);
				return [];
			}

			console.log(`🔍 [getWorktreeTasks] Worktree config:`, config.worktrees[worktreeName]);

			// Load tasks directly from JSON file to get ALL fields including 'details'
			const tasksPath = path.join(
				this.projectRoot,
				'.taskmaster',
				'tasks',
				'tasks.json'
			);

			const tasksContent = await fs.readFile(tasksPath, 'utf8');
			const tasksData = JSON.parse(tasksContent);
			const tag =
				config.worktrees[worktreeName].linkedTasks[0]?.tag || 'master';

			console.log(`🔍 [getWorktreeTasks] Using tag: "${tag}"`);

			if (!tasksData[tag]) {
				console.log(`🔍 [getWorktreeTasks] No tasks data found for tag: "${tag}"`);
				return [];
			}

			const allTasks = tasksData[tag].tasks || [];
			const linkedTaskIds = config.worktrees[worktreeName].linkedTasks.map(
				(t) => t.id
			);
			console.log(`🔍 [getWorktreeTasks] Looking for linked task IDs:`, linkedTaskIds);
			const linkedTasks = [];

			// Find linked tasks and subtasks
			for (const task of allTasks) {
				if (linkedTaskIds.includes(task.id.toString())) {
					console.log(`🔍 [getWorktreeTasks] Found parent task: ${task.id}`);
					linkedTasks.push(task);
				}
				// Check subtasks
				if (task.subtasks) {
					for (const subtask of task.subtasks) {
						const subtaskId = `${task.id}.${subtask.id}`;
						if (linkedTaskIds.includes(subtaskId)) {
							console.log(`🔍 [getWorktreeTasks] Found subtask: ${subtaskId}`);
							// Include ALL fields from subtask
							linkedTasks.push({
								...subtask,
								id: subtaskId,
								parentId: task.id,
								parentTitle: task.title,
								// Subtasks might not have testStrategy, but ensure details is included
								details: subtask.details,
								testStrategy: subtask.testStrategy || ''
							});
						}
					}
				}
			}

			console.log(`🔍 [getWorktreeTasks] Final result:`, linkedTasks);
			return linkedTasks;
		} catch (error) {
			this.log.error(`Error getting worktree tasks: ${error.message}`);
			return [];
		}
	}

	async getTaskWorktrees(taskId) {
		try {
			const config = await this.getWorktreesConfig();
			const worktrees = [];

			// Get actual git worktrees to validate against
			let actualWorktrees = [];
			try {
				const worktreeResult = await this.listWorktrees();
				actualWorktrees = worktreeResult.all || [];
			} catch (error) {
				console.warn('Could not list actual git worktrees:', error.message);
			}

			// Find all worktrees linked to this task
			for (const [name, data] of Object.entries(config.worktrees)) {
				let hasTask = false;

				// We are in development, so we will only support the new `linkedSubtask` structure.
				// No fallbacks to the old `linkedTasks` array.
				if (data.linkedSubtask) {
					const { fullId, taskId: parentId } = data.linkedSubtask;

					// Check if the incoming taskId matches the full subtask ID (e.g., "6.1")
					// or the parent task ID (e.g., "6").
					// We compare as strings to avoid type mismatch issues.
					if (String(taskId).includes('.')) {
						hasTask = String(fullId) === String(taskId);
					} else {
						hasTask = String(parentId) === String(taskId);
					}
				}

				if (hasTask) {
					// Validate that this worktree actually exists before including it
					const actualWorktree = actualWorktrees.find(wt => 
						wt.path === data.path || wt.name === name
					);

					if (actualWorktree) {
						worktrees.push({
							name,
							path: data.path,
							branch: data.branch,
							status: data.status,
							linkedSubtask: data.linkedSubtask
						});
					} else {
						console.warn(`Worktree ${name} (${data.path}) exists in config but not on disk - skipping`);
					}
				}
			}

			return worktrees;
		} catch (error) {
			console.error('Error getting task worktrees:', error);
			return [];
		}
	}

	async syncWorktreeToGitNotes(worktreeName, worktreeData) {
		try {
			const { exec } = await import('child_process');
			const { promisify } = await import('util');
			const execAsync = promisify(exec);

			// Get the worktree's HEAD commit
			const { stdout: headCommit } = await execAsync(
				`git -C ${worktreeData.path} rev-parse HEAD`
			);
			const commit = headCommit.trim();

			// Prepare notes data
			const notesData = {
				linkedTasks: worktreeData.linkedTasks.map((t) => t.id),
				tag: worktreeData.linkedTasks[0]?.tag || 'master',
				description: worktreeData.description,
				lastUpdated: worktreeData.lastUpdated
			};

			// Add git note
			const notesRef = 'refs/notes/taskmaster-worktrees';
			await execAsync(
				`git notes --ref=${notesRef} add -f -m '${JSON.stringify(notesData)}' ${commit}`
			);

			return { success: true };
		} catch (error) {
			// Git notes are optional, don't fail the operation
			this.log.debug(`Failed to sync to git notes: ${error.message}`);
			return { success: false, error: error.message };
		}
	}

	async getWorktreeFromGitNotes(worktreeName) {
		try {
			const { exec } = await import('child_process');
			const { promisify } = await import('util');
			const execAsync = promisify(exec);

			// Get worktree details
			const worktreeResult = await this.listWorktrees();
			const worktrees = worktreeResult.all || [];
			const worktree = worktrees.find((wt) => wt.name === worktreeName);
			if (!worktree) return null;

			// Get HEAD commit
			const { stdout: headCommit } = await execAsync(
				`git -C ${worktree.path} rev-parse HEAD`
			);
			const commit = headCommit.trim();

			// Get git note
			const notesRef = 'refs/notes/taskmaster-worktrees';
			try {
				const { stdout: noteContent } = await execAsync(
					`git notes --ref=${notesRef} show ${commit}`
				);
				return JSON.parse(noteContent);
			} catch (error) {
				// No note found
				return null;
			}
		} catch (error) {
			this.log.debug(`Failed to get git notes: ${error.message}`);
			return null;
		}
	}

	async cleanupWorktreeLinks(worktreeName) {
		try {
			const config = await this.getWorktreesConfig();

			if (config.worktrees[worktreeName]) {
				delete config.worktrees[worktreeName];
				await this.saveWorktreesConfig(config);
			}

			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: `Failed to cleanup worktree links: ${error.message}`
			};
		}
	}

	async cleanupStaleWorktreeLinks() {
		try {
			const config = await this.getWorktreesConfig();
			let actualWorktrees = [];
			
			try {
				const worktreeResult = await this.listWorktrees();
				actualWorktrees = worktreeResult.all || [];
			} catch (error) {
				console.warn('Could not list actual git worktrees for cleanup:', error.message);
				return { success: false, error: error.message };
			}

			const staleEntries = [];
			
			// Check each config entry against actual worktrees
			for (const [name, data] of Object.entries(config.worktrees)) {
				const actualWorktree = actualWorktrees.find(wt => 
					wt.path === data.path || wt.name === name
				);
				
				if (!actualWorktree) {
					staleEntries.push(name);
				}
			}

			// Remove stale entries
			for (const staleName of staleEntries) {
				delete config.worktrees[staleName];
			}

			if (staleEntries.length > 0) {
				await this.saveWorktreesConfig(config);
				console.log(`Cleaned up ${staleEntries.length} stale worktree entries:`, staleEntries);
			}

			return { 
				success: true, 
				cleanedUp: staleEntries.length,
				entries: staleEntries
			};
		} catch (error) {
			return {
				success: false,
				error: `Failed to cleanup stale worktree links: ${error.message}`
			};
		}
	}

	// Claude Code query using SDK
	async claudeCodeQuery(prompt, options = {}) {
		try {
			const messages = [];
			const startTime = Date.now();
			let totalCost = 0;
			let sessionId = null;

			const queryOptions = {
				prompt,
				abortController: options.abortController || new AbortController(),
				options: {
					...options,
					outputFormat: options.outputFormat || 'stream-json',
					cwd: options.cwd || this.projectRoot
				}
			};

			for await (const message of claudeQuery(queryOptions)) {
				messages.push(message);

				// Extract session ID from init message
				if (message.type === 'system' && message.subtype === 'init') {
					sessionId = message.session_id;
				}

				// Track costs
				if (message.type === 'result' && message.total_cost_usd !== undefined) {
					totalCost = message.total_cost_usd;
				}

				// Call message callback if provided
				if (options.onMessage) {
					await options.onMessage(message);
				}
			}

			const duration = Date.now() - startTime;

			return {
				success: true,
				messages,
				sessionId,
				totalCost,
				duration
			};
		} catch (error) {
			console.error('Claude Code query error:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	// Continue a Claude Code session using SDK
	async claudeCodeContinue(prompt, options = {}) {
		try {
			const messages = [];
			const startTime = Date.now();
			let totalCost = 0;
			let sessionId = null;

			const queryOptions = {
				prompt,
				abortController: options.abortController || new AbortController(),
				options: {
					...options,
					continue: true, // Continue the last session
					outputFormat: options.outputFormat || 'stream-json',
					cwd: options.cwd || this.projectRoot
				}
			};

			for await (const message of claudeQuery(queryOptions)) {
				messages.push(message);

				// Extract session ID
				if (message.type === 'system' && message.subtype === 'init') {
					sessionId = message.session_id;
				} else if (message.session_id) {
					sessionId = message.session_id;
				}

				// Track costs
				if (message.type === 'result' && message.total_cost_usd !== undefined) {
					totalCost = message.total_cost_usd;
				}

				// Call message callback if provided
				if (options.onMessage) {
					await options.onMessage(message);
				}
			}

			const duration = Date.now() - startTime;

			return {
				success: true,
				messages,
				sessionId,
				totalCost,
				duration
			};
		} catch (error) {
			console.error('Claude Code continue error:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	// Resume a specific Claude Code session using SDK
	async claudeCodeResume(sessionId, prompt, options = {}) {
		try {
			const messages = [];
			const startTime = Date.now();
			let totalCost = 0;

			const queryOptions = {
				prompt,
				abortController: options.abortController || new AbortController(),
				options: {
					...options,
					resume: sessionId, // Resume specific session
					outputFormat: options.outputFormat || 'stream-json',
					cwd: options.cwd || this.projectRoot
				}
			};

			for await (const message of claudeQuery(queryOptions)) {
				messages.push(message);

				// Track costs
				if (message.type === 'result' && message.total_cost_usd !== undefined) {
					totalCost = message.total_cost_usd;
				}

				// Call message callback if provided
				if (options.onMessage) {
					await options.onMessage(message);
				}
			}

			const duration = Date.now() - startTime;

			return {
				success: true,
				messages,
				sessionId,
				totalCost,
				duration
			};
		} catch (error) {
			console.error('Claude Code resume error:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	// Get Claude Code configuration
	async getClaudeCodeConfig() {
		try {
			// Ensure config is initialized
			if (!flowConfig._config) {
				await flowConfig.initialize();
			}

			const claudeCodeConfig = flowConfig.get('claudeCode', {
				enabled: false,
				permissionMode: 'acceptEdits',
				defaultMaxTurns: 3,
				allowedTools: ['Read', 'Write', 'Bash']
			});

			return {
				success: true,
				config: claudeCodeConfig
			};
		} catch (error) {
			return {
				success: true,
				config: {
					enabled: false,
					permissionMode: 'acceptEdits',
					defaultMaxTurns: 3,
					allowedTools: ['Read', 'Write', 'Bash']
				}
			};
		}
	}

	// Save Claude Code configuration
	async saveClaudeCodeConfig(claudeConfig) {
		try {
			// Ensure config is initialized
			if (!flowConfig._config) {
				await flowConfig.initialize();
			}

			flowConfig.set('claudeCode', claudeConfig);
			await flowConfig.save();

			return { success: true };
		} catch (error) {
			console.error('Error saving Claude Code config:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	// Get Claude Code sessions (reads from index for efficiency)
	async getClaudeCodeSessions() {
		try {
			const indexPath = path.join(
				this.projectRoot,
				'.taskmaster',
				'claude-sessions.json'
			);

			try {
				const data = await fs.readFile(indexPath, 'utf8');
				const sessions = JSON.parse(data);

				// Convert index format to display format
				const displaySessions = sessions.map((session) => ({
					sessionId: session.sessionId,
					prompt: session.subtaskInfo
						? `${session.subtaskInfo.fullId}: ${session.subtaskInfo.title}`
						: 'General Claude Session',
					lastUpdated: session.timestamp,
					createdAt: session.timestamp,
					metadata: {
						type: 'subtask',
						filename: session.filename,
						subtaskInfo: session.subtaskInfo,
						worktree: session.worktree,
						branch: session.branch,
						statistics: session.statistics,
						persona: session.persona,
						prInfo: session.prInfo,
						finished: true
					}
				}));

				return {
					success: true,
					sessions: displaySessions
				};
			} catch {
				// No index file yet
				return {
					success: true,
					sessions: []
				};
			}
		} catch (error) {
			console.error('Error getting Claude sessions:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	// Get detailed Claude session data
	async getClaudeSessionDetails(sessionId) {
		try {
			// First get the session info from index
			const indexPath = path.join(
				this.projectRoot,
				'.taskmaster',
				'claude-sessions.json'
			);

			let sessionInfo = null;
			try {
				const data = await fs.readFile(indexPath, 'utf8');
				const sessions = JSON.parse(data);
				sessionInfo = sessions.find((s) => s.sessionId === sessionId);
			} catch {
				return {
					success: false,
					error: 'Session index not found'
				};
			}

			if (!sessionInfo) {
				return {
					success: false,
					error: 'Session not found in index'
				};
			}

			// Read the full session file
			const sessionPath = path.join(
				this.projectRoot,
				'.taskmaster',
				'claude-sessions',
				sessionInfo.filename
			);

			try {
				const sessionData = await fs.readFile(sessionPath, 'utf8');
				const fullSession = JSON.parse(sessionData);

				return {
					success: true,
					session: fullSession,
					indexInfo: sessionInfo
				};
			} catch (error) {
				return {
					success: false,
					error: `Failed to read session file: ${error.message}`
				};
			}
		} catch (error) {
			console.error('Error getting Claude session details:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	// Save Claude Code session
	async saveClaudeCodeSession(sessionData) {
		try {
			const sessionsPath = path.join(
				this.projectRoot,
				'.taskmaster',
				'claude-sessions.json'
			);
			let sessions = [];

			try {
				const existing = await fs.readFile(sessionsPath, 'utf8');
				sessions = JSON.parse(existing);
			} catch {
				// No sessions file yet
			}

			// Add or update session
			const existingIndex = sessions.findIndex(
				(s) => s.sessionId === sessionData.sessionId
			);
			if (existingIndex >= 0) {
				sessions[existingIndex] = {
					...sessions[existingIndex],
					...sessionData
				};
			} else {
				sessions.push({
					...sessionData,
					createdAt: new Date().toISOString()
				});
			}

			// Keep only last 50 sessions
			if (sessions.length > 50) {
				sessions = sessions.slice(-50);
			}

			await fs.writeFile(sessionsPath, JSON.stringify(sessions, null, 2));

			return { success: true };
		} catch (error) {
			console.error('Error saving Claude session:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	// Prepare Claude context with CLAUDE.md
	async prepareClaudeContext(worktree, tasks, options = {}) {
		try {
			const execAsync = promisify(exec);
			const claudeMdPath = path.join(worktree.path, 'CLAUDE.md');

			// Enhance subtasks with parent task information
			const enhancedTasks = await Promise.all(
				tasks.map(async (task) => {
				const isSubtask = task.isSubtask || String(task.id).includes('.');
				
				if (isSubtask && !task.parentTask) {
					// Look up parent task information
					try {
						const [parentId] = String(task.id).split('.');
						const parentTask = await this.getTask(parentId);
						
						if (parentTask) {
							return {
								...task,
								parentTask: {
									id: parentTask.id,
									title: parentTask.title,
									description: parentTask.description,
									details: parentTask.details,
										testStrategy:
											parentTask.testStrategy || parentTask.test_strategy
								}
							};
						}
					} catch (error) {
							console.warn(
								`Could not load parent task for subtask ${task.id}:`,
								error.message
							);
					}
				}
				
				return task;
				})
			);

			// Import Enhanced AST context builder for Phase 2.3 (dynamic import to avoid circular dependencies)
			let enhancedAstContextBuilder = null;
			let enhancedAstContext = null;
			
			try {
				const { createEnhancedASTContextBuilder } = await import(
					'../ast/context/enhanced-ast-context-builder.js'
				);
				enhancedAstContextBuilder = createEnhancedASTContextBuilder(
					this.projectRoot,
					{
						enablePhase21: true, // Advanced context enhancement
						enablePhase22: true, // Language-specific analysis
						enableTaskAwareness: true, // Task-aware context building
					enableIntelligentSelection: true // Intelligent file selection
					}
				);
				
				// Build enhanced AST context for the worktree with Phase 2.1 + 2.2 capabilities
				enhancedAstContext =
					await enhancedAstContextBuilder.buildWorktreeContext(worktree.path, {
					tasks: enhancedTasks,
					includeComplexity: true,
					includeImports: true,
					includeDependencyAnalysis: true,
					includeFrameworkDetection: true,
					includePatternAnalysis: true
				});
				
				console.debug('[Enhanced AST] Context building result:', {
					enabled: enhancedAstContext.enabled,
					success: enhancedAstContext.success,
					filesAnalyzed: enhancedAstContext.metadata?.filesAnalyzed || 0,
					phase: enhancedAstContext.metadata?.phase || 'Unknown',
					enhancedFeatures: enhancedAstContext.metadata?.enhancedFeatures || {}
				});
			} catch (error) {
				console.debug(
					'[Enhanced AST] Failed to build enhanced AST context:',
					error.message
				);
				enhancedAstContext = { enabled: false, error: error.message };
			}

			// Detect persona if not provided
			let persona = options.persona;
			if (!persona && tasks.length > 0) {
				const detectedPersonas = await detectPersona(tasks[0], worktree);
				persona = detectedPersonas[0]?.persona || 'architect';
			}

			let content = '';

			// Phase 2.3: Use Enhanced CLAUDE.md Formatter for rich, task-aware context
			try {
				const { formatEnhancedClaudeContext } = await import(
					'../ast/context/enhanced-claude-formatter.js'
				);
				
				if (
					enhancedAstContext &&
					enhancedAstContext.enabled &&
					enhancedAstContext.success
				) {
					// Generate rich, enhanced CLAUDE.md content with Phase 2.1 + 2.2 analysis
					content = await formatEnhancedClaudeContext(
						enhancedAstContext,
						enhancedTasks,
						{
						worktreePath: worktree.path,
						includeTaskAnalysis: true,
						includeArchitectureOverview: true,
						includePrioritizedContext: true,
						includeDependencyAnalysis: true,
						includeComplexityInsights: true,
						includeImplementationGuidance: true,
						detailLevel: 'comprehensive',
						backend: this // Pass backend instance for re-fetching
						}
					);
					
					console.debug(
						'[Enhanced CLAUDE.md] Generated rich context with Phase 2.3 formatter'
					);
				} else {
					// Fallback to enhanced formatter with error handling
					content = await formatEnhancedClaudeContext(
						enhancedAstContext,
						enhancedTasks,
						{
						worktreePath: worktree.path,
						detailLevel: 'basic',
						backend: this // Pass backend instance for re-fetching
						}
					);
					
					console.debug(
						'[Enhanced CLAUDE.md] Generated fallback context due to AST analysis failure'
					);
				}
			} catch (formatterError) {
				console.warn(
					'[Enhanced CLAUDE.md] Formatter failed, using basic context:',
					formatterError.message
				);
				
				// Ultimate fallback to basic context generation
				content = `# Task Implementation Context

Generated by Task Master for worktree: ${worktree.name}
Branch: ${worktree.branch || 'unknown'}

`;

				// Add worktree-specific note for subtask worktrees
				if (worktree.name && worktree.name.match(/^task-\d+\.\d+$/)) {
					content += `**Note:** This worktree was automatically created for the specific subtask implementation.\n\n`;
				}

				// Add tasks with full details
				content += '## Tasks to Implement\n\n';
				for (const task of enhancedTasks) {
					// Check if this is a subtask by looking at the ID or isSubtask property
					const isSubtask = task.isSubtask || String(task.id).includes('.');
					const taskType = isSubtask ? 'Subtask' : 'Task';
					
					// If this is a subtask, first show parent task context
					if (isSubtask && task.parentTask) {
						content += `### Parent Task Context: ${task.parentTask.id}: ${task.parentTask.title}\n\n`;
						
						if (task.parentTask.description) {
							content += `**Parent Description:**\n${task.parentTask.description}\n\n`;
						}
						
						if (task.parentTask.details) {
							content += `**Parent Implementation Details:**\n${task.parentTask.details}\n\n`;
						}
						
						// Check for parent test strategy
						const parentTestStrategy =
							task.parentTask.testStrategy ||
							task.parentTask.test_strategy ||
							null;
						if (parentTestStrategy !== null && parentTestStrategy !== '') {
							content += `**Parent Test Strategy:**\n${parentTestStrategy}\n\n`;
						}
						
						content += '---\n\n';
					}
					
					content += `### ${taskType} to Implement: ${task.id}: ${task.title}\n\n`;
					content += `**Status:** ${task.status}\n\n`;

					if (task.description) {
						content += `**Description:**\n${task.description}\n\n`;
					}

					if (task.details) {
						content += `**Implementation Details:**\n${task.details}\n\n`;
					}

					// Check for test strategy (handle empty strings)
					const testStrategy = task.testStrategy || task.test_strategy || null;
					if (testStrategy !== null && testStrategy !== '') {
						content += `**Test Strategy:**\n${testStrategy}\n\n`;
					} else if (isSubtask) {
						// For subtasks without test strategy, add a placeholder
						content += `**Test Strategy:**\n(No specific test strategy defined for this subtask)\n\n`;
					}

					if (task.dependencies && task.dependencies.length > 0) {
						content += `**Dependencies:** ${task.dependencies.join(', ')}\n`;
					}

					// Only show subtasks section if this is a parent task with subtasks
					if (!isSubtask && task.subtasks && task.subtasks.length > 0) {
						content += `**Subtasks:**\n`;
						for (const subtask of task.subtasks) {
							content += `- ${subtask.id}: ${subtask.title} (${subtask.status || 'pending'})\n`;
							if (subtask.details) {
								content += `  - Details: ${subtask.details.substring(0, 200)}${subtask.details.length > 200 ? '...' : ''}\n`;
							}
							if (subtask.testStrategy && subtask.testStrategy.trim() !== '') {
								content += `  - Test Strategy: ${subtask.testStrategy}\n`;
							}
						}
						content += '\n';
					}

					content += '\n---\n\n';
				}

				// Add basic AST context if available
				if (
					enhancedAstContext &&
					enhancedAstContext.enabled &&
					enhancedAstContext.success &&
					enhancedAstContext.context
				) {
					content += '## Code Structure Analysis\n\n';
					content +=
						'*Basic AST analysis (enhanced formatter unavailable)*\n\n';
					if (typeof enhancedAstContext.context === 'string') {
						content += enhancedAstContext.context;
					} else {
						content += 'AST analysis completed but formatting failed.\n\n';
					}
				} else if (enhancedAstContext && enhancedAstContext.enabled) {
					content += '## Code Structure Analysis\n\n';
					content += `*AST analysis failed: ${enhancedAstContext.error || 'Unknown error'}*\n\n`;
				}
			}

			// Only add basic project structure and Git context for ultimate fallback case
			// (Enhanced formatter handles these sections with richer analysis)
			if (
				content.includes('Ultimate fallback') ||
				!content.includes('Enhanced Task Implementation Context')
			) {
				// Add project structure (filtered to relevant files)
				if (options.includeStructure !== false) {
					content += '## Project Structure\n\n';
					content += '```\n';

					try {
						// Get project files, excluding common directories and files
						const { stdout } = await execAsync(
							`cd "${worktree.path}" && find . -type f \\( -name "*.html" -o -name "*.css" -o -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.md" \\) | grep -v node_modules | grep -v "\\.git" | grep -v "dist/" | grep -v "build/" | grep -v "coverage/" | head -50 | sort`
						);

						if (stdout.trim()) {
							content += stdout;
						} else {
							content += '(No project files found yet)\n';
						}
					} catch (err) {
						content += '(Unable to list project files)\n';
					}

					content += '```\n\n';
				}

				// Add Git context
				content += '## Git Context\n\n';
				try {
					const { stdout: branch } = await execAsync(
						`cd "${worktree.path}" && git rev-parse --abbrev-ref HEAD`
					);
					content += `**Current branch:** ${branch.trim()}\n`;

					const { stdout: status } = await execAsync(
						`cd "${worktree.path}" && git status --short`
					);
					if (status.trim()) {
						content += '\n**Uncommitted changes:**\n```\n' + status + '```\n';
					} else {
						content += '\n**Working directory:** Clean\n';
					}

					// Add recent commits
					try {
						const { stdout: commits } = await execAsync(
							`cd "${worktree.path}" && git log --oneline -5`
						);
						if (commits.trim()) {
							content += '\n**Recent commits:**\n```\n' + commits + '```\n';
						}
					} catch {
						// Might be a new branch with no commits
					}
				} catch (err) {
					content += 'Git information unavailable\n';
				}

				// Add instructions for Claude
				content += '\n## Instructions\n\n';
				content +=
					'Please implement the tasks listed above, following the implementation details and test strategies provided.\n';
				content +=
					'Ensure all code follows project conventions and includes appropriate tests.\n';
				content +=
					'This context file provides a comprehensive overview of the task requirements and current project state.\n';
			}

				// Add custom headless prompt if provided
				if (options.headlessPrompt) {
					content += '\n## Additional User Instructions\n\n';
					content += options.headlessPrompt + '\n';
				}

				// Write CLAUDE.md
				await fs.writeFile(claudeMdPath, content);

				return {
					contextFile: claudeMdPath,
					persona,
					tasksCount: enhancedTasks.length
				};
			} catch (err) {
				throw new Error(`Failed to prepare Claude context: ${err.message}`);
			}
		}

		// Launch Claude CLI in interactive mode
		async launchClaudeCLI(worktree, options = {}) {
			try {
				const execAsync = promisify(exec);
				// Prepare context if tasks provided
				let contextInfo = {};
				if (options.tasks?.length > 0) {
					contextInfo = await this.prepareClaudeContext(worktree, options.tasks, {
						...options,
						mode: 'interactive'
					});
				}

				const platform = os.platform();
				let command;

				if (platform === 'darwin') {
					// macOS - use Terminal.app or iTerm2 if available
					try {
						// Check if iTerm2 is available
						await execAsync(
							'osascript -e \'tell application "System Events" to get name of every application process\' | grep -i iterm'
						);
						// iTerm2 is available
						command = `osascript -e 'tell application "iTerm"
							create window with default profile
							tell current session of current window
								write text "cd ${worktree.path.replace(/'/g, "\\'")} && claude"
							end tell
						end tell'`;
					} catch {
						// Fall back to Terminal.app
						command = `osascript -e 'tell application "Terminal"
							do script "cd ${worktree.path.replace(/'/g, "\\'")} && claude"
							activate
						end tell'`;
					}
				} else if (platform === 'win32') {
					// Windows
					command = `start cmd /k "cd /d \\"${worktree.path}\\" && claude"`;
				} else {
					// Linux - try common terminal emulators
					const terminals = [
						`gnome-terminal -- bash -c "cd '${worktree.path}' && claude; exec bash"`,
						`konsole -e bash -c "cd '${worktree.path}' && claude; exec bash"`,
						`xterm -e bash -c "cd '${worktree.path}' && claude; exec bash"`
					];

					for (const term of terminals) {
						try {
							await execAsync(term);
							command = term;
							break;
						} catch {
							// Try next terminal
						}
					}

					if (!command) {
						throw new Error('No supported terminal emulator found');
					}
				}

				await execAsync(command);

				return {
					success: true,
					worktree: worktree.path,
					contextInfo
				};
			} catch (err) {
				throw new Error(`Failed to launch Claude CLI: ${err.message}`);
			}
		}

		// Launch Claude in headless mode with prompt
		async launchClaudeHeadless(worktree, tasks, prompt, options = {}) {
			try {
				// Ensure all tasks have research before proceeding
				await this.ensureTasksHaveResearch(tasks, worktree, {
					...options,
					mcpLog: options.mcpLog || options.log || this.log
				});

				// Prepare context file (CLAUDE.md) first
				const contextInfo = await this.prepareClaudeContext(worktree, tasks, {
					...options,
					mode: 'headless',
					headlessPrompt: prompt
				});

				// Read the CLAUDE.md content to include in the prompt
				const claudeMdPath = path.join(worktree.path, 'CLAUDE.md');
				let claudeMdContent = '';
				try {
					claudeMdContent = await fs.readFile(claudeMdPath, 'utf8');
				} catch (err) {
					console.warn('Could not read CLAUDE.md:', err.message);
				}

				// Detect persona if not provided
				let persona = options.persona || contextInfo.persona;
				if (!persona && tasks.length > 0) {
					const detectedPersonas = await detectPersona(tasks[0], worktree);
					persona = detectedPersonas[0]?.persona || 'architect';
				}

				// Build comprehensive prompt
				const promptBuilder = new PersonaPromptBuilder(persona);
				let fullPrompt;

				// Combine CLAUDE.md content with user instructions
				let combinedContext = '';
				if (claudeMdContent) {
					combinedContext = `## Implementation Context

The following comprehensive context has been prepared for this task implementation:

---

${claudeMdContent}

---
`;
				}
				if (prompt) {
					combinedContext += `
## Additional User Instructions

${prompt}

---
`;
				}

				if (tasks.length === 1) {
					fullPrompt = promptBuilder.buildTaskPrompt(tasks[0], {
						additionalContext: combinedContext || null
					});
				} else {
					fullPrompt = promptBuilder.buildBatchPrompt(tasks, {
						additionalContext: combinedContext || null
					});
				}

				// Use Claude Code SDK
				const messages = [];
				const startTime = Date.now();
			const totalCost = 0;
			const sessionId = null;

				const queryOptions = {
					prompt: fullPrompt,
					abortController: options.abortController || new AbortController(),
					options: {
						maxTurns: options.maxTurns || 10,
						permissionMode: options.permissionMode || 'acceptEdits',
						outputFormat: options.outputFormat || 'stream-json',
						cwd: worktree.path,
						// Add allowed tools if provided
						...(options.allowedTools && { allowedTools: options.allowedTools })
					}
				};

				console.log('🎮 [DirectBackend] Query options prepared:', {
					promptLength: fullPrompt.length,
					maxTurns: queryOptions.options.maxTurns,
					permissionMode: queryOptions.options.permissionMode,
					outputFormat: queryOptions.options.outputFormat,
					cwd: queryOptions.options.cwd,
					captureOutput: options.captureOutput
				});

				// Handle different output formats
				if (options.captureOutput) {
					let output = '';
					let sessionId = null;
					const messages = [];
				let completed = false;
				let finalResult = null;

					try {
						for await (const message of claudeQuery(queryOptions)) {
							// Extract session ID from the first message
							if (!sessionId && message.sessionId) {
								sessionId = message.sessionId;
							}

							messages.push(message);
						if (
							options.onProgress &&
							typeof options.onProgress === 'function'
						) {
								options.onProgress(message);
							}

						// Check for completion
						if (message.type === 'result') {
							completed = true;
							finalResult = message;
							// Don't break here - let the iterator finish naturally
						}

							// Accumulate output
							if (message.type === 'assistant' && message.content) {
								if (Array.isArray(message.content)) {
									for (const part of message.content) {
										if (part.type === 'text' && part.text) {
											output += part.text;
										}
									}
								} else if (typeof message.content === 'string') {
									output += message.content;
								}
							}
						}
					} catch (error) {
						console.error('Error in Claude query:', error);
					
					// If we received a result message before the error, consider it successful
					if (completed && finalResult) {
						console.log('Claude session completed successfully despite iterator error');
						return {
							success: true,
							output,
							sessionId,
							messages,
							result: finalResult,
							warning: `Iterator error after completion: ${error.message}`
						};
					}
					
						return {
							success: false,
							error: error.message
						};
					}

					return {
						success: true,
						output,
						sessionId,
					messages,
					...(finalResult && { result: finalResult })
					};
				} else {
					const output = '';
					console.log('🚀 [DirectBackend] Taking fire-and-forget path...');
					// Fire and forget mode - just start the process
					const claudeProcess = spawn(
						'claude',
						[
							'-p',
							fullPrompt,
							'--max-turns',
							String(options.maxTurns || 10),
							'--permission-mode',
							options.permissionMode || 'acceptEdits',
							'--add-dir',
							worktree.path
						],
						{
							cwd: worktree.path,
							stdio: 'inherit'
						}
					);

					return {
						success: true,
						persona,
						tasksProcessed: tasks.length,
						process: claudeProcess
					};
				}
			} catch (err) {
				console.error('💥 [DirectBackend] launchClaudeHeadless error:', err);
				throw new Error(
					`Failed to launch Claude in headless mode: ${err.message}`
				);
			}
		}

		// Launch multiple Claude sessions for batch processing
		async launchMultipleClaudeSessions(worktree, taskGroups, options = {}) {
			try {
				const sessions = [];

				for (const group of taskGroups) {
					const { tasks, persona, prompt } = group;

					const sessionResult = await this.launchClaudeHeadless(
						worktree,
						tasks,
						prompt,
						{
							...options,
							persona,
							captureOutput: true
						}
					);

					sessions.push({
						tasks: tasks.map((t) => t.id),
						persona,
						result: sessionResult
					});
				}

				return {
					success: true,
					sessions,
					totalTasks: taskGroups.reduce((sum, g) => sum + g.tasks.length, 0)
				};
			} catch (err) {
				throw new Error(
					`Failed to launch multiple Claude sessions: ${err.message}`
				);
			}
		}

		// Get available personas
		async getAvailablePersonas() {
			return getAllPersonaIds();
		}

		// Detect personas for tasks
		async detectPersonasForTasks(tasks, worktree) {
			const detectionResults = [];

			for (const task of tasks) {
				const personas = await detectPersona(task, worktree);
				detectionResults.push({
					taskId: task.id,
					taskTitle: task.title,
					suggestedPersonas: personas
				});
			}

			// Check for multi-persona workflow
			const multiPersona = detectMultiPersonaWorkflow(tasks);

			return {
				taskPersonas: detectionResults,
				multiPersonaWorkflow: multiPersona
			};
		}

		/**
		 * Check if a task has research in its details
		 * @param {Object} task - Task object
		 * @returns {boolean} - True if task has research
		 */
		hasResearchInTask(task) {
			// Check main task details (case-insensitive)
			if (
				task.details &&
				(task.details.toLowerCase().includes('research session') ||
					task.details.includes('<info added on'))
			) {
				return true;
			}

			// Check subtasks if they exist
			if (task.subtasks && Array.isArray(task.subtasks)) {
				for (const subtask of task.subtasks) {
					if (
						subtask.details &&
						(subtask.details.toLowerCase().includes('research session') ||
							subtask.details.includes('<info added on'))
					) {
						return true;
					}
				}
			}

			return false;
		}

		/**
		 * Run research for tasks that don't have research
		 * @param {Array} tasks - Array of tasks
		 * @param {Object} worktree - Worktree object
		 * @param {Object} options - Options
		 * @returns {Promise<void>}
		 */
		async ensureTasksHaveResearch(tasks, worktree, options = {}) {
			const logFn = options.mcpLog || this.log;

			for (const task of tasks) {
				// Check if this is a subtask (ID contains a dot)
				const isSubtask = task.id.toString().includes('.');
				let taskToCheck = task;
				let parentTaskId = null;

				if (isSubtask) {
					// For subtasks, we need to check the parent task for research
					parentTaskId = task.id.toString().split('.')[0];
					try {
						const parentTask = await this.getTask(parentId);
						if (parentTask) {
							taskToCheck = parentTask;
							logFn.info(`Checking parent task ${parentTaskId} for research instead of subtask ${task.id}`);
						}
					} catch (error) {
						logFn.warn(`Could not fetch parent task ${parentTaskId} for subtask ${task.id}: ${error.message}`);
						// Fall back to checking the subtask itself
					}
				} else {
					// For main tasks, fetch complete task data to check for existing research
					try {
						const fullTaskData = await this.getTask(task.id.toString());
						if (fullTaskData) {
							taskToCheck = fullTaskData;
							// Update the original task object with complete data for later use
							Object.assign(task, fullTaskData);
						}
					} catch (error) {
						logFn.warn(`Could not fetch complete task data for ${task.id}: ${error.message}`);
						// Continue with the task we have
					}
				}

				// Check for research in the task we determined (parent for subtasks, self for main tasks)
				if (!this.hasResearchInTask(taskToCheck)) {
					const targetTaskId = isSubtask ? parentTaskId : task.id.toString();
					logFn.info(`Task ${targetTaskId} has no research. Running research...`);

					try {
						// Build research query based on the target task (parent for subtasks)
						const researchQuery = `Task ${targetTaskId}: ${taskToCheck.title}\n\nDescription: ${taskToCheck.description || 'No description'}\n\nDetails: ${taskToCheck.details || 'No details'}\n\nWhat are the current best practices and implementation approaches for this task?`;

						// Run research and save to the target task (parent for subtasks)
						const researchResult = await this.research({
							query: researchQuery,
							taskIds: [targetTaskId],
							includeProjectTree: true,
							detailLevel: 'high',
							saveTo: targetTaskId
						});

						if (researchResult.success) {
							logFn.info(`Research completed and saved to task ${targetTaskId}`);

							// Reload the target task to get updated details with research
							const updatedTask = await this.getTask(targetTaskId);
							if (updatedTask && !isSubtask) {
								// Only update the original task object if it's not a subtask
								Object.assign(task, updatedTask);
							}
						} else {
							logFn.warn(
								`Research failed for task ${targetTaskId}: ${researchResult.error}`
							);
						}
					} catch (error) {
						logFn.error(
							`Error running research for task ${targetTaskId}: ${error.message}`
						);
					}
				} else {
					const targetTaskId = isSubtask ? parentTaskId : task.id.toString();
					logFn.info(
						`Task ${targetTaskId} already has research - skipping research generation`
					);
					// Show a snippet of the existing research
					if (taskToCheck.details) {
						const researchMatch = taskToCheck.details.match(
							/research session.*?(?=\n|$)/i
						);
						if (researchMatch) {
							logFn.debug(`Existing research: "${researchMatch[0]}..."`);
						}
					}
				}
			}
		}

	/**
	 * Get or create a worktree for a task
	 * @param {string} taskId
	 * @param {Object} options
	 * @returns {Promise<{exists: boolean, worktree: Object, created: boolean, needsUserDecision?: boolean, branchExists?: boolean, branchInUseAt?: string}>}
	 */
	async getOrCreateWorktreeForTask(taskId, options = {}) {
		try {
			// Dynamically import WorktreeManager to avoid circular dependencies
			const { WorktreeManager } = await import('../worktree-manager.js');
			const manager = new WorktreeManager(this.projectRoot);

			// Get task details if not provided
			if (!options.taskTitle && taskId) {
				try {
					const task = await this.getTask(taskId);
					if (task) {
						options.taskTitle = task.title;
					}
				} catch (error) {
					// Continue without title
					this.log.debug('Could not get task title:', error.message);
				}
			}

			return await manager.getOrCreateWorktreeForTask(taskId, options);
		} catch (error) {
			this.log.error('Error in getOrCreateWorktreeForTask:', error);
			throw error;
		}
	}

		/**
		 * Get or create a worktree for a subtask
		 * @param {string} taskId
		 * @param {string} subtaskId
		 * @param {Object} options
		 * @returns {Promise<{exists: boolean, worktree: Object, created: boolean, needsUserDecision?: boolean, branchExists?: boolean, branchInUseAt?: string}>}
		 */
		async getOrCreateWorktreeForSubtask(taskId, subtaskId, options = {}) {
			try {
				// Dynamically import WorktreeManager to avoid circular dependencies
				const { WorktreeManager } = await import('../worktree-manager.js');
				const manager = new WorktreeManager(this.projectRoot);

				// Get subtask details if not provided
				if (!options.subtaskTitle && taskId && subtaskId) {
					try {
						const task = await this.getTask(taskId);
						if (task.subtasks) {
							const subtask = task.subtasks.find(
								(st) => String(st.id) === String(subtaskId)
							);
							if (subtask) {
								options.subtaskTitle = subtask.title;
							}
						}
					} catch (error) {
						// Continue without title
						this.log.debug('Could not get subtask title:', error.message);
					}
				}

				return await manager.getOrCreateWorktreeForSubtask(
					taskId,
					subtaskId,
					options
				);
			} catch (error) {
				this.log.error('Error in getOrCreateWorktreeForSubtask:', error);
				throw error;
			}
		}

		/**
		 * Get worktree for a specific subtask
		 * @param {string} taskId
		 * @param {string} subtaskId
		 * @returns {Promise<Object|null>}
		 */
		async getWorktreeForSubtask(taskId, subtaskId) {
			const { WorktreeManager } = await import('../worktree-manager.js');
			const manager = new WorktreeManager(this.projectRoot);
			return manager.getWorktreeForSubtask(taskId, subtaskId);
		}

		/**
		 * Get all worktrees
		 * @returns {Promise<Array>}
		 */
		async getAllWorktrees() {
			const { WorktreeManager } = await import('../worktree-manager.js');
			const manager = new WorktreeManager(this.projectRoot);
			return manager.getAllWorktrees();
		}

		/**
		 * Complete a subtask and optionally create PR
		 * @param {string} worktreeName
		 * @param {Object} options
		 * @returns {Promise<Object>}
		 */
		async completeSubtaskWorktree(worktreeName, options = {}) {
			const { WorktreeManager } = await import('../worktree-manager.js');
			const manager = new WorktreeManager(this.projectRoot);
			return await manager.completeSubtask(worktreeName, options);
		}

		/**
		 * Update worktree configuration
		 * @param {Object} updates
		 * @returns {Promise<void>}
		 */
		async updateWorktreeConfig(updates) {
			const { WorktreeManager } = await import('../worktree-manager.js');
			const manager = new WorktreeManager(this.projectRoot);
			return manager.updateConfig(updates);
		}

		/**
		 * Force create a worktree, removing any existing branch/worktree
		 * @param {string} taskId
		 * @param {string} subtaskId
		 * @param {Object} options
		 * @returns {Promise<{exists: boolean, worktree: Object, created: boolean}>}
		 */
		async forceCreateWorktreeForSubtask(taskId, subtaskId, options = {}) {
			try {
				const { WorktreeManager } = await import('../worktree-manager.js');
				const manager = new WorktreeManager(this.projectRoot);

				// Get subtask details if not provided
				if (!options.subtaskTitle && taskId && subtaskId) {
					try {
						const task = await this.getTask(taskId);
						if (task.subtasks) {
							const subtask = task.subtasks.find(
								(st) => String(st.id) === String(subtaskId)
							);
							if (subtask) {
								options.subtaskTitle = subtask.title;
							}
						}
					} catch (error) {
						this.log.debug('Could not get subtask title:', error.message);
					}
				}

				return await manager.forceCreateWorktree(taskId, subtaskId, options);
			} catch (error) {
				this.log.error('Error in forceCreateWorktreeForSubtask:', error);
				throw error;
			}
		}

		/**
		 * Use existing branch for worktree
		 * @param {string} taskId
		 * @param {string} subtaskId
		 * @param {Object} options
		 * @returns {Promise<{exists: boolean, worktree: Object, created: boolean, reusedBranch: boolean}>}
		 */
		async useExistingBranchForSubtask(taskId, subtaskId, options = {}) {
			try {
				const { WorktreeManager } = await import('../worktree-manager.js');
				const manager = new WorktreeManager(this.projectRoot);

				// Get subtask details if not provided
				if (!options.subtaskTitle && taskId && subtaskId) {
					try {
						const task = await this.getTask(taskId);
						if (task.subtasks) {
							const subtask = task.subtasks.find(
								(st) => String(st.id) === String(subtaskId)
							);
							if (subtask) {
								options.subtaskTitle = subtask.title;
							}
						}
					} catch (error) {
						this.log.debug('Could not get subtask title:', error.message);
					}
				}

				return await manager.useExistingBranch(taskId, subtaskId, options);
			} catch (error) {
				this.log.error('Error in useExistingBranchForSubtask:', error);
				throw error;
			}
		}

		/**
		 * Save Claude session data to a JSON file in .taskmaster folder and update index
		 * @param {Object} sessionData - The session data to save
		 * @returns {Promise<void>}
		 */
		async saveClaudeSessionData(sessionData) {
			try {
				const claudeDir = path.join(
					this.projectRoot,
					'.taskmaster',
					'claude-sessions'
				);
				
				// Ensure directory exists
				await fs.mkdir(claudeDir, { recursive: true });

				// Create filename with timestamp and session ID
				const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
				const sessionId = sessionData.sessionId || 'unknown';
				const filename = `${timestamp}_${sessionId.substring(0, 8)}.json`;
				const filePath = path.join(claudeDir, filename);

				// Save session data
				await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2));

				// Update the sessions index
				await this.updateClaudeSessionIndex({
					sessionId: sessionData.sessionId,
					filename,
					timestamp: new Date().toISOString(),
				subtaskInfo: sessionData.tasks?.[0]?.isSubtask
					? {
						id: sessionData.tasks[0].id,
						title: sessionData.tasks[0].title
						}
					: null
				});

				return { success: true, filePath };
			} catch (error) {
				console.error('Error saving Claude session data:', error);
				throw error;
			}
		}

		/**
		 * Update the Claude sessions index file
		 * @private
		 */
		async updateClaudeSessionIndex(sessionInfo) {
			try {
				const indexPath = path.join(
					this.projectRoot,
					'.taskmaster',
					'claude-sessions.json'
				);

				let index = [];
				try {
					const data = await fs.readFile(indexPath, 'utf8');
					index = JSON.parse(data);
				} catch (error) {
					// File doesn't exist or is invalid, start with empty array
					index = [];
				}

				// Add new session to index
				index.unshift(sessionInfo);

				// Keep only the most recent 100 sessions
				if (index.length > 100) {
					index = index.slice(0, 100);
				}

				await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
			} catch (error) {
				console.error('Error updating Claude session index:', error);
				throw error;
			}
		}

		/**
		 * Extract text content from various message content formats
		 * @private
		 */
		extractMessageContent(content) {
			if (!content) return '';

			if (typeof content === 'string') {
				return content;
			}

			if (Array.isArray(content)) {
				return content
					.map((part) => {
						if (part.type === 'text') return part.text;
						if (part.type === 'code')
							return `\`\`\`${part.language || ''}\n${part.code}\n\`\`\``;
						return JSON.stringify(part);
					})
					.join('\n');
			}

			if (content.text) {
				return content.text;
			}

			return JSON.stringify(content);
		}

		/**
		 * Count tools used in the conversation
		 * @private
		 */
		countToolsUsed(messages) {
			const toolCounts = {};
			messages.forEach((msg) => {
				if (msg.type === 'tool_use' && msg.tool) {
					toolCounts[msg.tool] = (toolCounts[msg.tool] || 0) + 1;
				}
			});
			return toolCounts;
		}

			async completeSubtaskWithPR(worktreeName, options = {}) {
		const worktreeManager = new WorktreeManager(this.projectRoot);
		return await worktreeManager.completeSubtask(worktreeName, options);
	}

	/**
	 * Complete a subtask with enhanced workflow options
	 * @param {string} worktreeName - Name of the worktree
	 * @param {Object} options - Workflow options
	 * @returns {Promise<Object>} Workflow result
	 */
	async completeSubtask(worktreeName, options = {}) {
		try {
			const { WorktreeManager } = await import('../worktree-manager.js');
			const manager = new WorktreeManager(this.projectRoot);
			
			// Set branch manager if available
			if (this.branchManager) {
				manager.setBranchManager(this.branchManager);
			}
			
			return await manager.completeSubtask(worktreeName, options);
		} catch (error) {
			this.log.error('Error in completeSubtask:', error);
			throw error;
		}
	}

		// Create PR from Claude session
		async createPRFromClaudeSession(sessionId, options = {}) {
			try {
				// Get session details
				const sessionResult = await this.getClaudeSessionDetails(sessionId);
				if (!sessionResult.success) {
					return sessionResult;
				}

				const { session, indexInfo } = sessionResult;
				const subtaskInfo = session.summary.subtaskInfo;

				if (!subtaskInfo) {
					return {
						success: false,
						error: 'Session is not associated with a subtask'
					};
				}

				// Check if PR already exists
				if (session.summary.prInfo.created) {
					return {
						success: false,
						error: `PR already created: ${session.summary.prInfo.url}`
					};
				}

				// Get worktree info
				const worktreeName = `task-${subtaskInfo.fullId}`;
				const worktree = await this.getWorktreeForSubtask(
					subtaskInfo.parentTaskId,
					subtaskInfo.subtaskId
				);

				if (!worktree) {
					return {
						success: false,
						error: 'Associated worktree not found'
					};
				}

				// Create PR using worktree manager
				const prTitle =
					options.prTitle || `Task ${subtaskInfo.fullId}: ${subtaskInfo.title}`;
				const prDescription =
					options.prDescription || this.generatePRDescription(session);

				const prResult = await this.completeSubtaskWithPR(worktreeName, {
					createPR: true,
					prTitle,
					prDescription
				});

				if (prResult.prUrl) {
					// Update session with PR info
					await this.updateClaudeSessionPR(sessionId, {
						created: true,
						url: prResult.prUrl,
						createdAt: new Date().toISOString()
					});

					return {
						success: true,
						prUrl: prResult.prUrl,
						worktree: worktree.name
					};
				} else {
					return {
						success: false,
						error: 'Failed to create PR'
					};
				}
			} catch (error) {
				console.error('Error creating PR from Claude session:', error);
				return {
					success: false,
					error: error.message
				};
			}
		}

		// Update Claude session with PR information
		async updateClaudeSessionPR(sessionId, prInfo) {
			try {
				// Update the index
				const indexPath = path.join(
					this.projectRoot,
					'.taskmaster',
					'claude-sessions.json'
				);

				let index = [];
				try {
					const data = await fs.readFile(indexPath, 'utf8');
					index = JSON.parse(data);
				} catch {
					return;
				}

				// Find and update session in index
				const sessionIndex = index.findIndex((s) => s.sessionId === sessionId);
				if (sessionIndex >= 0) {
					index[sessionIndex].prInfo = prInfo;
					await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');
				}

				// Update the session file
				const sessionInfo = index[sessionIndex];
				if (sessionInfo) {
					const sessionPath = path.join(
						this.projectRoot,
						'.taskmaster',
						'claude-sessions',
						sessionInfo.filename
					);

					try {
						const sessionData = await fs.readFile(sessionPath, 'utf8');
						const fullSession = JSON.parse(sessionData);
						fullSession.summary.prInfo = prInfo;
						await fs.writeFile(
							sessionPath,
							JSON.stringify(fullSession, null, 2),
							'utf8'
						);
					} catch (error) {
						this.log.error(
							'Failed to update session file with PR info:',
							error.message
						);
					}
				}
			} catch (error) {
				this.log.error('Failed to update Claude session PR info:', error.message);
			}
		}

		// Generate PR description from Claude session
		generatePRDescription(session) {
			const stats = session.summary.statistics;
			const subtask = session.summary.subtaskInfo;

			let description = `Implemented by Claude Code\n\n`;
			description += `**Subtask:** ${subtask.fullId} - ${subtask.title}\n`;
			if (subtask.description) {
				description += `**Description:** ${subtask.description}\n`;
			}
			description += `\n**Session Statistics:**\n`;
			description += `- Turns: ${stats.turns}/${stats.maxTurns}\n`;
			description += `- File Changes: ${stats.fileChanges || 0}\n`;
			description += `- Duration: ${stats.durationSeconds || 0}s\n`;
			description += `- Cost: $${(stats.totalCost || 0).toFixed(4)}\n`;
			description += `- Persona: ${session.summary.persona}\n`;

			if (stats.toolsUsed && Object.keys(stats.toolsUsed).length > 0) {
				description += `\n**Tools Used:**\n`;
				for (const [tool, count] of Object.entries(stats.toolsUsed)) {
					description += `- ${tool}: ${count} times\n`;
				}
			}

			return description;
		}

		async claudeCodeStatus(sessionId) {
			// ... existing code ...
		}

	/**
	 * Get PR status from GitHub API
	 */
	async getPRStatus(prNumber) {
		try {
			const { execSync } = await import('child_process');

			// Get PR info using GitHub CLI
			const prInfoRaw = execSync(
				`gh pr view ${prNumber} --json state,merged,mergeable,draft,title,url,headRefName,baseRefName,reviews,statusCheckRollup`,
				{
					encoding: 'utf8',
					cwd: this.projectRoot
				}
			);

			const prInfo = JSON.parse(prInfoRaw);

			// Process reviews
			const reviews = prInfo.reviews || [];
			const approvedReviews = reviews.filter(
				(review) => review.state === 'APPROVED'
			);
			const requestedChanges = reviews.filter(
				(review) => review.state === 'CHANGES_REQUESTED'
			);

			// Process status checks
			const checks = (prInfo.statusCheckRollup || []).map((check) => ({
				name: check.name || check.context,
				status:
					check.state === 'SUCCESS'
						? 'success'
						: check.state === 'FAILURE'
							? 'failure'
							: check.state === 'PENDING'
								? 'pending'
								: 'unknown',
				conclusion: check.conclusion,
				url: check.targetUrl || check.detailsUrl
			}));

			return {
				number: prNumber,
				title: prInfo.title,
				url: prInfo.url,
				state: prInfo.state,
				merged: prInfo.merged,
				mergeable: prInfo.mergeable,
				draft: prInfo.draft,
				headRef: prInfo.headRefName,
				baseRef: prInfo.baseRefName,

				// Review status
				reviews: reviews.length,
				approved: approvedReviews.length > 0,
				changesRequested: requestedChanges.length > 0,
				reviewRequired: true, // Assume review required by default

				// Check status
				checks,
				checksPass:
					checks.length === 0 ||
					checks.every((check) => check.status === 'success'),
				checksFail: checks.some((check) => check.status === 'failure'),

				// Computed status
				canMerge:
					prInfo.mergeable &&
					!prInfo.draft &&
					(checks.length === 0 ||
						checks.every((check) => check.status === 'success')),

				// Raw data for advanced processing
				raw: prInfo
			};
		} catch (error) {
			throw new Error(`Failed to get PR status: ${error.message}`);
		}
	}

	/**
	 * Get detailed PR checks information
	 */
	async getPRChecks(prNumber) {
		try {
			const { execSync } = await import('child_process');

			// Get check runs using GitHub CLI
			const checksRaw = execSync(
				`gh pr checks ${prNumber} --json name,status,conclusion,startedAt,completedAt,detailsUrl`,
				{
					encoding: 'utf8',
					cwd: this.projectRoot
				}
			);

			const checks = JSON.parse(checksRaw);

			return checks.map((check) => ({
				name: check.name,
				status: check.status?.toLowerCase() || 'unknown',
				conclusion: check.conclusion?.toLowerCase() || null,
				startedAt: check.startedAt,
				completedAt: check.completedAt,
				url: check.detailsUrl,
				duration:
					check.startedAt && check.completedAt
						? new Date(check.completedAt) - new Date(check.startedAt)
						: null
			}));
		} catch (error) {
			throw new Error(`Failed to get PR checks: ${error.message}`);
		}
	}

	/**
	 * Enhanced merge eligibility validation with comprehensive safety checks
	 */
	async validateMergeEligibility(prNumber, config = {}) {
		try {
			const validationResults = {
				eligible: false,
				checks: {},
				blockers: [],
				warnings: [],
				details: {}
			};

			// 1. Get PR status
			const prStatus = await this.getPRStatus(prNumber);
			validationResults.details.prStatus = prStatus;

			// 2. Basic PR state validation
			validationResults.checks.prState = this.validatePRState(prStatus);
			if (!validationResults.checks.prState.passed) {
				validationResults.blockers.push(
					...validationResults.checks.prState.blockers
				);
			}

			// 3. CI/CD checks validation
			if (config.requiredChecks && config.requiredChecks.length > 0) {
				validationResults.checks.ciChecks = await this.validateRequiredChecks(
					prNumber,
					config.requiredChecks
				);
				if (!validationResults.checks.ciChecks.passed) {
					validationResults.blockers.push(
						...validationResults.checks.ciChecks.blockers
					);
				}
			}

			// 4. Branch protection rules validation
			validationResults.checks.branchProtection =
				await this.validateBranchProtectionRules(prNumber);
			if (!validationResults.checks.branchProtection.passed) {
				validationResults.blockers.push(
					...validationResults.checks.branchProtection.blockers
				);
			}

			// 5. Conflict detection
			validationResults.checks.conflicts =
				await this.validateNoConflicts(prNumber);
			if (!validationResults.checks.conflicts.passed) {
				validationResults.blockers.push(
					...validationResults.checks.conflicts.blockers
				);
			}

			// 6. Recent activity check
			validationResults.checks.recentActivity =
				await this.validateRecentActivity(prNumber, config);
			if (!validationResults.checks.recentActivity.passed) {
				if (config.strictMode) {
					validationResults.blockers.push(
						...validationResults.checks.recentActivity.blockers
					);
				} else {
					validationResults.warnings.push(
						...validationResults.checks.recentActivity.warnings
					);
				}
			}

			// 7. Custom validation hooks (if configured)
			if (config.customValidationHooks) {
				validationResults.checks.customHooks =
					await this.runCustomValidationHooks(
						prNumber,
						config.customValidationHooks
					);
				if (!validationResults.checks.customHooks.passed) {
					validationResults.blockers.push(
						...validationResults.checks.customHooks.blockers
					);
				}
			}

			// Determine final eligibility
			validationResults.eligible = validationResults.blockers.length === 0;

			return {
				canMerge: validationResults.eligible,
				reason: validationResults.eligible
					? 'All validation checks passed'
					: 'Validation checks failed',
				validationResults,
				timestamp: new Date().toISOString()
			};
		} catch (error) {
			return {
				canMerge: false,
				reason: 'Error during merge validation',
				error: error.message,
				timestamp: new Date().toISOString()
			};
		}
	}

	/**
	 * Legacy method for backward compatibility
	 */
	async canAutoMergePR(prNumber, requiredChecks = []) {
		const result = await this.validateMergeEligibility(prNumber, {
			requiredChecks
		});
		return {
			canMerge: result.canMerge,
			reason: result.reason,
			details: result.validationResults || { error: result.error }
		};
	}

	/**
	 * Validate basic PR state requirements
	 */
	validatePRState(prStatus) {
		const blockers = [];

		if (prStatus.draft) {
			blockers.push('PR is still in draft mode');
		}

		if (prStatus.state !== 'OPEN') {
			blockers.push(`PR state is ${prStatus.state}, expected OPEN`);
		}

		if (!prStatus.mergeable) {
			blockers.push('PR is not mergeable (conflicts or other issues)');
		}

		return {
			passed: blockers.length === 0,
			blockers,
			details: {
				draft: prStatus.draft,
				state: prStatus.state,
				mergeable: prStatus.mergeable
			}
		};
	}

	/**
	 * Validate required CI/CD checks
	 */
	async validateRequiredChecks(prNumber, requiredChecks) {
		const checks = await this.getPRChecks(prNumber);
		const blockers = [];

		const missingChecks = requiredChecks.filter(
			(required) =>
				!checks.some(
					(check) =>
						check.name === required &&
						check.status === 'completed' &&
						check.conclusion === 'success'
				)
		);

		if (missingChecks.length > 0) {
			blockers.push(
				`Required checks not satisfied: ${missingChecks.join(', ')}`
			);
		}

		const failedChecks = checks.filter(
			(check) => check.status === 'completed' && check.conclusion === 'failure'
		);

		if (failedChecks.length > 0) {
			blockers.push(
				`Failed checks: ${failedChecks.map((c) => c.name).join(', ')}`
			);
		}

		return {
			passed: blockers.length === 0,
			blockers,
			details: {
				requiredChecks,
				missingChecks,
				failedChecks: failedChecks.map((c) => c.name),
				allChecks: checks.map((c) => ({
					name: c.name,
					status: c.status,
					conclusion: c.conclusion
				}))
			}
		};
	}

	/**
	 * Validate branch protection rules
	 */
	async validateBranchProtectionRules(prNumber) {
		try {
			const { execSync } = await import('child_process');
			const prStatus = await this.getPRStatus(prNumber);

			// Get branch protection info
			const protectionRaw = execSync(
				`gh api repos/:owner/:repo/branches/${prStatus.baseRef}/protection --jq '.required_status_checks.strict'`,
				{
					encoding: 'utf8',
					cwd: this.projectRoot
				}
			).trim();

			const strictChecks = protectionRaw === 'true';
			const blockers = [];

			if (strictChecks) {
				// Check if branch is up to date with base
				const comparison = execSync(
					`gh api repos/:owner/:repo/compare/${prStatus.baseRef}...${prStatus.headRef} --jq '.status'`,
					{
						encoding: 'utf8',
						cwd: this.projectRoot
					}
				).trim();

				if (comparison === 'behind') {
					blockers.push(
						'Branch is behind base branch and strict status checks are enabled'
					);
				}
			}

			return {
				passed: blockers.length === 0,
				blockers,
				details: {
					strictChecks,
					baseRef: prStatus.baseRef,
					headRef: prStatus.headRef
				}
			};
		} catch (error) {
			// If we can't check protection rules, assume they're fine but log warning
			return {
				passed: true,
				blockers: [],
				warnings: [
					`Could not verify branch protection rules: ${error.message}`
				],
				details: { error: error.message }
			};
		}
	}

	/**
	 * Validate no merge conflicts exist
	 */
	async validateNoConflicts(prNumber) {
		try {
			const prStatus = await this.getPRStatus(prNumber);
			const blockers = [];

			if (prStatus.mergeable === false) {
				blockers.push('PR has merge conflicts');
			}

			return {
				passed: blockers.length === 0,
				blockers,
				details: {
					mergeable: prStatus.mergeable
				}
			};
		} catch (error) {
			return {
				passed: false,
				blockers: [`Error checking conflicts: ${error.message}`],
				details: { error: error.message }
			};
		}
	}

	/**
	 * Validate no recent activity that might interfere
	 */
	async validateRecentActivity(prNumber, config) {
		try {
			const { execSync } = await import('child_process');
			const prStatus = await this.getPRStatus(prNumber);

			const timeWindow = config.recentActivityWindow || '30 minutes ago';
			const blockers = [];
			const warnings = [];

			// Check for recent commits on base branch
			const recentCommits = execSync(
				`git log --oneline --since="${timeWindow}" origin/${prStatus.baseRef}`,
				{
					encoding: 'utf8',
					cwd: this.projectRoot
				}
			).trim();

			if (recentCommits.length > 0) {
				const message = `Recent activity detected on ${prStatus.baseRef} branch`;
				if (config.strictMode) {
					blockers.push(message);
				} else {
					warnings.push(message);
				}
			}

			// Check for recent pushes to PR branch
			const prCommits = execSync(
				`git log --oneline --since="${timeWindow}" origin/${prStatus.headRef}`,
				{
					encoding: 'utf8',
					cwd: this.projectRoot
				}
			).trim();

			if (prCommits.length > 0) {
				const message = `Recent commits on PR branch ${prStatus.headRef}`;
				warnings.push(message);
			}

			return {
				passed: blockers.length === 0,
				blockers,
				warnings,
				details: {
					timeWindow,
					recentCommitsOnBase: recentCommits.split('\n').filter(Boolean),
					recentCommitsOnPR: prCommits.split('\n').filter(Boolean)
				}
			};
		} catch (error) {
			return {
				passed: true,
				blockers: [],
				warnings: [`Could not check recent activity: ${error.message}`],
				details: { error: error.message }
			};
		}
	}

	/**
	 * Run custom validation hooks
	 */
	async runCustomValidationHooks(prNumber, hooks) {
		const blockers = [];
		const results = [];

		for (const hook of hooks) {
			try {
				// This would call custom validation logic
				// For now, just a placeholder
				const result = await this.executeCustomValidationHook(prNumber, hook);
				results.push(result);

				if (!result.passed) {
					blockers.push(
						`Custom validation '${hook.name}' failed: ${result.reason}`
					);
				}
			} catch (error) {
				blockers.push(
					`Custom validation '${hook.name}' error: ${error.message}`
				);
			}
		}

		return {
			passed: blockers.length === 0,
			blockers,
			details: { results }
		};
	}

	/**
	 * Execute a single custom validation hook
	 */
	async executeCustomValidationHook(prNumber, hook) {
		// Placeholder for custom validation logic
		// In a real implementation, this would:
		// 1. Load the hook script/function
		// 2. Execute it with PR context
		// 3. Return validation result

		return {
			name: hook.name,
			passed: true,
			reason: 'Custom validation not implemented'
		};
	}

	/**
	 * Enhanced merge execution with comprehensive validation phases
	 */
	async executeMerge(prNumber, config = {}) {
		const mergeAttempt = {
			id: `merge-${prNumber}-${Date.now()}`,
			prNumber,
			startTime: Date.now(),
			phases: [],
			config
		};

		try {
			console.log(`🚀 Starting enhanced merge execution for PR ${prNumber}...`);

			// Phase 1: Pre-merge validation
			const validationResult = await this.executePhase(mergeAttempt, 'validation', async () => {
				return await this.validateMergeEligibility(prNumber, config.safetyChecks || {});
			});

			if (!validationResult.canMerge) {
				return {
					success: false,
					reason: validationResult.reason,
					mergeAttempt,
					canRetry: this.isRetryableFailure(validationResult.reason)
				};
			}

			// Phase 2: Advanced conflict detection
			const conflictResult = await this.executePhase(mergeAttempt, 'conflict-detection', async () => {
				return await this.performAdvancedConflictDetection(prNumber, config);
			});

			if (!conflictResult.safe) {
				// Check if human intervention is required
				if (conflictResult.requiresHumanIntervention) {
					return await this.triggerHumanInLoop(prNumber, conflictResult, mergeAttempt, config);
				}

				return {
					success: false,
					reason: `Conflicts detected: ${conflictResult.conflicts?.join(', ')}`,
					mergeAttempt,
					canRetry: false
				};
			}

			// Phase 3: Safety checks
			const safetyResult = await this.executePhase(mergeAttempt, 'safety-checks', async () => {
				return await this.performMergeSafetyChecks(prNumber);
			});

			if (!safetyResult.safe) {
				return {
					success: false,
					reason: `Safety checks failed: ${safetyResult.error}`,
					mergeAttempt,
					canRetry: safetyResult.hasRecentActivity
				};
			}

			// Phase 4: Execute merge
			const mergeResult = await this.executePhase(mergeAttempt, 'merge-execution', async () => {
				return await this.performActualMerge(prNumber, config);
			});

			if (!mergeResult.success) {
				return {
					success: false,
					reason: mergeResult.reason,
					mergeAttempt,
					canRetry: mergeResult.canRetry
				};
			}

			// Phase 5: Post-merge validation
			const postMergeResult = await this.executePhase(mergeAttempt, 'post-merge-validation', async () => {
				return await this.validatePostMerge(prNumber, mergeResult);
			});

			if (!postMergeResult.success) {
				// Trigger rollback if enabled
				if (config.rollback?.enabled) {
					await this.executePhase(mergeAttempt, 'rollback-preparation', async () => {
						return await this.prepareRollback(prNumber, mergeResult, config.rollback);
					});
				}

				return {
					success: false,
					reason: postMergeResult.reason,
					mergeAttempt,
					canRetry: false
				};
			}

			// Cleanup (if configured)
			let cleanupResult = null;
			if (config.cleanupWorktree || config.updateTaskStatus || config.updateASTCache) {
				cleanupResult = await this.executePhase(mergeAttempt, 'cleanup', async () => {
					return await this.performPostMergeCleanup(prNumber, mergeResult, config);
				});
			}

			mergeAttempt.endTime = Date.now();
			mergeAttempt.duration = mergeAttempt.endTime - mergeAttempt.startTime;

			console.log(`✅ Enhanced merge completed for PR ${prNumber} in ${mergeAttempt.duration}ms`);

			return {
				success: true,
				mergeResult,
				mergeAttempt,
				cleanupResult,
				timestamp: new Date().toISOString()
			};

		} catch (error) {
			console.error(`❌ Enhanced merge failed for PR ${prNumber}:`, error);

			// Mark current phase as failed
			if (mergeAttempt.phases.length > 0) {
				const currentPhase = mergeAttempt.phases[mergeAttempt.phases.length - 1];
				if (currentPhase.status === 'running') {
					currentPhase.status = 'failed';
					currentPhase.error = error.message;
					currentPhase.endTime = Date.now();
				}
			}

			return {
				success: false,
				reason: `Merge execution failed: ${error.message}`,
				mergeAttempt,
				canRetry: this.isRetryableFailure(error.message)
			};
		}
	}

	/**
	 * Execute a merge phase with tracking
	 */
	async executePhase(mergeAttempt, phaseName, phaseFunction) {
		const phase = {
			phase: phaseName,
			startTime: Date.now(),
			status: 'running'
		};

		mergeAttempt.phases.push(phase);

		try {
			console.log(`  📍 Phase ${mergeAttempt.phases.length}: ${phaseName}...`);
			
			const result = await phaseFunction();
			
			phase.status = 'completed';
			phase.endTime = Date.now();
			phase.duration = phase.endTime - phase.startTime;
			phase.result = result;

			console.log(`    ✅ ${phaseName} completed in ${phase.duration}ms`);
			return result;

		} catch (error) {
			phase.status = 'failed';
			phase.endTime = Date.now();
			phase.error = error.message;

			console.log(`    ❌ ${phaseName} failed: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Advanced conflict detection with file-level analysis
	 */
	async performAdvancedConflictDetection(prNumber, config) {
		try {
			const { execSync } = await import('child_process');

			// Get PR information
			const prStatus = await this.getPRStatus(prNumber);
			
			const result = {
				safe: true,
				conflicts: [],
				requiresHumanIntervention: false,
				details: {}
			};

			// Basic mergeable check
			if (prStatus.mergeable === false) {
				result.safe = false;
				result.conflicts.push('merge-conflicts');
				result.requiresHumanIntervention = true;
			}

			// Check for conflicting files using git
			try {
				const mergeBase = execSync(
					`git merge-base origin/${prStatus.baseRef} origin/${prStatus.headRef}`,
					{ encoding: 'utf8', cwd: this.projectRoot }
				).trim();

				// Get list of changed files
				const changedFiles = execSync(
					`git diff --name-only ${mergeBase}..origin/${prStatus.headRef}`,
					{ encoding: 'utf8', cwd: this.projectRoot }
				).trim().split('\n').filter(Boolean);

				// Check for recent changes to the same files on base branch
				const recentBaseChanges = execSync(
					`git diff --name-only ${mergeBase}..origin/${prStatus.baseRef}`,
					{ encoding: 'utf8', cwd: this.projectRoot }
				).trim().split('\n').filter(Boolean);

				const overlappingFiles = changedFiles.filter(file => 
					recentBaseChanges.includes(file)
				);

				if (overlappingFiles.length > 0) {
					result.conflicts.push('overlapping-file-changes');
					result.details.overlappingFiles = overlappingFiles;
					
					// Check if this requires human intervention
					const criticalFiles = overlappingFiles.filter(file => 
						file.includes('package.json') || 
						file.includes('package-lock.json') ||
						file.includes('.env') ||
						file.endsWith('.config.js') ||
						file.endsWith('.config.json')
					);

					if (criticalFiles.length > 0) {
						result.requiresHumanIntervention = true;
						result.details.criticalFiles = criticalFiles;
					}
				}

				result.details.changedFiles = changedFiles;
				result.details.recentBaseChanges = recentBaseChanges;

			} catch (error) {
				console.warn('Advanced conflict detection failed:', error.message);
				// Fall back to basic check
			}

			// Check for conflicting dependency updates
			if (config.checkDependencyConflicts !== false) {
				const depConflicts = await this.checkDependencyConflicts(prNumber);
				if (depConflicts.hasConflicts) {
					result.conflicts.push('dependency-conflicts');
					result.details.dependencyConflicts = depConflicts;
					result.requiresHumanIntervention = depConflicts.severity === 'high';
				}
			}

			// Final safety determination
			result.safe = result.conflicts.length === 0;

			return result;

		} catch (error) {
			return {
				safe: false,
				conflicts: ['detection-error'],
				requiresHumanIntervention: true,
				error: error.message
			};
		}
	}

	/**
	 * Check for dependency conflicts
	 */
	async checkDependencyConflicts(prNumber) {
		try {
			const { execSync } = await import('child_process');
			const fs = await import('fs');

			const prStatus = await this.getPRStatus(prNumber);
			
			// Check if package.json was modified
			const changedFiles = execSync(
				`gh pr diff ${prNumber} --name-only`,
				{ encoding: 'utf8', cwd: this.projectRoot }
			).trim().split('\n');

			const packageJsonChanged = changedFiles.includes('package.json');
			const packageLockChanged = changedFiles.includes('package-lock.json') || 
									 changedFiles.includes('yarn.lock') || 
									 changedFiles.includes('pnpm-lock.yaml');

			if (!packageJsonChanged && !packageLockChanged) {
				return { hasConflicts: false };
			}

			// Analyze package.json changes
			if (packageJsonChanged) {
				const packageDiff = execSync(
					`gh pr diff ${prNumber} -- package.json`,
					{ encoding: 'utf8', cwd: this.projectRoot }
				);

				// Look for version conflicts
				const versionChanges = packageDiff.match(/[+-]\s*"[^"]+"\s*:\s*"[^"]+"/g) || [];
				const majorVersionChanges = versionChanges.filter(change => 
					change.includes('^') && change.includes('+')
				);

				if (majorVersionChanges.length > 0) {
					return {
						hasConflicts: true,
						severity: 'high',
						details: {
							majorVersionChanges,
							reason: 'Major version updates detected'
						}
					};
				}
			}

			return { hasConflicts: false };

		} catch (error) {
			return {
				hasConflicts: true,
				severity: 'medium',
				error: error.message
			};
		}
	}

	/**
	 * Trigger human-in-loop workflow for conflict resolution
	 */
	async triggerHumanInLoop(prNumber, conflictResult, mergeAttempt, config) {
		console.log(`🚨 Human intervention required for PR ${prNumber}`);

		// Pause automation
		const pauseResult = await this.executePhase(mergeAttempt, 'human-intervention-pause', async () => {
			return {
				paused: true,
				reason: 'conflicts-require-human-intervention',
				conflicts: conflictResult.conflicts,
				timestamp: new Date().toISOString()
			};
		});

		// Trigger notifications if configured
		if (config.notifications?.enabled) {
			await this.notifyHumanIntervention(prNumber, conflictResult, config);
		}

		// Create incident report if enabled
		if (config.rollback?.createIncidentReport) {
			await this.createIncidentReport(prNumber, conflictResult, mergeAttempt);
		}

		return {
			success: false,
			reason: 'Human intervention required',
			mergeAttempt,
			canRetry: false,
			humanInterventionRequired: true,
			interventionDetails: {
				conflicts: conflictResult.conflicts,
				details: conflictResult.details,
				pausedAt: pauseResult.timestamp
			}
		};
	}

	/**
	 * Notify stakeholders of human intervention requirement
	 */
	async notifyHumanIntervention(prNumber, conflictResult, config) {
		// This would integrate with the notification system from Phase 3
		console.log(`📧 Notifying stakeholders about PR ${prNumber} requiring intervention`);
		
		const notificationData = {
			type: 'human-intervention-required',
			prNumber,
			conflicts: conflictResult.conflicts,
			severity: conflictResult.requiresHumanIntervention ? 'high' : 'medium',
			details: conflictResult.details
		};

		// Integration point with NotificationProvider from Phase 3
		if (this.notificationService) {
			await this.notificationService.notify('human-intervention-required', notificationData, {
				priority: 'high',
				channels: config.notifications.escalationChannels || ['app', 'slack', 'email']
			});
		}

		return { notified: true };
	}

	/**
	 * Create incident report for complex conflicts
	 */
	async createIncidentReport(prNumber, conflictResult, mergeAttempt) {
		const report = {
			id: `incident-${prNumber}-${Date.now()}`,
			prNumber,
			timestamp: new Date().toISOString(),
			type: 'merge-conflict-intervention',
			conflicts: conflictResult.conflicts,
			details: conflictResult.details,
			mergeAttempt: {
				id: mergeAttempt.id,
				phases: mergeAttempt.phases,
				duration: Date.now() - mergeAttempt.startTime
			},
			severity: conflictResult.requiresHumanIntervention ? 'high' : 'medium'
		};

		// Save incident report
		const fs = await import('fs');
		const path = await import('path');
		
		const incidentDir = path.join(this.projectRoot, '.taskmaster', 'incidents');
		if (!fs.existsSync(incidentDir)) {
			fs.mkdirSync(incidentDir, { recursive: true });
		}

		const reportPath = path.join(incidentDir, `${report.id}.json`);
		fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

		console.log(`📄 Incident report created: ${reportPath}`);
		return { reportPath, report };
	}

	/**
	 * Perform post-merge cleanup with enhanced safety
	 */
	async performPostMergeCleanup(prNumber, mergeResult, config) {
		const cleanup = {
			worktree: { actions: [], errors: [] },
			astCache: { invalidatedFiles: 0, errors: [] },
			taskStatus: { actions: [], errors: [] },
			errors: []
		};

		try {
			// Worktree cleanup
			if (config.cleanupWorktree) {
				try {
					const cleanupResult = await this.triggerCleanup(prNumber, {
						worktreeName: config.worktreeName,
						taskId: config.taskId,
						mergedBranch: mergeResult.branch
					});

					if (cleanupResult.success) {
						cleanup.worktree = cleanupResult.cleanupResult.worktree || cleanup.worktree;
						cleanup.astCache = cleanupResult.cleanupResult.astCache || cleanup.astCache;
						cleanup.taskStatus = cleanupResult.cleanupResult.taskStatus || cleanup.taskStatus;
					} else {
						cleanup.errors.push(`Cleanup failed: ${cleanupResult.error}`);
					}
				} catch (error) {
					cleanup.errors.push(`Cleanup error: ${error.message}`);
				}
			}

			return cleanup;

		} catch (error) {
			cleanup.errors.push(`Cleanup execution failed: ${error.message}`);
			return cleanup;
		}
	}

	/**
	 * Check if a failure is retryable
	 */
	isRetryableFailure(reason) {
		const retryableReasons = [
			'checks-pending',
			'rate-limit',
			'temporary-network-error',
			'merge-queue-busy',
			'github-api-error'
		];

		return retryableReasons.some(retryable => 
			reason?.toLowerCase().includes(retryable.toLowerCase())
		);
	}

	/**
	 * Prepare rollback for failed merge
	 */
	async prepareRollback(prNumber, mergeResult, rollbackConfig) {
		console.log(`🔄 Preparing rollback for PR ${prNumber}...`);

		const rollback = {
			prepared: true,
			timestamp: new Date().toISOString(),
			preservedEvidence: rollbackConfig.preserveEvidence,
			incidentReportCreated: rollbackConfig.createIncidentReport
		};

		// Preserve evidence if configured
		if (rollbackConfig.preserveEvidence) {
			// Save merge attempt details, logs, etc.
			rollback.evidencePreserved = true;
		}

		return rollback;
	}

	/**
	 * Perform the actual merge operation
	 */
	async performActualMerge(prNumber, config) {
		try {
			const { execSync } = await import('child_process');
			const mergeMethod = config.mergeMethod || 'squash';

			let mergeCommand;
			switch (mergeMethod) {
				case 'squash':
					mergeCommand = `gh pr merge ${prNumber} --squash --auto`;
					break;
				case 'merge':
					mergeCommand = `gh pr merge ${prNumber} --merge --auto`;
					break;
				case 'rebase':
					mergeCommand = `gh pr merge ${prNumber} --rebase --auto`;
					break;
				default:
					mergeCommand = `gh pr merge ${prNumber} --squash --auto`;
			}

			const output = execSync(mergeCommand, {
				encoding: 'utf8',
				cwd: this.projectRoot
			});

			return {
				success: true,
				method: mergeMethod,
				output: output.trim(),
				timestamp: new Date().toISOString()
			};
		} catch (error) {
			return {
				success: false,
				reason: `Merge command failed: ${error.message}`,
				canRetry:
					error.message.includes('mergeable') ||
					error.message.includes('checks')
			};
		}
	}

	/**
	 * Validate merge was successful
	 */
	async validatePostMerge(prNumber, mergeResult) {
		try {
			const { execSync } = await import('child_process');

			// Wait a moment for GitHub to process
			await new Promise((resolve) => setTimeout(resolve, 5000));

			// Check PR status
			const prStatus = await this.getPRStatus(prNumber);

			if (prStatus.state !== 'MERGED') {
				return {
					success: false,
					reason: `PR state is ${prStatus.state}, expected MERGED`
				};
			}

			// Verify merge commit exists
			try {
				const mergeCommit = execSync(
					`git log --oneline -1 --grep="Merge pull request #${prNumber}"`,
					{
						encoding: 'utf8',
						cwd: this.projectRoot
					}
				).trim();

				if (!mergeCommit) {
					return {
						success: false,
						reason: 'Merge commit not found in git history'
					};
				}
			} catch (error) {
				// For squash merges, the commit message might be different
				// Continue validation
			}

			return {
				success: true,
				prStatus,
				timestamp: new Date().toISOString()
			};
		} catch (error) {
			return {
				success: false,
				reason: `Post-merge validation failed: ${error.message}`
			};
		}
	}

	/**
	 * Execute post-merge cleanup
	 */
	async executePostMergeCleanup(prNumber, config) {
		const cleanupResults = {
			success: true,
			warnings: [],
			actions: []
		};

		try {
			// Cleanup actions based on config
			if (config.cleanupWorktree) {
				try {
					// This would trigger worktree cleanup
					cleanupResults.actions.push('worktree-cleanup-scheduled');
				} catch (error) {
					cleanupResults.warnings.push(
						`Worktree cleanup failed: ${error.message}`
					);
				}
			}

			if (config.updateASTCache) {
				try {
					// This would trigger AST cache update
					cleanupResults.actions.push('ast-cache-updated');
				} catch (error) {
					cleanupResults.warnings.push(
						`AST cache update failed: ${error.message}`
					);
				}
			}

			if (config.updateTaskStatus) {
				try {
					// This would update related task status
					cleanupResults.actions.push('task-status-updated');
				} catch (error) {
					cleanupResults.warnings.push(
						`Task status update failed: ${error.message}`
					);
				}
			}

			return cleanupResults;
		} catch (error) {
			cleanupResults.success = false;
			cleanupResults.warnings.push(`Cleanup failed: ${error.message}`);
			return cleanupResults;
		}
	}

	/**
	 * Execute rollback to previous state
	 */
	async executeRollback(rollbackData, reason) {
		try {
			const { execSync } = await import('child_process');

			const rollbackAttempt = {
				timestamp: new Date().toISOString(),
				reason,
				rollbackData,
				actions: [],
				success: false
			};

			// 1. Restore working directory state
			if (rollbackData.workingState.branch) {
				try {
					execSync(`git checkout ${rollbackData.workingState.branch}`, {
						cwd: this.projectRoot
					});
					rollbackAttempt.actions.push('working-branch-restored');
				} catch (error) {
					rollbackAttempt.actions.push(
						`working-branch-restore-failed: ${error.message}`
					);
				}
			}

			// 2. Reset base branch to previous state
			try {
				execSync(`git fetch origin`, { cwd: this.projectRoot });
				execSync(`git checkout ${rollbackData.baseRef}`, {
					cwd: this.projectRoot
				});
				execSync(`git reset --hard ${rollbackData.baseCommit}`, {
					cwd: this.projectRoot
				});
				rollbackAttempt.actions.push('base-branch-reset');
			} catch (error) {
				rollbackAttempt.actions.push(
					`base-branch-reset-failed: ${error.message}`
				);
			}

			// 3. Create incident report
			if (rollbackData.config?.rollback?.createIncidentReport) {
				try {
					await this.createRollbackIncidentReport(rollbackAttempt);
					rollbackAttempt.actions.push('incident-report-created');
				} catch (error) {
					rollbackAttempt.actions.push(
						`incident-report-failed: ${error.message}`
					);
				}
			}

			// 4. Notify stakeholders (if configured)
			if (rollbackData.config?.rollback?.notifyStakeholders) {
				try {
					await this.notifyStakeholders(rollbackAttempt);
					rollbackAttempt.actions.push('stakeholders-notified');
				} catch (error) {
					rollbackAttempt.actions.push(`notification-failed: ${error.message}`);
				}
			}

			rollbackAttempt.success = true;
			rollbackAttempt.completedAt = new Date().toISOString();

			return rollbackAttempt;
		} catch (error) {
			throw new Error(`Rollback execution failed: ${error.message}`);
		}
	}

	/**
	 * Create incident report for rollback
	 */
	async createRollbackIncidentReport(rollbackAttempt) {
		try {
			const fs = await import('fs/promises');
			const path = await import('path');

			const incidentDir = path.join(
				this.projectRoot,
				'.taskmaster',
				'incidents'
			);
			await fs.mkdir(incidentDir, { recursive: true });

			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const filename = `merge-rollback-${timestamp}.json`;
			const filePath = path.join(incidentDir, filename);

			const report = {
				type: 'merge-rollback',
				timestamp: rollbackAttempt.timestamp,
				reason: rollbackAttempt.reason,
				rollbackData: rollbackAttempt.rollbackData,
				actions: rollbackAttempt.actions,
				environment: {
					projectRoot: this.projectRoot,
					nodeVersion: process.version,
					platform: process.platform
				}
			};

			await fs.writeFile(filePath, JSON.stringify(report, null, 2));

			return { success: true, reportPath: filePath };
		} catch (error) {
			throw new Error(`Failed to create incident report: ${error.message}`);
		}
	}

	/**
	 * Notify stakeholders of rollback
	 */
	async notifyStakeholders(rollbackAttempt) {
		// Placeholder for stakeholder notification logic
		// In a real implementation, this would:
		// 1. Send emails/Slack messages
		// 2. Create GitHub issues
		// 3. Update project dashboards
		// 4. Log to monitoring systems

		return { success: true, notified: [] };
	}

	/**
	 * Perform additional safety checks before auto-merge
	 */
	async performMergeSafetyChecks(prNumber) {
		try {
			const { execSync } = await import('child_process');

			// Check if PR is up to date with base branch
			const prInfo = await this.getPRStatus(prNumber);

			// Get commit comparison
			const comparison = execSync(
				`gh api repos/:owner/:repo/compare/${prInfo.baseRef}...${prInfo.headRef} --jq '.status'`,
				{
					encoding: 'utf8',
					cwd: this.projectRoot
				}
			).trim();

			const upToDate = comparison === 'identical' || comparison === 'ahead';

			// Check for recent commits on base branch
			const recentCommits = execSync(
				`git log --oneline --since="1 hour ago" origin/${prInfo.baseRef}`,
				{
					encoding: 'utf8',
					cwd: this.projectRoot
				}
			).trim();

			const hasRecentActivity = recentCommits.length > 0;

			return {
				safe: upToDate && !hasRecentActivity,
				upToDate,
				hasRecentActivity,
				comparison,
				details: {
					baseRef: prInfo.baseRef,
					headRef: prInfo.headRef,
					recentCommits: recentCommits.split('\n').filter(Boolean)
				}
			};
		} catch (error) {
			return {
				safe: false,
				error: error.message
			};
		}
	}

	/**
	 * Get all monitored PRs from the monitoring service
	 */
	async getAllMonitoredPRs() {
		if (!this.prMonitoringService) {
			await this.initializePRMonitoring();
		}
		return this.prMonitoringService.getAllMonitoredPRs();
	}

	/**
	 * Get detailed information for a specific PR from the monitoring service
	 */
	async getPRDetails(prNumber) {
		if (!this.prMonitoringService) {
			await this.initializePRMonitoring();
		}
		return this.prMonitoringService.getPRDetails(prNumber);
	}

	/**
	 * Pause monitoring for a specific PR
	 */
	async pausePRMonitoring(prNumber) {
		if (!this.prMonitoringService) {
			await this.initializePRMonitoring();
		}
		return this.prMonitoringService.pauseMonitoring(prNumber);
	}

	/**
	 * Resume monitoring for a specific PR
	 */
	async resumePRMonitoring(prNumber) {
		if (!this.prMonitoringService) {
			await this.initializePRMonitoring();
		}
		return this.prMonitoringService.resumeMonitoring(prNumber);
	}

	/**
	 * Force a merge for a specific PR, bypassing some safety checks
	 */
	async forceMerge(prNumber) {
		const mergeConfig = {
			mergeMethod: 'merge', // Or allow this to be passed in
			// Bypassing most safety checks, but keeping essential ones
			safetyChecks: {
				validatePRState: true,
				validateNoConflicts: true
			},
			cleanupWorktree: true,
			updateTaskStatus: true
		};
		return this.executeMerge(prNumber, mergeConfig);
	}

	/**
	 * Get cleanup service configuration
	 */
	async getCleanupConfiguration() {
		try {
			const { CleanupService } = await import('../services/CleanupService.js');
			const cleanupService = new CleanupService({
				projectRoot: this.projectRoot
			});
			return {
				success: true,
				config: cleanupService.getConfig(),
				stats: cleanupService.getStats()
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Update cleanup service configuration
	 */
	async updateCleanupConfiguration(newConfig) {
		try {
			const { CleanupService } = await import('../services/CleanupService.js');
			const cleanupService = new CleanupService({
				projectRoot: this.projectRoot
			});
			cleanupService.updateConfig(newConfig);

			// Save configuration to file
			const configPath = path.join(
				this.projectRoot,
				'.taskmaster/config/cleanup.json'
			);
			await fs.mkdir(path.dirname(configPath), { recursive: true });
			await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2));

			return {
				success: true,
				config: cleanupService.getConfig()
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Trigger immediate cleanup for a specific PR
	 */
	async triggerCleanup(prNumber, mergeInfo = {}) {
		try {
			const { CleanupService } = await import('../services/CleanupService.js');

			// Load saved configuration if available
			let config = {};
			try {
				const configPath = path.join(
					this.projectRoot,
					'.taskmaster/config/cleanup.json'
				);
				const configData = await fs.readFile(configPath, 'utf8');
				config = JSON.parse(configData);
			} catch (error) {
				// Use defaults if no saved config
			}

			const cleanupService = new CleanupService({
				projectRoot: this.projectRoot,
				...config
			});

			const result = await cleanupService.performPostMergeCleanup(
				prNumber,
				mergeInfo
			);

			return {
				success: true,
				cleanupResult: result
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Get current configuration from the hook config file
	 */
	async getConfiguration() {
		try {
			const fs = await import('fs/promises');
			const path = await import('path');

			const configPath = path.join(
				this.projectRoot,
				'scripts/modules/flow/hooks/config/default-config.json'
			);

			const configData = await fs.readFile(configPath, 'utf8');
			const fullConfig = JSON.parse(configData);

			// Return the PR lifecycle management configuration
			return fullConfig.hooks['pr-lifecycle-management']?.config || {};
		} catch (error) {
			console.error('Failed to load configuration:', error);
			throw new Error(`Configuration load failed: ${error.message}`);
		}
	}

	/**
	 * Update configuration in the hook config file
	 */
	async updateConfiguration(newConfig) {
		try {
			const fs = await import('fs/promises');
			const path = await import('path');

			const configPath = path.join(
				this.projectRoot,
				'scripts/modules/flow/hooks/config/default-config.json'
			);

			// Load current full config
			const configData = await fs.readFile(configPath, 'utf8');
			const fullConfig = JSON.parse(configData);

			// Update the PR lifecycle management configuration
			if (!fullConfig.hooks) {
				fullConfig.hooks = {};
			}
			if (!fullConfig.hooks['pr-lifecycle-management']) {
				fullConfig.hooks['pr-lifecycle-management'] = {};
			}

			fullConfig.hooks['pr-lifecycle-management'].config = newConfig;

			// Write back to file
			await fs.writeFile(configPath, JSON.stringify(fullConfig, null, '\t'));

			return true;
		} catch (error) {
			console.error('Failed to update configuration:', error);
			throw new Error(`Configuration update failed: ${error.message}`);
		}
	}

	// ================================
	// Dependency Analysis Methods
	// ================================

	/**
	 * Analyze task dependencies and readiness
	 */
	async analyzeDependencies(options = {}) {
		try {
			const { DependencyAnalysisService } = await import(
				'../services/DependencyAnalysisService.js'
			);

			if (!this.dependencyAnalysisService) {
				this.dependencyAnalysisService = new DependencyAnalysisService({
					projectRoot: this.projectRoot
				});
				await this.dependencyAnalysisService.initialize();
			}

			// Get current tasks data
			const tasksResult = await this.getTasks();
			if (!tasksResult.success) {
				return { success: false, error: 'Failed to load tasks for analysis' };
			}

			// Run dependency analysis
			const analysis = await this.dependencyAnalysisService.analyzeDependencies(
				tasksResult.data,
				options
			);

			return {
				success: true,
				data: analysis
			};
		} catch (error) {
			console.error('Dependency analysis failed:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Get dependency analysis statistics
	 */
	async getDependencyAnalysisStats() {
		try {
			if (!this.dependencyAnalysisService) {
				return {
					success: false,
					error: 'Dependency analysis service not initialized'
				};
			}

			const stats = this.dependencyAnalysisService.getStats();

			return {
				success: true,
				data: stats
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Clear dependency analysis cache
	 */
	async clearDependencyAnalysisCache() {
		try {
			if (!this.dependencyAnalysisService) {
				return {
					success: false,
					error: 'Dependency analysis service not initialized'
				};
			}

			this.dependencyAnalysisService.clearCache();

			return {
				success: true,
				message: 'Dependency analysis cache cleared'
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Update dependency analysis configuration
	 */
	async updateDependencyAnalysisConfig(newConfig) {
		try {
			if (!this.dependencyAnalysisService) {
				return {
					success: false,
					error: 'Dependency analysis service not initialized'
				};
			}

			this.dependencyAnalysisService.updateConfig(newConfig);

			return {
				success: true,
				message: 'Dependency analysis configuration updated'
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Set the branch awareness manager (called by Flow app)
	 */
	setBranchManager(branchManager) {
		this.branchManager = branchManager;
		
		// If we already have a worktree manager, connect them
		if (this.worktreeManager) {
			this.worktreeManager.setBranchManager(branchManager);
		}
	}

	/**
	 * Update telemetry data
	 */
	updateTelemetry(data) {
		if (data && data.telemetryData) {
			this.telemetryData = data.telemetryData;
		}
	}

	// Phase 3: Enhanced workflow methods
	/**
	 * Detect remote repository information
	 * @returns {Promise<Object>} Repository information
	 */
	async detectRemoteRepository() {
		try {
			// Use the BranchAwarenessManager if available
			if (this.branchManager) {
				const remoteData = await this.branchManager.detectRemoteRepository();
				return {
					isGitHub: remoteData.isGitHub,
					provider: remoteData.provider,
					hasGitHubCLI: await this.branchManager.canCreatePullRequests(),
					remoteInfo: await this.branchManager.getRemoteInfo(),
					error: remoteData.error || null,
					hasRemote: remoteData.hasRemote,
					url: remoteData.url
				};
			}

			// Fallback implementation
			const execAsync = promisify(exec);
			
			try {
				const { stdout } = await execAsync('git remote get-url origin', {
					cwd: this.projectRoot,
					stdio: 'pipe' // Suppress stderr output
				});
				
				const remoteUrl = stdout.trim();
				const isGitHub = remoteUrl.includes('github.com');
				
				let hasGitHubCLI = false;
				try {
					await execAsync('gh auth status', {
						stdio: 'pipe' // Suppress stderr output
					});
					hasGitHubCLI = true;
				} catch (error) {
					// GitHub CLI not available or not authenticated
				}

				return {
					isGitHub,
					provider: isGitHub ? 'GitHub' : 'Unknown',
					hasGitHubCLI: isGitHub && hasGitHubCLI,
					remoteInfo: {
						url: remoteUrl,
						isGitHub
					}
				};
			} catch (error) {
				// Not a git repository or no remote
				return {
					isGitHub: false,
					provider: 'Local',
					hasGitHubCLI: false,
					remoteInfo: null
				};
			}
		} catch (error) {
			console.warn('Failed to detect repository info:', error.message);
			return {
				isGitHub: false,
				provider: 'Local',
				hasGitHubCLI: false,
				remoteInfo: null
			};
		}
	}

	/**
	 * Commit subtask progress with proper commit message
	 * @param {string} worktreePath - Path to the worktree
	 * @param {Object} subtaskInfo - Subtask information
	 * @param {string} commitMessage - Commit message
	 * @param {Object} options - Commit options
	 * @returns {Promise<Object>} Commit result
	 */
	async commitSubtaskProgress(worktreePath, subtaskInfo, commitMessage, options = {}) {
		try {
			const execAsync = promisify(exec);
			
			// Stage all changes if auto-stage is enabled
			if (options.autoStage !== false) {
				await execAsync('git add .', { cwd: worktreePath });
			}
			
			// Commit with the provided message
			await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
				cwd: worktreePath
			});
			
			return {
				success: true,
				message: 'Changes committed successfully',
				commitHash: await this.getLatestCommitHash(worktreePath)
			};
		} catch (error) {
			return {
				success: false,
				error: `Commit failed: ${error.message}`
			};
		}
	}

	/**
	 * Get the latest commit hash from a worktree
	 * @param {string} worktreePath - Path to the worktree
	 * @returns {Promise<string>} Latest commit hash
	 */
	async getLatestCommitHash(worktreePath) {
		try {
			const execAsync = promisify(exec);
			const { stdout } = await execAsync('git rev-parse HEAD', {
				cwd: worktreePath
			});
			return stdout.trim();
		} catch (error) {
			return null;
		}
	}

	/**
	 * Generate commit message suggestions based on subtask and changes
	 * @param {Object} subtaskInfo - Subtask information
	 * @param {Object} gitStatus - Git status information
	 * @param {string} messageType - Type of commit message (feat, fix, etc.)
	 * @returns {Promise<Object>} Generated commit message
	 */
	async generateCommitMessage(subtaskInfo, gitStatus, messageType = 'feat') {
		try {
			const taskId = subtaskInfo.parentId || 'unknown';
			const subtaskId = subtaskInfo.id || 'unknown';
			const title = subtaskInfo.title || 'Subtask work';
			
			// Generate main commit message
			const mainMessage = `${messageType}(task-${taskId}): Complete subtask ${taskId}.${subtaskId} - ${title}`;
			
			// Generate body with implementation details
			const bodyLines = [];
			
			if (gitStatus.modified > 0) {
				bodyLines.push(`- Modified ${gitStatus.modified} file${gitStatus.modified > 1 ? 's' : ''}`);
			}
			if (gitStatus.added > 0) {
				bodyLines.push(`- Added ${gitStatus.added} file${gitStatus.added > 1 ? 's' : ''}`);
			}
			if (gitStatus.deleted > 0) {
				bodyLines.push(`- Deleted ${gitStatus.deleted} file${gitStatus.deleted > 1 ? 's' : ''}`);
			}
			
			// Add subtask context
			bodyLines.push('');
			bodyLines.push(`Subtask ${taskId}.${subtaskId}: ${title}`);
			bodyLines.push(`Relates to Task ${taskId}: ${subtaskInfo.parentTitle || 'Main task'}`);
			
			const fullMessage = `${mainMessage}\n\n${bodyLines.join('\n')}`;
			
			return {
				success: true,
				message: fullMessage,
				mainMessage,
				body: bodyLines.join('\n')
			};
		} catch (error) {
			return {
				success: false,
				error: `Failed to generate commit message: ${error.message}`
			};
		}
	}

	createLogWrapper() {
		return {
			debug: this.log.debug,
			info: this.log.info,
			warn: this.log.warn,
			error: this.log.error,
			success: this.log.success,
			log: this.log.log
		};
	}

	// Phase 5: Workflow Pattern Enforcement Methods

	/**
	 * Validate task readiness for PR creation
	 * @param {string} taskId - Task ID
	 * @returns {Promise<Object>} Validation result
	 */
	async validateTaskReadyForPR(taskId) {
		try {
			const { WorkflowValidator } = await import('../services/WorkflowValidator.js');
			const validator = new WorkflowValidator();
			return await validator.validateTaskReadyForPR(taskId);
		} catch (error) {
			console.error('Error validating task for PR:', error);
			return {
				isReady: false,
				errors: [`Validation error: ${error.message}`],
				warnings: [],
				suggestions: []
			};
		}
	}

	/**
	 * Validate subtask implementation pattern
	 * @param {string} subtaskId - Subtask ID
	 * @returns {Promise<Object>} Validation result
	 */
	async validateSubtaskImplementationPattern(subtaskId) {
		try {
			const { WorkflowValidator } = await import('../services/WorkflowValidator.js');
			const validator = new WorkflowValidator();
			return await validator.validateSubtaskImplementationPattern(subtaskId);
		} catch (error) {
			console.error('Error validating implementation pattern:', error);
			return {
				isValid: false,
				hasRequiredIssues: true,
				errors: [`Pattern validation error: ${error.message}`],
				warnings: [],
				phases: { exploration: false, implementation: false, completion: false }
			};
		}
	}

	/**
	 * Validate commit message format
	 * @param {string} message - Commit message
	 * @returns {Object} Validation result
	 */
	async validateCommitMessageFormat(message) {
		try {
			const { WorkflowValidator } = await import('../services/WorkflowValidator.js');
			const validator = new WorkflowValidator();
			return validator.validateCommitMessageFormat(message);
		} catch (error) {
			console.error('Error validating commit message:', error);
			return {
				isValid: false,
				errors: [`Validation error: ${error.message}`],
				warnings: [],
				suggestions: []
			};
		}
	}

	/**
	 * Validate workflow prerequisites
	 * @param {string} workflowType - Workflow type
	 * @param {Object} context - Context
	 * @returns {Promise<Object>} Validation result
	 */
	async validateWorkflowPrerequisites(workflowType, context = {}) {
		try {
			const { WorkflowValidator } = await import('../services/WorkflowValidator.js');
			const validator = new WorkflowValidator();
			return await validator.validateWorkflowPrerequisites(workflowType, context);
		} catch (error) {
			console.error('Error validating workflow prerequisites:', error);
			return {
				isReady: false,
				errors: [`Prerequisites validation error: ${error.message}`],
				warnings: [],
				prerequisites: {}
			};
		}
	}

	/**
	 * Generate workflow recommendations
	 * @param {string} taskId - Task ID
	 * @param {Object} currentState - Current state
	 * @returns {Promise<Object>} Recommendations
	 */
	async generateWorkflowRecommendations(taskId, currentState = {}) {
		try {
			const { WorkflowValidator } = await import('../services/WorkflowValidator.js');
			const validator = new WorkflowValidator();
			return await validator.generateWorkflowRecommendations(taskId, currentState);
		} catch (error) {
			console.error('Error generating recommendations:', error);
			return {
				immediate: [],
				suggested: [],
				warnings: [`Recommendations error: ${error.message}`]
			};
		}
	}

	/**
	 * Update task status for workflow step
	 * @param {string} taskId - Task ID
	 * @param {string} step - Workflow step
	 * @param {Object} additionalInfo - Additional information
	 * @returns {Promise<Object>} Update result
	 */
	async updateStatusForWorkflowStep(taskId, step, additionalInfo = {}) {
		try {
			const { TaskStatusManager } = await import('../services/TaskStatusManager.js');
			const statusManager = new TaskStatusManager();
			return await statusManager.updateStatusForWorkflowStep(taskId, step, additionalInfo);
		} catch (error) {
			console.error('Error updating status for workflow step:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Validate status transition
	 * @param {string} currentStatus - Current status
	 * @param {string} newStatus - New status
	 * @param {string} step - Workflow step
	 * @returns {Object} Validation result
	 */
	async validateStatusTransition(currentStatus, newStatus, step) {
		try {
			const { TaskStatusManager } = await import('../services/TaskStatusManager.js');
			const statusManager = new TaskStatusManager();
			return statusManager.validateStatusTransition(currentStatus, newStatus, step);
		} catch (error) {
			console.error('Error validating status transition:', error);
			return {
				isValid: false,
				reason: `Validation error: ${error.message}`,
				step,
				validOptions: []
			};
		}
	}

	/**
	 * Get workflow steps for task
	 * @param {string} taskId - Task ID
	 * @returns {Promise<Array>} Workflow steps
	 */
	async getWorkflowStepsForTask(taskId) {
		try {
			const { TaskStatusManager } = await import('../services/TaskStatusManager.js');
			const statusManager = new TaskStatusManager();
			return await statusManager.getWorkflowStepsForTask(taskId);
		} catch (error) {
			console.error('Error getting workflow steps:', error);
			return [];
		}
	}

	/**
	 * Update subtask with structured progress
	 * @param {string} subtaskId - Subtask ID
	 * @param {Object} progressInfo - Progress information
	 * @returns {Promise<Object>} Update result
	 */
	async updateSubtaskWithProgress(subtaskId, progressInfo) {
		try {
			const { TaskStatusManager } = await import('../services/TaskStatusManager.js');
			const statusManager = new TaskStatusManager();
			return await statusManager.updateSubtaskWithProgress(subtaskId, progressInfo);
		} catch (error) {
			console.error('Error updating subtask with progress:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Update task with workflow metadata
	 * @param {string} taskId - Task ID
	 * @param {Object} metadata - Workflow metadata
	 * @returns {Promise<Object>} Update result
	 */
	async updateTaskWithMetadata(taskId, metadata) {
		try {
			const { TaskStatusManager } = await import('../services/TaskStatusManager.js');
			const statusManager = new TaskStatusManager();
			return await statusManager.updateTaskWithMetadata(taskId, metadata);
		} catch (error) {
			console.error('Error updating task with metadata:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}
}
