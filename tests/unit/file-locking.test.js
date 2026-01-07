/**
 * Tests for file locking and atomic write functionality
 * Verifies that concurrent access to tasks.json is properly serialized
 */

import {
	jest,
	describe,
	it,
	expect,
	beforeEach,
	afterEach
} from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the utils module
const utilsPath = path.join(__dirname, '../../scripts/modules/utils.js');

describe('File Locking and Atomic Writes', () => {
	let tempDir;
	let testFilePath;
	let utils;

	beforeEach(async () => {
		// Create a temp directory for each test
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskmaster-test-'));
		testFilePath = path.join(tempDir, 'tasks.json');

		// Initialize with empty tasks structure
		fs.writeFileSync(
			testFilePath,
			JSON.stringify(
				{
					master: {
						tasks: [],
						metadata: { created: new Date().toISOString() }
					}
				},
				null,
				2
			)
		);

		// Import utils fresh for each test
		utils = await import(utilsPath + `?cachebust=${Date.now()}`);
	});

	afterEach(() => {
		// Clean up temp directory and any lock files
		if (tempDir && fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	describe('withFileLockSync', () => {
		it('should execute callback while holding lock', () => {
			const result = utils.withFileLockSync(testFilePath, () => {
				return 'callback executed';
			});

			expect(result).toBe('callback executed');
		});

		it('should release lock after callback completes', () => {
			utils.withFileLockSync(testFilePath, () => {
				// First lock
			});

			// Should be able to acquire lock again
			const result = utils.withFileLockSync(testFilePath, () => {
				return 'second lock acquired';
			});

			expect(result).toBe('second lock acquired');
		});

		it('should release lock even if callback throws', () => {
			expect(() => {
				utils.withFileLockSync(testFilePath, () => {
					throw new Error('Test error');
				});
			}).toThrow('Test error');

			// Should still be able to acquire lock
			const result = utils.withFileLockSync(testFilePath, () => 'recovered');
			expect(result).toBe('recovered');
		});

		it('should create file if it does not exist', () => {
			const newFilePath = path.join(tempDir, 'new-file.json');

			utils.withFileLockSync(newFilePath, () => {
				// Lock acquired on new file
			});

			expect(fs.existsSync(newFilePath)).toBe(true);
		});

		it('should clean up lock file after completion', () => {
			utils.withFileLockSync(testFilePath, () => {
				// Do something
			});

			// Lock file should be cleaned up
			expect(fs.existsSync(`${testFilePath}.lock`)).toBe(false);
		});

		it('should clean up lock file even on error', () => {
			try {
				utils.withFileLockSync(testFilePath, () => {
					throw new Error('Test error');
				});
			} catch {
				// Expected
			}

			// Lock file should be cleaned up
			expect(fs.existsSync(`${testFilePath}.lock`)).toBe(false);
		});
	});

	describe('writeJSON atomic writes', () => {
		it('should not leave temp files on success', () => {
			// Create a tagged structure that writeJSON expects
			const taggedData = {
				master: {
					tasks: [{ id: '1', title: 'Test task', status: 'pending' }],
					metadata: { created: new Date().toISOString() }
				}
			};

			utils.writeJSON(testFilePath, taggedData, null, null);

			const files = fs.readdirSync(tempDir);
			const tempFiles = files.filter((f) => f.includes('.tmp'));
			expect(tempFiles).toHaveLength(0);
		});

		it('should preserve data from other tags when writing to one tag', () => {
			// Set up initial data with multiple tags
			const initialData = {
				master: {
					tasks: [{ id: '1', title: 'Master task', status: 'pending' }],
					metadata: { created: new Date().toISOString() }
				},
				feature: {
					tasks: [{ id: '1', title: 'Feature task', status: 'pending' }],
					metadata: { created: new Date().toISOString() }
				}
			};
			fs.writeFileSync(testFilePath, JSON.stringify(initialData, null, 2));

			// Write directly with tagged structure (simulating what commands do internally)
			const updatedData = {
				...initialData,
				master: {
					...initialData.master,
					tasks: [
						{ id: '1', title: 'Updated master task', status: 'pending' },
						{ id: '2', title: 'New task', status: 'pending' }
					]
				}
			};

			utils.writeJSON(testFilePath, updatedData, null, null);

			const written = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));

			// Master should be updated
			expect(written.master.tasks).toHaveLength(2);
			expect(written.master.tasks[0].title).toBe('Updated master task');

			// Feature should be preserved
			expect(written.feature.tasks).toHaveLength(1);
			expect(written.feature.tasks[0].title).toBe('Feature task');
		});

		it('should not leave lock files on success', () => {
			const taggedData = {
				master: {
					tasks: [{ id: '1', title: 'Test task', status: 'pending' }],
					metadata: {}
				}
			};

			utils.writeJSON(testFilePath, taggedData, null, null);

			expect(fs.existsSync(`${testFilePath}.lock`)).toBe(false);
		});
	});

	describe('Concurrent write simulation', () => {
		it('should handle rapid sequential writes without data loss', () => {
			// Perform many rapid writes
			const numWrites = 10;

			for (let i = 0; i < numWrites; i++) {
				// Read current data
				let currentData;
				try {
					currentData = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
				} catch {
					currentData = { master: { tasks: [], metadata: {} } };
				}

				// Add a new task
				currentData.master.tasks.push({
					id: String(i + 1),
					title: `Task ${i + 1}`,
					status: 'pending'
				});

				// Write with locking
				utils.writeJSON(testFilePath, currentData, null, null);
			}

			const finalData = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
			expect(finalData.master.tasks).toHaveLength(numWrites);
		});
	});
});

describe('readJSON', () => {
	let tempDir;
	let testFilePath;
	let utils;

	beforeEach(async () => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskmaster-test-'));
		testFilePath = path.join(tempDir, 'tasks.json');

		// Create .taskmaster directory for state.json
		fs.mkdirSync(path.join(tempDir, '.taskmaster'), { recursive: true });
		fs.writeFileSync(
			path.join(tempDir, '.taskmaster', 'state.json'),
			JSON.stringify({
				currentTag: 'master'
			})
		);

		utils = await import(utilsPath + `?cachebust=${Date.now()}`);
	});

	afterEach(() => {
		if (tempDir && fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it('should read tagged task data correctly', () => {
		const data = {
			master: {
				tasks: [{ id: '1', title: 'Test', status: 'pending' }],
				metadata: { created: new Date().toISOString() }
			}
		};
		fs.writeFileSync(testFilePath, JSON.stringify(data, null, 2));

		const result = utils.readJSON(testFilePath, tempDir, 'master');

		expect(result.tasks).toHaveLength(1);
		expect(result.tasks[0].title).toBe('Test');
	});

	it('should return null for non-existent file', () => {
		const result = utils.readJSON(path.join(tempDir, 'nonexistent.json'));
		expect(result).toBeNull();
	});
});

describe('Lock file stale detection', () => {
	let tempDir;
	let testFilePath;
	let utils;

	beforeEach(async () => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskmaster-test-'));
		testFilePath = path.join(tempDir, 'tasks.json');
		fs.writeFileSync(testFilePath, '{}');
		utils = await import(utilsPath + `?cachebust=${Date.now()}`);
	});

	afterEach(() => {
		if (tempDir && fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it('should remove stale lock files', () => {
		const lockPath = `${testFilePath}.lock`;

		// Create a lock file with old timestamp
		fs.writeFileSync(
			lockPath,
			JSON.stringify({
				pid: 99999, // Non-existent PID
				timestamp: Date.now() - 20000 // 20 seconds ago
			})
		);

		// Touch the file to make it old
		const pastTime = new Date(Date.now() - 20000);
		fs.utimesSync(lockPath, pastTime, pastTime);

		// Should be able to acquire lock despite existing lock file
		const result = utils.withFileLockSync(testFilePath, () => 'acquired');
		expect(result).toBe('acquired');
	});
});
