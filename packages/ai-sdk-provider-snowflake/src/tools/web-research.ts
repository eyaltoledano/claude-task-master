/**
 * Web Research Tools - No API Key Required
 * DuckDuckGo search and URL fetching with HTML-to-Markdown conversion
 */

import TurndownService from 'turndown';
import { z } from 'zod';
import type { SearchResult, WebSearchResult, FetchUrlResult, ToolDefinition } from './types.js';

/** Constants */
const USER_AGENT = 'Mozilla/5.0 (compatible; WebResearch/1.0)';
const FETCH_TIMEOUT = 10000;
const DEFAULT_MAX_RESULTS = 10;
const DEFAULT_MAX_LENGTH = 10000;

/** Turndown service for HTML to Markdown conversion */
const turndown = new TurndownService({
	headingStyle: 'atx',
	codeBlockStyle: 'fenced',
	bulletListMarker: '-'
});

/** Decode numeric HTML entities (Turndown handles named entities) */
const decodeEntities = (text: string) => text
	.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
	.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
	.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

	try {
		const response = await fetch(url, {
			...options,
			signal: controller.signal,
			headers: { 'User-Agent': USER_AGENT, ...options.headers }
		});
		return response;
	} finally {
		clearTimeout(timeout);
	}
}

/**
 * Parse DuckDuckGo HTML search results
 */
function parseDuckDuckGoResults(html: string, maxResults: number): SearchResult[] {
	const results: SearchResult[] = [];

	// Primary pattern for DuckDuckGo results
	const resultPattern = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([^<]+)<\/a>/gi;

	let match;
	while ((match = resultPattern.exec(html)) !== null && results.length < maxResults) {
		const [, url, title, snippet] = match;
		if (url && title) {
			results.push({
				url: url.startsWith('//') ? `https:${url}` : url,
				title: decodeEntities(title.trim()),
				snippet: decodeEntities(snippet?.trim() || '')
			});
		}
	}

	// Fallback: extract any external links
	if (results.length === 0) {
		const linkPattern = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
		while ((match = linkPattern.exec(html)) !== null && results.length < maxResults) {
			const [, url, title] = match;
			if (url && title && !url.includes('duckduckgo.com')) {
				results.push({ url, title: decodeEntities(title.trim()), snippet: '' });
			}
		}
	}

	return results;
}

/**
 * Extract main content from HTML, removing boilerplate
 */
function extractMainContent(html: string, selector?: string): string {
	// Remove non-content elements
	let content = html
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
		.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
		.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
		.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
		.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
		.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
		.replace(/<!--[\s\S]*?-->/g, '');

	// Apply CSS selector if provided
	if (selector) {
		const escaped = selector.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const pattern = selector.startsWith('#')
			? new RegExp(`<[^>]*id=["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/`, 'i')
			: new RegExp(`<[^>]*class=["'][^"']*${escaped}[^"']*["'][^>]*>([\\s\\S]*?)<\\/`, 'i');
		const match = content.match(pattern);
		if (match) content = match[1];
	}

	// Try to find main content area
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
 * Extract page title from HTML
 */
function extractTitle(html: string): string {
	const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
	if (titleMatch) return decodeEntities(titleMatch[1].trim());

	const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
	if (h1Match) return decodeEntities(h1Match[1].trim());

	return 'Untitled';
}

// Input Schemas
export const webSearchInputSchema = z.object({
	query: z.string().describe('Search query'),
	maxResults: z.number().default(DEFAULT_MAX_RESULTS).describe('Maximum number of results')
});

export const fetchUrlInputSchema = z.object({
	url: z.string().url().describe('URL to fetch'),
	selector: z.string().optional().describe('CSS selector (#id or .class)'),
	maxLength: z.number().default(DEFAULT_MAX_LENGTH).describe('Maximum content length'),
	format: z.enum(['markdown', 'text']).default('markdown').describe('Output format')
});

type WebSearchInput = z.infer<typeof webSearchInputSchema>;
type FetchUrlInput = z.infer<typeof fetchUrlInputSchema>;

/**
 * Web Search Tool
 */
export const webSearchTool: ToolDefinition<WebSearchInput, WebSearchResult> = {
	description: 'Search the web using DuckDuckGo (no API key required).',
	parameters: webSearchInputSchema,
	execute: async (input: WebSearchInput): Promise<WebSearchResult> => {
		const { query, maxResults = DEFAULT_MAX_RESULTS } = input;

		try {
			const response = await fetchWithTimeout(
				`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
			);

			if (!response.ok) {
				return { query, results: [], totalResults: 0, error: `Search failed: ${response.status}` };
			}

			const html = await response.text();
			const results = parseDuckDuckGoResults(html, maxResults);

			return { query, results, totalResults: results.length };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return { query, results: [], totalResults: 0, error: message };
		}
	}
};

/**
 * Fetch URL Tool
 */
export const fetchUrlTool: ToolDefinition<FetchUrlInput, FetchUrlResult> = {
	description: 'Fetch URL and convert to markdown. Removes scripts, styles, and navigation.',
	parameters: fetchUrlInputSchema,
	execute: async (input: FetchUrlInput): Promise<FetchUrlResult> => {
		const { url, selector, maxLength = DEFAULT_MAX_LENGTH, format = 'markdown' } = input;

		try {
			const response = await fetchWithTimeout(url, {
				headers: { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
			});

		if (!response.ok) {
			const content = `Fetch failed: ${response.status}`;
			return { url, title: 'Error', content, contentLength: content.length, format };
		}

		// Verify content type
		const contentType = response.headers.get('content-type') || '';
		if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
			const content = `Not HTML: ${contentType}`;
			return { url, title: 'Error', content, contentLength: content.length, format };
		}

			const html = await response.text();
			const title = extractTitle(html);
			const mainContent = extractMainContent(html, selector);

			let content = format === 'markdown'
				? turndown.turndown(mainContent)
				: decodeEntities(mainContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

			// Clean up excessive whitespace
			content = content.replace(/\n{3,}/g, '\n\n').trim();

			if (content.length > maxLength) {
				content = content.slice(0, maxLength) + '\n\n[Content truncated...]';
			}

		return { url, title, content, contentLength: content.length, format };
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		const content = `Failed: ${message}`;
		return { url, title: 'Error', content, contentLength: content.length, format };
	}
	}
};

export { webSearchTool as webSearch, fetchUrlTool as fetchUrl };
export default { webSearch: webSearchTool, fetchUrl: fetchUrlTool };
