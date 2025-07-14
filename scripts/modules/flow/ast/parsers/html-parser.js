/**
 * HTML Parser for AST Analysis
 * Parses HTML files and extracts structural information, inline scripts, and styles
 */

import * as cheerio from 'cheerio';
import { BaseParser } from './base-parser.js';

/**
 * HTML Parser Class
 * Extends BaseParser to provide HTML-specific analysis capabilities
 */
export class HtmlParser extends BaseParser {
	constructor() {
		super();
		this.name = 'html';
		this.extensions = ['.html', '.htm'];
	}

	/**
	 * Get supported file extensions
	 * @returns {Array} Array of supported extensions
	 */
	getSupportedExtensions() {
		return this.extensions;
	}

	/**
	 * Parse HTML content and extract analysis data
	 * @param {string} filePath - Path to the HTML file
	 * @param {string} content - HTML content to parse
	 * @returns {Object} Parse result with AST and analysis
	 */
	async parse(filePath, content) {
		try {
			// Ensure we have content
			if (!content || typeof content !== 'string') {
				return {
					success: false,
					error: 'HTML parsing failed: No content provided',
					language: 'html',
					filePath
				};
			}

			const $ = cheerio.load(content, {
				withStartIndices: true,
				withEndIndices: true
			});

			const analysis = {
				elements: this.extractElements($),
				inlineScripts: this.extractInlineScripts($),
				inlineStyles: this.extractInlineStyles($),
				externalResources: this.extractExternalResources($),
				accessibility: this.analyzeAccessibility($),
				performance: this.analyzePerformance($),
				seo: this.analyzeSeo($),
				complexity: this.calculateComplexity($)
			};

			return {
				success: true,
				ast: $.root()[0], // Raw cheerio AST
				analysis,
				language: 'html',
				filePath
			};
		} catch (error) {
			return {
				success: false,
				error: `HTML parsing failed: ${error.message}`,
				language: 'html',
				filePath
			};
		}
	}

	/**
	 * Extract all HTML elements with their attributes
	 * @param {Object} $ - Cheerio instance
	 * @returns {Array} Array of element objects
	 */
	extractElements($) {
		const elements = [];

		$('*').each((index, elem) => {
			const $elem = $(elem);
			const tagName = elem.tagName?.toLowerCase();

			if (tagName) {
				elements.push({
					tag: tagName,
					id: $elem.attr('id') || null,
					classes: $elem.attr('class')?.split(/\s+/).filter(Boolean) || [],
					attributes: this.getElementAttributes($elem),
					text: $elem.text()?.trim().substring(0, 100) || '', // First 100 chars
					hasChildren: $elem.children().length > 0,
					depth: this.getElementDepth($elem)
				});
			}
		});

		return elements;
	}

	/**
	 * Extract inline JavaScript from <script> tags
	 * @param {Object} $ - Cheerio instance
	 * @returns {Array} Array of inline script objects
	 */
	extractInlineScripts($) {
		const scripts = [];

		$('script:not([src])').each((index, elem) => {
			const $elem = $(elem);
			const content = $elem.html();

			if (content && content.trim()) {
				scripts.push({
					content: content.trim(),
					type: $elem.attr('type') || 'text/javascript',
					async: $elem.attr('async') !== undefined,
					defer: $elem.attr('defer') !== undefined,
					lineEstimate: this.estimateLineNumber(content, index),
					size: content.length
				});
			}
		});

		return scripts;
	}

	/**
	 * Extract inline CSS from <style> tags and style attributes
	 * @param {Object} $ - Cheerio instance
	 * @returns {Array} Array of inline style objects
	 */
	extractInlineStyles($) {
		const styles = [];

		// Extract <style> tags
		$('style').each((index, elem) => {
			const $elem = $(elem);
			const content = $elem.html();

			if (content && content.trim()) {
				styles.push({
					type: 'style-tag',
					content: content.trim(),
					media: $elem.attr('media') || 'all',
					scoped: $elem.attr('scoped') !== undefined,
					lineEstimate: this.estimateLineNumber(content, index),
					size: content.length
				});
			}
		});

		// Extract inline style attributes
		$('[style]').each((index, elem) => {
			const $elem = $(elem);
			const styleAttr = $elem.attr('style');

			if (styleAttr && styleAttr.trim()) {
				styles.push({
					type: 'inline-attribute',
					content: styleAttr.trim(),
					element: elem.tagName?.toLowerCase(),
					elementId: $elem.attr('id') || null,
					elementClasses:
						$elem.attr('class')?.split(/\s+/).filter(Boolean) || [],
					size: styleAttr.length
				});
			}
		});

		return styles;
	}

	/**
	 * Extract external resource references (CSS, JS, images, etc.)
	 * @param {Object} $ - Cheerio instance
	 * @returns {Object} Object containing categorized external resources
	 */
	extractExternalResources($) {
		const resources = {
			stylesheets: [],
			scripts: [],
			images: [],
			fonts: [],
			other: []
		};

		// CSS files
		$('link[rel="stylesheet"], link[rel="preload"][as="style"]').each(
			(index, elem) => {
				const $elem = $(elem);
				resources.stylesheets.push({
					href: $elem.attr('href'),
					media: $elem.attr('media') || 'all',
					preload: $elem.attr('rel') === 'preload'
				});
			}
		);

		// JavaScript files
		$('script[src]').each((index, elem) => {
			const $elem = $(elem);
			resources.scripts.push({
				src: $elem.attr('src'),
				type: $elem.attr('type') || 'text/javascript',
				async: $elem.attr('async') !== undefined,
				defer: $elem.attr('defer') !== undefined,
				module: $elem.attr('type') === 'module'
			});
		});

		// Images
		$('img, picture source, video, audio').each((index, elem) => {
			const $elem = $(elem);
			const src = $elem.attr('src') || $elem.attr('srcset');
			if (src) {
				resources.images.push({
					src,
					alt: $elem.attr('alt') || '',
					tag: elem.tagName?.toLowerCase(),
					loading: $elem.attr('loading') || 'eager'
				});
			}
		});

		// Fonts
		$('link[rel="preload"][as="font"], link[rel="prefetch"][as="font"]').each(
			(index, elem) => {
				const $elem = $(elem);
				resources.fonts.push({
					href: $elem.attr('href'),
					type: $elem.attr('type') || 'font/woff2'
				});
			}
		);

		return resources;
	}

	/**
	 * Analyze accessibility features
	 * @param {Object} $ - Cheerio instance
	 * @returns {Object} Accessibility analysis
	 */
	analyzeAccessibility($) {
		const analysis = {
			hasLang: $('html[lang]').length > 0,
			hasTitle: $('title').length > 0,
			imagesWithoutAlt: $('img:not([alt])').length,
			linksWithoutText: $('a:not([aria-label]):empty').length,
			headingStructure: this.analyzeHeadingStructure($),
			formLabels: this.analyzeFormLabels($),
			landmarks: this.analyzeLandmarks($)
		};

		// Calculate accessibility score (0-100)
		let score = 100;
		if (!analysis.hasLang) score -= 10;
		if (!analysis.hasTitle) score -= 10;
		score -= Math.min(analysis.imagesWithoutAlt * 5, 30);
		score -= Math.min(analysis.linksWithoutText * 3, 20);

		analysis.score = Math.max(0, score);
		return analysis;
	}

	/**
	 * Analyze performance-related aspects
	 * @param {Object} $ - Cheerio instance
	 * @returns {Object} Performance analysis
	 */
	analyzePerformance($) {
		const inlineScripts = $('script:not([src])').length;
		const inlineStyles = $('style').length + $('[style]').length;
		const externalScripts = $('script[src]').length;
		const externalStyles = $('link[rel="stylesheet"]').length;
		const images = $('img').length;

		return {
			inlineScripts,
			inlineStyles,
			externalScripts,
			externalStyles,
			images,
			hasAsyncScripts: $('script[async]').length > 0,
			hasDeferScripts: $('script[defer]').length > 0,
			hasLazyImages: $('img[loading="lazy"]').length > 0,
			recommendations: this.generatePerformanceRecommendations({
				inlineScripts,
				inlineStyles,
				externalScripts,
				externalStyles
			})
		};
	}

	/**
	 * Analyze SEO-related aspects
	 * @param {Object} $ - Cheerio instance
	 * @returns {Object} SEO analysis
	 */
	analyzeSeo($) {
		return {
			hasTitle: $('title').length > 0,
			titleLength: $('title').text().length,
			hasMetaDescription: $('meta[name="description"]').length > 0,
			hasMetaKeywords: $('meta[name="keywords"]').length > 0,
			hasCanonical: $('link[rel="canonical"]').length > 0,
			hasOpenGraph: $('meta[property^="og:"]').length > 0,
			hasTwitterCard: $('meta[name^="twitter:"]').length > 0,
			headingCount: this.getHeadingCount($),
			hasStructuredData: $('script[type="application/ld+json"]').length > 0
		};
	}

	/**
	 * Calculate HTML complexity score
	 * @param {Object} $ - Cheerio instance
	 * @returns {number} Complexity score (1-10)
	 */
	calculateComplexity($) {
		const elementCount = $('*').length;
		const nestingDepth = this.getMaxNestingDepth($);
		const inlineScripts = $('script:not([src])').length;
		const inlineStyles = $('style').length + $('[style]').length;

		// Base complexity on structure
		let complexity = 1;

		// Add complexity for element count
		if (elementCount > 100) complexity += 2;
		else if (elementCount > 50) complexity += 1;

		// Add complexity for nesting depth
		if (nestingDepth > 8) complexity += 2;
		else if (nestingDepth > 5) complexity += 1;

		// Add complexity for inline code
		complexity += Math.min(inlineScripts * 0.5, 2);
		complexity += Math.min(inlineStyles * 0.3, 1);

		return Math.min(Math.round(complexity), 10);
	}

	// Helper methods
	getElementAttributes($elem) {
		const attrs = {};
		if ($elem[0] && $elem[0].attribs) {
			Object.assign(attrs, $elem[0].attribs);
		}
		return attrs;
	}

	getElementDepth($elem) {
		let depth = 0;
		let current = $elem.parent();
		while (current.length && current[0].tagName) {
			depth++;
			current = current.parent();
		}
		return depth;
	}

	getMaxNestingDepth($) {
		let maxDepth = 0;
		$('*').each((index, elem) => {
			const depth = this.getElementDepth($(elem));
			maxDepth = Math.max(maxDepth, depth);
		});
		return maxDepth;
	}

	analyzeHeadingStructure($) {
		const headings = [];
		$('h1, h2, h3, h4, h5, h6').each((index, elem) => {
			headings.push({
				level: parseInt(elem.tagName.substring(1)),
				text: $(elem).text().trim()
			});
		});
		return headings;
	}

	analyzeFormLabels($) {
		const inputs = $('input, select, textarea').length;
		const labels = $('label').length;
		const ariaLabels = $('[aria-label]').length;
		return { inputs, labels, ariaLabels };
	}

	analyzeLandmarks($) {
		return {
			nav: $('nav, [role="navigation"]').length,
			main: $('main, [role="main"]').length,
			aside: $('aside, [role="complementary"]').length,
			header: $('header, [role="banner"]').length,
			footer: $('footer, [role="contentinfo"]').length
		};
	}

	getHeadingCount($) {
		return {
			h1: $('h1').length,
			h2: $('h2').length,
			h3: $('h3').length,
			h4: $('h4').length,
			h5: $('h5').length,
			h6: $('h6').length
		};
	}

	generatePerformanceRecommendations(metrics) {
		const recommendations = [];

		if (metrics.inlineScripts > 3) {
			recommendations.push('Consider moving inline scripts to external files');
		}
		if (metrics.inlineStyles > 5) {
			recommendations.push(
				'Consider moving inline styles to external CSS files'
			);
		}
		if (metrics.externalScripts > 5) {
			recommendations.push(
				'Consider bundling JavaScript files to reduce HTTP requests'
			);
		}

		return recommendations;
	}

	estimateLineNumber(content, index) {
		// Simple estimation - count newlines before this element
		const lines = content.split('\n').length;
		return Math.max(1, index * 2 + lines); // Rough estimate
	}
}
