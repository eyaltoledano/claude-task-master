import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { ClusterExecutionDomain } from './cluster-execution-domain.js';
import type { ConfigManager } from '../config/managers/config-manager.js';
import type { TasksDomain } from '../tasks/tasks-domain.js';
import type { Task } from '../../common/types/index.js';

// Mock fs for checkpoint tests
vi.mock('node:fs', async (importOriginal) => {
	const actual = await importOriginal<typeof import('node:fs')>();
	return {
		...actual,
		promises: {
			...actual.promises,
			mkdir: vi.fn().mockResolvedValue(undefined),
			writeFile: vi.fn().mockResolvedValue(undefined),
			rename: vi.fn().mockResolvedValue(undefined),
			readFile: vi
				.fn()
				.mockRejectedValue(
					Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
				),
			unlink: vi.fn().mockResolvedValue(undefined)
		}
	};
});

function createTask(id: string, deps: string[] = []): Task {
	return {
		id,
		title: `Task ${id}`,
		description: `Description for task ${id}`,
		status: 'pending',
		priority: 'medium',
		dependencies: deps,
		details: '',
		testStrategy: '',
		subtasks: []
	} as Task;
}

function createMockConfigManager(
	projectRoot = '/test/project',
	activeTag = 'master'
): ConfigManager {
	return {
		getProjectRoot: () => projectRoot,
		getActiveTag: vi.fn().mockReturnValue(activeTag)
	} as unknown as ConfigManager;
}

function createMockTasksDomain(tasks: Task[] = []): TasksDomain {
	return {
		list: vi.fn().mockResolvedValue({ tasks, total: tasks.length })
	} as unknown as TasksDomain;
}

describe('ClusterExecutionDomain', () => {
	let domain: ClusterExecutionDomain;
	let mockTasksDomain: TasksDomain;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('buildExecutionPlan', () => {
		it('should return an empty plan when no tasks exist', async () => {
			mockTasksDomain = createMockTasksDomain([]);
			domain = new ClusterExecutionDomain(
				createMockConfigManager(),
				mockTasksDomain
			);

			const plan = await domain.buildExecutionPlan({ tag: 'empty-tag' });

			expect(plan.tag).toBe('empty-tag');
			expect(plan.clusters).toEqual([]);
			expect(plan.totalClusters).toBe(0);
			expect(plan.totalTasks).toBe(0);
			expect(plan.estimatedTurns).toBe(0);
			expect(plan.hasResumableCheckpoint).toBe(false);
		});

		it('should default to active tag from configManager when none provided', async () => {
			mockTasksDomain = createMockTasksDomain([]);
			const mockConfig = createMockConfigManager('/test/project', 'master');
			domain = new ClusterExecutionDomain(mockConfig, mockTasksDomain);

			const plan = await domain.buildExecutionPlan();

			expect(mockConfig.getActiveTag).toHaveBeenCalled();
			expect(plan.tag).toBe('master');
			expect(mockTasksDomain.list).toHaveBeenCalledWith({
				tag: 'master',
				includeSubtasks: true
			});
		});

		it('should use configManager active tag when no tag option is provided', async () => {
			mockTasksDomain = createMockTasksDomain([]);
			const mockConfig = createMockConfigManager(
				'/test/project',
				'my-feature'
			);
			domain = new ClusterExecutionDomain(mockConfig, mockTasksDomain);

			const plan = await domain.buildExecutionPlan();

			expect(mockConfig.getActiveTag).toHaveBeenCalled();
			expect(plan.tag).toBe('my-feature');
			expect(mockTasksDomain.list).toHaveBeenCalledWith({
				tag: 'my-feature',
				includeSubtasks: true
			});
		});

		it('should detect clusters from tasks', async () => {
			const tasks = [
				createTask('1'),
				createTask('2'),
				createTask('3', ['1', '2'])
			];

			mockTasksDomain = createMockTasksDomain(tasks);
			domain = new ClusterExecutionDomain(
				createMockConfigManager(),
				mockTasksDomain
			);

			const plan = await domain.buildExecutionPlan({ tag: 'sprint-1' });

			expect(plan.tag).toBe('sprint-1');
			expect(plan.totalTasks).toBe(3);
			expect(plan.totalClusters).toBeGreaterThan(0);
			expect(plan.estimatedTurns).toBe(2); // level 0 (tasks 1,2), level 1 (task 3)
			expect(plan.clusters.length).toBeGreaterThan(0);
			expect(plan.tasks).toEqual(tasks);
		});

		it('should throw on circular dependencies', async () => {
			// Tasks with circular deps: 1 -> 2 -> 1
			const tasks = [createTask('1', ['2']), createTask('2', ['1'])];

			mockTasksDomain = createMockTasksDomain(tasks);
			domain = new ClusterExecutionDomain(
				createMockConfigManager(),
				mockTasksDomain
			);

			await expect(
				domain.buildExecutionPlan({ tag: 'circular' })
			).rejects.toThrow('Circular dependencies detected');
		});

		it('should detect resumable checkpoint when resume=true', async () => {
			const checkpoint = {
				timestamp: '2024-01-15T10:00:00.000Z',
				currentClusterId: 'cluster-0',
				completedClusters: ['cluster-0'],
				completedTasks: ['1', '2'],
				failedTasks: [],
				clusterStatuses: {},
				taskStatuses: {}
			};

			vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(checkpoint));

			const tasks = [createTask('1'), createTask('2'), createTask('3', ['1'])];
			mockTasksDomain = createMockTasksDomain(tasks);
			domain = new ClusterExecutionDomain(
				createMockConfigManager(),
				mockTasksDomain
			);

			const plan = await domain.buildExecutionPlan({
				tag: 'resume-tag',
				resume: true
			});

			expect(plan.hasResumableCheckpoint).toBe(true);
			expect(plan.checkpointInfo).toBeDefined();
			expect(plan.checkpointInfo!.completedClusters).toBe(1);
			expect(plan.checkpointInfo!.completedTasks).toBe(2);
		});

		it('should not check checkpoint when resume=false', async () => {
			const tasks = [createTask('1')];
			mockTasksDomain = createMockTasksDomain(tasks);
			domain = new ClusterExecutionDomain(
				createMockConfigManager(),
				mockTasksDomain
			);

			const plan = await domain.buildExecutionPlan({ tag: 'no-resume' });

			expect(plan.hasResumableCheckpoint).toBe(false);
			expect(plan.checkpointInfo).toBeUndefined();
		});

		it('should handle corrupt checkpoint file gracefully', async () => {
			vi.mocked(fs.readFile).mockResolvedValueOnce('not valid json');

			const tasks = [createTask('1'), createTask('2', ['1'])];
			mockTasksDomain = createMockTasksDomain(tasks);
			domain = new ClusterExecutionDomain(
				createMockConfigManager(),
				mockTasksDomain
			);

			const plan = await domain.buildExecutionPlan({
				tag: 'corrupt',
				resume: true
			});

			expect(plan.hasResumableCheckpoint).toBe(false);
		});

		it('should handle non-ENOENT checkpoint read error', async () => {
			vi.mocked(fs.readFile).mockRejectedValueOnce(
				Object.assign(new Error('EACCES'), { code: 'EACCES' })
			);

			const tasks = [createTask('1'), createTask('2', ['1'])];
			mockTasksDomain = createMockTasksDomain(tasks);
			domain = new ClusterExecutionDomain(
				createMockConfigManager(),
				mockTasksDomain
			);

			const plan = await domain.buildExecutionPlan({
				tag: 'eacces',
				resume: true
			});

			expect(plan.hasResumableCheckpoint).toBe(false);
		});

		it('should return hasResumableCheckpoint=false with resume=true but no checkpoint', async () => {
			const tasks = [createTask('1'), createTask('2', ['1'])];
			mockTasksDomain = createMockTasksDomain(tasks);
			domain = new ClusterExecutionDomain(
				createMockConfigManager(),
				mockTasksDomain
			);

			const plan = await domain.buildExecutionPlan({
				tag: 'test',
				resume: true
			});

			expect(plan.hasResumableCheckpoint).toBe(false);
			expect(plan.checkpointInfo).toBeUndefined();
		});

		it('should set checkpointPath based on tag and project root', async () => {
			mockTasksDomain = createMockTasksDomain([]);
			domain = new ClusterExecutionDomain(
				createMockConfigManager('/my/project'),
				mockTasksDomain
			);

			const plan = await domain.buildExecutionPlan({ tag: 'my-tag' });

			expect(plan.checkpointPath).toBe(
				'/my/project/.taskmaster/execution/my-tag/checkpoint.json'
			);
		});
	});

	describe('buildPrompt', () => {
		it('should generate a non-empty system prompt from a plan', async () => {
			const tasks = [createTask('1'), createTask('2', ['1'])];
			mockTasksDomain = createMockTasksDomain(tasks);
			domain = new ClusterExecutionDomain(
				createMockConfigManager(),
				mockTasksDomain
			);

			const plan = await domain.buildExecutionPlan({ tag: 'prompt-test' });
			const prompt = domain.buildPrompt(plan);

			expect(prompt.length).toBeGreaterThan(0);
			expect(prompt).toContain('Cluster Execution Session');
			expect(prompt).toContain('prompt-test');
		});

		it('should pass plan fields to promptBuilder including project path and checkpoint path', async () => {
			const tasks = [createTask('1'), createTask('2', ['1'])];
			mockTasksDomain = createMockTasksDomain(tasks);
			domain = new ClusterExecutionDomain(
				createMockConfigManager('/test/project'),
				mockTasksDomain
			);

			const plan = await domain.buildExecutionPlan({ tag: 'prompt-fields' });
			const prompt = domain.buildPrompt(plan);

			expect(prompt).toContain('prompt-fields');
			expect(prompt).toContain('/test/project');
			expect(prompt).toContain(
				'/test/project/.taskmaster/execution/prompt-fields/checkpoint.json'
			);
		});
	});

	describe('saveCheckpoint', () => {
		it('should write checkpoint atomically via temp file + rename', async () => {
			domain = new ClusterExecutionDomain(
				createMockConfigManager('/proj'),
				createMockTasksDomain()
			);

			await domain.saveCheckpoint('my-tag', ['cluster-0'], ['1', '2']);

			expect(fs.mkdir).toHaveBeenCalled();
			expect(fs.writeFile).toHaveBeenCalledWith(
				'/proj/.taskmaster/execution/my-tag/checkpoint.json.tmp',
				expect.any(String),
				'utf-8'
			);
			expect(fs.rename).toHaveBeenCalledWith(
				'/proj/.taskmaster/execution/my-tag/checkpoint.json.tmp',
				'/proj/.taskmaster/execution/my-tag/checkpoint.json'
			);
		});

		it('should write correct JSON structure', async () => {
			domain = new ClusterExecutionDomain(
				createMockConfigManager('/proj'),
				createMockTasksDomain()
			);

			await domain.saveCheckpoint('my-tag', ['cluster-0'], ['1', '2']);

			const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
			const written = JSON.parse(writeCall[1] as string);

			expect(written).toHaveProperty('timestamp');
			expect(written.currentClusterId).toBe('cluster-0');
			expect(written.completedClusters).toEqual(['cluster-0']);
			expect(written.completedTasks).toEqual(['1', '2']);
			expect(written.failedTasks).toEqual([]);
		});

		it('should set currentClusterId to empty string when completedClusters is empty', async () => {
			domain = new ClusterExecutionDomain(
				createMockConfigManager('/proj'),
				createMockTasksDomain()
			);

			await domain.saveCheckpoint('tag', [], []);

			const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
			const written = JSON.parse(writeCall[1] as string);

			expect(written.currentClusterId).toBe('');
		});
	});

	describe('clearCheckpoint', () => {
		it('should delete the checkpoint file', async () => {
			domain = new ClusterExecutionDomain(
				createMockConfigManager('/proj'),
				createMockTasksDomain()
			);

			await domain.clearCheckpoint('my-tag');

			expect(fs.unlink).toHaveBeenCalledWith(
				'/proj/.taskmaster/execution/my-tag/checkpoint.json'
			);
		});

		it('should re-throw non-ENOENT errors', async () => {
			vi.mocked(fs.unlink).mockRejectedValueOnce(
				Object.assign(new Error('EACCES'), { code: 'EACCES' })
			);

			domain = new ClusterExecutionDomain(
				createMockConfigManager('/proj'),
				createMockTasksDomain()
			);

			await expect(domain.clearCheckpoint('tag')).rejects.toThrow('EACCES');
		});

		it('should not throw if checkpoint does not exist', async () => {
			vi.mocked(fs.unlink).mockRejectedValueOnce(
				Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
			);

			domain = new ClusterExecutionDomain(
				createMockConfigManager('/proj'),
				createMockTasksDomain()
			);

			await expect(domain.clearCheckpoint('missing')).resolves.not.toThrow();
		});
	});
});
