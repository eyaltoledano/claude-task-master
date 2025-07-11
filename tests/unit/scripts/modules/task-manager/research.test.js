import { jest } from '@jest/globals';

jest.unstable_mockModule('../../../../../scripts/modules/utils.js', () => ({
	findProjectRoot: jest.fn(() => null),
	log: jest.fn(),
	readJSON: jest.fn(),
	flattenTasksWithSubtasks: jest.fn(() => []),
	isEmpty: jest.fn(() => false)
}));

// Mock UI-affecting external libs to minimal no-op implementations
jest.unstable_mockModule('chalk', () => ({
	default: new Proxy(
		{},
		{
			get: () => (str) => str
		}
	)
}));

jest.unstable_mockModule('boxen', () => ({ default: (text) => text }));

jest.unstable_mockModule('inquirer', () => ({
	default: { prompt: jest.fn() }
}));

jest.unstable_mockModule('cli-highlight', () => ({
	highlight: (code) => code
}));

jest.unstable_mockModule('cli-table3', () => ({
	default: jest.fn().mockImplementation(() => ({
		push: jest.fn(),
		toString: jest.fn(() => '')
	}))
}));

jest.unstable_mockModule(
	'../../../../../scripts/modules/utils/contextGatherer.js',
	() => ({
		ContextGatherer: jest.fn().mockImplementation(() => ({
			gather: jest.fn().mockResolvedValue({ context: '' })
		}))
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/utils/fuzzyTaskSearch.js',
	() => ({
		FuzzyTaskSearch: jest.fn().mockImplementation(() => ({
			findRelevantTasks: jest.fn(() => []),
			getTaskIds: jest.fn(() => [])
		}))
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/ai-services-unified.js',
	() => ({
		generateTextService: jest
			.fn()
			.mockResolvedValue({ mainResult: { content: '' }, telemetryData: {} })
	})
);

jest.unstable_mockModule('../../../../../scripts/modules/ui.js', () => ({
	displayAiUsageSummary: jest.fn(),
	startLoadingIndicator: jest.fn(() => ({ stop: jest.fn() })),
	stopLoadingIndicator: jest.fn()
}));

const { performResearch } = await import(
	'../../../../../scripts/modules/task-manager/research.js'
);

describe('performResearch project root validation', () => {
	it('throws error when project root cannot be determined', async () => {
		await expect(
			performResearch('Test query', {}, {}, 'json', false)
		).rejects.toThrow('Could not determine project root directory');
	});
});
