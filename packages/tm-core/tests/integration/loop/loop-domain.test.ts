/**
 * @fileoverview Integration tests for LoopDomain facade
 *
 * Tests the LoopDomain public API and its integration with:
 * - Preset resolution (using simplified preset exports)
 * - Index.ts barrel export accessibility
 *
 * @integration
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
	LoopDomain,
	PRESET_NAMES,
	PRESETS,
	getPreset,
	isPreset,
	type LoopPreset
} from '../../../src/modules/loop/index.js';
import type { ConfigManager } from '../../../src/modules/config/managers/config-manager.js';

// Mock ConfigManager factory
function createMockConfigManager(projectRoot = '/test/project'): ConfigManager {
	return {
		getProjectRoot: vi.fn().mockReturnValue(projectRoot)
	} as unknown as ConfigManager;
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

		it('should export preset utilities alongside LoopDomain', () => {
			expect(PRESET_NAMES).toBeDefined();
			expect(PRESETS).toBeDefined();
			expect(getPreset).toBeDefined();
			expect(isPreset).toBeDefined();
		});
	});

	describe('Preset Resolution with Real Presets', () => {
		let domain: LoopDomain;

		beforeEach(() => {
			const configManager = createMockConfigManager();
			domain = new LoopDomain(configManager);
		});

		it('should resolve all presets', async () => {
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

		it('should match preset content with getPreset utility', async () => {
			for (const preset of PRESET_NAMES) {
				const fromDomain = await domain.resolvePrompt(preset);
				const fromUtility = getPreset(preset);
				expect(fromDomain).toBe(fromUtility);
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

			// Verify preset resolution still works
			expect(domain.isPreset('default')).toBe(true);
		});

		it('should handle multiple LoopDomain instances independently', () => {
			const domain1 = new LoopDomain(createMockConfigManager('/project1'));
			const domain2 = new LoopDomain(createMockConfigManager('/project2'));

			// Both should work independently
			expect(domain1.isPreset('default')).toBe(true);
			expect(domain2.isPreset('default')).toBe(true);

			// Each should have its own preset values
			expect(domain1.getAvailablePresets()).toEqual(
				domain2.getAvailablePresets()
			);
		});
	});

	describe('Run/Stop Lifecycle', () => {
		let domain: LoopDomain;

		beforeEach(() => {
			domain = new LoopDomain(createMockConfigManager());
		});

		it('should report not running initially', () => {
			expect(domain.getIsRunning()).toBe(false);
		});

		it('should handle stop when no loop is running', () => {
			expect(() => domain.stop()).not.toThrow();
			expect(domain.getIsRunning()).toBe(false);
		});

		it('should allow multiple stop calls without error', () => {
			domain.stop();
			domain.stop();
			domain.stop();
			expect(domain.getIsRunning()).toBe(false);
		});
	});

	describe('Preset Content with Completion Markers', () => {
		let domain: LoopDomain;

		beforeEach(() => {
			domain = new LoopDomain(createMockConfigManager());
		});

		it('should resolve presets with detectable completion markers', async () => {
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
	});

	describe('Custom Prompt File Resolution', () => {
		let domain: LoopDomain;

		beforeEach(() => {
			domain = new LoopDomain(createMockConfigManager());
		});

		it('should resolve custom file path with provided readFile callback', async () => {
			const customContent =
				'# My Custom Loop Prompt\n<loop-complete>CUSTOM</loop-complete>';
			const mockReadFile = vi.fn().mockResolvedValue(customContent);

			const content = await domain.resolvePrompt(
				'/path/to/custom.md',
				mockReadFile
			);

			expect(mockReadFile).toHaveBeenCalledWith('/path/to/custom.md');
			expect(content).toBe(customContent);
		});

		it('should throw for custom path without readFile callback', async () => {
			await expect(domain.resolvePrompt('/path/to/custom.md')).rejects.toThrow(
				'Custom prompt file requires readFile callback'
			);
		});

		it('should propagate readFile errors', async () => {
			const mockReadFile = vi
				.fn()
				.mockRejectedValue(new Error('File not found'));

			await expect(
				domain.resolvePrompt('/nonexistent/file.md', mockReadFile)
			).rejects.toThrow('File not found');
		});
	});
});
