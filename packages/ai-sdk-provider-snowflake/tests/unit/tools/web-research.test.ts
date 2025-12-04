/**
 * Unit Tests for Web Research Tools
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
	webSearchInputSchema,
	fetchUrlInputSchema,
	webSearchTool,
	fetchUrlTool
} from '../../../src/tools/web-research.js';

describe('Web Research Tools', () => {
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
				expect(() => fetchUrlInputSchema.parse({ 
					url: 'https://example.com', 
					format: 'invalid' 
				})).toThrow();
				
				expect(() => fetchUrlInputSchema.parse({ 
					url: 'https://example.com', 
					format: 'markdown' 
				})).not.toThrow();
				
				expect(() => fetchUrlInputSchema.parse({ 
					url: 'https://example.com', 
					format: 'text' 
				})).not.toThrow();
			});
		});
	});

	describe('Tool Definitions', () => {
		describe('webSearchTool', () => {
			it('should have correct description', () => {
				expect(webSearchTool.description).toContain('DuckDuckGo');
				expect(webSearchTool.description).toContain('no API key');
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
});

