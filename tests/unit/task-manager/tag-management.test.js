import fs from 'fs';
import path from 'path';
import {
	createTag,
	deleteTag,
	renameTag,
	copyTag,
	tags as listTags
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
