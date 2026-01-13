/**
 * Tests for file locking and atomic write functionality
 * Verifies that concurrent access to tasks.json is properly serialized
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

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

		it('should create file if createIfMissing is true', () => {
			const newFilePath = path.join(tempDir, 'new-file.json');

			utils.withFileLockSync(
				newFilePath,
				() => {
					// Lock acquired on new file
				},
				{ createIfMissing: true }
			);

			expect(fs.existsSync(newFilePath)).toBe(true);
		});

		it('should not create file if createIfMissing is false (default)', () => {
			const newFilePath = path.join(tempDir, 'should-not-exist.json');

			utils.withFileLockSync(newFilePath, () => {
				// Lock acquired, but file should not be created
			});

			expect(fs.existsSync(newFilePath)).toBe(false);
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

	describe('withFileLock (async)', () => {
		it('should execute async callback while holding lock', async () => {
			const result = await utils.withFileLock(testFilePath, async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				return 'async callback executed';
			});

			expect(result).toBe('async callback executed');
		});

		it('should release lock after async callback completes', async () => {
			await utils.withFileLock(testFilePath, async () => {
				// First lock
			});

			// Should be able to acquire lock again
			const result = await utils.withFileLock(testFilePath, async () => {
				return 'second lock acquired';
			});

			expect(result).toBe('second lock acquired');
		});

		it('should release lock even if async callback rejects', async () => {
			await expect(
				utils.withFileLock(testFilePath, async () => {
					throw new Error('Async error');
				})
			).rejects.toThrow('Async error');

			// Should still be able to acquire lock
			const result = await utils.withFileLock(
				testFilePath,
				async () => 'recovered'
			);
			expect(result).toBe('recovered');
		});

		it('should create file if createIfMissing is true', async () => {
			const newFilePath = path.join(tempDir, 'new-async-file.json');

			await utils.withFileLock(
				newFilePath,
				async () => {
					// Lock acquired on new file
				},
				{ createIfMissing: true }
			);

			expect(fs.existsSync(newFilePath)).toBe(true);
		});

		it('should not create file if createIfMissing is false (default)', async () => {
			const newFilePath = path.join(tempDir, 'should-not-exist-async.json');

			await utils.withFileLock(newFilePath, async () => {
				// Lock acquired, but file should not be created
			});

			expect(fs.existsSync(newFilePath)).toBe(false);
		});

		it('should clean up lock file after completion', async () => {
			await utils.withFileLock(testFilePath, async () => {
				// Do something
			});

			// Lock file should be cleaned up
			expect(fs.existsSync(`${testFilePath}.lock`)).toBe(false);
		});

		it('should clean up lock file even on error', async () => {
			try {
				await utils.withFileLock(testFilePath, async () => {
					throw new Error('Test error');
				});
			} catch {
				// Expected
			}

			// Lock file should be cleaned up
			expect(fs.existsSync(`${testFilePath}.lock`)).toBe(false);
		});

		it('should serialize truly concurrent writes', async () => {
			const numConcurrentWrites = 5;
			const writes = [];

			for (let i = 0; i < numConcurrentWrites; i++) {
				writes.push(
					utils.withFileLock(testFilePath, async () => {
						const data = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
						data.master.tasks.push({
							id: String(data.master.tasks.length + 1)
						});
						fs.writeFileSync(testFilePath, JSON.stringify(data, null, 2));
					})
				);
			}

			await Promise.all(writes);

			const finalData = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
			expect(finalData.master.tasks).toHaveLength(numConcurrentWrites);
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

	describe('True concurrent process writes', () => {
		it('should handle multiple processes writing simultaneously without data loss', async () => {
			const { spawn } = await import('child_process');

			const numProcesses = 5;
			const tasksPerProcess = 3;

			// Create a worker script with inline locking implementation
			// This mirrors the withFileLockSync implementation but without external dependencies
			const workerScript = `
				import fs from 'fs';

				const filepath = process.argv[2];
				const processId = process.argv[3];
				const numTasks = parseInt(process.argv[4], 10);

				const LOCK_CONFIG = {
					maxRetries: 10,
					retryDelay: 50,
					staleLockAge: 10000
				};

				function sleepSync(ms) {
					const end = Date.now() + ms;
					while (Date.now() < end) {
						// Busy wait
					}
				}

				function withFileLockSync(filepath, callback) {
					const lockPath = filepath + '.lock';
					const { maxRetries, retryDelay, staleLockAge } = LOCK_CONFIG;

					let acquired = false;
					for (let attempt = 0; attempt < maxRetries; attempt++) {
						try {
							const lockContent = JSON.stringify({
								pid: process.pid,
								timestamp: Date.now()
							});
							fs.writeFileSync(lockPath, lockContent, { flag: 'wx' });
							acquired = true;
							break;
						} catch (err) {
							if (err.code === 'EEXIST') {
								try {
									const lockStat = fs.statSync(lockPath);
									const age = Date.now() - lockStat.mtimeMs;
									if (age > staleLockAge) {
										const stalePath = lockPath + '.stale.' + process.pid + '.' + Date.now();
										try {
											fs.renameSync(lockPath, stalePath);
											try { fs.unlinkSync(stalePath); } catch {}
											continue;
										} catch {}
									}
								} catch (statErr) {
									if (statErr.code === 'ENOENT') continue;
									throw statErr;
								}
								if (attempt < maxRetries - 1) {
									const waitMs = retryDelay * Math.pow(2, attempt);
									sleepSync(waitMs);
								}
							} else {
								throw err;
							}
						}
					}

					if (!acquired) {
						throw new Error('Failed to acquire lock on ' + filepath + ' after ' + maxRetries + ' attempts');
					}

					try {
						return callback();
					} finally {
						try {
							fs.unlinkSync(lockPath);
						} catch {}
					}
				}

				async function main() {
					for (let i = 0; i < numTasks; i++) {
						withFileLockSync(filepath, () => {
							let currentData;
							try {
								currentData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
							} catch {
								currentData = { master: { tasks: [], metadata: {} } };
							}

							currentData.master.tasks.push({
								id: 'P' + processId + '-' + (i + 1),
								title: 'Task from process ' + processId + ' #' + (i + 1),
								status: 'pending'
							});

							fs.writeFileSync(filepath, JSON.stringify(currentData, null, 2), 'utf8');
						});

						// Small delay to increase chance of interleaving
						await new Promise(r => setTimeout(r, 10));
					}
				}

				main().catch(err => {
					console.error(err);
					process.exit(1);
				});
			`;

			// Write worker script to temp file
			const workerPath = path.join(tempDir, 'worker.mjs');
			fs.writeFileSync(workerPath, workerScript);

			// Spawn multiple processes that write concurrently
			const processes = [];
			for (let i = 0; i < numProcesses; i++) {
				const proc = spawn(
					'node',
					[workerPath, testFilePath, String(i), String(tasksPerProcess)],
					{
						stdio: ['ignore', 'pipe', 'pipe']
					}
				);
				processes.push(
					new Promise((resolve, reject) => {
						let stderr = '';
						proc.stderr.on('data', (data) => {
							stderr += data.toString();
						});
						proc.on('close', (code) => {
							if (code === 0) {
								resolve();
							} else {
								reject(
									new Error(`Process ${i} exited with code ${code}: ${stderr}`)
								);
							}
						});
						proc.on('error', reject);
					})
				);
			}

			// Wait for all processes to complete
			await Promise.all(processes);

			// Verify all tasks were written
			const finalData = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
			const expectedTasks = numProcesses * tasksPerProcess;

			expect(finalData.master.tasks.length).toBe(expectedTasks);

			// Verify we have tasks from all processes
			for (let i = 0; i < numProcesses; i++) {
				const tasksFromProcess = finalData.master.tasks.filter((t) =>
					t.id.startsWith(`P${i}-`)
				);
				expect(tasksFromProcess.length).toBe(tasksPerProcess);
			}
		}, 30000); // 30 second timeout for concurrent test
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
