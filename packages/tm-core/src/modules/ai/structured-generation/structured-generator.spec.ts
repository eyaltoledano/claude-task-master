import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import {
	BridgedStructuredGenerator,
	type GenerateObjectServiceFn
} from './structured-generator.js';
import type { AIPrimitiveOptions } from '../types/primitives.types.js';

describe('BridgedStructuredGenerator', () => {
	describe('generate', () => {
		it('should throw error when result is null', async () => {
			const mockService: GenerateObjectServiceFn = vi
				.fn()
				.mockResolvedValue(null);
			const generator = new BridgedStructuredGenerator(mockService);

			const schema = z.object({ value: z.string() });
			const options: AIPrimitiveOptions & { objectName?: string } = {
				commandName: 'test-command',
				objectName: 'test-object'
			};

			await expect(
				generator.generate('test prompt', schema, options)
			).rejects.toThrow(
				'AI service returned null or undefined result (objectName: test-object, commandName: test-command)'
			);
		});

		it('should throw error when result.mainResult is null', async () => {
			const mockService: GenerateObjectServiceFn = vi.fn().mockResolvedValue({
				mainResult: null,
				modelId: 'test-model',
				providerName: 'test-provider'
			});
			const generator = new BridgedStructuredGenerator(mockService);

			const schema = z.object({ value: z.string() });
			const options: AIPrimitiveOptions & { objectName?: string } = {
				commandName: 'test-command',
				objectName: 'test-object'
			};

			await expect(
				generator.generate('test prompt', schema, options)
			).rejects.toThrow(
				'AI service returned null or undefined result (objectName: test-object, commandName: test-command, modelId: test-model, providerName: test-provider)'
			);
		});

		it('should throw error when result.mainResult is undefined', async () => {
			const mockService: GenerateObjectServiceFn = vi.fn().mockResolvedValue({
				mainResult: undefined,
				modelId: 'test-model',
				providerName: 'test-provider'
			});
			const generator = new BridgedStructuredGenerator(mockService);

			const schema = z.object({ value: z.string() });
			const options: AIPrimitiveOptions & { objectName?: string } = {
				commandName: 'test-command',
				objectName: 'test-object'
			};

			await expect(
				generator.generate('test prompt', schema, options)
			).rejects.toThrow(
				'AI service returned null or undefined result (objectName: test-object, commandName: test-command, modelId: test-model, providerName: test-provider)'
			);
		});

		it('should return valid result when mainResult is present', async () => {
			const mockResult = { value: 'test-value' };
			const mockService: GenerateObjectServiceFn = vi.fn().mockResolvedValue({
				mainResult: mockResult,
				modelId: 'test-model',
				providerName: 'test-provider',
				telemetryData: {
					inputTokens: 10,
					outputTokens: 20
				}
			});
			const generator = new BridgedStructuredGenerator(mockService);

			const schema = z.object({ value: z.string() });
			const options: AIPrimitiveOptions & { objectName?: string } = {
				commandName: 'test-command',
				objectName: 'test-object'
			};

			const result = await generator.generate('test prompt', schema, options);

			expect(result.data).toEqual(mockResult);
			expect(result.usage).toEqual({
				inputTokens: 10,
				outputTokens: 20,
				model: 'test-model',
				provider: 'test-provider',
				duration: expect.any(Number)
			});
		});

		it('should use default objectName when not provided', async () => {
			const mockResult = { value: 'test-value' };
			const mockService: GenerateObjectServiceFn = vi.fn().mockResolvedValue({
				mainResult: mockResult,
				modelId: 'test-model',
				providerName: 'test-provider'
			});
			const generator = new BridgedStructuredGenerator(mockService);

			const schema = z.object({ value: z.string() });
			const options: AIPrimitiveOptions = {
				commandName: 'test-command'
			};

			await generator.generate('test prompt', schema, options);

			expect(mockService).toHaveBeenCalledWith(
				expect.objectContaining({
					objectName: 'generated_object'
				})
			);
		});

		it('should include error context without model/provider when not available', async () => {
			const mockService: GenerateObjectServiceFn = vi.fn().mockResolvedValue({
				mainResult: null
			});
			const generator = new BridgedStructuredGenerator(mockService);

			const schema = z.object({ value: z.string() });
			const options: AIPrimitiveOptions & { objectName?: string } = {
				commandName: 'test-command',
				objectName: 'test-object'
			};

			await expect(
				generator.generate('test prompt', schema, options)
			).rejects.toThrow(
				'AI service returned null or undefined result (objectName: test-object, commandName: test-command)'
			);
		});

		it('should handle zero tokens and missing telemetry gracefully', async () => {
			const mockResult = { value: 'test-value' };
			const mockService: GenerateObjectServiceFn = vi.fn().mockResolvedValue({
				mainResult: mockResult,
				telemetryData: null
			});
			const generator = new BridgedStructuredGenerator(mockService);

			const schema = z.object({ value: z.string() });
			const options: AIPrimitiveOptions = {
				commandName: 'test-command'
			};

			const result = await generator.generate('test prompt', schema, options);

			expect(result.usage).toEqual({
				inputTokens: 0,
				outputTokens: 0,
				model: 'unknown',
				provider: 'unknown',
				duration: expect.any(Number)
			});
		});
	});
});
