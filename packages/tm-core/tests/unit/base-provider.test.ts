/**
 * @fileoverview Unit tests for BaseProvider abstract class
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
	ERROR_CODES,
	TaskMasterError
} from '../../src/errors/task-master-error';
import { MockProvider } from '../mocks/mock-provider';

describe('BaseProvider', () => {
	describe('constructor', () => {
		it('should require an API key', () => {
			expect(() => {
				new MockProvider({ apiKey: '' });
			}).toThrow(TaskMasterError);
		});

		it('should initialize with provided API key and model', () => {
			const provider = new MockProvider({
				apiKey: 'test-key',
				model: 'mock-model-v2'
			});

			expect(provider.getModel()).toBe('mock-model-v2');
		});

		it('should use default model if not provided', () => {
			const provider = new MockProvider({ apiKey: 'test-key' });
			expect(provider.getModel()).toBe('mock-model-v1');
		});
	});

	describe('generateCompletion', () => {
		let provider: MockProvider;

		beforeEach(() => {
			provider = new MockProvider({ apiKey: 'test-key' });
		});

		it('should successfully generate a completion', async () => {
			const response = await provider.generateCompletion('Test prompt');

			expect(response).toMatchObject({
				content: 'Mock response to: Test prompt',
				provider: 'mock',
				model: 'mock-model-v1',
				inputTokens: expect.any(Number),
				outputTokens: expect.any(Number),
				totalTokens: expect.any(Number),
				duration: expect.any(Number),
				timestamp: expect.any(String)
			});
		});

		it('should validate empty prompts', async () => {
			await expect(provider.generateCompletion('')).rejects.toThrow(
				'Prompt must be a non-empty string'
			);
		});

		it('should validate prompt type', async () => {
			await expect(provider.generateCompletion(null as any)).rejects.toThrow(
				'Prompt must be a non-empty string'
			);
		});

		it('should validate temperature range', async () => {
			await expect(
				provider.generateCompletion('Test', { temperature: 3 })
			).rejects.toThrow('Temperature must be between 0 and 2');
		});

		it('should validate maxTokens range', async () => {
			await expect(
				provider.generateCompletion('Test', { maxTokens: 0 })
			).rejects.toThrow('Max tokens must be between 1 and 100000');
		});

		it('should validate topP range', async () => {
			await expect(
				provider.generateCompletion('Test', { topP: 1.5 })
			).rejects.toThrow('Top-p must be between 0 and 1');
		});
	});

	describe('retry logic', () => {
		it('should retry on rate limit errors', async () => {
			const provider = new MockProvider({
				apiKey: 'test-key',
				failAfterAttempts: 2,
				simulateRateLimit: true,
				responseDelay: 10
			});

			const response = await provider.generateCompletion('Test prompt');

			expect(response.content).toBe('Mock response to: Test prompt');
			expect(provider.getAttemptCount()).toBe(3); // 2 failures + 1 success
		});

		it('should retry on timeout errors', async () => {
			const provider = new MockProvider({
				apiKey: 'test-key',
				failAfterAttempts: 1,
				simulateTimeout: true
			});

			const response = await provider.generateCompletion('Test prompt');

			expect(response.content).toBe('Mock response to: Test prompt');
			expect(provider.getAttemptCount()).toBe(2); // 1 failure + 1 success
		});

		it('should fail after max retries', async () => {
			const provider = new MockProvider({
				apiKey: 'test-key',
				shouldFail: true
			});

			await expect(provider.generateCompletion('Test prompt')).rejects.toThrow(
				'mock provider error'
			);
		});

		it('should calculate exponential backoff delays', () => {
			const provider = new MockProvider({ apiKey: 'test-key' });

			// Access protected method through type assertion
			const calculateDelay = (provider as any).calculateBackoffDelay.bind(
				provider
			);

			const delay1 = calculateDelay(1);
			const delay2 = calculateDelay(2);
			const delay3 = calculateDelay(3);

			// Check exponential growth (with jitter, so use ranges)
			expect(delay1).toBeGreaterThanOrEqual(900);
			expect(delay1).toBeLessThanOrEqual(1100);

			expect(delay2).toBeGreaterThanOrEqual(1800);
			expect(delay2).toBeLessThanOrEqual(2200);

			expect(delay3).toBeGreaterThanOrEqual(3600);
			expect(delay3).toBeLessThanOrEqual(4400);
		});
	});

	describe('error handling', () => {
		it('should wrap provider errors properly', async () => {
			const provider = new MockProvider({
				apiKey: 'test-key',
				shouldFail: true
			});

			try {
				await provider.generateCompletion('Test prompt');
				expect.fail('Should have thrown an error');
			} catch (error) {
				expect(error).toBeInstanceOf(TaskMasterError);
				const tmError = error as TaskMasterError;
				expect(tmError.code).toBe(ERROR_CODES.PROVIDER_ERROR);
				expect(tmError.context.operation).toBe('generateCompletion');
				expect(tmError.context.resource).toBe('mock');
			}
		});

		it('should identify rate limit errors correctly', () => {
			const provider = new MockProvider({ apiKey: 'test-key' });
			const isRateLimitError = (provider as any).isRateLimitError.bind(
				provider
			);

			expect(isRateLimitError(new Error('Rate limit exceeded'))).toBe(true);
			expect(isRateLimitError(new Error('Too many requests'))).toBe(true);
			expect(isRateLimitError(new Error('Status: 429'))).toBe(true);
			expect(isRateLimitError(new Error('Some other error'))).toBe(false);
		});

		it('should identify timeout errors correctly', () => {
			const provider = new MockProvider({ apiKey: 'test-key' });
			const isTimeoutError = (provider as any).isTimeoutError.bind(provider);

			expect(isTimeoutError(new Error('Request timeout'))).toBe(true);
			expect(isTimeoutError(new Error('Operation timed out'))).toBe(true);
			expect(isTimeoutError(new Error('ECONNRESET'))).toBe(true);
			expect(isTimeoutError(new Error('Some other error'))).toBe(false);
		});

		it('should identify network errors correctly', () => {
			const provider = new MockProvider({ apiKey: 'test-key' });
			const isNetworkError = (provider as any).isNetworkError.bind(provider);

			expect(isNetworkError(new Error('Network error'))).toBe(true);
			expect(isNetworkError(new Error('ENOTFOUND'))).toBe(true);
			expect(isNetworkError(new Error('ECONNREFUSED'))).toBe(true);
			expect(isNetworkError(new Error('Some other error'))).toBe(false);
		});
	});

	describe('model management', () => {
		it('should get and set model', () => {
			const provider = new MockProvider({ apiKey: 'test-key' });

			expect(provider.getModel()).toBe('mock-model-v1');

			provider.setModel('mock-model-v2');
			expect(provider.getModel()).toBe('mock-model-v2');
		});
	});

	describe('provider information', () => {
		it('should return provider info', () => {
			const provider = new MockProvider({ apiKey: 'test-key' });
			const info = provider.getProviderInfo();

			expect(info.name).toBe('mock');
			expect(info.displayName).toBe('Mock Provider');
			expect(info.requiresApiKey).toBe(true);
			expect(info.models).toHaveLength(2);
		});

		it('should return available models', () => {
			const provider = new MockProvider({ apiKey: 'test-key' });
			const models = provider.getAvailableModels();

			expect(models).toHaveLength(2);
			expect(models[0].id).toBe('mock-model-v1');
			expect(models[1].id).toBe('mock-model-v2');
		});

		it('should validate credentials', async () => {
			const validProvider = new MockProvider({ apiKey: 'valid-key' });
			const invalidProvider = new MockProvider({ apiKey: 'invalid-key' });

			expect(await validProvider.validateCredentials()).toBe(true);
			expect(await invalidProvider.validateCredentials()).toBe(false);
		});
	});

	describe('template method pattern', () => {
		it('should follow the template method flow', async () => {
			const provider = new MockProvider({
				apiKey: 'test-key',
				responseDelay: 50
			});

			const startTime = Date.now();
			const response = await provider.generateCompletion('Test prompt', {
				temperature: 0.5,
				maxTokens: 100
			});
			const endTime = Date.now();

			// Verify the response was processed through the template
			expect(response.content).toBeDefined();
			expect(response.duration).toBeGreaterThanOrEqual(50);
			expect(response.duration).toBeLessThanOrEqual(endTime - startTime + 10);
			expect(response.timestamp).toBeDefined();
			expect(response.provider).toBe('mock');
		});
	});
});
