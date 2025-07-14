/**
 * Go Parser using Go's built-in go/ast package
 * Parses Go files via child process and extracts AST information for analysis
 */

import { BaseParser, AST_NODE_TYPES } from './base-parser.js';
import { spawn } from 'child_process';
import { writeFile, unlink, mkdir, rmdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Go parser implementation
 * Uses Go's go/ast package via child process for robust Go parsing
 */
export class GoParser extends BaseParser {
	constructor(options = {}) {
		super('go', options);
		this.goExecutable = options.goExecutable || 'go';
		this.tempFilePrefix = 'taskmaster_go_ast_';
	}

	/**
	 * Parse Go source code
	 * @param {string} filePath - Path to the source file
	 * @param {string} content - Source code content
	 * @returns {Promise<Object>} Parsed AST result
	 */
	async parse(filePath, content) {
		if (!this.validateContent(content)) {
			return this.handleParsingError(new Error('Invalid content'), filePath);
		}

		try {
			const ast = await this.parseWithGo(filePath, content);
			return this.createAnalysisResult(ast, filePath);
		} catch (error) {
			return this.handleParsingError(error, filePath);
		}
	}

	/**
	 * Parse using Go ast package via child process
	 * @param {string} filePath - Path to the source file
	 * @param {string} content - Source code content
	 * @returns {Promise<Object>} Go AST as JSON
	 */
	async parseWithGo(filePath, content) {
		// Create temporary files for Go program and source code in separate directories
		const tempDir = '/tmp';
		const timestamp = Date.now();
		const parserDir = join(tempDir, `taskmaster_parser_${timestamp}`);
		const sourceDir = join(tempDir, `taskmaster_source_${timestamp}`);
		const tempGoFile = join(parserDir, 'parser.go');
		const tempSourceFile = join(sourceDir, 'source.go');

		try {
			// Create the directories
			await mkdir(parserDir, { recursive: true });
			await mkdir(sourceDir, { recursive: true });

			// Write the Go parser program
			const goProgram = this.createGoParserProgram();
			await writeFile(tempGoFile, goProgram);

			// Write the source code to parse
			await writeFile(tempSourceFile, content);

			return new Promise((resolve, reject) => {
				// Run the Go parser program with the source file path as argument
				const go = spawn(this.goExecutable, ['run', tempGoFile], {
					cwd: parserDir,
					env: { ...process.env, GOPATH: tempDir }
				});

				// Send the source file path as input to the program
				go.stdin.write(tempSourceFile);
				go.stdin.end();

				let stdout = '';
				let stderr = '';

				go.stdout.on('data', (data) => {
					stdout += data.toString();
				});

				go.stderr.on('data', (data) => {
					stderr += data.toString();
				});

				go.on('close', async (code) => {
					// Clean up temporary files and directories
					try {
						await unlink(tempGoFile);
						await unlink(tempSourceFile);
						await rmdir(parserDir);
						await rmdir(sourceDir);
					} catch (cleanupError) {
						// Ignore cleanup errors
					}

					if (code !== 0) {
						reject(
							new Error(`Go parsing failed: ${stderr || 'Unknown error'}`)
						);
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
						reject(
							new Error(`Failed to parse Go AST JSON: ${parseError.message}`)
						);
					}
				});

				go.on('error', async (error) => {
					// Clean up temporary files and directories on error
					try {
						await unlink(tempGoFile);
						await unlink(tempSourceFile);
						await rmdir(parserDir);
						await rmdir(sourceDir);
					} catch (cleanupError) {
						// Ignore cleanup errors
					}
					reject(new Error(`Failed to spawn Go process: ${error.message}`));
				});
			});
		} catch (error) {
			// Clean up any created files and directories
			try {
				await unlink(tempGoFile);
				await unlink(tempSourceFile);
				await rmdir(parserDir);
				await rmdir(sourceDir);
			} catch (cleanupError) {
				// Ignore cleanup errors
			}
			throw error;
		}
	}

	/**
	 * Create Go program for AST parsing
	 * @returns {string} Go program code
	 */
	createGoParserProgram() {
		// Create a simpler, more robust Go program
		const lines = [
			'package main',
			'',
			'import (',
			'	"encoding/json"',
			'	"fmt"',
			'	"go/ast"',
			'	"go/parser"',
			'	"go/token"',
			'	"os"',
			'	"reflect"',
			'	"strings"',
			')',
			'',
			'type ASTNode struct {',
			'	Type     string                 `json:"type"`',
			'	Name     string                 `json:"name,omitempty"`',
			'	Line     int                    `json:"line,omitempty"`',
			'	Col      int                    `json:"col,omitempty"`',
			'	EndLine  int                    `json:"endLine,omitempty"`',
			'	EndCol   int                    `json:"endCol,omitempty"`',
			'	Children []ASTNode              `json:"children,omitempty"`',
			'	Fields   map[string]interface{} `json:"fields,omitempty"`',
			'}',
			'',
			'type Result struct {',
			'	AST   *ASTNode `json:"ast"`',
			'	Error string   `json:"error,omitempty"`',
			'}',
			'',
			'func analyzeNode(fset *token.FileSet, node ast.Node) *ASTNode {',
			'	if node == nil {',
			'		return nil',
			'	}',
			'',
			'	pos := fset.Position(node.Pos())',
			'	end := fset.Position(node.End())',
			'	',
			'	astNode := &ASTNode{',
			'		Type:    reflect.TypeOf(node).Elem().Name(),',
			'		Line:    pos.Line,',
			'		Col:     pos.Column,',
			'		EndLine: end.Line,',
			'		EndCol:  end.Column,',
			'		Fields:  make(map[string]interface{}),',
			'	}',
			'',
			'	switch n := node.(type) {',
			'	case *ast.FuncDecl:',
			'		if n.Name != nil {',
			'			astNode.Name = n.Name.Name',
			'			astNode.Fields["exported"] = n.Name.IsExported()',
			'		}',
			'	case *ast.TypeSpec:',
			'		if n.Name != nil {',
			'			astNode.Name = n.Name.Name',
			'			astNode.Fields["exported"] = n.Name.IsExported()',
			'		}',
			'	case *ast.ImportSpec:',
			'		if n.Path != nil {',
			'			astNode.Fields["path"] = strings.Trim(n.Path.Value, "\\"") ',
			'		}',
			'		if n.Name != nil {',
			'			astNode.Fields["alias"] = n.Name.Name',
			'		}',
			'	case *ast.Ident:',
			'		astNode.Name = n.Name',
			'		astNode.Fields["exported"] = n.IsExported()',
			'	}',
			'',
			'	if file, ok := node.(*ast.File); ok {',
			'		for _, child := range file.Decls {',
			'			if child != nil {',
			'				childNode := analyzeNode(fset, child)',
			'				if childNode != nil {',
			'					astNode.Children = append(astNode.Children, *childNode)',
			'				}',
			'			}',
			'		}',
			'	}',
			'',
			'	return astNode',
			'}',
			'',
			'func main() {',
			'	var sourceFile string',
			'	fmt.Scanln(&sourceFile)',
			'	',
			'	if sourceFile == "" {',
			'		result := Result{Error: "No source file provided"}',
			'		json.NewEncoder(os.Stdout).Encode(result)',
			'		return',
			'	}',
			'	sourceBytes, err := os.ReadFile(sourceFile)',
			'	if err != nil {',
			'		result := Result{Error: fmt.Sprintf("Failed to read: %v", err)}',
			'		json.NewEncoder(os.Stdout).Encode(result)',
			'		return',
			'	}',
			'	',
			'	sourceCode := string(sourceBytes)',
			'	',
			'	fset := token.NewFileSet()',
			'	file, err := parser.ParseFile(fset, "input.go", sourceCode, 0)',
			'	',
			'	if err != nil {',
			'		result := Result{Error: fmt.Sprintf("Parse error: %v", err)}',
			'		json.NewEncoder(os.Stdout).Encode(result)',
			'		return',
			'	}',
			'	',
			'	astNode := analyzeNode(fset, file)',
			'	',
			'	result := Result{AST: astNode}',
			'	json.NewEncoder(os.Stdout).Encode(result)',
			'}'
		];

		return lines.join('\n');
	}

	/**
	 * Extract functions from Go AST
	 * @param {Object} ast - Go AST
	 * @returns {Array<Object>} Array of function information
	 */
	extractFunctions(ast) {
		const functions = [];

		const visit = (node) => {
			if (node.type === 'FuncDecl') {
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
	 * Extract function information from Go AST node
	 * @param {Object} node - Go function node
	 * @param {Object} ast - Full AST for context
	 * @returns {Object} Function information
	 */
	extractFunctionFromNode(node, ast) {
		const name = node.name || '<anonymous>';
		const isExported = node.fields?.exported || false;

		// Extract parameters
		const parameters = [];
		if (node.fields?.params) {
			node.fields.params.forEach((paramName) => {
				parameters.push({
					name: paramName,
					type: null // Go type information would need more parsing
				});
			});
		}

		// Calculate complexity by counting control flow nodes
		const complexity = this.calculateNodeComplexity(node);

		return this.createFunctionInfo(name, {
			parameters,
			lineStart: node.line,
			lineEnd: node.endLine,
			isAsync: false, // Go doesn't have async functions like JS
			isExported,
			complexity,
			visibility: isExported ? 'public' : 'private'
		});
	}

	/**
	 * Extract types/structs from Go AST (equivalent to classes)
	 * @param {Object} ast - Go AST
	 * @returns {Array<Object>} Array of type information
	 */
	extractClasses(ast) {
		const types = [];

		const visit = (node) => {
			if (node.type === 'TypeSpec') {
				const type = this.extractTypeFromNode(node, ast);
				if (type) types.push(type);
			}

			if (node.children) {
				node.children.forEach(visit);
			}
		};

		visit(ast);
		return types;
	}

	/**
	 * Extract type information from Go AST node
	 * @param {Object} node - Go type node
	 * @param {Object} ast - Full AST for context
	 * @returns {Object} Type information
	 */
	extractTypeFromNode(node, ast) {
		const name = node.name || '<anonymous>';
		const isExported = node.fields?.exported || false;

		// Extract methods - would need to find functions with receiver matching this type
		const methods = [];

		// Extract fields for struct types
		const properties = [];
		if (node.children) {
			node.children.forEach((child) => {
				if (child.type === 'StructType' && child.fields?.fieldNames) {
					child.fields.fieldNames.forEach((fieldName) => {
						properties.push({
							name: fieldName,
							type: null,
							visibility:
								fieldName[0] === fieldName[0].toUpperCase()
									? 'public'
									: 'private'
						});
					});
				}
			});
		}

		// Calculate type complexity
		const complexity = Math.min(
			10,
			methods.reduce((sum, method) => sum + (method.complexity || 1), 1)
		);

		return this.createClassInfo(name, {
			methods,
			properties,
			lineStart: node.line,
			lineEnd: node.endLine,
			isExported,
			complexity,
			visibility: isExported ? 'public' : 'private'
		});
	}

	/**
	 * Extract imports from Go AST
	 * @param {Object} ast - Go AST
	 * @returns {Array<Object>} Array of import information
	 */
	extractImports(ast) {
		const imports = [];

		const visit = (node) => {
			if (node.type === 'ImportSpec') {
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
	 * Extract import information from Go AST node
	 * @param {Object} node - Go import node
	 * @param {Object} ast - Full AST for context
	 * @returns {Object} Import information
	 */
	extractImportFromNode(node, ast) {
		const source = node.fields?.path || '';
		const alias = node.fields?.alias || null;

		return this.createImportInfo(source, {
			imports: [alias || source.split('/').pop()], // Use alias or last part of path
			defaultImport: alias,
			lineNumber: node.line
		});
	}

	/**
	 * Calculate complexity of a Go AST node
	 * @param {Object} node - Go AST node
	 * @returns {number} Complexity score
	 */
	calculateNodeComplexity(node) {
		let complexity = 1; // Base complexity

		const visit = (n) => {
			// Add complexity for control flow statements
			if (
				[
					'IfStmt',
					'ForStmt',
					'RangeStmt',
					'SwitchStmt',
					'TypeSwitchStmt',
					'SelectStmt',
					'CaseClause',
					'CommClause'
				].includes(n.type)
			) {
				complexity++;
			}

			// Add complexity for function literals (closures)
			if (n.type === 'FuncLit') {
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
	 * @param {Object} ast - Go AST
	 * @returns {number} Complexity score (1-10)
	 */
	calculateComplexity(ast) {
		const functions = this.extractFunctions(ast);
		const types = this.extractClasses(ast);

		if (functions.length === 0 && types.length === 0) return 1;

		// Calculate average complexity
		const totalComplexity = [
			...functions.map((f) => f.complexity || 1),
			...types.map((t) => t.complexity || 1)
		].reduce((sum, c) => sum + c, 0);

		const itemCount = functions.length + types.length;
		const avgComplexity = totalComplexity / itemCount;

		return Math.min(Math.ceil(avgComplexity), 10);
	}

	/**
	 * Get file extensions supported by this parser
	 * @returns {Array<string>} Array of file extensions
	 */
	getSupportedExtensions() {
		return ['.go'];
	}

	/**
	 * Validate Go content
	 * @param {string} content - Source code content
	 * @returns {boolean} True if content appears to be valid Go
	 */
	validateContent(content) {
		if (!super.validateContent(content)) return false;

		// Basic Go syntax check
		const goPatterns = [
			/package\s+\w+/, // Package declaration
			/func\s+\w+\s*\(/, // Function definitions
			/type\s+\w+\s+struct/, // Struct definitions
			/type\s+\w+\s+interface/, // Interface definitions
			/import\s*[\("]/, // Import statements
			/var\s+\w+/, // Variable declarations
			/const\s+\w+/, // Constant declarations
			/if\s+.*\{/, // If statements
			/for\s+.*\{/, // For loops
			/switch\s+.*\{/, // Switch statements
			/^\s*\/\//m // Comments
		];

		// Content should match at least one Go pattern
		return goPatterns.some((pattern) => pattern.test(content));
	}
}
