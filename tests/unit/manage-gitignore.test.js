/**
 * Unit tests for manage-gitignore.js module
 * Tests the logic with Jest spies instead of mocked modules
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Import the module under test and its exports
import manageGitignoreFile, {
	normalizeLine,
	isTaskLine,
	buildTaskFilesSection,
	TASK_FILES_COMMENT,
	TASK_JSON_PATTERN,
	TASK_DIR_PATTERN
} from '../../src/utils/manage-gitignore.js';

describe('manage-gitignore.js Unit Tests', () => {
	let tempDir;

	beforeEach(() => {
		jest.clearAllMocks();

		// Create a temporary directory for testing
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manage-gitignore-test-'));
	});

	afterEach(() => {
		// Clean up the temporary directory
		try {
			fs.rmSync(tempDir, { recursive: true, force: true });
		} catch (err) {
			// Ignore cleanup errors
		}
	});

	describe('Constants', () => {
		test('should have correct constant values', () => {
			expect(TASK_FILES_COMMENT).toBe('# Task files');
			expect(TASK_JSON_PATTERN).toBe('tasks.json');
			expect(TASK_DIR_PATTERN).toBe('tasks/');
		});
	});

	describe('normalizeLine function', () => {
		test('should remove leading/trailing whitespace', () => {
			expect(normalizeLine('  test  ')).toBe('test');
		});

		test('should remove comment hash and trim', () => {
			expect(normalizeLine('# tasks.json')).toBe('tasks.json');
			expect(normalizeLine('#tasks/')).toBe('tasks/');
		});

		test('should handle empty strings', () => {
			expect(normalizeLine('')).toBe('');
			expect(normalizeLine('   ')).toBe('');
		});

		test('should handle lines without comments', () => {
			expect(normalizeLine('tasks.json')).toBe('tasks.json');
		});
	});

	describe('isTaskLine function', () => {
		test('should identify task.json patterns', () => {
			expect(isTaskLine('tasks.json')).toBe(true);
			expect(isTaskLine('# tasks.json')).toBe(true);
			expect(isTaskLine('  # tasks.json  ')).toBe(true);
		});

		test('should identify tasks/ patterns', () => {
			expect(isTaskLine('tasks/')).toBe(true);
			expect(isTaskLine('# tasks/')).toBe(true);
			expect(isTaskLine('  # tasks/  ')).toBe(true);
		});

		test('should reject non-task patterns', () => {
			expect(isTaskLine('node_modules/')).toBe(false);
			expect(isTaskLine('# Some comment')).toBe(false);
			expect(isTaskLine('')).toBe(false);
			expect(isTaskLine('tasks.txt')).toBe(false);
		});
	});

	describe('buildTaskFilesSection function', () => {
		test('should build commented section when storeTasksInGit is true (tasks stored in git)', () => {
			const result = buildTaskFilesSection(true);
			expect(result).toEqual(['# Task files', '# tasks.json', '# tasks/ ']);
		});

		test('should build uncommented section when storeTasksInGit is false (tasks ignored)', () => {
			const result = buildTaskFilesSection(false);
			expect(result).toEqual(['# Task files', 'tasks.json', 'tasks/ ']);
		});
	});

	describe('manageGitignoreFile function - Input Validation', () => {
		test('should throw error for invalid targetPath', () => {
			expect(() => {
				manageGitignoreFile('', 'content', false);
			}).toThrow('targetPath must be a non-empty string');

			expect(() => {
				manageGitignoreFile(null, 'content', false);
			}).toThrow('targetPath must be a non-empty string');

			expect(() => {
				manageGitignoreFile('invalid.txt', 'content', false);
			}).toThrow('targetPath must end with .gitignore');
		});

		test('should throw error for invalid content', () => {
			expect(() => {
				manageGitignoreFile('.gitignore', '', false);
			}).toThrow('content must be a non-empty string');

			expect(() => {
				manageGitignoreFile('.gitignore', null, false);
			}).toThrow('content must be a non-empty string');
		});

		test('should throw error for invalid storeTasksInGit', () => {
			expect(() => {
				manageGitignoreFile('.gitignore', 'content', 'not-boolean');
			}).toThrow('storeTasksInGit must be a boolean');
		});
	});

	describe('manageGitignoreFile function - File Operations with Spies', () => {
		let writeFileSyncSpy;
		let readFileSyncSpy;
		let existsSyncSpy;
		let mockLog;

		beforeEach(() => {
			// Set up spies
			writeFileSyncSpy = jest
				.spyOn(fs, 'writeFileSync')
				.mockImplementation(() => {});
			readFileSyncSpy = jest
				.spyOn(fs, 'readFileSync')
				.mockImplementation(() => '');
			existsSyncSpy = jest
				.spyOn(fs, 'existsSync')
				.mockImplementation(() => false);
			mockLog = jest.fn();
		});

		afterEach(() => {
			// Restore original implementations
			writeFileSyncSpy.mockRestore();
			readFileSyncSpy.mockRestore();
			existsSyncSpy.mockRestore();
		});

		describe('New File Creation', () => {
			const templateContent = `# Logs
logs
*.log

# Task files
tasks.json
tasks/ `;

			test('should create new file with commented task lines when storeTasksInGit is true', () => {
				existsSyncSpy.mockReturnValue(false); // File doesn't exist

				manageGitignoreFile('.gitignore', templateContent, true, mockLog);

				expect(writeFileSyncSpy).toHaveBeenCalledWith(
					'.gitignore',
					`# Logs
logs
*.log

# Task files
# tasks.json
# tasks/ 
`
				);
				expect(mockLog).toHaveBeenCalledWith(
					'success',
					'Created .gitignore with full template'
				);
			});

			test('should create new file with uncommented task lines when storeTasksInGit is false', () => {
				existsSyncSpy.mockReturnValue(false); // File doesn't exist

				manageGitignoreFile('.gitignore', templateContent, false, mockLog);

				expect(writeFileSyncSpy).toHaveBeenCalledWith(
					'.gitignore',
					`# Logs
logs
*.log

# Task files
tasks.json
tasks/ 
`
				);
				expect(mockLog).toHaveBeenCalledWith(
					'success',
					'Created .gitignore with full template'
				);
			});

			test('should handle write errors gracefully', () => {
				existsSyncSpy.mockReturnValue(false);
				const writeError = new Error('Permission denied');
				writeFileSyncSpy.mockImplementation(() => {
					throw writeError;
				});

				expect(() => {
					manageGitignoreFile('.gitignore', templateContent, false, mockLog);
				}).toThrow('Permission denied');

				expect(mockLog).toHaveBeenCalledWith(
					'error',
					'Failed to create .gitignore: Permission denied'
				);
			});
		});

		describe('File Merging', () => {
			const templateContent = `# Logs
logs
*.log

# Dependencies
node_modules/

# Task files
tasks.json
tasks/ `;

			test('should merge with existing file and add new content', () => {
				const existingContent = `# Old content
old-file.txt

# Task files
# tasks.json
# tasks/`;

				existsSyncSpy.mockReturnValue(true); // File exists
				readFileSyncSpy.mockReturnValue(existingContent);

				manageGitignoreFile('.gitignore', templateContent, false, mockLog);

				expect(writeFileSyncSpy).toHaveBeenCalledWith(
					'.gitignore',
					expect.stringContaining('# Old content')
				);
				expect(writeFileSyncSpy).toHaveBeenCalledWith(
					'.gitignore',
					expect.stringContaining('# Logs')
				);
				expect(writeFileSyncSpy).toHaveBeenCalledWith(
					'.gitignore',
					expect.stringContaining('# Dependencies')
				);
				expect(writeFileSyncSpy).toHaveBeenCalledWith(
					'.gitignore',
					expect.stringContaining('# Task files')
				);
			});

			test('should remove existing task section and replace with new preferences', () => {
				const existingContent = `# Existing
existing.txt

# Task files
tasks.json
tasks/

# More content
more.txt`;

				existsSyncSpy.mockReturnValue(true);
				readFileSyncSpy.mockReturnValue(existingContent);

				manageGitignoreFile('.gitignore', templateContent, false, mockLog);

				const writtenContent = writeFileSyncSpy.mock.calls[0][1];

				// Should contain existing non-task content
				expect(writtenContent).toContain('# Existing');
				expect(writtenContent).toContain('existing.txt');
				expect(writtenContent).toContain('# More content');
				expect(writtenContent).toContain('more.txt');

				// Should contain new template content
				expect(writtenContent).toContain('# Logs');
				expect(writtenContent).toContain('# Dependencies');

				// Should have uncommented task lines (storeTasksInGit = false means ignore tasks)
				expect(writtenContent).toMatch(
					/# Task files\s*[\r\n]+tasks\.json\s*[\r\n]+tasks\/ /
				);
			});

			test('should handle different task preferences correctly', () => {
				const existingContent = `# Existing
existing.txt

# Task files
# tasks.json
# tasks/`;

				existsSyncSpy.mockReturnValue(true);
				readFileSyncSpy.mockReturnValue(existingContent);

				// Test with storeTasksInGit = true (commented)
				manageGitignoreFile('.gitignore', templateContent, true, mockLog);

				const writtenContent = writeFileSyncSpy.mock.calls[0][1];
				expect(writtenContent).toMatch(
					/# Task files\s*[\r\n]+# tasks\.json\s*[\r\n]+# tasks\/ /
				);
			});

			test('should not duplicate existing template content', () => {
				const existingContent = `# Logs
logs
*.log

# Dependencies  
node_modules/

# Task files
# tasks.json
# tasks/`;

				existsSyncSpy.mockReturnValue(true);
				readFileSyncSpy.mockReturnValue(existingContent);

				manageGitignoreFile('.gitignore', templateContent, false, mockLog);

				const writtenContent = writeFileSyncSpy.mock.calls[0][1];

				// Should not duplicate the logs section
				const logsCount = (writtenContent.match(/# Logs/g) || []).length;
				expect(logsCount).toBe(1);

				// Should not duplicate dependencies
				const depsCount = (writtenContent.match(/# Dependencies/g) || [])
					.length;
				expect(depsCount).toBe(1);
			});

			test('should handle read errors gracefully', () => {
				existsSyncSpy.mockReturnValue(true);
				const readError = new Error('File not readable');
				readFileSyncSpy.mockImplementation(() => {
					throw readError;
				});

				expect(() => {
					manageGitignoreFile('.gitignore', templateContent, false, mockLog);
				}).toThrow('File not readable');

				expect(mockLog).toHaveBeenCalledWith(
					'error',
					'Failed to merge content with .gitignore: File not readable'
				);
			});

			test('should handle write errors during merge gracefully', () => {
				existsSyncSpy.mockReturnValue(true);
				readFileSyncSpy.mockReturnValue('existing content');

				const writeError = new Error('Disk full');
				writeFileSyncSpy.mockImplementation(() => {
					throw writeError;
				});

				expect(() => {
					manageGitignoreFile('.gitignore', templateContent, false, mockLog);
				}).toThrow('Disk full');

				expect(mockLog).toHaveBeenCalledWith(
					'error',
					'Failed to merge content with .gitignore: Disk full'
				);
			});
		});

		describe('Edge Cases', () => {
			test('should work without log function', () => {
				existsSyncSpy.mockReturnValue(false);
				const templateContent = `# Test
test.txt

# Task files
tasks.json
tasks/`;

				expect(() => {
					manageGitignoreFile('.gitignore', templateContent, false);
				}).not.toThrow();

				expect(writeFileSyncSpy).toHaveBeenCalled();
			});

			test('should handle empty existing file', () => {
				existsSyncSpy.mockReturnValue(true);
				readFileSyncSpy.mockReturnValue('');

				const templateContent = `# Task files
tasks.json
tasks/`;

				manageGitignoreFile('.gitignore', templateContent, false, mockLog);

				expect(writeFileSyncSpy).toHaveBeenCalled();
				const writtenContent = writeFileSyncSpy.mock.calls[0][1];
				expect(writtenContent).toContain('# Task files');
			});

			test('should handle template with only task files', () => {
				existsSyncSpy.mockReturnValue(false);
				const templateContent = `# Task files
tasks.json
tasks/ `;

				manageGitignoreFile('.gitignore', templateContent, true, mockLog);

				const writtenContent = writeFileSyncSpy.mock.calls[0][1];
				expect(writtenContent).toBe(`# Task files
# tasks.json
# tasks/ 
`);
			});
		});
	});
});
