/**
 * Unit Tests for File Operations Tools
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
	projectTreeInputSchema,
	fileSearchInputSchema,
	fileReadInputSchema,
	grepInputSchema,
	projectTreeTool,
	fileSearchTool,
	fileReadTool,
	grepTool
} from '../../../src/tools/file-operations.js';

describe('File Operations Tools', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe('Input Schemas', () => {
		describe('projectTreeInputSchema', () => {
			it('should use default values when not provided', () => {
				const result = projectTreeInputSchema.parse({});
				expect(result.directory).toBe('.');
				expect(result.maxDepth).toBe(3);
				expect(result.includeFiles).toBe(true);
				expect(result.ignore).toEqual(['node_modules', '.git', 'dist', 'coverage', '__pycache__', '.next', 'build']);
			});

			it('should accept custom values', () => {
				const result = projectTreeInputSchema.parse({
					directory: 'src',
					maxDepth: 5,
					includeFiles: false,
					ignore: ['custom']
				});
				expect(result.directory).toBe('src');
				expect(result.maxDepth).toBe(5);
				expect(result.includeFiles).toBe(false);
				expect(result.ignore).toEqual(['custom']);
			});
		});

		describe('fileSearchInputSchema', () => {
			it('should require pattern', () => {
				expect(() => fileSearchInputSchema.parse({})).toThrow();
				expect(() => fileSearchInputSchema.parse({ pattern: '*.ts' })).not.toThrow();
			});

			it('should use default values', () => {
				const result = fileSearchInputSchema.parse({ pattern: '*.ts' });
				expect(result.pattern).toBe('*.ts');
				expect(result.directory).toBe('.');
				expect(result.maxResults).toBe(50);
			});
		});

		describe('fileReadInputSchema', () => {
			it('should require path', () => {
				expect(() => fileReadInputSchema.parse({})).toThrow();
				expect(() => fileReadInputSchema.parse({ path: 'test.txt' })).not.toThrow();
			});

			it('should accept optional line range', () => {
				const result = fileReadInputSchema.parse({
					path: 'test.txt',
					startLine: 10,
					endLine: 20
				});
				expect(result.path).toBe('test.txt');
				expect(result.startLine).toBe(10);
				expect(result.endLine).toBe(20);
			});
		});

		describe('grepInputSchema', () => {
			it('should require pattern', () => {
				expect(() => grepInputSchema.parse({})).toThrow();
				expect(() => grepInputSchema.parse({ pattern: 'TODO' })).not.toThrow();
			});

			it('should use default values', () => {
				const result = grepInputSchema.parse({ pattern: 'TODO' });
				expect(result.pattern).toBe('TODO');
				expect(result.directory).toBe('.');
				expect(result.filePattern).toBe('*');
				expect(result.contextLines).toBe(2);
				expect(result.maxMatches).toBe(50);
			});
		});
	});

	describe('Tool Definitions', () => {
		describe('projectTreeTool', () => {
			it('should have correct description', () => {
				expect(projectTreeTool.description).toContain('tree view');
				expect(projectTreeTool.description).toContain('project structure');
			});

			it('should have execute function', () => {
				expect(typeof projectTreeTool.execute).toBe('function');
			});
		});

		describe('fileSearchTool', () => {
			it('should have correct description', () => {
				expect(fileSearchTool.description).toContain('glob pattern');
			});

			it('should have execute function', () => {
				expect(typeof fileSearchTool.execute).toBe('function');
			});
		});

		describe('fileReadTool', () => {
			it('should have correct description', () => {
				expect(fileReadTool.description).toContain('Read');
				expect(fileReadTool.description).toContain('file');
			});

			it('should have execute function', () => {
				expect(typeof fileReadTool.execute).toBe('function');
			});
		});

		describe('grepTool', () => {
			it('should have correct description', () => {
				expect(grepTool.description).toContain('Search');
				expect(grepTool.description).toContain('pattern');
			});

			it('should have execute function', () => {
				expect(typeof grepTool.execute).toBe('function');
			});
		});
	});
});

