/**
 * @fileoverview Tests for cluster pipeline visualization component
 */

import type { ClusterDetectionResult, ClusterMetadata, Task } from '@tm/core';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { displayClusterPipeline } from './cluster-pipeline.component.js';

const createTask = (id: number, status: string = 'pending'): Task => ({
	id: String(id),
	title: `Task ${id}`,
	description: '',
	status: status as any,
	priority: 'medium',
	dependencies: [],
	details: '',
	testStrategy: '',
	subtasks: []
});

const createCluster = (
	level: number,
	taskIds: string[],
	overrides: Partial<ClusterMetadata> = {}
): ClusterMetadata => ({
	clusterId: `cluster-${level}`,
	level,
	taskIds,
	upstreamClusters: level > 0 ? [`cluster-${level - 1}`] : [],
	downstreamClusters: [],
	status: level === 0 ? 'ready' : 'pending',
	...overrides
});

const createDetection = (
	clusters: ClusterMetadata[]
): ClusterDetectionResult => {
	const taskToCluster = new Map<string, string>();
	for (const cluster of clusters) {
		for (const taskId of cluster.taskIds) {
			taskToCluster.set(taskId, cluster.clusterId);
		}
	}
	const totalTasks = clusters.reduce((sum, c) => sum + c.taskIds.length, 0);
	return {
		clusters,
		totalClusters: clusters.length,
		totalTasks,
		taskToCluster,
		hasCircularDependencies: false
	};
};

describe('cluster-pipeline.component', () => {
	let consoleSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		// Provide a stable terminal width for tests
		vi.stubGlobal('process', {
			...process,
			stdout: { ...process.stdout, columns: 100 }
		});
	});

	afterEach(() => {
		consoleSpy.mockRestore();
		vi.unstubAllGlobals();
	});

	it('should render a pipeline with sequential clusters', () => {
		const tasks = [createTask(1, 'done'), createTask(2), createTask(3)];
		const detection = createDetection([
			createCluster(0, ['1']),
			createCluster(1, ['2']),
			createCluster(2, ['3'])
		]);

		displayClusterPipeline(detection, tasks);

		expect(consoleSpy).toHaveBeenCalledTimes(1);
		const output = consoleSpy.mock.calls[0][0] as string;

		// Should contain pipeline title
		expect(output).toContain('EXECUTION PIPELINE');
		// Should contain turn labels
		expect(output).toContain('Turn');
		// Should contain cluster IDs
		expect(output).toContain('cluster-0');
		expect(output).toContain('cluster-1');
		expect(output).toContain('cluster-2');
		// Should contain summary
		expect(output).toContain('3 clusters');
		expect(output).toContain('3 turns');
		// Should show call to action
		expect(output).toContain('tm clusters');
		// Should NOT contain arrows between turns (lane-based display instead)
		expect(output).not.toContain('↓');
	});

	it('should show progress indicators for completed tasks', () => {
		const tasks = [createTask(1, 'done'), createTask(2, 'done'), createTask(3)];
		const detection = createDetection([
			createCluster(0, ['1', '2']),
			createCluster(1, ['3'])
		]);

		displayClusterPipeline(detection, tasks);

		const output = consoleSpy.mock.calls[0][0] as string;
		// Should show 2/2 for cluster-0 (both done)
		expect(output).toContain('2/2');
	});

	it('should show parallel indicator for clusters at the same level', () => {
		const tasks = [
			createTask(1, 'done'),
			createTask(2),
			createTask(3),
			createTask(4)
		];
		const detection = createDetection([
			createCluster(0, ['1']),
			{
				...createCluster(1, ['2', '3'], { clusterId: 'cluster-1a' }),
				clusterId: 'cluster-1a'
			},
			{
				...createCluster(1, ['4'], { clusterId: 'cluster-1b' }),
				clusterId: 'cluster-1b'
			},
			createCluster(2, ['4'])
		]);

		// Ensure two clusters have the same level for parallel
		detection.clusters[1] = {
			...detection.clusters[1],
			level: 1,
			clusterId: 'cluster-1a'
		};
		detection.clusters[2] = {
			...detection.clusters[2],
			level: 1,
			clusterId: 'cluster-1b'
		};

		displayClusterPipeline(detection, tasks);

		const output = consoleSpy.mock.calls[0][0] as string;
		// Should show parallel indicator
		expect(output).toContain('parallel');
		// Should show both clusters on same line with separator
		expect(output).toContain('cluster-1a');
		expect(output).toContain('cluster-1b');
	});

	it('should include tag argument in call to action when tag is provided', () => {
		const tasks = [createTask(1)];
		const detection = createDetection([createCluster(0, ['1'])]);

		displayClusterPipeline(detection, tasks, 'my-tag');

		const output = consoleSpy.mock.calls[0][0] as string;
		expect(output).toContain('tm clusters --tag my-tag');
	});

	it('should cap progress blocks at 8 for large clusters', () => {
		const tasks = Array.from({ length: 12 }, (_, i) => createTask(i + 1));
		const taskIds = tasks.map((t) => String(t.id));
		const detection = createDetection([createCluster(0, taskIds)]);

		displayClusterPipeline(detection, tasks);

		const output = consoleSpy.mock.calls[0][0] as string;
		// Should contain the ellipsis indicator for >8 tasks
		expect(output).toContain('…');
		// Should show the count
		expect(output).toContain('12');
	});

	it('should skip subtask IDs when calculating progress', () => {
		const tasks = [createTask(1, 'done'), createTask(2)];
		// Cluster contains task IDs and subtask IDs
		const detection = createDetection([
			createCluster(0, ['1', '1.1', '1.2', '2'])
		]);

		displayClusterPipeline(detection, tasks);

		const output = consoleSpy.mock.calls[0][0] as string;
		// Should only count top-level tasks: 1/2 (task 1 done, task 2 pending)
		expect(output).toContain('1/2');
	});
});
