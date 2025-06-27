import { FlowBackend } from '../backend-interface.js';
import { findProjectRoot } from '../../utils.js';
import path from 'path';
import { TASKMASTER_TASKS_FILE } from '../../../../src/constants/paths.js';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import os from 'os';
import {
	detectPersona,
	detectMultiPersonaWorkflow
} from '../personas/persona-detector.js';
import {
	PersonaPromptBuilder,
	buildMultiPersonaPrompt
} from '../personas/persona-prompt-builder.js';
import { getAllPersonaIds } from '../personas/persona-definitions.js';

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
			id: taskId,
			status: status
		};

		const result = await setTaskStatusDirect(args, this.log, { session: {} });
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
					saveToFile: options.saveToFile || false
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

	async updateSubtask(options = {}) {
		try {
			const updateSubtaskById = (
				await import('../../task-manager/update-subtask-by-id.js')
			).default;

			const tasksPath = path.join(
				this.projectRoot,
				'.taskmaster',
				'tasks',
				'tasks.json'
			);

			const result = await updateSubtaskById(
				tasksPath,
				options.id,
				options.prompt,
				options.research || false,
				{
					projectRoot: this.projectRoot,
					commandName: 'update-subtask',
					outputType: 'mcp'
				},
				'json'
			);

			return {
				success: true,
				task: result.task,
				telemetryData: result.telemetryData
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
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
		// Check if it's a git repository
		const isGit = await this.isGitRepository();
		if (!isGit) {
			return [];
		}

		try {
			const result = await promisify(exec)('git worktree list --porcelain', {
				cwd: this.projectRoot
			});

			const worktrees = [];
			const lines = result.stdout.trim().split('\n');
			let currentWorktree = {};

			for (const line of lines) {
				if (line.startsWith('worktree ')) {
					if (currentWorktree.path) {
						worktrees.push(currentWorktree);
					}
					const worktreePath = line.substring(9);
					currentWorktree = {
						path: worktreePath,
						name: path.basename(worktreePath),
						isMain: false,
						isCurrent: false
					};
				} else if (line.startsWith('HEAD ')) {
					currentWorktree.head = line.substring(5);
				} else if (line.startsWith('branch ')) {
					currentWorktree.branch = line.substring(7).replace('refs/heads/', '');
				} else if (line === 'bare') {
					currentWorktree.isBare = true;
				} else if (line === '') {
					// Empty line marks end of worktree entry
					if (currentWorktree.path) {
						worktrees.push(currentWorktree);
						currentWorktree = {};
					}
				}
			}

			// Don't forget the last one
			if (currentWorktree.path) {
				worktrees.push(currentWorktree);
			}

			// Mark main and current worktrees
			if (worktrees.length > 0) {
				worktrees[0].isMain = true;
				const currentPath = await this.getRepositoryRoot();
				worktrees.forEach((wt) => {
					if (wt.path === currentPath) {
						wt.isCurrent = true;
						wt.name = path.basename(wt.path);
					}
				});
			}

			return worktrees;
		} catch (error) {
			console.error('Error listing worktrees:', error);
			return [];
		}
	}

	async getWorktreeDetails(worktreePath) {
		try {
			const { exec } = await import('child_process');
			const { promisify } = await import('util');
			const fs = await import('fs');
			const execAsync = promisify(exec);

			// Get basic info from list
			const worktrees = await this.listWorktrees();
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
			const existingWorktrees = await this.listWorktrees();
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

			// Remove worktree
			const forceFlag = options.force ? '--force' : '';
			const { stdout, stderr } = await execAsync(
				`git worktree remove ${forceFlag} "${worktreePath}"`,
				{ cwd: this.projectRoot }
			);

			return {
				success: true,
				output: stdout || stderr
			};
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
			const worktrees = await this.listWorktrees();
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
			const config = await this.getWorktreesConfig();

			if (!config.worktrees[worktreeName]) {
				return [];
			}

			// Load actual task details
			const { listTasks } = await import('../../task-manager.js');
			const tasksPath = path.join(
				this.projectRoot,
				'.taskmaster',
				'tasks',
				'tasks.json'
			);
			const allTasks = listTasks(
				tasksPath,
				null, // statusFilter
				null, // reportPath
				false, // withSubtasks
				'json', // outputFormat
				config.worktrees[worktreeName].linkedTasks[0]?.tag || 'master',
				{ projectRoot: this.projectRoot }
			);

			const linkedTaskIds = config.worktrees[worktreeName].linkedTasks.map(
				(t) => t.id
			);
			const linkedTasks = [];

			// Find linked tasks and subtasks
			for (const task of allTasks.tasks) {
				if (linkedTaskIds.includes(task.id.toString())) {
					linkedTasks.push(task);
				}
				// Check subtasks
				if (task.subtasks) {
					for (const subtask of task.subtasks) {
						const subtaskId = `${task.id}.${subtask.id}`;
						if (linkedTaskIds.includes(subtaskId)) {
							linkedTasks.push({
								...subtask,
								id: subtaskId,
								parentId: task.id,
								parentTitle: task.title
							});
						}
					}
				}
			}

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

			// Find all worktrees linked to this task
			for (const [name, data] of Object.entries(config.worktrees)) {
				const hasTask = data.linkedTasks.some((t) => t.id === taskId);
				if (hasTask) {
					worktrees.push({
						name,
						path: data.path,
						description: data.description,
						status: data.status
					});
				}
			}

			return worktrees;
		} catch (error) {
			this.log.error(`Error getting task worktrees: ${error.message}`);
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
			const worktrees = await this.listWorktrees();
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

	// Claude Code Integration
	async claudeCodeQuery(prompt, options = {}) {
		try {
			// Dynamic import to avoid loading unless needed
			const { query } = await import('@anthropic-ai/claude-code');
			const messages = [];

			const queryOptions = {
				prompt,
				abortController: options.abortController || new AbortController(),
				options: {
					maxTurns: options.maxTurns || 3,
					cwd: options.cwd || this.projectRoot,
					allowedTools: options.allowedTools || ['Read', 'Write', 'Bash'],
					permissionMode: options.permissionMode || 'acceptEdits',
					outputFormat: 'stream-json' // Use streaming JSON for better integration
				}
			};

			// Add system prompt if provided
			if (options.systemPrompt) {
				queryOptions.options.systemPrompt = options.systemPrompt;
			}

			// Add append system prompt if provided
			if (options.appendSystemPrompt) {
				queryOptions.options.appendSystemPrompt = options.appendSystemPrompt;
			}

			for await (const message of query(queryOptions)) {
				messages.push(message);

				// Allow real-time message handling via callback
				if (options.onMessage) {
					await options.onMessage(message);
				}
			}

			return {
				success: true,
				messages,
				sessionId: messages.find((m) => m.session_id)?.session_id
			};
		} catch (error) {
			console.error('Claude Code query error:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	async claudeCodeContinue(prompt, options = {}) {
		try {
			const { query } = await import('@anthropic-ai/claude-code');
			const messages = [];

			const queryOptions = {
				prompt,
				abortController: options.abortController || new AbortController(),
				options: {
					...options,
					continue: true,
					outputFormat: 'stream-json'
				}
			};

			for await (const message of query(queryOptions)) {
				messages.push(message);

				if (options.onMessage) {
					await options.onMessage(message);
				}
			}

			return {
				success: true,
				messages,
				sessionId: messages.find((m) => m.session_id)?.session_id
			};
		} catch (error) {
			console.error('Claude Code continue error:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	async claudeCodeResume(sessionId, prompt, options = {}) {
		try {
			const { query } = await import('@anthropic-ai/claude-code');
			const messages = [];

			const queryOptions = {
				prompt,
				abortController: options.abortController || new AbortController(),
				options: {
					...options,
					resume: sessionId,
					outputFormat: 'stream-json'
				}
			};

			for await (const message of query(queryOptions)) {
				messages.push(message);

				if (options.onMessage) {
					await options.onMessage(message);
				}
			}

			return {
				success: true,
				messages,
				sessionId
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
			const configPath = path.join(
				this.projectRoot,
				'.taskmaster',
				'config.json'
			);
			const config = await fs.readFile(configPath, 'utf8');
			const parsed = JSON.parse(config);

			return {
				success: true,
				config: parsed.claudeCode || {
					enabled: false,
					permissionMode: 'acceptEdits',
					defaultMaxTurns: 3,
					allowedTools: ['Read', 'Write', 'Bash']
				}
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
			const configPath = path.join(
				this.projectRoot,
				'.taskmaster',
				'config.json'
			);
			let config = {};

			try {
				const existing = await fs.readFile(configPath, 'utf8');
				config = JSON.parse(existing);
			} catch {
				// Config doesn't exist yet
			}

			config.claudeCode = claudeConfig;

			await fs.writeFile(configPath, JSON.stringify(config, null, 2));

			return { success: true };
		} catch (error) {
			console.error('Error saving Claude Code config:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	// Get Claude Code sessions
	async getClaudeCodeSessions() {
		try {
			const sessionsPath = path.join(
				this.projectRoot,
				'.taskmaster',
				'claude-sessions.json'
			);

			try {
				const data = await fs.readFile(sessionsPath, 'utf8');
				return {
					success: true,
					sessions: JSON.parse(data)
				};
			} catch {
				// No sessions file yet
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
			const claudeMdPath = path.join(worktree.path, 'CLAUDE.md');

			// Detect persona if not provided
			let persona = options.persona;
			if (!persona && tasks.length > 0) {
				const detectedPersonas = await detectPersona(tasks[0], worktree);
				persona = detectedPersonas[0]?.persona || 'architect';
			}

			const promptBuilder = new PersonaPromptBuilder(persona);

			let content = `# Task Implementation Context

Generated by Task Master for worktree: ${worktree.name}
Persona: ${persona}

`;

			// Add persona context for interactive mode
			if (options.mode === 'interactive') {
				content += promptBuilder.getPersonaContext() + '\n\n';
			}

			// Add task summaries
			content += '## Tasks to Implement\n\n';
			for (const task of tasks) {
				content += `### Task ${task.id}: ${task.title}\n`;
				content += `Status: ${task.status || 'pending'}\n`;
				if (task.description) content += `\nDescription: ${task.description}\n`;
				if (task.details) content += `\nDetails:\n${task.details}\n`;
				if (task.testStrategy)
					content += `\nTest Strategy:\n${task.testStrategy}\n`;
				content += '\n---\n\n';
			}

			// Add project structure
			if (options.includeStructure) {
				content += '## Project Structure\n\n```\n';
				const { stdout } = await execAsync(
					`cd "${worktree.path}" && find . -type f -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" | grep -v node_modules | sort`
				);
				content += stdout;
				content += '```\n\n';
			}

			// Add Git context
			content += '## Git Context\n\n';
			try {
				const { stdout: branch } = await execAsync(
					`cd "${worktree.path}" && git rev-parse --abbrev-ref HEAD`
				);
				content += `Current branch: ${branch}`;

				const { stdout: status } = await execAsync(
					`cd "${worktree.path}" && git status --short`
				);
				if (status) {
					content += '\nUncommitted changes:\n```\n' + status + '```\n';
				}
			} catch (err) {
				content += 'Git information unavailable\n';
			}

			// Write CLAUDE.md
			await fs.writeFile(claudeMdPath, content);

			return {
				contextFile: claudeMdPath,
				persona,
				tasksCount: tasks.length
			};
		} catch (err) {
			throw new Error(`Failed to prepare Claude context: ${err.message}`);
		}
	}

	// Launch Claude CLI in interactive mode
	async launchClaudeCLI(worktree, options = {}) {
		try {
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
							write text "cd \\"${worktree.path}\\" && claude"
						end tell
					end tell'`;
				} catch {
					// Fall back to Terminal.app
					command = `osascript -e 'tell application "Terminal"
						do script "cd \\"${worktree.path}\\" && claude"
						activate
					end tell'`;
				}
			} else if (platform === 'win32') {
				// Windows
				command = `start cmd /k "cd /d \\"${worktree.path}\\" && claude"`;
			} else {
				// Linux - try common terminal emulators
				const terminals = [
					'gnome-terminal -- bash -c "cd \\"${worktree.path}\\" && claude; exec bash"',
					'konsole -e bash -c "cd \\"${worktree.path}\\" && claude; exec bash"',
					'xterm -e bash -c "cd \\"${worktree.path}\\" && claude; exec bash"'
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
			// Detect persona if not provided
			let persona = options.persona;
			if (!persona && tasks.length > 0) {
				const detectedPersonas = await detectPersona(tasks[0], worktree);
				persona = detectedPersonas[0]?.persona || 'architect';
			}

			// Build comprehensive prompt
			const promptBuilder = new PersonaPromptBuilder(persona);
			let fullPrompt;

			if (tasks.length === 1) {
				fullPrompt = promptBuilder.buildTaskPrompt(tasks[0], {
					additionalContext: prompt ? `## User Instructions\n${prompt}` : null
				});
			} else {
				fullPrompt = promptBuilder.buildBatchPrompt(tasks, {
					additionalContext: prompt ? `## User Instructions\n${prompt}` : null
				});
			}

			// Launch Claude with comprehensive prompt
			const args = [
				'-p',
				fullPrompt,
				'--max-turns',
				options.maxTurns || '10',
				'--permission-mode',
				options.permissionMode || 'acceptEdits',
				'--add-dir',
				worktree.path
			];

			if (options.outputFormat) {
				args.push('--output-format', options.outputFormat);
			}

			if (options.verbose) {
				args.push('--verbose');
			}

			const claudeProcess = spawn('claude', args, {
				cwd: worktree.path,
				stdio: options.captureOutput ? 'pipe' : 'inherit'
			});

			if (options.captureOutput) {
				return new Promise((resolve, reject) => {
					let output = '';
					let error = '';

					claudeProcess.stdout.on('data', (data) => {
						output += data.toString();
						if (options.onProgress) {
							options.onProgress(data.toString());
						}
					});

					claudeProcess.stderr.on('data', (data) => {
						error += data.toString();
					});

					claudeProcess.on('close', (code) => {
						if (code === 0) {
							resolve({
								success: true,
								output,
								persona,
								tasksProcessed: tasks.length
							});
						} else {
							reject(
								new Error(`Claude process exited with code ${code}: ${error}`)
							);
						}
					});
				});
			} else {
				// Fire and forget
				return {
					success: true,
					persona,
					tasksProcessed: tasks.length,
					process: claudeProcess
				};
			}
		} catch (err) {
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
}
