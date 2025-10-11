/**
 * @fileoverview Watch command for real-time task monitoring
 * Monitors task files and displays live updates
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { createTaskMasterCore, type Task, type TaskMasterCore } from '@tm/core';
import {
	displayHeader,
	displayProjectDashboard,
	calculateTaskStatistics,
	calculateSubtaskStatistics,
	getPriorityBreakdown,
	type NextTaskInfo
} from '../ui/index.js';
import boxen from 'boxen';

/**
 * Watch command options
 */
export interface WatchCommandOptions {
	project?: string;
	interval?: number;
	tag?: string;
}

/**
 * WatchCommand - Real-time task monitoring
 */
export class WatchCommand extends Command {
	private tmCore?: TaskMasterCore;
	private watcher?: fs.FSWatcher;
	private updateTimeout?: NodeJS.Timeout;
	private lastUpdateTime = 0;
	private isUpdating = false;
	private tasksFilePath?: string;
	private taskMasterDir?: string;

	constructor(name?: string) {
		super(name || 'watch');

		this.description('Watch task files and display real-time updates')
			.option('-p, --project <path>', 'Project root directory', process.cwd())
			.option(
				'-i, --interval <ms>',
				'Minimum update interval in milliseconds',
				(value) => parseInt(value, 10),
				500
			)
			.option('-t, --tag <tag>', 'Filter by tag')
			.action(async (options: WatchCommandOptions) => {
				await this.executeCommand(options);
			});
	}

	/**
	 * Execute the watch command
	 */
	private async executeCommand(options: WatchCommandOptions): Promise<void> {
		try {
			const projectRoot = options.project || process.cwd();
			const interval = options.interval || 500;

			// Calculate paths
			const taskMasterDir = path.join(projectRoot, '.taskmaster');
			const tasksFilePath = path.join(taskMasterDir, 'tasks', 'tasks.json');

			if (!fs.existsSync(tasksFilePath)) {
				console.error(chalk.red(`Tasks file not found: ${tasksFilePath}`));
				process.exit(1);
			}

			// Store paths for display and watching
			this.tasksFilePath = tasksFilePath;
			this.taskMasterDir = taskMasterDir;

			// Initialize tm-core
			await this.initializeCore(projectRoot);

			// Setup cleanup handlers
			this.setupCleanupHandlers();

			// Display initial state
			await this.displayTaskStatus(options.tag);

			// Start watching
			this.startWatching(projectRoot, interval, options.tag);

			// Keep the process alive
			await this.keepAlive();
		} catch (error: any) {
			console.error(chalk.red(`Error: ${error?.message || String(error)}`));
			process.exit(1);
		}
	}

	/**
	 * Initialize TaskMasterCore
	 */
	private async initializeCore(projectRoot: string): Promise<void> {
		this.tmCore = await createTaskMasterCore({ projectPath: projectRoot });
	}

	/**
	 * Start watching task files
	 */
	private startWatching(
		projectRoot: string,
		interval: number,
		tag?: string
	): void {
		// Directory path already set and validated in executeCommand
		if (!this.taskMasterDir) return;

		// Watch the .taskmaster directory recursively using built-in fs.watch
		this.watcher = fs.watch(
			this.taskMasterDir,
			{ recursive: true },
			(eventType) => {
				if (eventType === 'change' || eventType === 'rename') {
					this.scheduleUpdate(interval, tag);
				}
			}
		);
	}

	/**
	 * Schedule an update with debouncing
	 */
	private scheduleUpdate(interval: number, tag?: string): void {
		// Clear existing timeout
		if (this.updateTimeout) {
			clearTimeout(this.updateTimeout);
		}

		// Debounce updates
		this.updateTimeout = setTimeout(async () => {
			const now = Date.now();
			if (now - this.lastUpdateTime < interval || this.isUpdating) {
				return;
			}

			this.lastUpdateTime = now;
			this.isUpdating = true;

			try {
				await this.displayTaskStatus(tag);
			} catch (error) {
				console.error(
					chalk.red(
						`Update error: ${error instanceof Error ? error.message : String(error)}`
					)
				);
			} finally {
				this.isUpdating = false;
			}
		}, interval);
	}

	/**
	 * Display current task status
	 */
	private async displayTaskStatus(tag?: string): Promise<void> {
		if (!this.tmCore) return;

		// Clear terminal completely including scrollback buffer
		// \u001b[2J - Clear entire screen
		// \u001b[3J - Clear scrollback buffer
		// \u001b[H - Move cursor to home position
		process.stdout.write('\u001b[2J\u001b[3J\u001b[H');

		// Get tasks
		const result = await this.tmCore.getTaskList({
			tag,
			includeSubtasks: true
		});

		// Display header
		displayHeader({
			tag: tag || result.tag || 'master'
		});

		// Display watching directory
		if (this.taskMasterDir) {
			console.log(chalk.green(`✓ Watching: ${this.taskMasterDir}\n`));
		}

		if (result.tasks.length === 0) {
			console.log(chalk.yellow('No tasks found.\n'));
			console.log(chalk.gray('Watching for changes... (Press Ctrl+C to stop)'));
			return;
		}

		// Calculate statistics
		const taskStats = calculateTaskStatistics(result.tasks);
		const subtaskStats = calculateSubtaskStatistics(result.tasks);
		const priorityBreakdown = getPriorityBreakdown(result.tasks);

		// Find next task
		const nextTaskInfo = this.findNextTask(result.tasks);
		const nextTask = nextTaskInfo
			? result.tasks.find((t) => String(t.id) === String(nextTaskInfo.id))
			: undefined;

		// Display project dashboard without priority breakdown
		const dashboardContent = displayProjectDashboard(
			taskStats,
			subtaskStats,
			priorityBreakdown,
			false // Hide priority breakdown for cleaner watch display
		);

		const dashboardBox = boxen(dashboardContent, {
			padding: 1,
			borderColor: 'blue',
			borderStyle: 'round',
			margin: { top: 0, bottom: 1 }
		});

		console.log(dashboardBox);

		// Check if there are any in-progress tasks
		const hasInProgressTasks = result.tasks.some(
			(t) =>
				t.status === 'in-progress' ||
				(t.subtasks && t.subtasks.some((st) => st.status === 'in-progress'))
		);

		// Display in-progress tasks
		this.displayInProgressTasks(result.tasks);

		// Display recommended next task only if nothing is in progress
		if (!hasInProgressTasks) {
			this.displayRecommendedNextTask(nextTask);
		}

		// Display watching message at the bottom
		console.log(chalk.gray('\nWatching for changes... (Press Ctrl+C to stop)'));
	}

	/**
	 * Display current in-progress tasks
	 */
	private displayInProgressTasks(tasks: Task[]): void {
		const inProgressTasks = tasks.filter((t) => t.status === 'in-progress');

		if (inProgressTasks.length === 0) {
			console.log(chalk.gray('📋 No tasks currently in progress.'));
			return;
		}

		console.log(chalk.cyan.bold('📋 Current In-Progress Tasks:\n'));
		inProgressTasks.forEach((task) => {
			console.log(
				`  ${chalk.cyan(String(task.id))} ${chalk.blue('▶')} ${chalk.white(task.title)}`
			);
			if (task.subtasks?.length) {
				const inProgressSubtasks = task.subtasks.filter(
					(st) => st.status === 'in-progress'
				);
				inProgressSubtasks.forEach((subtask) => {
					console.log(
						`    ${chalk.gray(`${task.id}.${subtask.id}`)} ${chalk.blue('▶')} ${chalk.gray(subtask.title)}`
					);
				});
			}
		});
	}

	/**
	 * Display recommended next task (simple text format)
	 */
	private displayRecommendedNextTask(task?: Task): void {
		if (!task) {
			console.log(chalk.gray('\n⚡ No tasks available to work on.\n'));
			return;
		}

		const priorityColor =
			task.priority === 'high' || task.priority === 'critical'
				? chalk.red
				: task.priority === 'medium'
					? chalk.yellow
					: chalk.green;

		console.log(chalk.hex('#FFA500').bold('\n⚡ Recommended Next Task:\n'));
		console.log(
			`  ${chalk.cyan(String(task.id))} ${priorityColor('●')} ${chalk.white(task.title)}`
		);

		// Show priority and dependencies if present
		const details = [];
		if (task.priority) {
			details.push(`Priority: ${priorityColor(task.priority)}`);
		}
		if (task.dependencies && task.dependencies.length > 0) {
			details.push(`Dependencies: ${chalk.gray(task.dependencies.join(', '))}`);
		}
		if (task.complexity !== undefined) {
			const complexityNum =
				typeof task.complexity === 'number'
					? task.complexity
					: parseInt(String(task.complexity));
			if (!isNaN(complexityNum)) {
				const complexityColor =
					complexityNum >= 8
						? chalk.red
						: complexityNum >= 5
							? chalk.yellow
							: chalk.green;
				details.push(`Complexity: ${complexityColor(complexityNum)}/10`);
			}
		}

		if (details.length > 0) {
			console.log(`  ${chalk.gray(details.join(' • '))}`);
		}

		console.log('');
	}

	/**
	 * Find next task (reused from ListTasksCommand)
	 */
	private findNextTask(tasks: Task[]): NextTaskInfo | undefined {
		const priorityValues: Record<string, number> = {
			critical: 4,
			high: 3,
			medium: 2,
			low: 1
		};

		const completedIds = new Set<string>();
		tasks.forEach((t) => {
			if (t.status === 'done' || t.status === 'completed') {
				completedIds.add(String(t.id));
			}
			if (t.subtasks) {
				t.subtasks.forEach((st) => {
					if (st.status === 'done' || st.status === 'completed') {
						completedIds.add(`${t.id}.${st.id}`);
					}
				});
			}
		});

		// First, look for eligible subtasks in in-progress parent tasks
		const candidateSubtasks: NextTaskInfo[] = [];

		tasks
			.filter(
				(t) => t.status === 'in-progress' && t.subtasks && t.subtasks.length > 0
			)
			.forEach((parent) => {
				parent.subtasks!.forEach((st) => {
					const stStatus = (st.status || 'pending').toLowerCase();
					if (stStatus !== 'pending' && stStatus !== 'in-progress') return;

					const fullDeps =
						st.dependencies?.map((d) => {
							if (typeof d === 'string' && d.includes('.')) {
								return d;
							}
							return `${parent.id}.${d}`;
						}) ?? [];

					const depsSatisfied =
						fullDeps.length === 0 ||
						fullDeps.every((depId) => completedIds.has(String(depId)));

					if (depsSatisfied) {
						candidateSubtasks.push({
							id: `${parent.id}.${st.id}`,
							title: st.title || `Subtask ${st.id}`,
							priority: st.priority || parent.priority || 'medium',
							dependencies: fullDeps.map((d) => String(d))
						});
					}
				});
			});

		if (candidateSubtasks.length > 0) {
			candidateSubtasks.sort((a, b) => {
				const pa = priorityValues[a.priority || 'medium'] ?? 2;
				const pb = priorityValues[b.priority || 'medium'] ?? 2;
				if (pb !== pa) return pb - pa;

				const depCountA = a.dependencies?.length || 0;
				const depCountB = b.dependencies?.length || 0;
				if (depCountA !== depCountB) return depCountA - depCountB;

				return String(a.id).localeCompare(String(b.id));
			});
			return candidateSubtasks[0];
		}

		// Fall back to top-level tasks
		const eligibleTasks = tasks.filter((task) => {
			const status = (task.status || 'pending').toLowerCase();
			if (status !== 'pending' && status !== 'in-progress') return false;

			const deps = task.dependencies || [];
			const depsSatisfied =
				deps.length === 0 ||
				deps.every((depId) => completedIds.has(String(depId)));

			return depsSatisfied;
		});

		if (eligibleTasks.length === 0) return undefined;

		eligibleTasks.sort((a, b) => {
			const pa = priorityValues[a.priority || 'medium'] ?? 2;
			const pb = priorityValues[b.priority || 'medium'] ?? 2;
			if (pb !== pa) return pb - pa;

			const depCountA = a.dependencies?.length || 0;
			const depCountB = b.dependencies?.length || 0;
			if (depCountA !== depCountB) return depCountA - depCountB;

			return Number(a.id) - Number(b.id);
		});

		const nextTask = eligibleTasks[0];
		return {
			id: nextTask.id,
			title: nextTask.title,
			priority: nextTask.priority,
			dependencies: nextTask.dependencies?.map((d) => String(d))
		};
	}

	/**
	 * Setup cleanup handlers for graceful shutdown
	 */
	private setupCleanupHandlers(): void {
		const cleanup = async () => {
			if (this.updateTimeout) {
				clearTimeout(this.updateTimeout);
			}
			if (this.watcher) {
				this.watcher.close();
			}
			if (this.tmCore) {
				await this.tmCore.close();
			}
			console.log(chalk.yellow('\n\n👋 Stopped watching. Goodbye!\n'));
			process.exit(0);
		};

		process.on('SIGINT', cleanup);
		process.on('SIGTERM', cleanup);
	}

	/**
	 * Keep process alive
	 */
	private async keepAlive(): Promise<void> {
		return new Promise(() => {
			// Process kept alive by event loop with watcher
		});
	}

	/**
	 * Register this command on an existing program
	 */
	static register(program: Command, name?: string): WatchCommand {
		const watchCommand = new WatchCommand(name);
		program.addCommand(watchCommand);
		return watchCommand;
	}
}
