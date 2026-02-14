/**
 * @fileoverview Pure rendering function for tag cluster layouts
 * Renders cluster levels visually using chalk + boxen
 */

import type { ClusterLevel, DependencySuggestion } from '@tm/core';
import boxen from 'boxen';
import chalk from 'chalk';
import { getBoxWidth } from '../layout/helpers.js';

export function renderTagClusterLayout(
	clusters: readonly ClusterLevel[],
	dependencies: readonly DependencySuggestion[],
	reasoning?: string
): string {
	const lines: string[] = [];
	const sorted = [...clusters].sort((a, b) => a.level - b.level);

	if (sorted.length === 0) {
		return chalk.yellow('No clusters to display.');
	}

	// Render each level
	for (let i = 0; i < sorted.length; i++) {
		const cluster = sorted[i];
		const isParallel = cluster.tags.length > 1;
		const levelLabel = chalk.dim(`Level ${String(cluster.level).padStart(2)}`);
		const parallelNote = isParallel
			? chalk.green(`  [${cluster.tags.length} parallel]`)
			: '';

		const tagChips = cluster.tags
			.map((tag) => chalk.cyan(tag))
			.join(chalk.gray('  |  '));

		lines.push(`  ${levelLabel}  ${tagChips}${parallelNote}`);

		// Arrow connector between levels
		if (i < sorted.length - 1) {
			lines.push(chalk.gray('           |'));
		}
	}

	// Dependency details
	if (dependencies.length > 0) {
		lines.push('');
		lines.push(chalk.bold('  Dependencies:'));

		for (const dep of dependencies) {
			const confidenceColor =
				dep.confidence === 'high'
					? chalk.green
					: dep.confidence === 'medium'
						? chalk.yellow
						: chalk.gray;

			lines.push(
				`    ${chalk.white(dep.from)} ${chalk.gray('->')} ${chalk.white(dep.to)} ` +
					`${confidenceColor(`[${dep.confidence}]`)} ${chalk.gray(dep.reason)}`
			);
		}
	}

	// Reasoning summary
	if (reasoning) {
		lines.push('');
		lines.push(chalk.dim(`  ${reasoning.split('\n')[0]}`));
	}

	return boxen(lines.join('\n'), {
		padding: 1,
		margin: { top: 1, bottom: 0 },
		borderStyle: 'round',
		borderColor: '#00CED1',
		title: chalk.hex('#00CED1')('AI-GENERATED CLUSTER LAYOUT'),
		titleAlignment: 'center',
		width: getBoxWidth(0.96)
	});
}
