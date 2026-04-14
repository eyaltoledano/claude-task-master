import { jest } from '@jest/globals';

jest.unstable_mockModule('ai', () => ({
	generateObject: jest.fn(),
	generateText: jest.fn(),
	streamText: jest.fn()
}));

jest.unstable_mockModule('ai-sdk-provider-opencode-sdk', () => ({
	createOpencode: jest.fn((options) => {
		const provider = (modelId, settings) => ({ id: modelId, settings });
		provider.languageModel = jest.fn((id, settings) => ({ id, settings }));
		provider.chat = provider.languageModel;
		provider._options = options;
		return provider;
	})
}));

jest.unstable_mockModule('../../../scripts/modules/config-manager.js', () => ({
	getOpencodeSettingsForCommand: jest.fn(() => ({
		hostname: '127.0.0.1',
		port: 4096
	})),
	getSupportedModelsForProvider: jest.fn(() => [
		'anthropic/claude-sonnet-4-5',
		'openai/gpt-5.2',
		'github-copilot/claude-sonnet-4.5'
	]),
	getDebugFlag: jest.fn(() => false),
	getLogLevel: jest.fn(() => 'info')
}));

jest.unstable_mockModule('../../../src/ai-providers/base-provider.js', () => ({
	BaseAIProvider: class {
		constructor() {
			this.name = 'Base Provider';
		}
		handleError(_ctx, err) {
			throw err;
		}
		validateParams(params) {
			if (!params.modelId) throw new Error('Model ID is required');
		}
		validateMessages(msgs) {
			if (!Array.isArray(msgs)) throw new Error('Invalid messages array');
		}
	}
}));

const { OpencodeProvider } = await import(
	'../../../src/ai-providers/opencode.js'
);
const { createOpencode } = await import('ai-sdk-provider-opencode-sdk');
const { getOpencodeSettingsForCommand } = await import(
	'../../../scripts/modules/config-manager.js'
);

describe('OpencodeProvider', () => {
	let provider;

	beforeEach(() => {
		jest.clearAllMocks();
		provider = new OpencodeProvider();
	});

	it('sets provider name and supported models', () => {
		expect(provider.name).toBe('OpenCode');
		expect(provider.supportedModels).toEqual([
			'anthropic/claude-sonnet-4-5',
			'openai/gpt-5.2',
			'github-copilot/claude-sonnet-4.5'
		]);
	});

	it('does not require API key (OpenCode manages credentials)', () => {
		expect(provider.isRequiredApiKey()).toBe(false);
	});

	it('creates client with settings from config-manager', async () => {
		const client = await provider.getClient({ commandName: 'parse-prd' });
		expect(client).toBeDefined();
		expect(createOpencode).toHaveBeenCalledWith({
			hostname: '127.0.0.1',
			port: 4096
		});
		expect(getOpencodeSettingsForCommand).toHaveBeenCalledWith('parse-prd');
	});

	it('identifies supported models case-insensitively', () => {
		expect(provider.isModelSupported('anthropic/claude-sonnet-4-5')).toBe(true);
		expect(provider.isModelSupported('ANTHROPIC/CLAUDE-SONNET-4-5')).toBe(true);
		expect(provider.isModelSupported('unknown-model')).toBe(false);
		expect(provider.isModelSupported('')).toBe(false);
		expect(provider.isModelSupported(null)).toBe(false);
	});

	it('wraps initialization errors with install guidance when opencode missing', async () => {
		createOpencode.mockImplementationOnce(() => {
			const err = new Error('spawn opencode ENOENT');
			err.code = 'ENOENT';
			throw err;
		});
		await expect(
			provider.getClient({ commandName: 'parse-prd' })
		).rejects.toThrow(/OpenCode not available.*opencode\.ai/);
	});
});
