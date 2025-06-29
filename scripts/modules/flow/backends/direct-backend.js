import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import { exec, execSync, spawn } from 'child_process';
import { promisify } from 'util';
import { query as claudeQuery } from '@anthropic-ai/claude-code';
import { FlowBackend } from '../backend-interface.js';
import { directFunctions } from '../../../../mcp-server/src/core/task-master-core.js';
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
			const config = await this.getWorktreesConfig();

			if (!config.worktrees[worktreeName]) {
				return [];
			}

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

			if (!tasksData[tag]) {
				return [];
			}

			const allTasks = tasksData[tag].tasks || [];
			const linkedTaskIds = config.worktrees[worktreeName].linkedTasks.map(
				(t) => t.id
			);
			const linkedTasks = [];

			// Find linked tasks and subtasks
			for (const task of allTasks) {
				if (linkedTaskIds.includes(task.id.toString())) {
					linkedTasks.push(task);
				}
				// Check subtasks
				if (task.subtasks) {
					for (const subtask of task.subtasks) {
						const subtaskId = `${task.id}.${subtask.id}`;
						if (linkedTaskIds.includes(subtaskId)) {
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
				let hasTask = false;

				// Check if it has the old linkedTasks array structure
				if (data.linkedTasks && Array.isArray(data.linkedTasks)) {
					hasTask = data.linkedTasks.some((t) => t.id === taskId);
				}

				// Check if it has the new linkedSubtask structure
				if (!hasTask && data.linkedSubtask) {
					// Check if the task ID matches the parent task ID
					hasTask = String(data.linkedSubtask.taskId) === String(taskId);
					// Or check if it matches the full subtask ID
					if (!hasTask) {
						hasTask = data.linkedSubtask.fullId === taskId;
					}
				}

				if (hasTask) {
					worktrees.push({
						name,
						path: data.path,
						description: data.description || data.linkedSubtask?.title || '',
						status: data.status || 'active'
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
			const execAsync = promisify(exec);
			const claudeMdPath = path.join(worktree.path, 'CLAUDE.md');

			// Detect persona if not provided
			let persona = options.persona;
			if (!persona && tasks.length > 0) {
				const detectedPersonas = await detectPersona(tasks[0], worktree);
				persona = detectedPersonas[0]?.persona || 'architect';
			}

			let content = `# Task Implementation Context

Generated by Task Master for worktree: ${worktree.name}
Branch: ${worktree.branch || 'unknown'}

`;

			// Add worktree-specific note for subtask worktrees
			if (worktree.name && worktree.name.match(/^task-\d+\.\d+$/)) {
				content += `**Note:** This worktree was automatically created for the specific subtask implementation.\n\n`;
			}

			// Add tasks with full details
			content += '## Tasks to Implement\n\n';
			for (const task of tasks) {
				content += `### Task ${task.id}: ${task.title}\n\n`;
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
				} else if (task.isSubtask) {
					// For subtasks without test strategy, add a placeholder
					content += `**Test Strategy:**\n(No specific test strategy defined for this subtask)\n\n`;
				}

				if (task.dependencies && task.dependencies.length > 0) {
					content += `**Dependencies:** ${task.dependencies.join(', ')}\n`;
				}

				if (task.subtasks && task.subtasks.length > 0) {
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
				tasksCount: tasks.length
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
			let totalCost = 0;
			let sessionId = null;

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

			// Handle different output formats
			if (options.captureOutput) {
				let output = '';

				for await (const message of claudeQuery(queryOptions)) {
					messages.push(message);

					// Extract session ID from init message
					if (message.type === 'system' && message.subtype === 'init') {
						sessionId = message.session_id;
					}

					// Track costs
					if (
						message.type === 'result' &&
						message.total_cost_usd !== undefined
					) {
						totalCost = message.total_cost_usd;
					}

					// Build output text from assistant messages
					if (message.type === 'assistant' && message.message?.content) {
						const content = message.message.content;
						if (Array.isArray(content)) {
							for (const part of content) {
								if (part.type === 'text') {
									output += part.text + '\n';
								}
							}
						} else if (typeof content === 'string') {
							output += content + '\n';
						}
					}

					// Call progress callback if provided
					if (options.onProgress && message.type === 'assistant') {
						options.onProgress(output);
					}
				}

				const duration = Date.now() - startTime;

				return {
					success: true,
					output,
					persona,
					tasksProcessed: tasks.length,
					sessionId,
					totalCost,
					duration,
					messages
				};
			} else {
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
			if (!this.hasResearchInTask(task)) {
				logFn.info(`Task ${task.id} has no research. Running research...`);

				try {
					// Build research query based on task
					const researchQuery = `Task ${task.id}: ${task.title}\n\nDescription: ${task.description || 'No description'}\n\nDetails: ${task.details || 'No details'}\n\nWhat are the current best practices and implementation approaches for this task?`;

					// Run research
					const researchResult = await this.research({
						query: researchQuery,
						taskIds: [task.id.toString()],
						includeProjectTree: true,
						detailLevel: 'high',
						saveTo: task.id.toString()
					});

					if (researchResult.success) {
						logFn.info(`Research completed and saved to task ${task.id}`);

						// Reload task to get updated details with research
						const updatedTask = await this.getTask(task.id.toString());
						if (updatedTask) {
							// Update the task object in the array with the new details
							Object.assign(task, updatedTask);
						}
					} else {
						logFn.warn(
							`Research failed for task ${task.id}: ${researchResult.error}`
						);
					}
				} catch (error) {
					logFn.error(
						`Error running research for task ${task.id}: ${error.message}`
					);
				}
			} else {
				logFn.info(
					`Task ${task.id} already has research - skipping research generation`
				);
				// Show a snippet of the existing research
				if (task.details) {
					const researchMatch = task.details.match(
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
	 * Save Claude session data to a JSON file in .taskmaster folder
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
			await fs.mkdir(claudeDir, { recursive: true });

			// Create a filename based on timestamp and task ID
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const taskIds = sessionData.tasks.map((t) => t.id).join('_');
			const filename = `claude-session-${taskIds}-${timestamp}.json`;
			const filePath = path.join(claudeDir, filename);

			// Also save a "latest" file for easy access
			const latestPath = path.join(claudeDir, 'claude-latest.json');

			// Process conversation history for better readability
			const processedMessages =
				sessionData.messages?.map((msg, idx) => {
					const processed = {
						index: idx,
						type: msg.type,
						timestamp: msg.timestamp || new Date().toISOString()
					};

					// Handle different message types
					if (msg.type === 'assistant' && msg.message) {
						processed.content = this.extractMessageContent(msg.message.content);
						processed.role = 'assistant';
					} else if (msg.type === 'user' && msg.message) {
						processed.content = this.extractMessageContent(msg.message.content);
						processed.role = 'user';
					} else if (msg.type === 'tool_use') {
						processed.tool = msg.name;
						processed.input = msg.input;
						processed.output = msg.output;
					} else if (msg.type === 'system') {
						processed.subtype = msg.subtype;
						processed.details = msg;
					} else if (msg.type === 'result') {
						processed.totalCost = msg.total_cost_usd;
						processed.tokenCounts = msg.token_counts;
					}

					return processed;
				}) || [];

			// Prepare data with summary at the top
			const dataToSave = {
				summary: {
					timestamp: sessionData.statistics.completedAt,
					worktree: sessionData.worktree,
					branch: sessionData.branch,
					tasks: sessionData.tasks.map((t) => ({
						id: t.id,
						title: t.title,
						description: t.description
					})),
					statistics: {
						turns: sessionData.statistics.turns,
						maxTurns: sessionData.statistics.maxTurns,
						fileChanges: sessionData.statistics.fileChanges,
						totalCost: sessionData.statistics.totalCost,
						durationSeconds: sessionData.statistics.durationSeconds,
						tokenCounts: sessionData.statistics.tokenCounts || {},
						toolsUsed: this.countToolsUsed(processedMessages)
					},
					persona: sessionData.persona,
					toolRestrictions: sessionData.statistics.toolRestrictions,
					sessionId: sessionData.sessionId
				},
				conversation: {
					messageCount: processedMessages.length,
					messages: processedMessages
				},
				rawSession: {
					output: sessionData.output,
					fullData: sessionData
				}
			};

			// Write to both files
			await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2), 'utf8');
			await fs.writeFile(
				latestPath,
				JSON.stringify(dataToSave, null, 2),
				'utf8'
			);

			this.log.info(`Claude session data saved to: ${filePath}`);
			return filePath;
		} catch (error) {
			this.log.error('Failed to save Claude session data:', error.message);
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

	async claudeCodeStatus(sessionId) {
		// ... existing code ...
	}
}
