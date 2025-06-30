/**
 * Base Parser Interface for AST Analysis
 * Defines the contract that all language-specific parsers must implement
 */

/**
 * Standard AST node structure for cross-language compatibility
 */
export const AST_NODE_TYPES = {
	FUNCTION: 'function',
	CLASS: 'class',
	INTERFACE: 'interface',
	VARIABLE: 'variable',
	IMPORT: 'import',
	EXPORT: 'export',
	COMMENT: 'comment',
	UNKNOWN: 'unknown'
};

/**
 * Base parser class that all language parsers should extend
 */
export class BaseParser {
	constructor(language, options = {}) {
		this.language = language;
		this.options = {
			includeComments: false,
			includePositions: true,
			maxComplexity: 100,
			...options
		};
	}

	/**
	 * Parse source code into AST structure
	 * @param {string} filePath - Path to the source file
	 * @param {string} content - Source code content
	 * @returns {Promise<Object>} Parsed AST result
	 */
	async parse(filePath, content) {
		throw new Error(`parse() method must be implemented by ${this.language} parser`);
	}

	/**
	 * Extract functions from AST
	 * @param {Object} ast - Parsed AST
	 * @returns {Array<Object>} Array of function information
	 */
	extractFunctions(ast) {
		throw new Error(`extractFunctions() method must be implemented by ${this.language} parser`);
	}

	/**
	 * Extract classes/types from AST
	 * @param {Object} ast - Parsed AST
	 * @returns {Array<Object>} Array of class/type information
	 */
	extractClasses(ast) {
		throw new Error(`extractClasses() method must be implemented by ${this.language} parser`);
	}

	/**
	 * Extract imports/dependencies from AST
	 * @param {Object} ast - Parsed AST
	 * @returns {Array<Object>} Array of import information
	 */
	extractImports(ast) {
		throw new Error(`extractImports() method must be implemented by ${this.language} parser`);
	}

	/**
	 * Calculate complexity score for the code
	 * @param {Object} ast - Parsed AST
	 * @returns {number} Complexity score (1-10)
	 */
	calculateComplexity(ast) {
		throw new Error(`calculateComplexity() method must be implemented by ${this.language} parser`);
	}

	/**
	 * Get file extensions supported by this parser
	 * @returns {Array<string>} Array of file extensions (e.g., ['.js', '.jsx'])
	 */
	getSupportedExtensions() {
		throw new Error(`getSupportedExtensions() method must be implemented by ${this.language} parser`);
	}

	/**
	 * Validate if content can be parsed by this parser
	 * @param {string} content - Source code content
	 * @returns {boolean} True if content is valid for this parser
	 */
	validateContent(content) {
		if (!content || typeof content !== 'string') {
			return false;
		}
		// Basic validation - subclasses can override for language-specific checks
		return content.trim().length > 0;
	}

	/**
	 * Standard error handling for parsing errors
	 * @param {Error} error - Original parsing error
	 * @param {string} filePath - Path to file being parsed
	 * @returns {Object} Standardized error result
	 */
	handleParsingError(error, filePath) {
		return {
			success: false,
			error: {
				type: 'parsing_error',
				message: error.message,
				file: filePath,
				language: this.language,
				parser: this.constructor.name
			},
			ast: null,
			analysis: null
		};
	}

	/**
	 * Create standardized function information object
	 * @param {string} name - Function name
	 * @param {Object} options - Additional function properties
	 * @returns {Object} Standardized function object
	 */
	createFunctionInfo(name, options = {}) {
		return {
			type: AST_NODE_TYPES.FUNCTION,
			name,
			parameters: options.parameters || [],
			returnType: options.returnType || null,
			complexity: options.complexity || 1,
			lineStart: options.lineStart || null,
			lineEnd: options.lineEnd || null,
			isAsync: options.isAsync || false,
			isExported: options.isExported || false,
			visibility: options.visibility || 'public', // public, private, protected
			comments: options.comments || []
		};
	}

	/**
	 * Create standardized class information object
	 * @param {string} name - Class name
	 * @param {Object} options - Additional class properties
	 * @returns {Object} Standardized class object
	 */
	createClassInfo(name, options = {}) {
		return {
			type: AST_NODE_TYPES.CLASS,
			name,
			extends: options.extends || null,
			implements: options.implements || [],
			methods: options.methods || [],
			properties: options.properties || [],
			complexity: options.complexity || 1,
			lineStart: options.lineStart || null,
			lineEnd: options.lineEnd || null,
			isExported: options.isExported || false,
			visibility: options.visibility || 'public',
			comments: options.comments || []
		};
	}

	/**
	 * Create standardized import information object
	 * @param {string} source - Import source/path
	 * @param {Object} options - Additional import properties
	 * @returns {Object} Standardized import object
	 */
	createImportInfo(source, options = {}) {
		return {
			type: AST_NODE_TYPES.IMPORT,
			source,
			imports: options.imports || [], // Named imports
			defaultImport: options.defaultImport || null,
			namespaceImport: options.namespaceImport || null,
			isTypeOnly: options.isTypeOnly || false,
			lineNumber: options.lineNumber || null
		};
	}

	/**
	 * Create standardized analysis result
	 * @param {Object} ast - Parsed AST
	 * @param {string} filePath - Path to analyzed file
	 * @returns {Object} Complete analysis result
	 */
	createAnalysisResult(ast, filePath) {
		try {
			const functions = this.extractFunctions(ast);
			const classes = this.extractClasses(ast);
			const imports = this.extractImports(ast);
			const complexity = this.calculateComplexity(ast);

			return {
				success: true,
				filePath,
				language: this.language,
				timestamp: new Date().toISOString(),
				ast,
				analysis: {
					functions,
					classes,
					imports,
					complexity,
					metrics: {
						functionCount: functions.length,
						classCount: classes.length,
						importCount: imports.length,
						avgFunctionComplexity: functions.length > 0 
							? functions.reduce((sum, f) => sum + (f.complexity || 1), 0) / functions.length 
							: 0
					}
				}
			};
		} catch (error) {
			return this.handleParsingError(error, filePath);
		}
	}

	/**
	 * Calculate cyclomatic complexity for a function
	 * @param {Object} functionNode - AST node representing a function
	 * @returns {number} Complexity score
	 */
	calculateCyclomaticComplexity(functionNode) {
		// Base implementation - subclasses should override with language-specific logic
		// Start with 1 (base path) and add 1 for each decision point
		const complexity = 1;
		
		// This is a simplified version - real implementations would traverse the AST
		// looking for if statements, loops, switch cases, etc.
		
		return Math.min(complexity, 10); // Cap at 10 for consistent scoring
	}

	/**
	 * Convert line/column positions to character positions
	 * @param {string} content - Source code content
	 * @param {number} line - Line number (1-based)
	 * @param {number} column - Column number (0-based)
	 * @returns {number} Character position
	 */
	getCharacterPosition(content, line, column) {
		const lines = content.split('\n');
		let position = 0;
		
		for (let i = 0; i < line - 1 && i < lines.length; i++) {
			position += lines[i].length + 1; // +1 for newline character
		}
		
		return position + column;
	}

	/**
	 * Extract text from source between two positions
	 * @param {string} content - Source code content
	 * @param {number} start - Start character position
	 * @param {number} end - End character position
	 * @returns {string} Extracted text
	 */
	extractText(content, start, end) {
		return content.substring(start, end);
	}
}

/**
 * Parser registry for managing multiple language parsers
 */
export class ParserRegistry {
	constructor() {
		this.parsers = new Map();
	}

	/**
	 * Register a parser for a language
	 * @param {string} language - Language identifier
	 * @param {BaseParser} parser - Parser instance
	 */
	register(language, parser) {
		if (!(parser instanceof BaseParser)) {
			throw new Error('Parser must extend BaseParser class');
		}
		this.parsers.set(language, parser);
	}

	/**
	 * Get parser for a specific language
	 * @param {string} language - Language identifier
	 * @returns {BaseParser|null} Parser instance or null if not found
	 */
	getParser(language) {
		return this.parsers.get(language) || null;
	}

	/**
	 * Check if a language is supported
	 * @param {string} language - Language identifier
	 * @returns {boolean} True if language has a registered parser
	 */
	isLanguageSupported(language) {
		return this.parsers.has(language);
	}

	/**
	 * Get all supported languages
	 * @returns {Array<string>} Array of supported language identifiers
	 */
	getSupportedLanguages() {
		return Array.from(this.parsers.keys());
	}

	/**
	 * Get all supported file extensions
	 * @returns {Array<string>} Array of file extensions
	 */
	getSupportedExtensions() {
		const extensions = [];
		for (const parser of this.parsers.values()) {
			extensions.push(...parser.getSupportedExtensions());
		}
		return [...new Set(extensions)]; // Remove duplicates
	}
} 