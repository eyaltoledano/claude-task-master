/**
 * @fileoverview Tests for LoopPromptService
 */

import { describe, it, expect, vi } from 'vitest';
import { LoopPromptService } from './loop-prompt.service.js';
import type { LoopPresetService } from './loop-preset.service.js';

describe('LoopPromptService', () => {
	/**
	 * Create a mock LoopPresetService for testing
	 */
	function createMockPresetService(): LoopPresetService {
		return {
			isPreset: vi.fn().mockReturnValue(true),
			getPresetContent: vi.fn().mockReturnValue('mock preset content'),
			getPresetNames: vi.fn().mockReturnValue(['default']),
			loadPreset: vi.fn().mockReturnValue('mock preset content'),
			resolvePrompt: vi.fn().mockResolvedValue('mock preset content')
		} as unknown as LoopPresetService;
	}

	describe('constructor', () => {
		it('should create an instance with presetService', () => {
			const mockPresetService = createMockPresetService();
			const service = new LoopPromptService(mockPresetService);

			expect(service).toBeInstanceOf(LoopPromptService);
		});

		it('should store presetService reference', () => {
			const mockPresetService = createMockPresetService();
			const service = new LoopPromptService(mockPresetService);

			// Access the private property through type assertion for testing
			expect((service as unknown as { presetService: LoopPresetService }).presetService).toBe(
				mockPresetService
			);
		});

		it('should provide access to presetService via protected method', () => {
			const mockPresetService = createMockPresetService();
			// Extend the class to access protected method
			class TestableLoopPromptService extends LoopPromptService {
				public testGetPresetService(): LoopPresetService {
					return this.getPresetService();
				}
			}
			const service = new TestableLoopPromptService(mockPresetService);

			expect(service.testGetPresetService()).toBe(mockPresetService);
		});
	});

	describe('buildContextHeader', () => {
		it('should include correct iteration numbers', () => {
			const mockPresetService = createMockPresetService();
			const service = new LoopPromptService(mockPresetService);

			const config = {
				iterations: 10,
				prompt: 'default' as const,
				progressFile: '.taskmaster/loop-progress.txt',
				sleepSeconds: 5
			};

			const header = service.buildContextHeader(config, 3);

			expect(header).toContain('# Loop Iteration 3 of 10');
		});

		it('should include progress file reference with @ prefix', () => {
			const mockPresetService = createMockPresetService();
			const service = new LoopPromptService(mockPresetService);

			const config = {
				iterations: 5,
				prompt: 'default' as const,
				progressFile: '.taskmaster/custom-progress.txt',
				sleepSeconds: 5
			};

			const header = service.buildContextHeader(config, 1);

			expect(header).toContain('- Progress file: @.taskmaster/custom-progress.txt');
		});

		it('should include tasks.json file reference with @ prefix', () => {
			const mockPresetService = createMockPresetService();
			const service = new LoopPromptService(mockPresetService);

			const config = {
				iterations: 5,
				prompt: 'default' as const,
				progressFile: '.taskmaster/loop-progress.txt',
				sleepSeconds: 5
			};

			const header = service.buildContextHeader(config, 1);

			expect(header).toContain('- Tasks file: @.taskmaster/tasks/tasks.json');
		});

		it('should include tag filter when config.tag is set', () => {
			const mockPresetService = createMockPresetService();
			const service = new LoopPromptService(mockPresetService);

			const config = {
				iterations: 5,
				prompt: 'default' as const,
				progressFile: '.taskmaster/loop-progress.txt',
				sleepSeconds: 5,
				tag: 'feature-x'
			};

			const header = service.buildContextHeader(config, 1);

			expect(header).toContain('- Tag filter: feature-x');
		});

		it('should omit tag line when config.tag is undefined', () => {
			const mockPresetService = createMockPresetService();
			const service = new LoopPromptService(mockPresetService);

			const config = {
				iterations: 5,
				prompt: 'default' as const,
				progressFile: '.taskmaster/loop-progress.txt',
				sleepSeconds: 5
			};

			const header = service.buildContextHeader(config, 1);

			expect(header).not.toContain('Tag filter');
		});

		it('should have proper structure with Context section', () => {
			const mockPresetService = createMockPresetService();
			const service = new LoopPromptService(mockPresetService);

			const config = {
				iterations: 5,
				prompt: 'default' as const,
				progressFile: '.taskmaster/loop-progress.txt',
				sleepSeconds: 5
			};

			const header = service.buildContextHeader(config, 2);

			expect(header).toContain('## Context');
			// Verify structure order
			const lines = header.split('\n');
			expect(lines[0]).toBe('# Loop Iteration 2 of 5');
			expect(lines[1]).toBe('');
			expect(lines[2]).toBe('## Context');
		});

		it('should handle edge case of iteration 1 of 1', () => {
			const mockPresetService = createMockPresetService();
			const service = new LoopPromptService(mockPresetService);

			const config = {
				iterations: 1,
				prompt: 'default' as const,
				progressFile: '.taskmaster/loop-progress.txt',
				sleepSeconds: 5
			};

			const header = service.buildContextHeader(config, 1);

			expect(header).toContain('# Loop Iteration 1 of 1');
		});
	});

	describe('generatePrompt', () => {
		it('should combine context header and base prompt with double newline', async () => {
			const mockPresetService = createMockPresetService();
			const service = new LoopPromptService(mockPresetService);

			const options = {
				config: {
					iterations: 10,
					prompt: 'default' as const,
					progressFile: '.taskmaster/loop-progress.txt',
					sleepSeconds: 5
				},
				iteration: 3,
				projectRoot: '/test/project'
			};

			const result = await service.generatePrompt(options);

			// Should contain header
			expect(result).toContain('# Loop Iteration 3 of 10');
			// Should contain base prompt
			expect(result).toContain('mock preset content');
			// Should have double newline separator between header and content
			expect(result).toContain('## Context\n- Progress file');
			expect(result).toContain('tasks.json\n\nmock preset content');
		});

		it('should call presetService.resolvePrompt with correct prompt', async () => {
			const mockPresetService = createMockPresetService();
			const service = new LoopPromptService(mockPresetService);

			const options = {
				config: {
					iterations: 5,
					prompt: 'test-coverage' as const,
					progressFile: '.taskmaster/loop-progress.txt',
					sleepSeconds: 5
				},
				iteration: 1,
				projectRoot: '/test/project'
			};

			await service.generatePrompt(options);

			expect(mockPresetService.resolvePrompt).toHaveBeenCalledWith('test-coverage', undefined);
		});

		it('should pass readFile function to presetService.resolvePrompt', async () => {
			const mockPresetService = createMockPresetService();
			const service = new LoopPromptService(mockPresetService);
			const mockReadFile = vi.fn().mockResolvedValue('custom file content');

			const options = {
				config: {
					iterations: 5,
					prompt: '/custom/prompt.md' as string,
					progressFile: '.taskmaster/loop-progress.txt',
					sleepSeconds: 5
				},
				iteration: 1,
				projectRoot: '/test/project'
			};

			await service.generatePrompt(options, mockReadFile);

			expect(mockPresetService.resolvePrompt).toHaveBeenCalledWith('/custom/prompt.md', mockReadFile);
		});

		it('should include iteration number in output', async () => {
			const mockPresetService = createMockPresetService();
			const service = new LoopPromptService(mockPresetService);

			const options = {
				config: {
					iterations: 20,
					prompt: 'default' as const,
					progressFile: '.taskmaster/loop-progress.txt',
					sleepSeconds: 5
				},
				iteration: 15,
				projectRoot: '/test/project'
			};

			const result = await service.generatePrompt(options);

			expect(result).toContain('# Loop Iteration 15 of 20');
		});

		it('should include file references with @ syntax', async () => {
			const mockPresetService = createMockPresetService();
			const service = new LoopPromptService(mockPresetService);

			const options = {
				config: {
					iterations: 5,
					prompt: 'default' as const,
					progressFile: '.taskmaster/custom-progress.txt',
					sleepSeconds: 5
				},
				iteration: 1,
				projectRoot: '/test/project'
			};

			const result = await service.generatePrompt(options);

			expect(result).toContain('- Progress file: @.taskmaster/custom-progress.txt');
			expect(result).toContain('- Tasks file: @.taskmaster/tasks/tasks.json');
		});

		it('should include tag when config.tag is set', async () => {
			const mockPresetService = createMockPresetService();
			const service = new LoopPromptService(mockPresetService);

			const options = {
				config: {
					iterations: 5,
					prompt: 'default' as const,
					progressFile: '.taskmaster/loop-progress.txt',
					sleepSeconds: 5,
					tag: 'feature-x'
				},
				iteration: 1,
				projectRoot: '/test/project'
			};

			const result = await service.generatePrompt(options);

			expect(result).toContain('- Tag filter: feature-x');
		});

		it('should not include tag when config.tag is undefined', async () => {
			const mockPresetService = createMockPresetService();
			const service = new LoopPromptService(mockPresetService);

			const options = {
				config: {
					iterations: 5,
					prompt: 'default' as const,
					progressFile: '.taskmaster/loop-progress.txt',
					sleepSeconds: 5
				},
				iteration: 1,
				projectRoot: '/test/project'
			};

			const result = await service.generatePrompt(options);

			expect(result).not.toContain('Tag filter');
		});

		it('should work with different preset values', async () => {
			const mockPresetService = {
				...createMockPresetService(),
				resolvePrompt: vi.fn().mockResolvedValue('# Linting preset\n\nFix lint errors.')
			} as unknown as LoopPresetService;
			const service = new LoopPromptService(mockPresetService);

			const options = {
				config: {
					iterations: 3,
					prompt: 'linting' as const,
					progressFile: '.taskmaster/loop-progress.txt',
					sleepSeconds: 5
				},
				iteration: 2,
				projectRoot: '/test/project'
			};

			const result = await service.generatePrompt(options);

			expect(result).toContain('# Loop Iteration 2 of 3');
			expect(result).toContain('# Linting preset');
			expect(result).toContain('Fix lint errors.');
		});
	});
});
