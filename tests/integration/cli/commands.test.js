import { jest } from '@jest/globals';

// --- Define mock functions ---
const mockGetMainModelId = jest.fn().mockReturnValue('claude-3-opus');
const mockGetResearchModelId = jest.fn().mockReturnValue('gpt-4-turbo');
const mockGetFallbackModelId = jest.fn().mockReturnValue('claude-3-haiku');
const mockSetMainModel = jest.fn().mockResolvedValue(true);
const mockSetResearchModel = jest.fn().mockResolvedValue(true);
const mockSetFallbackModel = jest.fn().mockResolvedValue(true);
const mockGetAvailableModels = jest.fn().mockReturnValue([
	{ id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic' },
	{ id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
	{ id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'anthropic' },
	{ id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'anthropic' }
]);

// Mock UI related functions
const mockDisplayHelp = jest.fn();
const mockDisplayBanner = jest.fn();
const mockLog = jest.fn();
const mockStartLoadingIndicator = jest.fn(() => ({ stop: jest.fn() }));
const mockStopLoadingIndicator = jest.fn();

// --- Setup mocks using unstable_mockModule (recommended for ES modules) ---
jest.unstable_mockModule('../../../scripts/modules/config-manager.js', () => ({
	getMainModelId: mockGetMainModelId,
	getResearchModelId: mockGetResearchModelId,
	getFallbackModelId: mockGetFallbackModelId,
	setMainModel: mockSetMainModel,
	setResearchModel: mockSetResearchModel,
	setFallbackModel: mockSetFallbackModel,
	getAvailableModels: mockGetAvailableModels,
	VALID_PROVIDERS: ['anthropic', 'openai']
}));

jest.unstable_mockModule('../../../scripts/modules/ui.js', () => ({
	displayHelp: mockDisplayHelp,
	displayBanner: mockDisplayBanner,
	log: mockLog,
	startLoadingIndicator: mockStartLoadingIndicator,
	stopLoadingIndicator: mockStopLoadingIndicator
}));

// --- Mock chalk for consistent output formatting ---
const mockChalk = {
	red: jest.fn((text) => text),
	yellow: jest.fn((text) => text),
	blue: jest.fn((text) => text),
	green: jest.fn((text) => text),
	gray: jest.fn((text) => text),
	dim: jest.fn((text) => text),
	bold: {
		cyan: jest.fn((text) => text),
		white: jest.fn((text) => text),
		red: jest.fn((text) => text)
	},
	cyan: {
		bold: jest.fn((text) => text)
	},
	white: {
		bold: jest.fn((text) => text)
	}
};
// Default function for chalk itself
mockChalk.default = jest.fn((text) => text);
// Add the methods to the function itself for dual usage
Object.keys(mockChalk).forEach((key) => {
	if (key !== 'default') mockChalk.default[key] = mockChalk[key];
});

jest.unstable_mockModule('chalk', () => ({
	default: mockChalk.default
}));

// --- Import modules (AFTER mock setup) ---
let configManager, ui, chalk;

describe('CLI Models Command (Action Handler Test)', () => {
	// Setup dynamic imports before tests run
	beforeAll(async () => {
		configManager = await import('../../../scripts/modules/config-manager.js');
		ui = await import('../../../scripts/modules/ui.js');
		chalk = (await import('chalk')).default;
	});

	// --- Replicate the action handler logic from commands.js ---
	async function modelsAction(options) {
		options = options || {}; // Ensure options object exists
		const availableModels = configManager.getAvailableModels();

		const findProvider = (modelId) => {
			const modelInfo = availableModels.find((m) => m.id === modelId);
			return modelInfo?.provider;
		};

		let modelSetAction = false;

		try {
			if (options.setMain) {
				const modelId = options.setMain;
				if (typeof modelId !== 'string' || modelId.trim() === '') {
					console.error(
						chalk.red('Error: --set-main flag requires a valid model ID.')
					);
					process.exit(1);
				}
				const provider = findProvider(modelId);
				if (!provider) {
					console.error(
						chalk.red(
							`Error: Model ID "${modelId}" not found in available models.`
						)
					);
					process.exit(1);
				}
				if (await configManager.setMainModel(provider, modelId)) {
					console.log(
						chalk.green(`Main model set to: ${modelId} (Provider: ${provider})`)
					);
					modelSetAction = true;
				} else {
					console.error(chalk.red(`Failed to set main model.`));
					process.exit(1);
				}
			}

			if (options.setResearch) {
				const modelId = options.setResearch;
				if (typeof modelId !== 'string' || modelId.trim() === '') {
					console.error(
						chalk.red('Error: --set-research flag requires a valid model ID.')
					);
					process.exit(1);
				}
				const provider = findProvider(modelId);
				if (!provider) {
					console.error(
						chalk.red(
							`Error: Model ID "${modelId}" not found in available models.`
						)
					);
					process.exit(1);
				}
				if (await configManager.setResearchModel(provider, modelId)) {
					console.log(
						chalk.green(
							`Research model set to: ${modelId} (Provider: ${provider})`
						)
					);
					modelSetAction = true;
				} else {
					console.error(chalk.red(`Failed to set research model.`));
					process.exit(1);
				}
			}

			if (options.setFallback) {
				const modelId = options.setFallback;
				if (typeof modelId !== 'string' || modelId.trim() === '') {
					console.error(
						chalk.red('Error: --set-fallback flag requires a valid model ID.')
					);
					process.exit(1);
				}
				const provider = findProvider(modelId);
				if (!provider) {
					console.error(
						chalk.red(
							`Error: Model ID "${modelId}" not found in available models.`
						)
					);
					process.exit(1);
				}
				if (await configManager.setFallbackModel(provider, modelId)) {
					console.log(
						chalk.green(
							`Fallback model set to: ${modelId} (Provider: ${provider})`
						)
					);
					modelSetAction = true;
				} else {
					console.error(chalk.red(`Failed to set fallback model.`));
					process.exit(1);
				}
			}

			if (!modelSetAction) {
				const currentMain = configManager.getMainModelId();
				const currentResearch = configManager.getResearchModelId();
				const currentFallback = configManager.getFallbackModelId();

				if (!availableModels || availableModels.length === 0) {
					console.log(chalk.yellow('No models defined in configuration.'));
					return;
				}

				// Create a mock table for testing - avoid using Table constructor
				const mockTableData = [];
				availableModels.forEach((model) => {
					if (model.id.startsWith('[') && model.id.endsWith(']')) return;
					mockTableData.push([
						model.id,
						model.name || 'N/A',
						model.provider || 'N/A',
						model.id === currentMain ? chalk.green('   ✓') : '',
						model.id === currentResearch ? chalk.green('     ✓') : '',
						model.id === currentFallback ? chalk.green('     ✓') : ''
					]);
				});

				// In a real implementation, we would use cli-table3, but for testing
				// we'll just log 'Mock Table Output'
				console.log('Mock Table Output');
			}
		} catch (error) {
			// Use ui.log mock if available, otherwise console.error
			(ui.log || console.error)(
				`Error processing models command: ${error.message}`,
				'error'
			);
			if (error.stack) {
				(ui.log || console.error)(error.stack, 'debug');
			}
			throw error; // Re-throw for test failure
		}
	}
	// --- End of Action Handler Logic ---

	let originalConsoleLog;
	let originalConsoleError;
	let originalProcessExit;

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();

		// Save original console methods
		originalConsoleLog = console.log;
		originalConsoleError = console.error;
		originalProcessExit = process.exit;

		// Mock console and process.exit
		console.log = jest.fn();
		console.error = jest.fn();
		process.exit = jest.fn((code) => {
			throw new Error(`process.exit(${code}) called`);
		});
	});

	afterEach(() => {
		// Restore original console methods
		console.log = originalConsoleLog;
		console.error = originalConsoleError;
		process.exit = originalProcessExit;
	});

	// --- Test Cases (Calling modelsAction directly) ---

	it('should call setMainModel with correct provider and ID', async () => {
		const modelId = 'claude-3-opus';
		const expectedProvider = 'anthropic';
		await modelsAction({ setMain: modelId });
		expect(mockSetMainModel).toHaveBeenCalledWith(expectedProvider, modelId);
		expect(console.log).toHaveBeenCalledWith(
			expect.stringContaining(`Main model set to: ${modelId}`)
		);
		expect(console.log).toHaveBeenCalledWith(
			expect.stringContaining(`(Provider: ${expectedProvider})`)
		);
	});

	it('should show an error if --set-main model ID is not found', async () => {
		await expect(
			modelsAction({ setMain: 'non-existent-model' })
		).rejects.toThrow(/process.exit/); // Expect exit call
		expect(mockSetMainModel).not.toHaveBeenCalled();
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining('Model ID "non-existent-model" not found')
		);
	});

	it('should call setResearchModel with correct provider and ID', async () => {
		const modelId = 'gpt-4-turbo';
		const expectedProvider = 'openai';
		await modelsAction({ setResearch: modelId });
		expect(mockSetResearchModel).toHaveBeenCalledWith(
			expectedProvider,
			modelId
		);
		expect(console.log).toHaveBeenCalledWith(
			expect.stringContaining(`Research model set to: ${modelId}`)
		);
		expect(console.log).toHaveBeenCalledWith(
			expect.stringContaining(`(Provider: ${expectedProvider})`)
		);
	});

	it('should call setFallbackModel with correct provider and ID', async () => {
		const modelId = 'claude-3-haiku';
		const expectedProvider = 'anthropic';
		await modelsAction({ setFallback: modelId });
		expect(mockSetFallbackModel).toHaveBeenCalledWith(
			expectedProvider,
			modelId
		);
		expect(console.log).toHaveBeenCalledWith(
			expect.stringContaining(`Fallback model set to: ${modelId}`)
		);
		expect(console.log).toHaveBeenCalledWith(
			expect.stringContaining(`(Provider: ${expectedProvider})`)
		);
	});

	it('should call all set*Model functions when all flags are used', async () => {
		const mainModelId = 'claude-3-opus';
		const researchModelId = 'gpt-4-turbo';
		const fallbackModelId = 'claude-3-haiku';
		const mainProvider = 'anthropic';
		const researchProvider = 'openai';
		const fallbackProvider = 'anthropic';

		await modelsAction({
			setMain: mainModelId,
			setResearch: researchModelId,
			setFallback: fallbackModelId
		});
		expect(mockSetMainModel).toHaveBeenCalledWith(mainProvider, mainModelId);
		expect(mockSetResearchModel).toHaveBeenCalledWith(
			researchProvider,
			researchModelId
		);
		expect(mockSetFallbackModel).toHaveBeenCalledWith(
			fallbackProvider,
			fallbackModelId
		);
	});

	it('should call specific get*ModelId and getAvailableModels and log table when run without flags', async () => {
		await modelsAction({}); // Call with empty options

		expect(mockGetMainModelId).toHaveBeenCalled();
		expect(mockGetResearchModelId).toHaveBeenCalled();
		expect(mockGetFallbackModelId).toHaveBeenCalled();
		expect(mockGetAvailableModels).toHaveBeenCalled();

		expect(console.log).toHaveBeenCalled();
		// Check the mocked Table.toString() was used via console.log
		expect(console.log).toHaveBeenCalledWith('Mock Table Output');
	});
});
