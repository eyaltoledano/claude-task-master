/**
 * @fileoverview Integration tests for inter-tag dependency storage and validation
 *
 * Tests the full TagService → FileStorage → filesystem flow for:
 * - Adding/removing tag dependencies
 * - Circular dependency detection
 * - Self-dependency rejection
 * - Persistence and round-trip through JSON
 * - getTagsWithStats includes dependsOn
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileStorage } from '../../../src/modules/storage/adapters/file-storage/file-storage.js';
import { TagService } from '../../../src/modules/tasks/services/tag.service.js';
import type { Task } from '../../../src/common/types/index.js';

function createTask(id: string, overrides: Partial<Task> = {}): Task {
	return {
		id,
		title: `Task ${id}`,
		description: `Description for task ${id}`,
		status: 'pending',
		priority: 'medium',
		dependencies: [],
		details: '',
		testStrategy: '',
		subtasks: [],
		...overrides
	};
}

/**
 * Seeds a legacy-format tasks.json with multiple tags so we can test
 * inter-tag dependency operations.
 */
function seedTagsFile(tempDir: string, tagNames: string[]): void {
	const filePath = path.join(tempDir, '.taskmaster', 'tasks', 'tasks.json');

	const data: Record<string, any> = {};
	for (const tag of tagNames) {
		data[tag] = {
			tasks: [createTask('1')],
			metadata: {
				created: new Date().toISOString(),
				description: `Tag ${tag}`
			}
		};
	}

	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

describe('Tag Dependencies - Integration Tests', () => {
	let tempDir: string;
	let storage: FileStorage;
	let tagService: TagService;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskmaster-tagdep-'));
		const taskmasterDir = path.join(tempDir, '.taskmaster', 'tasks');
		fs.mkdirSync(taskmasterDir, { recursive: true });
		storage = new FileStorage(tempDir);
		tagService = new TagService(storage);
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	describe('addTagDependency', () => {
		it('should add a dependency between two tags', async () => {
			seedTagsFile(tempDir, ['core-setup', 'feature-auth']);

			await tagService.addTagDependency('feature-auth', 'core-setup');

			const deps = await tagService.getTagDependencies('feature-auth');
			expect(deps).toEqual(['core-setup']);
		});

		it('should allow multiple dependencies on a single tag', async () => {
			seedTagsFile(tempDir, ['base', 'infra', 'app']);

			await tagService.addTagDependency('app', 'base');
			await tagService.addTagDependency('app', 'infra');

			const deps = await tagService.getTagDependencies('app');
			expect(deps).toEqual(['base', 'infra']);
		});

		it('should be idempotent — adding same dependency twice is a no-op', async () => {
			seedTagsFile(tempDir, ['a', 'b']);

			await tagService.addTagDependency('a', 'b');
			await tagService.addTagDependency('a', 'b');

			const deps = await tagService.getTagDependencies('a');
			expect(deps).toEqual(['b']);
		});

		it('should reject self-dependency', async () => {
			seedTagsFile(tempDir, ['a']);

			await expect(
				tagService.addTagDependency('a', 'a')
			).rejects.toThrow(/cannot depend on itself/);
		});

		it('should reject when source tag does not exist', async () => {
			seedTagsFile(tempDir, ['b']);

			await expect(
				tagService.addTagDependency('nonexistent', 'b')
			).rejects.toThrow(/does not exist/);
		});

		it('should reject when target tag does not exist', async () => {
			seedTagsFile(tempDir, ['a']);

			await expect(
				tagService.addTagDependency('a', 'nonexistent')
			).rejects.toThrow(/does not exist/);
		});
	});

	describe('removeTagDependency', () => {
		it('should remove an existing dependency', async () => {
			seedTagsFile(tempDir, ['a', 'b']);

			await tagService.addTagDependency('a', 'b');
			expect(await tagService.getTagDependencies('a')).toEqual(['b']);

			await tagService.removeTagDependency('a', 'b');
			expect(await tagService.getTagDependencies('a')).toEqual([]);
		});

		it('should be idempotent — removing nonexistent dependency is a no-op', async () => {
			seedTagsFile(tempDir, ['a', 'b']);

			// No dependency exists, should not throw
			await tagService.removeTagDependency('a', 'b');

			expect(await tagService.getTagDependencies('a')).toEqual([]);
		});

		it('should only remove the specified dependency', async () => {
			seedTagsFile(tempDir, ['a', 'b', 'c']);

			await tagService.addTagDependency('a', 'b');
			await tagService.addTagDependency('a', 'c');

			await tagService.removeTagDependency('a', 'b');

			expect(await tagService.getTagDependencies('a')).toEqual(['c']);
		});

		it('should reject when tag does not exist', async () => {
			seedTagsFile(tempDir, ['b']);

			await expect(
				tagService.removeTagDependency('nonexistent', 'b')
			).rejects.toThrow(/does not exist/);
		});
	});

	describe('circular dependency detection', () => {
		it('should reject direct circular dependency (A→B, B→A)', async () => {
			seedTagsFile(tempDir, ['a', 'b']);

			await tagService.addTagDependency('a', 'b');

			await expect(
				tagService.addTagDependency('b', 'a')
			).rejects.toThrow(/circular dependency/);
		});

		it('should reject transitive circular dependency (A→B→C→A)', async () => {
			seedTagsFile(tempDir, ['a', 'b', 'c']);

			await tagService.addTagDependency('a', 'b');
			await tagService.addTagDependency('b', 'c');

			await expect(
				tagService.addTagDependency('c', 'a')
			).rejects.toThrow(/circular dependency/);
		});

		it('should allow diamond dependencies (no cycle)', async () => {
			// A → B, A → C, B → D, C → D — valid DAG
			seedTagsFile(tempDir, ['a', 'b', 'c', 'd']);

			await tagService.addTagDependency('a', 'b');
			await tagService.addTagDependency('a', 'c');
			await tagService.addTagDependency('b', 'd');
			await tagService.addTagDependency('c', 'd');

			// All should succeed — no cycle
			expect(await tagService.getTagDependencies('a')).toEqual(['b', 'c']);
			expect(await tagService.getTagDependencies('b')).toEqual(['d']);
			expect(await tagService.getTagDependencies('c')).toEqual(['d']);
			expect(await tagService.getTagDependencies('d')).toEqual([]);
		});

		it('should still allow adding deps after a circular is rejected', async () => {
			seedTagsFile(tempDir, ['a', 'b', 'c', 'd']);

			await tagService.addTagDependency('a', 'b');
			await tagService.addTagDependency('b', 'c');

			// This should fail (would create C→A→B→C cycle)
			await expect(
				tagService.addTagDependency('c', 'a')
			).rejects.toThrow(/circular dependency/);

			// But adding a non-circular dep should still work
			// d has no deps, so c→d is safe
			await tagService.addTagDependency('c', 'd');
			expect(await tagService.getTagDependencies('c')).toEqual(['d']);
		});
	});

	describe('persistence', () => {
		it('should persist dependencies across storage instances', async () => {
			seedTagsFile(tempDir, ['a', 'b']);

			await tagService.addTagDependency('a', 'b');

			// Create a fresh storage + service instance against the same directory
			const storage2 = new FileStorage(tempDir);
			const tagService2 = new TagService(storage2);

			const deps = await tagService2.getTagDependencies('a');
			expect(deps).toEqual(['b']);
		});

		it('should write dependsOn into the JSON file correctly', async () => {
			seedTagsFile(tempDir, ['a', 'b']);

			await tagService.addTagDependency('a', 'b');

			const filePath = path.join(
				tempDir,
				'.taskmaster',
				'tasks',
				'tasks.json'
			);
			const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

			expect(raw.a.metadata.dependsOn).toEqual(['b']);
			expect(raw.b.metadata.dependsOn).toBeUndefined();
		});
	});

	describe('getTagDependencies', () => {
		it('should return empty array for tag with no dependencies', async () => {
			seedTagsFile(tempDir, ['a']);

			const deps = await tagService.getTagDependencies('a');
			expect(deps).toEqual([]);
		});

		it('should return empty array when metadata has no dependsOn field', async () => {
			// Default seeded tags have no dependsOn
			seedTagsFile(tempDir, ['a']);

			const deps = await storage.getTagDependencies('a');
			expect(deps).toEqual([]);
		});
	});

	describe('getTagsWithStats includes dependsOn', () => {
		it('should include dependsOn in tag stats', async () => {
			seedTagsFile(tempDir, ['a', 'b', 'c']);

			await tagService.addTagDependency('a', 'b');
			await tagService.addTagDependency('a', 'c');

			const result = await storage.getTagsWithStats();

			const tagA = result.tags.find((t) => t.name === 'a');
			const tagB = result.tags.find((t) => t.name === 'b');

			expect(tagA?.dependsOn).toEqual(['b', 'c']);
			expect(tagB?.dependsOn).toBeUndefined();
		});
	});
});
