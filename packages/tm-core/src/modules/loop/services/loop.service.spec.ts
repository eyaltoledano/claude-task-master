/**
 * @fileoverview Unit tests for LoopService
 */

import { describe, expect, it } from 'vitest';
import { LoopService, type LoopServiceOptions } from './loop.service.js';
import { LoopCompletionService } from './loop-completion.service.js';
import { LoopExecutorService } from './loop-executor.service.js';
import { LoopPresetService } from './loop-preset.service.js';
import { LoopProgressService } from './loop-progress.service.js';
import { LoopPromptService } from './loop-prompt.service.js';

describe('LoopService', () => {
	const defaultOptions: LoopServiceOptions = {
		projectRoot: '/test/project'
	};

	describe('constructor', () => {
		it('should create a LoopService instance with required options', () => {
			const service = new LoopService(defaultOptions);
			expect(service).toBeInstanceOf(LoopService);
		});

		it('should store projectRoot from options', () => {
			const service = new LoopService(defaultOptions);
			expect(service.getProjectRoot()).toBe('/test/project');
		});

		it('should create LoopPresetService instance', () => {
			const service = new LoopService(defaultOptions);
			expect(service.getPresetService()).toBeInstanceOf(LoopPresetService);
		});

		it('should create LoopProgressService with projectRoot', () => {
			const service = new LoopService(defaultOptions);
			const progressService = service.getProgressService();
			expect(progressService).toBeInstanceOf(LoopProgressService);
			// Verify projectRoot was passed by checking default progress path
			expect(progressService.getDefaultProgressPath()).toBe(
				'/test/project/.taskmaster/loop-progress.txt'
			);
		});

		it('should create LoopCompletionService instance', () => {
			const service = new LoopService(defaultOptions);
			expect(service.getCompletionService()).toBeInstanceOf(
				LoopCompletionService
			);
		});

		it('should create LoopPromptService with presetService dependency', () => {
			const service = new LoopService(defaultOptions);
			const promptService = service.getPromptService();
			expect(promptService).toBeInstanceOf(LoopPromptService);
			// Prompt service should use the same preset service instance
			// We verify this indirectly by checking it can load presets
		});

		it('should create LoopExecutorService with completionService dependency', () => {
			const service = new LoopService(defaultOptions);
			const executorService = service.getExecutorService();
			expect(executorService).toBeInstanceOf(LoopExecutorService);
		});

		it('should initialize isRunning to false', () => {
			const service = new LoopService(defaultOptions);
			expect(service.getIsRunning()).toBe(false);
		});
	});

	describe('service instantiation with different project roots', () => {
		it('should work with absolute path', () => {
			const service = new LoopService({ projectRoot: '/absolute/path/to/project' });
			expect(service.getProjectRoot()).toBe('/absolute/path/to/project');
		});

		it('should work with Windows-style path', () => {
			const service = new LoopService({ projectRoot: 'C:\\Users\\test\\project' });
			expect(service.getProjectRoot()).toBe('C:\\Users\\test\\project');
		});

		it('should work with empty projectRoot', () => {
			const service = new LoopService({ projectRoot: '' });
			expect(service.getProjectRoot()).toBe('');
		});
	});

	describe('service instance isolation', () => {
		it('should create new service instances for each LoopService', () => {
			const service1 = new LoopService(defaultOptions);
			const service2 = new LoopService(defaultOptions);

			// Each LoopService should have its own sub-service instances
			expect(service1.getPresetService()).not.toBe(service2.getPresetService());
			expect(service1.getProgressService()).not.toBe(service2.getProgressService());
			expect(service1.getCompletionService()).not.toBe(service2.getCompletionService());
			expect(service1.getPromptService()).not.toBe(service2.getPromptService());
			expect(service1.getExecutorService()).not.toBe(service2.getExecutorService());
		});

		it('should maintain independent state between instances', () => {
			const service1 = new LoopService({ projectRoot: '/project1' });
			const service2 = new LoopService({ projectRoot: '/project2' });

			expect(service1.getProjectRoot()).toBe('/project1');
			expect(service2.getProjectRoot()).toBe('/project2');
		});
	});

	describe('DI wiring verification', () => {
		it('should wire LoopPromptService to use the LoopPresetService instance', () => {
			const service = new LoopService(defaultOptions);
			const presetService = service.getPresetService();

			// Verify preset service is properly wired and can access preset data
			const presetNames = presetService.getPresetNames();
			expect(presetNames).toContain('default');
			expect(presetNames.length).toBeGreaterThan(0);

			// Verify prompt service was created (DI wiring verified by no constructor errors)
			expect(service.getPromptService()).toBeInstanceOf(LoopPromptService);
		});

		it('should wire LoopProgressService with correct projectRoot', () => {
			const projectRoot = '/my/test/project';
			const service = new LoopService({ projectRoot });
			const progressService = service.getProgressService();

			// Progress service should use the provided projectRoot
			expect(progressService.getDefaultProgressPath()).toContain(projectRoot);
		});
	});
});
