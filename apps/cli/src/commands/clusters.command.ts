/**
 * @fileoverview Clusters command for visualizing task execution clusters
 * Extends Commander.Command to display cluster detection results from @tm/core
 */

import {
	ClusterDetectionService,
	TagClusterService,
	createTmCore,
	type ClusterDetectionResult,
	type ClusterMetadata,
	type TagClusterResult,
	type TmCore
} from '@tm/core';
import { renderMermaidAscii } from 'beautiful-mermaid';
import chalk from 'chalk';
import Table from 'cli-table3';
import { Command } from 'commander';
import { displayCommandHeader } from '../utils/display-helpers.js';
import { displayError } from '../utils/error-handler.js';
import { getProjectRoot } from '../utils/project-root.js';

/**
 * Options interface for the clusters command
 */
interface ClustersCommandOptions {
	tag?: string;
	tree?: boolean;
	diagram?: string;
	json?: boolean;
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

		this.description('Detect and visualize task execution clusters')
			.option('-t, --tag <tag>', 'Show clusters for a specific tag')
			.option('--tree', 'Display clusters as an ASCII dependency tree')
			.option(
				'--diagram <type>',
				'Output a diagram (supported: mermaid, mermaid-raw)'
			)
			.option('--json', 'Output raw cluster detection result as JSON')
			.option(
				'-p, --project <path>',
				'Project root directory (auto-detected if not provided)'
			)
			.action(async (options: ClustersCommandOptions) => {
				await this.executeCommand(options);
			});
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
			process.exit(1);
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
			console.error(
				chalk.red(`Unsupported diagram type: ${options.diagram}`)
			);
			console.error(chalk.gray('Supported types: mermaid, mermaid-raw'));
			process.exit(1);
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

		if (detection.clusters.length === 1 && detection.clusters[0].dependsOn.length === 0) {
			console.log(
				chalk.gray(
					'  All tags are independent (no inter-tag dependencies defined).\n' +
						'  Define tag dependencies with `tm tags add-dep` to see sequential ordering.\n'
				)
			);
		}

		if (options.tree) {
			this.renderTagTree(detection);
		} else if (options.diagram === 'mermaid') {
			this.renderTagMermaidAscii(detection);
		} else if (options.diagram === 'mermaid-raw') {
			this.renderTagMermaidRaw(detection);
		} else if (options.diagram) {
			console.error(
				chalk.red(`Unsupported diagram type: ${options.diagram}`)
			);
			console.error(chalk.gray('Supported types: mermaid, mermaid-raw'));
			process.exit(1);
		} else {
			this.renderTagTable(detection);
		}
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
		const table = new Table({
			head: [
				chalk.white('Cluster'),
				chalk.white('Level'),
				chalk.white('Parallel'),
				chalk.white('Tasks'),
				chalk.white('Depends On'),
				chalk.white('Status')
			],
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

		const clusterMap = new Map(
			detection.clusters.map((c) => [c.clusterId, c])
		);

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
	 * Build compact Mermaid syntax for ASCII rendering.
	 * Labels show cluster ID + task count only (no individual IDs)
	 * since beautiful-mermaid doesn't support multiline labels.
	 */
	private buildMermaidSyntax(
		detection: ClusterDetectionResult,
		options?: { direction?: 'LR' | 'TD' }
	): string {
		const direction = options?.direction ?? 'TD';
		const lines: string[] = [`graph ${direction}`];

		for (const cluster of detection.clusters) {
			const count = cluster.taskIds.length;
			const mode = count > 1 ? 'parallel' : 'seq';
			const nodeId = cluster.clusterId.replace('-', '_');

			lines.push(`  ${nodeId}[${cluster.clusterId} ${count} tasks ${mode}]`);
		}

		lines.push('');

		for (const cluster of detection.clusters) {
			const nodeId = cluster.clusterId.replace('-', '_');
			for (const downstreamId of cluster.downstreamClusters) {
				const downstreamNodeId = downstreamId.replace('-', '_');
				lines.push(`  ${nodeId} --> ${downstreamNodeId}`);
			}
		}

		return lines.join('\n');
	}

	/**
	 * Build raw Mermaid syntax with full multiline labels (for external renderers).
	 */
	private buildMermaidRawSyntax(
		detection: ClusterDetectionResult
	): string {
		const lines: string[] = ['graph LR'];

		for (const cluster of detection.clusters) {
			const taskLabel = cluster.taskIds.join(', ');
			const parallelLabel =
				cluster.taskIds.length > 1 ? '(parallel)' : '(sequential)';
			const nodeId = cluster.clusterId.replace('-', '_');

			lines.push(
				`  ${nodeId}["${cluster.clusterId}<br/>Tasks: ${taskLabel}<br/>${parallelLabel}"]`
			);
		}

		lines.push('');

		for (const cluster of detection.clusters) {
			const nodeId = cluster.clusterId.replace('-', '_');
			for (const downstreamId of cluster.downstreamClusters) {
				const downstreamNodeId = downstreamId.replace('-', '_');
				lines.push(`  ${nodeId} --> ${downstreamNodeId}`);
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
		const direction =
			clusterCount > 4 || termWidth < 100 ? 'TD' : 'LR';

		const mermaidSyntax = this.buildMermaidSyntax(detection, { direction });
		const paddingX = termWidth < 80 ? 2 : termWidth < 120 ? 3 : 5;

		try {
			const ascii = renderMermaidAscii(mermaidSyntax, {
				paddingX,
				paddingY: 1,
				boxBorderPadding: 1
			});
			console.log(ascii);
		} catch {
			console.error(
				chalk.yellow(
					'Could not render as ASCII. Falling back to raw Mermaid syntax:\n'
				)
			);
			console.log(this.buildMermaidRawSyntax(detection));
		}
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
		const table = new Table({
			head: [
				chalk.white('Cluster'),
				chalk.white('Level'),
				chalk.white('Parallel'),
				chalk.white('Tags'),
				chalk.white('Depends On')
			],
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

	private buildTagMermaidSyntax(
		detection: TagClusterResult,
		options?: { direction?: 'LR' | 'TD' }
	): string {
		const direction = options?.direction ?? 'TD';
		const lines: string[] = [`graph ${direction}`];

		for (const cluster of detection.clusters) {
			const count = cluster.tags.length;
			const mode = count > 1 ? 'parallel' : 'seq';
			const nodeId = `level_${cluster.level}`;

			lines.push(`  ${nodeId}[Level ${cluster.level} ${count} tags ${mode}]`);
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

	private buildTagMermaidRawSyntax(detection: TagClusterResult): string {
		const lines: string[] = ['graph LR'];

		for (const cluster of detection.clusters) {
			const tagList = cluster.tags.join(', ');
			const parallelLabel =
				cluster.tags.length > 1 ? '(parallel)' : '(sequential)';
			const nodeId = `level_${cluster.level}`;

			lines.push(
				`  ${nodeId}["Level ${cluster.level}<br/>Tags: ${tagList}<br/>${parallelLabel}"]`
			);
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

		const direction =
			clusterCount > 4 || termWidth < 100 ? 'TD' : 'LR';
		const paddingX = termWidth < 80 ? 2 : termWidth < 120 ? 3 : 5;

		const mermaidSyntax = this.buildTagMermaidSyntax(detection, { direction });

		try {
			const ascii = renderMermaidAscii(mermaidSyntax, {
				paddingX,
				paddingY: 1,
				boxBorderPadding: 1
			});
			console.log(ascii);
		} catch {
			console.error(
				chalk.yellow(
					'Could not render as ASCII. Falling back to raw Mermaid syntax:\n'
				)
			);
			console.log(this.buildTagMermaidRawSyntax(detection));
		}
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
