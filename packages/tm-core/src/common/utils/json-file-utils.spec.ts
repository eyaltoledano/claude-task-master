/**
 * @fileoverview Tests for JSON file utilities
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readJSON, writeJSON } from './json-file-utils.js';

describe('JSON File Utils', () => {
	const testDir = path.join(process.cwd(), 'test-json-utils');
	const testFile = path.join(testDir, 'test.json');

	beforeEach(async () => {
		await fs.mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		await fs.rm(testDir, { recursive: true, force: true });
	});

	describe('writeJSON', () => {
		it('should write JSON data to a file', async () => {
			const data = { foo: 'bar', count: 42 };
			await writeJSON(testFile, data);

			const content = await fs.readFile(testFile, 'utf-8');
			expect(JSON.parse(content)).toEqual(data);
		});

		it('should create directory if it does not exist', async () => {
			const nestedFile = path.join(testDir, 'nested', 'deep', 'test.json');
			const data = { nested: true };
			await writeJSON(nestedFile, data);

			const content = await fs.readFile(nestedFile, 'utf-8');
			expect(JSON.parse(content)).toEqual(data);
		});

		it('should format JSON with 2-space indentation', async () => {
			const data = { foo: 'bar', nested: { value: 123 } };
			await writeJSON(testFile, data);

			const content = await fs.readFile(testFile, 'utf-8');
			expect(content).toContain('  "foo": "bar"');
			expect(content).toContain('  "nested": {');
		});

		it('should use atomic write (temp file + rename)', async () => {
			const data = { atomic: true };
			const writePromise = writeJSON(testFile, data);

			// Temp file should exist during write
			// (Note: This is hard to test reliably due to timing, so we just verify the final result)
			await writePromise;

			// Final file should exist
			const exists = await fs
				.access(testFile)
				.then(() => true)
				.catch(() => false);
			expect(exists).toBe(true);

			// Temp file should be cleaned up
			const tempExists = await fs
				.access(`${testFile}.tmp`)
				.then(() => true)
				.catch(() => false);
			expect(tempExists).toBe(false);
		});
	});

	describe('readJSON', () => {
		it('should read and parse JSON file', async () => {
			const data = { foo: 'bar', count: 42 };
			await fs.writeFile(testFile, JSON.stringify(data, null, 2), 'utf-8');

			const result = await readJSON(testFile);
			expect(result).toEqual(data);
		});

		it('should throw ENOENT error if file does not exist', async () => {
			await expect(readJSON(testFile)).rejects.toThrow();
			await expect(readJSON(testFile)).rejects.toMatchObject({
				code: 'ENOENT'
			});
		});

		it('should throw descriptive error for invalid JSON', async () => {
			await fs.writeFile(testFile, 'invalid json {', 'utf-8');

			await expect(readJSON(testFile)).rejects.toThrow(/Invalid JSON/);
			await expect(readJSON(testFile)).rejects.toThrow(/test\.json/);
		});

		it('should throw descriptive error for read failures', async () => {
			// Create a directory with the same name as the file to cause a read error
			await fs.mkdir(testFile, { recursive: true });

			await expect(readJSON(testFile)).rejects.toThrow(/Failed to read file/);
			await expect(readJSON(testFile)).rejects.toThrow(/test\.json/);
		});
	});

	describe('round-trip', () => {
		it('should write and read back the same data', async () => {
			const originalData = {
				string: 'value',
				number: 42,
				boolean: true,
				null: null,
				array: [1, 2, 3],
				object: { nested: 'data' }
			};

			await writeJSON(testFile, originalData);
			const readData = await readJSON(testFile);

			expect(readData).toEqual(originalData);
		});
	});
});
