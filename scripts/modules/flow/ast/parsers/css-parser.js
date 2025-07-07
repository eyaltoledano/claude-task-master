/**
 * CSS Parser for AST Analysis
 * Parses CSS files and extracts styling information, rules, and properties
 */

import postcss from 'postcss';
import postcssScss from 'postcss-scss';
import { BaseParser } from './base-parser.js';

/**
 * CSS Parser Class
 * Extends BaseParser to provide CSS-specific analysis capabilities
 */
export class CssParser extends BaseParser {
	constructor() {
		super();
		this.name = 'css';
		this.extensions = ['.css', '.scss', '.sass', '.less'];
	}

	/**
	 * Parse CSS content and extract analysis data
	 * @param {string} filePath - Path to the CSS file
	 * @param {string} content - CSS content to parse
	 * @returns {Object} Parse result with AST and analysis
	 */
	async parse(filePath, content) {
		try {
			// Ensure we have content
			if (!content || typeof content !== 'string') {
				return {
					success: false,
					error: 'CSS parsing failed: No content provided',
					language: 'css',
					filePath
				};
			}

			// Determine parser based on file extension
			const parser = this.getParserForFile(filePath);
			const ast = postcss.parse(content, { 
				parser,
				from: filePath  // This helps PostCSS understand the source
			});

			const analysis = {
				rules: this.extractRules(ast),
				selectors: this.extractSelectors(ast),
				properties: this.extractProperties(ast),
				mediaQueries: this.extractMediaQueries(ast),
				variables: this.extractVariables(ast),
				atRules: this.extractAtRules(ast),
				colors: this.extractColors(ast),
				fonts: this.extractFonts(ast),
				metrics: this.calculateMetrics(ast),
				complexity: this.calculateComplexity(ast),
				quality: this.analyzeQuality(ast)
			};

			return {
				success: true,
				ast,
				analysis,
				language: 'css',
				filePath
			};
		} catch (error) {
			return {
				success: false,
				error: `CSS parsing failed: ${error.message}`,
				language: 'css',
				filePath
			};
		}
	}

	/**
	 * Get appropriate parser for file type
	 * @param {string} filePath - Path to the file
	 * @returns {Object|null} PostCSS parser or null for regular CSS
	 */
	getParserForFile(filePath) {
		if (filePath.endsWith('.scss') || filePath.endsWith('.sass')) {
			return postcssScss;
		}
		// Add other parsers as needed (LESS, etc.)
		return null; // Default CSS parser
	}

	/**
	 * Extract CSS rules with their selectors and declarations
	 * @param {Object} ast - PostCSS AST
	 * @returns {Array} Array of rule objects
	 */
	extractRules(ast) {
		const rules = [];
		
		ast.walkRules(rule => {
			const declarations = [];
			rule.walkDecls(decl => {
				declarations.push({
					property: decl.prop,
					value: decl.value,
					important: decl.important,
					line: decl.source?.start?.line || 0
				});
			});

			rules.push({
				selector: rule.selector,
				declarations,
				declarationCount: declarations.length,
				line: rule.source?.start?.line || 0,
				specificity: this.calculateSpecificity(rule.selector),
				hasNestedRules: this.hasNestedRules(rule)
			});
		});

		return rules;
	}

	/**
	 * Extract and analyze CSS selectors
	 * @param {Object} ast - PostCSS AST
	 * @returns {Object} Selector analysis
	 */
	extractSelectors(ast) {
		const selectors = new Set();
		const selectorTypes = {
			id: 0,
			class: 0,
			element: 0,
			attribute: 0,
			pseudo: 0,
			universal: 0
		};

		ast.walkRules(rule => {
			selectors.add(rule.selector);
			this.categorizeSelector(rule.selector, selectorTypes);
		});

		return {
			unique: Array.from(selectors),
			count: selectors.size,
			types: selectorTypes,
			averageSpecificity: this.calculateAverageSpecificity(Array.from(selectors))
		};
	}

	/**
	 * Extract CSS properties and their usage
	 * @param {Object} ast - PostCSS AST
	 * @returns {Object} Property analysis
	 */
	extractProperties(ast) {
		const properties = new Map();
		const values = new Map();

		ast.walkDecls(decl => {
			// Count property usage
			const propCount = properties.get(decl.prop) || 0;
			properties.set(decl.prop, propCount + 1);

			// Track unique values
			const propValues = values.get(decl.prop) || new Set();
			propValues.add(decl.value);
			values.set(decl.prop, propValues);
		});

		// Convert to analysis object
		const propertyAnalysis = {};
		for (const [prop, count] of properties) {
			propertyAnalysis[prop] = {
				count,
				uniqueValues: Array.from(values.get(prop) || []),
				valueCount: values.get(prop)?.size || 0
			};
		}

		return {
			properties: propertyAnalysis,
			totalProperties: properties.size,
			mostUsed: this.getMostUsedProperties(properties),
			layoutProperties: this.getLayoutProperties(properties),
			colorProperties: this.getColorProperties(properties)
		};
	}

	/**
	 * Extract media queries and responsive design patterns
	 * @param {Object} ast - PostCSS AST
	 * @returns {Array} Array of media query objects
	 */
	extractMediaQueries(ast) {
		const mediaQueries = [];

		ast.walkAtRules('media', rule => {
			const rulesInside = [];
			rule.walkRules(innerRule => {
				rulesInside.push({
					selector: innerRule.selector,
					declarationCount: innerRule.nodes.filter(n => n.type === 'decl').length
				});
			});

			mediaQueries.push({
				params: rule.params,
				rulesCount: rulesInside.length,
				rules: rulesInside,
				line: rule.source?.start?.line || 0,
				breakpoint: this.parseBreakpoint(rule.params)
			});
		});

		return mediaQueries;
	}

	/**
	 * Extract CSS variables (custom properties)
	 * @param {Object} ast - PostCSS AST
	 * @returns {Object} Variable analysis
	 */
	extractVariables(ast) {
		const variables = new Map();
		const usage = new Map();

		// Find variable declarations
		ast.walkDecls(decl => {
			if (decl.prop.startsWith('--')) {
				variables.set(decl.prop, {
					value: decl.value,
					line: decl.source?.start?.line || 0
				});
			}
			
			// Find variable usage
			if (decl.value.includes('var(')) {
				const matches = decl.value.match(/var\((--[^,)]+)/g) || [];
				matches.forEach(match => {
					const varName = match.substring(4); // Remove 'var('
					const count = usage.get(varName) || 0;
					usage.set(varName, count + 1);
				});
			}
		});

		return {
			declared: Object.fromEntries(variables),
			usage: Object.fromEntries(usage),
			declaredCount: variables.size,
			usageCount: usage.size,
			unusedVariables: this.findUnusedVariables(variables, usage)
		};
	}

	/**
	 * Extract at-rules (import, keyframes, font-face, etc.)
	 * @param {Object} ast - PostCSS AST
	 * @returns {Object} At-rule analysis
	 */
	extractAtRules(ast) {
		const atRules = {};

		ast.walkAtRules(rule => {
			const ruleName = rule.name;
			if (!atRules[ruleName]) {
				atRules[ruleName] = [];
			}

			atRules[ruleName].push({
				params: rule.params,
				line: rule.source?.start?.line || 0,
				hasNestedRules: rule.nodes?.some(n => n.type === 'rule') || false
			});
		});

		return atRules;
	}

	/**
	 * Extract color values and analyze color usage
	 * @param {Object} ast - PostCSS AST
	 * @returns {Object} Color analysis
	 */
	extractColors(ast) {
		const colors = new Set();
		const colorFormats = { hex: 0, rgb: 0, hsl: 0, named: 0, custom: 0 };

		ast.walkDecls(decl => {
			if (this.isColorProperty(decl.prop)) {
				const colorValues = this.extractColorValues(decl.value);
				colorValues.forEach(color => {
					colors.add(color.value);
					colorFormats[color.format]++;
				});
			}
		});

		return {
			unique: Array.from(colors),
			count: colors.size,
			formats: colorFormats,
			palette: this.analyzePalette(Array.from(colors))
		};
	}

	/**
	 * Extract font-related properties
	 * @param {Object} ast - PostCSS AST
	 * @returns {Object} Font analysis
	 */
	extractFonts(ast) {
		const fontFamilies = new Set();
		const fontSizes = new Set();
		const fontWeights = new Set();

		ast.walkDecls(decl => {
			switch (decl.prop) {
				case 'font-family':
					this.parseFontFamily(decl.value).forEach(font => fontFamilies.add(font));
					break;
				case 'font-size':
					fontSizes.add(decl.value);
					break;
				case 'font-weight':
					fontWeights.add(decl.value);
					break;
				case 'font': {
					// Parse shorthand font property
					const parsed = this.parseShorthandFont(decl.value);
					if (parsed.family) fontFamilies.add(parsed.family);
					if (parsed.size) fontSizes.add(parsed.size);
					if (parsed.weight) fontWeights.add(parsed.weight);
					break;
				}
			}
		});

		return {
			families: Array.from(fontFamilies),
			sizes: Array.from(fontSizes),
			weights: Array.from(fontWeights),
			typescale: this.analyzeTypeScale(Array.from(fontSizes))
		};
	}

	/**
	 * Calculate CSS metrics
	 * @param {Object} ast - PostCSS AST
	 * @returns {Object} CSS metrics
	 */
	calculateMetrics(ast) {
		let ruleCount = 0;
		let declarationCount = 0;
		let selectorCount = 0;

		ast.walkRules(rule => {
			ruleCount++;
			selectorCount += rule.selector.split(',').length;
			rule.walkDecls(() => declarationCount++);
		});

		return {
			rules: ruleCount,
			declarations: declarationCount,
			selectors: selectorCount,
			averageDeclarationsPerRule: ruleCount > 0 ? Math.round(declarationCount / ruleCount * 100) / 100 : 0,
			averageSelectorsPerRule: ruleCount > 0 ? Math.round(selectorCount / ruleCount * 100) / 100 : 0
		};
	}

	/**
	 * Calculate CSS complexity score
	 * @param {Object} ast - PostCSS AST
	 * @returns {number} Complexity score (1-10)
	 */
	calculateComplexity(ast) {
		const metrics = this.calculateMetrics(ast);
		let complexity = 1;

		// Factor in number of rules
		if (metrics.rules > 200) complexity += 3;
		else if (metrics.rules > 100) complexity += 2;
		else if (metrics.rules > 50) complexity += 1;

		// Factor in selector complexity
		if (metrics.averageSelectorsPerRule > 3) complexity += 2;
		else if (metrics.averageSelectorsPerRule > 2) complexity += 1;

		// Factor in nesting depth (for SCSS)
		const maxNesting = this.calculateMaxNestingDepth(ast);
		if (maxNesting > 4) complexity += 2;
		else if (maxNesting > 3) complexity += 1;

		// Factor in at-rules
		let atRuleCount = 0;
		ast.walkAtRules(() => atRuleCount++);
		if (atRuleCount > 10) complexity += 1;

		return Math.min(Math.round(complexity), 10);
	}

	/**
	 * Analyze CSS quality and potential issues
	 * @param {Object} ast - PostCSS AST
	 * @returns {Object} Quality analysis
	 */
	analyzeQuality(ast) {
		const issues = [];
		const warnings = [];
		const duplicateSelectors = this.findDuplicateSelectors(ast);
		const unusedVariables = this.extractVariables(ast).unusedVariables;

		if (duplicateSelectors.length > 0) {
			issues.push(`Found ${duplicateSelectors.length} duplicate selectors`);
		}

		if (unusedVariables.length > 0) {
			warnings.push(`Found ${unusedVariables.length} unused CSS variables`);
		}

		const importantCount = this.countImportantDeclarations(ast);
		if (importantCount > 5) {
			warnings.push(`High usage of !important (${importantCount} times)`);
		}

		return {
			issues,
			warnings,
			score: this.calculateQualityScore(issues, warnings),
			duplicateSelectors,
			unusedVariables,
			importantUsage: importantCount
		};
	}

	// Helper methods
	calculateSpecificity(selector) {
		// Simplified specificity calculation
		const ids = (selector.match(/#/g) || []).length;
		const classes = (selector.match(/\./g) || []).length;
		const elements = (selector.match(/[a-zA-Z]/g) || []).length - classes;
		return ids * 100 + classes * 10 + elements;
	}

	calculateAverageSpecificity(selectors) {
		if (selectors.length === 0) return 0;
		const total = selectors.reduce((sum, sel) => sum + this.calculateSpecificity(sel), 0);
		return Math.round(total / selectors.length * 100) / 100;
	}

	hasNestedRules(rule) {
		return rule.nodes?.some(node => node.type === 'rule') || false;
	}

	categorizeSelector(selector, types) {
		if (selector.includes('#')) types.id++;
		if (selector.includes('.')) types.class++;
		if (selector.includes('[')) types.attribute++;
		if (selector.includes(':')) types.pseudo++;
		if (selector.includes('*')) types.universal++;
		if (/^[a-zA-Z]/.test(selector)) types.element++;
	}

	getMostUsedProperties(properties) {
		return Array.from(properties.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([prop, count]) => ({ property: prop, count }));
	}

	getLayoutProperties(properties) {
		const layoutProps = ['display', 'position', 'float', 'clear', 'flex', 'grid'];
		return layoutProps.filter(prop => properties.has(prop));
	}

	getColorProperties(properties) {
		const colorProps = ['color', 'background-color', 'border-color', 'outline-color'];
		return colorProps.filter(prop => properties.has(prop));
	}

	parseBreakpoint(params) {
		// Simple breakpoint parsing
		const match = params.match(/\(.*?width:\s*(\d+)px\)/);
		return match ? parseInt(match[1]) : null;
	}

	findUnusedVariables(variables, usage) {
		return Array.from(variables.keys()).filter(varName => !usage.has(varName));
	}

	isColorProperty(prop) {
		return ['color', 'background-color', 'border-color', 'outline-color', 'fill', 'stroke'].includes(prop);
	}

	extractColorValues(value) {
		const colors = [];
		// Hex colors
		const hexMatches = value.match(/#[0-9a-fA-F]{3,8}/g) || [];
		hexMatches.forEach(hex => colors.push({ value: hex, format: 'hex' }));

		// RGB colors
		const rgbMatches = value.match(/rgba?\([^)]+\)/g) || [];
		rgbMatches.forEach(rgb => colors.push({ value: rgb, format: 'rgb' }));

		// HSL colors
		const hslMatches = value.match(/hsla?\([^)]+\)/g) || [];
		hslMatches.forEach(hsl => colors.push({ value: hsl, format: 'hsl' }));

		return colors;
	}

	analyzePalette(colors) {
		return {
			primary: colors.slice(0, 5), // First 5 colors as primary palette
			count: colors.length
		};
	}

	parseFontFamily(value) {
		return value.split(',').map(font => font.trim().replace(/['"]/g, ''));
	}

	parseShorthandFont(value) {
		// Very simplified font shorthand parsing
		const parts = value.split(' ');
		return {
			family: parts[parts.length - 1]?.replace(/['"]/g, ''),
			size: parts.find(part => part.includes('px') || part.includes('em') || part.includes('rem')),
			weight: parts.find(part => ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'].includes(part))
		};
	}

	analyzeTypeScale(sizes) {
		const numericSizes = sizes
			.filter(size => size.includes('px') || size.includes('rem') || size.includes('em'))
			.map(size => parseFloat(size))
			.filter(size => !Number.isNaN(size))
			.sort((a, b) => a - b);

		return {
			range: numericSizes.length > 0 ? `${numericSizes[0]} - ${numericSizes[numericSizes.length - 1]}` : 'N/A',
			steps: numericSizes.length,
			sizes: numericSizes
		};
	}

	calculateMaxNestingDepth(ast, currentDepth = 0) {
		let maxDepth = currentDepth;
		
		ast.walkRules(rule => {
			rule.walkRules(nestedRule => {
				const depth = this.calculateMaxNestingDepth(nestedRule, currentDepth + 1);
				maxDepth = Math.max(maxDepth, depth);
			});
		});

		return maxDepth;
	}

	findDuplicateSelectors(ast) {
		const selectors = new Map();
		const duplicates = [];

		ast.walkRules(rule => {
			if (selectors.has(rule.selector)) {
				duplicates.push(rule.selector);
			} else {
				selectors.set(rule.selector, true);
			}
		});

		return [...new Set(duplicates)];
	}

	countImportantDeclarations(ast) {
		let count = 0;
		ast.walkDecls(decl => {
			if (decl.important) count++;
		});
		return count;
	}

	calculateQualityScore(issues, warnings) {
		let score = 100;
		score -= issues.length * 10;
		score -= warnings.length * 5;
		return Math.max(0, score);
	}

	/**
	 * Get supported file extensions
	 * @returns {Array} Array of supported extensions
	 */
	getSupportedExtensions() {
		return this.extensions;
	}
} 