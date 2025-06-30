/**
 * Centralized Parser Registry for AST Analysis
 * Manages all language-specific parsers and provides unified parsing interface
 */

import { ParserRegistry } from './base-parser.js';
import { JavaScriptParser } from './javascript-parser.js';
import { PythonParser } from './python-parser.js';
import { GoParser } from './go-parser.js';

/**
 * Language detection patterns
 */
const LANGUAGE_PATTERNS = {
	javascript: {
		extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],
		patterns: [
			/require\s*\(/,
			/import\s+.*from/,
			/export\s+(?:default\s+)?/,
			/function\s+\w+\s*\(/,
			/const\s+\w+\s*=/,
			/class\s+\w+/,
			/interface\s+\w+/,
			/type\s+\w+\s*=/,
			/^\s*\/\//m
		]
	},
	python: {
		extensions: ['.py', '.pyx', '.pyi'],
		patterns: [
			/def\s+\w+\s*\(/,
			/class\s+\w+/,
			/import\s+\w+/,
			/from\s+\w+\s+import/,
			/if\s+.*:/,
			/for\s+.*:/,
			/while\s+.*:/,
			/try\s*:/,
			/^\s*#/m
		]
	},
	go: {
		extensions: ['.go'],
		patterns: [
			/package\s+\w+/,
			/func\s+\w+\s*\(/,
			/type\s+\w+\s+struct/,
			/type\s+\w+\s+interface/,
			/import\s*[\("]/,
			/var\s+\w+/,
			/const\s+\w+/,
			/if\s+.*\{/,
			/for\s+.*\{/,
			/switch\s+.*\{/,
			/^\s*\/\//m
		]
	}
};

/**
 * Enhanced parser registry with automatic language detection and parser management
 */
export class EnhancedParserRegistry extends ParserRegistry {
	constructor(options = {}) {
		super();
		this.options = {
			enableCaching: true,
			autoDetectLanguage: true,
			fallbackToSimpleParsing: true,
			...options
		};
		
		this.parserCache = new Map();
		this.initialized = false;
	}

	/**
	 * Initialize the registry with default parsers
	 * @returns {Promise<void>}
	 */
	async initialize() {
		if (this.initialized) return;

		try {
			// Register JavaScript/TypeScript parser
			const jsParser = new JavaScriptParser(this.options);
			this.register('javascript', jsParser);

			// Register Python parser
			const pythonParser = new PythonParser(this.options);
			this.register('python', pythonParser);

			// Register Go parser
			const goParser = new GoParser(this.options);
			this.register('go', goParser);

			this.initialized = true;
		} catch (error) {
			throw new Error(`Failed to initialize parser registry: ${error.message}`);
		}
	}

	/**
	 * Parse a file with automatic language detection
	 * @param {string} filePath - Path to the source file
	 * @param {string} content - Source code content
	 * @param {string} [language] - Optional language override
	 * @returns {Promise<Object>} Parsed AST result
	 */
	async parseFile(filePath, content, language = null) {
		await this.initialize();

		try {
			// Determine language
			const detectedLanguage = language || this.detectLanguage(filePath, content);
			
			if (!detectedLanguage) {
				return {
					success: false,
					error: {
						type: 'language_detection_error',
						message: 'Unable to detect language for file',
						file: filePath
					}
				};
			}

			// Get parser for language
			const parser = this.getParser(detectedLanguage);
			
			if (!parser) {
				return {
					success: false,
					error: {
						type: 'parser_not_found',
						message: `No parser available for language: ${detectedLanguage}`,
						file: filePath,
						language: detectedLanguage
					}
				};
			}

			// Parse the file
			const result = await parser.parse(filePath, content);
			
			// Add metadata to result
			if (result.success) {
				result.metadata = {
					detectedLanguage,
					parser: parser.constructor.name,
					timestamp: new Date().toISOString(),
					registry: 'EnhancedParserRegistry'
				};
			}

			return result;

		} catch (error) {
			return {
				success: false,
				error: {
					type: 'parsing_error',
					message: error.message,
					file: filePath,
					stack: error.stack
				}
			};
		}
	}

	/**
	 * Detect programming language from file path and content
	 * @param {string} filePath - Path to the source file
	 * @param {string} content - Source code content
	 * @returns {string|null} Detected language or null
	 */
	detectLanguage(filePath, content) {
		if (!this.options.autoDetectLanguage) {
			return null;
		}

		// First, try to detect by file extension
		const extensionLanguage = this.detectLanguageByExtension(filePath);
		if (extensionLanguage) {
			return extensionLanguage;
		}

		// Fallback to content-based detection
		return this.detectLanguageByContent(content);
	}

	/**
	 * Detect language by file extension
	 * @param {string} filePath - Path to the source file
	 * @returns {string|null} Detected language or null
	 */
	detectLanguageByExtension(filePath) {
		const extension = this.getFileExtension(filePath);
		
		for (const [language, config] of Object.entries(LANGUAGE_PATTERNS)) {
			if (config.extensions.includes(extension)) {
				return language;
			}
		}

		return null;
	}

	/**
	 * Detect language by analyzing content patterns
	 * @param {string} content - Source code content
	 * @returns {string|null} Detected language or null
	 */
	detectLanguageByContent(content) {
		if (!content || typeof content !== 'string') {
			return null;
		}

		const scores = {};

		// Score each language based on pattern matches
		for (const [language, config] of Object.entries(LANGUAGE_PATTERNS)) {
			let score = 0;
			
			for (const pattern of config.patterns) {
				const matches = content.match(pattern);
				if (matches) {
					score += matches.length;
				}
			}

			scores[language] = score;
		}

		// Return language with highest score (if any)
		const maxScore = Math.max(...Object.values(scores));
		if (maxScore > 0) {
			return Object.keys(scores).find(lang => scores[lang] === maxScore);
		}

		return null;
	}

	/**
	 * Get file extension from path
	 * @param {string} filePath - File path
	 * @returns {string} File extension (e.g., '.js')
	 */
	getFileExtension(filePath) {
		const lastDot = filePath.lastIndexOf('.');
		return lastDot === -1 ? '' : filePath.substring(lastDot);
	}

	/**
	 * Get all supported file extensions across all parsers
	 * @returns {Object} Extensions grouped by language
	 */
	getSupportedExtensionsByLanguage() {
		const extensions = {};
		
		for (const [language, config] of Object.entries(LANGUAGE_PATTERNS)) {
			extensions[language] = config.extensions;
		}

		return extensions;
	}

	/**
	 * Check if a file is supported by any parser
	 * @param {string} filePath - Path to check
	 * @returns {boolean} True if file is supported
	 */
	isFileSupported(filePath) {
		const extension = this.getFileExtension(filePath);
		return this.getSupportedExtensions().includes(extension);
	}

	/**
	 * Get parser statistics
	 * @returns {Object} Registry statistics
	 */
	getStatistics() {
		const languages = this.getSupportedLanguages();
		const extensions = this.getSupportedExtensions();
		
		return {
			initialized: this.initialized,
			supportedLanguages: languages.length,
			languages,
			supportedExtensions: extensions.length,
			extensions,
			extensionsByLanguage: this.getSupportedExtensionsByLanguage(),
			registeredParsers: Array.from(this.parsers.keys()),
			cacheEnabled: this.options.enableCaching,
			autoDetectEnabled: this.options.autoDetectLanguage
		};
	}

	/**
	 * Validate registry setup
	 * @returns {Object} Validation result
	 */
	async validateSetup() {
		const validation = {
			success: true,
			errors: [],
			warnings: [],
			parsers: {}
		};

		await this.initialize();

		// Test each parser with sample content
		for (const [language, config] of Object.entries(LANGUAGE_PATTERNS)) {
			const parser = this.getParser(language);
			
			if (!parser) {
				validation.errors.push(`Parser not found for language: ${language}`);
				validation.success = false;
				continue;
			}

			// Create minimal valid content for the language
			const sampleContent = this.createSampleContent(language);
			
			try {
				// Test parsing without actual execution
				const isValid = parser.validateContent(sampleContent);
				validation.parsers[language] = {
					available: true,
					validatesContent: isValid,
					extensions: parser.getSupportedExtensions()
				};
			} catch (error) {
				validation.parsers[language] = {
					available: false,
					error: error.message
				};
				validation.warnings.push(`Parser for ${language} may have issues: ${error.message}`);
			}
		}

		return validation;
	}

	/**
	 * Create minimal sample content for a language
	 * @param {string} language - Language identifier
	 * @returns {string} Sample content
	 */
	createSampleContent(language) {
		const samples = {
			javascript: 'function hello() { return "world"; }',
			python: 'def hello():\n    return "world"',
			go: 'package main\n\nfunc hello() string {\n    return "world"\n}'
		};

		return samples[language] || '// Sample content';
	}

	/**
	 * Clean up resources
	 */
	cleanup() {
		this.parserCache.clear();
		this.parsers.clear();
		this.initialized = false;
	}
}

// Create and export a default registry instance
export const defaultParserRegistry = new EnhancedParserRegistry();

/**
 * Convenience function to parse a file with the default registry
 * @param {string} filePath - Path to the source file
 * @param {string} content - Source code content
 * @param {string} [language] - Optional language override
 * @returns {Promise<Object>} Parsed AST result
 */
export async function parseFile(filePath, content, language = null) {
	return await defaultParserRegistry.parseFile(filePath, content, language);
}

/**
 * Convenience function to detect language with the default registry
 * @param {string} filePath - Path to the source file
 * @param {string} content - Source code content
 * @returns {string|null} Detected language or null
 */
export function detectLanguage(filePath, content) {
	return defaultParserRegistry.detectLanguage(filePath, content);
}

/**
 * Initialize the default registry
 * @returns {Promise<void>}
 */
export async function initializeDefaultRegistry() {
	return await defaultParserRegistry.initialize();
}

/**
 * Get registry statistics
 * @returns {Object} Statistics object
 */
export function getRegistryStatistics() {
	return defaultParserRegistry.getStatistics();
}

// Export parser classes for direct use
export { JavaScriptParser, PythonParser, GoParser };
export { BaseParser, AST_NODE_TYPES } from './base-parser.js'; 