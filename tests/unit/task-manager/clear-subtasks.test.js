import fs from 'fs';
import path from 'path';
import clearSubtasks from '../../../scripts/modules/task-manager/clear-subtasks.js';

const TMP = path.join(process.cwd(), '.tmp_clear_subtasks');
const TASKS = path.join(TMP, 'tasks.json');

function seed() {
	fs.rmSync(TMP, { recursive: true, force: true });
	fs.mkdirSync(path.join(TMP, '.taskmaster'), { recursive: true });
	fs.writeFileSync(
		TASKS,
		JSON.stringify(
			{
				master: {
					tasks: [
						{
							id: 1,
							title: 'Parent',
							subtasks: [
								{ id: 1, title: 'Sub1' },
								{ id: 2, title: 'Sub2' }
							]
						},
						{ id: 2, title: 'Solo' }
					],
					metadata: { created: new Date().toISOString() }
				}
			},
			null,
			2
		)
	);
}

describe('clearSubtasks', () => {
	beforeEach(seed);
	afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

	it('clears subtasks for given task id', () => {
		clearSubtasks(TASKS, '1', { projectRoot: TMP, tag: 'master' });
		const data = JSON.parse(fs.readFileSync(TASKS, 'utf8'));
		const parent = data.master.tasks.find((t) => t.id === 1);
		expect(parent.subtasks.length).toBe(0);
	});

	it('does nothing when task has no subtasks', () => {
		clearSubtasks(TASKS, '2', { projectRoot: TMP, tag: 'master' });
		const data = JSON.parse(fs.readFileSync(TASKS, 'utf8'));
		const solo = data.master.tasks.find((t) => t.id === 2);
		expect(solo.subtasks).toBeUndefined();
	});
});
