/**
 * @fileoverview Clusters command for visualizing task execution clusters
 * Extends Commander.Command to display cluster detection results from @tm/core
 */

import {
	type ClusterDetectionResult,
	ClusterDetectionService,
	type ClusterMetadata,
	type TagClusterResult,
	TagClusterService,
	type TmCore,
	createTmCore
} from '@tm/core';
import { ClusterStartCommand } from './cluster-start.command.js';
import { renderMermaidAscii } from 'beautiful-mermaid';
import chalk from 'chalk';
import Table from 'cli-table3';
import { Command } from 'commander';
import inquirer from 'inquirer';
import {
	ClusterGenerateCommand,
	runClusterGeneration,
	persistClusterDependencies
} from './cluster-generate.command.js';
import { editClusters } from '../ui/components/cluster-editor.component.js';
import { renderTagClusterLayout } from '../ui/components/cluster-layout-renderer.js';
import { getBoxWidth } from '../ui/layout/helpers.js';
import { displayCommandHeader } from '../utils/display-helpers.js';
import { displayError } from '../utils/error-handler.js';
import { pageOutput } from '../utils/pager.js';
import { getProjectRoot } from '../utils/project-root.js';

/**
 * Options interface for the clusters command
 */
interface ClustersCommandOptions {
	tag?: string;
	tree?: boolean;
	diagram?: string;
	json?: boolean;
	auto?: boolean;
	project?: string;
}

/**
 * ClustersCommand extending Commander's Command class
 * Thin presentation layer over @tm/core's ClusterDetectionService
 */
export class ClustersCommand extends Command {
	private tmCore?: TmCore;

	constructor(name?: string) {
		super(name || 'clusters');

		this.enablePositionalOptions();

		this.description('Detect and visualize task execution clusters')
			.option('-t, --tag <tag>', 'Show clusters for a specific tag')
			.option('--tree', 'Display clusters as an ASCII dependency tree')
			.option(
				'--diagram <type>',
				'Output a diagram (supported: mermaid, mermaid-raw)'
			)
			.option('--json', 'Output raw cluster detection result as JSON')
			.option('--auto', 'Auto-accept AI generation when no dependencies exist')
			.option(
				'-p, --project <path>',
				'Project root directory (auto-detected if not provided)'
			)
			.action(async (options: ClustersCommandOptions) => {
				await this.executeCommand(options);
			});

		// Register subcommands
		this.addCommand(new ClusterStartCommand());
		this.addCommand(new ClusterGenerateCommand());
	}

	private async executeCommand(options: ClustersCommandOptions): Promise<void> {
		try {
			await this.initializeCore(getProjectRoot(options.project));

			if (!this.tmCore) {
				throw new Error('TmCore not initialized');
			}

			if (options.tag) {
				await this.renderTaskClusters(options);
			} else {
				await this.renderTagClusters(options);
			}
		} catch (error: any) {
			displayError(error);
		}
	}

	/**
	 * Task-level clustering: clusters tasks within a specific tag
	 */
	private async renderTaskClusters(
		options: ClustersCommandOptions
	): Promise<void> {
		const result = await this.tmCore!.tasks.list({
			tag: options.tag,
			includeSubtasks: true
		});

		const storageType = this.tmCore!.tasks.getStorageType();

		if (result.tasks.length === 0) {
			displayCommandHeader(this.tmCore!, {
				tag: options.tag || 'master',
				storageType
			});
			console.log(chalk.yellow('\nNo tasks found.'));
			return;
		}

		const detector = new ClusterDetectionService();
		const detection = detector.detectClusters(result.tasks);

		if (detection.hasCircularDependencies) {
			this.renderCircularDependencyError(detection);
			throw new Error('Circular dependency detected');
		}

		if (options.json) {
			this.renderJson(detection);
			return;
		}

		displayCommandHeader(this.tmCore!, {
			tag: options.tag || 'master',
			storageType
		});

		console.log(
			chalk.bold(
				`\nCluster Detection — ${detection.totalTasks} tasks → ${detection.totalClusters} clusters\n`
			)
		);

		if (options.tree) {
			this.renderTree(detection);
		} else if (options.diagram === 'mermaid') {
			this.renderMermaidAscii(detection);
		} else if (options.diagram === 'mermaid-raw') {
			this.renderMermaidRaw(detection);
		} else if (options.diagram) {
			throw new Error(`Unsupported diagram type: ${options.diagram}`);
		} else {
			this.renderTable(detection);
		}
	}

	/**
	 * Tag-level clustering: groups tags by inter-tag dependency level
	 */
	private async renderTagClusters(
		options: ClustersCommandOptions
	): Promise<void> {
		const tagsResult = await this.tmCore!.tasks.getTagsWithStats();
		const storageType = this.tmCore!.tasks.getStorageType();

		if (tagsResult.tags.length === 0) {
			displayCommandHeader(this.tmCore!, { storageType });
			console.log(chalk.yellow('\nNo tags found.'));
			return;
		}

		// Build tag dependency data from stored inter-tag dependencies
		const tagDeps = tagsResult.tags.map((t) => ({
			tag: t.name,
			dependencies: t.dependsOn ?? []
		}));

		const tagClusterService = new TagClusterService();
		const detection = tagClusterService.clusterTags(tagDeps);

		if (options.json) {
			this.renderTagJson(detection);
			return;
		}

		displayCommandHeader(this.tmCore!, { storageType });

		console.log(
			chalk.bold(
				`\nTag Clusters — ${detection.totalTags} tags → ${detection.totalClusters} cluster(s)\n`
			)
		);

		const allIndependent =
			detection.clusters.length === 1 &&
			detection.clusters[0].dependsOn.length === 0;

		if (allIndependent) {
			const isInteractive =
				process.stdin.isTTY &&
				!options.json &&
				!options.tree &&
				!options.diagram;

			if (isInteractive && tagsResult.tags.length >= 2) {
				console.log(chalk.gray('  No inter-tag dependencies found.\n'));

				const shouldGenerate =
					options.auto || (await this.promptForGeneration());

				if (shouldGenerate) {
					await this.runInlineGenerate(options, tagsResult.tags);
					return;
				}
			} else {
				console.log(
					chalk.gray(
						'  All tags are independent (no inter-tag dependencies defined).\n' +
							'  Define tag dependencies with `tm tags add-dep` to see sequential ordering.\n'
					)
				);
			}
		}

		if (options.tree) {
			this.renderTagTree(detection);
		} else if (options.diagram === 'mermaid') {
			this.renderTagMermaidAscii(detection);
		} else if (options.diagram === 'mermaid-raw') {
			this.renderTagMermaidRaw(detection);
		} else if (options.diagram) {
			throw new Error(`Unsupported diagram type: ${options.diagram}`);
		} else {
			this.renderTagTable(detection);
		}
	}

	private async promptForGeneration(): Promise<boolean> {
		const { generate } = await inquirer.prompt<{ generate: boolean }>([
			{
				type: 'confirm',
				name: 'generate',
				message: 'Generate cluster ordering with AI?',
				default: true
			}
		]);
		return generate;
	}

	private async runInlineGenerate(
		options: ClustersCommandOptions,
		tags: readonly {
			name: string;
			description?: string;
			dependsOn?: string[];
		}[]
	): Promise<void> {
		const projectRoot = getProjectRoot(options.project);

		const suggestion = await runClusterGeneration({
			tmCore: this.tmCore!,
			projectRoot,
			useCache: true
		});

		if (options.auto) {
			await persistClusterDependencies(
				this.tmCore!,
				tags.map((t) => t.name),
				suggestion.dependencies
			);
			console.log(
				renderTagClusterLayout(
					suggestion.clusters,
					suggestion.dependencies,
					suggestion.reasoning
				)
			);
			console.log(chalk.green('\nDependencies saved successfully.'));
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

		await persistClusterDependencies(
			this.tmCore!,
			tags.map((t) => t.name),
			result.dependencies
		);
		console.log(chalk.green('\nDependencies saved successfully.'));

		// Re-render clusters with the new dependencies
		console.log('');
		const freshTags = await this.tmCore!.tasks.getTagsWithStats();
		const tagDeps = freshTags.tags.map((t) => ({
			tag: t.name,
			dependencies: t.dependsOn ?? []
		}));
		const tagClusterService = new TagClusterService();
		const newDetection = tagClusterService.clusterTags(tagDeps);

		console.log(
			chalk.bold(
				`\nTag Clusters — ${newDetection.totalTags} tags → ${newDetection.totalClusters} cluster(s)\n`
			)
		);
		this.renderTagTable(newDetection);
	}

	private async initializeCore(projectRoot: string): Promise<void> {
		if (!this.tmCore) {
			this.tmCore = await createTmCore({ projectPath: projectRoot });
		}
	}

	/**
	 * Render cluster table (default output)
	 */
	private renderTable(detection: ClusterDetectionResult): void {
		const usableWidth = getBoxWidth(0.95);
		// Cluster, Level, Parallel, Tasks, Depends On, Status
		const widths = [0.12, 0.08, 0.18, 0.3, 0.18, 0.14];
		const colWidths = widths.map((w) =>
			Math.max(Math.floor(usableWidth * w), 8)
		);

		const table = new Table({
			head: [
				chalk.white('Cluster'),
				chalk.white('Level'),
				chalk.white('Parallel'),
				chalk.white('Tasks'),
				chalk.white('Depends On'),
				chalk.white('Status')
			],
			colWidths,
			wordWrap: true,
			style: { head: [], border: ['gray'] }
		});

		for (const cluster of detection.clusters) {
			const taskCount = cluster.taskIds.length;
			const isParallel = taskCount > 1;
			const parallelLabel = isParallel
				? chalk.green(`Yes (${taskCount} tasks)`)
				: chalk.gray(`No (1 task)`);

			const taskList = cluster.taskIds.join(', ');

			const upstream =
				cluster.upstreamClusters.length > 0
					? cluster.upstreamClusters.join(', ')
					: chalk.gray('—');

			const statusColor = this.getStatusColor(cluster.status);

			table.push([
				chalk.cyan(cluster.clusterId),
				String(cluster.level),
				parallelLabel,
				taskList,
				upstream,
				statusColor
			]);
		}

		console.log(table.toString());
	}

	/**
	 * Render ASCII tree view
	 */
	private renderTree(detection: ClusterDetectionResult): void {
		const roots = detection.clusters.filter(
			(c) => c.upstreamClusters.length === 0
		);

		const clusterMap = new Map(detection.clusters.map((c) => [c.clusterId, c]));

		for (let i = 0; i < roots.length; i++) {
			const isLast = i === roots.length - 1;
			this.renderTreeNode(roots[i], clusterMap, '', isLast, true);
		}
	}

	private renderTreeNode(
		cluster: ClusterMetadata,
		clusterMap: Map<string, ClusterMetadata>,
		prefix: string,
		isLast: boolean,
		isRoot: boolean
	): void {
		const connector = isRoot ? '' : isLast ? '└── ' : '├── ';
		const taskLabel =
			cluster.taskIds.length === 1
				? `Task: ${cluster.taskIds[0]}`
				: `Tasks: ${cluster.taskIds.join(', ')}`;
		const parallelTag =
			cluster.taskIds.length > 1 ? chalk.green(' [parallel]') : '';

		console.log(
			`${prefix}${connector}${chalk.cyan(cluster.clusterId)} (${taskLabel})${parallelTag}`
		);

		const children = cluster.downstreamClusters
			.map((id) => clusterMap.get(id))
			.filter((c): c is ClusterMetadata => c !== undefined)
			// Only show direct children (upstream contains this cluster)
			.filter((c) => c.upstreamClusters.includes(cluster.clusterId));

		const childPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');

		for (let i = 0; i < children.length; i++) {
			const childIsLast = i === children.length - 1;
			this.renderTreeNode(
				children[i],
				clusterMap,
				childPrefix,
				childIsLast,
				false
			);
		}
	}

	/**
	 * Group clusters by their topological level (turn).
	 * Clusters at the same level can execute in parallel.
	 */
	private groupClustersByLevel(
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
	 * Build simplified Mermaid syntax using spine + skip edges.
	 *
	 * Instead of showing every cross-level edge (creates messy diamonds),
	 * reduces the DAG to:
	 *   1. A linear "spine" chain through all clusters in topological order
	 *   2. Dotted "skip edges" for dependencies not implied by the spine
	 */
	private buildMermaidSyntax(
		detection: ClusterDetectionResult,
		options?: { direction?: 'LR' | 'TD' }
	): string {
		const direction = options?.direction ?? 'TD';
		const lines: string[] = [`graph ${direction}`];

		// Step 1: Sort clusters topologically (level, then clusterId for stability)
		const sorted = [...detection.clusters].sort((a, b) => {
			if (a.level !== b.level) return a.level - b.level;
			return a.clusterId.localeCompare(b.clusterId);
		});

		// Step 2: Node definitions
		for (const cluster of sorted) {
			const count = cluster.taskIds.length;
			const mode = count > 1 ? 'parallel' : 'seq';
			const nodeId = cluster.clusterId.replaceAll('-', '_');
			lines.push(`  ${nodeId}[${cluster.clusterId} ${count} tasks ${mode}]`);
		}

		lines.push('');

		// Step 3: Build spine — linear chain connecting all clusters in order
		const spineSet = new Set<string>();
		for (let i = 0; i < sorted.length - 1; i++) {
			spineSet.add(`${sorted[i].clusterId}->${sorted[i + 1].clusterId}`);
		}

		// Step 4: Spine reachability (transitive closure of the linear chain)
		// In a linear chain A→B→C→D, every (i,j) pair where i<j is reachable
		const spineReachable = new Set<string>();
		for (let i = 0; i < sorted.length; i++) {
			for (let j = i + 1; j < sorted.length; j++) {
				spineReachable.add(`${sorted[i].clusterId}->${sorted[j].clusterId}`);
			}
		}

		// Step 5: Find skip edges — original edges not implied by the spine
		const skipEdges: Array<{ from: string; to: string }> = [];
		for (const cluster of detection.clusters) {
			for (const downstreamId of cluster.downstreamClusters) {
				const key = `${cluster.clusterId}->${downstreamId}`;
				if (!spineSet.has(key) && !spineReachable.has(key)) {
					skipEdges.push({ from: cluster.clusterId, to: downstreamId });
				}
			}
		}

		// Step 6: Emit spine as a single chained line
		if (sorted.length > 1) {
			const chain = sorted
				.map((c) => c.clusterId.replaceAll('-', '_'))
				.join(' --> ');
			lines.push(`  ${chain}`);
		}

		// Step 7: Emit skip edges as dotted lines
		for (const edge of skipEdges) {
			const fromNode = edge.from.replaceAll('-', '_');
			const toNode = edge.to.replaceAll('-', '_');
			lines.push(`  ${fromNode} -.-> ${toNode}`);
		}

		return lines.join('\n');
	}

	/**
	 * Build raw Mermaid syntax with subgraph grouping for external renderers.
	 * Groups parallel clusters in the same subgraph to show lanes clearly.
	 */
	private buildMermaidRawSyntax(detection: ClusterDetectionResult): string {
		const lines: string[] = ['graph LR'];
		const levels = this.groupClustersByLevel(detection.clusters);

		// Create subgraphs for each cluster level
		for (const [level, clusters] of [...levels.entries()].sort(
			(a, b) => a[0] - b[0]
		)) {
			lines.push(`  subgraph group_${level}[" "]`);

			for (const cluster of clusters) {
				const taskLabel = cluster.taskIds.join(', ');
				const mode = cluster.taskIds.length > 1 ? '(parallel)' : '(sequential)';
				const nodeId = cluster.clusterId.replaceAll('-', '_');
				lines.push(
					`    ${nodeId}["${cluster.clusterId}<br/>Tasks: ${taskLabel}<br/>${mode}"]`
				);
			}

			lines.push('  end');
		}

		lines.push('');

		// Only draw edges between different levels
		for (const cluster of detection.clusters) {
			const nodeId = cluster.clusterId.replaceAll('-', '_');
			for (const downstreamId of cluster.downstreamClusters) {
				const downstream = detection.clusters.find(
					(c) => c.clusterId === downstreamId
				);
				if (downstream && downstream.level !== cluster.level) {
					const downstreamNodeId = downstreamId.replaceAll('-', '_');
					lines.push(`  ${nodeId} --> ${downstreamNodeId}`);
				}
			}
		}

		return lines.join('\n');
	}

	/**
	 * Render Mermaid diagram as ASCII art in the terminal.
	 * Uses compact labels and adapts direction to terminal width.
	 */
	private renderMermaidAscii(detection: ClusterDetectionResult): void {
		const termWidth = process.stdout.columns || 120;
		const clusterCount = detection.clusters.length;

		// LR for ≤4 clusters on wide terminals; TD otherwise
		const direction = clusterCount > 4 || termWidth < 100 ? 'TD' : 'LR';

		const mermaidSyntax = this.buildMermaidSyntax(detection, { direction });
		const paddingX = termWidth < 80 ? 2 : termWidth < 120 ? 3 : 5;

		try {
			const ascii = renderMermaidAscii(mermaidSyntax, {
				paddingX,
				paddingY: 1,
				boxBorderPadding: 1
			});
			pageOutput(ascii);
		} catch {
			// Fall back to lane-based ASCII rendering
			this.renderLaneAscii(detection);
		}
	}

	/**
	 * Render a lane-based ASCII diagram grouping parallel clusters by turn.
	 * Shows turn/lane numbers on the left instead of arrows between levels.
	 * Used as fallback when beautiful-mermaid can't render the graph.
	 */
	private renderLaneAscii(detection: ClusterDetectionResult): void {
		const levels = this.groupClustersByLevel(detection.clusters);
		const sortedLevels = [...levels.entries()].sort((a, b) => a[0] - b[0]);
		const lines: string[] = [];

		for (const [level, clusters] of sortedLevels) {
			const turnLabel = chalk.dim(`Turn ${level}`);
			const parallelNote =
				clusters.length > 1
					? chalk.green(`  ⇢ ${clusters.length} parallel`)
					: '';

			lines.push(`  ${turnLabel}${parallelNote}`);

			for (const cluster of clusters) {
				const count = cluster.taskIds.length;
				const mode =
					count > 1 ? chalk.green('parallel') : chalk.gray('sequential');
				const taskList = cluster.taskIds.join(', ');

				lines.push(
					`    ${chalk.white(cluster.clusterId)} — ${count} tasks [${mode}]: ${chalk.gray(taskList)}`
				);
			}

			lines.push('');
		}

		pageOutput(lines.join('\n'));
	}

	/**
	 * Render raw Mermaid syntax (for copy-pasting into external renderers)
	 */
	private renderMermaidRaw(detection: ClusterDetectionResult): void {
		console.log(this.buildMermaidRawSyntax(detection));
	}

	/**
	 * Render JSON output
	 */
	private renderJson(detection: ClusterDetectionResult): void {
		const serializable = {
			clusters: detection.clusters.map((c) => ({
				clusterId: c.clusterId,
				level: c.level,
				taskIds: [...c.taskIds],
				upstreamClusters: [...c.upstreamClusters],
				downstreamClusters: [...c.downstreamClusters],
				status: c.status
			})),
			totalClusters: detection.totalClusters,
			totalTasks: detection.totalTasks,
			taskToCluster: Object.fromEntries(detection.taskToCluster),
			hasCircularDependencies: detection.hasCircularDependencies
		};

		console.log(JSON.stringify(serializable, null, 2));
	}

	/**
	 * Display circular dependency error
	 */
	private renderCircularDependencyError(
		detection: ClusterDetectionResult
	): void {
		console.error(chalk.red('\nCircular dependency detected!'));

		if (detection.circularDependencyPath) {
			const cycle = detection.circularDependencyPath.join(' → ');
			console.error(chalk.red(`Cycle: ${cycle}`));
		}

		console.error(
			chalk.gray(
				'\nResolve circular dependencies before clusters can be detected.'
			)
		);
		console.error(
			chalk.gray('Use: tm fix-dependencies to auto-resolve issues.')
		);
	}

	// ========== Tag-Level Rendering ==========

	private renderTagTable(detection: TagClusterResult): void {
		const usableWidth = getBoxWidth(0.95);
		// Cluster, Level, Parallel, Tags, Depends On
		const widths = [0.15, 0.1, 0.2, 0.35, 0.2];
		const colWidths = widths.map((w) =>
			Math.max(Math.floor(usableWidth * w), 8)
		);

		const table = new Table({
			head: [
				chalk.white('Cluster'),
				chalk.white('Level'),
				chalk.white('Parallel'),
				chalk.white('Tags'),
				chalk.white('Depends On')
			],
			colWidths,
			wordWrap: true,
			style: { head: [], border: ['gray'] }
		});

		for (const cluster of detection.clusters) {
			const tagCount = cluster.tags.length;
			const isParallel = tagCount > 1;
			const parallelLabel = isParallel
				? chalk.green(`Yes (${tagCount} tags)`)
				: chalk.gray(`No (1 tag)`);

			const tagList = cluster.tags.join(', ');
			const upstream =
				cluster.dependsOn.length > 0
					? cluster.dependsOn.map((l) => `Level ${l}`).join(', ')
					: chalk.gray('—');

			table.push([
				chalk.cyan(`Level ${cluster.level}`),
				String(cluster.level),
				parallelLabel,
				tagList,
				upstream
			]);
		}

		console.log(table.toString());
	}

	private renderTagTree(detection: TagClusterResult): void {
		for (let i = 0; i < detection.clusters.length; i++) {
			const cluster = detection.clusters[i];
			const isLast = i === detection.clusters.length - 1;
			const connector = isLast ? '└── ' : '├── ';
			const parallelTag =
				cluster.tags.length > 1 ? chalk.green(' [parallel]') : '';
			const tagList = cluster.tags.join(', ');

			console.log(
				`${connector}${chalk.cyan(`Level ${cluster.level}`)} (Tags: ${tagList})${parallelTag}`
			);
		}
	}

	/**
	 * Build simplified Mermaid syntax for tag clusters using spine + skip edges.
	 */
	private buildTagMermaidSyntax(
		detection: TagClusterResult,
		options?: { direction?: 'LR' | 'TD' }
	): string {
		const direction = options?.direction ?? 'TD';
		const lines: string[] = [`graph ${direction}`];

		const sorted = [...detection.clusters].sort((a, b) => a.level - b.level);

		for (const cluster of sorted) {
			const count = cluster.tags.length;
			const mode = count > 1 ? 'parallel' : 'seq';
			const nodeId = `level_${cluster.level}`;
			lines.push(`  ${nodeId}[${count} tags ${mode}]`);
		}

		lines.push('');

		// Spine chain
		if (sorted.length > 1) {
			const chain = sorted.map((c) => `level_${c.level}`).join(' --> ');
			lines.push(`  ${chain}`);
		}

		// Skip edges (deps not implied by spine)
		const spineReachable = new Set<string>();
		for (let i = 0; i < sorted.length; i++) {
			for (let j = i + 1; j < sorted.length; j++) {
				spineReachable.add(`${sorted[i].level}->${sorted[j].level}`);
			}
		}

		for (const cluster of sorted) {
			for (const depLevel of cluster.dependsOn) {
				const key = `${depLevel}->${cluster.level}`;
				if (!spineReachable.has(key)) {
					lines.push(`  level_${depLevel} -.-> level_${cluster.level}`);
				}
			}
		}

		return lines.join('\n');
	}

	private buildTagMermaidRawSyntax(detection: TagClusterResult): string {
		const lines: string[] = ['graph LR'];

		for (const cluster of detection.clusters) {
			const tagList = cluster.tags.join(', ');
			const parallelLabel =
				cluster.tags.length > 1
					? `(${cluster.tags.length} parallel)`
					: '(sequential)';
			const nodeId = `level_${cluster.level}`;

			lines.push(`  ${nodeId}["Tags: ${tagList}<br/>${parallelLabel}"]`);
		}

		lines.push('');

		for (const cluster of detection.clusters) {
			const nodeId = `level_${cluster.level}`;
			for (const depLevel of cluster.dependsOn) {
				lines.push(`  level_${depLevel} --> ${nodeId}`);
			}
		}

		return lines.join('\n');
	}

	private renderTagMermaidAscii(detection: TagClusterResult): void {
		const termWidth = process.stdout.columns || 120;
		const clusterCount = detection.clusters.length;

		const direction = clusterCount > 4 || termWidth < 100 ? 'TD' : 'LR';
		const paddingX = termWidth < 80 ? 2 : termWidth < 120 ? 3 : 5;

		const mermaidSyntax = this.buildTagMermaidSyntax(detection, { direction });

		try {
			const ascii = renderMermaidAscii(mermaidSyntax, {
				paddingX,
				paddingY: 1,
				boxBorderPadding: 1
			});
			pageOutput(ascii);
		} catch {
			// Fall back to lane-based ASCII rendering for tags
			this.renderTagLaneAscii(detection);
		}
	}

	/**
	 * Render a lane-based ASCII diagram for tag-level clusters.
	 * Shows turn/lane numbers on the left instead of arrows between levels.
	 */
	private renderTagLaneAscii(detection: TagClusterResult): void {
		const lines: string[] = [];

		for (const cluster of detection.clusters) {
			const turnLabel = chalk.dim(`Turn ${cluster.level}`);
			const parallelNote =
				cluster.tags.length > 1
					? chalk.green(`  ⇢ ${cluster.tags.length} parallel`)
					: '';

			lines.push(`  ${turnLabel}${parallelNote}`);

			for (const tag of cluster.tags) {
				lines.push(`    ${chalk.white(tag)}`);
			}

			lines.push('');
		}

		pageOutput(lines.join('\n'));
	}

	private renderTagMermaidRaw(detection: TagClusterResult): void {
		console.log(this.buildTagMermaidRawSyntax(detection));
	}

	private renderTagJson(detection: TagClusterResult): void {
		console.log(JSON.stringify(detection, null, 2));
	}

	private getStatusColor(status: string): string {
		switch (status) {
			case 'ready':
				return chalk.green(status);
			case 'in-progress':
				return chalk.yellow(status);
			case 'done':
			case 'delivered':
				return chalk.blue(status);
			case 'failed':
				return chalk.red(status);
			case 'blocked':
				return chalk.red(status);
			default:
				return chalk.gray(status);
		}
	}

	/**
	 * Register this command on an existing program
	 */
	static register(program: Command, name?: string): ClustersCommand {
		const clustersCommand = new ClustersCommand(name);
		program.addCommand(clustersCommand);
		return clustersCommand;
	}
}
