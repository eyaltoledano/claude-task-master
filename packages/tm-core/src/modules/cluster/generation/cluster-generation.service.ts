/**
 * @fileoverview AI-driven cluster generation service
 * Orchestrates multi-step pipeline: analyze tags → synthesize dependencies → compute clusters
 */

import type { ITagSemanticAnalyzer } from './tag-semantic-analyzer.interface.js';
import type { SemanticAnalysis } from './tag-semantic-analyzer.types.js';
import type { ITagDependencySynthesizer } from './tag-dependency-synthesizer.interface.js';
import type { DependencySuggestion } from './tag-dependency-synthesizer.types.js';
import { TagClusterService, type TagClusterResult } from '../services/tag-cluster.service.js';

export interface TagAnalysisInput {
	readonly name: string;
	readonly description?: string;
	readonly tasks: readonly {
		title: string;
		description: string;
		dependencies: string[];
	}[];
}

export interface ClusterGenerationProgress {
	readonly phase: 'analyzing' | 'synthesizing' | 'complete';
	readonly current: number;
	readonly total: number;
	readonly tagName?: string;
}

export type ProgressCallback = (progress: ClusterGenerationProgress) => void;

export interface ClusterLevel {
	readonly level: number;
	readonly tags: readonly string[];
}

export interface ClusterSuggestion {
	readonly clusters: readonly ClusterLevel[];
	readonly dependencies: readonly DependencySuggestion[];
	readonly reasoning: string;
}

interface TagAnalysisResult {
	readonly label: string;
	readonly analysis: SemanticAnalysis;
}

const MAX_CONCURRENCY = 5;
const COMMAND_NAME = 'cluster-generate';

export class ClusterGenerationService {
	private readonly tagClusterService = new TagClusterService();

	constructor(
		private readonly analyzer: ITagSemanticAnalyzer,
		private readonly synthesizer: ITagDependencySynthesizer
	) {}

	async generate(
		tags: readonly TagAnalysisInput[],
		onProgress?: ProgressCallback
	): Promise<ClusterSuggestion> {
		const analyses = await this.analyzeAllTags(tags, onProgress);
		return this.suggestDependencies(analyses, onProgress);
	}

	async analyzeAllTags(
		tags: readonly TagAnalysisInput[],
		onProgress?: ProgressCallback
	): Promise<readonly TagAnalysisResult[]> {
		const results: TagAnalysisResult[] = [];
		const total = tags.length;

		for (let i = 0; i < tags.length; i += MAX_CONCURRENCY) {
			const batch = tags.slice(i, i + MAX_CONCURRENCY);

			const batchResults = await Promise.all(
				batch.map(async (tag, batchIndex) => {
					const globalIndex = i + batchIndex;
					onProgress?.({
						phase: 'analyzing',
						current: globalIndex + 1,
						total,
						tagName: tag.name
					});

					const content = this.buildTagContent(tag);
					const context = tag.description
						? `Tag "${tag.name}": ${tag.description}`
						: `Tag "${tag.name}"`;

					const result = await this.analyzer.analyze(content, context, {
						commandName: COMMAND_NAME
					});

					return { label: tag.name, analysis: result.data };
				})
			);

			results.push(...batchResults);
		}

		return results;
	}

	async suggestDependencies(
		analyses: readonly TagAnalysisResult[],
		onProgress?: ProgressCallback
	): Promise<ClusterSuggestion> {
		onProgress?.({
			phase: 'synthesizing',
			current: 0,
			total: 1
		});

		const synthesisResult = await this.synthesizer.synthesize(analyses, {
			commandName: COMMAND_NAME
		});

		const validDeps = this.filterValidDependencies(
			synthesisResult.data,
			analyses.map((a) => a.label)
		);

		const tagDeps = this.buildTagDependencies(
			analyses.map((a) => a.label),
			validDeps
		);
		const clusterResult = this.tagClusterService.clusterTags(tagDeps);

		const clusters = this.toClusterLevels(clusterResult);
		const reasoning = this.buildReasoning(validDeps, clusterResult);

		onProgress?.({
			phase: 'complete',
			current: 1,
			total: 1
		});

		return { clusters, dependencies: validDeps, reasoning };
	}

	private buildTagContent(tag: TagAnalysisInput): string {
		const taskDescriptions = tag.tasks
			.map((t) => {
				const deps = t.dependencies.length > 0
					? ` (depends on: ${t.dependencies.join(', ')})`
					: '';
				return `- ${t.title}: ${t.description}${deps}`;
			})
			.join('\n');

		return `Tag: "${tag.name}"${tag.description ? `\nDescription: ${tag.description}` : ''}\nTasks (${tag.tasks.length}):\n${taskDescriptions}`;
	}

	private filterValidDependencies(
		suggestions: readonly DependencySuggestion[],
		validTags: readonly string[]
	): readonly DependencySuggestion[] {
		const tagSet = new Set(validTags);

		return suggestions.filter((dep) => {
			if (!tagSet.has(dep.from) || !tagSet.has(dep.to)) return false;
			if (dep.from === dep.to) return false;
			return true;
		});
	}

	private buildTagDependencies(
		allTags: readonly string[],
		dependencies: readonly DependencySuggestion[]
	): readonly { tag: string; dependencies: readonly string[] }[] {
		const depMap = new Map<string, string[]>();

		for (const tag of allTags) {
			depMap.set(tag, []);
		}

		for (const dep of dependencies) {
			const existing = depMap.get(dep.from);
			if (existing) {
				existing.push(dep.to);
			}
		}

		return allTags.map((tag) => ({
			tag,
			dependencies: depMap.get(tag) ?? []
		}));
	}

	private toClusterLevels(result: TagClusterResult): readonly ClusterLevel[] {
		return result.clusters.map((c) => ({
			level: c.level,
			tags: c.tags
		}));
	}

	private buildReasoning(
		dependencies: readonly DependencySuggestion[],
		clusterResult: TagClusterResult
	): string {
		const depSummary = dependencies
			.map((d) => `"${d.from}" depends on "${d.to}" (${d.confidence}): ${d.reason}`)
			.join('\n');

		const levelSummary = clusterResult.clusters
			.map((c) => `Level ${c.level}: ${c.tags.join(', ')}`)
			.join('\n');

		return `Suggested ${dependencies.length} dependencies across ${clusterResult.totalTags} tags:\n\n${depSummary}\n\nResulting execution order (${clusterResult.totalClusters} levels):\n${levelSummary}`;
	}
}
