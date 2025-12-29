import fs from 'fs';
import path from 'path';
import {
	copyTag,
	createTag,
	deleteTag,
	tags as listTags,
	renameTag
} from '../../../scripts/modules/task-manager/tag-management.js';

const TEMP_DIR = path.join(process.cwd(), '.tmp_tag_management_tests');
const TASKS_PATH = path.join(TEMP_DIR, 'tasks.json');

/**
 * Helper to write an initial tagged tasks.json structure
 */
function writeInitialFile() {
	const initialData = {
		master: {
			tasks: [{ id: 1, title: 'Initial Task', status: 'pending' }],
			metadata: {
				created: new Date().toISOString(),
				description: 'Master tag'
			}
		}
	};
	fs.mkdirSync(TEMP_DIR, { recursive: true });
	fs.writeFileSync(TASKS_PATH, JSON.stringify(initialData, null, 2));
}

describe('Tag Management – writeJSON context preservation', () => {
	beforeEach(() => {
		writeInitialFile();
	});

	afterEach(() => {
		fs.rmSync(TEMP_DIR, { recursive: true, force: true });
	});

	it('createTag should not corrupt other tags', async () => {
		await createTag(
			TASKS_PATH,
			'feature',
			{ copyFromCurrent: true },
			{ projectRoot: TEMP_DIR },
			'json'
		);

		const data = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
		expect(data.master).toBeDefined();
		expect(data.feature).toBeDefined();
	});

	it('renameTag should keep overall structure intact', async () => {
		await createTag(
			TASKS_PATH,
			'oldtag',
			{},
			{ projectRoot: TEMP_DIR },
			'json'
		);

		await renameTag(
			TASKS_PATH,
			'oldtag',
			'newtag',
			{},
			{ projectRoot: TEMP_DIR },
			'json'
		);

		const data = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
		expect(data.newtag).toBeDefined();
		expect(data.oldtag).toBeUndefined();
	});

	it('copyTag then deleteTag preserves other tags', async () => {
		await createTag(
			TASKS_PATH,
			'source',
			{},
			{ projectRoot: TEMP_DIR },
			'json'
		);

		await copyTag(
			TASKS_PATH,
			'source',
			'copy',
			{},
			{ projectRoot: TEMP_DIR },
			'json'
		);

		await deleteTag(
			TASKS_PATH,
			'copy',
			{ yes: true },
			{ projectRoot: TEMP_DIR },
			'json'
		);

		const tagsList = await listTags(
			TASKS_PATH,
			{},
			{ projectRoot: TEMP_DIR },
			'json'
		);

		const tagNames = tagsList.tags.map((t) => t.name);
		expect(tagNames).toContain('master');
		expect(tagNames).toContain('source');
		expect(tagNames).not.toContain('copy');
	});
});

describe('Tag Management – ready tasks count', () => {
	beforeEach(() => {
		fs.mkdirSync(TEMP_DIR, { recursive: true });
	});

	afterEach(() => {
		fs.rmSync(TEMP_DIR, { recursive: true, force: true });
	});

	it('should count tasks with no dependencies as ready', async () => {
		const data = {
			master: {
				tasks: [
					{ id: 1, title: 'Task 1', status: 'pending', dependencies: [] },
					{ id: 2, title: 'Task 2', status: 'pending', dependencies: [] },
					{ id: 3, title: 'Task 3', status: 'done', dependencies: [] }
				],
				metadata: { created: new Date().toISOString() }
			}
		};
		fs.writeFileSync(TASKS_PATH, JSON.stringify(data, null, 2));

		const result = await listTags(
			TASKS_PATH,
			{ showTaskCounts: true },
			{ projectRoot: TEMP_DIR },
			'json'
		);

		const masterTag = result.tags.find((t) => t.name === 'master');
		expect(masterTag.readyTasks).toBe(2); // 2 pending, 1 done (not ready)
	});

	it('should count tasks with satisfied dependencies as ready', async () => {
		const data = {
			master: {
				tasks: [
					{ id: 1, title: 'Task 1', status: 'done', dependencies: [] },
					{ id: 2, title: 'Task 2', status: 'pending', dependencies: [1] }, // deps satisfied
					{ id: 3, title: 'Task 3', status: 'pending', dependencies: [2] } // deps NOT satisfied
				],
				metadata: { created: new Date().toISOString() }
			}
		};
		fs.writeFileSync(TASKS_PATH, JSON.stringify(data, null, 2));

		const result = await listTags(
			TASKS_PATH,
			{ showTaskCounts: true },
			{ projectRoot: TEMP_DIR },
			'json'
		);

		const masterTag = result.tags.find((t) => t.name === 'master');
		expect(masterTag.readyTasks).toBe(1); // only task 2 is ready
	});

	it('should exclude deferred and blocked tasks from ready count', async () => {
		const data = {
			master: {
				tasks: [
					{ id: 1, title: 'Task 1', status: 'pending', dependencies: [] },
					{ id: 2, title: 'Task 2', status: 'deferred', dependencies: [] },
					{ id: 3, title: 'Task 3', status: 'blocked', dependencies: [] },
					{ id: 4, title: 'Task 4', status: 'in-progress', dependencies: [] },
					{ id: 5, title: 'Task 5', status: 'review', dependencies: [] }
				],
				metadata: { created: new Date().toISOString() }
			}
		};
		fs.writeFileSync(TASKS_PATH, JSON.stringify(data, null, 2));

		const result = await listTags(
			TASKS_PATH,
			{ showTaskCounts: true },
			{ projectRoot: TEMP_DIR },
			'json'
		);

		const masterTag = result.tags.find((t) => t.name === 'master');
		// Only pending, in-progress, review are actionable
		expect(masterTag.readyTasks).toBe(3); // tasks 1, 4, 5
	});
});

describe('Tag Management – --ready filter', () => {
	beforeEach(() => {
		fs.mkdirSync(TEMP_DIR, { recursive: true });
	});

	afterEach(() => {
		fs.rmSync(TEMP_DIR, { recursive: true, force: true });
	});

	it('should filter out tags with no ready tasks when --ready is set', async () => {
		const data = {
			'has-ready': {
				tasks: [
					{ id: 1, title: 'Task 1', status: 'pending', dependencies: [] }
				],
				metadata: { created: new Date().toISOString() }
			},
			'no-ready': {
				tasks: [
					{ id: 1, title: 'Task 1', status: 'done', dependencies: [] },
					{ id: 2, title: 'Task 2', status: 'deferred', dependencies: [] }
				],
				metadata: { created: new Date().toISOString() }
			},
			'all-blocked': {
				tasks: [
					{ id: 1, title: 'Task 1', status: 'blocked', dependencies: [] }
				],
				metadata: { created: new Date().toISOString() }
			}
		};
		fs.writeFileSync(TASKS_PATH, JSON.stringify(data, null, 2));

		const result = await listTags(
			TASKS_PATH,
			{ showTaskCounts: true, ready: true },
			{ projectRoot: TEMP_DIR },
			'json'
		);

		expect(result.tags.length).toBe(1);
		expect(result.tags[0].name).toBe('has-ready');
		expect(result.totalTags).toBe(1);
	});

	it('should include all tags when --ready is not set', async () => {
		const data = {
			'has-ready': {
				tasks: [
					{ id: 1, title: 'Task 1', status: 'pending', dependencies: [] }
				],
				metadata: { created: new Date().toISOString() }
			},
			'no-ready': {
				tasks: [{ id: 1, title: 'Task 1', status: 'done', dependencies: [] }],
				metadata: { created: new Date().toISOString() }
			}
		};
		fs.writeFileSync(TASKS_PATH, JSON.stringify(data, null, 2));

		const result = await listTags(
			TASKS_PATH,
			{ showTaskCounts: true, ready: false },
			{ projectRoot: TEMP_DIR },
			'json'
		);

		expect(result.tags.length).toBe(2);
		expect(result.totalTags).toBe(2);
	});

	it('should return empty list when no tags have ready tasks', async () => {
		const data = {
			'all-done': {
				tasks: [{ id: 1, title: 'Task 1', status: 'done', dependencies: [] }],
				metadata: { created: new Date().toISOString() }
			}
		};
		fs.writeFileSync(TASKS_PATH, JSON.stringify(data, null, 2));

		const result = await listTags(
			TASKS_PATH,
			{ showTaskCounts: true, ready: true },
			{ projectRoot: TEMP_DIR },
			'json'
		);

		expect(result.tags.length).toBe(0);
		expect(result.totalTags).toBe(0);
	});
});
