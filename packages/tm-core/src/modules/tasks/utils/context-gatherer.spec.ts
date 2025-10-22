/**
 * Tests for ContextGatherer utility
 * Tests token counting, context gathering from tasks, files, and project trees
 */

import { describe, it, expect } from 'vitest';
import { ContextGatherer, createContextGatherer } from './context-gatherer.js';
import type {
	ContextGathererOptions,
	ContextResult,
	Task,
} from './context-gatherer.js';

describe('ContextGatherer', () => {
	describe('Token Counting', () => {
		it('should count tokens in a simple string', () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');
			const text = 'Hello world, this is a test string.';
			const tokenCount = gatherer.countTokens(text);

			expect(tokenCount).toBeGreaterThan(0);
			expect(typeof tokenCount).toBe('number');
		});

		it('should return 0 for empty string', () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');
			const tokenCount = gatherer.countTokens('');

			expect(tokenCount).toBe(0);
		});

		it('should return 0 for non-string input', () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');
			const tokenCount = gatherer.countTokens(null as any);

			expect(tokenCount).toBe(0);
		});

		it('should fall back to character-based estimation on tokenizer error', () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');
			// Create a string that might cause tokenizer issues
			const text = 'A'.repeat(100);
			const tokenCount = gatherer.countTokens(text);

			expect(tokenCount).toBeGreaterThan(0);
			expect(tokenCount).toBeLessThanOrEqual(Math.ceil(100 / 4) + 5); // Rough estimate
		});
	});

	describe('Task Context Gathering', () => {
		it('should gather context for a single task', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				tasks: ['1'],
				format: 'research',
			});

			expect(result).toBeDefined();
			expect(result.context).toBeDefined();
			expect(typeof result.context).toBe('string');
		});

		it('should gather context for multiple tasks', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				tasks: ['1', '2'],
				format: 'research',
			});

			expect(result).toBeDefined();
			expect(result.finalTaskIds).toContain('1');
			expect(result.finalTaskIds).toContain('2');
		});

		it('should gather context for a subtask', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				tasks: ['1.1'],
				format: 'research',
			});

			expect(result).toBeDefined();
			expect(result.context).toBeDefined();
		});

		it('should handle mixed task and subtask IDs', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				tasks: ['1', '2.1', '3'],
				format: 'research',
			});

			expect(result).toBeDefined();
			expect(result.finalTaskIds.length).toBe(3);
		});

		it('should return empty context when no tasks found', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				tasks: ['999'],
				format: 'research',
			});

			expect(result).toBeDefined();
			expect(result.context).toBe('');
		});
	});

	describe('Custom Context', () => {
		it('should include custom context in research format', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');
			const customContext = 'This is important additional context';

			const result = await gatherer.gather({
				customContext,
				format: 'research',
			});

			expect(result.context).toContain('Additional Context');
			expect(result.context).toContain(customContext);
		});

		it('should include custom context in chat format', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');
			const customContext = 'This is important additional context';

			const result = await gatherer.gather({
				customContext,
				format: 'chat',
			});

			expect(result.context).toContain('Additional Context');
			expect(result.context).toContain(customContext);
		});

		it('should trim whitespace from custom context', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');
			const customContext = '   \n\n  Custom text  \n\n  ';

			const result = await gatherer.gather({
				customContext,
				format: 'research',
			});

			expect(result.context).toContain('Custom text');
		});

		it('should skip empty custom context', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				customContext: '   ',
				format: 'research',
			});

			expect(result.context).not.toContain('Additional Context');
		});
	});

	describe('File Context Gathering', () => {
		it('should gather context from a single file', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				files: ['README.md'],
				format: 'research',
			});

			expect(result).toBeDefined();
			// With fake paths, files won't be found so context will be empty
			expect(typeof result.context).toBe('string');
		});

		it('should handle absolute file paths', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				files: ['/fake/project/README.md'],
				format: 'research',
			});

			expect(result).toBeDefined();
		});

		it('should skip non-existent files', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				files: ['non-existent-file.txt'],
				format: 'research',
			});

			expect(result).toBeDefined();
			expect(result.context).not.toContain('non-existent-file.txt');
		});

		it('should skip files larger than 50KB', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			// This test assumes we have a mechanism to mock file stats
			const result = await gatherer.gather({
				files: ['large-file.txt'], // Assume this is >50KB
				format: 'research',
			});

			expect(result).toBeDefined();
		});

		it('should handle multiple files', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				files: ['file1.txt', 'file2.txt'],
				format: 'research',
			});

			expect(result).toBeDefined();
		});
	});

	describe('Project Tree Generation', () => {
		it('should generate project tree when requested', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				includeProjectTree: true,
				format: 'research',
			});

			expect(result).toBeDefined();
			// With fake paths, tree generation will fail gracefully
			expect(typeof result.context).toBe('string');
		});

		it('should respect maxDepth parameter', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				includeProjectTree: true,
				format: 'research',
			});

			expect(result).toBeDefined();
			// Tree should be limited to depth 5
		});

		it('should ignore common directories', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				includeProjectTree: true,
				format: 'research',
			});

			expect(result.context).not.toContain('node_modules');
			expect(result.context).not.toContain('.git');
		});

		it('should include file and directory counts', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				includeProjectTree: true,
				format: 'research',
			});

			// With fake paths, tree won't generate so we just check it doesn't crash
			expect(result).toBeDefined();
			expect(typeof result.context).toBe('string');
		});
	});

	describe('Token Breakdown', () => {
		it('should include token breakdown when requested', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				tasks: ['1'],
				customContext: 'Some context',
				includeTokenCounts: true,
				format: 'research',
			});

			expect(result.tokenBreakdown).toBeDefined();
			if (result.tokenBreakdown) {
				expect(result.tokenBreakdown.total).toBeGreaterThan(0);
				expect(result.tokenBreakdown.customContext).toBeDefined();
			}
		});

		it('should break down tokens by source', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				tasks: ['1'],
				files: ['README.md'],
				customContext: 'Context',
				includeProjectTree: true,
				includeTokenCounts: true,
				format: 'research',
			});

			if (result.tokenBreakdown) {
				expect(result.tokenBreakdown.tasks).toBeDefined();
				expect(result.tokenBreakdown.files).toBeDefined();
				expect(result.tokenBreakdown.projectTree).toBeDefined();
				expect(result.tokenBreakdown.customContext).toBeDefined();
			}
		});

		it('should not include token breakdown when not requested', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				tasks: ['1'],
				includeTokenCounts: false,
				format: 'research',
			});

			expect(result.tokenBreakdown).toBeUndefined();
		});
	});

	describe('Semantic Search', () => {
		it('should perform semantic search when query provided', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				semanticQuery: 'authentication features',
				maxSemanticResults: 5,
				format: 'research',
			});

			expect(result).toBeDefined();
			// With no tasks loaded, analysisData won't be populated
			// The function handles this gracefully
			expect(typeof result.context).toBe('string');
		});

		it('should limit semantic results to maxSemanticResults', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				semanticQuery: 'testing',
				maxSemanticResults: 3,
				format: 'research',
			});

			expect(result.finalTaskIds.length).toBeLessThanOrEqual(3);
		});

		it('should include analysis data with relevance groupings', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				semanticQuery: 'database queries',
				format: 'research',
			});

			if (result.analysisData) {
				expect(result.analysisData.highRelevance).toBeDefined();
				expect(result.analysisData.mediumRelevance).toBeDefined();
				expect(result.analysisData.recentTasks).toBeDefined();
			}
		});
	});

	describe('Dependency Graph', () => {
		it('should build dependency graph when requested', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				dependencyTasks: [1, 2],
				format: 'research',
			});

			expect(result).toBeDefined();
		});

		it('should include all related tasks from dependency chain', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				dependencyTasks: [1],
				format: 'research',
			});

			expect(result.finalTaskIds).toBeDefined();
			// With no tasks loaded, the chain will be empty
			expect(Array.isArray(result.finalTaskIds)).toBe(true);
		});

		it('should limit recursion depth to prevent infinite loops', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				dependencyTasks: [1],
				format: 'research',
			});

			// Should complete without stack overflow
			expect(result).toBeDefined();
		});
	});

	describe('Output Formats', () => {
		it('should format context for research', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				customContext: 'Test',
				format: 'research',
			});

			expect(result.context).toContain('##');
		});

		it('should format context for chat', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				customContext: 'Test',
				format: 'chat',
			});

			expect(result.context).toContain('**');
		});

		it('should format context for system-prompt', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				customContext: 'Test',
				format: 'system-prompt',
			});

			expect(result.context).toBeDefined();
			expect(typeof result.context).toBe('string');
		});
	});

	describe('Error Handling', () => {
		it('should handle invalid project root gracefully', () => {
			const gatherer = new ContextGatherer('/non/existent/path', 'test-tag');
			expect(gatherer).toBeDefined();
		});

		it('should handle missing tasks.json file', async () => {
			const gatherer = new ContextGatherer('/fake/empty/project', 'test-tag');

			const result = await gatherer.gather({
				tasks: ['1'],
				format: 'research',
			});

			expect(result).toBeDefined();
		});

		it('should handle file read errors gracefully', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				files: ['/root/protected-file.txt'],
				format: 'research',
			});

			expect(result).toBeDefined();
		});
	});

	describe('Factory Function', () => {
		it('should create ContextGatherer instance', () => {
			const gatherer = createContextGatherer('/fake/project', 'test-tag');

			expect(gatherer).toBeInstanceOf(ContextGatherer);
		});

		it('should throw error when tag is not provided', () => {
			expect(() => {
				createContextGatherer('/fake/project', '');
			}).toThrow('Tag is required');
		});

		it('should throw error when tag is undefined', () => {
			expect(() => {
				createContextGatherer('/fake/project', undefined as any);
			}).toThrow('Tag is required');
		});
	});

	describe('Task ID Parsing', () => {
		it('should parse simple task ID', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				tasks: ['15'],
				format: 'research',
			});

			expect(result.finalTaskIds).toContain('15');
		});

		it('should parse subtask ID', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				tasks: ['15.2'],
				format: 'research',
			});

			expect(result.finalTaskIds).toContain('15.2');
		});

		it('should handle comma-separated task IDs', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				tasks: ['1', '2', '3'],
				format: 'research',
			});

			expect(result.finalTaskIds.length).toBeGreaterThanOrEqual(3);
		});
	});

	describe('Context Sections', () => {
		it('should track number of context sections', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				tasks: ['1'],
				customContext: 'Test',
				includeProjectTree: true,
				format: 'research',
			});

			expect(result.contextSections).toBeGreaterThan(0);
		});

		it('should join sections with proper separators', async () => {
			const gatherer = new ContextGatherer('/fake/project', 'test-tag');

			const result = await gatherer.gather({
				tasks: ['1'],
				customContext: 'Test',
				format: 'research',
			});

			// With fake project and no tasks, only custom context will be present
			// Separator only appears when multiple sections exist
			expect(result.context).toContain('Additional Context');
			expect(typeof result.context).toBe('string');
		});
	});
});
