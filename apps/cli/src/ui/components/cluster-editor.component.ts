/**
 * @fileoverview Interactive cluster editor component
 * Action loop using inquirer for reviewing and re-ordering AI-generated cluster layouts
 */

import type { ClusterLevel, DependencySuggestion } from '@tm/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { renderTagClusterLayout } from './cluster-layout-renderer.js';

export interface ClusterEditorResult {
	readonly accepted: boolean;
	readonly clusters: readonly ClusterLevel[];
	readonly dependencies: readonly DependencySuggestion[];
}

interface EditorState {
	clusters: readonly ClusterLevel[];
	dependencies: readonly DependencySuggestion[];
}

export function moveTagToLevel(
	clusters: readonly ClusterLevel[],
	tag: string,
	targetLevel: number
): readonly ClusterLevel[] {
	// Remove tag from current level
	const withoutTag = clusters.map((c) => ({
		...c,
		tags: c.tags.filter((t) => t !== tag)
	}));

	// Filter empty levels
	const nonEmpty = withoutTag.filter((c) => c.tags.length > 0);

	// Find or create the target level
	const existing = nonEmpty.find((c) => c.level === targetLevel);

	let updated: ClusterLevel[];
	if (existing) {
		updated = nonEmpty.map((c) =>
			c.level === targetLevel
				? { ...c, tags: [...c.tags, tag].sort() }
				: c
		);
	} else {
		updated = [...nonEmpty, { level: targetLevel, tags: [tag] }];
	}

	// Re-number levels sequentially starting from 0
	return updated
		.sort((a, b) => a.level - b.level)
		.map((c, i) => ({ level: i, tags: [...c.tags] }));
}

export function recalculateDependencies(
	clusters: readonly ClusterLevel[]
): readonly DependencySuggestion[] {
	const deps: DependencySuggestion[] = [];
	const sorted = [...clusters].sort((a, b) => a.level - b.level);

	for (let i = 1; i < sorted.length; i++) {
		const current = sorted[i];
		const previous = sorted[i - 1];

		for (const fromTag of current.tags) {
			for (const toTag of previous.tags) {
				deps.push({
					from: fromTag,
					to: toTag,
					reason: 'Derived from level ordering',
					confidence: 'medium'
				});
			}
		}
	}

	return deps;
}

function getAllTags(clusters: readonly ClusterLevel[]): readonly string[] {
	return clusters.flatMap((c) => [...c.tags]).sort();
}

function getTagLevel(clusters: readonly ClusterLevel[], tag: string): number {
	const cluster = clusters.find((c) => c.tags.includes(tag));
	return cluster?.level ?? -1;
}

export async function editClusters(
	initialClusters: readonly ClusterLevel[],
	initialDependencies: readonly DependencySuggestion[],
	reasoning?: string
): Promise<ClusterEditorResult> {
	const originalState: EditorState = {
		clusters: initialClusters,
		dependencies: initialDependencies
	};

	let state: EditorState = { ...originalState };

	while (true) {
		// Clear terminal and render current layout
		console.clear();
		console.log(renderTagClusterLayout(state.clusters, state.dependencies, reasoning));
		console.log('');

		const { action } = await inquirer.prompt<{ action: string }>([
			{
				type: 'list',
				name: 'action',
				message: 'What would you like to do?',
				choices: [
					{ name: chalk.green('Accept & Save'), value: 'accept' },
					{ name: 'Move a tag to a different level', value: 'move' },
					{ name: 'Reset to AI suggestion', value: 'reset' },
					{ name: chalk.red('Cancel (discard changes)'), value: 'cancel' }
				]
			}
		]);

		switch (action) {
			case 'accept':
				return {
					accepted: true,
					clusters: state.clusters,
					dependencies: state.dependencies
				};

			case 'cancel':
				return {
					accepted: false,
					clusters: state.clusters,
					dependencies: state.dependencies
				};

			case 'reset':
				state = { ...originalState };
				break;

			case 'move': {
				const tags = getAllTags(state.clusters);
				const maxLevel = Math.max(...state.clusters.map((c) => c.level));

				const { selectedTag } = await inquirer.prompt<{ selectedTag: string }>([
					{
						type: 'list',
						name: 'selectedTag',
						message: 'Select a tag to move:',
						choices: tags.map((tag) => ({
							name: `${tag} ${chalk.gray(`(currently Level ${getTagLevel(state.clusters, tag)})`)}`,
							value: tag
						}))
					}
				]);

				const levelChoices = Array.from(
					{ length: maxLevel + 2 },
					(_, i) => {
						const tagsAtLevel = state.clusters.find((c) => c.level === i)?.tags ?? [];
						const label = tagsAtLevel.length > 0
							? `Level ${i} (${tagsAtLevel.join(', ')})`
							: `Level ${i} (new level)`;
						return { name: label, value: i };
					}
				);

				const { targetLevel } = await inquirer.prompt<{ targetLevel: number }>([
					{
						type: 'list',
						name: 'targetLevel',
						message: `Move "${selectedTag}" to which level?`,
						choices: levelChoices
					}
				]);

				const newClusters = moveTagToLevel(state.clusters, selectedTag, targetLevel);
				const newDeps = recalculateDependencies(newClusters);
				state = { clusters: newClusters, dependencies: newDeps };
				break;
			}
		}
	}
}
