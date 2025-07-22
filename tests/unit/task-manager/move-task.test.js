import fs from 'fs';
import path from 'path';
import moveTask from '../../../scripts/modules/task-manager/move-task.js';

const TMP = path.join(process.cwd(), '.tmp_move_task');
const TASKS = path.join(TMP, 'tasks.json');

function seed(initialTasks) {
	fs.rmSync(TMP, { recursive: true, force: true });
	fs.mkdirSync(path.join(TMP, '.taskmaster'), { recursive: true });
	fs.writeFileSync(
		TASKS,
		JSON.stringify(
			{
				master: {
					tasks: initialTasks,
					metadata: { created: new Date().toISOString() }
				}
			},
			null,
			2
		)
	);
}

describe('moveTask basic scenarios', () => {
	afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

	it('moves a task to a new ID within same tag', async () => {
		seed([
			{ id: 1, title: 'A' },
			{ id: 2, title: 'B' }
		]);

		await moveTask(TASKS, '1', '3', false, { projectRoot: TMP, tag: 'master' });

		const data = JSON.parse(fs.readFileSync(TASKS, 'utf8'));
		const ids = data.master.tasks.map((t) => t.id);
		expect(ids).toEqual(expect.arrayContaining([2, 3]));
		expect(ids).not.toContain(1);
	});

	it('refuses to move across tags', async () => {
		// build dual-tag structure
		seed([{ id: 1, title: 'task' }]);
		const raw = JSON.parse(fs.readFileSync(TASKS, 'utf8'));
		raw.other = { tasks: [], metadata: { created: new Date().toISOString() } };
		fs.writeFileSync(TASKS, JSON.stringify(raw, null, 2));

		await expect(
			moveTask(TASKS, '1', '2', false, { projectRoot: TMP, tag: 'other' })
		).rejects.toThrow(/Source task/);
	});
});
