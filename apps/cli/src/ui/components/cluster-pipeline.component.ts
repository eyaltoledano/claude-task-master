/**
 * @fileoverview Cluster pipeline visualization component
 * Displays execution clusters as a visual pipeline box in the list view
 */

import type { ClusterDetectionResult, ClusterMetadata, Task } from '@tm/core';
import boxen from 'boxen';
import chalk from 'chalk';
import { isTaskComplete } from '../../utils/task-status.js';
import { getBoxWidth } from '../../utils/ui.js';

/**
 * Group clusters by topological level (turn)
 */
function groupClustersByLevel(
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
 * Build a mini progress indicator for a cluster's tasks.
 * Shows ■ for complete tasks and □ for incomplete, colored accordingly.
 */
function buildClusterProgress(
	cluster: ClusterMetadata,
	taskMap: Map<string, Task>
): { bar: string; done: number; total: number } {
	// Only count top-level task IDs (skip subtask IDs like "1.2")
	const topLevelIds = cluster.taskIds.filter((id) => !id.includes('.'));
	const total = topLevelIds.length;

	let done = 0;
	for (const id of topLevelIds) {
		const task = taskMap.get(id);
		if (task && isTaskComplete(task.status)) {
			done++;
		}
	}

	// Build mini progress blocks (cap visual blocks at 8 to keep compact)
	const displayCount = Math.min(total, 8);
	const doneBlocks =
		total === 0 ? 0 : Math.round((done / total) * displayCount);
	const remainingBlocks = displayCount - doneBlocks;

	const bar =
		chalk.green('■').repeat(doneBlocks) +
		chalk.gray('□').repeat(remainingBlocks) +
		(total > 8 ? chalk.gray('…') : '');

	return { bar, done, total };
}

/**
 * Format a single cluster as a visual chip with progress indicator
 */
function formatClusterChip(
	cluster: ClusterMetadata,
	taskMap: Map<string, Task>
): string {
	const { bar, done, total } = buildClusterProgress(cluster, taskMap);

	const progress =
		done > 0
			? chalk.green(`${done}`) + chalk.gray('/') + chalk.white(`${total}`)
			: chalk.white(`${total}`);

	return `${bar} ${chalk.cyan(cluster.clusterId)} ${progress}`;
}

/**
 * Display the cluster execution pipeline as a visual box in tm list.
 *
 * Shows each topological level as a "turn" with cluster chips.
 * Turn labels act as lane indicators. Parallel clusters within
 * a turn are shown side-by-side with no arrows between turns.
 */
export function displayClusterPipeline(
	detection: ClusterDetectionResult,
	tasks: Task[],
	tag?: string
): void {
	const levels = groupClustersByLevel(detection.clusters);
	const sortedLevels = [...levels.entries()].sort((a, b) => a[0] - b[0]);
	const parallelTurnCount = sortedLevels.filter(
		([, clusters]) => clusters.length > 1
	).length;

	const taskMap = new Map(tasks.map((t) => [String(t.id), t]));
	const content: string[] = [];

	for (let i = 0; i < sortedLevels.length; i++) {
		const [level, clusters] = sortedLevels[i];

		// Turn label (fixed-width for alignment)
		const turnLabel = chalk.dim(`Turn ${String(level).padStart(2)}`);

		// Build cluster chips for this turn
		const chips = clusters.map((c) => formatClusterChip(c, taskMap));

		// Parallel indicator for turns with multiple clusters
		const parallelNote = clusters.length > 1 ? chalk.green('  ⇢ parallel') : '';

		// Join clusters with a visual separator
		const separator = chalk.gray('  │  ');
		content.push(`  ${turnLabel}  ${chips.join(separator)}${parallelNote}`);

		// Blank separator between turns for visual breathing room (no arrows)
		if (i < sortedLevels.length - 1) {
			content.push('');
		}
	}

	content.push('');

	// Summary line
	const stats = [
		chalk.white(`${detection.totalClusters} clusters`),
		chalk.white(`${sortedLevels.length} turns`),
		parallelTurnCount > 0
			? chalk.green(`${parallelTurnCount} parallel`)
			: chalk.gray('all sequential')
	];
	content.push(`  ${stats.join(chalk.gray(' · '))}`);

	// Call to action
	const tagArg = tag ? ` --tag ${tag}` : '';
	content.push(
		`  ${chalk.gray('→')} ${chalk.yellow(`tm clusters${tagArg}`)} ${chalk.gray('for full breakdown')}`
	);

	console.log(
		boxen(content.join('\n'), {
			padding: 1,
			margin: { top: 1, bottom: 0 },
			borderStyle: 'round',
			borderColor: '#00CED1',
			title: chalk.hex('#00CED1')('⚡ EXECUTION PIPELINE ⚡'),
			titleAlignment: 'center',
			width: getBoxWidth(0.96)
		})
	);
}
