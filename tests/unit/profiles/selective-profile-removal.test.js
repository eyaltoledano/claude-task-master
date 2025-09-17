import fs from 'fs';
import path from 'path';
import os from 'os';
import { jest } from '@jest/globals';
import {
	removeProfileRules,
	getRulesProfile
} from '../../../src/utils/rule-transformer.js';
import { removeTaskMasterMCPConfiguration } from '../../../src/utils/create-mcp-config.js';

// Mock logger
const mockLog = {
	info: jest.fn(),
	error: jest.fn(),
	debug: jest.fn(),
	warn: jest.fn()
};

// Mock the logger import
jest.mock('../../../scripts/modules/utils.js', () => ({
	log: (level, message) => mockLog[level]?.(message)
}));

describe('Selective Rules Removal', () => {
	let tempDir;
	let mockExistsSync;
	let mockRmSync;
	let mockReaddirSync;
	let mockReadFileSync;
	let mockWriteFileSync;
	let mockMkdirSync;
	let mockStatSync;
	let originalConsoleLog;

	// Stateful in-memory filesystem mock
	let fileSystem;

	beforeEach(() => {
		jest.clearAllMocks();

		// Mock console.log to prevent JSON parsing issues in Jest
		originalConsoleLog = console.log;
		console.log = jest.fn();

		// Create temp directory for testing
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-master-test-'));

		// Initialize in-memory filesystem
		fileSystem = {};

		// Set up spies on fs methods
		mockExistsSync = jest.spyOn(fs, 'existsSync');
		mockRmSync = jest.spyOn(fs, 'rmSync').mockImplementation((filePath) => {
			// Remove file from in-memory filesystem
			const dir = path.dirname(filePath);
			const filename = path.basename(filePath);
			if (fileSystem[dir]) {
				const index = fileSystem[dir].indexOf(filename);
				if (index === -1) {
					throw new Error(
						`ENOENT: no such file or directory, unlink '${filePath}'`
					);
				}
				fileSystem[dir].splice(index, 1);
			}
		});
		mockReaddirSync = jest
			.spyOn(fs, 'readdirSync')
			.mockImplementation((dirPath) => {
				// Return current array for this path from in-memory filesystem
				return fileSystem[dirPath] || [];
			});
		mockReadFileSync = jest.spyOn(fs, 'readFileSync');
		mockWriteFileSync = jest
			.spyOn(fs, 'writeFileSync')
			.mockImplementation(() => {});
		mockMkdirSync = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
		mockStatSync = jest.spyOn(fs, 'statSync').mockImplementation((filePath) => {
			// Mock stat objects for files and directories
			// Use more robust detection while maintaining backward compatibility
			const extname = path.extname(filePath);
			const basename = path.basename(filePath);

			// Check for known file extensions first (more reliable)
			if (extname === '.mdc' || extname === '.md') {
				return { isDirectory: () => false, isFile: () => true };
			}

			// Check for known directory names
			if (
				basename === 'taskmaster' ||
				basename === 'add-task' ||
				basename === 'next' ||
				basename === 'commands'
			) {
				return { isDirectory: () => true, isFile: () => false };
			}

			// Fallback to original path-based logic for backward compatibility
			if (filePath.includes('taskmaster') && !filePath.endsWith('.mdc')) {
				return { isDirectory: () => true, isFile: () => false };
			} else {
				// Default to file for backward compatibility
				return { isDirectory: () => false, isFile: () => true };
			}
		});
	});

	afterEach(() => {
		// Restore console.log
		console.log = originalConsoleLog;

		// Clean up temp directory
		try {
			fs.rmSync(tempDir, { recursive: true, force: true });
		} catch (error) {
			// Ignore cleanup errors
		}

		// Restore all mocked functions
		jest.restoreAllMocks();
	});

	describe('removeProfileRules - Selective File Removal', () => {
		it('should only remove Task Master files, preserving existing rules', () => {
			const projectRoot = '/test/project';
			const cursorProfile = getRulesProfile('cursor');

			// Mock profile directory exists
			mockExistsSync.mockImplementation((filePath) => {
				const fp = path.normalize(filePath);
				const cursorDir = path.join(projectRoot, '.cursor');
				const rulesDir = path.join(projectRoot, '.cursor', 'rules');
				const commandsDir = path.join(projectRoot, '.cursor', 'commands');
				const mcpConfigFile = path.join(projectRoot, '.cursor', 'mcp.json');
				const tmAddTaskFile = path.join(
					projectRoot,
					'.cursor',
					'commands',
					'tm-add-task.md'
				);
				const tmNextTaskFile = path.join(
					projectRoot,
					'.cursor',
					'commands',
					'tm-next-task.md'
				);
				const tmShowTaskFile = path.join(
					projectRoot,
					'.cursor',
					'commands',
					'tm-show-task.md'
				);

				if (fp === cursorDir) return true;
				if (fp === rulesDir) return true;
				if (fp === commandsDir) return true;
				if (fp === mcpConfigFile) return true;
				// Mock specific command files exist for lifecycle hook counting
				if (fp === tmAddTaskFile) return true;
				if (fp === tmNextTaskFile) return true;
				if (fp === tmShowTaskFile) return true;
				return false;
			});

			// Mock MCP config file
			const mockMcpConfig = {
				mcpServers: {
					'task-master-ai': {
						command: 'npx',
						args: ['task-master-ai']
					}
				}
			};
			mockReadFileSync.mockReturnValue(JSON.stringify(mockMcpConfig));

			// Set up in-memory filesystem state
			fileSystem[path.join(projectRoot, '.cursor/commands')] = [
				'tm-add-task.md',
				'tm-next-task.md',
				'tm-show-task.md'
			];
			fileSystem[path.join(projectRoot, '.cursor/rules')] = [
				'cursor_rules.mdc',
				'taskmaster',
				'self_improve.mdc',
				'custom_rule.mdc',
				'my_company_rules.mdc',
				'another_custom_rule.mdc'
			];
			fileSystem[path.join(projectRoot, '.cursor/rules/taskmaster')] = [
				'dev_workflow.mdc',
				'taskmaster.mdc'
			];
			fileSystem[path.join(projectRoot, '.cursor')] = [
				'rules',
				'mcp.json',
				'commands'
			];

			const result = removeProfileRules(projectRoot, cursorProfile);

			// Verify results
			expect(result.filesRemoved).toEqual([
				'cursor_rules.mdc',
				'taskmaster/dev_workflow.mdc',
				'self_improve.mdc',
				'taskmaster/taskmaster.mdc'
			]);
			expect(result.notice).toContain('Preserved 3 existing rule files');
			expect(result.fileCount).toBe(4); // 0 command files + 4 rule files
			expect(result.success).toBe(true);

			// Verify only Task Master files were removed
			expect(mockRmSync).toHaveBeenCalledWith(
				path.join(projectRoot, '.cursor/rules/cursor_rules.mdc'),
				{ force: true }
			);
			expect(mockRmSync).toHaveBeenCalledWith(
				path.join(projectRoot, '.cursor/rules/taskmaster/dev_workflow.mdc'),
				{ force: true }
			);
			expect(mockRmSync).toHaveBeenCalledWith(
				path.join(projectRoot, '.cursor/rules/self_improve.mdc'),
				{ force: true }
			);
			expect(mockRmSync).toHaveBeenCalledWith(
				path.join(projectRoot, '.cursor/rules/taskmaster/taskmaster.mdc'),
				{ force: true }
			);

			// Verify rules directory was NOT removed (still has other files)
			expect(mockRmSync).not.toHaveBeenCalledWith(
				path.join(projectRoot, '.cursor/rules'),
				{ recursive: true, force: true }
			);

			// Verify profile directory was NOT removed
			expect(mockRmSync).not.toHaveBeenCalledWith(
				path.join(projectRoot, '.cursor'),
				{ recursive: true, force: true }
			);
		});

		it('should remove empty rules directory if only Task Master files existed', () => {
			const projectRoot = '/test/project';
			const cursorProfile = getRulesProfile('cursor');

			// Mock profile directory exists
			mockExistsSync.mockImplementation((filePath) => {
				const fp = path.normalize(filePath);
				const cursorDir = path.join(projectRoot, '.cursor');
				const rulesDir = path.join(projectRoot, '.cursor', 'rules');
				const commandsDir = path.join(projectRoot, '.cursor', 'commands');
				const mcpConfigFile = path.join(projectRoot, '.cursor', 'mcp.json');

				if (fp === cursorDir) return true;
				if (fp === rulesDir) return true;
				if (fp === commandsDir) return true;
				if (fp === mcpConfigFile) return true;
				return false;
			});

			// Mock MCP config file
			const mockMcpConfig = {
				mcpServers: {
					'task-master-ai': {
						command: 'npx',
						args: ['task-master-ai']
					}
				}
			};
			mockReadFileSync.mockReturnValue(JSON.stringify(mockMcpConfig));

			// Set up in-memory filesystem state
			fileSystem[path.join(projectRoot, '.cursor/commands/tm')] = [
				'add-task',
				'next'
			];
			fileSystem[path.join(projectRoot, '.cursor/commands/tm/add-task')] = [
				'add-task.md'
			];
			fileSystem[path.join(projectRoot, '.cursor/commands/tm/next')] = [
				'next-task.md'
			];
			fileSystem[path.join(projectRoot, '.cursor/rules')] = [
				'cursor_rules.mdc',
				'taskmaster',
				'self_improve.mdc'
			];
			fileSystem[path.join(projectRoot, '.cursor/rules/taskmaster')] = [
				'dev_workflow.mdc',
				'taskmaster.mdc'
			];
			fileSystem[path.join(projectRoot, '.cursor')] = [];

			const result = removeProfileRules(projectRoot, cursorProfile);

			// Verify results
			expect(result.filesRemoved).toEqual([
				'cursor_rules.mdc',
				'taskmaster/dev_workflow.mdc',
				'self_improve.mdc',
				'taskmaster/taskmaster.mdc'
			]);
			expect(result.fileCount).toBe(4); // 0 command files + 4 rule files
			expect(result.success).toBe(true);

			// Verify individual files were removed
			expect(mockRmSync).toHaveBeenCalledWith(
				path.join(projectRoot, '.cursor/rules/cursor_rules.mdc'),
				{ force: true }
			);
			expect(mockRmSync).toHaveBeenCalledWith(
				path.join(projectRoot, '.cursor/rules/taskmaster/dev_workflow.mdc'),
				{ force: true }
			);
			expect(mockRmSync).toHaveBeenCalledWith(
				path.join(projectRoot, '.cursor/rules/self_improve.mdc'),
				{ force: true }
			);
			expect(mockRmSync).toHaveBeenCalledWith(
				path.join(projectRoot, '.cursor/rules/taskmaster/taskmaster.mdc'),
				{ force: true }
			);
			expect(mockRmSync).toHaveBeenCalledWith(
				path.join(projectRoot, '.cursor/rules'),
				{ recursive: true, force: true }
			);

			// Note: Rules directory removal may not work in test environment due to mock limitations
		});

		it('should remove MCP config but preserve profile directory structure (cursor profile behavior)', () => {
			const projectRoot = '/test/project';
			const cursorProfile = getRulesProfile('cursor');

			// Mock profile directory exists
			mockExistsSync.mockImplementation((filePath) => {
				if (filePath.includes('.cursor')) return true;
				if (filePath.includes('.cursor/rules')) return true;
				if (filePath.includes('.cursor/commands')) return true;
				if (filePath.includes('mcp.json')) return true;
				return false;
			});

			// Set up in-memory filesystem state
			fileSystem[path.join(projectRoot, '.cursor/commands/tm')] = ['add-task'];
			fileSystem[path.join(projectRoot, '.cursor/commands/tm/add-task')] = [
				'add-task.md'
			];
			fileSystem[path.join(projectRoot, '.cursor')] = [];

			// Mock MCP config with only Task Master (will be completely deleted)
			const mockMcpConfig = {
				mcpServers: {
					'task-master-ai': {
						command: 'npx',
						args: ['task-master-ai']
					}
				}
			};
			mockReadFileSync.mockReturnValue(JSON.stringify(mockMcpConfig));

			const result = removeProfileRules(projectRoot, cursorProfile);

			expect(result.success).toBe(true);
			expect(result.profileDirRemoved).toBe(true); // Profile dir is empty, so it gets removed
			expect(result.mcpResult.deleted).toBe(false); // MCP config not separately deleted when whole profile dir is removed
			expect(result.fileCount).toBe(4); // Command and MCP processing results in higher count

			// With stateful mock, profile directory is actually removed when empty
			// This reflects the correct behavior when directory is truly empty
		});

		it('should NOT remove profile directory if existing rules were preserved, even if MCP config deleted', () => {
			const projectRoot = '/test/project';
			const cursorProfile = getRulesProfile('cursor');

			// Mock profile directory exists
			mockExistsSync.mockImplementation((filePath) => {
				if (filePath.includes('.cursor')) return true;
				if (filePath.includes('.cursor/rules')) return true;
				if (filePath.includes('.cursor/commands')) return true;
				if (filePath.includes('mcp.json')) return true;
				return false;
			});

			// Set up in-memory filesystem state
			fileSystem[path.join(projectRoot, '.cursor/commands')] = [
				'tm-add-task.md'
			];
			fileSystem[path.join(projectRoot, '.cursor/rules')] = [
				'cursor_rules.mdc',
				'my_custom_rule.mdc'
			];
			fileSystem[path.join(projectRoot, '.cursor')] = [
				'rules',
				'mcp.json',
				'commands'
			];

			// Mock MCP config with only Task Master (will be completely deleted)
			const mockMcpConfig = {
				mcpServers: {
					'task-master-ai': {
						command: 'npx',
						args: ['task-master-ai']
					}
				}
			};
			mockReadFileSync.mockReturnValue(JSON.stringify(mockMcpConfig));

			const result = removeProfileRules(projectRoot, cursorProfile);

			expect(result.success).toBe(true);
			expect(result.profileDirRemoved).toBe(false);
			expect(result.mcpResult.deleted).toBe(true);

			// Verify profile directory was NOT removed (existing rules preserved)
			expect(mockRmSync).not.toHaveBeenCalledWith(
				path.join(projectRoot, '.cursor'),
				{ recursive: true, force: true }
			);
		});

		it('should NOT remove profile directory if MCP config has other servers, even if all rules were Task Master rules', () => {
			const projectRoot = '/test/project';
			const cursorProfile = getRulesProfile('cursor');

			// Mock profile directory exists
			mockExistsSync.mockImplementation((filePath) => {
				if (filePath.includes('.cursor')) return true;
				if (filePath.includes('.cursor/rules')) return true;
				if (filePath.includes('.cursor/commands')) return true;
				if (filePath.includes('mcp.json')) return true;
				return false;
			});

			// Set up in-memory filesystem state
			fileSystem[path.join(projectRoot, '.cursor/commands/tm')] = ['add-task'];
			fileSystem[path.join(projectRoot, '.cursor/commands/tm/add-task')] = [
				'add-task.md'
			];
			fileSystem[path.join(projectRoot, '.cursor/rules')] = [
				'cursor_rules.mdc'
			];
			fileSystem[path.join(projectRoot, '.cursor')] = [
				'rules',
				'mcp.json',
				'commands'
			];

			// Mock MCP config with multiple servers (Task Master will be removed, others preserved)
			const mockMcpConfig = {
				mcpServers: {
					'task-master-ai': {
						command: 'npx',
						args: ['task-master-ai']
					},
					'other-server': {
						command: 'node',
						args: ['other-server.js']
					}
				}
			};
			mockReadFileSync.mockReturnValue(JSON.stringify(mockMcpConfig));

			const result = removeProfileRules(projectRoot, cursorProfile);

			expect(result.success).toBe(true);
			expect(result.profileDirRemoved).toBe(false);
			expect(result.mcpResult.deleted).toBe(false);
			expect(result.mcpResult.hasOtherServers).toBe(true);
			expect(result.fileCount).toBe(3); // Only 1 rule file + 2 command files

			// Verify profile directory was NOT removed (MCP config preserved)
			expect(mockRmSync).not.toHaveBeenCalledWith(
				path.join(projectRoot, '.cursor'),
				{ recursive: true, force: true }
			);
		});

		it('should NOT remove profile directory if other files/folders exist, even if all other conditions are met', () => {
			const projectRoot = '/test/project';
			const cursorProfile = getRulesProfile('cursor');

			// Mock profile directory exists
			mockExistsSync.mockImplementation((filePath) => {
				const fp = path.normalize(filePath);
				const cursorDir = path.join(projectRoot, '.cursor');
				const rulesDir = path.join(projectRoot, '.cursor', 'rules');
				const commandsDir = path.join(projectRoot, '.cursor', 'commands');
				const mcpConfigFile = path.join(projectRoot, '.cursor', 'mcp.json');

				if (fp === cursorDir) return true;
				if (fp === rulesDir) return true;
				if (fp === commandsDir) return true;
				if (fp === mcpConfigFile) return true;
				return false;
			});

			// Set up in-memory filesystem state
			fileSystem[path.join(projectRoot, '.cursor/commands/tm')] = ['add-task'];
			fileSystem[path.join(projectRoot, '.cursor/commands/tm/add-task')] = [
				'add-task.md'
			];
			fileSystem[path.join(projectRoot, '.cursor/rules')] = [
				'cursor_rules.mdc',
				'taskmaster',
				'self_improve.mdc'
			];
			fileSystem[path.join(projectRoot, '.cursor/rules/taskmaster')] = [
				'dev_workflow.mdc',
				'taskmaster.mdc'
			];
			fileSystem[path.join(projectRoot, '.cursor')] = [
				'workflows',
				'custom-config.json',
				'commands'
			];

			// Mock MCP config with only Task Master (will be completely deleted)
			const mockMcpConfig = {
				mcpServers: {
					'task-master-ai': {
						command: 'npx',
						args: ['task-master-ai']
					}
				}
			};
			mockReadFileSync.mockReturnValue(JSON.stringify(mockMcpConfig));

			const result = removeProfileRules(projectRoot, cursorProfile);

			expect(result.success).toBe(true);
			expect(result.profileDirRemoved).toBe(false); // Profile dir should NOT be removed when other files exist
			expect(result.mcpResult.deleted).toBe(false); // MCP config not deleted when profile dir preserved
			expect(result.notice).toContain('existing files/folders in .cursor');
			expect(result.fileCount).toBe(4); // 2 command files + 4 rule files but only 4 total processed

			// Verify profile directory was NOT removed (other files/folders exist)
			expect(mockRmSync).not.toHaveBeenCalledWith(
				path.join(projectRoot, '.cursor'),
				{ recursive: true, force: true }
			);
		});
	});

	describe('removeTaskMasterMCPConfiguration - Selective MCP Removal', () => {
		it('should only remove Task Master from MCP config, preserving other servers', () => {
			const projectRoot = '/test/project';
			const mcpConfigPath = '.cursor/mcp.json';

			// Mock MCP config with multiple servers
			const mockMcpConfig = {
				mcpServers: {
					'task-master-ai': {
						command: 'npx',
						args: ['task-master-ai']
					},
					'other-server': {
						command: 'node',
						args: ['other-server.js']
					},
					'another-server': {
						command: 'python',
						args: ['server.py']
					}
				}
			};

			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(JSON.stringify(mockMcpConfig));

			const result = removeTaskMasterMCPConfiguration(
				projectRoot,
				mcpConfigPath
			);

			expect(result.success).toBe(true);
			expect(result.removed).toBe(true);
			expect(result.deleted).toBe(false);
			expect(result.hasOtherServers).toBe(true);

			// Verify the file was written back with other servers preserved
			expect(mockWriteFileSync).toHaveBeenCalledWith(
				path.join(projectRoot, mcpConfigPath),
				expect.stringContaining('other-server')
			);
			expect(mockWriteFileSync).toHaveBeenCalledWith(
				path.join(projectRoot, mcpConfigPath),
				expect.stringContaining('another-server')
			);
			expect(mockWriteFileSync).toHaveBeenCalledWith(
				path.join(projectRoot, mcpConfigPath),
				expect.not.stringContaining('task-master-ai')
			);
		});

		it('should delete entire MCP config if Task Master is the only server', () => {
			const projectRoot = '/test/project';
			const mcpConfigPath = '.cursor/mcp.json';

			// Mock MCP config with only Task Master
			const mockMcpConfig = {
				mcpServers: {
					'task-master-ai': {
						command: 'npx',
						args: ['task-master-ai']
					}
				}
			};

			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(JSON.stringify(mockMcpConfig));

			const result = removeTaskMasterMCPConfiguration(
				projectRoot,
				mcpConfigPath
			);

			expect(result.success).toBe(true);
			expect(result.removed).toBe(true);
			expect(result.deleted).toBe(true);
			expect(result.hasOtherServers).toBe(false);

			// Verify the entire file was deleted
			expect(mockRmSync).toHaveBeenCalledWith(
				path.join(projectRoot, mcpConfigPath),
				{ force: true }
			);
			expect(mockWriteFileSync).not.toHaveBeenCalled();
		});

		it('should handle MCP config with Task Master in server args', () => {
			const projectRoot = '/test/project';
			const mcpConfigPath = '.cursor/mcp.json';

			// Mock MCP config with Task Master referenced in args
			const mockMcpConfig = {
				mcpServers: {
					'taskmaster-wrapper': {
						command: 'npx',
						args: ['-y', '--package=task-master-ai', 'task-master-ai']
					},
					'other-server': {
						command: 'node',
						args: ['other-server.js']
					}
				}
			};

			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue(JSON.stringify(mockMcpConfig));

			const result = removeTaskMasterMCPConfiguration(
				projectRoot,
				mcpConfigPath
			);

			expect(result.success).toBe(true);
			expect(result.removed).toBe(true);
			expect(result.hasOtherServers).toBe(true);

			// Verify only the server with task-master-ai in args was removed
			expect(mockWriteFileSync).toHaveBeenCalledWith(
				path.join(projectRoot, mcpConfigPath),
				expect.stringContaining('other-server')
			);
			expect(mockWriteFileSync).toHaveBeenCalledWith(
				path.join(projectRoot, mcpConfigPath),
				expect.not.stringContaining('taskmaster-wrapper')
			);
		});

		it('should handle non-existent MCP config gracefully', () => {
			const projectRoot = '/test/project';
			const mcpConfigPath = '.cursor/mcp.json';

			mockExistsSync.mockReturnValue(false);

			const result = removeTaskMasterMCPConfiguration(
				projectRoot,
				mcpConfigPath
			);

			expect(result.success).toBe(true);
			expect(result.removed).toBe(false);
			expect(result.deleted).toBe(false);
			expect(result.hasOtherServers).toBe(false);

			// No file operations should have been attempted
			expect(mockReadFileSync).not.toHaveBeenCalled();
			expect(mockWriteFileSync).not.toHaveBeenCalled();
			expect(mockRmSync).not.toHaveBeenCalled();
		});
	});

	describe('Integration - Full Profile Removal with Preservation', () => {
		it('should handle complete removal scenario with notices', () => {
			const projectRoot = '/test/project';
			const cursorProfile = getRulesProfile('cursor');

			// Mock mixed scenario: some Task Master files, some existing files, other MCP servers
			mockExistsSync.mockImplementation((filePath) => {
				// Only .cursor directories exist
				if (filePath === path.join(projectRoot, '.cursor')) return true;
				if (filePath === path.join(projectRoot, '.cursor/rules')) return true;
				if (filePath === path.join(projectRoot, '.cursor/commands'))
					return true;
				if (filePath === path.join(projectRoot, '.cursor/mcp.json'))
					return true;
				// Only cursor_rules.mdc exists, not the other taskmaster files
				if (
					filePath === path.join(projectRoot, '.cursor/rules/cursor_rules.mdc')
				)
					return true;
				if (
					filePath ===
					path.join(projectRoot, '.cursor/rules/taskmaster/dev_workflow.mdc')
				)
					return false;
				if (
					filePath === path.join(projectRoot, '.cursor/rules/self_improve.mdc')
				)
					return false;
				if (
					filePath ===
					path.join(projectRoot, '.cursor/rules/taskmaster/taskmaster.mdc')
				)
					return false;
				return false;
			});

			// Set up in-memory filesystem state
			fileSystem[path.join(projectRoot, '.cursor/rules')] = [
				'cursor_rules.mdc',
				'my_custom_rule.mdc'
			];
			fileSystem[path.join(projectRoot, '.cursor')] = [
				'rules',
				'mcp.json',
				'commands'
			];

			// Mock MCP config with multiple servers
			const mockMcpConfig = {
				mcpServers: {
					'task-master-ai': { command: 'npx', args: ['task-master-ai'] },
					'other-server': { command: 'node', args: ['other.js'] }
				}
			};
			mockReadFileSync.mockReturnValue(JSON.stringify(mockMcpConfig));

			const result = removeProfileRules(projectRoot, cursorProfile);

			expect(result.success).toBe(true);
			expect(result.filesRemoved).toEqual(['cursor_rules.mdc']);
			expect(result.notice).toContain('Preserved 1 existing rule files');
			expect(result.notice).toContain(
				'preserved other MCP server configurations'
			);
			expect(result.mcpResult.hasOtherServers).toBe(true);
			expect(result.profileDirRemoved).toBe(false);
			expect(result.fileCount).toBe(1); // 0 command files + 1 rule file
		});
	});
});
