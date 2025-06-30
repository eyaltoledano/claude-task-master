/**
 * JavaScript/TypeScript Parser using TypeScript Compiler API
 * Parses JS/TS files and extracts AST information for analysis
 */

import { BaseParser, AST_NODE_TYPES } from './base-parser.js';

/**
 * JavaScript/TypeScript parser implementation
 * Uses TypeScript compiler API for robust parsing of both JS and TS files
 */
export class JavaScriptParser extends BaseParser {
	constructor(options = {}) {
		super('javascript', options);
		this.ts = null; // TypeScript compiler API (loaded dynamically)
		this.initialized = false;
	}

	/**
	 * Initialize TypeScript compiler API
	 * @returns {Promise<boolean>} True if initialization successful
	 */
	async initialize() {
		if (this.initialized) return true;

		try {
			// Try to import TypeScript - it might not be available
			this.ts = await import('typescript');
			this.initialized = true;
			return true;
		} catch (error) {
			// TypeScript not available - we'll use a simpler approach
			console.warn('TypeScript compiler not available, using simplified parsing');
			this.initialized = false;
			return false;
		}
	}

	/**
	 * Parse JavaScript/TypeScript source code
	 * @param {string} filePath - Path to the source file
	 * @param {string} content - Source code content
	 * @returns {Promise<Object>} Parsed AST result
	 */
	async parse(filePath, content) {
		if (!this.validateContent(content)) {
			return this.handleParsingError(new Error('Invalid content'), filePath);
		}

		await this.initialize();

		try {
			let ast;
			
			if (this.initialized && this.ts) {
				// Use TypeScript compiler API for robust parsing
				ast = this.parseWithTypeScript(filePath, content);
			} else {
				// Fallback to simple regex-based parsing
				ast = this.parseWithRegex(content);
			}

			return this.createAnalysisResult(ast, filePath);
		} catch (error) {
			return this.handleParsingError(error, filePath);
		}
	}

	/**
	 * Parse using TypeScript compiler API
	 * @param {string} filePath - Path to the source file
	 * @param {string} content - Source code content
	 * @returns {Object} TypeScript AST
	 */
	parseWithTypeScript(filePath, content) {
		const isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
		
		const sourceFile = this.ts.createSourceFile(
			filePath,
			content,
			this.ts.ScriptTarget.Latest,
			true, // setParentNodes
			isTypeScript ? this.ts.ScriptKind.TS : this.ts.ScriptKind.JS
		);

		return sourceFile;
	}

	/**
	 * Fallback parsing using regular expressions
	 * @param {string} content - Source code content
	 * @returns {Object} Simple AST-like structure
	 */
	parseWithRegex(content) {
		// This is a simplified fallback when TypeScript API is not available
		return {
			type: 'simple_ast',
			content,
			source: content,
			// Pre-calculate these so extractFunctions() can just return them
			_functions: this.extractFunctionsWithRegex(content),
			_classes: this.extractClassesWithRegex(content),
			_imports: this.extractImportsWithRegex(content)
		};
	}

	/**
	 * Extract functions from TypeScript AST
	 * @param {Object} ast - TypeScript AST or simple AST
	 * @returns {Array<Object>} Array of function information
	 */
	extractFunctions(ast) {
		if (ast.type === 'simple_ast') {
			return ast._functions || [];
		}

		if (!this.ts || !ast) return [];

		const functions = [];
		
		const visit = (node) => {
			if (this.ts.isFunctionDeclaration(node) || 
				this.ts.isMethodDeclaration(node) ||
				this.ts.isArrowFunction(node) ||
				this.ts.isFunctionExpression(node)) {
				
				const func = this.extractFunctionFromNode(node, ast);
				if (func) functions.push(func);
			}

			this.ts.forEachChild(node, visit);
		};

		visit(ast);
		return functions;
	}

	/**
	 * Extract function information from TypeScript AST node
	 * @param {Object} node - TypeScript function node
	 * @param {Object} sourceFile - TypeScript source file
	 * @returns {Object} Function information
	 */
	extractFunctionFromNode(node, sourceFile) {
		if (!this.ts) return null;

		const name = node.name ? node.name.text : '<anonymous>';
		const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
		const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
		
		// Extract parameters
		const parameters = node.parameters ? node.parameters.map(param => {
			const paramName = param.name ? param.name.text : 'unknown';
			const paramType = param.type ? sourceFile.text.substring(param.type.getStart(), param.type.getEnd()) : null;
			return { name: paramName, type: paramType };
		}) : [];

		// Check if function is async
		const isAsync = node.modifiers ? 
			node.modifiers.some(mod => mod.kind === this.ts.SyntaxKind.AsyncKeyword) : false;

		// Check if function is exported
		const isExported = node.modifiers ?
			node.modifiers.some(mod => mod.kind === this.ts.SyntaxKind.ExportKeyword) : false;

		// Calculate complexity by counting decision points
		const complexity = this.calculateNodeComplexity(node);

		return this.createFunctionInfo(name, {
			parameters,
			lineStart: start.line + 1,
			lineEnd: end.line + 1,
			isAsync,
			isExported,
			complexity
		});
	}

	/**
	 * Extract classes from TypeScript AST
	 * @param {Object} ast - TypeScript AST or simple AST
	 * @returns {Array<Object>} Array of class information
	 */
	extractClasses(ast) {
		if (ast.type === 'simple_ast') {
			return ast._classes || [];
		}

		if (!this.ts || !ast) return [];

		const classes = [];
		
		const visit = (node) => {
			if (this.ts.isClassDeclaration(node)) {
				const cls = this.extractClassFromNode(node, ast);
				if (cls) classes.push(cls);
			}

			this.ts.forEachChild(node, visit);
		};

		visit(ast);
		return classes;
	}

	/**
	 * Extract class information from TypeScript AST node
	 * @param {Object} node - TypeScript class node
	 * @param {Object} sourceFile - TypeScript source file
	 * @returns {Object} Class information
	 */
	extractClassFromNode(node, sourceFile) {
		if (!this.ts) return null;

		const name = node.name ? node.name.text : '<anonymous>';
		const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
		const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

		// Extract methods
		const methods = [];
		node.members?.forEach(member => {
			if (this.ts.isMethodDeclaration(member)) {
				const method = this.extractFunctionFromNode(member, sourceFile);
				if (method) methods.push(method);
			}
		});

		// Check if class is exported
		const isExported = node.modifiers ?
			node.modifiers.some(mod => mod.kind === this.ts.SyntaxKind.ExportKeyword) : false;

		// Calculate class complexity as sum of method complexities
		const complexity = Math.min(10, methods.reduce((sum, method) => sum + method.complexity, 1));

		return this.createClassInfo(name, {
			methods,
			lineStart: start.line + 1,
			lineEnd: end.line + 1,
			isExported,
			complexity
		});
	}

	/**
	 * Extract imports from TypeScript AST
	 * @param {Object} ast - TypeScript AST or simple AST
	 * @returns {Array<Object>} Array of import information
	 */
	extractImports(ast) {
		if (ast.type === 'simple_ast') {
			return ast._imports || [];
		}

		if (!this.ts || !ast) return [];

		const imports = [];
		
		const visit = (node) => {
			if (this.ts.isImportDeclaration(node)) {
				const imp = this.extractImportFromNode(node, ast);
				if (imp) imports.push(imp);
			}

			this.ts.forEachChild(node, visit);
		};

		visit(ast);
		return imports;
	}

	/**
	 * Extract import information from TypeScript AST node
	 * @param {Object} node - TypeScript import node
	 * @param {Object} sourceFile - TypeScript source file
	 * @returns {Object} Import information
	 */
	extractImportFromNode(node, sourceFile) {
		if (!this.ts || !node.moduleSpecifier) return null;

		const source = node.moduleSpecifier.text;
		const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

		let defaultImport = null;
		let namespaceImport = null;
		const namedImports = [];

		if (node.importClause) {
			// Default import
			if (node.importClause.name) {
				defaultImport = node.importClause.name.text;
			}

			// Named imports or namespace import
			if (node.importClause.namedBindings) {
				if (this.ts.isNamespaceImport(node.importClause.namedBindings)) {
					namespaceImport = node.importClause.namedBindings.name.text;
				} else if (this.ts.isNamedImports(node.importClause.namedBindings)) {
					node.importClause.namedBindings.elements.forEach(element => {
						namedImports.push(element.name.text);
					});
				}
			}
		}

		return this.createImportInfo(source, {
			defaultImport,
			namespaceImport,
			imports: namedImports,
			lineNumber
		});
	}

	/**
	 * Calculate complexity of a TypeScript AST node
	 * @param {Object} node - TypeScript AST node
	 * @returns {number} Complexity score
	 */
	calculateNodeComplexity(node) {
		if (!this.ts) return 1;

		let complexity = 1; // Base complexity

		const visit = (n) => {
			// Add complexity for control flow statements
			if (this.ts.isIfStatement(n) ||
				this.ts.isWhileStatement(n) ||
				this.ts.isForStatement(n) ||
				this.ts.isForInStatement(n) ||
				this.ts.isForOfStatement(n) ||
				this.ts.isSwitchStatement(n) ||
				this.ts.isConditionalExpression(n) ||
				this.ts.isCatchClause(n)) {
				complexity++;
			}

			// Add complexity for logical operators
			if (this.ts.isBinaryExpression(n)) {
				if (n.operatorToken.kind === this.ts.SyntaxKind.AmpersandAmpersandToken ||
					n.operatorToken.kind === this.ts.SyntaxKind.BarBarToken) {
					complexity++;
				}
			}

			this.ts.forEachChild(n, visit);
		};

		visit(node);
		return Math.min(complexity, 10); // Cap at 10
	}

	/**
	 * Calculate overall complexity score for the AST
	 * @param {Object} ast - TypeScript AST or simple AST
	 * @returns {number} Complexity score (1-10)
	 */
	calculateComplexity(ast) {
		const functions = this.extractFunctions(ast);
		const classes = this.extractClasses(ast);
		
		if (functions.length === 0 && classes.length === 0) return 1;

		// Calculate average complexity
		const totalComplexity = [
			...functions.map(f => f.complexity || 1),
			...classes.map(c => c.complexity || 1)
		].reduce((sum, c) => sum + c, 0);

		const itemCount = functions.length + classes.length;
		const avgComplexity = totalComplexity / itemCount;

		return Math.min(Math.ceil(avgComplexity), 10);
	}

	/**
	 * Get file extensions supported by this parser
	 * @returns {Array<string>} Array of file extensions
	 */
	getSupportedExtensions() {
		return ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
	}

	// Fallback regex-based extraction methods

	/**
	 * Extract functions using regex (fallback method)
	 * @param {string} content - Source code content
	 * @returns {Array<Object>} Array of function information
	 */
	extractFunctionsWithRegex(content) {
		const functions = [];
		const lines = content.split('\n');
		
		// Find function boundaries using more comprehensive regex
		const functionPattern = /(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)\s*\(([^)]*)\)\s*\{|const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>\s*\{|(\w+)\s*\(\s*([^)]*)\s*\)\s*=>\s*\{)/g;
		
		let match = functionPattern.exec(content);
		while (match !== null) {
			const name = match[1] || match[3] || match[5] || '<anonymous>';
			const functionStart = match.index;
			const lineNumber = content.substring(0, functionStart).split('\n').length;
			
			// Extract function body for complexity analysis
			const functionBody = this.extractFunctionBodyRegex(content, functionStart);
			const complexity = this.calculateComplexityRegex(functionBody);
			
			functions.push(this.createFunctionInfo(name, {
				lineStart: lineNumber,
				complexity
			}));
			
			match = functionPattern.exec(content);
		}

		return functions;
	}

	/**
	 * Extract function body from content starting at a position (regex fallback)
	 * @param {string} content - Source code content
	 * @param {number} startIndex - Starting position of function
	 * @returns {string} Function body
	 */
	extractFunctionBodyRegex(content, startIndex) {
		let braceCount = 0;
		let inFunction = false;
		let body = '';
		
		for (let i = startIndex; i < content.length; i++) {
			const char = content[i];
			
			if (char === '{') {
				braceCount++;
				inFunction = true;
			} else if (char === '}') {
				braceCount--;
			}
			
			if (inFunction) {
				body += char;
			}
			
			// End of function when braces are balanced
			if (inFunction && braceCount === 0) {
				break;
			}
		}
		
		return body;
	}

	/**
	 * Calculate complexity using regex patterns (fallback method)
	 * @param {string} functionBody - Function body text
	 * @returns {number} Complexity score
	 */
	calculateComplexityRegex(functionBody) {
		if (!functionBody) return 1;
		
		let complexity = 1; // Base complexity
		
		// Count decision points using regex
		const patterns = [
			/\bif\s*\(/g,           // if statements
			/\belse\s+if\b/g,       // else if statements  
			/\bwhile\s*\(/g,        // while loops
			/\bfor\s*\(/g,          // for loops
			/\bswitch\s*\(/g,       // switch statements
			/\bcase\s+/g,           // case statements
			/\bcatch\s*\(/g,        // catch blocks
			/\?\s*.*?\s*:/g,        // ternary operators
			/&&/g,                  // logical AND
			/\|\|/g                 // logical OR
		];
		
		patterns.forEach(pattern => {
			const matches = functionBody.match(pattern);
			if (matches) {
				complexity += matches.length;
			}
		});
		
		// Cap complexity at 10
		return Math.min(complexity, 10);
	}

	/**
	 * Extract classes using regex (fallback method)
	 * @param {string} content - Source code content
	 * @returns {Array<Object>} Array of class information
	 */
	extractClassesWithRegex(content) {
		const classes = [];
		const classPattern = /(?:export\s+)?class\s+(\w+)/g;
		
		let match = classPattern.exec(content);
		while (match !== null) {
			const name = match[1];
			const lineNumber = content.substring(0, match.index).split('\n').length;
			
			classes.push(this.createClassInfo(name, {
				lineStart: lineNumber,
				complexity: 3 // Default complexity for regex-based detection
			}));
			
			match = classPattern.exec(content);
		}

		return classes;
	}

	/**
	 * Extract imports using regex (fallback method)
	 * @param {string} content - Source code content
	 * @returns {Array<Object>} Array of import information
	 */
	extractImportsWithRegex(content) {
		const imports = [];
		const importPatterns = [
			/import\s+.*\s+from\s+['"`]([^'"`]+)['"`]/g,
			/import\s+['"`]([^'"`]+)['"`]/g,
			/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g
		];

		importPatterns.forEach(pattern => {
			let match = pattern.exec(content);
			while (match !== null) {
				const source = match[1];
				const lineNumber = content.substring(0, match.index).split('\n').length;
				
				imports.push(this.createImportInfo(source, {
					lineNumber
				}));
				
				match = pattern.exec(content);
			}
		});

		return imports;
	}
} 