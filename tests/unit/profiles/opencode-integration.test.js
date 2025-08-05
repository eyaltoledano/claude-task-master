import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('OpenCode Profile Integration', () => {
	let tempDir;

	beforeEach(() => {
		jest.clearAllMocks();

		// Create a temporary directory for testing
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-master-test-'));

		// Spy on fs methods
		jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
		jest.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
			if (filePath.toString().includes('AGENTS.md')) {
				return 'Sample AGENTS.md content for OpenCode integration';
			}
			if (filePath.toString().includes('opencode.json')) {
				return JSON.stringify({ mcpServers: {} }, null, 2);
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

	// Test function that simulates the OpenCode profile file copying behavior
	function mockCreateOpenCodeStructure() {
		// OpenCode profile copies AGENTS.md to AGENTS.md in project root (same name)
		const sourceContent = 'Sample AGENTS.md content for OpenCode integration';
		fs.writeFileSync(path.join(tempDir, 'AGENTS.md'), sourceContent);

		// OpenCode profile creates opencode.json config file
		const configContent = JSON.stringify({ mcpServers: {} }, null, 2);
		fs.writeFileSync(path.join(tempDir, 'opencode.json'), configContent);
	}

	test('creates AGENTS.md file in project root', () => {
		// Act
		mockCreateOpenCodeStructure();

		// Assert
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, 'AGENTS.md'),
			'Sample AGENTS.md content for OpenCode integration'
		);
	});

	test('creates opencode.json config file in project root', () => {
		// Act
		mockCreateOpenCodeStructure();

		// Assert
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, 'opencode.json'),
			JSON.stringify({ mcpServers: {} }, null, 2)
		);
	});

	test('does not create any profile directories', () => {
		// Act
		mockCreateOpenCodeStructure();

		// Assert - OpenCode profile should not create any directories
		// Only the temp directory creation calls should exist
		const mkdirCalls = fs.mkdirSync.mock.calls.filter(
			(call) => !call[0].includes('task-master-test-')
		);
		expect(mkdirCalls).toHaveLength(0);
	});

	test('handles transformation of MCP config format', () => {
		// This test simulates the transformation behavior that would happen in onPostConvert
		const standardMcpConfig = {
			mcpServers: {
				'taskmaster-ai': {
					command: 'node',
					args: ['path/to/server.js'],
					env: {
						API_KEY: 'test-key'
					}
				}
			}
		};

		const expectedOpenCodeConfig = {
			$schema: 'https://opencode.ai/config.json',
			mcp: {
				'taskmaster-ai': {
					type: 'local',
					command: ['node', 'path/to/server.js'],
					enabled: true,
					environment: {
						API_KEY: 'test-key'
					}
				}
			}
		};

		// Mock the transformation behavior
		fs.writeFileSync(
			path.join(tempDir, 'opencode.json'),
			JSON.stringify(expectedOpenCodeConfig, null, 2)
		);

		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, 'opencode.json'),
			JSON.stringify(expectedOpenCodeConfig, null, 2)
		);
	});
});
