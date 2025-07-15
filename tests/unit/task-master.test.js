/**
 * Tests for task-master.js initTaskMaster function
 */

import {
	jest,
	describe,
	it,
	test,
	beforeEach,
	afterEach,
	expect
} from '@jest/globals';
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

		test('should throw error when no project markers found', () => {
			// Arrange - Empty temp directory, no project markers
			process.chdir(tempDir);

			// Act & Assert
			expect(() => {
				initTaskMaster({});
			}).toThrow(
				'Unable to find project root. No project markers found. Run "init" command first.'
			);
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

	describe('Default path behavior', () => {
		let taskMasterDir, expectedTasksPath, expectedConfigPath;

		beforeEach(() => {
			// Setup a valid project structure
			taskMasterDir = path.join(tempDir, TASKMASTER_DIR);
			fs.mkdirSync(taskMasterDir, { recursive: true });

			expectedTasksPath = path.join(tempDir, TASKMASTER_TASKS_FILE);
			expectedConfigPath = path.join(tempDir, TASKMASTER_CONFIG_FILE);

			process.chdir(tempDir);
		});

		test('should return default paths as strings even when files do not exist', () => {
			// Act - No overrides, files don't exist

			const taskMaster = initTaskMaster({});

			// Assert - Should return default paths as strings
			expect(taskMaster.getTasksPath()).toBe(expectedTasksPath);
			expect(taskMaster.getConfigPath()).toBe(expectedConfigPath);
			expect(taskMaster.getTaskMasterDir()).toBe(taskMasterDir);
			expect(typeof taskMaster.getTasksPath()).toBe('string');
			expect(typeof taskMaster.getConfigPath()).toBe('string');
			expect(typeof taskMaster.getTaskMasterDir()).toBe('string');
		});

		test('should return default paths as strings when files exist', () => {
			// Arrange - Create the files
			fs.mkdirSync(path.dirname(expectedTasksPath), { recursive: true });
			fs.writeFileSync(expectedTasksPath, '[]');
			fs.writeFileSync(expectedConfigPath, '{}');

			// Act - No overrides, files exist
			const taskMaster = initTaskMaster({});

			// Assert - Should return default paths as strings
			expect(taskMaster.getTasksPath()).toBe(expectedTasksPath);
			expect(taskMaster.getConfigPath()).toBe(expectedConfigPath);
			expect(taskMaster.getTaskMasterDir()).toBe(taskMasterDir);
		});

		test('should return null only for optional paths not specified', () => {
			// Act - No overrides
			const taskMaster = initTaskMaster({});

			// Assert - Core paths are strings, optional paths are null
			expect(taskMaster.getTasksPath()).toBe(expectedTasksPath);
			expect(taskMaster.getConfigPath()).toBe(expectedConfigPath);
			expect(taskMaster.getTaskMasterDir()).toBe(taskMasterDir);
			expect(taskMaster.getStatePath()).toBe(null);
			expect(taskMaster.getPrdPath()).toBe(null);
			expect(taskMaster.getComplexityReportPath()).toBe(null);
		});

		test('should return null when paths are explicitly set to false', () => {
			// Act
			const taskMaster = initTaskMaster({
				paths: {
					tasksPath: false,
					configPath: false
				}
			});

			// Assert - false means explicitly disabled
			expect(taskMaster.getTasksPath()).toBe(null);
			expect(taskMaster.getConfigPath()).toBe(null);
		});

		test('should return default paths when paths are explicitly set to null', () => {
			// Act
			const taskMaster = initTaskMaster({
				paths: {
					tasksPath: null,
					configPath: null
				}
			});

			// Assert - null means use default
			expect(taskMaster.getTasksPath()).toBe(expectedTasksPath);
			expect(taskMaster.getConfigPath()).toBe(expectedConfigPath);
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
				paths: {
					tasksPath: customTasksPath
				}
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
				paths: {
					tasksPath: './custom-tasks.json'
				}
			});

			// Assert
			expect(taskMaster.getTasksPath()).toBe(customTasksPath);
		});

		test('should throw error when string path override does not exist', () => {
			// Arrange - Non-existent file path
			const nonExistentPath = path.join(tempDir, 'does-not-exist.json');

			// Act & Assert
			expect(() => {
				initTaskMaster({ paths: { tasksPath: nonExistentPath } });
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
			const taskMaster = initTaskMaster({ paths: { tasksPath: undefined } });

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
			const taskMaster = initTaskMaster({ paths: { tasksPath: undefined } });

			// Assert
			expect(taskMaster.getTasksPath()).toBe(newTasksPath);
		});

		test('should find legacy config file when new format does not exist', () => {
			// Arrange - Create legacy config file
			const legacyConfigPath = path.join(tempDir, LEGACY_CONFIG_FILE);
			fs.writeFileSync(legacyConfigPath, '{}');

			// Act
			const taskMaster = initTaskMaster({ paths: { configPath: undefined } });

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
				paths: {
					tasksPath: undefined,
					configPath: undefined
				}
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
			expect(taskMaster.getTasksPath()).toBe(
				path.join(tempDir, TASKMASTER_TASKS_FILE)
			);
			expect(taskMaster.getConfigPath()).toBe(
				path.join(tempDir, TASKMASTER_CONFIG_FILE)
			);
			// Optional paths should be null when not specified
			expect(taskMaster.getPrdPath()).toBe(null);
			expect(taskMaster.getComplexityReportPath()).toBe(null);
			expect(taskMaster.getStatePath()).toBe(null);
		});
	});

	describe('Required path validation', () => {
		beforeEach(() => {
			// Setup basic project structure
			const taskMasterDir = path.join(tempDir, TASKMASTER_DIR);
			fs.mkdirSync(taskMasterDir, { recursive: true });
			process.chdir(tempDir);
		});

		test('should throw error when required path is explicitly set to false', () => {
			// Act & Assert
			expect(() => {
				initTaskMaster({
					paths: {
						tasksPath: false
					},
					required: ['tasksPath']
				});
			}).toThrow(
				'Required tasks file not found. Searched: .taskmaster/tasks/tasks.json, tasks/tasks.json'
			);
		});

		test('should throw error when required path string does not exist', () => {
			// Arrange
			const nonExistentPath = path.join(tempDir, 'nonexistent.json');

			// Act & Assert
			expect(() => {
				initTaskMaster({
					paths: {
						tasksPath: nonExistentPath
					},
					required: ['tasksPath']
				});
			}).toThrow(`tasks file override path does not exist: ${nonExistentPath}`);
		});

		test('should succeed when required path exists', () => {
			// Arrange - Create the required file
			const tasksPath = path.join(tempDir, TASKMASTER_TASKS_FILE);
			fs.mkdirSync(path.dirname(tasksPath), { recursive: true });
			fs.writeFileSync(tasksPath, '[]');

			// Act
			const taskMaster = initTaskMaster({
				paths: {
					tasksPath: tasksPath
				},
				required: ['tasksPath']
			});

			// Assert
			expect(taskMaster.getTasksPath()).toBe(tasksPath);
		});

		test('should succeed when required path is found via search', () => {
			// Arrange - Create the default file
			const tasksPath = path.join(tempDir, TASKMASTER_TASKS_FILE);
			fs.mkdirSync(path.dirname(tasksPath), { recursive: true });
			fs.writeFileSync(tasksPath, '[]');

			// Act
			const taskMaster = initTaskMaster({
				paths: {
					tasksPath: null // Should search and find the file
				},
				required: ['tasksPath']
			});

			// Assert
			expect(taskMaster.getTasksPath()).toBe(tasksPath);
		});

		test('should throw error when required path is not found via search', () => {
			// Arrange - No tasks file exists

			// Act & Assert
			expect(() => {
				initTaskMaster({
					paths: {
						tasksPath: null // Should search but not find
					},
					required: ['tasksPath']
				});
			}).toThrow(
				'Required tasks file not found. Searched: .taskmaster/tasks/tasks.json, tasks/tasks.json'
			);
		});

		test('should handle multiple required paths', () => {
			// Arrange - Create only one of the required files
			const tasksPath = path.join(tempDir, TASKMASTER_TASKS_FILE);
			fs.mkdirSync(path.dirname(tasksPath), { recursive: true });
			fs.writeFileSync(tasksPath, '[]');

			// Act & Assert
			expect(() => {
				initTaskMaster({
					paths: {
						tasksPath: null,
						configPath: null
					},
					required: ['tasksPath', 'configPath']
				});
			}).toThrow(
				'Required config file not found. Searched: .taskmaster/config.json, .taskmasterconfig'
			);
		});
	});

	describe('Bootstrap Mode Tests', () => {
		test('should succeed in empty directory when bootstrap=true', () => {
			// Arrange - empty directory with no .taskmaster markers
			process.chdir(tempDir);

			// Act
			const taskMaster = initTaskMaster({ bootstrap: true });

			// Assert
			expect(taskMaster.getProjectRoot()).toBe(tempDir);
			expect(taskMaster.getTaskMasterDir()).toBe(
				path.join(tempDir, TASKMASTER_DIR)
			);
			expect(taskMaster.getTasksPath()).toBe(
				path.join(tempDir, TASKMASTER_TASKS_FILE)
			);
		});

		test('should skip validation when bootstrap=true with project root override', () => {
			// Arrange - another empty directory
			const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-test-'));

			// Act - should not throw even though empty dir has no .taskmaster
			const taskMaster = initTaskMaster({
				projectRoot: emptyDir,
				bootstrap: true
			});

			// Assert
			expect(taskMaster.getProjectRoot()).toBe(emptyDir);
			expect(taskMaster.getTaskMasterDir()).toBe(
				path.join(emptyDir, TASKMASTER_DIR)
			);

			// Cleanup
			fs.rmSync(emptyDir, { recursive: true, force: true });
		});

		test('should resolve paths in .taskmaster directory when it exists', () => {
			// Arrange
			const taskMasterDir = path.join(tempDir, TASKMASTER_DIR);
			fs.mkdirSync(taskMasterDir, { recursive: true });
			fs.writeFileSync(path.join(taskMasterDir, 'state.json'), '{}');
			process.chdir(tempDir);

			// Act
			const taskMaster = initTaskMaster({
				bootstrap: true,
				paths: {
					statePath: undefined
				}
			});

			// Assert - statePath should be resolved even in bootstrap mode
			expect(taskMaster.getStatePath()).toBe(
				path.join(taskMasterDir, 'state.json')
			);
		});

		test('should handle prdPath resolution and default search paths', () => {
			// Arrange - create PRD file in default location
			const taskMasterDir = path.join(tempDir, TASKMASTER_DIR);
			const docsDir = path.join(taskMasterDir, 'docs');
			fs.mkdirSync(docsDir, { recursive: true });
			const prdPath = path.join(docsDir, 'PRD.md');
			fs.writeFileSync(prdPath, '# PRD');
			process.chdir(tempDir);

			// Act
			const taskMaster = initTaskMaster({
				bootstrap: true,
				paths: {
					prdPath: undefined
				}
			});

			// Assert
			expect(taskMaster.getPrdPath()).toBe(prdPath);
		});

		test('should handle complexityReportPath resolution', () => {
			// Arrange - create complexity report in default location
			const taskMasterDir = path.join(tempDir, TASKMASTER_DIR);
			const reportsDir = path.join(taskMasterDir, 'reports');
			fs.mkdirSync(reportsDir, { recursive: true });
			const reportPath = path.join(reportsDir, 'complexity-report.json');
			fs.writeFileSync(reportPath, '{}');
			process.chdir(tempDir);

			// Act
			const taskMaster = initTaskMaster({
				bootstrap: true,
				paths: {
					complexityReportPath: undefined
				}
			});

			// Assert
			expect(taskMaster.getComplexityReportPath()).toBe(reportPath);
		});

		test('should handle taskMasterDir override scenarios', () => {
			// Arrange - create custom taskmaster directory
			const customDir = path.join(tempDir, 'custom-tm');
			fs.mkdirSync(customDir, { recursive: true });
			process.chdir(tempDir);

			// Act - test absolute path override
			const taskMaster1 = initTaskMaster({
				bootstrap: true,
				paths: {
					taskMasterDir: customDir
				}
			});

			// Assert
			expect(taskMaster1.getTaskMasterDir()).toBe(customDir);

			// Act - test relative path override
			const taskMaster2 = initTaskMaster({
				bootstrap: true,
				paths: {
					taskMasterDir: 'custom-tm'
				}
			});

			// Assert
			expect(taskMaster2.getTaskMasterDir()).toBe(customDir);
		});

		test('should handle relative path with explicit projectRoot override', () => {
			// Arrange - create project structure
			const projectDir = path.join(tempDir, 'project');
			const tasksDir = path.join(projectDir, 'tasks');
			fs.mkdirSync(tasksDir, { recursive: true });
			const tasksFile = path.join(tasksDir, 'tasks.json');
			fs.writeFileSync(tasksFile, '{"tasks": []}');

			// Act - provide relative tasks path with explicit project root
			const taskMaster = initTaskMaster({
				projectRoot: projectDir,
				bootstrap: true,
				paths: {
					tasksPath: 'tasks/tasks.json'
				}
			});

			// Assert - should resolve relative to project root, not CWD
			expect(taskMaster.getTasksPath()).toBe(tasksFile);
		});
	});
});
