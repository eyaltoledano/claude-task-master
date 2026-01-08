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
			loadPreset: vi.fn().mockReturnValue('mock preset content')
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
});
