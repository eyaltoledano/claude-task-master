import fs from 'fs';
import os from 'os';
import path from 'path';
import { jest } from '@jest/globals';

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

// Mock @tm/profiles to control slash command behavior in tests
const mockAddSlashCommands = jest.fn();
const mockRemoveSlashCommands = jest.fn();
const mockProfile = {
	name: 'cursor',
	displayName: 'Cursor',
	commandsDir: '.cursor/commands',
	supportsCommands: true,
	addSlashCommands: mockAddSlashCommands,
	removeSlashCommands: mockRemoveSlashCommands
};

await jest.unstable_mockModule('@tm/profiles', () => ({
	getProfile: jest.fn(() => mockProfile),
	allCommands: [{ metadata: { name: 'help' }, content: 'Help content' }],
	resolveProjectRoot: jest.fn((targetDir) => targetDir)
}));

// Import the cursor profile after mocking
const { cursorProfile } = await import('../../../src/profiles/cursor.js');

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

	test('cursor profile has declarative slash commands configuration', () => {
		// The new architecture uses declarative slashCommands property
		// instead of lifecycle hooks - rule-transformer handles execution
		expect(cursorProfile.slashCommands).toBeDefined();
		expect(cursorProfile.slashCommands.profile).toBeDefined();
		expect(cursorProfile.slashCommands.commands).toBeDefined();
		expect(cursorProfile.slashCommands.profile.supportsCommands).toBe(true);
	});

	test('cursor profile has correct basic configuration', () => {
		expect(cursorProfile.profileName).toBe('cursor');
		expect(cursorProfile.displayName).toBe('Cursor');
		expect(cursorProfile.profileDir).toBe('.cursor');
		expect(cursorProfile.rulesDir).toBe('.cursor/rules');
		expect(cursorProfile.supportsRulesSubdirectories).toBe(true);
	});

	describe('slash commands via slashCommands property', () => {
		let mockTargetDir;

		beforeEach(() => {
			mockTargetDir = path.join(tempDir, 'target');

			// Reset all mocks
			jest.clearAllMocks();
			mockAddSlashCommands.mockReset();
			mockRemoveSlashCommands.mockReset();

			// Default mock return values
			mockAddSlashCommands.mockReturnValue({
				success: true,
				count: 10,
				directory: path.join(mockTargetDir, '.cursor', 'commands', 'tm'),
				files: ['help.md', 'next-task.md']
			});
			mockRemoveSlashCommands.mockReturnValue({
				success: true,
				count: 10,
				directory: path.join(mockTargetDir, '.cursor', 'commands', 'tm'),
				files: ['help.md', 'next-task.md']
			});
		});

		afterEach(() => {
			jest.restoreAllMocks();
		});

		test('slashCommands.profile can add slash commands', () => {
			// The rule-transformer uses slashCommands.profile.addSlashCommands
			const { profile, commands } = cursorProfile.slashCommands;

			// Act
			profile.addSlashCommands(mockTargetDir, commands);

			// Assert - mock was called
			expect(mockAddSlashCommands).toHaveBeenCalledWith(
				mockTargetDir,
				commands
			);
		});

		test('slashCommands.profile handles add errors gracefully', () => {
			// Arrange - mock addSlashCommands failure
			mockAddSlashCommands.mockReturnValue({
				success: false,
				count: 0,
				directory: '',
				files: [],
				error: 'Permission denied'
			});

			const { profile, commands } = cursorProfile.slashCommands;

			// Act - should not throw
			const result = profile.addSlashCommands(mockTargetDir, commands);

			// Assert
			expect(result.success).toBe(false);
			expect(result.error).toBe('Permission denied');
		});

		test('slashCommands.profile can remove slash commands', () => {
			const { profile, commands } = cursorProfile.slashCommands;

			// Act
			profile.removeSlashCommands(mockTargetDir, commands);

			// Assert - mock was called
			expect(mockRemoveSlashCommands).toHaveBeenCalledWith(
				mockTargetDir,
				commands
			);
		});

		test('slashCommands.profile handles remove with missing directory gracefully', () => {
			// Arrange - mock removeSlashCommands returns success with 0 count
			mockRemoveSlashCommands.mockReturnValue({
				success: true,
				count: 0,
				directory: path.join(mockTargetDir, '.cursor', 'commands', 'tm'),
				files: []
			});

			const { profile, commands } = cursorProfile.slashCommands;

			// Act
			const result = profile.removeSlashCommands(mockTargetDir, commands);

			// Assert
			expect(result.success).toBe(true);
			expect(result.count).toBe(0);
		});

		test('slashCommands.profile handles remove errors gracefully', () => {
			// Arrange - mock removeSlashCommands failure
			mockRemoveSlashCommands.mockReturnValue({
				success: false,
				count: 0,
				directory: '',
				files: [],
				error: 'Permission denied'
			});

			const { profile, commands } = cursorProfile.slashCommands;

			// Act
			const result = profile.removeSlashCommands(mockTargetDir, commands);

			// Assert
			expect(result.success).toBe(false);
			expect(result.error).toBe('Permission denied');
		});
	});
});
