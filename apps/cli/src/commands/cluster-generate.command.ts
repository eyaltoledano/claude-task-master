/**
 * @fileoverview CLI command for AI-powered inter-tag cluster generation
 * Subcommand of 'clusters': `tm clusters generate`
 */

import {
	ClusterGenerationService,
	type DependencySuggestion,
	type GenerateObjectServiceFn,
	type TagAnalysisInput,
	BridgedTagSemanticAnalyzer,
	BridgedTagDependencySynthesizer,
	type TmCore,
	createTmCore
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
}

export class ClusterGenerateCommand extends Command {
	constructor() {
		super('generate');

		this.description('Use AI to suggest inter-tag dependencies and cluster ordering')
			.option('--auto', 'Auto-accept AI suggestions without interactive review')
			.option('--json', 'Output suggestions as JSON (non-interactive)')
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

			// Build tag analysis inputs
			const tagInputs = await this.buildTagInputs(tmCore, tagsResult.tags);

			// Import legacy AI service (cast to typed interface)
			const aiModule = await import(
				/* webpackIgnore: true */
				'../../../../scripts/modules/ai-services-unified.js'
			);
			const generateObjectService = aiModule.generateObjectService as GenerateObjectServiceFn;

			const analyzer = new BridgedTagSemanticAnalyzer(generateObjectService);
			const synthesizer = new BridgedTagDependencySynthesizer(generateObjectService);
			const service = new ClusterGenerationService(analyzer, synthesizer);

			// Run generation with progress spinner
			const spinner = ora('Analyzing tags...').start();

			const suggestion = await service.generate(tagInputs, (progress) => {
				switch (progress.phase) {
					case 'analyzing':
						spinner.text = `Analyzing tag ${progress.current}/${progress.total}: ${progress.tagName ?? ''}`;
						break;
					case 'synthesizing':
						spinner.text = 'Synthesizing dependencies...';
						break;
					case 'complete':
						spinner.succeed('Analysis complete');
						break;
				}
			});

			// Handle output modes
			if (options.json) {
				console.log(JSON.stringify(suggestion, null, 2));
				return;
			}

			if (options.auto) {
				await this.persistDependencies(
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

			await this.persistDependencies(
				tmCore,
				tagsResult.tags.map((t) => t.name),
				result.dependencies
			);
			console.log(chalk.green('\nDependencies saved successfully.'));
		} catch (error: unknown) {
			displayError(error);
		}
	}

	private async buildTagInputs(
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

	private async persistDependencies(
		tmCore: TmCore,
		allTagNames: readonly string[],
		dependencies: readonly DependencySuggestion[]
	): Promise<void> {
		// Remove all existing inter-tag deps
		for (const tagName of allTagNames) {
			const existingDeps = await tmCore.tasks.getTagDependencies(tagName);
			for (const dep of existingDeps) {
				await tmCore.tasks.removeTagDependency(tagName, dep);
			}
		}

		// Add new deps
		for (const dep of dependencies) {
			await tmCore.tasks.addTagDependency(dep.from, dep.to);
		}
	}
}
