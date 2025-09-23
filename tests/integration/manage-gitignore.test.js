/**
 * Integration tests for manage-gitignore.js module
 * Tests actual file system operations in a temporary directory
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import manageGitignoreFile from '../../src/utils/manage-gitignore.js';

describe('manage-gitignore.js Integration Tests', () => {
	let tempDir;
	let testGitignorePath;

	beforeEach(() => {
		// Create a temporary directory for each test
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitignore-test-'));
		testGitignorePath = path.join(tempDir, '.gitignore');
	});

	afterEach(() => {
		// Clean up temporary directory after each test
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	describe('New File Creation', () => {
		const templateContent = `# Logs
logs
*.log
npm-debug.log*

# Dependencies
node_modules/
jspm_packages/

# Environment variables
.env
.env.local

# Task files
tasks.json
tasks/ `;

		test('should create new .gitignore file with commented task lines (storeTasksInGit = true)', () => {
			const logs = [];
			const mockLog = (level, message) => logs.push({ level, message });

			manageGitignoreFile(testGitignorePath, templateContent, true, mockLog);

			// Verify file was created
			expect(fs.existsSync(testGitignorePath)).toBe(true);

			// Verify content
			const content = fs.readFileSync(testGitignorePath, 'utf8');
			expect(content).toContain('# Logs');
			expect(content).toContain('logs');
			expect(content).toContain('# Dependencies');
			expect(content).toContain('node_modules/');
			expect(content).toContain('# Task files');
			expect(content).toContain('tasks.json');
			expect(content).toContain('tasks/');

			// Verify task lines are commented (storeTasksInGit = true)
			expect(content).toMatch(
				/# Task files\s*[\r\n]+# tasks\.json\s*[\r\n]+# tasks\/ /
			);

			// Verify log message
			expect(logs).toContainEqual({
				level: 'success',
				message: expect.stringContaining('Created')
			});
		});

		test('should create new .gitignore file with uncommented task lines (storeTasksInGit = false)', () => {
			const logs = [];
			const mockLog = (level, message) => logs.push({ level, message });

			manageGitignoreFile(testGitignorePath, templateContent, false, mockLog);

			// Verify file was created
			expect(fs.existsSync(testGitignorePath)).toBe(true);

			// Verify content
			const content = fs.readFileSync(testGitignorePath, 'utf8');
			expect(content).toContain('# Task files');

			// Verify task lines are uncommented (storeTasksInGit = false)
			expect(content).toMatch(
				/# Task files\s*[\r\n]+tasks\.json\s*[\r\n]+tasks\/ /
			);

			// Verify log message
			expect(logs).toContainEqual({
				level: 'success',
				message: expect.stringContaining('Created')
			});
		});

		test('should work without log function', () => {
			expect(() => {
				manageGitignoreFile(testGitignorePath, templateContent, false);
			}).not.toThrow();

			expect(fs.existsSync(testGitignorePath)).toBe(true);
		});
	});

	describe('File Merging', () => {
		const templateContent = `# Logs
logs
*.log

# Dependencies
node_modules/

# Environment variables
.env

# Task files
tasks.json
tasks/ `;

		test('should merge template with existing file content', () => {
			// Create existing .gitignore file
			const existingContent = `# Existing content
old-files.txt
*.backup

# Old task files (to be replaced)
# Task files
# tasks.json
# tasks/ 

# More existing content
cache/`;

			fs.writeFileSync(testGitignorePath, existingContent);

			const logs = [];
			const mockLog = (level, message) => logs.push({ level, message });

			manageGitignoreFile(testGitignorePath, templateContent, false, mockLog);

			// Verify file still exists
			expect(fs.existsSync(testGitignorePath)).toBe(true);

			const content = fs.readFileSync(testGitignorePath, 'utf8');

			// Should retain existing non-task content
			expect(content).toContain('# Existing content');
			expect(content).toContain('old-files.txt');
			expect(content).toContain('*.backup');
			expect(content).toContain('# More existing content');
			expect(content).toContain('cache/');

			// Should add new template content
			expect(content).toContain('# Logs');
			expect(content).toContain('logs');
			expect(content).toContain('# Dependencies');
			expect(content).toContain('node_modules/');
			expect(content).toContain('# Environment variables');
			expect(content).toContain('.env');

			// Should replace task section with new preference (storeTasksInGit = false means uncommented)
			expect(content).toMatch(
				/# Task files\s*[\r\n]+tasks\.json\s*[\r\n]+tasks\/ /
			);

			// Verify log message
			expect(logs).toContainEqual({
				level: 'success',
				message: expect.stringContaining('Updated')
			});
		});

		test('should handle switching task preferences from commented to uncommented', () => {
			// Create existing file with commented task lines
			const existingContent = `# Existing
existing.txt

# Task files
# tasks.json
# tasks/ `;

			fs.writeFileSync(testGitignorePath, existingContent);

			// Update with storeTasksInGit = true (commented)
			manageGitignoreFile(testGitignorePath, templateContent, true);

			const content = fs.readFileSync(testGitignorePath, 'utf8');

			// Should retain existing content
			expect(content).toContain('# Existing');
			expect(content).toContain('existing.txt');

			// Should have commented task lines (storeTasksInGit = true)
			expect(content).toMatch(
				/# Task files\s*[\r\n]+# tasks\.json\s*[\r\n]+# tasks\/ /
			);
		});

		test('should handle switching task preferences from uncommented to commented', () => {
			// Create existing file with uncommented task lines
			const existingContent = `# Existing
existing.txt

# Task files
tasks.json
tasks/ `;

			fs.writeFileSync(testGitignorePath, existingContent);

			// Update with storeTasksInGit = false (uncommented)
			manageGitignoreFile(testGitignorePath, templateContent, false);

			const content = fs.readFileSync(testGitignorePath, 'utf8');

			// Should retain existing content
			expect(content).toContain('# Existing');
			expect(content).toContain('existing.txt');

			// Should have uncommented task lines (storeTasksInGit = false)
			expect(content).toMatch(
				/# Task files\s*[\r\n]+tasks\.json\s*[\r\n]+tasks\/ /
			);
		});

		test('should not duplicate existing template content', () => {
			// Create existing file that already has some template content
			const existingContent = `# Logs
logs
*.log

# Dependencies
node_modules/

# Custom content
custom.txt

# Task files
# tasks.json
# tasks/ `;

			fs.writeFileSync(testGitignorePath, existingContent);

			manageGitignoreFile(testGitignorePath, templateContent, false);

			const content = fs.readFileSync(testGitignorePath, 'utf8');

			// Should not duplicate logs section
			const logsMatches = content.match(/# Logs/g);
			expect(logsMatches).toHaveLength(1);

			// Should not duplicate dependencies section
			const depsMatches = content.match(/# Dependencies/g);
			expect(depsMatches).toHaveLength(1);

			// Should retain custom content
			expect(content).toContain('# Custom content');
			expect(content).toContain('custom.txt');

			// Should add new template content that wasn't present
			expect(content).toContain('# Environment variables');
			expect(content).toContain('.env');
		});

		test('should handle empty existing file', () => {
			// Create empty file
			fs.writeFileSync(testGitignorePath, '');

			manageGitignoreFile(testGitignorePath, templateContent, false);

			expect(fs.existsSync(testGitignorePath)).toBe(true);

			const content = fs.readFileSync(testGitignorePath, 'utf8');
			expect(content).toContain('# Logs');
			expect(content).toContain('# Task files');
			expect(content).toMatch(
				/# Task files\s*[\r\n]+tasks\.json\s*[\r\n]+tasks\/ /
			);
		});

		test('should handle file with only whitespace', () => {
			// Create file with only whitespace
			fs.writeFileSync(testGitignorePath, '   \n\n  \n');

			manageGitignoreFile(testGitignorePath, templateContent, true);

			const content = fs.readFileSync(testGitignorePath, 'utf8');
			expect(content).toContain('# Logs');
			expect(content).toContain('# Task files');
			expect(content).toMatch(
				/# Task files\s*[\r\n]+# tasks\.json\s*[\r\n]+# tasks\/ /
			);
		});
	});

	describe('Complex Task Section Handling', () => {
		test('should remove task section with mixed comments and spacing', () => {
			const existingContent = `# Dependencies
node_modules/

# Task files

# tasks.json
tasks/


# More content
more.txt`;

			const templateContent = `# New content
new.txt

# Task files
tasks.json
tasks/ `;

			fs.writeFileSync(testGitignorePath, existingContent);

			manageGitignoreFile(testGitignorePath, templateContent, false);

			const content = fs.readFileSync(testGitignorePath, 'utf8');

			// Should retain non-task content
			expect(content).toContain('# Dependencies');
			expect(content).toContain('node_modules/');
			expect(content).toContain('# More content');
			expect(content).toContain('more.txt');

			// Should add new content
			expect(content).toContain('# New content');
			expect(content).toContain('new.txt');

			// Should have clean task section (storeTasksInGit = false means uncommented)
			expect(content).toMatch(
				/# Task files\s*[\r\n]+tasks\.json\s*[\r\n]+tasks\/ /
			);
		});

		test('should handle multiple task file variations', () => {
			const existingContent = `# Existing
existing.txt

# Task files
tasks.json
# tasks.json  
# tasks/ 
tasks/ 
#tasks.json

# More content
more.txt`;

			const templateContent = `# Task files
tasks.json
tasks/ `;

			fs.writeFileSync(testGitignorePath, existingContent);

			manageGitignoreFile(testGitignorePath, templateContent, true);

			const content = fs.readFileSync(testGitignorePath, 'utf8');

			// Should retain non-task content
			expect(content).toContain('# Existing');
			expect(content).toContain('existing.txt');
			expect(content).toContain('# More content');
			expect(content).toContain('more.txt');

			// Should have clean task section with preference applied (storeTasksInGit = true means commented)
			expect(content).toMatch(
				/# Task files\s*[\r\n]+# tasks\.json\s*[\r\n]+# tasks\/ /
			);

			// Should not have multiple task sections
			const taskFileMatches = content.match(/# Task files/g);
			expect(taskFileMatches).toHaveLength(1);
		});
	});

	describe('Error Handling', () => {
		test('should handle permission errors gracefully', () => {
			// Create a directory where we would create the file, then remove write permissions
			const readOnlyDir = path.join(tempDir, 'readonly');
			fs.mkdirSync(readOnlyDir);
			fs.chmodSync(readOnlyDir, 0o444); // Read-only

			const readOnlyGitignorePath = path.join(readOnlyDir, '.gitignore');
			const templateContent = `# Test
test.txt

# Task files
tasks.json
tasks/ `;

			const logs = [];
			const mockLog = (level, message) => logs.push({ level, message });

			expect(() => {
				manageGitignoreFile(
					readOnlyGitignorePath,
					templateContent,
					false,
					mockLog
				);
			}).toThrow();

			// Verify error was logged
			expect(logs).toContainEqual({
				level: 'error',
				message: expect.stringContaining('Failed to create')
			});

			// Restore permissions for cleanup
			fs.chmodSync(readOnlyDir, 0o755);
		});

		test('should handle read errors on existing files', () => {
			// Create a file then remove read permissions
			fs.writeFileSync(testGitignorePath, 'existing content');
			fs.chmodSync(testGitignorePath, 0o000); // No permissions

			const templateContent = `# Test
test.txt

# Task files
tasks.json
tasks/ `;

			const logs = [];
			const mockLog = (level, message) => logs.push({ level, message });

			expect(() => {
				manageGitignoreFile(testGitignorePath, templateContent, false, mockLog);
			}).toThrow();

			// Verify error was logged
			expect(logs).toContainEqual({
				level: 'error',
				message: expect.stringContaining('Failed to merge content')
			});

			// Restore permissions for cleanup
			fs.chmodSync(testGitignorePath, 0o644);
		});
	});

	describe('Real-world Scenarios', () => {
		test('should handle typical Node.js project .gitignore', () => {
			const existingNodeGitignore = `# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Dependency directories
node_modules/
jspm_packages/

# Optional npm cache directory
.npm

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env

# next.js build output
.next`;

			const taskMasterTemplate = `# Logs
logs
*.log

# Dependencies  
node_modules/

# Environment variables
.env

# Build output
dist/
build/

# Task files
tasks.json
tasks/ `;

			fs.writeFileSync(testGitignorePath, existingNodeGitignore);

			manageGitignoreFile(testGitignorePath, taskMasterTemplate, false);

			const content = fs.readFileSync(testGitignorePath, 'utf8');

			// Should retain existing Node.js specific entries
			expect(content).toContain('npm-debug.log*');
			expect(content).toContain('yarn-debug.log*');
			expect(content).toContain('*.pid');
			expect(content).toContain('jspm_packages/');
			expect(content).toContain('.npm');
			expect(content).toContain('*.tgz');
			expect(content).toContain('.yarn-integrity');
			expect(content).toContain('.next');

			// Should add new content from template that wasn't present
			expect(content).toContain('dist/');
			expect(content).toContain('build/');

			// Should add task files section with correct preference (storeTasksInGit = false means uncommented)
			expect(content).toMatch(
				/# Task files\s*[\r\n]+tasks\.json\s*[\r\n]+tasks\/ /
			);

			// Should not duplicate common entries
			const nodeModulesMatches = content.match(/node_modules\//g);
			expect(nodeModulesMatches).toHaveLength(1);

			const logsMatches = content.match(/# Logs/g);
			expect(logsMatches).toHaveLength(1);
		});

		test('should handle project with existing task files in git', () => {
			const existingContent = `# Dependencies
node_modules/

# Logs
*.log

# Current task setup - keeping in git
# Task files
tasks.json
tasks/ 

# Build output
dist/`;

			const templateContent = `# New template
# Dependencies
node_modules/

# Task files
tasks.json
tasks/ `;

			fs.writeFileSync(testGitignorePath, existingContent);

			// Change preference to exclude tasks from git (storeTasksInGit = false means uncommented/ignored)
			manageGitignoreFile(testGitignorePath, templateContent, false);

			const content = fs.readFileSync(testGitignorePath, 'utf8');

			// Should retain existing content
			expect(content).toContain('# Dependencies');
			expect(content).toContain('node_modules/');
			expect(content).toContain('# Logs');
			expect(content).toContain('*.log');
			expect(content).toContain('# Build output');
			expect(content).toContain('dist/');

			// Should update task preference to uncommented (storeTasksInGit = false)
			expect(content).toMatch(
				/# Task files\s*[\r\n]+tasks\.json\s*[\r\n]+tasks\/ /
			);
		});
	});
});
