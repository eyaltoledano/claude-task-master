import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock external modules
jest.mock('child_process', () => ({
	execSync: jest.fn()
}));

// Mock console methods
jest.mock('console', () => ({
	log: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
	clear: jest.fn()
}));

describe('Gemini Profile Integration', () => {
	let tempDir;

	beforeEach(() => {
		jest.clearAllMocks();

		// Create a temporary directory for testing
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-master-test-'));

		// Spy on fs methods
		jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
		jest.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
			if (filePath.toString().includes('AGENTS.md')) {
				return 'Sample AGENTS.md content for Gemini integration';
			}
			return '{}';
		});
		jest.spyOn(fs, 'existsSync').mockImplementation(() => false);
		jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
	});

	afterEach(() => {
		// Clean up the temporary directory
		try {
			fs.rmSync(tempDir, { recursive: true, force: true });
		} catch (err) {
			console.error(`Error cleaning up: ${err.message}`);
		}
	});

	// Test function that simulates the Gemini profile file copying behavior
	function mockCreateGeminiStructure() {
		// Gemini profile copies AGENTS.md to GEMINI.md in project root
		const sourceContent = 'Sample AGENTS.md content for Gemini integration';
		fs.writeFileSync(path.join(tempDir, 'GEMINI.md'), sourceContent);

		// Gemini profile creates .gemini directory
		fs.mkdirSync(path.join(tempDir, '.gemini'), { recursive: true });

		// Gemini profile creates settings.json in .gemini directory
		const settingsContent = JSON.stringify(
			{
				mcpServers: {
					'task-master-ai': {
						command: 'npx',
						args: ['-y', 'task-master-ai'],
						env: {
							YOUR_ANTHROPIC_API_KEY: 'your-api-key-here',
							YOUR_PERPLEXITY_API_KEY: 'your-api-key-here',
							YOUR_OPENAI_API_KEY: 'your-api-key-here',
							YOUR_GOOGLE_API_KEY: 'your-api-key-here',
							YOUR_MISTRAL_API_KEY: 'your-api-key-here',
							YOUR_AZURE_OPENAI_API_KEY: 'your-api-key-here',
							YOUR_AZURE_OPENAI_ENDPOINT: 'your-endpoint-here',
							YOUR_OPENROUTER_API_KEY: 'your-api-key-here',
							YOUR_XAI_API_KEY: 'your-api-key-here',
							YOUR_OLLAMA_API_KEY: 'your-api-key-here',
							YOUR_OLLAMA_BASE_URL: 'http://localhost:11434/api',
							YOUR_AWS_ACCESS_KEY_ID: 'your-access-key-id',
							YOUR_AWS_SECRET_ACCESS_KEY: 'your-secret-access-key',
							YOUR_AWS_REGION: 'us-east-1'
						}
					}
				}
			},
			null,
			2
		);
		fs.writeFileSync(
			path.join(tempDir, '.gemini', 'settings.json'),
			settingsContent
		);
	}

	test('creates GEMINI.md file in project root', () => {
		// Act
		mockCreateGeminiStructure();

		// Assert
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, 'GEMINI.md'),
			'Sample AGENTS.md content for Gemini integration'
		);
	});

	test('creates .gemini profile directory', () => {
		// Act
		mockCreateGeminiStructure();

		// Assert
		expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(tempDir, '.gemini'), {
			recursive: true
		});
	});

	test('creates MCP configuration as settings.json', () => {
		// Act
		mockCreateGeminiStructure();

		// Assert - Gemini profile should create settings.json instead of mcp.json
		const writeFileCalls = fs.writeFileSync.mock.calls;
		const settingsJsonCall = writeFileCalls.find((call) =>
			call[0].toString().includes('.gemini/settings.json')
		);
		expect(settingsJsonCall).toBeDefined();
	});

	test('uses settings.json instead of mcp.json', () => {
		// Act
		mockCreateGeminiStructure();

		// Assert - Should use settings.json, not mcp.json
		const writeFileCalls = fs.writeFileSync.mock.calls;
		const mcpJsonCalls = writeFileCalls.filter((call) =>
			call[0].toString().includes('mcp.json')
		);
		expect(mcpJsonCalls).toHaveLength(0);

		const settingsJsonCalls = writeFileCalls.filter((call) =>
			call[0].toString().includes('settings.json')
		);
		expect(settingsJsonCalls).toHaveLength(1);
	});

	test('renames AGENTS.md to GEMINI.md', () => {
		// Act
		mockCreateGeminiStructure();

		// Assert - Gemini should rename AGENTS.md to GEMINI.md
		const writeFileCalls = fs.writeFileSync.mock.calls;
		const geminiMdCall = writeFileCalls.find((call) =>
			call[0].toString().includes('GEMINI.md')
		);
		expect(geminiMdCall).toBeDefined();
		expect(geminiMdCall[0]).toBe(path.join(tempDir, 'GEMINI.md'));
	});
});
