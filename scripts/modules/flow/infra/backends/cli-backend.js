import { spawn } from 'child_process';
import { FlowBackend } from './backend-interface.js';
import { findProjectRoot } from '../../../utils.js';
import path from 'path';
import fs from 'fs';
import { TASKMASTER_TASKS_FILE } from '../../../../../src/constants/paths.js';

/**
 * CLI Backend - executes task-master commands as child processes
 */
export class CliBackend extends FlowBackend {
	constructor(options = {}) {
		super(options);
		this.execPath = options.execPath || 'node';
		this.scriptPath = options.scriptPath || 'scripts/dev.js';
		this.projectRoot =
			options.projectRoot || findProjectRoot() || process.cwd();
		this.tasksJsonPath = path.join(this.projectRoot, TASKMASTER_TASKS_FILE);
	}

	async initialize() {
		// Verify the CLI is accessible
		try {
			await this.runCommand(['--version']);
			return true;
		} catch (error) {
			throw new Error(`Failed to initialize CLI backend: ${error.message}`);
		}
	}

	/**
	 * Check if tasks.json exists
	 * @returns {Promise<boolean>}
	 */
	async hasTasksFile() {
		try {
			// Check both new and legacy locations
			const newPath = path.join(this.projectRoot, TASKMASTER_TASKS_FILE);
			const legacyPath = path.join(this.projectRoot, 'tasks/tasks.json');

			return fs.existsSync(newPath) || fs.existsSync(legacyPath);
		} catch (error) {
			return false;
		}
	}

	/**
	 * Get the project root directory
	 * @returns {string}
	 */
	getProjectRoot() {
		return this.projectRoot;
	}

	/**
	 * Run a task-master command and return parsed JSON output
	 */
	async runCommand(args, options = {}) {
		return new Promise((resolve, reject) => {
			// Don't add --output=json for certain commands that don't support it
			const noJsonCommands = ['--version', 'init', 'models', 'rules'];
			const shouldAddJson = !noJsonCommands.some((cmd) => args.includes(cmd));

			const allArgs = shouldAddJson
				? [this.scriptPath, ...args]
				: [this.scriptPath, ...args];

			const proc = spawn(this.execPath, allArgs, {
				cwd: this.projectRoot,
				env: process.env,
				stdio: 'pipe'
			});

			let stdout = '';
			let stderr = '';
			let isJsonOutput = false;

			proc.stdout.on('data', (data) => {
				const chunk = data.toString();
				stdout += chunk;

				// Check if this looks like JSON output
				if (
					!isJsonOutput &&
					chunk.includes('{') &&
					(chunk.includes('"tasks"') || chunk.includes('"task"'))
				) {
					isJsonOutput = true;
				}

				if (options.onData) {
					options.onData(chunk);
				}
			});

			proc.stderr.on('data', (data) => {
				stderr += data.toString();
			});

			proc.on('close', (code) => {
				if (code !== 0) {
					reject(new Error(`Command failed with code ${code}: ${stderr}`));
					return;
				}

				try {
					// If we detected JSON output, try to extract it
					if (isJsonOutput) {
						// Find the JSON object in the output
						const jsonMatch = stdout.match(/\{[\s\S]*\}/);
						if (jsonMatch) {
							const result = JSON.parse(jsonMatch[0]);
							this.updateTelemetry(result);
							resolve(result);
							return;
						}
					}

					// Try line-by-line JSON parsing
					const lines = stdout.trim().split('\n');
					const jsonLine = lines.find((line) => {
						try {
							const parsed = JSON.parse(line);
							return typeof parsed === 'object';
						} catch {
							return false;
						}
					});

					if (jsonLine) {
						const result = JSON.parse(jsonLine);
						this.updateTelemetry(result);
						resolve(result);
					} else {
						// Fallback for commands that don't output JSON
						resolve({ output: stdout });
					}
				} catch (error) {
					reject(new Error(`Failed to parse output: ${error.message}`));
				}
			});

			proc.on('error', (error) => {
				reject(error);
			});
		});
	}

	async listTasks(options = {}) {
		const args = ['list'];
		if (options.status) args.push('--status', options.status);
		if (options.tag) args.push('--tag', options.tag);
		if (options.withSubtasks) args.push('--with-subtasks');

		const result = await this.runCommand(args);

		// The list command outputs text by default, not JSON
		// We need to parse the actual task data from the filesystem
		if (result.output && typeof result.output === 'string') {
			// For now, read the tasks.json directly as the CLI doesn't output JSON
			const fs = await import('fs');
			const tasksData = JSON.parse(
				fs.default.readFileSync(this.tasksJsonPath, 'utf8')
			);

			// Get the current tag from state.json
			const statePath = path.join(
				this.projectRoot,
				'.taskmaster',
				'state.json'
			);
			let currentTag = 'master';
			if (fs.default.existsSync(statePath)) {
				const state = JSON.parse(fs.default.readFileSync(statePath, 'utf8'));
				currentTag = state.currentTag || 'master';
			}

			// Filter by tag if specified
			const tag = options.tag || currentTag;

			// Handle the tagged structure - tasks are under tasksData[tag].tasks
			const tagData = tasksData[tag];
			const tasks = tagData?.tasks || [];

			return {
				tasks: tasks,
				tag: tag,
				telemetryData: null
			};
		}

		return {
			tasks: result.tasks || [],
			tag: result.currentTag || result.tag || 'master',
			telemetryData: result.telemetryData
		};
	}

	async nextTask() {
		const args = ['next'];
		const result = await this.runCommand(args);

		// Parse the next task from the output if it's text
		if (result.output && typeof result.output === 'string') {
			// The next command outputs text, we need to parse it
			// For now, return empty as the CLI doesn't have JSON output
			return {
				task: null,
				suggestions: [],
				telemetryData: null
			};
		}

		return {
			task: result.task,
			suggestions: result.suggestions || [],
			telemetryData: result.telemetryData
		};
	}

	async getTask(taskId) {
		const args = ['show', String(taskId)];
		const result = await this.runCommand(args);

		// The show command outputs text, not JSON
		if (result.output && typeof result.output === 'string') {
			// For now, return a basic structure
			return {
				id: taskId,
				title: 'Task details not available in CLI mode',
				description: 'Use direct backend for full functionality'
			};
		}

		return result;
	}

	async setTaskStatus(taskId, status) {
		const args = ['set-status', '--id', String(taskId), '--status', status];
		const result = await this.runCommand(args);

		// The set-status command modifies the file directly
		// Return success if no error
		return result.error ? result : { success: true };
	}

	async expandTask(taskId, options = {}) {
		const args = ['expand', '--id', String(taskId)];
		if (options.num) args.push('--num', options.num.toString());
		if (options.research) args.push('--research');
		if (options.force) args.push('--force');
		if (options.prompt) args.push('--prompt', options.prompt);

		const result = await this.runCommand(args);
		return result.error
			? result
			: { success: true, telemetryData: result.telemetryData };
	}

	async addTask(taskData) {
		const args = ['add-task', '--prompt', taskData.prompt];
		if (taskData.dependencies)
			args.push('--dependencies', taskData.dependencies);
		if (taskData.priority) args.push('--priority', taskData.priority);
		if (taskData.research) args.push('--research');

		const result = await this.runCommand(args);
		return result.error
			? result
			: { success: true, telemetryData: result.telemetryData };
	}

	async *researchStream(query, options = {}) {
		const args = ['research', query];
		if (options.taskIds) args.push('--id', options.taskIds);
		if (options.filePaths) args.push('--files', options.filePaths);
		if (options.customContext) args.push('--context', options.customContext);
		if (options.includeProjectTree) args.push('--tree');
		if (options.detailLevel) args.push('--detail', options.detailLevel);
		if (options.saveTo) args.push('--save-to', options.saveTo);
		if (options.saveFile) args.push('--save-file');

		const chunks = [];
		const onData = (data) => {
			chunks.push(data);
		};

		// Start the research command
		const promise = this.runCommand(args, { onData });

		// Yield chunks as they come in
		let lastYieldedIndex = 0;
		while (true) {
			if (chunks.length > lastYieldedIndex) {
				yield chunks[lastYieldedIndex];
				lastYieldedIndex++;
			} else {
				// Check if the command is done
				try {
					await Promise.race([
						promise,
						new Promise((resolve) => setTimeout(resolve, 100))
					]);
					// If we get here, the command finished
					break;
				} catch (error) {
					// Command is still running, continue
				}
			}
		}

		// Yield any remaining chunks
		while (lastYieldedIndex < chunks.length) {
			yield chunks[lastYieldedIndex];
			lastYieldedIndex++;
		}
	}

	async listTags() {
		const args = ['tags', '--show-metadata'];
		const result = await this.runCommand(args);

		// If the command returns text output, read tags from the file
		if (result.output && typeof result.output === 'string') {
			const fs = await import('fs');
			const tasksData = JSON.parse(
				fs.default.readFileSync(this.tasksJsonPath, 'utf8')
			);

			// Get the current tag from state.json
			const statePath = path.join(
				this.projectRoot,
				'.taskmaster',
				'state.json'
			);
			let currentTag = 'master';
			if (fs.default.existsSync(statePath)) {
				const state = JSON.parse(fs.default.readFileSync(statePath, 'utf8'));
				currentTag = state.currentTag || 'master';
			}

			// Extract tags from the tasks.json structure
			const tags = Object.keys(tasksData).map((tagName) => ({
				name: tagName,
				isCurrent: tagName === currentTag,
				taskCount: tasksData[tagName]?.tasks?.length || 0,
				metadata: tasksData[tagName]?.metadata || {}
			}));

			return {
				tags: tags,
				currentTag: currentTag
			};
		}

		return {
			tags: result.tags || [],
			currentTag: result.currentTag || 'master'
		};
	}

	async useTag(tagName) {
		const result = await this.runCommand(['use-tag', tagName]);
		return result;
	}

	async addTag(tagName, options = {}) {
		const args = ['add-tag', tagName];
		if (options.copyFromCurrent) args.push('--copy-from-current');
		if (options.copyFrom) args.push('--copy-from', options.copyFrom);
		if (options.description) args.push('--description', options.description);

		const result = await this.runCommand(args);
		return result;
	}

	async deleteTag(tagName) {
		const result = await this.runCommand(['delete-tag', tagName, '--yes']);
		return result;
	}

	async renameTag(oldName, newName) {
		const result = await this.runCommand(['rename-tag', oldName, newName]);
		return result;
	}

	async parsePRD(filePath, options = {}) {
		const args = ['parse-prd', filePath];
		if (options.tag) args.push('--tag', options.tag);
		if (options.numTasks) args.push('--num-tasks', options.numTasks.toString());
		if (options.force) args.push('--force');

		const result = await this.runCommand(args);
		return result;
	}

	async analyzeComplexity(options = {}) {
		const args = ['analyze-complexity'];
		if (options.tag) args.push('--tag', options.tag);
		if (options.research) args.push('--research');
		if (options.threshold)
			args.push('--threshold', options.threshold.toString());

		const result = await this.runCommand(args);

		// Transform CLI output to match expected format
		const complexityAnalysis = result.recommendations || [];

		return {
			recommendations: complexityAnalysis,
			summary: result.summary || {
				taskCount: 0,
				highComplexityCount: 0,
				mediumComplexityCount: 0,
				lowComplexityCount: 0,
				averageComplexity: 0
			},
			telemetryData: result.telemetryData
		};
	}

	async expandAll(options = {}) {
		const args = ['expand', '--all'];
		if (options.tag) args.push('--tag', options.tag);
		if (options.research) args.push('--research');
		if (options.num) args.push('--num', options.num.toString());
		if (options.force) args.push('--force');
		if (options.prompt) args.push('--prompt', options.prompt);

		const result = await this.runCommand(args);
		return result;
	}

	async getModels() {
		// The models command doesn't support JSON output, so we need to parse the text
		try {
			const result = await this.runCommand(['models']);

			// For now, return a basic structure
			// In a real implementation, we'd parse the text output
			return {
				main: null,
				research: null,
				fallback: null
			};
		} catch (error) {
			return {
				main: null,
				research: null,
				fallback: null
			};
		}
	}

	async getComplexityReport(tag = null) {
		// Construct report path based on tag
		const reportDir = path.join(this.projectRoot, '.taskmaster', 'reports');
		const tagSuffix = tag && tag !== 'master' ? `_${tag}` : '';
		const reportPath = path.join(
			reportDir,
			`task-complexity-report${tagSuffix}.json`
		);

		try {
			if (fs.existsSync(reportPath)) {
				const content = fs.readFileSync(reportPath, 'utf8');
				return JSON.parse(content);
			}
		} catch (error) {
			// Report doesn't exist or couldn't be read
		}

		return null;
	}

	/**
	 * Generic tool calling method for AI integration
	 * Maps tool names to CLI commands
	 */
	async callTool(toolName, args = {}) {
		// Map MCP tool names to CLI commands
		const toolCommandMap = {
			get_tasks: () => this.listTasks(args),
			next_task: () => this.nextTask(),
			get_task: () => this.getTask(args.id),
			set_task_status: () => this.setTaskStatus(args.id, args.status),
			expand_task: () => this.expandTask(args.id, args),
			add_task: () => this.addTask(args),
			list_tags: () => this.listTags(),
			use_tag: () => this.useTag(args.name || args.tagName),
			add_tag: () => this.addTag(args.tagName, args),
			delete_tag: () => this.deleteTag(args.tagName),
			rename_tag: () => this.renameTag(args.oldName, args.newName),
			parse_prd: () => this.parsePRD(args.input, args),
			analyze_project_complexity: () => this.analyzeComplexity(args),
			expand_all: () => this.expandAll(args),
			models: () => this.getModels()
		};

		const handler = toolCommandMap[toolName];
		if (!handler) {
			throw new Error(`Unknown tool: ${toolName}`);
		}

		return await handler();
	}
}
