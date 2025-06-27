import { FlowBackend } from '../backend-interface.js';
import { findProjectRoot } from '../../utils.js';
import path from 'path';
import { TASKMASTER_TASKS_FILE } from '../../../../src/constants/paths.js';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

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

	// New Claude CLI Integration Methods
	async launchClaudeCLI(worktreePath, options = {}) {
		try {
			const { exec, spawn } = await import('child_process');
			const { promisify } = await import('util');
			const execAsync = promisify(exec);
			const os = await import('os');

			// Validate worktree path exists
			if (!fs.existsSync(worktreePath)) {
				throw new Error(`Worktree path does not exist: ${worktreePath}`);
			}

			// Prepare context if task is provided
			if (options.task) {
				await this.prepareClaudeContext(
					worktreePath,
					options.task,
					options.contextData
				);
			}

			if (options.mode === 'headless' && options.prompt) {
				// Headless mode with -p flag
				this.log.info(`Launching Claude in headless mode at ${worktreePath}`);

				// Build the command with proper escaping
				const escapedPrompt = options.prompt.replace(/"/g, '\\"');
				const args = ['-p', escapedPrompt];

				if (options.outputFormat) {
					args.push('--output-format', options.outputFormat);
				}

				// For streaming output back to the UI
				if (options.streaming) {
					const claudeProcess = spawn('claude', args, {
						cwd: worktreePath,
						stdio: ['inherit', 'pipe', 'pipe'],
						env: { ...process.env, FORCE_COLOR: '1' }
					});

					return {
						success: true,
						process: claudeProcess,
						mode: 'headless-streaming'
					};
				} else {
					// For simple execution
					const result = await execAsync(`claude -p "${escapedPrompt}"`, {
						cwd: worktreePath,
						maxBuffer: 10 * 1024 * 1024 // 10MB buffer
					});

					return {
						success: true,
						output: result.stdout,
						error: result.stderr,
						mode: 'headless-blocking'
					};
				}
			} else {
				// Interactive mode - spawn Claude in a new terminal
				this.log.info(
					`Launching Claude in interactive mode at ${worktreePath}`
				);

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
								write text "cd \\"${worktreePath}\\" && claude"
							end tell
						end tell'`;
					} catch {
						// Fall back to Terminal.app
						command = `osascript -e 'tell application "Terminal"
							do script "cd \\"${worktreePath}\\" && claude"
							activate
						end tell'`;
					}
				} else if (platform === 'linux') {
					// Linux - try different terminal emulators
					const terminals = [
						{
							cmd: 'gnome-terminal',
							args: `-- bash -c "cd '${worktreePath}' && claude; exec bash"`
						},
						{
							cmd: 'konsole',
							args: `-e bash -c "cd '${worktreePath}' && claude; exec bash"`
						},
						{
							cmd: 'xterm',
							args: `-e bash -c "cd '${worktreePath}' && claude; exec bash"`
						}
					];

					for (const term of terminals) {
						try {
							await execAsync(`which ${term.cmd}`);
							command = `${term.cmd} ${term.args}`;
							break;
						} catch {
							// Try next terminal
						}
					}

					if (!command) {
						throw new Error('No supported terminal emulator found');
					}
				} else if (platform === 'win32') {
					// Windows
					command = `start cmd /k "cd /d \\"${worktreePath}\\" && claude"`;
				} else {
					throw new Error(`Unsupported platform: ${platform}`);
				}

				await execAsync(command);

				return {
					success: true,
					mode: 'interactive',
					worktreePath: worktreePath
				};
			}
		} catch (error) {
			this.log.error(`Failed to launch Claude CLI: ${error.message}`);
			return {
				success: false,
				error: error.message
			};
		}
	}

	async prepareClaudeContext(worktreePath, task, additionalContext = {}) {
		try {
			const fs = await import('fs/promises');
			const path = await import('path');

			// Build comprehensive context for Claude
			let claudeMdContent = `# Task Context

## Current Task: ${task.id} - ${task.title}
Status: ${task.status}
Priority: ${task.priority || 'medium'}

### Description
${task.description || 'No description provided'}

### Implementation Details
${task.details || 'No implementation details provided'}
`;

			// Add dependencies if any
			if (task.dependencies && task.dependencies.length > 0) {
				claudeMdContent += `
### Dependencies
${task.dependencies
	.map((dep) => {
		if (typeof dep === 'object') {
			return `- [${dep.completed ? '✓' : '○'}] Task ${dep.id}: ${dep.title || 'Unknown'}`;
		}
		return `- Task ${dep}`;
	})
	.join('\n')}
`;
			}

			// Add subtasks if any
			if (task.subtasks && task.subtasks.length > 0) {
				claudeMdContent += `
### Subtasks
${task.subtasks.map((st) => `- [${st.status}] ${st.id}: ${st.title}`).join('\n')}
`;
			}

			// Add test strategy if available
			if (task.testStrategy) {
				claudeMdContent += `
### Test Strategy
${task.testStrategy}
`;
			}

			// Add additional context if provided
			if (additionalContext.research) {
				claudeMdContent += `
### Research Findings
${additionalContext.research}
`;
			}

			if (additionalContext.worktree) {
				claudeMdContent += `
## Workspace Information
- Worktree: ${additionalContext.worktree.name}
- Branch: ${additionalContext.worktree.branch || 'unknown'}
- Path: ${worktreePath}
`;
			}

			if (additionalContext.projectContext) {
				claudeMdContent += `
## Project Context
${additionalContext.projectContext}
`;
			}

			// Add helpful commands
			claudeMdContent += `
## Helpful Commands
- Run tests: npm test
- Build project: npm run build
- Check types: npm run typecheck
- Format code: npm run format

## Working Guidelines
1. Focus on implementing the specific task described above
2. Maintain consistency with existing code patterns
3. Write tests for new functionality
4. Update documentation as needed
5. Commit changes with descriptive messages
`;

			// Write CLAUDE.md to worktree
			const claudeMdPath = path.join(worktreePath, 'CLAUDE.md');
			await fs.writeFile(claudeMdPath, claudeMdContent, 'utf8');

			this.log.info(`Created CLAUDE.md context file at ${claudeMdPath}`);

			return {
				success: true,
				contextPath: claudeMdPath
			};
		} catch (error) {
			this.log.error(`Failed to prepare Claude context: ${error.message}`);
			return {
				success: false,
				error: error.message
			};
		}
	}

	async launchMultipleClaudeSessions(tasks, options = {}) {
		try {
			const sessions = [];
			const repoRoot = await this.getRepositoryRoot();
			const repoName = path.basename(repoRoot);

			for (const task of tasks) {
				// Create worktree for each task
				const worktreeName = `${repoName}-task-${task.id}`;
				const worktreeResult = await this.addWorktree(worktreeName, {
					branch: `task-${task.id}`
				});

				if (!worktreeResult.success) {
					this.log.error(
						`Failed to create worktree for task ${task.id}: ${worktreeResult.error}`
					);
					continue;
				}

				// Link task to worktree
				await this.linkWorktreeToTasks(worktreeName, [task.id], {
					includeSubtasks: true
				});

				// Launch Claude in the worktree
				const launchResult = await this.launchClaudeCLI(worktreeResult.path, {
					mode: options.mode || 'interactive',
					task: task,
					contextData: {
						worktree: { name: worktreeName, branch: `task-${task.id}` }
					}
				});

				if (launchResult.success) {
					sessions.push({
						taskId: task.id,
						worktree: {
							name: worktreeName,
							path: worktreeResult.path
						},
						claude: launchResult
					});
				}
			}

			return {
				success: true,
				sessions: sessions,
				totalLaunched: sessions.length,
				totalFailed: tasks.length - sessions.length
			};
		} catch (error) {
			this.log.error(
				`Failed to launch multiple Claude sessions: ${error.message}`
			);
			return {
				success: false,
				error: error.message
			};
		}
	}

	async getClaudeSessionsForWorktree(worktreeName) {
		try {
			// Get linked tasks for this worktree
			const tasks = await this.getWorktreeTasks(worktreeName);
			const sessions = [];

			// Check for Claude sessions in task details
			for (const task of tasks) {
				const sessionIds = this.extractClaudeSessionIds(task.details || '');
				if (sessionIds.length > 0) {
					sessions.push({
						taskId: task.id,
						taskTitle: task.title,
						sessionIds: sessionIds
					});
				}
			}

			return {
				success: true,
				sessions: sessions
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	extractClaudeSessionIds(text) {
		const sessionPattern = /<claude-session[^>]*sessionId="([^"]+)"[^>]*>/g;
		const ids = [];
		let match = sessionPattern.exec(text);

		while (match !== null) {
			ids.push(match[1]);
			match = sessionPattern.exec(text);
		}

		return ids;
	}
}
