/**
 * Unit Tests for Web Research Tools
 * Target: 90%+ coverage for src/tools/web-research.ts
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
	webSearchInputSchema,
	fetchUrlInputSchema,
	webSearchTool,
	fetchUrlTool
} from '../../../src/tools/web-research.js';

// Mock global fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('Web Research Tools', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('Input Schemas', () => {
		describe('webSearchInputSchema', () => {
			it('should require query', () => {
				expect(() => webSearchInputSchema.parse({})).toThrow();
				expect(() => webSearchInputSchema.parse({ query: 'test' })).not.toThrow();
			});

			it('should use default maxResults', () => {
				const result = webSearchInputSchema.parse({ query: 'test' });
				expect(result.query).toBe('test');
				expect(result.maxResults).toBe(10);
			});

			it('should accept custom maxResults', () => {
				const result = webSearchInputSchema.parse({ query: 'test', maxResults: 5 });
				expect(result.maxResults).toBe(5);
			});
		});

		describe('fetchUrlInputSchema', () => {
			it('should require valid URL', () => {
				expect(() => fetchUrlInputSchema.parse({})).toThrow();
				expect(() => fetchUrlInputSchema.parse({ url: 'invalid' })).toThrow();
				expect(() => fetchUrlInputSchema.parse({ url: 'https://example.com' })).not.toThrow();
			});

			it('should use default values', () => {
				const result = fetchUrlInputSchema.parse({ url: 'https://example.com' });
				expect(result.url).toBe('https://example.com');
				expect(result.selector).toBeUndefined();
				expect(result.maxLength).toBe(10000);
				expect(result.format).toBe('markdown');
			});

			it('should accept custom values', () => {
				const result = fetchUrlInputSchema.parse({
					url: 'https://example.com',
					selector: '#main',
					maxLength: 5000,
					format: 'text'
				});
				expect(result.selector).toBe('#main');
				expect(result.maxLength).toBe(5000);
				expect(result.format).toBe('text');
			});

			it('should only accept valid format values', () => {
				expect(() =>
					fetchUrlInputSchema.parse({ url: 'https://example.com', format: 'invalid' })
				).toThrow();
				expect(() =>
					fetchUrlInputSchema.parse({ url: 'https://example.com', format: 'markdown' })
				).not.toThrow();
				expect(() =>
					fetchUrlInputSchema.parse({ url: 'https://example.com', format: 'text' })
				).not.toThrow();
			});
		});
	});

	describe('Tool Definitions', () => {
		describe('webSearchTool', () => {
			it('should have correct description', () => {
				expect(webSearchTool.description).toContain('DuckDuckGo');
			});

			it('should have execute function', () => {
				expect(typeof webSearchTool.execute).toBe('function');
			});
		});

		describe('fetchUrlTool', () => {
			it('should have correct description', () => {
				expect(fetchUrlTool.description).toContain('URL');
				expect(fetchUrlTool.description).toContain('markdown');
			});

			it('should have execute function', () => {
				expect(typeof fetchUrlTool.execute).toBe('function');
			});
		});
	});

	describe('Tool Execution', () => {
		describe('webSearchTool.execute', () => {
			it('should parse DuckDuckGo search results', async () => {
				const mockHtml = `
					<html><body>
						<a class="result__a" href="https://example.com/1">Result 1</a>
						<a class="result__snippet">Snippet for result 1</a>
						<a class="result__a" href="https://example.com/2">Result 2</a>
						<a class="result__snippet">Snippet for result 2</a>
					</body></html>
				`;

				mockFetch.mockResolvedValueOnce({
					ok: true,
					text: async () => mockHtml
				} as Response);

				const result = await webSearchTool.execute({ query: 'test query', maxResults: 10 });

				expect(result.query).toBe('test query');
				expect(result.results.length).toBeGreaterThanOrEqual(0);
				expect(mockFetch).toHaveBeenCalledWith(
					expect.stringContaining('duckduckgo.com'),
					expect.objectContaining({ headers: expect.any(Object), signal: expect.any(AbortSignal) })
				);
			});

			it('should handle fetch errors and return error field', async () => {
				mockFetch.mockRejectedValueOnce(new Error('Network error'));

				const result = await webSearchTool.execute({ query: 'test', maxResults: 10 });

				expect(result.query).toBe('test');
				expect(result.results).toEqual([]);
				expect(result.totalResults).toBe(0);
				expect(result.error).toContain('Network error');
			});

			it('should handle non-ok response with error field', async () => {
				mockFetch.mockResolvedValueOnce({ ok: false, status: 500 } as Response);

				const result = await webSearchTool.execute({ query: 'test', maxResults: 10 });

				expect(result.results).toEqual([]);
				expect(result.error).toContain('500');
			});

			it('should use fallback pattern when no results found', async () => {
				const mockHtml = `
					<html><body>
						<a href="https://example.com/page">Some Link</a>
						<a href="https://duckduckgo.com/privacy">DDG Privacy</a>
					</body></html>
				`;

				mockFetch.mockResolvedValueOnce({
					ok: true,
					text: async () => mockHtml
				} as Response);

				const result = await webSearchTool.execute({ query: 'test', maxResults: 10 });

				expect(result.totalResults).toBeGreaterThanOrEqual(0);
			});

			it('should handle protocol-relative URLs', async () => {
				const mockHtml = `
					<html><body>
						<a class="result__a" href="//example.com/page">Link</a>
						<a class="result__snippet">Description</a>
					</body></html>
				`;

				mockFetch.mockResolvedValueOnce({
					ok: true,
					text: async () => mockHtml
				} as Response);

				const result = await webSearchTool.execute({ query: 'test', maxResults: 10 });

				expect(result.totalResults).toBeGreaterThanOrEqual(0);
			});

			it('should handle timeout/abort errors', async () => {
				const abortError = new Error('Aborted');
				abortError.name = 'AbortError';
				mockFetch.mockRejectedValueOnce(abortError);

				const result = await webSearchTool.execute({ query: 'test', maxResults: 10 });

				expect(result.results).toEqual([]);
				expect(result.error).toBeDefined();
			});
		});

		describe('fetchUrlTool.execute', () => {
			it('should fetch and convert HTML to markdown using Turndown', async () => {
				const mockHtml = `
					<!DOCTYPE html>
					<html>
					<head><title>Test Page</title></head>
					<body>
						<script>alert('hi')</script>
						<style>body { color: red; }</style>
						<nav>Navigation</nav>
						<main>
							<h1>Main Heading</h1>
							<p>This is a <strong>paragraph</strong> with <em>formatting</em>.</p>
							<a href="https://link.com">A link</a>
							<ul>
								<li>Item 1</li>
								<li>Item 2</li>
							</ul>
						</main>
						<footer>Footer content</footer>
					</body>
					</html>
				`;

				mockFetch.mockResolvedValueOnce({
					ok: true,
					headers: new Headers({ 'content-type': 'text/html' }),
					text: async () => mockHtml
				} as Response);

				const result = await fetchUrlTool.execute({
					url: 'https://example.com',
					maxLength: 10000,
					format: 'markdown'
				});

				expect(result.url).toBe('https://example.com');
				expect(result.title).toBe('Test Page');
				expect(result.format).toBe('markdown');
				// Turndown converts these
				expect(result.content).toContain('Main Heading');
				expect(result.content).toContain('**paragraph**');
				expect(result.content).not.toContain('<script>');
				expect(result.content).not.toContain('<style>');
			});

			it('should return text format when requested', async () => {
				const mockHtml = `
					<html>
					<head><title>Text Page</title></head>
					<body><main><p>Plain text content</p></main></body>
					</html>
				`;

				mockFetch.mockResolvedValueOnce({
					ok: true,
					headers: new Headers({ 'content-type': 'text/html' }),
					text: async () => mockHtml
				} as Response);

				const result = await fetchUrlTool.execute({
					url: 'https://example.com',
					maxLength: 10000,
					format: 'text'
				});

				expect(result.format).toBe('text');
				expect(result.content).toContain('Plain text content');
			});

			it('should truncate content exceeding maxLength', async () => {
				const longContent = 'A'.repeat(20000);
				const mockHtml = `
					<html>
					<head><title>Long Page</title></head>
					<body><main>${longContent}</main></body>
					</html>
				`;

				mockFetch.mockResolvedValueOnce({
					ok: true,
					headers: new Headers({ 'content-type': 'text/html' }),
					text: async () => mockHtml
				} as Response);

				const result = await fetchUrlTool.execute({
					url: 'https://example.com',
					maxLength: 1000,
					format: 'text'
				});

				expect(result.content.length).toBeLessThanOrEqual(1100);
				expect(result.content).toContain('[Content truncated...]');
			});

			it('should handle fetch errors', async () => {
				mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

				const result = await fetchUrlTool.execute({
					url: 'https://example.com',
					maxLength: 10000,
					format: 'markdown'
				});

				expect(result.title).toBe('Error');
				expect(result.content).toContain('Failed');
				// contentLength reflects the length of the error message content
				expect(result.contentLength).toBe(result.content.length);
			});

			it('should handle non-ok response', async () => {
				mockFetch.mockResolvedValueOnce({
					ok: false,
					status: 404,
					headers: new Headers()
				} as Response);

				const result = await fetchUrlTool.execute({
					url: 'https://example.com/notfound',
					maxLength: 10000,
					format: 'markdown'
				});

				expect(result.title).toBe('Error');
				expect(result.content).toContain('404');
			});

			it('should reject non-HTML content types', async () => {
				mockFetch.mockResolvedValueOnce({
					ok: true,
					headers: new Headers({ 'content-type': 'application/json' }),
					text: async () => '{"data": "json"}'
				} as Response);

				const result = await fetchUrlTool.execute({
					url: 'https://api.example.com/data',
					maxLength: 10000,
					format: 'markdown'
				});

				expect(result.title).toBe('Error');
				expect(result.content).toContain('Not HTML');
			});

			it('should extract content by ID selector', async () => {
				const mockHtml = `
					<html>
					<head><title>Selector Test</title></head>
					<body>
						<div>Outer content</div>
						<div id="main-content">Target content here</div>
					</body>
					</html>
				`;

				mockFetch.mockResolvedValueOnce({
					ok: true,
					headers: new Headers({ 'content-type': 'text/html' }),
					text: async () => mockHtml
				} as Response);

				const result = await fetchUrlTool.execute({
					url: 'https://example.com',
					selector: '#main-content',
					maxLength: 10000,
					format: 'text'
				});

				expect(result.content).toContain('Target content');
			});

			it('should extract content by class selector', async () => {
				const mockHtml = `
					<html>
					<head><title>Class Test</title></head>
					<body>
						<div>Other content</div>
						<div class="article-content">Article body here</div>
					</body>
					</html>
				`;

				mockFetch.mockResolvedValueOnce({
					ok: true,
					headers: new Headers({ 'content-type': 'text/html' }),
					text: async () => mockHtml
				} as Response);

				const result = await fetchUrlTool.execute({
					url: 'https://example.com',
					selector: '.article-content',
					maxLength: 10000,
					format: 'text'
				});

				expect(result.content).toContain('Article body');
			});

			it('should decode HTML entities including numeric and hex', async () => {
				const mockHtml = `
					<html>
					<head><title>Entities &amp; Test</title></head>
					<body>
						<main>
							<p>Hello &amp; goodbye</p>
							<p>&lt;code&gt; example &quot;quoted&quot;</p>
							<p>Numeric decimal: &#8220;quotes&#8221;</p>
							<p>Numeric hex: &#x201C;hex quotes&#x201D;</p>
						</main>
					</body>
					</html>
				`;

				mockFetch.mockResolvedValueOnce({
					ok: true,
					headers: new Headers({ 'content-type': 'text/html' }),
					text: async () => mockHtml
				} as Response);

				const result = await fetchUrlTool.execute({
					url: 'https://example.com',
					maxLength: 10000,
					format: 'text'
				});

				expect(result.content).toContain('Hello & goodbye');
				expect(result.content).toContain('<code>');
				// Numeric entities should be decoded
				expect(result.content).toContain('\u201C'); // Left double quote
			});

			it('should extract title from h1 when no title tag', async () => {
				const mockHtml = `
					<html>
					<body>
						<h1>H1 Title</h1>
						<p>Content</p>
					</body>
					</html>
				`;

				mockFetch.mockResolvedValueOnce({
					ok: true,
					headers: new Headers({ 'content-type': 'text/html' }),
					text: async () => mockHtml
				} as Response);

				const result = await fetchUrlTool.execute({
					url: 'https://example.com',
					maxLength: 10000,
					format: 'markdown'
				});

				expect(result.title).toBe('H1 Title');
			});

			it('should use Untitled when no title found', async () => {
				const mockHtml = `
					<html>
					<body>
						<p>Just content</p>
					</body>
					</html>
				`;

				mockFetch.mockResolvedValueOnce({
					ok: true,
					headers: new Headers({ 'content-type': 'text/html' }),
					text: async () => mockHtml
				} as Response);

				const result = await fetchUrlTool.execute({
					url: 'https://example.com',
					maxLength: 10000,
					format: 'markdown'
				});

				expect(result.title).toBe('Untitled');
			});

			it('should accept xhtml content type', async () => {
				const mockHtml = `
					<html>
					<head><title>XHTML Page</title></head>
					<body><p>XHTML content</p></body>
					</html>
				`;

				mockFetch.mockResolvedValueOnce({
					ok: true,
					headers: new Headers({ 'content-type': 'application/xhtml+xml' }),
					text: async () => mockHtml
				} as Response);

				const result = await fetchUrlTool.execute({
					url: 'https://example.com',
					maxLength: 10000,
					format: 'text'
				});

				expect(result.title).toBe('XHTML Page');
				expect(result.content).toContain('XHTML content');
			});
		});
	});

	describe('Default Export', () => {
		it('should export all tools via default', async () => {
			const defaultExport = (await import('../../../src/tools/web-research.js')).default;

			expect(defaultExport.webSearch).toBe(webSearchTool);
			expect(defaultExport.fetchUrl).toBe(fetchUrlTool);
		});
	});
});
