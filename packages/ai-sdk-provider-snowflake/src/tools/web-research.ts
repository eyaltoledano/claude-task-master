/**
 * Web Research Tools - No API Key Required
 *
 * Provides web search via DuckDuckGo HTML scraping and URL fetching
 * with automatic HTML-to-markdown conversion for compact context.
 */

import { z } from 'zod';
import type { SearchResult, WebSearchResult, FetchUrlResult } from './types.js';

/**
 * Tool definition type that works with AI SDK
 * Note: Using z.ZodType<TInput, z.ZodTypeDef, unknown> to allow schemas with defaults
 */
export interface ToolDefinition<TInput, TOutput> {
	description: string;
	parameters: z.ZodType<TInput, z.ZodTypeDef, unknown>;
	execute: (input: TInput) => Promise<TOutput>;
}

/**
 * Parse DuckDuckGo HTML search results
 */
function parseDuckDuckGoResults(
	html: string,
	maxResults: number
): SearchResult[] {
	const results: SearchResult[] = [];

	// DuckDuckGo result pattern
	const resultPattern =
		/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([^<]+)<\/a>/gi;

	let match;
	while (
		(match = resultPattern.exec(html)) !== null &&
		results.length < maxResults
	) {
		const [, url, title, snippet] = match;
		if (url && title) {
			results.push({
				url: url.startsWith('//') ? `https:${url}` : url,
				title: decodeHtmlEntities(title.trim()),
				snippet: decodeHtmlEntities(snippet?.trim() || '')
			});
		}
	}

	// Fallback pattern
	if (results.length === 0) {
		const linkPattern = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
		while (
			(match = linkPattern.exec(html)) !== null &&
			results.length < maxResults
		) {
			const [, url, title] = match;
			if (url && title && !url.includes('duckduckgo.com')) {
				results.push({
					url,
					title: decodeHtmlEntities(title.trim()),
					snippet: ''
				});
			}
		}
	}

	return results;
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
	const entities: Record<string, string> = {
		'&amp;': '&',
		'&lt;': '<',
		'&gt;': '>',
		'&quot;': '"',
		'&#39;': "'",
		'&nbsp;': ' ',
		'&ndash;': '–',
		'&mdash;': '—',
		'&hellip;': '…'
	};

	return text.replace(/&[^;]+;/g, (match) => entities[match] || match);
}

/**
 * Extract main content from HTML
 */
function extractMainContent(html: string, selector?: string): string {
	let content = html
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
		.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
		.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
		.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
		.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

	if (selector) {
		if (selector.startsWith('#')) {
			const id = selector.slice(1);
			const idPattern = new RegExp(
				`<[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/`,
				'i'
			);
			const match = content.match(idPattern);
			if (match) content = match[1];
		} else if (selector.startsWith('.')) {
			const className = selector.slice(1);
			const classPattern = new RegExp(
				`<[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/`,
				'i'
			);
			const match = content.match(classPattern);
			if (match) content = match[1];
		}
	}

	const mainPatterns = [
		/<main[^>]*>([\s\S]*?)<\/main>/i,
		/<article[^>]*>([\s\S]*?)<\/article>/i,
		/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
		/<div[^>]*id="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i
	];

	for (const pattern of mainPatterns) {
		const match = content.match(pattern);
		if (match && match[1].length > 500) {
			content = match[1];
			break;
		}
	}

	return content;
}

/**
 * Convert HTML to Markdown
 */
function htmlToMarkdown(html: string): string {
	let md = html;

	// Headers
	md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
	md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
	md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
	md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');
	md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n');
	md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n');

	// Bold and italic
	md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
	md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
	md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
	md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');

	// Code
	md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
	md = md.replace(
		/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
		'\n```\n$1\n```\n'
	);
	md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');

	// Links
	md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

	// Images
	md = md.replace(
		/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi,
		'![$2]($1)'
	);
	md = md.replace(
		/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi,
		'![$1]($2)'
	);
	md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

	// Lists
	md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, content) => {
		return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
	});
	md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, content) => {
		let i = 0;
		return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, () => {
			i++;
			return `${i}. $1\n`;
		});
	});

	// Paragraphs
	md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');
	md = md.replace(/<br\s*\/?>/gi, '\n');
	md = md.replace(/<hr\s*\/?>/gi, '\n---\n');

	// Blockquotes
	md = md.replace(
		/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
		(_, content) => {
			return content
				.split('\n')
				.map((line: string) => `> ${line}`)
				.join('\n');
		}
	);

	// Remove remaining tags
	md = md.replace(/<[^>]+>/g, '');
	md = decodeHtmlEntities(md);
	md = md
		.replace(/\n\s*\n\s*\n/g, '\n\n')
		.replace(/^\s+|\s+$/g, '')
		.replace(/[ \t]+/g, ' ');

	return md;
}

/**
 * Extract page title from HTML
 */
function extractTitle(html: string): string {
	const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
	if (titleMatch) return decodeHtmlEntities(titleMatch[1].trim());

	const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
	if (h1Match) return decodeHtmlEntities(h1Match[1].trim());

	return 'Untitled';
}

/**
 * Web Search Input Schema
 * Note: Using .default() without .optional() - Zod's .default() already handles undefined input
 */
export const webSearchInputSchema = z.object({
	query: z.string().describe('Search query'),
	maxResults: z
		.number()
		.default(10)
		.describe('Maximum number of results to return')
});

type WebSearchInput = z.infer<typeof webSearchInputSchema>;

/**
 * Web Search Tool
 */
export const webSearchTool: ToolDefinition<WebSearchInput, WebSearchResult> = {
	description:
		'Search the web using DuckDuckGo (no API key required). Returns titles, URLs, and snippets for search results.',
	parameters: webSearchInputSchema,
	execute: async (input: WebSearchInput): Promise<WebSearchResult> => {
		const { query, maxResults = 10 } = input;
		const encodedQuery = encodeURIComponent(query);
		const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

		try {
			const response = await fetch(url, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (compatible; SnowflakeCortex/1.0)'
				}
			});

			if (!response.ok)
				throw new Error(`Search failed with status ${response.status}`);

			const html = await response.text();
			const results = parseDuckDuckGoResults(html, maxResults);

			return { query, results, totalResults: results.length };
		} catch {
			return { query, results: [], totalResults: 0 };
		}
	}
};

/**
 * Fetch URL Input Schema
 * Note: Using .default() without .optional() - Zod's .default() already handles undefined input
 */
export const fetchUrlInputSchema = z.object({
	url: z.string().url().describe('URL to fetch'),
	selector: z
		.string()
		.optional()
		.describe('CSS selector for specific content (supports #id and .class)'),
	maxLength: z
		.number()
		.default(10000)
		.describe('Maximum content length to return'),
	format: z
		.enum(['markdown', 'text'])
		.default('markdown')
		.describe('Output format')
});

type FetchUrlInput = z.infer<typeof fetchUrlInputSchema>;

/**
 * Fetch URL Tool
 */
export const fetchUrlTool: ToolDefinition<FetchUrlInput, FetchUrlResult> = {
	description:
		'Fetch URL content and convert HTML to markdown for compact context. Automatically removes scripts, styles, navigation, and other boilerplate.',
	parameters: fetchUrlInputSchema,
	execute: async (input: FetchUrlInput): Promise<FetchUrlResult> => {
		const { url, selector, maxLength = 10000, format = 'markdown' } = input;

		try {
			const response = await fetch(url, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (compatible; SnowflakeCortex/1.0)',
					Accept:
						'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
				}
			});

			if (!response.ok)
				throw new Error(`Fetch failed with status ${response.status}`);

			const html = await response.text();
			const title = extractTitle(html);
			const mainContent = extractMainContent(html, selector);

			let content: string;
			if (format === 'markdown') {
				content = htmlToMarkdown(mainContent);
			} else {
				content = mainContent
					.replace(/<[^>]+>/g, ' ')
					.replace(/\s+/g, ' ')
					.trim();
				content = decodeHtmlEntities(content);
			}

			if (content.length > maxLength) {
				content = content.slice(0, maxLength) + '\n\n[Content truncated...]';
			}

			return { url, title, content, contentLength: content.length, format };
		} catch (error) {
			return {
				url,
				title: 'Error',
				content: `Failed to fetch URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
				contentLength: 0,
				format
			};
		}
	}
};

export { webSearchTool as webSearch, fetchUrlTool as fetchUrl };
export default { webSearch: webSearchTool, fetchUrl: fetchUrlTool };
