import { jest } from '@jest/globals';

// Mock the ai module
jest.unstable_mockModule('ai', () => ({
	generateObject: jest.fn(),
	generateText: jest.fn(),
	streamText: jest.fn()
}));

// Mock the codex-cli SDK module
jest.unstable_mockModule('ai-sdk-provider-codex-cli', () => ({
	createCodexCli: jest.fn((options) => {
		const provider = (modelId, settings) => ({ id: modelId, settings });
		provider.languageModel = jest.fn((id, settings) => ({ id, settings }));
		provider.chat = provider.languageModel;
		return provider;
	})
}));

// Mock child_process for system Codex path detection
jest.unstable_mockModule('child_process', () => ({
	execSync: jest.fn(() => '/usr/local/bin/codex\n'),
	exec: jest.fn(),
	spawn: jest.fn()
}));

// Mock config getters
jest.unstable_mockModule('../../../scripts/modules/config-manager.js', () => ({
	getCodexCliSettingsForCommand: jest.fn(() => ({ allowNpx: true })),
	getSupportedModelsForProvider: jest.fn(() => [
		'gpt-5',
		'gpt-5-codex',
		'gpt-5.1',
		'gpt-5.1-codex-max',
		'gpt-5.2'
	]),
	// Provide commonly imported getters to satisfy other module imports if any
	getDebugFlag: jest.fn(() => false),
	getLogLevel: jest.fn(() => 'info')
}));

// Mock base provider
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

const { CodexCliProvider } = await import(
	'../../../src/ai-providers/codex-cli.js'
);
const { createCodexCli } = await import('ai-sdk-provider-codex-cli');
const { execSync } = await import('child_process');
const { getCodexCliSettingsForCommand } = await import(
	'../../../scripts/modules/config-manager.js'
);

describe('CodexCliProvider', () => {
	let provider;

	beforeEach(() => {
		jest.clearAllMocks();
		provider = new CodexCliProvider();
	});

	it('sets provider name and supported models', () => {
		expect(provider.name).toBe('Codex CLI');
		expect(provider.supportedModels).toEqual([
			'gpt-5',
			'gpt-5-codex',
			'gpt-5.1',
			'gpt-5.1-codex-max',
			'gpt-5.2'
		]);
	});

	it('does not require API key', () => {
		expect(provider.isRequiredApiKey()).toBe(false);
	});

	it('creates client with merged default settings', async () => {
		const client = await provider.getClient({ commandName: 'parse-prd' });
		expect(client).toBeDefined();
		expect(createCodexCli).toHaveBeenCalledWith({
			defaultSettings: expect.objectContaining({
				allowNpx: true,
				codexPath: '/usr/local/bin/codex'
			})
		});
		expect(getCodexCliSettingsForCommand).toHaveBeenCalledWith('parse-prd');
	});

	it('preserves explicitly configured codexPath over system Codex path', async () => {
		getCodexCliSettingsForCommand.mockReturnValueOnce({
			allowNpx: true,
			codexPath: '/custom/bin/codex'
		});

		await provider.getClient({ commandName: 'parse-prd' });

		expect(createCodexCli).toHaveBeenCalledWith({
			defaultSettings: expect.objectContaining({
				allowNpx: true,
				codexPath: '/custom/bin/codex'
			})
		});
		expect(execSync).not.toHaveBeenCalled();
	});

	it('omits codexPath when neither config nor system provides one', async () => {
		execSync.mockImplementationOnce(() => {
			throw new Error('not found');
		});

		await provider.getClient({ commandName: 'parse-prd' });

		const call = createCodexCli.mock.calls.at(-1)[0];
		expect(call.defaultSettings.codexPath).toBeUndefined();
	});

	it('caches system codexPath lookup across getClient calls', async () => {
		await provider.getClient({ commandName: 'parse-prd' });
		await provider.getClient({ commandName: 'expand' });

		expect(execSync).toHaveBeenCalledTimes(1);
		expect(createCodexCli.mock.calls[1][0].defaultSettings.codexPath).toBe(
			'/usr/local/bin/codex'
		);
	});

	it('injects OPENAI_API_KEY only when apiKey provided', async () => {
		const client = await provider.getClient({
			commandName: 'expand',
			apiKey: 'sk-test'
		});
		const call = createCodexCli.mock.calls[0][0];
		expect(call.defaultSettings.env.OPENAI_API_KEY).toBe('sk-test');
		// Ensure env is not set when apiKey not provided
		await provider.getClient({ commandName: 'expand' });
		const second = createCodexCli.mock.calls[1][0];
		expect(second.defaultSettings.env).toBeUndefined();
	});
});
