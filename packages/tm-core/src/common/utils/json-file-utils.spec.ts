/**
 * @fileoverview Tests for JSON file utilities
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockReadFile, mockWriteFile, mockMkdir, mockRename, mockUnlink } =
	vi.hoisted(() => ({
		mockReadFile: vi.fn(),
		mockWriteFile: vi.fn(),
		mockMkdir: vi.fn(),
		mockRename: vi.fn(),
		mockUnlink: vi.fn()
	}));

vi.mock('node:fs', () => ({
	promises: {
		readFile: mockReadFile,
		writeFile: mockWriteFile,
		mkdir: mockMkdir,
		rename: mockRename,
		unlink: mockUnlink
	}
}));

// Suppress logger output in tests
vi.mock('../logger/index.js', () => ({
	getLogger: () => ({
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn()
	})
}));

import { readJSON, writeJSON } from './json-file-utils.js';

describe('JSON File Utils', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockMkdir.mockResolvedValue(undefined);
		mockWriteFile.mockResolvedValue(undefined);
		mockRename.mockResolvedValue(undefined);
		mockUnlink.mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('writeJSON', () => {
		it('should write JSON data to a file and return true', async () => {
			const data = { foo: 'bar', count: 42 };
			const result = await writeJSON('/tmp/test.json', data);

			expect(result).toBe(true);
			expect(mockMkdir).toHaveBeenCalledWith('/tmp', { recursive: true });
			expect(mockWriteFile).toHaveBeenCalledWith(
				'/tmp/test.json.tmp',
				JSON.stringify(data, null, 2),
				'utf-8'
			);
			expect(mockRename).toHaveBeenCalledWith(
				'/tmp/test.json.tmp',
				'/tmp/test.json'
			);
		});

		it('should create directory if it does not exist', async () => {
			const data = { nested: true };
			await writeJSON('/tmp/nested/deep/test.json', data);

			expect(mockMkdir).toHaveBeenCalledWith('/tmp/nested/deep', {
				recursive: true
			});
		});

		it('should format JSON with 2-space indentation', async () => {
			const data = { foo: 'bar', nested: { value: 123 } };
			await writeJSON('/tmp/test.json', data);

			const writtenContent = mockWriteFile.mock.calls[0][1] as string;
			expect(writtenContent).toContain('  "foo": "bar"');
			expect(writtenContent).toContain('  "nested": {');
		});

		it('should return false and clean up temp file on write error', async () => {
			mockWriteFile.mockRejectedValue(new Error('disk full'));

			const result = await writeJSON('/tmp/test.json', { fail: true });

			expect(result).toBe(false);
			expect(mockUnlink).toHaveBeenCalledWith('/tmp/test.json.tmp');
		});

		it('should return false on mkdir error', async () => {
			mockMkdir.mockRejectedValue(new Error('permission denied'));

			const result = await writeJSON('/tmp/test.json', { fail: true });

			expect(result).toBe(false);
		});

		it('should tolerate temp file cleanup failure', async () => {
			mockRename.mockRejectedValue(new Error('rename failed'));
			mockUnlink.mockRejectedValue(new Error('unlink failed'));

			const result = await writeJSON('/tmp/test.json', { fail: true });

			expect(result).toBe(false);
		});
	});

	describe('readJSON', () => {
		it('should read and parse JSON file', async () => {
			const data = { foo: 'bar', count: 42 };
			mockReadFile.mockResolvedValue(JSON.stringify(data, null, 2));

			const result = await readJSON('/tmp/test.json');
			expect(result).toEqual(data);
		});

		it('should return null if file does not exist', async () => {
			const enoent = new Error('ENOENT') as NodeJS.ErrnoException;
			enoent.code = 'ENOENT';
			mockReadFile.mockRejectedValue(enoent);

			const result = await readJSON('/tmp/test.json');
			expect(result).toBeNull();
		});

		it('should return null for invalid JSON', async () => {
			mockReadFile.mockResolvedValue('invalid json {');

			const result = await readJSON('/tmp/test.json');
			expect(result).toBeNull();
		});

		it('should return null for read failures', async () => {
			mockReadFile.mockRejectedValue(new Error('permission denied'));

			const result = await readJSON('/tmp/test.json');
			expect(result).toBeNull();
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

			let capturedContent = '';
			mockWriteFile.mockImplementation(
				async (_path: string, content: string) => {
					capturedContent = content;
				}
			);
			mockReadFile.mockImplementation(async () => capturedContent);

			await writeJSON('/tmp/test.json', originalData);
			const readData = await readJSON('/tmp/test.json');

			expect(readData).toEqual(originalData);
		});
	});
});
