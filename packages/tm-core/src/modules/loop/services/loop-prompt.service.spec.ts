/**
 * @fileoverview Tests for LoopPromptService
 */

import { describe, it, expect, vi } from 'vitest';
import { LoopPromptService } from './loop-prompt.service.js';
import { LoopPresetService } from './loop-preset.service.js';
import type { LoopPresetService as LoopPresetServiceType } from './loop-preset.service.js';
import type { LoopConfig, LoopPreset } from '../types.js';
import { PRESET_NAMES } from '../presets/index.js';

describe('LoopPromptService', () => {
	/**
	 * Create a mock LoopPresetService for testing
	 */
	function createMockPresetService(): LoopPresetServiceType {
		return {
			isPreset: vi.fn().mockReturnValue(true),
			getPresetContent: vi.fn().mockReturnValue('mock preset content'),
			getPresetNames: vi.fn().mockReturnValue(['default']),
			loadPreset: vi.fn().mockReturnValue('mock preset content'),
			resolvePrompt: vi.fn().mockResolvedValue('mock preset content')
		} as unknown as LoopPresetServiceType;
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
			expect((service as unknown as { presetService: LoopPresetServiceType }).presetService).toBe(
				mockPresetService
			);
		});

		it('should provide access to presetService via protected method', () => {
			const mockPresetService = createMockPresetService();
			// Extend the class to access protected method
			class TestableLoopPromptService extends LoopPromptService {
				public testGetPresetService(): LoopPresetServiceType {
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
			} as unknown as LoopPresetServiceType;
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

/**
 * Snapshot tests using real LoopPresetService
 * These tests verify the complete generated prompt structure for each preset
 */
describe('LoopPromptService Snapshot Tests', () => {
	/**
	 * Create standard test config for snapshot tests
	 */
	function createTestConfig(preset: LoopPreset): LoopConfig {
		return {
			iterations: 10,
			prompt: preset,
			progressFile: '.taskmaster/loop-progress.txt',
			sleepSeconds: 5
		};
	}

	/**
	 * Create config with tag for snapshot comparison
	 */
	function createTestConfigWithTag(preset: LoopPreset): LoopConfig {
		return {
			iterations: 10,
			prompt: preset,
			progressFile: '.taskmaster/loop-progress.txt',
			sleepSeconds: 5,
			tag: 'feature-test'
		};
	}

	describe('generatePrompt snapshots for all presets', () => {
		it.each(PRESET_NAMES)(
			'generates correct prompt for %s preset',
			async (preset) => {
				const realPresetService = new LoopPresetService();
				const service = new LoopPromptService(realPresetService);

				const options = {
					config: createTestConfig(preset),
					iteration: 1,
					projectRoot: '/test/project'
				};

				const result = await service.generatePrompt(options);

				expect(result).toMatchSnapshot();
			}
		);

		it.each(PRESET_NAMES)(
			'generates correct prompt for %s preset with tag',
			async (preset) => {
				const realPresetService = new LoopPresetService();
				const service = new LoopPromptService(realPresetService);

				const options = {
					config: createTestConfigWithTag(preset),
					iteration: 5,
					projectRoot: '/test/project'
				};

				const result = await service.generatePrompt(options);

				expect(result).toMatchSnapshot();
			}
		);
	});

	describe('prompt structure validation with real presets', () => {
		it.each(PRESET_NAMES)(
			'%s preset prompt contains context header and preset content',
			async (preset) => {
				const realPresetService = new LoopPresetService();
				const service = new LoopPromptService(realPresetService);

				const options = {
					config: createTestConfig(preset),
					iteration: 3,
					projectRoot: '/test/project'
				};

				const result = await service.generatePrompt(options);

				// Verify context header elements
				expect(result).toContain('# Loop Iteration 3 of 10');
				expect(result).toContain('## Context');
				expect(result).toContain('- Progress file: @.taskmaster/loop-progress.txt');
				expect(result).toContain('- Tasks file: @.taskmaster/tasks/tasks.json');

				// Verify preset content is included (all presets have these sections)
				expect(result).toContain('## Process');
				expect(result).toContain('## Files Available');
			}
		);

		it.each(PRESET_NAMES)(
			'%s preset prompt has double newline between header and content',
			async (preset) => {
				const realPresetService = new LoopPresetService();
				const service = new LoopPromptService(realPresetService);

				const options = {
					config: createTestConfig(preset),
					iteration: 1,
					projectRoot: '/test/project'
				};

				const result = await service.generatePrompt(options);

				// Verify double newline separator exists between context and preset content
				expect(result).toMatch(/tasks\.json\n\n#/);
			}
		);

		it.each(PRESET_NAMES)(
			'%s preset prompt contains loop completion marker',
			async (preset) => {
				const realPresetService = new LoopPresetService();
				const service = new LoopPromptService(realPresetService);

				const options = {
					config: createTestConfig(preset),
					iteration: 1,
					projectRoot: '/test/project'
				};

				const result = await service.generatePrompt(options);

				// All presets should include the loop-complete marker
				expect(result).toMatch(/<loop-complete>/);
			}
		);
	});

	describe('iteration boundary tests with real presets', () => {
		it('generates correct header for first iteration', async () => {
			const realPresetService = new LoopPresetService();
			const service = new LoopPromptService(realPresetService);

			const options = {
				config: createTestConfig('default'),
				iteration: 1,
				projectRoot: '/test/project'
			};

			const result = await service.generatePrompt(options);

			expect(result).toContain('# Loop Iteration 1 of 10');
		});

		it('generates correct header for last iteration', async () => {
			const realPresetService = new LoopPresetService();
			const service = new LoopPromptService(realPresetService);

			const options = {
				config: createTestConfig('default'),
				iteration: 10,
				projectRoot: '/test/project'
			};

			const result = await service.generatePrompt(options);

			expect(result).toContain('# Loop Iteration 10 of 10');
		});

		it('generates correct header for single iteration loop', async () => {
			const realPresetService = new LoopPresetService();
			const service = new LoopPromptService(realPresetService);

			const config: LoopConfig = {
				iterations: 1,
				prompt: 'default',
				progressFile: '.taskmaster/loop-progress.txt',
				sleepSeconds: 5
			};

			const options = {
				config,
				iteration: 1,
				projectRoot: '/test/project'
			};

			const result = await service.generatePrompt(options);

			expect(result).toContain('# Loop Iteration 1 of 1');
		});

		it('generates correct header for large iteration count', async () => {
			const realPresetService = new LoopPresetService();
			const service = new LoopPromptService(realPresetService);

			const config: LoopConfig = {
				iterations: 100,
				prompt: 'default',
				progressFile: '.taskmaster/loop-progress.txt',
				sleepSeconds: 5
			};

			const options = {
				config,
				iteration: 50,
				projectRoot: '/test/project'
			};

			const result = await service.generatePrompt(options);

			expect(result).toContain('# Loop Iteration 50 of 100');
		});
	});

	describe('tag handling with real presets', () => {
		it('includes tag filter when tag is specified', async () => {
			const realPresetService = new LoopPresetService();
			const service = new LoopPromptService(realPresetService);

			const options = {
				config: createTestConfigWithTag('default'),
				iteration: 1,
				projectRoot: '/test/project'
			};

			const result = await service.generatePrompt(options);

			expect(result).toContain('- Tag filter: feature-test');
		});

		it('omits tag filter when tag is not specified', async () => {
			const realPresetService = new LoopPresetService();
			const service = new LoopPromptService(realPresetService);

			const options = {
				config: createTestConfig('default'),
				iteration: 1,
				projectRoot: '/test/project'
			};

			const result = await service.generatePrompt(options);

			expect(result).not.toContain('Tag filter');
		});
	});

	describe('custom progress file path', () => {
		it('includes custom progress file path in context header', async () => {
			const realPresetService = new LoopPresetService();
			const service = new LoopPromptService(realPresetService);

			const config: LoopConfig = {
				iterations: 5,
				prompt: 'default',
				progressFile: 'custom/path/progress.txt',
				sleepSeconds: 5
			};

			const options = {
				config,
				iteration: 1,
				projectRoot: '/test/project'
			};

			const result = await service.generatePrompt(options);

			expect(result).toContain('- Progress file: @custom/path/progress.txt');
		});
	});
});
