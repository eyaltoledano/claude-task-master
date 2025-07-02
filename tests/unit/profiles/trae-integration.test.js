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

describe('Trae Integration', () => {
	let tempDir;

	beforeEach(() => {
		jest.clearAllMocks();

		// Create a temporary directory for testing
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-master-test-'));

		// Spy on fs methods
		jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
		jest.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
			if (filePath.toString().includes('.trae')) {
				return 'Existing trae rules content';
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

	// Test function that simulates the createProjectStructure behavior for Trae files
	function mockCreateTraeStructure() {
		// Create main .trae directory
		fs.mkdirSync(path.join(tempDir, '.trae'), { recursive: true });

		// Create rules directory
		fs.mkdirSync(path.join(tempDir, '.trae', 'rules'), { recursive: true });

		// Create rule files
		const ruleFiles = [
			'dev_workflow.md',
			'taskmaster.md',
			'architecture.md',
			'commands.md',
			'dependencies.md'
		];

		for (const ruleFile of ruleFiles) {
			fs.writeFileSync(
				path.join(tempDir, '.trae', 'rules', ruleFile),
				`Content for ${ruleFile}`
			);
		}
	}

	test('creates all required .trae directories', () => {
		// Act
		mockCreateTraeStructure();

		// Assert
		expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(tempDir, '.trae'), {
			recursive: true
		});
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.trae', 'rules'),
			{ recursive: true }
		);
	});

	test('creates rule files for Trae', () => {
		// Act
		mockCreateTraeStructure();

		// Assert - check rule files are created
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, '.trae', 'rules', 'dev_workflow.md'),
			expect.any(String)
		);
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, '.trae', 'rules', 'taskmaster.md'),
			expect.any(String)
		);
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, '.trae', 'rules', 'architecture.md'),
			expect.any(String)
		);
	});

	test('does not create MCP configuration files', () => {
		// Act
		mockCreateTraeStructure();

		// Assert - Trae doesn't use MCP configuration
		expect(fs.writeFileSync).not.toHaveBeenCalledWith(
			path.join(tempDir, '.trae', 'mcp.json'),
			expect.any(String)
		);
	});
});
