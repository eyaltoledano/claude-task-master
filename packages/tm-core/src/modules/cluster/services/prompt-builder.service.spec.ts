import { describe, expect, it } from 'vitest';
import {
	PromptBuilderService,
	type PromptContext
} from './prompt-builder.service.js';
import type { ClusterMetadata } from '../types.js';
import type { Task } from '../../../common/types/index.js';

function createTestTask(
	overrides: Partial<Task> & { id: string; title: string }
): Task {
	return {
		description: '',
		status: 'pending',
		priority: 'medium',
		dependencies: [],
		details: '',
		testStrategy: '',
		subtasks: [],
		...overrides
	} as Task;
}

function createTestCluster(
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

function buildContext(
	overrides: Partial<PromptContext> = {}
): PromptContext {
	return {
		projectPath: '/test/project',
		tag: 'sprint-1',
		clusters: [],
		tasks: [],
		totalClusters: 0,
		totalTasks: 0,
		checkpointPath:
			'/test/project/.taskmaster/execution/sprint-1/checkpoint.json',
		...overrides
	};
}

describe('PromptBuilderService', () => {
	const builder = new PromptBuilderService();

	it('should include project metadata in the header', () => {
		const context = buildContext({
			projectPath: '/my/project',
			tag: 'auth-feature',
			totalClusters: 3,
			totalTasks: 7
		});

		const prompt = builder.buildPrompt(context);

		expect(prompt).toContain('**Project**: /my/project');
		expect(prompt).toContain('**Tag**: auth-feature');
		expect(prompt).toContain('**Clusters**: 3');
		expect(prompt).toContain('**Tasks**: 7');
	});

	it('should include the checkpoint path', () => {
		const context = buildContext({
			checkpointPath: '/my/checkpoint.json'
		});

		const prompt = builder.buildPrompt(context);

		expect(prompt).toContain('**Checkpoint**: /my/checkpoint.json');
	});

	it('should group clusters by level in the execution plan', () => {
		const clusters = [
			createTestCluster({
				clusterId: 'cluster-0',
				level: 0,
				taskIds: ['1', '2']
			}),
			createTestCluster({
				clusterId: 'cluster-1',
				level: 1,
				taskIds: ['3'],
				upstreamClusters: ['cluster-0']
			})
		];

		const context = buildContext({
			clusters,
			totalClusters: 2,
			totalTasks: 3
		});

		const prompt = builder.buildPrompt(context);

		expect(prompt).toContain('### Level 0');
		expect(prompt).toContain('### Level 1');
		expect(prompt).toContain('**cluster-0**: Tasks [1, 2]');
		expect(prompt).toContain('**cluster-1**: Tasks [3]');
		expect(prompt).toContain('Depends on: cluster-0');
	});

	it('should mark parallel levels', () => {
		const clusters = [
			createTestCluster({ clusterId: 'cluster-0a', level: 0, taskIds: ['1'] }),
			createTestCluster({ clusterId: 'cluster-0b', level: 0, taskIds: ['2'] })
		];

		const context = buildContext({ clusters, totalClusters: 2, totalTasks: 2 });

		const prompt = builder.buildPrompt(context);

		expect(prompt).toContain('### Level 0 (parallel)');
	});

	it('should include full task details', () => {
		const tasks = [
			createTestTask({
				id: '1',
				title: 'Setup auth',
				description: 'Implement JWT auth',
				details: 'Use bcrypt for hashing',
				testStrategy: 'Unit test auth service',
				dependencies: ['0'],
				priority: 'high',
				subtasks: [
					{
						id: 1,
						parentId: '1',
						title: 'Create auth middleware',
						status: 'pending',
						description: '',
						priority: 'medium',
						dependencies: [],
						details: '',
						testStrategy: ''
					} as any
				]
			})
		];

		const clusters = [
			createTestCluster({ clusterId: 'cluster-0', level: 0, taskIds: ['1'] })
		];

		const context = buildContext({
			clusters,
			tasks,
			totalClusters: 1,
			totalTasks: 1
		});

		const prompt = builder.buildPrompt(context);

		expect(prompt).toContain('#### Task 1: Setup auth');
		expect(prompt).toContain('**Description**: Implement JWT auth');
		expect(prompt).toContain(
			'**Implementation Details**:\nUse bcrypt for hashing'
		);
		expect(prompt).toContain('**Test Strategy**:\nUnit test auth service');
		expect(prompt).toContain('**Dependencies**: 0');
		expect(prompt).toContain('[pending] 1: Create auth middleware');
		expect(prompt).toContain('**Status**: pending | **Priority**: high');
	});

	it('should skip empty optional fields', () => {
		const tasks = [createTestTask({ id: '1', title: 'Simple task' })];
		const clusters = [
			createTestCluster({ clusterId: 'cluster-0', level: 0, taskIds: ['1'] })
		];

		const context = buildContext({
			clusters,
			tasks,
			totalClusters: 1,
			totalTasks: 1
		});
		const prompt = builder.buildPrompt(context);

		expect(prompt).not.toContain('**Implementation Details**');
		expect(prompt).not.toContain('**Test Strategy**');
		expect(prompt).not.toContain('**Dependencies**');
		expect(prompt).not.toContain('**Subtasks**');
	});

	it('should include execution instructions with level count', () => {
		const clusters = [
			createTestCluster({ clusterId: 'cluster-0', level: 0, taskIds: ['1'] }),
			createTestCluster({ clusterId: 'cluster-1', level: 1, taskIds: ['2'] }),
			createTestCluster({ clusterId: 'cluster-2', level: 2, taskIds: ['3'] })
		];

		const context = buildContext({
			clusters,
			tag: 'my-tag',
			totalClusters: 3,
			totalTasks: 3
		});

		const prompt = builder.buildPrompt(context);

		expect(prompt).toContain('3 execution level(s)');
		expect(prompt).toContain(
			'tm set-status --id=<task-id> --status=done --tag my-tag'
		);
	});

	it('should include delegate mode instructions', () => {
		const context = buildContext();
		const prompt = builder.buildPrompt(context);

		expect(prompt).toContain('delegate mode');
		expect(prompt).toContain('do NOT implement tasks yourself');
	});

	it('should include TeamCreate and TaskCreate instructions', () => {
		const context = buildContext({ totalTasks: 5 });
		const prompt = builder.buildPrompt(context);

		expect(prompt).toContain('TeamCreate');
		expect(prompt).toContain('TaskCreate');
		expect(prompt).toContain('5 task(s)');
	});

	it('should include teammate spawning and shutdown instructions', () => {
		const context = buildContext();
		const prompt = builder.buildPrompt(context);

		expect(prompt).toContain('spawn one teammate per task');
		expect(prompt).toContain('shutdown_request');
		expect(prompt).toContain('TeamDelete');
	});

	it('should include rules section with delegate mode rule', () => {
		const context = buildContext();
		const prompt = builder.buildPrompt(context);

		expect(prompt).toContain('## Rules');
		expect(prompt).toContain('CLAUDE.md');
		expect(prompt).toContain('atomic commits');
		expect(prompt).toContain('coordinate and review only');
	});

	it('should handle tasks not found in task map gracefully', () => {
		const clusters = [
			createTestCluster({
				clusterId: 'cluster-0',
				level: 0,
				taskIds: ['1', '99']
			})
		];
		const tasks = [createTestTask({ id: '1', title: 'Only task' })];

		const context = buildContext({
			clusters,
			tasks,
			totalClusters: 1,
			totalTasks: 2
		});

		// Should not throw
		const prompt = builder.buildPrompt(context);

		expect(prompt).toContain('#### Task 1: Only task');
		expect(prompt).not.toContain('Task 99');
	});

	it('should handle empty clusters and tasks without crashing', () => {
		const context = buildContext({
			clusters: [],
			tasks: [],
			totalClusters: 0,
			totalTasks: 0
		});

		const prompt = builder.buildPrompt(context);

		expect(prompt).toContain('0 execution level(s)');
		expect(prompt).not.toContain('### Level');
	});

	it('should list all cluster IDs at the same level', () => {
		const clusters = [
			createTestCluster({
				clusterId: 'cluster-0a',
				level: 0,
				taskIds: ['1']
			}),
			createTestCluster({
				clusterId: 'cluster-0b',
				level: 0,
				taskIds: ['2']
			})
		];

		const context = buildContext({
			clusters,
			totalClusters: 2,
			totalTasks: 2
		});

		const prompt = builder.buildPrompt(context);

		expect(prompt).toContain('**cluster-0a**: Tasks [1]');
		expect(prompt).toContain('**cluster-0b**: Tasks [2]');
	});

	it('should not show Depends on when upstreamClusters is empty at non-zero levels', () => {
		const clusters = [
			createTestCluster({
				clusterId: 'cluster-1',
				level: 1,
				upstreamClusters: []
			})
		];

		const context = buildContext({
			clusters,
			totalClusters: 1,
			totalTasks: 0
		});

		const prompt = builder.buildPrompt(context);

		expect(prompt).toContain('### Level 1');
		expect(prompt).not.toContain('Depends on');
	});

	it('should include details but omit testStrategy when only details is set', () => {
		const tasks = [
			createTestTask({
				id: '1',
				title: 'Detailed task',
				description: 'desc',
				details: 'some impl',
				testStrategy: ''
			})
		];
		const clusters = [
			createTestCluster({
				clusterId: 'cluster-0',
				level: 0,
				taskIds: ['1']
			})
		];

		const context = buildContext({
			clusters,
			tasks,
			totalClusters: 1,
			totalTasks: 1
		});

		const prompt = builder.buildPrompt(context);

		expect(prompt).toContain('**Implementation Details**');
		expect(prompt).not.toContain('**Test Strategy**');
	});

	it('should render sections in correct order', () => {
		const tasks = [
			createTestTask({ id: '1', title: 'Task one' })
		];
		const clusters = [
			createTestCluster({
				clusterId: 'cluster-0',
				level: 0,
				taskIds: ['1']
			})
		];

		const context = buildContext({
			clusters,
			tasks,
			totalClusters: 1,
			totalTasks: 1
		});

		const prompt = builder.buildPrompt(context);

		const headerIdx = prompt.indexOf('# Cluster Execution Session');
		const planIdx = prompt.indexOf('## Execution Plan');
		const detailsIdx = prompt.indexOf('## Task Details');
		const instructionsIdx = prompt.indexOf('## Execution Instructions');
		const rulesIdx = prompt.indexOf('## Rules');

		expect(headerIdx).toBeGreaterThanOrEqual(0);
		expect(planIdx).toBeGreaterThan(headerIdx);
		expect(detailsIdx).toBeGreaterThan(planIdx);
		expect(instructionsIdx).toBeGreaterThan(detailsIdx);
		expect(rulesIdx).toBeGreaterThan(instructionsIdx);
	});
});
