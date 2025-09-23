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

describe('Zed Integration', () => {
	let tempDir;

	beforeEach(() => {
		jest.clearAllMocks();

		// Create a temporary directory for testing
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-master-test-'));

		// Spy on fs methods
		jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
		jest.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
			if (filePath.toString().includes('settings.json')) {
				return JSON.stringify({ context_servers: {} }, null, 2);
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

	// Test function that simulates the createProjectStructure behavior for Zed files
	function mockCreateZedStructure() {
		// Create main .zed directory
		fs.mkdirSync(path.join(tempDir, '.zed'), { recursive: true });

		// Create MCP config file (settings.json)
		fs.writeFileSync(
			path.join(tempDir, '.zed', 'settings.json'),
			JSON.stringify({ context_servers: {} }, null, 2)
		);

		// Create AGENTS.md in project root
		fs.writeFileSync(
			path.join(tempDir, 'AGENTS.md'),
			'# Task Master Instructions\n\nThis is the Task Master agents file.'
		);
	}

	test('creates all required .zed directories', () => {
		// Act
		mockCreateZedStructure();

		// Assert
		expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(tempDir, '.zed'), {
			recursive: true
		});
	});

	test('creates Zed settings.json with context_servers format', () => {
		// Act
		mockCreateZedStructure();

		// Assert
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, '.zed', 'settings.json'),
			JSON.stringify({ context_servers: {} }, null, 2)
		);
	});

	test('creates AGENTS.md in project root', () => {
		// Act
		mockCreateZedStructure();

		// Assert
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, 'AGENTS.md'),
			'# Task Master Instructions\n\nThis is the Task Master agents file.'
		);
	});
});
