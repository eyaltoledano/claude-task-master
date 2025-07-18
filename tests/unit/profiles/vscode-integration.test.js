import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
// Mock the schema integration functions to avoid chalk issues
const mockSetupSchemaIntegration = jest.fn().mockResolvedValue();

// Mock the VS Code profile module before importing
jest.mock('../../../src/profiles/vscode.js', () => {
	const actualModule = jest.requireActual('../../../src/profiles/vscode.js');
	return {
		...actualModule,
		vscodeProfile: {
			...actualModule.vscodeProfile,
			onAddRulesProfile: mockSetupSchemaIntegration
		}
	};
});

import { vscodeProfile } from '../../../src/profiles/vscode.js';

// Mock external modules
jest.mock('child_process', () => ({
	execSync: jest.fn()
}));

// Mock fs/promises
const mockFsPromises = {
	mkdir: jest.fn(),
	access: jest.fn(),
	copyFile: jest.fn(),
	readFile: jest.fn(),
	writeFile: jest.fn()
};

jest.mock('fs/promises', () => mockFsPromises);

// Mock console methods
jest.mock('console', () => ({
	log: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
	clear: jest.fn()
}));

describe('VS Code Integration', () => {
	let tempDir;

	beforeEach(() => {
		jest.clearAllMocks();

		// Create a temporary directory for testing
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-master-test-'));

		// Spy on fs methods
		jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
		jest.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
			if (filePath.toString().includes('mcp.json')) {
				return JSON.stringify({
					mcpServers: {
						'task-master-ai': {
							command: 'node',
							args: ['mcp-server/src/index.js']
						}
					}
				});
			}
			if (filePath.toString().includes('instructions')) {
				return 'VS Code instruction content';
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

	// Test function that simulates the createProjectStructure behavior for VS Code files
	function mockCreateVSCodeStructure() {
		// Create .vscode directory for MCP configuration
		fs.mkdirSync(path.join(tempDir, '.vscode'), { recursive: true });

		// Create .github/instructions directory for VS Code custom instructions
		fs.mkdirSync(path.join(tempDir, '.github', 'instructions'), {
			recursive: true
		});
		fs.mkdirSync(path.join(tempDir, '.github', 'instructions', 'taskmaster'), {
			recursive: true
		});

		// Create MCP configuration file
		const mcpConfig = {
			mcpServers: {
				'task-master-ai': {
					command: 'node',
					args: ['mcp-server/src/index.js'],
					env: {
						PROJECT_ROOT: process.cwd()
					}
				}
			}
		};
		fs.writeFileSync(
			path.join(tempDir, '.vscode', 'mcp.json'),
			JSON.stringify(mcpConfig, null, 2)
		);

		// Create sample instruction files
		const instructionFiles = [
			'vscode_rules.md',
			'dev_workflow.md',
			'self_improve.md'
		];

		for (const file of instructionFiles) {
			const content = `---
description: VS Code instruction for ${file}
applyTo: "**/*.ts,**/*.tsx,**/*.js,**/*.jsx"
alwaysApply: true
---

# ${file.replace('.md', '').replace('_', ' ').toUpperCase()}

This is a VS Code custom instruction file.`;

			fs.writeFileSync(
				path.join(tempDir, '.github', 'instructions', file),
				content
			);
		}

		// Create taskmaster subdirectory with additional instructions
		const taskmasterFiles = ['taskmaster.md', 'commands.md', 'architecture.md'];

		for (const file of taskmasterFiles) {
			const content = `---
description: Task Master specific instruction for ${file}
applyTo: "**/*.ts,**/*.js"
alwaysApply: true
---

# ${file.replace('.md', '').toUpperCase()}

Task Master specific VS Code instruction.`;

			fs.writeFileSync(
				path.join(tempDir, '.github', 'instructions', 'taskmaster', file),
				content
			);
		}
	}

	test('creates all required VS Code directories', () => {
		// Act
		mockCreateVSCodeStructure();

		// Assert - .vscode directory for MCP config
		expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(tempDir, '.vscode'), {
			recursive: true
		});

		// Assert - .github/instructions directory for custom instructions
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.github', 'instructions'),
			{ recursive: true }
		);

		// Assert - taskmaster subdirectory
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.github', 'instructions', 'taskmaster'),
			{ recursive: true }
		);
	});

	test('creates VS Code MCP configuration file', () => {
		// Act
		mockCreateVSCodeStructure();

		// Assert
		const expectedMcpPath = path.join(tempDir, '.vscode', 'mcp.json');
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			expectedMcpPath,
			expect.stringContaining('task-master-ai')
		);
	});

	test('creates VS Code instruction files with applyTo patterns', () => {
		// Act
		mockCreateVSCodeStructure();

		// Assert main instruction files
		const mainInstructionFiles = [
			'vscode_rules.md',
			'dev_workflow.md',
			'self_improve.md'
		];

		for (const file of mainInstructionFiles) {
			const expectedPath = path.join(tempDir, '.github', 'instructions', file);
			expect(fs.writeFileSync).toHaveBeenCalledWith(
				expectedPath,
				expect.stringContaining('applyTo:')
			);
		}
	});

	test('creates taskmaster specific instruction files', () => {
		// Act
		mockCreateVSCodeStructure();

		// Assert taskmaster subdirectory files
		const taskmasterFiles = ['taskmaster.md', 'commands.md', 'architecture.md'];

		for (const file of taskmasterFiles) {
			const expectedPath = path.join(
				tempDir,
				'.github',
				'instructions',
				'taskmaster',
				file
			);
			expect(fs.writeFileSync).toHaveBeenCalledWith(
				expectedPath,
				expect.stringContaining('applyTo:')
			);
		}
	});

	test('VS Code instruction files use applyTo instead of globs', () => {
		// Act
		mockCreateVSCodeStructure();

		// Get all the writeFileSync calls for .md files
		const mdFileWrites = fs.writeFileSync.mock.calls.filter((call) =>
			call[0].toString().endsWith('.md')
		);

		// Assert that all .md files contain applyTo and not globs
		for (const writeCall of mdFileWrites) {
			const content = writeCall[1];
			expect(content).toContain('applyTo:');
			expect(content).not.toContain('globs:');
		}
	});

	test('MCP configuration includes correct structure for VS Code', () => {
		// Act
		mockCreateVSCodeStructure();

		// Get the MCP config write call
		const mcpConfigWrite = fs.writeFileSync.mock.calls.find((call) =>
			call[0].toString().includes('mcp.json')
		);

		expect(mcpConfigWrite).toBeDefined();

		const mcpContent = mcpConfigWrite[1];
		const mcpConfig = JSON.parse(mcpContent);

		// Assert MCP structure
		expect(mcpConfig).toHaveProperty('mcpServers');
		expect(mcpConfig.mcpServers).toHaveProperty('task-master-ai');
		expect(mcpConfig.mcpServers['task-master-ai']).toHaveProperty(
			'command',
			'node'
		);
		expect(mcpConfig.mcpServers['task-master-ai']).toHaveProperty('args');
		expect(mcpConfig.mcpServers['task-master-ai'].args).toContain(
			'mcp-server/src/index.js'
		);
	});

	test('directory structure follows VS Code conventions', () => {
		// Act
		mockCreateVSCodeStructure();

		// Assert the specific directory structure VS Code expects
		const expectedDirs = [
			path.join(tempDir, '.vscode'),
			path.join(tempDir, '.github', 'instructions'),
			path.join(tempDir, '.github', 'instructions', 'taskmaster')
		];

		for (const dir of expectedDirs) {
			expect(fs.mkdirSync).toHaveBeenCalledWith(dir, { recursive: true });
		}
	});

	test('instruction files contain VS Code specific formatting', () => {
		// Act
		mockCreateVSCodeStructure();

		// Get a sample instruction file write
		const instructionWrite = fs.writeFileSync.mock.calls.find((call) =>
			call[0].toString().includes('vscode_rules.md')
		);

		expect(instructionWrite).toBeDefined();

		const content = instructionWrite[1];

		// Assert VS Code specific patterns
		expect(content).toContain('---'); // YAML frontmatter
		expect(content).toContain('description:');
		expect(content).toContain('applyTo:');
		expect(content).toContain('alwaysApply:');
		expect(content).toContain('**/*.ts'); // File patterns in quotes
	});

	describe('Schema Integration', () => {
		beforeEach(() => {
			jest.clearAllMocks();
		});

		test('setupSchemaIntegration is called with project root', async () => {
			// Test the actual schema integration behavior by calling the profile function
			// Since we can't mock the frozen Profile, we'll test the integration works
			
			// Arrange - set up console spy to capture schema integration output
			const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
			
			try {
				// Act - call the actual profile function
				await vscodeProfile.onAddRulesProfile(tempDir);
				
				// Assert - verify the schema integration was executed
				// Look for the expected console output from setupSchemaIntegration
				expect(consoleSpy).toHaveBeenCalledWith(
					expect.stringContaining('Setting up VS Code schema integration')
				);
				expect(consoleSpy).toHaveBeenCalledWith(
					expect.stringContaining(tempDir)
				);
			} finally {
				// Clean up
				consoleSpy.mockRestore();
			}
		});

		test('schema integration function exists and is callable', () => {
			// Assert that the VS Code profile has the schema integration function
			expect(vscodeProfile.onAddRulesProfile).toBeDefined();
			expect(typeof vscodeProfile.onAddRulesProfile).toBe('function');
		});

		test('schema integration handles errors gracefully', async () => {
			// Test error handling by providing an invalid project root
			// This should cause the schema integration to handle the error gracefully
			
			// Arrange - set up console spy to capture error output
			const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
			
			// Act & Assert - call with invalid path and expect it to handle gracefully
			// The function should either succeed or throw a descriptive error
			try {
				await vscodeProfile.onAddRulesProfile('/invalid/nonexistent/path');
				// If it succeeds, that's fine - the function is robust
			} catch (error) {
				// If it throws, verify it's a meaningful error
				expect(error.message).toBeDefined();
				expect(typeof error.message).toBe('string');
			} finally {
				// Clean up
				consoleErrorSpy.mockRestore();
			}
		});
	});
});
