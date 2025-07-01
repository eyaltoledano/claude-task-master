/**
 * Analyzer Dispatcher - Phase 2.2
 *
 * Central dispatcher that routes analysis to appropriate language-specific analyzers
 * and integrates results with Phase 2.1 components. Provides unified interface
 * for the enhanced AST context builder.
 *
 * @author Task Master Flow
 * @version 2.2.0
 */

import JavaScriptAnalyzer from './javascript-analyzer.js';
import PythonAnalyzer from './python-analyzer.js';
import GoAnalyzer from './go-analyzer.js';
import GenericAnalyzer from './generic-analyzer.js';

/**
 * Main analyzer dispatcher for language-specific analysis
 */
export class AnalyzerDispatcher {
	constructor(options = {}) {
		this.options = {
			enableLanguageSpecific: true,
			fallbackToGeneric: true,
			cacheResults: true,
			...options
		};

		// Initialize language-specific analyzers
		this.analyzers = {
			javascript: new JavaScriptAnalyzer(options.javascript || {}),
			typescript: new JavaScriptAnalyzer(options.typescript || {}),
			python: new PythonAnalyzer(options.python || {}),
			go: new GoAnalyzer(options.go || {}),
			generic: new GenericAnalyzer(options.generic || {})
		};

		// Analysis cache
		this.cache = new Map();
	}

	/**
	 * Perform comprehensive analysis for any language
	 * @param {Object} astData - Parsed AST data
	 * @param {string} filePath - File path for context
	 * @param {string} content - Source code content
	 * @param {string} language - Detected language
	 * @returns {Promise<Object>} Comprehensive analysis results
	 */
	async analyzeCode(astData, filePath, content, language) {
		// Generate cache key
		const cacheKey = this.generateCacheKey(filePath, content, language);

		// Check cache first
		if (this.options.cacheResults && this.cache.has(cacheKey)) {
			return {
				...this.cache.get(cacheKey),
				fromCache: true,
				timestamp: new Date().toISOString()
			};
		}

		const startTime = Date.now();

		try {
			// Select appropriate analyzer
			const analyzer = this.selectAnalyzer(language);

			// Perform analysis
			let analysis;
			if (analyzer === this.analyzers.generic) {
				analysis = await analyzer.analyzeGeneric(
					astData,
					filePath,
					content,
					language
				);
			} else {
				// Use language-specific analyzer
				analysis = await this.performLanguageSpecificAnalysis(
					analyzer,
					astData,
					filePath,
					content,
					language
				);
			}

			// Enhance with metadata
			analysis.metadata = {
				analyzedBy: analyzer.constructor.name,
				language,
				filePath,
				analysisTime: Date.now() - startTime,
				timestamp: new Date().toISOString(),
				phase: '2.2'
			};

			// Add generic insights if using language-specific analyzer
			if (
				analyzer !== this.analyzers.generic &&
				this.options.fallbackToGeneric
			) {
				analysis.genericInsights = await this.analyzers.generic.analyzeGeneric(
					astData,
					filePath,
					content,
					language
				);
			}

			// Cache result
			if (this.options.cacheResults) {
				this.cache.set(cacheKey, analysis);
			}

			return analysis;
		} catch (error) {
			console.warn(
				`[AnalyzerDispatcher] Analysis failed for ${language}:`,
				error.message
			);

			// Fallback to generic analyzer
			if (this.options.fallbackToGeneric) {
				return await this.analyzers.generic.analyzeGeneric(
					astData,
					filePath,
					content,
					language
				);
			}

			throw error;
		}
	}

	/**
	 * Select appropriate analyzer based on language
	 * @param {string} language - Programming language
	 * @returns {Object} Selected analyzer instance
	 */
	selectAnalyzer(language) {
		const normalizedLanguage = language.toLowerCase();

		// Direct language mapping
		if (
			this.analyzers[normalizedLanguage] &&
			this.options.enableLanguageSpecific
		) {
			return this.analyzers[normalizedLanguage];
		}

		// Handle language variants
		const languageMapping = {
			js: 'javascript',
			jsx: 'javascript',
			ts: 'javascript',
			tsx: 'javascript',
			javascript: 'javascript',
			typescript: 'javascript',
			py: 'python',
			python: 'python',
			go: 'go',
			golang: 'go'
		};

		const mappedLanguage = languageMapping[normalizedLanguage];
		if (
			mappedLanguage &&
			this.analyzers[mappedLanguage] &&
			this.options.enableLanguageSpecific
		) {
			return this.analyzers[mappedLanguage];
		}

		// Fallback to generic analyzer
		return this.analyzers.generic;
	}

	/**
	 * Perform language-specific analysis
	 * @param {Object} analyzer - Selected analyzer
	 * @param {Object} astData - AST data
	 * @param {string} filePath - File path
	 * @param {string} content - Source code
	 * @param {string} language - Programming language
	 * @returns {Promise<Object>} Analysis results
	 */
	async performLanguageSpecificAnalysis(
		analyzer,
		astData,
		filePath,
		content,
		language
	) {
		const normalizedLanguage = language.toLowerCase();

		// Route to appropriate analyzer method
		if (analyzer === this.analyzers.javascript) {
			return await analyzer.analyzeJavaScript(astData, filePath, content);
		} else if (analyzer === this.analyzers.python) {
			return await analyzer.analyzePython(astData, filePath, content);
		} else if (analyzer === this.analyzers.go) {
			return await analyzer.analyzeGo(astData, filePath, content);
		} else {
			// Default to generic analysis
			return await analyzer.analyzeGeneric(
				astData,
				filePath,
				content,
				language
			);
		}
	}

	/**
	 * Generate cache key for analysis results
	 * @param {string} filePath - File path
	 * @param {string} content - Source code
	 * @param {string} language - Programming language
	 * @returns {string} Cache key
	 */
	generateCacheKey(filePath, content, language) {
		// Simple hash based on file path, content length, and language
		const contentHash = this.simpleHash(content);
		return `${filePath}-${language}-${contentHash}-${content.length}`;
	}

	/**
	 * Generate simple hash for content
	 * @param {string} content - Content to hash
	 * @returns {string} Simple hash
	 */
	simpleHash(content) {
		let hash = 0;
		for (let i = 0; i < content.length; i++) {
			const char = content.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return Math.abs(hash).toString(36);
	}

	/**
	 * Get supported languages
	 * @returns {Array} Array of supported languages
	 */
	getSupportedLanguages() {
		return [
			'javascript',
			'typescript',
			'js',
			'jsx',
			'ts',
			'tsx',
			'python',
			'py',
			'go',
			'golang',
			'generic' // Always available as fallback
		];
	}

	/**
	 * Get analyzer statistics
	 * @returns {Object} Analyzer usage statistics
	 */
	getStatistics() {
		return {
			cacheSize: this.cache.size,
			supportedLanguages: this.getSupportedLanguages(),
			analyzers: Object.keys(this.analyzers),
			cacheEnabled: this.options.cacheResults
		};
	}

	/**
	 * Clear analysis cache
	 */
	clearCache() {
		this.cache.clear();
	}

	/**
	 * Batch analyze multiple files
	 * @param {Array} files - Array of file objects {astData, filePath, content, language}
	 * @returns {Promise<Array>} Array of analysis results
	 */
	async batchAnalyze(files) {
		const results = [];

		// Process files in parallel (with some concurrency limit)
		const concurrency = 5;
		for (let i = 0; i < files.length; i += concurrency) {
			const batch = files.slice(i, i + concurrency);

			const batchPromises = batch.map(async (file) => {
				try {
					const analysis = await this.analyzeCode(
						file.astData,
						file.filePath,
						file.content,
						file.language
					);
					return { ...analysis, success: true };
				} catch (error) {
					return {
						success: false,
						error: error.message,
						filePath: file.filePath,
						language: file.language
					};
				}
			});

			const batchResults = await Promise.all(batchPromises);
			results.push(...batchResults);
		}

		return results;
	}

	/**
	 * Get analysis summary for multiple files
	 * @param {Array} analysisResults - Array of analysis results
	 * @returns {Object} Summary statistics
	 */
	getAnalysisSummary(analysisResults) {
		const summary = {
			totalFiles: analysisResults.length,
			successfulAnalyses: 0,
			failedAnalyses: 0,
			languageBreakdown: {},
			analyzerBreakdown: {},
			averageComplexity: 0,
			totalRecommendations: 0,
			qualityDistribution: { excellent: 0, good: 0, fair: 0, poor: 0 }
		};

		let totalComplexity = 0;
		let complexityCount = 0;

		analysisResults.forEach((result) => {
			if (result.success) {
				summary.successfulAnalyses++;

				// Language breakdown
				const lang = result.language || 'unknown';
				summary.languageBreakdown[lang] =
					(summary.languageBreakdown[lang] || 0) + 1;

				// Analyzer breakdown
				const analyzer = result.metadata?.analyzedBy || 'unknown';
				summary.analyzerBreakdown[analyzer] =
					(summary.analyzerBreakdown[analyzer] || 0) + 1;

				// Complexity
				if (result.complexity?.overall?.average) {
					totalComplexity += result.complexity.overall.average;
					complexityCount++;
				}

				// Recommendations
				if (result.recommendations) {
					summary.totalRecommendations += result.recommendations.length;
				}

				// Quality distribution
				const score = result.codeQuality?.score || 5;
				if (score >= 9) summary.qualityDistribution.excellent++;
				else if (score >= 7) summary.qualityDistribution.good++;
				else if (score >= 5) summary.qualityDistribution.fair++;
				else summary.qualityDistribution.poor++;
			} else {
				summary.failedAnalyses++;
			}
		});

		if (complexityCount > 0) {
			summary.averageComplexity = totalComplexity / complexityCount;
		}

		return summary;
	}
}

/**
 * Create analyzer dispatcher with default configuration
 * @param {Object} options - Configuration options
 * @returns {AnalyzerDispatcher} Configured dispatcher
 */
export function createAnalyzerDispatcher(options = {}) {
	return new AnalyzerDispatcher(options);
}

export default AnalyzerDispatcher;
