/**
 * Tests for task-master.js initTaskMaster function
 */

import { jest } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { initTaskMaster, TaskMaster } from '../../src/task-master.js';
import {
	TASKMASTER_DIR,
	TASKMASTER_TASKS_FILE,
	LEGACY_CONFIG_FILE,
	TASKMASTER_CONFIG_FILE,
	LEGACY_TASKS_FILE
} from '../../src/constants/paths.js';

// Mock the console to prevent noise during tests
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('initTaskMaster', () => {
	let tempDir;
	let originalCwd;

	beforeEach(() => {
		// Create a temporary directory for testing
		tempDir = fs.realpathSync(
			fs.mkdtempSync(path.join(os.tmpdir(), 'taskmaster-test-'))
		);
		originalCwd = process.cwd();

		// Clear all mocks
		jest.clearAllMocks();
	});

	afterEach(() => {
		// Restore original working directory
		process.chdir(originalCwd);

		// Clean up temporary directory
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	describe('Project root detection', () => {
		test('should find project root when .taskmaster directory exists', () => {
			// Arrange - Create .taskmaster directory in temp dir
			const taskMasterDir = path.join(tempDir, TASKMASTER_DIR);
			fs.mkdirSync(taskMasterDir, { recursive: true });

			// Change to temp directory
			process.chdir(tempDir);

			// Act
			const taskMaster = initTaskMaster({});

			// Assert
			expect(taskMaster.getProjectRoot()).toBe(tempDir);
			expect(taskMaster).toBeInstanceOf(TaskMaster);
		});

		test('should find project root when legacy config file exists', () => {
			// Arrange - Create legacy config file in temp dir
			const legacyConfigPath = path.join(tempDir, LEGACY_CONFIG_FILE);
			fs.writeFileSync(legacyConfigPath, '{}');

			// Change to temp directory
			process.chdir(tempDir);

			// Act
			const taskMaster = initTaskMaster({});

			// Assert
			expect(taskMaster.getProjectRoot()).toBe(tempDir);
		});

		test('should find project root from subdirectory', () => {
			// Arrange - Create .taskmaster directory in temp dir
			const taskMasterDir = path.join(tempDir, TASKMASTER_DIR);
			fs.mkdirSync(taskMasterDir, { recursive: true });

			// Create a subdirectory and change to it
			const srcDir = path.join(tempDir, 'src');
			fs.mkdirSync(srcDir, { recursive: true });
			process.chdir(srcDir);

			// Act
			const taskMaster = initTaskMaster({});

			// Assert
			expect(taskMaster.getProjectRoot()).toBe(tempDir);
		});

		test('should find project root from deeply nested subdirectory', () => {
			// Arrange - Create .taskmaster directory in temp dir
			const taskMasterDir = path.join(tempDir, TASKMASTER_DIR);
			fs.mkdirSync(taskMasterDir, { recursive: true });

			// Create deeply nested subdirectory and change to it
			const deepDir = path.join(tempDir, 'src', 'components', 'ui');
			fs.mkdirSync(deepDir, { recursive: true });
			process.chdir(deepDir);

			// Act
			const taskMaster = initTaskMaster({});

			// Assert
			expect(taskMaster.getProjectRoot()).toBe(tempDir);
		});

		test('should return cwd when no project markers found cuz we changed the behavior of this function', () => {
			// Arrange - Empty temp directory, no project markers
			process.chdir(tempDir);

			// Act
			const taskMaster = initTaskMaster({});

			// Assert
			expect(taskMaster.getProjectRoot()).toBe(tempDir);
		});
	});

	describe('Project root override validation', () => {
		test('should accept valid project root override with .taskmaster directory', () => {
			// Arrange - Create .taskmaster directory in temp dir
			const taskMasterDir = path.join(tempDir, TASKMASTER_DIR);
			fs.mkdirSync(taskMasterDir, { recursive: true });

			// Act
			const taskMaster = initTaskMaster({ projectRoot: tempDir });

			// Assert
			expect(taskMaster.getProjectRoot()).toBe(tempDir);
		});

		test('should accept valid project root override with legacy config', () => {
			// Arrange - Create legacy config file in temp dir
			const legacyConfigPath = path.join(tempDir, LEGACY_CONFIG_FILE);
			fs.writeFileSync(legacyConfigPath, '{}');

			// Act
			const taskMaster = initTaskMaster({ projectRoot: tempDir });

			// Assert
			expect(taskMaster.getProjectRoot()).toBe(tempDir);
		});

		test('should throw error when project root override does not exist', () => {
			// Arrange - Non-existent path
			const nonExistentPath = path.join(tempDir, 'does-not-exist');

			// Act & Assert
			expect(() => {
				initTaskMaster({ projectRoot: nonExistentPath });
			}).toThrow(
				`Project root override path does not exist: ${nonExistentPath}`
			);
		});

		test('should throw error when project root override has no project markers', () => {
			// Arrange - Empty temp directory (no project markers)

			// Act & Assert
			expect(() => {
				initTaskMaster({ projectRoot: tempDir });
			}).toThrow(
				`Project root override is not a valid taskmaster project: ${tempDir}`
			);
		});

		test('should resolve relative project root override', () => {
			// Arrange - Create .taskmaster directory in temp dir
			const taskMasterDir = path.join(tempDir, TASKMASTER_DIR);
			fs.mkdirSync(taskMasterDir, { recursive: true });

			// Create subdirectory and change to it
			const srcDir = path.join(tempDir, 'src');
			fs.mkdirSync(srcDir, { recursive: true });
			process.chdir(srcDir);

			// Act - Use relative path '../' to go back to project root
			const taskMaster = initTaskMaster({ projectRoot: '../' });

			// Assert
			expect(taskMaster.getProjectRoot()).toBe(tempDir);
		});
	});

	describe('Path resolution with boolean logic', () => {
		let taskMasterDir, tasksPath, configPath, statePath;

		beforeEach(() => {
			// Setup a valid project structure
			taskMasterDir = path.join(tempDir, TASKMASTER_DIR);
			fs.mkdirSync(taskMasterDir, { recursive: true });

			tasksPath = path.join(tempDir, TASKMASTER_TASKS_FILE);
			fs.mkdirSync(path.dirname(tasksPath), { recursive: true });
			fs.writeFileSync(tasksPath, '[]');

			configPath = path.join(tempDir, TASKMASTER_CONFIG_FILE);
			fs.writeFileSync(configPath, '{}');

			statePath = path.join(taskMasterDir, 'state.json');
			fs.writeFileSync(statePath, '{}');

			process.chdir(tempDir);
		});

		test('should return paths when required (true) and files exist', () => {
			// Act
			const taskMaster = initTaskMaster({
				tasksPath: true,
				configPath: true,
				statePath: true
			});

			// Assert
			expect(taskMaster.getTasksPath()).toBe(tasksPath);
			expect(taskMaster.getConfigPath()).toBe(configPath);
			expect(taskMaster.getStatePath()).toBe(statePath);
		});

		test('should throw error when required (true) files do not exist', () => {
			// Arrange - Remove tasks file
			fs.unlinkSync(tasksPath);

			// Act & Assert
			expect(() => {
				initTaskMaster({ tasksPath: true });
			}).toThrow(
				'Required tasks file not found. Searched: .taskmaster/tasks/tasks.json, tasks/tasks.json'
			);
		});

		test('should return null when optional (false/undefined) files do not exist', () => {
			// Arrange - Remove tasks file
			fs.unlinkSync(tasksPath);

			// Act
			const taskMaster = initTaskMaster({
				tasksPath: false
			});

			// Assert
			expect(taskMaster.getTasksPath()).toBeNull();
		});

		test('should return default paths when optional files not specified in overrides', () => {
			// Arrange - Remove all optional files
			fs.unlinkSync(tasksPath);
			fs.unlinkSync(configPath);
			fs.unlinkSync(statePath);

			// Act - Don't specify any optional paths
			const taskMaster = initTaskMaster({});

			// Assert - Should return absolute paths with default locations
			expect(taskMaster.getTasksPath()).toBe(
				path.join(tempDir, TASKMASTER_TASKS_FILE)
			);
			expect(taskMaster.getConfigPath()).toBe(
				path.join(tempDir, TASKMASTER_CONFIG_FILE)
			);
			expect(taskMaster.getStatePath()).toBe(
				path.join(tempDir, TASKMASTER_DIR, 'state.json')
			);
		});
	});

	describe('String path overrides', () => {
		let taskMasterDir;

		beforeEach(() => {
			taskMasterDir = path.join(tempDir, TASKMASTER_DIR);
			fs.mkdirSync(taskMasterDir, { recursive: true });
			process.chdir(tempDir);
		});

		test('should accept valid absolute path override', () => {
			// Arrange - Create custom tasks file
			const customTasksPath = path.join(tempDir, 'custom-tasks.json');
			fs.writeFileSync(customTasksPath, '[]');

			// Act
			const taskMaster = initTaskMaster({
				tasksPath: customTasksPath
			});

			// Assert
			expect(taskMaster.getTasksPath()).toBe(customTasksPath);
		});

		test('should accept valid relative path override', () => {
			// Arrange - Create custom tasks file
			const customTasksPath = path.join(tempDir, 'custom-tasks.json');
			fs.writeFileSync(customTasksPath, '[]');

			// Act
			const taskMaster = initTaskMaster({
				tasksPath: './custom-tasks.json'
			});

			// Assert
			expect(taskMaster.getTasksPath()).toBe(customTasksPath);
		});

		test('should throw error when string path override does not exist', () => {
			// Arrange - Non-existent file path
			const nonExistentPath = path.join(tempDir, 'does-not-exist.json');

			// Act & Assert
			expect(() => {
				initTaskMaster({ tasksPath: nonExistentPath });
			}).toThrow(`tasks file override path does not exist: ${nonExistentPath}`);
		});
	});

	describe('Legacy file support', () => {
		beforeEach(() => {
			// Setup basic project structure
			const taskMasterDir = path.join(tempDir, TASKMASTER_DIR);
			fs.mkdirSync(taskMasterDir, { recursive: true });
			process.chdir(tempDir);
		});

		test('should find legacy tasks file when new format does not exist', () => {
			// Arrange - Create legacy tasks file
			const legacyTasksDir = path.join(tempDir, 'tasks');
			fs.mkdirSync(legacyTasksDir, { recursive: true });
			const legacyTasksPath = path.join(tempDir, LEGACY_TASKS_FILE);
			fs.writeFileSync(legacyTasksPath, '[]');

			// Act
			const taskMaster = initTaskMaster({ tasksPath: true });

			// Assert
			expect(taskMaster.getTasksPath()).toBe(legacyTasksPath);
		});

		test('should prefer new format over legacy when both exist', () => {
			// Arrange - Create both new and legacy files
			const newTasksPath = path.join(tempDir, TASKMASTER_TASKS_FILE);
			fs.mkdirSync(path.dirname(newTasksPath), { recursive: true });
			fs.writeFileSync(newTasksPath, '[]');

			const legacyTasksDir = path.join(tempDir, 'tasks');
			fs.mkdirSync(legacyTasksDir, { recursive: true });
			const legacyTasksPath = path.join(tempDir, LEGACY_TASKS_FILE);
			fs.writeFileSync(legacyTasksPath, '[]');

			// Act
			const taskMaster = initTaskMaster({ tasksPath: true });

			// Assert
			expect(taskMaster.getTasksPath()).toBe(newTasksPath);
		});

		test('should find legacy config file when new format does not exist', () => {
			// Arrange - Create legacy config file
			const legacyConfigPath = path.join(tempDir, LEGACY_CONFIG_FILE);
			fs.writeFileSync(legacyConfigPath, '{}');

			// Act
			const taskMaster = initTaskMaster({ configPath: true });

			// Assert
			expect(taskMaster.getConfigPath()).toBe(legacyConfigPath);
		});
	});

	describe('TaskMaster class methods', () => {
		test('should return all paths via getAllPaths method', () => {
			// Arrange - Setup project with all files
			const taskMasterDir = path.join(tempDir, TASKMASTER_DIR);
			fs.mkdirSync(taskMasterDir, { recursive: true });

			const tasksPath = path.join(tempDir, TASKMASTER_TASKS_FILE);
			fs.mkdirSync(path.dirname(tasksPath), { recursive: true });
			fs.writeFileSync(tasksPath, '[]');

			const configPath = path.join(tempDir, TASKMASTER_CONFIG_FILE);
			fs.writeFileSync(configPath, '{}');

			process.chdir(tempDir);

			// Act
			const taskMaster = initTaskMaster({
				tasksPath: true,
				configPath: true
			});

			// Assert
			const allPaths = taskMaster.getAllPaths();
			expect(allPaths).toEqual(
				expect.objectContaining({
					projectRoot: tempDir,
					taskMasterDir: taskMasterDir,
					tasksPath: tasksPath,
					configPath: configPath
				})
			);

			// Verify paths object is frozen
			expect(() => {
				allPaths.projectRoot = '/different/path';
			}).toThrow();
		});

		test('should return correct individual paths', () => {
			// Arrange
			const taskMasterDir = path.join(tempDir, TASKMASTER_DIR);
			fs.mkdirSync(taskMasterDir, { recursive: true });
			process.chdir(tempDir);

			// Act
			const taskMaster = initTaskMaster({});

			// Assert
			expect(taskMaster.getProjectRoot()).toBe(tempDir);
			expect(taskMaster.getTaskMasterDir()).toBe(taskMasterDir);
			// Default paths are always set for tasks, config, and state
			expect(taskMaster.getTasksPath()).toBe(
				path.join(tempDir, TASKMASTER_TASKS_FILE)
			);
			expect(taskMaster.getConfigPath()).toBe(
				path.join(tempDir, TASKMASTER_CONFIG_FILE)
			);
			expect(taskMaster.getStatePath()).toBe(
				path.join(taskMasterDir, 'state.json')
			);
			// PRD and complexity report paths are undefined when not provided
			expect(typeof taskMaster.getComplexityReportPath()).toBe('string');
			expect(taskMaster.getComplexityReportPath()).toMatch(
				/task-complexity-report\.json$/
			);
		});
	});
});
