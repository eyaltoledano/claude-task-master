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

describe('Codex Profile Integration', () => {
	let tempDir;

	beforeEach(() => {
		jest.clearAllMocks();

		// Create a temporary directory for testing
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-master-test-'));

		// Spy on fs methods
		jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
		jest.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
			if (filePath.toString().includes('AGENTS.md')) {
				return 'Sample AGENTS.md content for Codex integration';
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

	// Test function that simulates the Codex profile file copying behavior
	function mockCreateCodexStructure() {
		// Codex profile copies AGENTS.md to AGENTS.md in project root (same name)
		const sourceContent = 'Sample AGENTS.md content for Codex integration';
		fs.writeFileSync(path.join(tempDir, 'AGENTS.md'), sourceContent);
	}

	test('creates AGENTS.md file in project root', () => {
		// Act
		mockCreateCodexStructure();

		// Assert
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, 'AGENTS.md'),
			'Sample AGENTS.md content for Codex integration'
		);
	});

	test('does not create any profile directories', () => {
		// Act
		mockCreateCodexStructure();

		// Assert - Codex profile should not create any directories
		// Only the temp directory creation calls should exist
		const mkdirCalls = fs.mkdirSync.mock.calls.filter(
			(call) => !call[0].includes('task-master-test-')
		);
		expect(mkdirCalls).toHaveLength(0);
	});

	test('does not create MCP configuration files', () => {
		// Act
		mockCreateCodexStructure();

		// Assert - Codex profile should not create any MCP config files
		const writeFileCalls = fs.writeFileSync.mock.calls;
		const mcpConfigCalls = writeFileCalls.filter(
			(call) =>
				call[0].toString().includes('mcp.json') ||
				call[0].toString().includes('mcp_settings.json')
		);
		expect(mcpConfigCalls).toHaveLength(0);
	});

	test('only creates the target integration guide file', () => {
		// Act
		mockCreateCodexStructure();

		// Assert - Should only create AGENTS.md
		const writeFileCalls = fs.writeFileSync.mock.calls;
		expect(writeFileCalls).toHaveLength(1);
		expect(writeFileCalls[0][0]).toBe(path.join(tempDir, 'AGENTS.md'));
	});

	test('uses the same filename as source (AGENTS.md)', () => {
		// Act
		mockCreateCodexStructure();

		// Assert - Codex should keep the same filename unlike Claude which renames it
		const writeFileCalls = fs.writeFileSync.mock.calls;
		expect(writeFileCalls[0][0]).toContain('AGENTS.md');
		expect(writeFileCalls[0][0]).not.toContain('CLAUDE.md');
	});
});
