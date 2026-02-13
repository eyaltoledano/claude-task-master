/**
 * @fileoverview Prompt Builder Service
 * Generates the prompt for a Claude Code teams session that executes task clusters
 */

import type { Task } from '../../../common/types/index.js';
import type { ClusterMetadata } from '../types.js';
import { getLogger } from '../../../common/logger/factory.js';

/**
 * Context needed to build the prompt
 */
export interface PromptContext {
	readonly projectPath: string;
	readonly tag: string;
	readonly clusters: readonly ClusterMetadata[];
	readonly tasks: readonly Task[];
	readonly totalClusters: number;
	readonly totalTasks: number;
	readonly checkpointPath: string;
}

/**
 * PromptBuilderService generates the prompt used by the Claude Code
 * teams session to execute task clusters in parallel.
 */
export class PromptBuilderService {
	private logger = getLogger('PromptBuilderService');

	/**
	 * Build a prompt for teams mode execution.
	 * The prompt instructs Claude to create agent teams that execute
	 * clusters level-by-level, with tasks in each level running in parallel.
	 */
	buildPrompt(context: PromptContext): string {
		const sections: string[] = [];

		sections.push(this.buildHeader(context));
		sections.push(this.buildClusterOverview(context));
		sections.push(this.buildTaskDetails(context));
		sections.push(this.buildExecutionInstructions(context));
		sections.push(this.buildCompletionRules(context));

		return sections.join('\n\n');
	}

	private buildHeader(context: PromptContext): string {
		return [
			'# Cluster Execution Session',
			'',
			`**Project**: ${context.projectPath}`,
			`**Tag**: ${context.tag}`,
			`**Clusters**: ${context.totalClusters}`,
			`**Tasks**: ${context.totalTasks}`,
			`**Checkpoint**: ${context.checkpointPath}`
		].join('\n');
	}

	private buildClusterOverview(context: PromptContext): string {
		const levels = this.groupByLevel(context.clusters);
		const sortedLevels = [...levels.entries()].sort((a, b) => a[0] - b[0]);

		const lines: string[] = [
			'## Execution Plan',
			'',
			'Execute clusters level-by-level. All clusters at the same level can run in parallel.',
			''
		];

		for (const [level, clusters] of sortedLevels) {
			const parallelNote = clusters.length > 1 ? ' (parallel)' : '';
			lines.push(`### Level ${level}${parallelNote}`);

			for (const cluster of clusters) {
				const taskList = cluster.taskIds.join(', ');
				lines.push(`- **${cluster.clusterId}**: Tasks [${taskList}]`);

				if (cluster.upstreamClusters.length > 0) {
					lines.push(`  - Depends on: ${cluster.upstreamClusters.join(', ')}`);
				}
			}

			lines.push('');
		}

		return lines.join('\n');
	}

	private buildTaskDetails(context: PromptContext): string {
		const taskMap = new Map(context.tasks.map((t) => [String(t.id), t]));
		const lines: string[] = ['## Task Details', ''];

		for (const cluster of context.clusters) {
			lines.push(`### ${cluster.clusterId}`);
			lines.push('');

			for (const taskId of cluster.taskIds) {
				const task = taskMap.get(taskId);
				if (!task) {
					this.logger.warn('Task referenced by cluster not found', {
						taskId,
						clusterId: cluster.clusterId
					});
					continue;
				}

				lines.push(this.formatTaskPrompt(task));
				lines.push('');
			}
		}

		return lines.join('\n');
	}

	/**
	 * Format a single task into a readable prompt section.
	 * Reuses the approach from BaseExecutor.formatTaskPrompt().
	 */
	private formatTaskPrompt(task: Task): string {
		const sections: string[] = [];

		sections.push(`#### Task ${task.id}: ${task.title}`);

		if (task.description) {
			sections.push(`**Description**: ${task.description}`);
		}

		if (task.details) {
			sections.push(`**Implementation Details**:\n${task.details}`);
		}

		if (task.testStrategy) {
			sections.push(`**Test Strategy**:\n${task.testStrategy}`);
		}

		if (task.dependencies && task.dependencies.length > 0) {
			sections.push(`**Dependencies**: ${task.dependencies.join(', ')}`);
		}

		if (task.subtasks && task.subtasks.length > 0) {
			const subtaskList = task.subtasks
				.map((st) => `  - [${st.status}] ${st.id}: ${st.title}`)
				.join('\n');
			sections.push(`**Subtasks**:\n${subtaskList}`);
		}

		sections.push(
			`**Status**: ${task.status} | **Priority**: ${task.priority}`
		);

		return sections.join('\n');
	}

	private buildExecutionInstructions(context: PromptContext): string {
		const levels = this.groupByLevel(context.clusters);
		const totalLevels = levels.size;

		return [
			'## Execution Instructions',
			'',
			'You are the team lead operating in delegate mode. Your role is to coordinate and review — do NOT implement tasks yourself.',
			'',
			'### Setup',
			'',
			'1. Create a team using TeamCreate.',
			`2. Create ${context.totalTasks} task(s) using TaskCreate — one per task listed in the Task Details section above.`,
			'',
			'### Workflow',
			'',
			`There are ${totalLevels} execution level(s). Process them sequentially (Level 0, then Level 1, etc.):`,
			'',
			'1. For each level, spawn one teammate per task using the Task tool (subagent_type: "general-purpose") and run them in parallel.',
			'2. Each teammate receives:',
			'   - The full task details (description, implementation details, test strategy, subtasks)',
			"   - Instructions to follow the project's CLAUDE.md guidelines",
			'   - A requirement to run relevant tests before marking complete',
			`   - The command to mark the task done: \`tm set-status --id=<task-id> --status=done --tag ${context.tag}\``,
			'3. Wait for ALL teammates in a level to finish before moving to the next level.',
			'4. After each level completes, shut down the teammates from that level using SendMessage with type: "shutdown_request".',
			'5. After each level completes, save a checkpoint so execution can resume if interrupted.',
			'',
			'### Error Handling',
			'',
			'- If a task fails, log the error and continue with other tasks in the same level.',
			'- If all tasks in a cluster fail, mark the cluster as failed and block downstream clusters.',
			'- Report a summary of failures at the end.'
		].join('\n');
	}

	private buildCompletionRules(context: PromptContext): string {
		return [
			'## Rules',
			'',
			'- Delegate mode: coordinate and review only — do NOT write code or implement tasks yourself.',
			"- Follow the project's CLAUDE.md instructions for code style, testing, and commit conventions.",
			'- Make atomic commits for each task (one commit per task when possible).',
			'- Run tests before marking a task as done.',
			'- Do not modify tasks outside the current tag scope.',
			`- Checkpoint path: ${context.checkpointPath}`,
			'- If interrupted (Ctrl+C), the session can be resumed from the last checkpoint.',
			'- After all levels complete, shut down all remaining teammates and clean up the team using TeamDelete.'
		].join('\n');
	}

	private groupByLevel(
		clusters: readonly ClusterMetadata[]
	): Map<number, ClusterMetadata[]> {
		const levels = new Map<number, ClusterMetadata[]>();
		for (const cluster of clusters) {
			const group = levels.get(cluster.level) ?? [];
			group.push(cluster);
			levels.set(cluster.level, group);
		}
		return levels;
	}
}
