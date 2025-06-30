/**
 * Python Parser using Python's built-in ast module
 * Parses Python files via child process and extracts AST information for analysis
 */

import { BaseParser, AST_NODE_TYPES } from './base-parser.js';
import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Python parser implementation
 * Uses Python's ast module via child process for robust Python parsing
 */
export class PythonParser extends BaseParser {
	constructor(options = {}) {
		super('python', options);
		this.pythonExecutable = options.pythonExecutable || 'python3';
		this.tempFilePrefix = 'taskmaster_ast_';
	}

	/**
	 * Parse Python source code
	 * @param {string} filePath - Path to the source file
	 * @param {string} content - Source code content
	 * @returns {Promise<Object>} Parsed AST result
	 */
	async parse(filePath, content) {
		if (!this.validateContent(content)) {
			return this.handleParsingError(new Error('Invalid content'), filePath);
		}

		try {
			const ast = await this.parseWithPython(filePath, content);
			return this.createAnalysisResult(ast, filePath);
		} catch (error) {
			return this.handleParsingError(error, filePath);
		}
	}

	/**
	 * Parse using Python ast module via child process
	 * @param {string} filePath - Path to the source file
	 * @param {string} content - Source code content
	 * @returns {Promise<Object>} Python AST as JSON
	 */
	async parseWithPython(filePath, content) {
		// Create Python script to parse the file
		const pythonScript = this.createPythonParserScript();
		
		return new Promise((resolve, reject) => {
			const python = spawn(this.pythonExecutable, ['-c', pythonScript]);
			
			let stdout = '';
			let stderr = '';
			
			python.stdout.on('data', (data) => {
				stdout += data.toString();
			});
			
			python.stderr.on('data', (data) => {
				stderr += data.toString();
			});
			
			python.on('close', (code) => {
				if (code !== 0) {
					reject(new Error(`Python parsing failed: ${stderr || 'Unknown error'}`));
					return;
				}
				
				try {
					const result = JSON.parse(stdout);
					if (result.error) {
						reject(new Error(result.error));
					} else {
						resolve(result.ast);
					}
				} catch (parseError) {
					reject(new Error(`Failed to parse Python AST JSON: ${parseError.message}`));
				}
			});
			
			python.on('error', (error) => {
				reject(new Error(`Failed to spawn Python process: ${error.message}`));
			});
			
			// Send the Python code to parse via stdin
			python.stdin.write(content);
			python.stdin.end();
		});
	}

	/**
	 * Create Python script for AST parsing
	 * @returns {string} Python script code
	 */
	createPythonParserScript() {
		return `
import ast
import json
import sys

def analyze_node(node, source_lines=None):
    """Convert AST node to analyzable dict structure."""
    result = {
        'type': node.__class__.__name__,
        'lineno': getattr(node, 'lineno', None),
        'col_offset': getattr(node, 'col_offset', None),
        'end_lineno': getattr(node, 'end_lineno', None),
        'end_col_offset': getattr(node, 'end_col_offset', None)
    }
    
    # Add node-specific attributes
    if hasattr(node, 'name'):
        result['name'] = node.name
    if hasattr(node, 'id'):
        result['id'] = node.id
    if hasattr(node, 'arg'):
        result['arg'] = node.arg
    if hasattr(node, 'module'):
        result['module'] = node.module
    if hasattr(node, 'level'):
        result['level'] = node.level
    if hasattr(node, 'asname'):
        result['asname'] = node.asname
        
    # Process child nodes
    children = []
    for field, value in ast.iter_fields(node):
        if isinstance(value, list):
            for item in value:
                if isinstance(item, ast.AST):
                    children.append(analyze_node(item, source_lines))
        elif isinstance(value, ast.AST):
            children.append(analyze_node(value, source_lines))
    
    if children:
        result['children'] = children
        
    return result

def extract_docstring(node):
    """Extract docstring from function or class."""
    if (isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and
        node.body and isinstance(node.body[0], ast.Expr) and
        isinstance(node.body[0].value, ast.Str)):
        return node.body[0].value.s
    return None

try:
    # Read source code from stdin
    source_code = sys.stdin.read()
    source_lines = source_code.split('\\n')
    
    # Parse the AST
    tree = ast.parse(source_code)
    
    # Convert to analyzable format
    ast_dict = analyze_node(tree, source_lines)
    ast_dict['source_lines'] = source_lines
    
    # Output result as JSON
    result = {'ast': ast_dict, 'error': None}
    print(json.dumps(result))
    
except SyntaxError as e:
    result = {'ast': None, 'error': f'Syntax error: {e.msg} at line {e.lineno}'}
    print(json.dumps(result))
except Exception as e:
    result = {'ast': None, 'error': f'Parsing error: {str(e)}'}
    print(json.dumps(result))
`;
	}

	/**
	 * Extract functions from Python AST
	 * @param {Object} ast - Python AST
	 * @returns {Array<Object>} Array of function information
	 */
	extractFunctions(ast) {
		const functions = [];
		
		const visit = (node) => {
			if (node.type === 'FunctionDef' || node.type === 'AsyncFunctionDef') {
				const func = this.extractFunctionFromNode(node, ast);
				if (func) functions.push(func);
			}
			
			if (node.children) {
				node.children.forEach(visit);
			}
		};
		
		visit(ast);
		return functions;
	}

	/**
	 * Extract function information from Python AST node
	 * @param {Object} node - Python function node
	 * @param {Object} ast - Full AST for context
	 * @returns {Object} Function information
	 */
	extractFunctionFromNode(node, ast) {
		const name = node.name || '<anonymous>';
		const isAsync = node.type === 'AsyncFunctionDef';
		
		// Extract parameters
		const parameters = [];
		if (node.children) {
			const argsNode = node.children.find(child => child.type === 'arguments');
			if (argsNode && argsNode.children) {
				argsNode.children
					.filter(child => child.type === 'arg')
					.forEach(arg => {
						parameters.push({
							name: arg.arg || arg.id || 'unknown',
							type: null // Python doesn't have static types by default
						});
					});
			}
		}
		
		// Calculate complexity by counting control flow nodes
		const complexity = this.calculateNodeComplexity(node);
		
		// Check if function is inside a class (basic heuristic)
		const isMethod = this.isInsideClass(node, ast);
		
		return this.createFunctionInfo(name, {
			parameters,
			lineStart: node.lineno,
			lineEnd: node.end_lineno,
			isAsync,
			isExported: true, // Python functions are generally accessible
			complexity,
			visibility: isMethod ? (name.startsWith('_') ? 'private' : 'public') : 'public'
		});
	}

	/**
	 * Extract classes from Python AST
	 * @param {Object} ast - Python AST
	 * @returns {Array<Object>} Array of class information
	 */
	extractClasses(ast) {
		const classes = [];
		
		const visit = (node) => {
			if (node.type === 'ClassDef') {
				const cls = this.extractClassFromNode(node, ast);
				if (cls) classes.push(cls);
			}
			
			if (node.children) {
				node.children.forEach(visit);
			}
		};
		
		visit(ast);
		return classes;
	}

	/**
	 * Extract class information from Python AST node
	 * @param {Object} node - Python class node
	 * @param {Object} ast - Full AST for context
	 * @returns {Object} Class information
	 */
	extractClassFromNode(node, ast) {
		const name = node.name || '<anonymous>';
		
		// Extract methods
		const methods = [];
		if (node.children) {
			node.children
				.filter(child => child.type === 'FunctionDef' || child.type === 'AsyncFunctionDef')
				.forEach(methodNode => {
					const method = this.extractFunctionFromNode(methodNode, ast);
					if (method) methods.push(method);
				});
		}
		
		// Extract base classes
		const baseClasses = [];
		// Python inheritance information would be in bases attribute
		
		// Calculate class complexity as sum of method complexities
		const complexity = Math.min(10, methods.reduce((sum, method) => sum + method.complexity, 1));
		
		return this.createClassInfo(name, {
			extends: baseClasses.length > 0 ? baseClasses[0] : null,
			methods,
			lineStart: node.lineno,
			lineEnd: node.end_lineno,
			isExported: true,
			complexity,
			visibility: name.startsWith('_') ? 'private' : 'public'
		});
	}

	/**
	 * Extract imports from Python AST
	 * @param {Object} ast - Python AST
	 * @returns {Array<Object>} Array of import information
	 */
	extractImports(ast) {
		const imports = [];
		
		const visit = (node) => {
			if (node.type === 'Import' || node.type === 'ImportFrom') {
				const imp = this.extractImportFromNode(node, ast);
				if (imp) imports.push(imp);
			}
			
			if (node.children) {
				node.children.forEach(visit);
			}
		};
		
		visit(ast);
		return imports;
	}

	/**
	 * Extract import information from Python AST node
	 * @param {Object} node - Python import node
	 * @param {Object} ast - Full AST for context
	 * @returns {Object} Import information
	 */
	extractImportFromNode(node, ast) {
		let source = '';
		const namedImports = [];
		
		if (node.type === 'Import') {
			// import module1, module2
			if (node.children) {
				node.children
					.filter(child => child.type === 'alias')
					.forEach(alias => {
						const moduleName = alias.name || alias.id;
						namedImports.push(alias.asname || moduleName);
						if (!source) source = moduleName;
					});
			}
		} else if (node.type === 'ImportFrom') {
			// from module import name1, name2
			source = node.module || '';
			
			if (node.children) {
				node.children
					.filter(child => child.type === 'alias')
					.forEach(alias => {
						const importName = alias.name || alias.id;
						namedImports.push(alias.asname || importName);
					});
			}
		}
		
		return this.createImportInfo(source, {
			imports: namedImports,
			lineNumber: node.lineno
		});
	}

	/**
	 * Calculate complexity of a Python AST node
	 * @param {Object} node - Python AST node
	 * @returns {number} Complexity score
	 */
	calculateNodeComplexity(node) {
		let complexity = 1; // Base complexity
		
		const visit = (n) => {
			// Add complexity for control flow statements
			if (['If', 'While', 'For', 'AsyncFor', 'Try', 'With', 'AsyncWith', 
				 'Match', 'IfExp'].includes(n.type)) {
				complexity++;
			}
			
			// Add complexity for exception handlers
			if (n.type === 'ExceptHandler') {
				complexity++;
			}
			
			// Add complexity for boolean operators
			if (n.type === 'BoolOp') {
				complexity++;
			}
			
			if (n.children) {
				n.children.forEach(visit);
			}
		};
		
		visit(node);
		return Math.min(complexity, 10); // Cap at 10
	}

	/**
	 * Calculate overall complexity score for the AST
	 * @param {Object} ast - Python AST
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
		return ['.py', '.pyx', '.pyi'];
	}

	/**
	 * Validate Python content
	 * @param {string} content - Source code content
	 * @returns {boolean} True if content appears to be valid Python
	 */
	validateContent(content) {
		if (!super.validateContent(content)) return false;
		
		// Basic Python syntax check
		const pythonPatterns = [
			/def\s+\w+\s*\(/,           // Function definitions
			/class\s+\w+/,              // Class definitions
			/import\s+\w+/,             // Import statements
			/from\s+\w+\s+import/,      // From imports
			/if\s+.*:/,                 // If statements
			/for\s+.*:/,                // For loops
			/while\s+.*:/,              // While loops
			/try\s*:/,                  // Try blocks
			/^\s*#/m                    // Comments
		];
		
		// Content should match at least one Python pattern
		return pythonPatterns.some(pattern => pattern.test(content));
	}

	/**
	 * Check if a node is inside a class
	 * @param {Object} node - AST node to check
	 * @param {Object} ast - Full AST for context
	 * @returns {boolean} True if node is inside a class
	 */
	isInsideClass(node, ast) {
		// This is a simplified check - in a real implementation,
		// we'd need to track the node hierarchy during traversal
		return false; // Placeholder for now
	}
} 