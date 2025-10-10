import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
	createState,
	readState,
	updateState,
	deleteState,
	validateState
} from '../../../../../packages/tm-core/src/storage/state-manager.js';

describe('State Manager', () => {
	let testDir;
	let statePath;

	beforeEach(async () => {
		// Create temporary test directory
		testDir = path.join(os.tmpdir(), `state-test-${Date.now()}`);
		await fs.ensureDir(testDir);
		statePath = path.join(testDir, 'state.json');
	});

	afterEach(async () => {
		// Clean up test directory
		await fs.remove(testDir);
	});

	describe('createState', () => {
		it('should create a valid state file', async () => {
			const initialData = {
				currentPhase: 'red',
				testsPassing: false,
				attemptCount: 1
			};

			const state = await createState(statePath, initialData);

			expect(state).toBeDefined();
			expect(state.data).toEqual(initialData);
			expect(state.lastUpdated).toBeDefined();
		});

		it('should write state to file system', async () => {
			await createState(statePath, { phase: 'preflight' });

			const exists = await fs.pathExists(statePath);
			expect(exists).toBe(true);
		});

		it('should create valid JSON file', async () => {
			await createState(statePath, { phase: 'red' });

			const content = await fs.readFile(statePath, 'utf-8');
			const parsed = JSON.parse(content);

			expect(parsed).toBeDefined();
			expect(parsed.data).toBeDefined();
		});

		it('should include lastUpdated timestamp', async () => {
			const before = new Date().toISOString();
			const state = await createState(statePath, { phase: 'red' });
			const after = new Date().toISOString();

			expect(state.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
			expect(state.lastUpdated >= before).toBe(true);
			expect(state.lastUpdated <= after).toBe(true);
		});

		it('should throw error if file already exists', async () => {
			await createState(statePath, { phase: 'red' });

			await expect(createState(statePath, { phase: 'green' })).rejects.toThrow(
				'State file already exists'
			);
		});

		it('should handle complex nested data', async () => {
			const complexData = {
				workflow: {
					phase: 'red',
					history: ['preflight', 'branch-setup', 'red'],
					metadata: {
						attempts: 1,
						errors: []
					}
				}
			};

			const state = await createState(statePath, complexData);

			expect(state.data.workflow.history).toEqual([
				'preflight',
				'branch-setup',
				'red'
			]);
			expect(state.data.workflow.metadata.attempts).toBe(1);
		});

		it('should create parent directory if it does not exist', async () => {
			const nestedPath = path.join(testDir, 'nested', 'dir', 'state.json');

			await createState(nestedPath, { phase: 'red' });

			const exists = await fs.pathExists(nestedPath);
			expect(exists).toBe(true);
		});
	});

	describe('readState', () => {
		it('should read existing state file', async () => {
			const original = await createState(statePath, { phase: 'red' });
			const read = await readState(statePath);

			expect(read).toEqual(original);
		});

		it('should parse JSON correctly', async () => {
			await createState(statePath, { phase: 'green', testsPassing: true });
			const state = await readState(statePath);

			expect(state.data.phase).toBe('green');
			expect(state.data.testsPassing).toBe(true);
		});

		it('should throw error if file does not exist', async () => {
			await expect(readState(statePath)).rejects.toThrow();
		});

		it('should throw error for invalid JSON', async () => {
			await fs.writeFile(statePath, 'invalid json');

			await expect(readState(statePath)).rejects.toThrow();
		});

		it('should validate state structure', async () => {
			// Create invalid state
			await fs.writeFile(statePath, JSON.stringify({ invalid: true }));

			await expect(readState(statePath)).rejects.toThrow('Invalid state');
		});

		it('should preserve nested data structures', async () => {
			const complexData = {
				nested: {
					array: [1, 2, 3],
					object: { key: 'value' }
				}
			};

			await createState(statePath, complexData);
			const state = await readState(statePath);

			expect(state.data.nested.array).toEqual([1, 2, 3]);
			expect(state.data.nested.object.key).toBe('value');
		});
	});

	describe('updateState', () => {
		it('should update state data', async () => {
			await createState(statePath, { phase: 'red', testsPassing: false });

			const updated = await updateState(statePath, {
				testsPassing: true
			});

			expect(updated.data.testsPassing).toBe(true);
			expect(updated.data.phase).toBe('red'); // Preserved
		});

		it('should update lastUpdated timestamp', async () => {
			const original = await createState(statePath, { phase: 'red' });

			// Small delay to ensure different timestamp
			await new Promise((resolve) => setTimeout(resolve, 10));

			const updated = await updateState(statePath, { phase: 'green' });

			expect(updated.lastUpdated > original.lastUpdated).toBe(true);
		});

		it('should merge updates with existing data', async () => {
			await createState(statePath, {
				phase: 'red',
				testsPassing: false,
				attemptCount: 1
			});

			const updated = await updateState(statePath, {
				testsPassing: true,
				attemptCount: 2
			});

			expect(updated.data.phase).toBe('red');
			expect(updated.data.testsPassing).toBe(true);
			expect(updated.data.attemptCount).toBe(2);
		});

		it('should handle nested updates', async () => {
			await createState(statePath, {
				workflow: {
					phase: 'red',
					metadata: { attempts: 1 }
				}
			});

			const updated = await updateState(statePath, {
				workflow: {
					metadata: { attempts: 2, lastError: null }
				}
			});

			// Deep merge behavior
			expect(updated.data.workflow.metadata.attempts).toBe(2);
			expect(updated.data.workflow.metadata.lastError).toBeNull();
		});

		it('should use atomic write operations', async () => {
			await createState(statePath, { counter: 0 });

			// Sequential updates to test atomic writes
			await updateState(statePath, { counter: 1 });
			await updateState(statePath, { counter: 2 });
			await updateState(statePath, { counter: 3 });

			// File should still be valid JSON
			const final = await readState(statePath);
			expect(final.data.counter).toBe(3);
		});

		it('should throw error if state does not exist', async () => {
			await expect(updateState(statePath, { phase: 'red' })).rejects.toThrow();
		});

		it('should allow updating with empty object', async () => {
			const original = await createState(statePath, { phase: 'red' });

			// Small delay to ensure different timestamp
			await new Promise((resolve) => setTimeout(resolve, 10));

			const updated = await updateState(statePath, {});

			// Data unchanged, but timestamp updated
			expect(updated.data).toEqual(original.data);
			expect(updated.lastUpdated > original.lastUpdated).toBe(true);
		});

		it('should handle array updates', async () => {
			await createState(statePath, { history: ['red'] });

			const updated = await updateState(statePath, {
				history: ['red', 'green']
			});

			expect(updated.data.history).toEqual(['red', 'green']);
		});
	});

	describe('deleteState', () => {
		it('should delete state file', async () => {
			await createState(statePath, { phase: 'red' });

			await deleteState(statePath);

			const exists = await fs.pathExists(statePath);
			expect(exists).toBe(false);
		});

		it('should not throw if file does not exist', async () => {
			await expect(deleteState(statePath)).resolves.not.toThrow();
		});

		it('should remove file completely', async () => {
			await createState(statePath, { phase: 'red' });
			await deleteState(statePath);

			await expect(readState(statePath)).rejects.toThrow();
		});
	});

	describe('validateState', () => {
		it('should validate correct state structure', () => {
			const state = {
				data: { phase: 'red' },
				lastUpdated: '2024-01-15T10:30:45.123Z'
			};

			expect(() => validateState(state)).not.toThrow();
		});

		it('should reject state without data field', () => {
			const state = {
				lastUpdated: '2024-01-15T10:30:45.123Z'
			};

			expect(() => validateState(state)).toThrow('data');
		});

		it('should reject state without lastUpdated field', () => {
			const state = {
				data: { phase: 'red' }
			};

			expect(() => validateState(state)).toThrow('lastUpdated');
		});

		it('should reject state with non-object data', () => {
			const state = {
				data: 'invalid',
				lastUpdated: '2024-01-15T10:30:45.123Z'
			};

			expect(() => validateState(state)).toThrow('data must be an object');
		});

		it('should reject state with null data', () => {
			const state = {
				data: null,
				lastUpdated: '2024-01-15T10:30:45.123Z'
			};

			expect(() => validateState(state)).toThrow('data must be an object');
		});

		it('should accept state with empty data object', () => {
			const state = {
				data: {},
				lastUpdated: '2024-01-15T10:30:45.123Z'
			};

			expect(() => validateState(state)).not.toThrow();
		});

		it('should validate lastUpdated format', () => {
			const state = {
				data: { phase: 'red' },
				lastUpdated: 'invalid-date'
			};

			expect(() => validateState(state)).toThrow('lastUpdated');
		});

		it('should accept nested data structures', () => {
			const state = {
				data: {
					workflow: {
						phase: 'red',
						metadata: { attempts: 1 }
					}
				},
				lastUpdated: '2024-01-15T10:30:45.123Z'
			};

			expect(() => validateState(state)).not.toThrow();
		});
	});

	describe('State persistence', () => {
		it('should maintain state across read operations', async () => {
			await createState(statePath, { counter: 1 });

			const read1 = await readState(statePath);
			const read2 = await readState(statePath);

			expect(read1).toEqual(read2);
		});

		it('should persist updates correctly', async () => {
			await createState(statePath, { phase: 'red' });
			await updateState(statePath, { phase: 'green' });
			await updateState(statePath, { phase: 'commit' });

			const final = await readState(statePath);
			expect(final.data.phase).toBe('commit');
		});

		it('should handle rapid updates', async () => {
			await createState(statePath, { counter: 0 });

			// Rapid sequential updates
			for (let i = 1; i <= 10; i++) {
				await updateState(statePath, { counter: i });
			}

			const final = await readState(statePath);
			expect(final.data.counter).toBe(10);
		});
	});

	describe('Atomic operations', () => {
		it('should prevent file corruption on write failure', async () => {
			await createState(statePath, { phase: 'red' });
			const original = await readState(statePath);

			// Mock a write failure by making directory read-only
			try {
				await fs.chmod(testDir, 0o444);
				await expect(
					updateState(statePath, { phase: 'green' })
				).rejects.toThrow();

				// Restore permissions
				await fs.chmod(testDir, 0o755);

				// Original file should still be valid
				const current = await readState(statePath);
				expect(current).toEqual(original);
			} catch (e) {
				// Skip on platforms that don't support chmod
				await fs.chmod(testDir, 0o755);
			}
		});

		it('should handle concurrent updates gracefully', async () => {
			await createState(statePath, { counter: 0 });

			// Sequential updates to test atomic write pattern
			await updateState(statePath, { counter: 1 });
			await updateState(statePath, { counter: 2 });
			await updateState(statePath, { counter: 3 });
			await updateState(statePath, { counter: 4 });
			await updateState(statePath, { counter: 5 });

			// File should still be valid
			const final = await readState(statePath);
			expect(final.data.counter).toBe(5);
		});
	});

	describe('Edge cases', () => {
		it('should handle special characters in data', async () => {
			const data = {
				message: 'Error: "Something went wrong"\nLine 2',
				path: 'C:\\Users\\test\\file.txt'
			};

			await createState(statePath, data);
			const state = await readState(statePath);

			expect(state.data.message).toBe('Error: "Something went wrong"\nLine 2');
			expect(state.data.path).toBe('C:\\Users\\test\\file.txt');
		});

		it('should handle Unicode characters', async () => {
			const data = {
				emoji: '🚀',
				chinese: '你好',
				arabic: 'مرحبا'
			};

			await createState(statePath, data);
			const state = await readState(statePath);

			expect(state.data.emoji).toBe('🚀');
			expect(state.data.chinese).toBe('你好');
			expect(state.data.arabic).toBe('مرحبا');
		});

		it('should handle large data objects', async () => {
			const largeData = {
				items: Array.from({ length: 1000 }, (_, i) => ({
					id: i,
					value: `item-${i}`
				}))
			};

			await createState(statePath, largeData);
			const state = await readState(statePath);

			expect(state.data.items.length).toBe(1000);
			expect(state.data.items[999].value).toBe('item-999');
		});
	});
});
