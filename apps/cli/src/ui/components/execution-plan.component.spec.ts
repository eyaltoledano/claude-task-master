import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionPlan, ClusterMetadata } from '@tm/core';
import { displayExecutionPlan } from './execution-plan.component.js';

function createCluster(
	overrides: Partial<ClusterMetadata> & { clusterId: string }
): ClusterMetadata {
	return {
		level: 0,
		taskIds: [],
		upstreamClusters: [],
		downstreamClusters: [],
		status: 'ready',
		...overrides
	};
}

function buildPlan(overrides: Partial<ExecutionPlan> = {}): ExecutionPlan {
	return {
		tag: 'test-tag',
		clusters: [],
		tasks: [],
		totalClusters: 0,
		totalTasks: 0,
		estimatedTurns: 0,
		hasResumableCheckpoint: false,
		checkpointPath: '/test/.taskmaster/execution/test-tag/checkpoint.json',
		...overrides
	};
}

describe('displayExecutionPlan', () => {
	let consoleOutput: string[];

	beforeEach(() => {
		consoleOutput = [];
		vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
			consoleOutput.push(args.map(String).join(' '));
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should render JSON output when json=true', () => {
		const plan = buildPlan({
			tag: 'sprint-1',
			totalClusters: 2,
			totalTasks: 5,
			estimatedTurns: 2
		});

		displayExecutionPlan(plan, { json: true });

		const output = consoleOutput.join('\n');
		const parsed = JSON.parse(output);
		expect(parsed.tag).toBe('sprint-1');
		expect(parsed.totalClusters).toBe(2);
		expect(parsed.totalTasks).toBe(5);
		expect(parsed.estimatedTurns).toBe(2);
	});

	it('should render boxed text output for clusters', () => {
		const clusters = [
			createCluster({ clusterId: 'cluster-0', level: 0, taskIds: ['1', '2'] }),
			createCluster({ clusterId: 'cluster-1', level: 1, taskIds: ['3'] })
		];

		const plan = buildPlan({
			clusters,
			totalClusters: 2,
			totalTasks: 3,
			estimatedTurns: 2
		});

		displayExecutionPlan(plan);

		const output = consoleOutput.join('\n');
		expect(output).toContain('cluster-0');
		expect(output).toContain('cluster-1');
		expect(output).toContain('EXECUTION PLAN');
	});

	it('should show checkpoint resume info when available', () => {
		const plan = buildPlan({
			hasResumableCheckpoint: true,
			checkpointInfo: {
				completedClusters: 2,
				completedTasks: 5,
				timestamp: new Date('2024-01-15T10:00:00Z')
			}
		});

		displayExecutionPlan(plan);

		const output = consoleOutput.join('\n');
		expect(output).toContain('Resuming from checkpoint');
		expect(output).toContain('2 clusters');
		expect(output).toContain('5 tasks completed');
	});

	it('should include JSON checkpoint info', () => {
		const plan = buildPlan({
			hasResumableCheckpoint: true,
			checkpointInfo: {
				completedClusters: 1,
				completedTasks: 3,
				timestamp: new Date('2024-01-15T10:00:00Z')
			}
		});

		displayExecutionPlan(plan, { json: true });

		const parsed = JSON.parse(consoleOutput.join('\n'));
		expect(parsed.checkpointInfo.completedClusters).toBe(1);
		expect(parsed.checkpointInfo.completedTasks).toBe(3);
	});

	it('should show [parallel] when multiple clusters share a level', () => {
		const clusters = [
			createCluster({
				clusterId: 'c-0a',
				level: 0,
				taskIds: ['1']
			}),
			createCluster({
				clusterId: 'c-0b',
				level: 0,
				taskIds: ['2']
			})
		];

		const plan = buildPlan({
			clusters,
			totalClusters: 2,
			totalTasks: 2,
			estimatedTurns: 1
		});

		displayExecutionPlan(plan);

		const output = consoleOutput.join('\n');
		expect(output).toContain('[parallel]');
	});

	it('should NOT show [parallel] for single-cluster levels', () => {
		const clusters = [
			createCluster({
				clusterId: 'c-solo',
				level: 0,
				taskIds: ['1', '2']
			})
		];

		const plan = buildPlan({
			clusters,
			totalClusters: 1,
			totalTasks: 2,
			estimatedTurns: 1
		});

		displayExecutionPlan(plan);

		const output = consoleOutput.join('\n');
		expect(output).not.toContain('[parallel]');
	});

	it('should show "all sequential" in summary when no parallel levels', () => {
		const clusters = [
			createCluster({ clusterId: 'c-0', level: 0, taskIds: ['1'] }),
			createCluster({ clusterId: 'c-1', level: 1, taskIds: ['2'] }),
			createCluster({ clusterId: 'c-2', level: 2, taskIds: ['3'] })
		];

		const plan = buildPlan({
			clusters,
			totalClusters: 3,
			totalTasks: 3,
			estimatedTurns: 3
		});

		displayExecutionPlan(plan);

		const output = consoleOutput.join('\n');
		expect(output).toContain('all sequential');
	});

	it('should show parallel count in summary', () => {
		const clusters = [
			createCluster({ clusterId: 'c-0a', level: 0, taskIds: ['1'] }),
			createCluster({ clusterId: 'c-0b', level: 0, taskIds: ['2'] }),
			createCluster({ clusterId: 'c-1', level: 1, taskIds: ['3'] })
		];

		const plan = buildPlan({
			clusters,
			totalClusters: 3,
			totalTasks: 3,
			estimatedTurns: 2
		});

		displayExecutionPlan(plan);

		const output = consoleOutput.join('\n');
		expect(output).toContain('1 parallel');
	});

	it('should render clusters in level order regardless of input order', () => {
		const clusters = [
			createCluster({ clusterId: 'c-2', level: 2, taskIds: ['5'] }),
			createCluster({ clusterId: 'c-0', level: 0, taskIds: ['1'] }),
			createCluster({ clusterId: 'c-1', level: 1, taskIds: ['3'] })
		];

		const plan = buildPlan({
			clusters,
			totalClusters: 3,
			totalTasks: 3,
			estimatedTurns: 3
		});

		displayExecutionPlan(plan);

		const output = consoleOutput.join('\n');
		const turn0Pos = output.indexOf('Turn  0');
		const turn1Pos = output.indexOf('Turn  1');
		const turn2Pos = output.indexOf('Turn  2');

		expect(turn0Pos).toBeGreaterThan(-1);
		expect(turn1Pos).toBeGreaterThan(-1);
		expect(turn2Pos).toBeGreaterThan(-1);
		expect(turn0Pos).toBeLessThan(turn1Pos);
		expect(turn1Pos).toBeLessThan(turn2Pos);
	});

	it('should render without crashing when clusters is empty', () => {
		const plan = buildPlan({
			clusters: [],
			totalClusters: 0,
			totalTasks: 0,
			estimatedTurns: 0
		});

		expect(() => displayExecutionPlan(plan)).not.toThrow();

		const output = consoleOutput.join('\n');
		expect(output).toContain('EXECUTION PLAN');
	});

	it('should serialize clusters correctly in JSON mode', () => {
		const clusters = [
			createCluster({
				clusterId: 'alpha',
				level: 0,
				taskIds: ['1', '2'],
				upstreamClusters: [],
				status: 'ready'
			}),
			createCluster({
				clusterId: 'beta',
				level: 1,
				taskIds: ['3'],
				upstreamClusters: ['alpha'],
				status: 'pending'
			})
		];

		const plan = buildPlan({
			clusters,
			totalClusters: 2,
			totalTasks: 3,
			estimatedTurns: 2
		});

		displayExecutionPlan(plan, { json: true });

		const parsed = JSON.parse(consoleOutput.join('\n'));
		expect(parsed.clusters).toHaveLength(2);

		const first = parsed.clusters[0];
		expect(first.clusterId).toBe('alpha');
		expect(first.level).toBe(0);
		expect(first.taskIds).toEqual(['1', '2']);
		expect(first.upstreamClusters).toEqual([]);
		expect(first.status).toBe('ready');

		const second = parsed.clusters[1];
		expect(second.clusterId).toBe('beta');
		expect(second.level).toBe(1);
		expect(second.taskIds).toEqual(['3']);
		expect(second.upstreamClusters).toEqual(['alpha']);
		expect(second.status).toBe('pending');
	});
});
