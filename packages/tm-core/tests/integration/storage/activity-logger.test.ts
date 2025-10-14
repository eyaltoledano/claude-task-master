import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
	logActivity,
	readActivityLog,
	filterActivityLog
} from '../../../src/storage/activity-logger.js';

describe('Activity Logger', () => {
	let testDir: string;
	let activityPath: string;

	beforeEach(async () => {
		// Create a unique temporary test directory
		const prefix = path.join(os.tmpdir(), 'activity-test-');
		testDir = await fs.mkdtemp(prefix);
		activityPath = path.join(testDir, 'activity.jsonl');
	});

	afterEach(async () => {
		// Clean up test directory
		await fs.remove(testDir);
	});

	describe('logActivity', () => {
		it('should create activity log file on first write', async () => {
			await logActivity(activityPath, {
				type: 'phase-start',
				phase: 'red',
				data: {}
			});

			const exists = await fs.pathExists(activityPath);
			expect(exists).toBe(true);
		});

		it('should append event to log file', async () => {
			await logActivity(activityPath, {
				type: 'phase-start',
				phase: 'red'
			});

			const content = await fs.readFile(activityPath, 'utf-8');
			const lines = content.trim().split(/\r?\n/);

			expect(lines.length).toBe(1);
		});

		it('should write valid JSONL format', async () => {
			await logActivity(activityPath, {
				type: 'test-run',
				result: 'pass'
			});

			const content = await fs.readFile(activityPath, 'utf-8');
			const line = content.trim();
			const parsed = JSON.parse(line);

			expect(parsed).toBeDefined();
			expect(parsed.type).toBe('test-run');
		});

		it('should include timestamp in log entry', async () => {
			const before = new Date().toISOString();
			await logActivity(activityPath, {
				type: 'phase-start',
				phase: 'red'
			});
			const after = new Date().toISOString();

			const logs = await readActivityLog(activityPath);
			expect(logs[0].timestamp).toBeDefined();
			expect(logs[0].timestamp >= before).toBe(true);
			expect(logs[0].timestamp <= after).toBe(true);
		});

		it('should append multiple events', async () => {
			await logActivity(activityPath, { type: 'event1' });
			await logActivity(activityPath, { type: 'event2' });
			await logActivity(activityPath, { type: 'event3' });

			const logs = await readActivityLog(activityPath);
			expect(logs.length).toBe(3);
			expect(logs[0].type).toBe('event1');
			expect(logs[1].type).toBe('event2');
			expect(logs[2].type).toBe('event3');
		});

		it('should preserve event data', async () => {
			const eventData = {
				type: 'git-commit',
				hash: 'abc123',
				message: 'test commit',
				files: ['file1.ts', 'file2.ts']
			};

			await logActivity(activityPath, eventData);

			const logs = await readActivityLog(activityPath);
			expect(logs[0].type).toBe('git-commit');
			expect(logs[0].hash).toBe('abc123');
			expect(logs[0].message).toBe('test commit');
			expect(logs[0].files).toEqual(['file1.ts', 'file2.ts']);
		});

		it('should handle nested objects in event data', async () => {
			await logActivity(activityPath, {
				type: 'test-results',
				results: {
					passed: 10,
					failed: 2,
					details: { coverage: 85 }
				}
			});

			const logs = await readActivityLog(activityPath);
			expect(logs[0].results.details.coverage).toBe(85);
		});

		it('should handle special characters in event data', async () => {
			await logActivity(activityPath, {
				type: 'error',
				message: 'Error: "Something went wrong"\nLine 2'
			});

			const logs = await readActivityLog(activityPath);
			expect(logs[0].message).toBe('Error: "Something went wrong"\nLine 2');
		});

		it('should create parent directory if it does not exist', async () => {
			const nestedPath = path.join(testDir, 'nested', 'dir', 'activity.jsonl');

			await logActivity(nestedPath, { type: 'test' });

			const exists = await fs.pathExists(nestedPath);
			expect(exists).toBe(true);
		});
	});

	describe('readActivityLog', () => {
		it('should read all events from log', async () => {
			await logActivity(activityPath, { type: 'event1' });
			await logActivity(activityPath, { type: 'event2' });

			const logs = await readActivityLog(activityPath);

			expect(logs.length).toBe(2);
			expect(logs[0].type).toBe('event1');
			expect(logs[1].type).toBe('event2');
		});

		it('should return empty array for non-existent file', async () => {
			const logs = await readActivityLog(activityPath);
			expect(logs).toEqual([]);
		});

		it('should parse JSONL correctly', async () => {
			await logActivity(activityPath, { type: 'event1', data: 'test1' });
			await logActivity(activityPath, { type: 'event2', data: 'test2' });

			const logs = await readActivityLog(activityPath);

			expect(logs[0].data).toBe('test1');
			expect(logs[1].data).toBe('test2');
		});

		it('should handle empty lines', async () => {
			await fs.writeFile(
				activityPath,
				'{"type":"event1"}\n\n{"type":"event2"}\n'
			);

			const logs = await readActivityLog(activityPath);

			expect(logs.length).toBe(2);
			expect(logs[0].type).toBe('event1');
			expect(logs[1].type).toBe('event2');
		});

		it('should throw error for invalid JSON line', async () => {
			await fs.writeFile(activityPath, '{"type":"event1"}\ninvalid json\n');

			await expect(readActivityLog(activityPath)).rejects.toThrow(
				/Invalid JSON/i
			);
		});

		it('should preserve chronological order', async () => {
			for (let i = 0; i < 10; i++) {
				await logActivity(activityPath, { type: 'event', index: i });
			}

			const logs = await readActivityLog(activityPath);

			for (let i = 0; i < 10; i++) {
				expect(logs[i].index).toBe(i);
			}
		});
	});

	describe('filterActivityLog', () => {
		beforeEach(async () => {
			// Create sample log entries
			await logActivity(activityPath, { type: 'phase-start', phase: 'red' });
			await logActivity(activityPath, { type: 'test-run', result: 'fail' });
			await logActivity(activityPath, { type: 'phase-start', phase: 'green' });
			await logActivity(activityPath, { type: 'test-run', result: 'pass' });
			await logActivity(activityPath, { type: 'git-commit', hash: 'abc123' });
		});

		it('should filter by event type', async () => {
			const filtered = await filterActivityLog(activityPath, {
				type: 'phase-start'
			});

			expect(filtered.length).toBe(2);
			expect(filtered[0].type).toBe('phase-start');
			expect(filtered[1].type).toBe('phase-start');
		});

		it('should filter by multiple criteria', async () => {
			const filtered = await filterActivityLog(activityPath, {
				type: 'test-run',
				result: 'pass'
			});

			expect(filtered.length).toBe(1);
			expect(filtered[0].result).toBe('pass');
		});

		it('should return all events when no filter provided', async () => {
			const filtered = await filterActivityLog(activityPath, {});

			expect(filtered.length).toBe(5);
		});

		it('should filter by timestamp range', async () => {
			const logs = await readActivityLog(activityPath);
			const midpoint = logs[2].timestamp;

			const filtered = await filterActivityLog(activityPath, {
				timestampFrom: midpoint
			});

			// Should get events from midpoint onwards (inclusive)
			// Expect at least 3 events, may be more due to timestamp collisions
			expect(filtered.length).toBeGreaterThanOrEqual(3);
			expect(filtered.length).toBeLessThanOrEqual(5);
		});

		it('should filter by custom predicate', async () => {
			const filtered = await filterActivityLog(activityPath, {
				predicate: (event: any) => event.phase === 'red'
			});

			expect(filtered.length).toBe(1);
			expect(filtered[0].phase).toBe('red');
		});

		it('should return empty array for non-matching filter', async () => {
			const filtered = await filterActivityLog(activityPath, {
				type: 'non-existent'
			});

			expect(filtered).toEqual([]);
		});

		it('should handle nested property filters', async () => {
			await logActivity(activityPath, {
				type: 'test-results',
				results: { coverage: 85 }
			});

			const filtered = await filterActivityLog(activityPath, {
				predicate: (event: any) => event.results?.coverage > 80
			});

			expect(filtered.length).toBe(1);
			expect(filtered[0].results.coverage).toBe(85);
		});
	});

	describe('Event types', () => {
		it('should support phase-transition events', async () => {
			await logActivity(activityPath, {
				type: 'phase-transition',
				from: 'red',
				to: 'green'
			});

			const logs = await readActivityLog(activityPath);
			expect(logs[0].type).toBe('phase-transition');
			expect(logs[0].from).toBe('red');
			expect(logs[0].to).toBe('green');
		});

		it('should support test-run events', async () => {
			await logActivity(activityPath, {
				type: 'test-run',
				result: 'pass',
				testsRun: 50,
				testsPassed: 50,
				testsFailed: 0,
				coverage: 85.5
			});

			const logs = await readActivityLog(activityPath);
			expect(logs[0].testsRun).toBe(50);
			expect(logs[0].coverage).toBe(85.5);
		});

		it('should support git-operation events', async () => {
			await logActivity(activityPath, {
				type: 'git-commit',
				hash: 'abc123def456',
				message: 'feat: add new feature',
				files: ['file1.ts', 'file2.ts']
			});

			const logs = await readActivityLog(activityPath);
			expect(logs[0].hash).toBe('abc123def456');
			expect(logs[0].files.length).toBe(2);
		});

		it('should support error events', async () => {
			await logActivity(activityPath, {
				type: 'error',
				phase: 'red',
				error: 'Test failed',
				stack: 'Error stack trace...'
			});

			const logs = await readActivityLog(activityPath);
			expect(logs[0].type).toBe('error');
			expect(logs[0].error).toBe('Test failed');
		});
	});

	describe('Concurrency handling', () => {
		it('should handle rapid concurrent writes', async () => {
			const writes: Promise<void>[] = [];
			for (let i = 0; i < 50; i++) {
				writes.push(logActivity(activityPath, { type: 'event', index: i }));
			}

			await Promise.all(writes);

			const logs = await readActivityLog(activityPath);
			expect(logs.length).toBe(50);
		});

		it('should maintain data integrity with concurrent writes', async () => {
			const writes: Promise<void>[] = [];
			for (let i = 0; i < 20; i++) {
				writes.push(
					logActivity(activityPath, {
						type: 'concurrent-test',
						id: i,
						data: `data-${i}`
					})
				);
			}

			await Promise.all(writes);

			const logs = await readActivityLog(activityPath);

			// All events should be present
			expect(logs.length).toBe(20);
			// Validate ids set
			const ids = new Set(logs.map((l) => l.id));
			expect([...ids].sort((a, b) => a - b)).toEqual([...Array(20).keys()]);
			// Validate shape
			for (const log of logs) {
				expect(log.type).toBe('concurrent-test');
				expect(typeof log.id).toBe('number');
				expect(log.data).toMatch(/^data-\d+$/);
			}
		});
	});

	describe('File integrity', () => {
		it('should maintain valid JSONL after many operations', async () => {
			for (let i = 0; i < 100; i++) {
				await logActivity(activityPath, { type: 'test', iteration: i });
			}

			const content = await fs.readFile(activityPath, 'utf-8');
			const lines = content.trim().split(/\r?\n/);

			expect(lines.length).toBe(100);

			// All lines should be valid JSON
			for (const line of lines) {
				expect(() => JSON.parse(line)).not.toThrow();
			}
		});
	});
});
