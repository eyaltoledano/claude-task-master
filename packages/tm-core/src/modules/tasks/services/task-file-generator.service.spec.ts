/**
 * @fileoverview Unit tests for TaskFileGeneratorService
 * Tests task file generation from storage
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskFileGeneratorService } from './task-file-generator.service.js';
import type { IStorage } from '../../../common/interfaces/storage.interface.js';
import type { Task } from '../../../common/types/index.js';
import type { ConfigManager } from '../../config/managers/config-manager.js';

// Mock storage implementation for testing
function createMockStorage(tasks: Task[] = []): IStorage {
	return {
		loadTasks: vi.fn().mockResolvedValue(tasks),
		loadTask: vi.fn(),
		saveTasks: vi.fn(),
		appendTasks: vi.fn(),
		updateTask: vi.fn(),
		updateTaskWithPrompt: vi.fn(),
		expandTaskWithPrompt: vi.fn(),
		updateTaskStatus: vi.fn(),
		deleteTask: vi.fn(),
		exists: vi.fn().mockResolvedValue(true),
		loadMetadata: vi.fn(),
		saveMetadata: vi.fn(),
		getAllTags: vi.fn().mockResolvedValue(['master']),
		createTag: vi.fn(),
		deleteTag: vi.fn(),
		renameTag: vi.fn(),
		copyTag: vi.fn(),
		initialize: vi.fn(),
		close: vi.fn(),
		getStats: vi.fn(),
		getStorageType: vi.fn().mockReturnValue('file'),
		getCurrentBriefName: vi.fn().mockReturnValue(null),
		getTagsWithStats: vi.fn(),
		watch: vi.fn().mockResolvedValue({ unsubscribe: vi.fn() })
	};
}

function createSampleTasks(): Task[] {
	return [
		{
			id: '1',
			title: 'First Task',
			description: 'Description for first task',
			status: 'pending',
			priority: 'high',
			dependencies: [],
			details: 'Implementation details for task 1',
			testStrategy: 'Unit tests for task 1',
			subtasks: []
		},
		{
			id: '2',
			title: 'Second Task',
			description: 'Description for second task',
			status: 'in-progress',
			priority: 'medium',
			dependencies: ['1'],
			details: 'Implementation details for task 2',
			testStrategy: 'Integration tests for task 2',
			subtasks: [
				{
					id: 1,
					parentId: '2',
					title: 'Subtask 1',
					description: 'First subtask description',
					status: 'done',
					priority: 'medium',
					dependencies: [],
					details: 'Subtask details',
					testStrategy: ''
				},
				{
					id: 2,
					parentId: '2',
					title: 'Subtask 2',
					description: 'Second subtask description',
					status: 'pending',
					priority: 'medium',
					dependencies: ['1'],
					details: '',
					testStrategy: ''
				}
			]
		},
		{
			id: '3',
			title: 'Third Task',
			description: 'Description for third task',
			status: 'done',
			priority: 'low',
			dependencies: ['1', '2'],
			details: '',
			testStrategy: '',
			subtasks: []
		}
	];
}

// Mock ConfigManager for testing
function createMockConfigManager(activeTag = 'master'): ConfigManager {
	return {
		getActiveTag: vi.fn().mockReturnValue(activeTag),
		getProjectRoot: vi.fn().mockReturnValue('/tmp/test-project')
	} as unknown as ConfigManager;
}

describe('TaskFileGeneratorService', () => {
	let tempDir: string;
	let service: TaskFileGeneratorService;
	let mockStorage: IStorage;
	let mockConfigManager: ConfigManager;

	beforeEach(() => {
		// Create a temporary directory for test outputs
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-test-'));
		mockStorage = createMockStorage(createSampleTasks());
		mockConfigManager = createMockConfigManager();
		service = new TaskFileGeneratorService(mockStorage, tempDir, mockConfigManager);
	});

	afterEach(() => {
		// Clean up temp directory
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true });
		}
	});

	describe('generateTaskFiles', () => {
		it('should generate task files for all tasks', async () => {
			const result = await service.generateTaskFiles();

			expect(result.success).toBe(true);
			expect(result.count).toBe(3);
			expect(result.directory).toContain('.taskmaster/tasks');

			// Verify files were created
			const outputDir = result.directory;
			expect(fs.existsSync(path.join(outputDir, 'task_001.md'))).toBe(true);
			expect(fs.existsSync(path.join(outputDir, 'task_002.md'))).toBe(true);
			expect(fs.existsSync(path.join(outputDir, 'task_003.md'))).toBe(true);
		});

		it('should generate task files with correct content', async () => {
			const result = await service.generateTaskFiles();
			const outputDir = result.directory;

			// Read and verify content of first task file
			const task1Content = fs.readFileSync(
				path.join(outputDir, 'task_001.md'),
				'utf-8'
			);

			expect(task1Content).toContain('# Task ID: 1');
			expect(task1Content).toContain('**Title:** First Task');
			expect(task1Content).toContain('**Status:** pending');
			expect(task1Content).toContain('**Priority:** high');
			expect(task1Content).toContain('**Description:** Description for first task');
			expect(task1Content).toContain('**Details:**');
			expect(task1Content).toContain('Implementation details for task 1');
			expect(task1Content).toContain('**Test Strategy:**');
			expect(task1Content).toContain('Unit tests for task 1');
		});

		it('should include subtasks in task files', async () => {
			const result = await service.generateTaskFiles();
			const outputDir = result.directory;

			// Read task 2 which has subtasks
			const task2Content = fs.readFileSync(
				path.join(outputDir, 'task_002.md'),
				'utf-8'
			);

			expect(task2Content).toContain('## Subtasks');
			expect(task2Content).toContain('### 2.1. Subtask 1');
			expect(task2Content).toContain('**Status:** done');
			expect(task2Content).toContain('### 2.2. Subtask 2');
			expect(task2Content).toContain('**Status:** pending');
			expect(task2Content).toContain('**Dependencies:** 2.1');
		});

		it('should format dependencies with status symbols', async () => {
			const result = await service.generateTaskFiles();
			const outputDir = result.directory;

			// Task 3 depends on task 1 (pending) and task 2 (in-progress)
			const task3Content = fs.readFileSync(
				path.join(outputDir, 'task_003.md'),
				'utf-8'
			);

			// Check that dependencies include status symbols
			expect(task3Content).toContain('**Dependencies:**');
			expect(task3Content).toMatch(/1.*,.*2/); // Both dependencies listed
		});

		it('should use tag-specific filenames for non-master tags', async () => {
			const result = await service.generateTaskFiles({ tag: 'feature-branch' });

			expect(result.success).toBe(true);

			const outputDir = result.directory;
			expect(
				fs.existsSync(path.join(outputDir, 'task_001_feature-branch.md'))
			).toBe(true);
			expect(
				fs.existsSync(path.join(outputDir, 'task_002_feature-branch.md'))
			).toBe(true);
			expect(
				fs.existsSync(path.join(outputDir, 'task_003_feature-branch.md'))
			).toBe(true);
		});

		it('should use custom output directory when provided', async () => {
			const customDir = path.join(tempDir, 'custom-output');

			const result = await service.generateTaskFiles({ outputDir: customDir });

			expect(result.success).toBe(true);
			expect(result.directory).toBe(customDir);
			expect(fs.existsSync(path.join(customDir, 'task_001.md'))).toBe(true);
		});

		it('should handle empty task list', async () => {
			const emptyStorage = createMockStorage([]);
			const emptyService = new TaskFileGeneratorService(emptyStorage, tempDir, mockConfigManager);

			const result = await emptyService.generateTaskFiles();

			expect(result.success).toBe(true);
			expect(result.count).toBe(0);
		});

		it('should clean up orphaned task files', async () => {
			// First generate files for 3 tasks
			await service.generateTaskFiles();

			// Now mock storage to return only 2 tasks (task 3 removed)
			const reducedTasks = createSampleTasks().slice(0, 2);
			const reducedStorage = createMockStorage(reducedTasks);
			const reducedService = new TaskFileGeneratorService(
				reducedStorage,
				tempDir,
				mockConfigManager
			);

			const result = await reducedService.generateTaskFiles();

			expect(result.success).toBe(true);
			expect(result.count).toBe(2);
			expect(result.orphanedFilesRemoved).toBe(1);

			// Verify task_003.md was removed
			const outputDir = result.directory;
			expect(fs.existsSync(path.join(outputDir, 'task_001.md'))).toBe(true);
			expect(fs.existsSync(path.join(outputDir, 'task_002.md'))).toBe(true);
			expect(fs.existsSync(path.join(outputDir, 'task_003.md'))).toBe(false);
		});

		it('should handle storage errors gracefully', async () => {
			const errorStorage = createMockStorage();
			(errorStorage.loadTasks as any).mockRejectedValue(
				new Error('Storage error')
			);
			const errorService = new TaskFileGeneratorService(errorStorage, tempDir, mockConfigManager);

			const result = await errorService.generateTaskFiles();

			expect(result.success).toBe(false);
			expect(result.error).toContain('Storage error');
		});

		it('should use active tag from config when tag is not provided', async () => {
			// Create service with non-master active tag
			const featureConfigManager = createMockConfigManager('feature-x');
			const featureService = new TaskFileGeneratorService(
				mockStorage,
				tempDir,
				featureConfigManager
			);

			const result = await featureService.generateTaskFiles();

			expect(result.success).toBe(true);

			// Verify files were created with the active tag suffix
			const outputDir = result.directory;
			expect(
				fs.existsSync(path.join(outputDir, 'task_001_feature-x.md'))
			).toBe(true);
			expect(
				fs.existsSync(path.join(outputDir, 'task_002_feature-x.md'))
			).toBe(true);
			expect(
				fs.existsSync(path.join(outputDir, 'task_003_feature-x.md'))
			).toBe(true);
		});

		it('should override active tag when tag is explicitly provided', async () => {
			// Create service with master active tag
			const masterConfigManager = createMockConfigManager('master');
			const masterService = new TaskFileGeneratorService(
				mockStorage,
				tempDir,
				masterConfigManager
			);

			// Explicitly provide a different tag
			const result = await masterService.generateTaskFiles({ tag: 'override-tag' });

			expect(result.success).toBe(true);

			// Verify files were created with the override tag, not active tag
			const outputDir = result.directory;
			expect(
				fs.existsSync(path.join(outputDir, 'task_001_override-tag.md'))
			).toBe(true);
			expect(
				fs.existsSync(path.join(outputDir, 'task_002_override-tag.md'))
			).toBe(true);
		});
	});
});
