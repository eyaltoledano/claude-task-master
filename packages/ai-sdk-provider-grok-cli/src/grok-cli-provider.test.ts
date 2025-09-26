/**
 * Tests for Grok CLI provider
 */

import { NoSuchModelError } from '@ai-sdk/provider';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GrokCliLanguageModel } from './grok-cli-language-model.js';
import { createGrokCli, grokCli } from './grok-cli-provider.js';

// Mock the GrokCliLanguageModel
vi.mock('./grok-cli-language-model.js', () => ({
	GrokCliLanguageModel: vi.fn().mockImplementation((options) => ({
		modelId: options.id,
		settings: options.settings,
		provider: 'grok-cli'
	}))
}));

describe('createGrokCli', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should create a provider with default settings', () => {
		const provider = createGrokCli();
		expect(typeof provider).toBe('function');
		expect(typeof provider.languageModel).toBe('function');
		expect(typeof provider.chat).toBe('function');
		expect(typeof provider.textEmbeddingModel).toBe('function');
		expect(typeof provider.imageModel).toBe('function');
	});

	it('should create a provider with custom default settings', () => {
		const defaultSettings = {
			timeout: 5000,
			workingDirectory: '/custom/path'
		};
		const provider = createGrokCli({ defaultSettings });

		const model = provider('grok-2-mini');

		expect(GrokCliLanguageModel).toHaveBeenCalledWith({
			id: 'grok-2-mini',
			settings: defaultSettings
		});
	});

	it('should create language models with merged settings', () => {
		const defaultSettings = { timeout: 5000 };
		const provider = createGrokCli({ defaultSettings });

		const modelSettings = { apiKey: 'test-key' };
		const model = provider('grok-2', modelSettings);

		expect(GrokCliLanguageModel).toHaveBeenCalledWith({
			id: 'grok-2',
			settings: { timeout: 5000, apiKey: 'test-key' }
		});
	});

	it('should create models via languageModel method', () => {
		const provider = createGrokCli();
		const model = provider.languageModel('grok-2-mini', { timeout: 1000 });

		expect(GrokCliLanguageModel).toHaveBeenCalledWith({
			id: 'grok-2-mini',
			settings: { timeout: 1000 }
		});
	});

	it('should create models via chat method (alias)', () => {
		const provider = createGrokCli();
		const model = provider.chat('grok-2');

		expect(GrokCliLanguageModel).toHaveBeenCalledWith({
			id: 'grok-2',
			settings: {}
		});
	});

	it('should throw error when called with new keyword', () => {
		const provider = createGrokCli();
		expect(() => {
			// @ts-expect-error - intentionally testing invalid usage
			new provider('grok-2');
		}).toThrow(
			'The Grok CLI model function cannot be called with the new keyword.'
		);
	});

	it('should throw NoSuchModelError for textEmbeddingModel', () => {
		const provider = createGrokCli();
		expect(() => {
			provider.textEmbeddingModel('test-model');
		}).toThrow(NoSuchModelError);
	});

	it('should throw NoSuchModelError for imageModel', () => {
		const provider = createGrokCli();
		expect(() => {
			provider.imageModel('test-model');
		}).toThrow(NoSuchModelError);
	});
});

describe('default grokCli provider', () => {
	it('should be a pre-configured provider instance', () => {
		expect(typeof grokCli).toBe('function');
		expect(typeof grokCli.languageModel).toBe('function');
		expect(typeof grokCli.chat).toBe('function');
	});

	it('should create models with default configuration', () => {
		const model = grokCli('grok-2-mini');

		expect(GrokCliLanguageModel).toHaveBeenCalledWith({
			id: 'grok-2-mini',
			settings: {}
		});
	});
});
