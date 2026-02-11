import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClusterStartCommand } from './cluster-start.command.js';

// Use vi.hoisted so mocks are available when vi.mock factories run
const {
	mockBuildExecutionPlan,
	mockBuildSystemPrompt,
	mockSaveCheckpoint,
	mockDisplayError,
	mockCreateTmCore,
	mockGetProjectRoot
} = vi.hoisted(() => ({
	mockBuildExecutionPlan: vi.fn(),
	mockBuildSystemPrompt: vi.fn(),
	mockSaveCheckpoint: vi.fn(),
	mockDisplayError: vi.fn(),
	mockCreateTmCore: vi.fn(),
	mockGetProjectRoot: vi.fn()
}));

vi.mock('@tm/core', () => ({
	createTmCore: mockCreateTmCore
}));

// Mock child_process — would actually launch `claude`
const { mockSpawn } = vi.hoisted(() => ({ mockSpawn: vi.fn() }));
vi.mock('child_process', () => ({
	spawn: mockSpawn
}));

// Mock project root — filesystem boundary
vi.mock('../utils/project-root.js', () => ({
	getProjectRoot: mockGetProjectRoot
}));

// Mock error handler — transitively imports from @tm/core
vi.mock('../utils/error-handler.js', () => ({
	displayError: mockDisplayError
}));

function buildMockPlan(overrides = {}) {
	return {
		tag: 'test-tag',
		clusters: [
			{
				clusterId: 'cluster-0',
				level: 0,
				taskIds: ['1', '2'],
				upstreamClusters: [],
				downstreamClusters: ['cluster-1'],
				status: 'ready'
			}
		],
		tasks: [],
		totalClusters: 1,
		totalTasks: 2,
		estimatedTurns: 1,
		hasResumableCheckpoint: false,
		checkpointPath: '/test/.taskmaster/execution/test-tag/checkpoint.json',
		...overrides
	};
}

describe('ClusterStartCommand', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Re-set mocks after clearAllMocks wipes implementations
		mockGetProjectRoot.mockReturnValue('/test/project');
		mockCreateTmCore.mockResolvedValue({
			cluster: {
				buildExecutionPlan: mockBuildExecutionPlan,
				buildSystemPrompt: mockBuildSystemPrompt,
				saveCheckpoint: mockSaveCheckpoint
			}
		});

		// Re-set spawn mock to return a process-like object
		mockSpawn.mockReturnValue({
			on: vi.fn((event: string, handler: Function) => {
				if (event === 'close') {
					setTimeout(() => handler(0), 0);
				}
			}),
			killed: false,
			kill: vi.fn()
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should create a command named "start"', () => {
		const cmd = new ClusterStartCommand();
		expect(cmd.name()).toBe('start');
	});

	it('should support --tag option', () => {
		const cmd = new ClusterStartCommand();
		const tagOption = cmd.options.find((o) => o.long === '--tag');
		expect(tagOption).toBeDefined();
	});

	it('should support --dry-run option', () => {
		const cmd = new ClusterStartCommand();
		const dryRunOption = cmd.options.find((o) => o.long === '--dry-run');
		expect(dryRunOption).toBeDefined();
	});

	it('should support --resume option', () => {
		const cmd = new ClusterStartCommand();
		const resumeOption = cmd.options.find((o) => o.long === '--resume');
		expect(resumeOption).toBeDefined();
	});

	it('should support --json option', () => {
		const cmd = new ClusterStartCommand();
		const jsonOption = cmd.options.find((o) => o.long === '--json');
		expect(jsonOption).toBeDefined();
	});

	it('should support --parallel option', () => {
		const cmd = new ClusterStartCommand();
		const parallelOption = cmd.options.find((o) => o.long === '--parallel');
		expect(parallelOption).toBeDefined();
	});

	it('should support --continue-on-failure option', () => {
		const cmd = new ClusterStartCommand();
		const opt = cmd.options.find((o) => o.long === '--continue-on-failure');
		expect(opt).toBeDefined();
	});

	describe('dry run', () => {
		it('should call buildExecutionPlan with correct options', async () => {
			const plan = buildMockPlan();
			mockBuildExecutionPlan.mockResolvedValueOnce(plan);

			const cmd = new ClusterStartCommand();
			cmd.exitOverride();
			await cmd.parseAsync(['node', 'test', '--dry-run', '--tag', 'test-tag']);

			expect(mockDisplayError).not.toHaveBeenCalled();
			expect(mockBuildExecutionPlan).toHaveBeenCalledWith(
				expect.objectContaining({
					tag: 'test-tag',
					dryRun: true
				})
			);
			expect(mockBuildSystemPrompt).not.toHaveBeenCalled();
		});

		it('should return early when no tasks found', async () => {
			mockBuildExecutionPlan.mockResolvedValueOnce(
				buildMockPlan({ totalTasks: 0 })
			);

			const cmd = new ClusterStartCommand();
			cmd.exitOverride();
			await cmd.parseAsync(['node', 'test', '--dry-run']);

			expect(mockDisplayError).not.toHaveBeenCalled();
			expect(mockBuildExecutionPlan).toHaveBeenCalled();
			expect(mockBuildSystemPrompt).not.toHaveBeenCalled();
		});
	});

	describe('launch session', () => {
		it('should build system prompt and spawn claude', async () => {
			const plan = buildMockPlan();
			mockBuildExecutionPlan.mockResolvedValueOnce(plan);
			mockBuildSystemPrompt.mockReturnValueOnce('test system prompt');

			const cmd = new ClusterStartCommand();
			cmd.exitOverride();
			await cmd.parseAsync(['node', 'test', '--tag', 'test-tag']);

			expect(mockDisplayError).not.toHaveBeenCalled();
			expect(mockBuildSystemPrompt).toHaveBeenCalledWith(plan);
			expect(mockSpawn).toHaveBeenCalledWith(
				'claude',
				['--system-prompt', 'test system prompt'],
				expect.objectContaining({
					cwd: '/test/project',
					stdio: 'inherit',
					shell: false
				})
			);
		});
	});

	describe('error handling', () => {
		it('should display error and skip plan when createTmCore rejects', async () => {
			mockCreateTmCore.mockRejectedValueOnce(new Error('init fail'));

			const cmd = new ClusterStartCommand();
			cmd.exitOverride();
			await cmd.parseAsync(['node', 'test', '--dry-run']);

			expect(mockDisplayError).toHaveBeenCalledWith(
				expect.objectContaining({ message: 'init fail' })
			);
			expect(mockBuildExecutionPlan).not.toHaveBeenCalled();
		});

		it('should display error and skip spawn when buildExecutionPlan rejects', async () => {
			mockBuildExecutionPlan.mockRejectedValueOnce(
				new Error('plan fail')
			);

			const cmd = new ClusterStartCommand();
			cmd.exitOverride();
			await cmd.parseAsync(['node', 'test', '--dry-run']);

			expect(mockDisplayError).toHaveBeenCalledWith(
				expect.objectContaining({ message: 'plan fail' })
			);
			expect(mockSpawn).not.toHaveBeenCalled();
		});

		it('should display error when Claude exits with non-zero code', async () => {
			const plan = buildMockPlan();
			mockBuildExecutionPlan.mockResolvedValueOnce(plan);
			mockBuildSystemPrompt.mockReturnValueOnce('prompt');

			mockSpawn.mockReturnValue({
				on: vi.fn((event: string, handler: Function) => {
					if (event === 'close') {
						setTimeout(() => handler(1), 0);
					}
				}),
				killed: false,
				kill: vi.fn()
			});

			const cmd = new ClusterStartCommand();
			cmd.exitOverride();
			await cmd.parseAsync(['node', 'test', '--tag', 'test-tag']);

			expect(mockDisplayError).toHaveBeenCalledWith(
				expect.objectContaining({
					message: expect.stringContaining('exited with code 1')
				})
			);
		});

		it('should display error when spawn emits error event', async () => {
			const plan = buildMockPlan();
			mockBuildExecutionPlan.mockResolvedValueOnce(plan);
			mockBuildSystemPrompt.mockReturnValueOnce('prompt');

			mockSpawn.mockReturnValue({
				on: vi.fn((event: string, handler: Function) => {
					if (event === 'error') {
						setTimeout(
							() =>
								handler(
									Object.assign(new Error('spawn ENOENT'), {
										code: 'ENOENT'
									})
								),
							0
						);
					}
				}),
				killed: false,
				kill: vi.fn()
			});

			const cmd = new ClusterStartCommand();
			cmd.exitOverride();
			await cmd.parseAsync(['node', 'test', '--tag', 'test-tag']);

			expect(mockDisplayError).toHaveBeenCalledWith(
				expect.objectContaining({
					message: expect.stringContaining(
						'Failed to spawn Claude Code'
					)
				})
			);
		});
	});

	describe('option parsing', () => {
		it('should forward --parallel value to buildExecutionPlan', async () => {
			const plan = buildMockPlan();
			mockBuildExecutionPlan.mockResolvedValueOnce(plan);

			const cmd = new ClusterStartCommand();
			cmd.exitOverride();
			await cmd.parseAsync([
				'node',
				'test',
				'--parallel',
				'3',
				'--dry-run'
			]);

			expect(mockBuildExecutionPlan).toHaveBeenCalledWith(
				expect.objectContaining({ parallel: 3 })
			);
		});

		it('should forward --project value to getProjectRoot', async () => {
			const plan = buildMockPlan();
			mockBuildExecutionPlan.mockResolvedValueOnce(plan);

			const cmd = new ClusterStartCommand();
			cmd.exitOverride();
			await cmd.parseAsync([
				'node',
				'test',
				'--project',
				'/custom',
				'--dry-run'
			]);

			expect(mockGetProjectRoot).toHaveBeenCalledWith('/custom');
		});
	});
});
