import { promises as fs } from 'node:fs';
import * as fsp from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IStorage } from '../../common/interfaces/storage.interface.js';
import type { Task } from '../../common/types/index.js';
import { ConfigManager } from '../config/managers/config-manager.js';
import { StorageFactory } from '../storage/services/storage-factory.js';
import { TasksDomain } from '../tasks/tasks-domain.js';
import { ClusterExecutionDomain } from './cluster-execution-domain.js';

// ---------------------------------------------------------------------------
// External I/O mocks
// ---------------------------------------------------------------------------

// Mock node:fs — covers checkpoint I/O in ClusterExecutionDomain (which uses
// `import { promises as fs } from 'node:fs'`).
vi.mock('node:fs', async (importOriginal) => {
	const actual = await importOriginal<typeof import('node:fs')>();
	return {
		...actual,
		promises: {
			...actual.promises,
			access: vi
				.fn()
				.mockRejectedValue(
					Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
				),
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

// Auto-mock node:fs/promises — ConfigLoader, RuntimeStateManager, and
// ConfigPersistence all use `import fs from 'node:fs/promises'`.
// Auto-mocking replaces every export with vi.fn() stubs that return undefined.
// Default behaviors (ENOENT for reads, no-op for writes) are set in beforeEach.
vi.mock('node:fs/promises');

// StorageFactory — storage is an external I/O boundary.  Mocked via vi.spyOn
// inside buildRealDependencies (vi.mock path resolution is fragile across
// transitive imports of built-in modules).

// Mock BriefsDomain — its constructor creates AuthManager / SupabaseAuthClient
// singletons (network I/O).
vi.mock('../briefs/briefs-domain.js', () => ({
	BriefsDomain: vi.fn().mockImplementation(() => ({
		resolveBrief: vi.fn(),
		switchBrief: vi.fn()
	}))
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Configure node:fs/promises auto-mocks with sensible defaults for tests.
 * readFile rejects with ENOENT (config files don't exist), write ops are no-ops.
 */
function setupFspMocks(): void {
	const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
	vi.mocked(fsp.readFile).mockRejectedValue(enoent);
	vi.mocked(fsp.access).mockRejectedValue(enoent);
	vi.mocked(fsp.mkdir).mockResolvedValue(undefined);
	vi.mocked(fsp.writeFile).mockResolvedValue(undefined);
	vi.mocked(fsp.rename).mockResolvedValue(undefined);
	vi.mocked(fsp.unlink).mockResolvedValue(undefined);
	vi.mocked(fsp.readdir).mockResolvedValue([]);
}

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

/**
 * Build an in-memory mock IStorage that returns `tasks` from loadTasks().
 */
function buildMockStorage(tasks: Task[] = []): IStorage {
	return {
		initialize: vi.fn().mockResolvedValue(undefined),
		loadTasks: vi.fn().mockResolvedValue(tasks),
		loadTask: vi.fn().mockResolvedValue(null),
		saveTasks: vi.fn().mockResolvedValue(undefined),
		appendTasks: vi.fn().mockResolvedValue(undefined),
		updateTask: vi.fn().mockResolvedValue(undefined),
		updateTaskStatus: vi.fn().mockResolvedValue(undefined),
		deleteTask: vi.fn().mockResolvedValue(undefined),
		getStorageType: vi.fn().mockReturnValue('file'),
		getCurrentBriefName: vi.fn().mockReturnValue(undefined),
		watch: vi.fn().mockResolvedValue({ unsubscribe: vi.fn() }),
		close: vi.fn().mockResolvedValue(undefined)
	} as unknown as IStorage;
}

/**
 * Create a real ConfigManager + real TasksDomain pair, wired with mock
 * external I/O.  Returns everything the tests need to construct a
 * ClusterExecutionDomain and make assertions.
 */
async function buildRealDependencies(
	projectRoot = '/test/project',
	activeTag = 'master',
	tasks: Task[] = []
): Promise<{
	configManager: ConfigManager;
	tasksDomain: TasksDomain;
}> {
	// Build an in-memory storage stub with the desired tasks, then spy on
	// StorageFactory (external I/O boundary) to return it.
	const storage = buildMockStorage(tasks);
	vi.spyOn(StorageFactory, 'createFromStorageConfig').mockResolvedValue(
		storage
	);
	vi.spyOn(StorageFactory, 'create').mockResolvedValue(storage);

	// Create real ConfigManager (private ctor — use factory).
	// ConfigLoader, RuntimeStateManager, ConfigPersistence all do file I/O
	// that is captured by our node:fs / node:fs/promises mocks.
	const configManager = await ConfigManager.create(projectRoot);

	// Override the active tag when it differs from the default.
	if (activeTag !== 'master') {
		await configManager.setActiveTag(activeTag);
	}

	// Create real TasksDomain and initialize it.  StorageFactory is mocked so
	// TaskService gets our in-memory storage stub.
	const tasksDomain = new TasksDomain(configManager);
	await tasksDomain.initialize();

	return { configManager, tasksDomain };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ClusterExecutionDomain', () => {
	let domain: ClusterExecutionDomain;

	beforeEach(() => {
		vi.clearAllMocks();
		setupFspMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('buildExecutionPlan', () => {
		it('should return an empty plan when no tasks exist', async () => {
			const { configManager, tasksDomain } = await buildRealDependencies(
				'/test/project',
				'master',
				[]
			);
			domain = new ClusterExecutionDomain(configManager, tasksDomain);

			const plan = await domain.buildExecutionPlan({ tag: 'empty-tag' });

			expect(plan.tag).toBe('empty-tag');
			expect(plan.clusters).toEqual([]);
			expect(plan.totalClusters).toBe(0);
			expect(plan.totalTasks).toBe(0);
			expect(plan.estimatedTurns).toBe(0);
			expect(plan.hasResumableCheckpoint).toBe(false);
		});

		it('should default to active tag from configManager when none provided', async () => {
			const { configManager, tasksDomain } = await buildRealDependencies(
				'/test/project',
				'master',
				[]
			);
			const getActiveTagSpy = vi.spyOn(configManager, 'getActiveTag');
			const listSpy = vi.spyOn(tasksDomain, 'list');
			domain = new ClusterExecutionDomain(configManager, tasksDomain);

			const plan = await domain.buildExecutionPlan();

			expect(getActiveTagSpy).toHaveBeenCalled();
			expect(plan.tag).toBe('master');
			expect(listSpy).toHaveBeenCalledWith({
				tag: 'master',
				includeSubtasks: true
			});
		});

		it('should use configManager active tag when no tag option is provided', async () => {
			const { configManager, tasksDomain } = await buildRealDependencies(
				'/test/project',
				'my-feature',
				[]
			);
			const getActiveTagSpy = vi.spyOn(configManager, 'getActiveTag');
			const listSpy = vi.spyOn(tasksDomain, 'list');
			domain = new ClusterExecutionDomain(configManager, tasksDomain);

			const plan = await domain.buildExecutionPlan();

			expect(getActiveTagSpy).toHaveBeenCalled();
			expect(plan.tag).toBe('my-feature');
			expect(listSpy).toHaveBeenCalledWith({
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

			const { configManager, tasksDomain } = await buildRealDependencies(
				'/test/project',
				'master',
				tasks
			);
			domain = new ClusterExecutionDomain(configManager, tasksDomain);

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

			const { configManager, tasksDomain } = await buildRealDependencies(
				'/test/project',
				'master',
				tasks
			);
			domain = new ClusterExecutionDomain(configManager, tasksDomain);

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
			const { configManager, tasksDomain } = await buildRealDependencies(
				'/test/project',
				'master',
				tasks
			);
			domain = new ClusterExecutionDomain(configManager, tasksDomain);

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
			const { configManager, tasksDomain } = await buildRealDependencies(
				'/test/project',
				'master',
				tasks
			);
			domain = new ClusterExecutionDomain(configManager, tasksDomain);

			const plan = await domain.buildExecutionPlan({ tag: 'no-resume' });

			expect(plan.hasResumableCheckpoint).toBe(false);
			expect(plan.checkpointInfo).toBeUndefined();
		});

		it('should handle corrupt checkpoint file gracefully', async () => {
			vi.mocked(fs.readFile).mockResolvedValueOnce('not valid json');

			const tasks = [createTask('1'), createTask('2', ['1'])];
			const { configManager, tasksDomain } = await buildRealDependencies(
				'/test/project',
				'master',
				tasks
			);
			domain = new ClusterExecutionDomain(configManager, tasksDomain);

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
			const { configManager, tasksDomain } = await buildRealDependencies(
				'/test/project',
				'master',
				tasks
			);
			domain = new ClusterExecutionDomain(configManager, tasksDomain);

			const plan = await domain.buildExecutionPlan({
				tag: 'eacces',
				resume: true
			});

			expect(plan.hasResumableCheckpoint).toBe(false);
		});

		it('should return hasResumableCheckpoint=false with resume=true but no checkpoint', async () => {
			const tasks = [createTask('1'), createTask('2', ['1'])];
			const { configManager, tasksDomain } = await buildRealDependencies(
				'/test/project',
				'master',
				tasks
			);
			domain = new ClusterExecutionDomain(configManager, tasksDomain);

			const plan = await domain.buildExecutionPlan({
				tag: 'test',
				resume: true
			});

			expect(plan.hasResumableCheckpoint).toBe(false);
			expect(plan.checkpointInfo).toBeUndefined();
		});

		it('should set checkpointPath based on tag and project root', async () => {
			const { configManager, tasksDomain } = await buildRealDependencies(
				'/my/project',
				'master',
				[]
			);
			domain = new ClusterExecutionDomain(configManager, tasksDomain);

			const plan = await domain.buildExecutionPlan({ tag: 'my-tag' });

			expect(plan.checkpointPath).toBe(
				'/my/project/.taskmaster/execution/my-tag/checkpoint.json'
			);
		});
	});

	describe('buildPrompt', () => {
		it('should generate a non-empty system prompt from a plan', async () => {
			const tasks = [createTask('1'), createTask('2', ['1'])];
			const { configManager, tasksDomain } = await buildRealDependencies(
				'/test/project',
				'master',
				tasks
			);
			domain = new ClusterExecutionDomain(configManager, tasksDomain);

			const plan = await domain.buildExecutionPlan({ tag: 'prompt-test' });
			const prompt = domain.buildPrompt(plan);

			expect(prompt.length).toBeGreaterThan(0);
			expect(prompt).toContain('Cluster Execution Session');
			expect(prompt).toContain('prompt-test');
		});

		it('should pass plan fields to promptBuilder including project path and checkpoint path', async () => {
			const tasks = [createTask('1'), createTask('2', ['1'])];
			const { configManager, tasksDomain } = await buildRealDependencies(
				'/test/project',
				'master',
				tasks
			);
			domain = new ClusterExecutionDomain(configManager, tasksDomain);

			const plan = await domain.buildExecutionPlan({
				tag: 'prompt-fields'
			});
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
			const { configManager, tasksDomain } = await buildRealDependencies(
				'/proj',
				'master',
				[]
			);
			domain = new ClusterExecutionDomain(configManager, tasksDomain);

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
			const { configManager, tasksDomain } = await buildRealDependencies(
				'/proj',
				'master',
				[]
			);
			domain = new ClusterExecutionDomain(configManager, tasksDomain);

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
			const { configManager, tasksDomain } = await buildRealDependencies(
				'/proj',
				'master',
				[]
			);
			domain = new ClusterExecutionDomain(configManager, tasksDomain);

			await domain.saveCheckpoint('tag', [], []);

			const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
			const written = JSON.parse(writeCall[1] as string);

			expect(written.currentClusterId).toBe('');
		});
	});

	describe('clearCheckpoint', () => {
		it('should delete the checkpoint file', async () => {
			const { configManager, tasksDomain } = await buildRealDependencies(
				'/proj',
				'master',
				[]
			);
			domain = new ClusterExecutionDomain(configManager, tasksDomain);

			await domain.clearCheckpoint('my-tag');

			expect(fs.unlink).toHaveBeenCalledWith(
				'/proj/.taskmaster/execution/my-tag/checkpoint.json'
			);
		});

		it('should re-throw non-ENOENT errors', async () => {
			vi.mocked(fs.unlink).mockRejectedValueOnce(
				Object.assign(new Error('EACCES'), { code: 'EACCES' })
			);

			const { configManager, tasksDomain } = await buildRealDependencies(
				'/proj',
				'master',
				[]
			);
			domain = new ClusterExecutionDomain(configManager, tasksDomain);

			await expect(domain.clearCheckpoint('tag')).rejects.toThrow('EACCES');
		});

		it('should not throw if checkpoint does not exist', async () => {
			vi.mocked(fs.unlink).mockRejectedValueOnce(
				Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
			);

			const { configManager, tasksDomain } = await buildRealDependencies(
				'/proj',
				'master',
				[]
			);
			domain = new ClusterExecutionDomain(configManager, tasksDomain);

			await expect(domain.clearCheckpoint('missing')).resolves.not.toThrow();
		});
	});
});
