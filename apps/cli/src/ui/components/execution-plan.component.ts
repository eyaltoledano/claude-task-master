/**
 * @fileoverview Execution Plan display component
 * Renders a cluster execution plan before launching a Claude Code teams session
 */

import type { ExecutionPlan, ClusterMetadata } from '@tm/core';
import boxen from 'boxen';
import chalk from 'chalk';
import { getBoxWidth } from '../layout/helpers.js';

/**
 * Display options for the execution plan
 */
interface DisplayOptions {
	json?: boolean;
}

/**
 * Group clusters by their topological level (turn)
 */
function groupByLevel(
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

/**
 * Display a cluster execution plan.
 *
 * Shows:
 * - Tag name and summary stats (clusters, tasks, turns)
 * - Clusters grouped by level (turn), each showing task IDs and parallel indicator
 * - If checkpoint exists: shows resume info
 * - Boxed output matching existing style
 */
export function displayExecutionPlan(
	plan: ExecutionPlan,
	options: DisplayOptions = {}
): void {
	if (options.json) {
		const serializable = {
			tag: plan.tag,
			totalClusters: plan.totalClusters,
			totalTasks: plan.totalTasks,
			estimatedTurns: plan.estimatedTurns,
			hasResumableCheckpoint: plan.hasResumableCheckpoint,
			checkpointInfo: plan.checkpointInfo
				? {
						completedClusters: plan.checkpointInfo.completedClusters,
						completedTasks: plan.checkpointInfo.completedTasks,
						timestamp: plan.checkpointInfo.timestamp.toISOString()
					}
				: undefined,
			clusters: plan.clusters.map((c) => ({
				clusterId: c.clusterId,
				level: c.level,
				taskIds: [...c.taskIds],
				upstreamClusters: [...c.upstreamClusters],
				status: c.status
			}))
		};

		console.log(JSON.stringify(serializable, null, 2));
		return;
	}

	const content: string[] = [];
	const levels = groupByLevel(plan.clusters);
	const sortedLevels = [...levels.entries()].sort((a, b) => a[0] - b[0]);

	// Header stats
	content.push(
		chalk.bold(`Tag: ${chalk.cyan(plan.tag)}`) +
			chalk.gray(` | `) +
			chalk.white(`${plan.totalClusters} clusters`) +
			chalk.gray(` · `) +
			chalk.white(`${plan.totalTasks} tasks`) +
			chalk.gray(` · `) +
			chalk.white(`${plan.estimatedTurns} turns`)
	);
	content.push('');

	// Checkpoint resume info
	if (plan.hasResumableCheckpoint && plan.checkpointInfo) {
		const { completedClusters, completedTasks, timestamp } =
			plan.checkpointInfo;
		content.push(
			chalk.yellow('Resuming from checkpoint:') +
				` ${completedClusters} clusters, ${completedTasks} tasks completed` +
				chalk.gray(` (saved ${timestamp.toLocaleString()})`)
		);
		content.push('');
	}

	// Cluster levels
	for (const [level, clusters] of sortedLevels) {
		const turnLabel = chalk.dim(`Turn ${String(level).padStart(2)}`);
		const parallelNote = clusters.length > 1 ? chalk.green('  [parallel]') : '';

		const clusterChips = clusters.map((cluster) => {
			const taskList = cluster.taskIds.join(', ');
			const taskCount = cluster.taskIds.length;
			return `${chalk.cyan(cluster.clusterId)} (${taskCount} tasks: ${chalk.gray(taskList)})`;
		});

		const separator = chalk.gray('  |  ');
		content.push(
			`  ${turnLabel}  ${clusterChips.join(separator)}${parallelNote}`
		);
	}

	content.push('');

	// Summary line with parallel count
	const parallelTurns = sortedLevels.filter(([, c]) => c.length > 1).length;
	const stats = [
		chalk.white(`${plan.totalClusters} clusters`),
		chalk.white(`${plan.estimatedTurns} turns`),
		parallelTurns > 0
			? chalk.green(`${parallelTurns} parallel`)
			: chalk.gray('all sequential')
	];
	content.push(`  ${stats.join(chalk.gray(' · '))}`);

	console.log(
		boxen(content.join('\n'), {
			padding: 1,
			margin: { top: 1, bottom: 0 },
			borderStyle: 'round',
			borderColor: '#00CED1',
			title: chalk.hex('#00CED1')('EXECUTION PLAN'),
			titleAlignment: 'center',
			width: getBoxWidth(0.96)
		})
	);
}
