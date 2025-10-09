import { jest } from '@jest/globals';

// --- Mocks ---
// Only mock the specific functions that move-task actually uses
jest.unstable_mockModule('../../../../../scripts/modules/utils.js', () => ({
	readJSON: jest.fn(),
	writeJSON: jest.fn(),
	log: jest.fn(),
	setTasksForTag: jest.fn(),
	traverseDependencies: jest.fn(() => [])
}));

jest.unstable_mockModule(
	'../../../../../scripts/modules/task-manager/generate-task-files.js',
	() => ({
		default: jest.fn().mockResolvedValue()
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/task-manager/is-task-dependent.js',
	() => ({
		default: jest.fn(() => false)
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/dependency-manager.js',
	() => ({
		findCrossTagDependencies: jest.fn(() => []),
		getDependentTaskIds: jest.fn(() => []),
		validateSubtaskMove: jest.fn()
	})
);

const { readJSON, writeJSON, log } = await import(
	'../../../../../scripts/modules/utils.js'
);
const generateTaskFiles = (
	await import(
		'../../../../../scripts/modules/task-manager/generate-task-files.js'
	)
).default;

const { default: moveTask } = await import(
	'../../../../../scripts/modules/task-manager/move-task.js'
);

const sampleTagged = () => ({
	master: {
		tasks: [
			{ id: 1, title: 'A' },
			{ id: 2, title: 'B', subtasks: [{ id: 1, title: 'B.1' }] }
		],
		metadata: {}
	},
	feature: {
		tasks: [{ id: 10, title: 'X' }],
		metadata: {}
	}
});

const clone = () => JSON.parse(JSON.stringify(sampleTagged()));

describe('moveTask (unit)', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		readJSON.mockImplementation((path, projectRoot, tag) => {
			const data = clone();
			return { ...data[tag], tag, _rawTaggedData: data };
		});
		writeJSON.mockResolvedValue();
		log.mockImplementation(() => {});
	});

	test('moves task to new ID in same tag', async () => {
		await moveTask('tasks.json', '1', '3', false, { tag: 'master' });
		expect(writeJSON).toHaveBeenCalled();
		const written = writeJSON.mock.calls[0][1];
		const ids = written.master.tasks.map((t) => t.id);
		expect(ids).toEqual(expect.arrayContaining([2, 3]));
		expect(ids).not.toContain(1);
	});

	test('throws when counts of source and dest mismatch', async () => {
		await expect(
			moveTask('tasks.json', '1,2', '3', {}, { tag: 'master' })
		).rejects.toThrow(/Number of source IDs/);
	});

	test('error when tag invalid', async () => {
		await expect(
			moveTask('tasks.json', '1', '2', false, { tag: 'ghost' })
		).rejects.toThrow(/tag "ghost" not found/);
	});
});
