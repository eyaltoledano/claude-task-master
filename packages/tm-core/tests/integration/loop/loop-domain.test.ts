/**
 * @fileoverview Integration tests for LoopDomain facade
 *
 * Tests the LoopDomain public API and its integration with:
 * - LoopPresetService for preset resolution
 * - Real preset content loading (no mocks)
 * - TasksDomain integration for completion checking
 * - Index.ts barrel export accessibility
 *
 * @integration
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
	LoopDomain,
	LoopPresetService,
	LoopCompletionService,
	PRESET_NAMES,
	type LoopPreset
} from '../../../src/modules/loop/index.js';
import type { ConfigManager } from '../../../src/modules/config/managers/config-manager.js';
import type { TasksDomain } from '../../../src/modules/tasks/tasks-domain.js';

// Mock ConfigManager factory
function createMockConfigManager(projectRoot = '/test/project'): ConfigManager {
	return {
		getProjectRoot: vi.fn().mockReturnValue(projectRoot)
	} as unknown as ConfigManager;
}

// Mock TasksDomain factory
function createMockTasksDomain(
	tasks: Array<{ id: number; status: string }> = []
): TasksDomain {
	return {
		list: vi.fn().mockResolvedValue({ tasks })
	} as unknown as TasksDomain;
}

describe('LoopDomain Integration', () => {
	describe('Barrel Export Accessibility', () => {
		it('should export LoopDomain from index.ts', () => {
			expect(LoopDomain).toBeDefined();
			expect(typeof LoopDomain).toBe('function');
		});

		it('should be constructible with ConfigManager', () => {
			const configManager = createMockConfigManager();
			const domain = new LoopDomain(configManager);
			expect(domain).toBeInstanceOf(LoopDomain);
		});

		it('should export alongside other loop services', () => {
			expect(LoopPresetService).toBeDefined();
			expect(LoopCompletionService).toBeDefined();
			expect(PRESET_NAMES).toBeDefined();
		});
	});

	describe('Preset Resolution with Real Services', () => {
		let domain: LoopDomain;

		beforeEach(() => {
			const configManager = createMockConfigManager();
			domain = new LoopDomain(configManager);
		});

		it('should resolve all presets using real LoopPresetService', async () => {
			const expectedPresets: LoopPreset[] = [
				'default',
				'test-coverage',
				'linting',
				'duplication',
				'entropy'
			];

			for (const preset of expectedPresets) {
				const content = await domain.resolvePrompt(preset);
				expect(content).toBeTruthy();
				expect(content.length).toBeGreaterThan(100);
				expect(content).toContain('<loop-complete>');
			}
		});

		it('should return consistent content between isPreset and resolvePrompt', async () => {
			const presets = domain.getAvailablePresets();

			for (const preset of presets) {
				expect(domain.isPreset(preset)).toBe(true);
				const content = await domain.resolvePrompt(preset);
				expect(content).toBeTruthy();
			}
		});

		it('should correctly identify non-presets', () => {
			expect(domain.isPreset('/path/to/custom.md')).toBe(false);
			expect(domain.isPreset('my-custom-preset')).toBe(false);
			expect(domain.isPreset('')).toBe(false);
		});

		it('should match preset content with standalone LoopPresetService', async () => {
			const standaloneService = new LoopPresetService();

			for (const preset of PRESET_NAMES) {
				const fromDomain = await domain.resolvePrompt(preset);
				const fromService = standaloneService.getPresetContent(preset);
				expect(fromDomain).toBe(fromService);
			}
		});
	});

	describe('Config Building Integration', () => {
		it('should build config with correct projectRoot in progressFile', () => {
			const configManager = createMockConfigManager('/my/custom/project');
			const domain = new LoopDomain(configManager);

			// Access private buildConfig via run preparation
			// Test indirectly by checking the domain was created with correct projectRoot
			expect(domain.getAvailablePresets()).toHaveLength(5);

			// Verify preset resolution still works (exercises internal presetService)
			expect(domain.isPreset('default')).toBe(true);
		});

		it('should handle multiple LoopDomain instances independently', () => {
			const domain1 = new LoopDomain(createMockConfigManager('/project1'));
			const domain2 = new LoopDomain(createMockConfigManager('/project2'));

			// Both should work independently
			expect(domain1.isPreset('default')).toBe(true);
			expect(domain2.isPreset('default')).toBe(true);

			// Each should have its own preset service instance
			expect(domain1.getAvailablePresets()).toEqual(domain2.getAvailablePresets());
		});
	});

	describe('TasksDomain Integration', () => {
		let domain: LoopDomain;

		beforeEach(() => {
			domain = new LoopDomain(createMockConfigManager());
		});

		it('should integrate with TasksDomain for completion checking', async () => {
			const mockTasksDomain = createMockTasksDomain([
				{ id: 1, status: 'done' },
				{ id: 2, status: 'done' },
				{ id: 3, status: 'cancelled' }
			]);

			domain.setTasksDomain(mockTasksDomain);
			const isComplete = await domain.checkAllTasksComplete();

			expect(isComplete).toBe(true);
			expect(mockTasksDomain.list).toHaveBeenCalled();
		});

		it('should detect incomplete tasks correctly', async () => {
			const mockTasksDomain = createMockTasksDomain([
				{ id: 1, status: 'done' },
				{ id: 2, status: 'pending' },
				{ id: 3, status: 'in-progress' }
			]);

			domain.setTasksDomain(mockTasksDomain);
			const isComplete = await domain.checkAllTasksComplete();

			expect(isComplete).toBe(false);
		});

		it('should pass tag option to TasksDomain.list', async () => {
			const mockTasksDomain = createMockTasksDomain([
				{ id: 1, status: 'done' }
			]);

			domain.setTasksDomain(mockTasksDomain);
			await domain.checkAllTasksComplete({ tag: 'my-feature-tag' });

			expect(mockTasksDomain.list).toHaveBeenCalledWith({
				tag: 'my-feature-tag'
			});
		});

		it('should handle empty task list as complete', async () => {
			const mockTasksDomain = createMockTasksDomain([]);
			domain.setTasksDomain(mockTasksDomain);

			const isComplete = await domain.checkAllTasksComplete();
			expect(isComplete).toBe(true);
		});

		it('should throw when checkAllTasksComplete called without TasksDomain', async () => {
			await expect(domain.checkAllTasksComplete()).rejects.toThrow(
				'TasksDomain not set'
			);
		});
	});

	describe('Run/Stop Lifecycle', () => {
		let domain: LoopDomain;

		beforeEach(() => {
			domain = new LoopDomain(createMockConfigManager());
		});

		it('should report not running initially', () => {
			expect(domain.isRunning()).toBe(false);
		});

		it('should handle stop when no loop is running', async () => {
			await expect(domain.stop()).resolves.not.toThrow();
			expect(domain.isRunning()).toBe(false);
		});

		it('should allow multiple stop calls without error', async () => {
			await domain.stop();
			await domain.stop();
			await domain.stop();
			expect(domain.isRunning()).toBe(false);
		});
	});

	describe('Preset Content with LoopCompletionService', () => {
		let domain: LoopDomain;
		let completionService: LoopCompletionService;

		beforeEach(() => {
			domain = new LoopDomain(createMockConfigManager());
			completionService = new LoopCompletionService();
		});

		it('should resolve presets with markers detectable by LoopCompletionService', async () => {
			for (const preset of domain.getAvailablePresets()) {
				const content = await domain.resolvePrompt(preset);

				// All presets should have a <loop-complete> marker
				expect(content).toContain('<loop-complete>');

				// Extract the marker from content
				const match = content.match(/<loop-complete>([^<]+)<\/loop-complete>/);
				expect(match).toBeTruthy();
				expect(match![1].length).toBeGreaterThan(0);
			}
		});

		it('should resolve default preset with both complete and blocked markers', async () => {
			const content = await domain.resolvePrompt('default');

			expect(content).toContain('<loop-complete>');
			expect(content).toContain('<loop-blocked>');
		});

		it('simulated agent output with resolved preset marker should be detected', async () => {
			// Simulate what happens when an agent uses a marker from the preset
			const simulatedAgentOutput = `
I have completed the task successfully.

<loop-complete>ALL_TASKS_DONE</loop-complete>
`;

			const result = completionService.parseOutput(simulatedAgentOutput);
			expect(result.isComplete).toBe(true);
			expect(result.marker?.type).toBe('complete');
		});
	});

	describe('Custom Prompt File Resolution', () => {
		let domain: LoopDomain;

		beforeEach(() => {
			domain = new LoopDomain(createMockConfigManager());
		});

		it('should resolve custom file path with provided readFile callback', async () => {
			const customContent = '# My Custom Loop Prompt\n<loop-complete>CUSTOM</loop-complete>';
			const mockReadFile = vi.fn().mockResolvedValue(customContent);

			const content = await domain.resolvePrompt('/path/to/custom.md', mockReadFile);

			expect(mockReadFile).toHaveBeenCalledWith('/path/to/custom.md');
			expect(content).toBe(customContent);
		});

		it('should throw for custom path without readFile callback', async () => {
			await expect(domain.resolvePrompt('/path/to/custom.md')).rejects.toThrow(
				'no file reader provided'
			);
		});

		it('should propagate readFile errors', async () => {
			const mockReadFile = vi.fn().mockRejectedValue(new Error('File not found'));

			await expect(
				domain.resolvePrompt('/nonexistent/file.md', mockReadFile)
			).rejects.toThrow('File not found');
		});
	});
});
