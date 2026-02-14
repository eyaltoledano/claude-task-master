/**
 * @fileoverview CLI command for AI-powered inter-tag cluster generation
 * Subcommand of 'clusters': `tm clusters generate`
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import {
	ClusterGenerationService,
	type ClusterSuggestion,
	type DependencySuggestion,
	type TagAnalysisInput,
	BridgedTagSemanticAnalyzer,
	BridgedTagDependencySynthesizer,
	TagAnalysisCache,
	type CacheFile,
	type CacheStorage,
	type TmCore,
	createTmCore,
	loadGenerateObjectService
} from '@tm/core';
import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { editClusters } from '../ui/components/cluster-editor.component.js';
import { renderTagClusterLayout } from '../ui/components/cluster-layout-renderer.js';
import { displayError } from '../utils/error-handler.js';
import { getProjectRoot } from '../utils/project-root.js';

interface ClusterGenerateOptions {
	auto?: boolean;
	json?: boolean;
	project?: string;
	cache?: boolean;
}

/**
 * Options for the reusable cluster generation helper
 */
export interface RunClusterGenerationOptions {
	readonly tmCore: TmCore;
	readonly projectRoot: string;
	readonly useCache: boolean;
}

/**
 * Reusable cluster generation core: builds tag inputs, constructs AI services,
 * runs analysis with a spinner, and returns the suggestion.
 *
 * Used by both `ClusterGenerateCommand` and the inline prompt in `ClustersCommand`.
 */
export async function runClusterGeneration(
	options: RunClusterGenerationOptions
): Promise<ClusterSuggestion> {
	const { tmCore, projectRoot, useCache } = options;

	const tagsResult = await tmCore.tasks.getTagsWithStats();
	const tagInputs = await buildTagInputs(tmCore, tagsResult.tags);

	const generateObjectService = await loadGenerateObjectService();

	const analyzer = new BridgedTagSemanticAnalyzer(generateObjectService);
	const synthesizer = new BridgedTagDependencySynthesizer(generateObjectService);

	const cache = useCache
		? new TagAnalysisCache(buildCacheStorage(projectRoot))
		: undefined;

	const service = new ClusterGenerationService(analyzer, synthesizer, cache);

	const spinner = ora('Analyzing tags...').start();

	try {
		const suggestion = await service.generate(tagInputs, (progress) => {
			switch (progress.phase) {
				case 'analyzing': {
					const cachedInfo = progress.cached
						? chalk.dim(` (${progress.cached} cached)`)
						: '';
					spinner.text = `Analyzing tag ${progress.current}/${progress.total}: ${progress.tagName ?? ''}${cachedInfo}`;
					break;
				}
				case 'synthesizing':
					spinner.text = 'Synthesizing dependencies...';
					break;
				case 'complete':
					spinner.succeed('Analysis complete');
					break;
			}
		});

		return suggestion;
	} catch (error) {
		spinner.fail('Analysis failed');
		throw error;
	}
}

/**
 * Persist generated dependencies: removes all existing inter-tag deps, then adds new ones.
 */
export async function persistClusterDependencies(
	tmCore: TmCore,
	allTagNames: readonly string[],
	dependencies: readonly DependencySuggestion[]
): Promise<void> {
	// Snapshot existing dependencies before removal so we can restore on failure
	const snapshot = new Map<string, readonly string[]>();
	for (const tagName of allTagNames) {
		const existingDeps = await tmCore.tasks.getTagDependencies(tagName);
		snapshot.set(tagName, existingDeps);
	}

	// Remove all existing deps, then add new ones
	for (const tagName of allTagNames) {
		for (const dep of snapshot.get(tagName) ?? []) {
			await tmCore.tasks.removeTagDependency(tagName, dep);
		}
	}

	try {
		for (const dep of dependencies) {
			await tmCore.tasks.addTagDependency(dep.from, dep.to);
		}
	} catch (error) {
		// Restore original dependencies from snapshot
		for (const [tagName, deps] of snapshot) {
			for (const dep of deps) {
				await tmCore.tasks.addTagDependency(tagName, dep);
			}
		}
		throw error;
	}
}

function buildCacheStorage(projectRoot: string): CacheStorage {
	const cachePath = path.join(projectRoot, '.taskmaster', 'cache', 'cluster-analysis.json');

	return {
		load: async (): Promise<CacheFile | null> => {
			try {
				const raw = await fs.readFile(cachePath, 'utf-8');
				return JSON.parse(raw) as CacheFile;
			} catch {
				return null;
			}
		},
		save: async (data: CacheFile): Promise<void> => {
			await fs.mkdir(path.dirname(cachePath), { recursive: true });
			await fs.writeFile(cachePath, JSON.stringify(data, null, 2), 'utf-8');
		}
	};
}

async function buildTagInputs(
	tmCore: TmCore,
	tags: readonly { name: string; description?: string }[]
): Promise<TagAnalysisInput[]> {
	const inputs: TagAnalysisInput[] = [];

	for (const tag of tags) {
		const taskResult = await tmCore.tasks.list({
			tag: tag.name,
			includeSubtasks: false
		});

		inputs.push({
			name: tag.name,
			description: tag.description,
			tasks: taskResult.tasks.map((t) => ({
				title: t.title,
				description: t.description,
				dependencies: t.dependencies?.map(String) ?? []
			}))
		});
	}

	return inputs;
}

export class ClusterGenerateCommand extends Command {
	constructor() {
		super('generate');

		this.description('Use AI to suggest inter-tag dependencies and cluster ordering')
			.option('--auto', 'Auto-accept AI suggestions without interactive review')
			.option('--json', 'Output suggestions as JSON (non-interactive)')
			.option('--no-cache', 'Skip analysis cache and re-analyze all tags')
			.option(
				'-p, --project <path>',
				'Project root directory (auto-detected if not provided)'
			)
			.action(async (options: ClusterGenerateOptions) => {
				await this.executeCommand(options);
			});
	}

	private async executeCommand(options: ClusterGenerateOptions): Promise<void> {
		try {
			const projectRoot = getProjectRoot(options.project);
			const tmCore = await createTmCore({ projectPath: projectRoot });

			// Load all tags with stats
			const tagsResult = await tmCore.tasks.getTagsWithStats();

			if (tagsResult.tags.length < 2) {
				console.log(
					chalk.yellow('\nAt least 2 tags are needed for cluster generation.')
				);
				return;
			}

			const suggestion = await runClusterGeneration({
				tmCore,
				projectRoot,
				useCache: options.cache !== false
			});

			// Handle output modes
			if (options.json) {
				console.log(JSON.stringify(suggestion, null, 2));
				return;
			}

			if (options.auto) {
				const existingDeps = this.getExistingDependencyCount(tagsResult.tags);
				if (existingDeps > 0) {
					console.log(
						chalk.yellow(`Replacing ${existingDeps} existing inter-tag dependencies.`)
					);
				}

				await persistClusterDependencies(
					tmCore,
					tagsResult.tags.map((t) => t.name),
					suggestion.dependencies
				);
				console.log(renderTagClusterLayout(
					suggestion.clusters,
					suggestion.dependencies,
					suggestion.reasoning
				));
				console.log(chalk.green('\nDependencies saved successfully.'));
				return;
			}

			// Non-TTY fallback
			if (!process.stdin.isTTY) {
				console.log(JSON.stringify(suggestion, null, 2));
				return;
			}

			// Interactive editor
			const result = await editClusters(
				suggestion.clusters,
				suggestion.dependencies,
				suggestion.reasoning
			);

			if (!result.accepted) {
				console.log(chalk.yellow('\nCancelled. No changes were made.'));
				return;
			}

			// Confirm before replacing existing deps
			const existingDeps = this.getExistingDependencyCount(tagsResult.tags);

			if (existingDeps > 0) {
				const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
					{
						type: 'confirm',
						name: 'confirmed',
						message: `This will replace ${existingDeps} existing inter-tag dependencies. Continue?`,
						default: true
					}
				]);

				if (!confirmed) {
					console.log(chalk.yellow('\nCancelled. No changes were made.'));
					return;
				}
			}

			await persistClusterDependencies(
				tmCore,
				tagsResult.tags.map((t) => t.name),
				result.dependencies
			);
			console.log(chalk.green('\nDependencies saved successfully.'));
		} catch (error: unknown) {
			displayError(error);
		}
	}

	private getExistingDependencyCount(
		tags: readonly { name: string; dependsOn?: string[] }[]
	): number {
		let count = 0;
		for (const tag of tags) {
			const deps = tag.dependsOn ?? [];
			count += deps.length;
		}
		return count;
	}
}
