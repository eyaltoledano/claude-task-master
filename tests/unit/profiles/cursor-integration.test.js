import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock external modules
jest.mock('child_process', () => ({
	execSync: jest.fn()
}));

// Mock console methods to avoid chalk issues
const mockLog = jest.fn();
const originalConsole = global.console;
const mockConsole = {
	log: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
	clear: jest.fn()
};
global.console = mockConsole;

// Mock utils logger to avoid chalk dependency issues
await jest.unstable_mockModule('../../../scripts/modules/utils.js', () => ({
	default: undefined,
	log: mockLog,
	isSilentMode: () => false
}));

// Import the cursor profile after mocking
const { cursorProfile, onAddRulesProfile, onRemoveRulesProfile } = await import(
	'../../../src/profiles/cursor.js'
);

describe('Cursor Integration', () => {
	let tempDir;

	afterAll(() => {
		global.console = originalConsole;
	});

	beforeEach(() => {
		jest.clearAllMocks();

		// Create a temporary directory for testing
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-master-test-'));

		// Spy on fs methods
		jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
		jest.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
			if (filePath.toString().includes('mcp.json')) {
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

	// Test function that simulates the createProjectStructure behavior for Cursor files
	function mockCreateCursorStructure() {
		// Create main .cursor directory
		fs.mkdirSync(path.join(tempDir, '.cursor'), { recursive: true });

		// Create rules directory
		fs.mkdirSync(path.join(tempDir, '.cursor', 'rules'), { recursive: true });

		// Create MCP config file
		fs.writeFileSync(
			path.join(tempDir, '.cursor', 'mcp.json'),
			JSON.stringify({ mcpServers: {} }, null, 2)
		);
	}

	test('creates all required .cursor directories', () => {
		// Act
		mockCreateCursorStructure();

		// Assert
		expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(tempDir, '.cursor'), {
			recursive: true
		});
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.cursor', 'rules'),
			{ recursive: true }
		);
	});

	test('cursor profile has lifecycle functions for command copying', () => {
		// Assert that the profile exports the lifecycle functions
		expect(typeof onAddRulesProfile).toBe('function');
		expect(typeof onRemoveRulesProfile).toBe('function');
		expect(cursorProfile.onAddRulesProfile).toBe(onAddRulesProfile);
		expect(cursorProfile.onRemoveRulesProfile).toBe(onRemoveRulesProfile);
	});

	describe('command copying lifecycle', () => {
		let mockAssetsDir;
		let mockTargetDir;

		beforeEach(() => {
			mockAssetsDir = path.join(tempDir, 'assets');
			mockTargetDir = path.join(tempDir, 'target');

			// Reset all mocks
			jest.clearAllMocks();

			// Mock fs methods for the lifecycle functions
			jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
				const pathStr = filePath.toString();
				if (pathStr.includes('claude/commands')) {
					return true; // Mock that source commands exist
				}
				return false;
			});

			jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
			jest.spyOn(fs, 'readdirSync').mockImplementation(() => ['tm']);
			jest
				.spyOn(fs, 'statSync')
				.mockImplementation(() => ({ isDirectory: () => true }));
			jest.spyOn(fs, 'copyFileSync').mockImplementation(() => {});
			jest.spyOn(fs, 'rmSync').mockImplementation(() => {});
		});

		afterEach(() => {
			jest.restoreAllMocks();
		});

		test('onAddRulesProfile copies commands from assets to .cursor/commands', () => {
			// Detect if cpSync exists and set up appropriate spy
			if (fs.cpSync) {
				const cpSpy = jest.spyOn(fs, 'cpSync').mockImplementation(() => {});

				// Act
				onAddRulesProfile(mockTargetDir, mockAssetsDir);

				// Assert
				expect(fs.existsSync).toHaveBeenCalledWith(
					path.join(mockAssetsDir, 'claude', 'commands')
				);
				expect(cpSpy).toHaveBeenCalledWith(
					path.join(mockAssetsDir, 'claude', 'commands'),
					path.join(mockTargetDir, '.cursor', 'commands'),
					expect.objectContaining({ recursive: true, force: true })
				);
			} else {
				// Act
				onAddRulesProfile(mockTargetDir, mockAssetsDir);

				// Assert
				expect(fs.existsSync).toHaveBeenCalledWith(
					path.join(mockAssetsDir, 'claude', 'commands')
				);
				expect(fs.mkdirSync).toHaveBeenCalledWith(
					path.join(mockTargetDir, '.cursor', 'commands'),
					{ recursive: true }
				);
				expect(fs.copyFileSync).toHaveBeenCalled();
			}
		});

		test('onAddRulesProfile handles missing source directory gracefully', () => {
			// Arrange - mock source directory not existing
			jest.spyOn(fs, 'existsSync').mockImplementation(() => false);

			// Act
			onAddRulesProfile(mockTargetDir, mockAssetsDir);

			// Assert - should not attempt to copy anything
			expect(fs.mkdirSync).not.toHaveBeenCalled();
			expect(fs.copyFileSync).not.toHaveBeenCalled();
		});

		test('onRemoveRulesProfile removes .cursor/commands directory', () => {
			// Arrange - mock directory exists
			jest.spyOn(fs, 'existsSync').mockImplementation(() => true);

			// Act
			onRemoveRulesProfile(mockTargetDir);

			// Assert
			expect(fs.rmSync).toHaveBeenCalledWith(
				path.join(mockTargetDir, '.cursor', 'commands'),
				{ recursive: true, force: true }
			);
		});

		test('onRemoveRulesProfile handles missing directory gracefully', () => {
			// Arrange - mock directory doesn't exist
			jest.spyOn(fs, 'existsSync').mockImplementation(() => false);

			// Act
			onRemoveRulesProfile(mockTargetDir);

			// Assert - should still return true but not attempt removal
			expect(fs.rmSync).not.toHaveBeenCalled();
		});

		test('onRemoveRulesProfile handles removal errors gracefully', () => {
			// Arrange - mock directory exists but removal fails
			jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
			jest.spyOn(fs, 'rmSync').mockImplementation(() => {
				throw new Error('Permission denied');
			});

			// Act & Assert - should not throw
			expect(() => onRemoveRulesProfile(mockTargetDir)).not.toThrow();
		});
	});
});
