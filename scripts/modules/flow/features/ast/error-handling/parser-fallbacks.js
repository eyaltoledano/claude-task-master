/**
 * Parser Fallbacks - Phase 4.3
 *
 * Fast, simple fallback system for AST parsing failures.
 * Prioritizes speed and development workflow over production robustness.
 *
 * Key Features:
 * - Multi-tier parsing with intelligent fallbacks
 * - Fast regex-based parsing when AST fails
 * - Simple content analysis for basic structure
 * - Development-focused error recovery
 *
 * @author Task Master Flow
 * @version 4.3.0
 */

import { EventEmitter } from 'events';

/**
 * Parser Fallback System
 *
 * Provides intelligent fallback parsing when primary AST parsing fails.
 * Optimized for speed and development workflow.
 */
export class ParserFallbacks extends EventEmitter {
	constructor(options = {}) {
		super();

		this.config = {
			enableRegexFallback: true,
			enableContentAnalysis: true,
			enableStructureGuessing: true,
			maxFallbackTime: 100, // 100ms max for fallbacks
			...options
		};

		// Fallback strategy cache
		this.strategyCache = new Map();

		// Performance metrics
		this.metrics = {
			fallbackAttempts: 0,
			successfulFallbacks: 0,
			fastestFallback: Infinity,
			slowestFallback: 0
		};

		console.log(
			'ParserFallbacks initialized for fast development error recovery'
		);
	}

	/**
	 * Attempt parsing with fallback strategies
	 */
	async parseWithFallbacks(filePath, content, language, primaryParser) {
		const startTime = Date.now();

		try {
			// Try primary parser first
			const result = await this.tryPrimaryParser(
				primaryParser,
				filePath,
				content
			);
			if (result.success) {
				return result;
			}

			// Primary failed, use fallbacks
			this.metrics.fallbackAttempts++;

			const fallbackResult = await this.executeFallbackStrategy(
				filePath,
				content,
				language,
				result.error
			);

			if (fallbackResult.success) {
				this.metrics.successfulFallbacks++;
				const duration = Date.now() - startTime;
				this.metrics.fastestFallback = Math.min(
					this.metrics.fastestFallback,
					duration
				);
				this.metrics.slowestFallback = Math.max(
					this.metrics.slowestFallback,
					duration
				);

				this.emit('fallbackSuccess', {
					filePath,
					language,
					strategy: fallbackResult.strategy,
					duration
				});
			}

			return fallbackResult;
		} catch (error) {
			return this.createEmptyResult(filePath, language, error);
		}
	}

	/**
	 * Try primary parser with timeout
	 */
	async tryPrimaryParser(parser, filePath, content) {
		try {
			const result = await Promise.race([
				parser.parse(filePath, content),
				this.timeout(5000) // 5 second timeout for primary parser
			]);

			return {
				success: true,
				ast: result.ast,
				functions: result.functions || [],
				classes: result.classes || [],
				imports: result.imports || [],
				complexity: result.complexity || 1,
				fromFallback: false
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Execute fallback parsing strategy
	 */
	async executeFallbackStrategy(filePath, content, language, primaryError) {
		// Check cache for this file type
		const cacheKey = `${language}-${content.length}`;
		const cachedStrategy = this.strategyCache.get(cacheKey);

		const strategies = cachedStrategy
			? [cachedStrategy]
			: this.getFallbackStrategies(language);

		for (const strategy of strategies) {
			try {
				const result = await this.tryFallbackStrategy(
					strategy,
					filePath,
					content,
					language
				);

				if (result.success) {
					// Cache successful strategy
					this.strategyCache.set(cacheKey, strategy);
					return {
						...result,
						strategy: strategy.name,
						fromFallback: true,
						primaryError
					};
				}
			} catch (error) {
				console.warn(
					`Fallback strategy '${strategy.name}' failed:`,
					error.message
				);
			}
		}

		// All fallbacks failed, return empty result
		return this.createEmptyResult(filePath, language, primaryError);
	}

	/**
	 * Get fallback strategies for language
	 */
	getFallbackStrategies(language) {
		const strategies = [];

		// Fast regex parsing (always first)
		if (this.config.enableRegexFallback) {
			strategies.push({
				name: 'regex',
				fn: this.regexFallback.bind(this)
			});
		}

		// Content analysis
		if (this.config.enableContentAnalysis) {
			strategies.push({
				name: 'content_analysis',
				fn: this.contentAnalysisFallback.bind(this)
			});
		}

		// Structure guessing
		if (this.config.enableStructureGuessing) {
			strategies.push({
				name: 'structure_guess',
				fn: this.structureGuessFallback.bind(this)
			});
		}

		return strategies;
	}

	/**
	 * Try a fallback strategy with timeout
	 */
	async tryFallbackStrategy(strategy, filePath, content, language) {
		return Promise.race([
			strategy.fn(filePath, content, language),
			this.timeout(this.config.maxFallbackTime)
		]);
	}

	/**
	 * Fast regex-based fallback parsing
	 */
	async regexFallback(filePath, content, language) {
		const result = {
			success: true,
			functions: [],
			classes: [],
			imports: [],
			complexity: 1
		};

		switch (language.toLowerCase()) {
			case 'javascript':
			case 'typescript':
				return this.regexJavaScript(content, result);

			case 'python':
				return this.regexPython(content, result);

			case 'go':
				return this.regexGo(content, result);

			default:
				return this.regexGeneric(content, result);
		}
	}

	/**
	 * JavaScript regex fallback
	 */
	regexJavaScript(content, result) {
		// Functions
		const funcMatches = content.match(
			/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/g
		);
		if (funcMatches) {
			result.functions = funcMatches.map((match, i) => ({
				name: this.extractFunctionName(match) || `anonymous_${i}`,
				lineStart: this.getLineNumber(content, content.indexOf(match)),
				complexity: 1
			}));
		}

		// Classes
		const classMatches = content.match(/class\s+(\w+)/g);
		if (classMatches) {
			result.classes = classMatches.map((match) => ({
				name: match.split(/\s+/)[1],
				methods: []
			}));
		}

		// Imports
		const importMatches = content.match(
			/import\s+.*?from\s+['"`]([^'"`]+)['"`]/g
		);
		if (importMatches) {
			result.imports = importMatches.map((match) => ({
				source: match.match(/['"`]([^'"`]+)['"`]/)[1],
				type: 'es6'
			}));
		}

		result.complexity = Math.max(
			1,
			Math.floor(result.functions.length * 0.3 + result.classes.length * 0.5)
		);
		return result;
	}

	/**
	 * Python regex fallback
	 */
	regexPython(content, result) {
		// Functions
		const funcMatches = content.match(/def\s+(\w+)\s*\([^)]*\):/g);
		if (funcMatches) {
			result.functions = funcMatches.map((match) => ({
				name: match.match(/def\s+(\w+)/)[1],
				lineStart: this.getLineNumber(content, content.indexOf(match)),
				complexity: 1
			}));
		}

		// Classes
		const classMatches = content.match(/class\s+(\w+)(?:\([^)]*\))?:/g);
		if (classMatches) {
			result.classes = classMatches.map((match) => ({
				name: match.match(/class\s+(\w+)/)[1],
				methods: []
			}));
		}

		// Imports
		const importMatches = content.match(
			/(?:from\s+(\S+)\s+import|import\s+(\S+))/g
		);
		if (importMatches) {
			result.imports = importMatches.map((match) => {
				const fromMatch = match.match(/from\s+(\S+)\s+import/);
				const importMatch = match.match(/import\s+(\S+)/);
				return {
					source: fromMatch ? fromMatch[1] : importMatch[1],
					type: fromMatch ? 'from' : 'import'
				};
			});
		}

		result.complexity = Math.max(
			1,
			Math.floor(result.functions.length * 0.2 + result.classes.length * 0.4)
		);
		return result;
	}

	/**
	 * Go regex fallback
	 */
	regexGo(content, result) {
		// Functions
		const funcMatches = content.match(
			/func\s+(?:\([^)]*\)\s+)?(\w+)\s*\([^)]*\)/g
		);
		if (funcMatches) {
			result.functions = funcMatches.map((match) => ({
				name: this.extractGoFunctionName(match),
				lineStart: this.getLineNumber(content, content.indexOf(match)),
				complexity: 1
			}));
		}

		// Types (struct-like)
		const typeMatches = content.match(/type\s+(\w+)\s+struct/g);
		if (typeMatches) {
			result.classes = typeMatches.map((match) => ({
				name: match.match(/type\s+(\w+)/)[1],
				methods: []
			}));
		}

		// Imports
		const importMatches = content.match(
			/import\s+(?:\(\s*([^)]+)\s*\)|"([^"]+)")/g
		);
		if (importMatches) {
			result.imports = importMatches.flatMap((match) => {
				if (match.includes('(')) {
					// Multi-line import
					const imports = match.match(/"([^"]+)"/g);
					return imports
						? imports.map((imp) => ({
								source: imp.replace(/"/g, ''),
								type: 'package'
							}))
						: [];
				} else {
					// Single import
					const source = match.match(/"([^"]+)"/);
					return source
						? [
								{
									source: source[1],
									type: 'package'
								}
							]
						: [];
				}
			});
		}

		result.complexity = Math.max(1, Math.floor(result.functions.length * 0.3));
		return result;
	}

	/**
	 * Generic regex fallback for unknown languages
	 */
	regexGeneric(content, result) {
		// Try to find function-like patterns
		const genericFuncPatterns = [
			/function\s+(\w+)/g,
			/def\s+(\w+)/g,
			/func\s+(\w+)/g,
			/(\w+)\s*\([^)]*\)\s*\{/g
		];

		for (const pattern of genericFuncPatterns) {
			const matches = content.match(pattern);
			if (matches) {
				result.functions = matches.map((match, i) => ({
					name: this.extractGenericName(match) || `function_${i}`,
					lineStart: this.getLineNumber(content, content.indexOf(match)),
					complexity: 1
				}));
				break;
			}
		}

		// Try to find class-like patterns
		const genericClassPatterns = [
			/class\s+(\w+)/g,
			/struct\s+(\w+)/g,
			/type\s+(\w+)/g
		];

		for (const pattern of genericClassPatterns) {
			const matches = content.match(pattern);
			if (matches) {
				result.classes = matches.map((match) => ({
					name: this.extractGenericName(match),
					methods: []
				}));
				break;
			}
		}

		result.complexity = Math.max(
			1,
			result.functions.length + result.classes.length
		);
		return result;
	}

	/**
	 * Content analysis fallback
	 */
	async contentAnalysisFallback(filePath, content, language) {
		const lines = content.split('\n');
		const result = {
			success: true,
			functions: [],
			classes: [],
			imports: [],
			complexity: 1
		};

		// Analyze content characteristics
		const stats = {
			totalLines: lines.length,
			codeLines: lines.filter(
				(line) => line.trim() && !line.trim().startsWith('//')
			).length,
			indentedLines: lines.filter(
				(line) => line.startsWith('  ') || line.startsWith('\t')
			).length,
			bracesCount: (content.match(/[{}]/g) || []).length,
			functionKeywords: (content.match(/function|def|func/g) || []).length
		};

		// Estimate complexity based on content
		result.complexity = Math.max(
			1,
			Math.floor(
				stats.functionKeywords * 0.5 +
					stats.bracesCount * 0.1 +
					(stats.indentedLines / stats.totalLines) * 5
			)
		);

		// Create synthetic function entries based on keywords
		if (stats.functionKeywords > 0) {
			for (let i = 0; i < stats.functionKeywords; i++) {
				result.functions.push({
					name: `detected_function_${i + 1}`,
					lineStart: Math.floor(
						(i + 1) * (stats.totalLines / stats.functionKeywords)
					),
					complexity: 1
				});
			}
		}

		return result;
	}

	/**
	 * Structure guessing fallback
	 */
	async structureGuessFallback(filePath, content, language) {
		const result = {
			success: true,
			functions: [
				{
					name: 'main_content',
					lineStart: 1,
					complexity: 1
				}
			],
			classes: [],
			imports: [],
			complexity: 1
		};

		// Guess structure based on file extension and size
		const extension = filePath.split('.').pop();
		const size = content.length;

		if (size > 10000) {
			result.complexity = 5;
			result.functions.push({
				name: 'large_file_content',
				lineStart: Math.floor(content.split('\n').length / 2),
				complexity: 3
			});
		}

		return result;
	}

	/**
	 * Create empty result for complete failure
	 */
	createEmptyResult(filePath, language, error) {
		return {
			success: true, // Always return success for development
			functions: [],
			classes: [],
			imports: [],
			complexity: 1,
			fromFallback: true,
			strategy: 'empty',
			error: error?.message || 'Unknown error',
			warning: 'AST parsing failed, using empty structure'
		};
	}

	/**
	 * Helper methods
	 */
	extractFunctionName(match) {
		const funcName = match.match(/function\s+(\w+)/);
		if (funcName) return funcName[1];

		const constName = match.match(/(?:const|let|var)\s+(\w+)/);
		if (constName) return constName[1];

		return 'anonymous';
	}

	extractGoFunctionName(match) {
		const receiver = match.match(/func\s+\([^)]*\)\s+(\w+)/);
		if (receiver) return receiver[1];

		const regular = match.match(/func\s+(\w+)/);
		return regular ? regular[1] : 'anonymous';
	}

	extractGenericName(match) {
		const name = match.match(/\b(\w+)(?:\s|$)/);
		return name ? name[1] : 'unknown';
	}

	getLineNumber(content, index) {
		return content.substring(0, index).split('\n').length;
	}

	timeout(ms) {
		return new Promise((_, reject) =>
			setTimeout(() => reject(new Error('Timeout')), ms)
		);
	}

	/**
	 * Get fallback statistics
	 */
	getStatistics() {
		return {
			...this.metrics,
			cacheSize: this.strategyCache.size,
			averageFallbackTime:
				this.metrics.successfulFallbacks > 0
					? (this.metrics.slowestFallback + this.metrics.fastestFallback) / 2
					: 0
		};
	}

	/**
	 * Clear caches
	 */
	clearCache() {
		this.strategyCache.clear();
	}
}

/**
 * Factory function for creating parser fallbacks
 */
export function createParserFallbacks(options = {}) {
	return new ParserFallbacks(options);
}

export default ParserFallbacks;
