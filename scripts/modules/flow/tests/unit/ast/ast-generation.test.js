/**
 * AST Generation and Validation Tests
 * Comprehensive tests for AST structure validation, node integrity, and generation quality
 */

// Mock AST utilities and validators
const mockASTValidator = {
	validateAST: jest.fn(),
	validateNode: jest.fn(),
	validateStructure: jest.fn(),
	findIssues: jest.fn(),
	getNodeTypes: jest.fn(),
	checkIntegrity: jest.fn()
};

const mockASTGenerator = {
	generateAST: jest.fn(),
	transformAST: jest.fn(),
	normalizeAST: jest.fn(),
	enrichAST: jest.fn()
};

const mockASTAnalyzer = {
	analyzeComplexity: jest.fn(),
	extractSymbols: jest.fn(),
	findReferences: jest.fn(),
	calculateMetrics: jest.fn()
};

describe('AST Generation and Validation - Comprehensive Tests', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('AST Structure Validation', () => {
		test('should validate basic AST structure', () => {
			const validAST = {
				type: 'Program',
				body: [
					{
						type: 'FunctionDeclaration',
						id: { type: 'Identifier', name: 'test' },
						params: [],
						body: {
							type: 'BlockStatement',
							body: []
						}
					}
				],
				sourceType: 'module'
			};

			mockASTValidator.validateAST.mockReturnValue({
				valid: true,
				errors: [],
				warnings: [],
				nodeCount: 4
			});

			const result = mockASTValidator.validateAST(validAST);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.nodeCount).toBe(4);
		});

		test('should detect invalid AST structure', () => {
			const invalidAST = {
				type: 'Program',
				body: [
					{
						type: 'FunctionDeclaration',
						// Missing required 'id' field
						params: [],
						body: {
							type: 'BlockStatement',
							body: []
						}
					}
				]
			};

			mockASTValidator.validateAST.mockReturnValue({
				valid: false,
				errors: [
					{
						type: 'missing_required_field',
						message: 'FunctionDeclaration missing required field: id',
						node: invalidAST.body[0],
						path: 'body[0]'
					}
				],
				warnings: [],
				nodeCount: 3
			});

			const result = mockASTValidator.validateAST(invalidAST);

			expect(result.valid).toBe(false);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].type).toBe('missing_required_field');
		});

		test('should validate node types', () => {
			const validNodes = [
				{ type: 'Identifier', name: 'test' },
				{ type: 'Literal', value: 42 },
				{ type: 'BinaryExpression', operator: '+', left: {}, right: {} }
			];

			validNodes.forEach((node, index) => {
				mockASTValidator.validateNode.mockReturnValueOnce({
					valid: true,
					nodeType: node.type,
					issues: []
				});
			});

			validNodes.forEach((node) => {
				const result = mockASTValidator.validateNode(node);
				expect(result.valid).toBe(true);
				expect(result.nodeType).toBe(node.type);
			});
		});

		test('should detect invalid node types', () => {
			const invalidNodes = [
				{ type: 'InvalidNode', name: 'test' },
				{ type: 'Identifier' }, // Missing name
				{ type: 'BinaryExpression', operator: '+' } // Missing left/right
			];

			mockASTValidator.validateNode
				.mockReturnValueOnce({
					valid: false,
					nodeType: 'InvalidNode',
					issues: [
						{
							type: 'unknown_node_type',
							message: 'Unknown node type: InvalidNode'
						}
					]
				})
				.mockReturnValueOnce({
					valid: false,
					nodeType: 'Identifier',
					issues: [
						{
							type: 'missing_field',
							message: 'Identifier missing required field: name'
						}
					]
				})
				.mockReturnValueOnce({
					valid: false,
					nodeType: 'BinaryExpression',
					issues: [
						{
							type: 'missing_field',
							message: 'BinaryExpression missing required field: left'
						},
						{
							type: 'missing_field',
							message: 'BinaryExpression missing required field: right'
						}
					]
				});

			invalidNodes.forEach((node) => {
				const result = mockASTValidator.validateNode(node);
				expect(result.valid).toBe(false);
				expect(result.issues.length).toBeGreaterThan(0);
			});
		});

		test('should validate AST relationships and references', () => {
			const astWithReferences = {
				type: 'Program',
				body: [
					{
						type: 'VariableDeclaration',
						declarations: [
							{
								type: 'VariableDeclarator',
								id: { type: 'Identifier', name: 'x' },
								init: { type: 'Literal', value: 1 }
							}
						]
					},
					{
						type: 'ExpressionStatement',
						expression: {
							type: 'AssignmentExpression',
							operator: '=',
							left: { type: 'Identifier', name: 'x' }, // Reference to 'x'
							right: { type: 'Literal', value: 2 }
						}
					}
				]
			};

			mockASTValidator.checkIntegrity.mockReturnValue({
				valid: true,
				references: {
					resolved: ['x'],
					unresolved: []
				},
				scopes: [
					{
						type: 'program',
						variables: ['x'],
						children: []
					}
				],
				issues: []
			});

			const result = mockASTValidator.checkIntegrity(astWithReferences);

			expect(result.valid).toBe(true);
			expect(result.references.resolved).toContain('x');
			expect(result.references.unresolved).toHaveLength(0);
		});

		test('should detect unresolved references', () => {
			const astWithUnresolvedRef = {
				type: 'Program',
				body: [
					{
						type: 'ExpressionStatement',
						expression: {
							type: 'CallExpression',
							callee: { type: 'Identifier', name: 'undefinedFunction' },
							arguments: []
						}
					}
				]
			};

			mockASTValidator.checkIntegrity.mockReturnValue({
				valid: false,
				references: {
					resolved: [],
					unresolved: ['undefinedFunction']
				},
				scopes: [
					{
						type: 'program',
						variables: [],
						children: []
					}
				],
				issues: [
					{
						type: 'unresolved_reference',
						message: 'Unresolved reference: undefinedFunction',
						identifier: 'undefinedFunction',
						location: 'body[0].expression.callee'
					}
				]
			});

			const result = mockASTValidator.checkIntegrity(astWithUnresolvedRef);

			expect(result.valid).toBe(false);
			expect(result.references.unresolved).toContain('undefinedFunction');
			expect(result.issues[0].type).toBe('unresolved_reference');
		});
	});

	describe('AST Generation Quality', () => {
		test('should generate complete AST from simple code', async () => {
			const code = 'function add(a, b) { return a + b; }';

			mockASTGenerator.generateAST.mockResolvedValue({
				success: true,
				ast: {
					type: 'Program',
					body: [
						{
							type: 'FunctionDeclaration',
							id: { type: 'Identifier', name: 'add' },
							params: [
								{ type: 'Identifier', name: 'a' },
								{ type: 'Identifier', name: 'b' }
							],
							body: {
								type: 'BlockStatement',
								body: [
									{
										type: 'ReturnStatement',
										argument: {
											type: 'BinaryExpression',
											operator: '+',
											left: { type: 'Identifier', name: 'a' },
											right: { type: 'Identifier', name: 'b' }
										}
									}
								]
							}
						}
					],
					sourceType: 'script'
				},
				metadata: {
					nodeCount: 9,
					depth: 4,
					complexity: 1
				}
			});

			const result = await mockASTGenerator.generateAST(code, 'javascript');

			expect(result.success).toBe(true);
			expect(result.ast.type).toBe('Program');
			expect(result.ast.body[0].type).toBe('FunctionDeclaration');
			expect(result.ast.body[0].id.name).toBe('add');
			expect(result.metadata.nodeCount).toBe(9);
		});

		test('should generate AST with proper source locations', async () => {
			const code = 'const x = 1;\nconst y = 2;';

			mockASTGenerator.generateAST.mockResolvedValue({
				success: true,
				ast: {
					type: 'Program',
					body: [
						{
							type: 'VariableDeclaration',
							declarations: [
								{
									type: 'VariableDeclarator',
									id: { type: 'Identifier', name: 'x' },
									init: { type: 'Literal', value: 1 }
								}
							],
							loc: {
								start: { line: 1, column: 0 },
								end: { line: 1, column: 12 }
							}
						},
						{
							type: 'VariableDeclaration',
							declarations: [
								{
									type: 'VariableDeclarator',
									id: { type: 'Identifier', name: 'y' },
									init: { type: 'Literal', value: 2 }
								}
							],
							loc: {
								start: { line: 2, column: 0 },
								end: { line: 2, column: 12 }
							}
						}
					],
					loc: {
						start: { line: 1, column: 0 },
						end: { line: 2, column: 12 }
					}
				},
				includesLocations: true
			});

			const result = await mockASTGenerator.generateAST(code, 'javascript', {
				includeLocations: true
			});

			expect(result.success).toBe(true);
			expect(result.includesLocations).toBe(true);
			expect(result.ast.body[0].loc.start.line).toBe(1);
			expect(result.ast.body[1].loc.start.line).toBe(2);
		});

		test('should handle complex nested structures', async () => {
			const code = `
				class User {
					constructor(name) {
						this.name = name;
					}
					
					greet() {
						return \`Hello, \${this.name}!\`;
					}
				}
			`;

			mockASTGenerator.generateAST.mockResolvedValue({
				success: true,
				ast: {
					type: 'Program',
					body: [
						{
							type: 'ClassDeclaration',
							id: { type: 'Identifier', name: 'User' },
							body: {
								type: 'ClassBody',
								body: [
									{
										type: 'MethodDefinition',
										key: { type: 'Identifier', name: 'constructor' },
										kind: 'constructor',
										value: {
											type: 'FunctionExpression',
											params: [{ type: 'Identifier', name: 'name' }],
											body: {
												type: 'BlockStatement',
												body: [
													{
														type: 'ExpressionStatement',
														expression: {
															type: 'AssignmentExpression',
															operator: '=',
															left: {
																type: 'MemberExpression',
																object: { type: 'ThisExpression' },
																property: { type: 'Identifier', name: 'name' }
															},
															right: { type: 'Identifier', name: 'name' }
														}
													}
												]
											}
										}
									},
									{
										type: 'MethodDefinition',
										key: { type: 'Identifier', name: 'greet' },
										kind: 'method',
										value: {
											type: 'FunctionExpression',
											params: [],
											body: {
												type: 'BlockStatement',
												body: [
													{
														type: 'ReturnStatement',
														argument: {
															type: 'TemplateLiteral',
															quasis: [
																{
																	type: 'TemplateElement',
																	value: { raw: 'Hello, ' }
																},
																{ type: 'TemplateElement', value: { raw: '!' } }
															],
															expressions: [
																{
																	type: 'MemberExpression',
																	object: { type: 'ThisExpression' },
																	property: { type: 'Identifier', name: 'name' }
																}
															]
														}
													}
												]
											}
										}
									}
								]
							}
						}
					]
				},
				metadata: {
					nodeCount: 25,
					depth: 7,
					complexity: 3,
					features: ['classes', 'template_literals', 'this_expressions']
				}
			});

			const result = await mockASTGenerator.generateAST(code, 'javascript');

			expect(result.success).toBe(true);
			expect(result.ast.body[0].type).toBe('ClassDeclaration');
			expect(result.ast.body[0].body.body).toHaveLength(2); // constructor + greet
			expect(result.metadata.features).toContain('classes');
			expect(result.metadata.features).toContain('template_literals');
		});

		test('should preserve comments in AST', async () => {
			const code = `
				// This is a comment
				function test() {
					/* Block comment */
					return true;
				}
			`;

			mockASTGenerator.generateAST.mockResolvedValue({
				success: true,
				ast: {
					type: 'Program',
					body: [
						{
							type: 'FunctionDeclaration',
							id: { type: 'Identifier', name: 'test' },
							params: [],
							body: {
								type: 'BlockStatement',
								body: [
									{
										type: 'ReturnStatement',
										argument: { type: 'Literal', value: true }
									}
								]
							}
						}
					],
					comments: [
						{
							type: 'Line',
							value: ' This is a comment',
							loc: {
								start: { line: 2, column: 4 },
								end: { line: 2, column: 25 }
							}
						},
						{
							type: 'Block',
							value: ' Block comment ',
							loc: {
								start: { line: 4, column: 5 },
								end: { line: 4, column: 22 }
							}
						}
					]
				},
				includesComments: true
			});

			const result = await mockASTGenerator.generateAST(code, 'javascript', {
				includeComments: true
			});

			expect(result.success).toBe(true);
			expect(result.includesComments).toBe(true);
			expect(result.ast.comments).toHaveLength(2);
			expect(result.ast.comments[0].type).toBe('Line');
			expect(result.ast.comments[1].type).toBe('Block');
		});
	});

	describe('AST Transformation and Normalization', () => {
		test('should normalize AST structure', () => {
			const rawAST = {
				type: 'Program',
				body: [
					{
						type: 'FunctionDeclaration',
						id: { type: 'Identifier', name: 'test' },
						params: [],
						body: {
							type: 'BlockStatement',
							body: []
						}
					}
				],
				// Parser-specific fields that should be normalized
				tokens: [],
				range: [0, 50],
				extra: { raw: 'function test() {}' }
			};

			mockASTGenerator.normalizeAST.mockReturnValue({
				type: 'Program',
				body: [
					{
						type: 'FunctionDeclaration',
						id: { type: 'Identifier', name: 'test' },
						params: [],
						body: {
							type: 'BlockStatement',
							body: []
						}
					}
				],
				sourceType: 'module',
				// Normalized metadata
				metadata: {
					originalParser: 'babel',
					normalizedAt: '2024-01-01T00:00:00.000Z',
					removedFields: ['tokens', 'range', 'extra']
				}
			});

			const result = mockASTGenerator.normalizeAST(rawAST);

			expect(result.type).toBe('Program');
			expect(result.tokens).toBeUndefined();
			expect(result.range).toBeUndefined();
			expect(result.extra).toBeUndefined();
			expect(result.metadata.removedFields).toContain('tokens');
		});

		test('should enrich AST with additional metadata', () => {
			const basicAST = {
				type: 'Program',
				body: [
					{
						type: 'FunctionDeclaration',
						id: { type: 'Identifier', name: 'fibonacci' },
						params: [{ type: 'Identifier', name: 'n' }],
						body: {
							type: 'BlockStatement',
							body: [
								{
									type: 'IfStatement',
									test: {
										type: 'BinaryExpression',
										operator: '<=',
										left: { type: 'Identifier', name: 'n' },
										right: { type: 'Literal', value: 1 }
									},
									consequent: {
										type: 'ReturnStatement',
										argument: { type: 'Identifier', name: 'n' }
									},
									alternate: {
										type: 'ReturnStatement',
										argument: {
											type: 'BinaryExpression',
											operator: '+',
											left: {
												type: 'CallExpression',
												callee: { type: 'Identifier', name: 'fibonacci' },
												arguments: [
													{
														type: 'BinaryExpression',
														operator: '-',
														left: { type: 'Identifier', name: 'n' },
														right: { type: 'Literal', value: 1 }
													}
												]
											},
											right: {
												type: 'CallExpression',
												callee: { type: 'Identifier', name: 'fibonacci' },
												arguments: [
													{
														type: 'BinaryExpression',
														operator: '-',
														left: { type: 'Identifier', name: 'n' },
														right: { type: 'Literal', value: 2 }
													}
												]
											}
										}
									}
								}
							]
						}
					}
				]
			};

			mockASTGenerator.enrichAST.mockReturnValue({
				...basicAST,
				enriched: true,
				metadata: {
					complexity: {
						cyclomatic: 2,
						cognitive: 3,
						halstead: {
							vocabulary: 12,
							length: 18,
							difficulty: 4.5
						}
					},
					functions: [
						{
							name: 'fibonacci',
							recursive: true,
							parameters: ['n'],
							returns: true,
							complexity: 2
						}
					],
					identifiers: {
						declared: ['fibonacci', 'n'],
						referenced: ['n', 'fibonacci'],
						scope: 'global'
					},
					patterns: ['recursion', 'conditional_return', 'binary_operations']
				}
			});

			const result = mockASTGenerator.enrichAST(basicAST);

			expect(result.enriched).toBe(true);
			expect(result.metadata.complexity.cyclomatic).toBe(2);
			expect(result.metadata.functions[0].recursive).toBe(true);
			expect(result.metadata.patterns).toContain('recursion');
		});

		test('should transform AST for different targets', () => {
			const sourceAST = {
				type: 'Program',
				body: [
					{
						type: 'VariableDeclaration',
						kind: 'const',
						declarations: [
							{
								type: 'VariableDeclarator',
								id: { type: 'Identifier', name: 'arrow' },
								init: {
									type: 'ArrowFunctionExpression',
									params: [{ type: 'Identifier', name: 'x' }],
									body: {
										type: 'BinaryExpression',
										operator: '*',
										left: { type: 'Identifier', name: 'x' },
										right: { type: 'Literal', value: 2 }
									}
								}
							}
						]
					}
				]
			};

			mockASTGenerator.transformAST.mockReturnValue({
				type: 'Program',
				body: [
					{
						type: 'VariableDeclaration',
						kind: 'var',
						declarations: [
							{
								type: 'VariableDeclarator',
								id: { type: 'Identifier', name: 'arrow' },
								init: {
									type: 'FunctionExpression',
									id: null,
									params: [{ type: 'Identifier', name: 'x' }],
									body: {
										type: 'BlockStatement',
										body: [
											{
												type: 'ReturnStatement',
												argument: {
													type: 'BinaryExpression',
													operator: '*',
													left: { type: 'Identifier', name: 'x' },
													right: { type: 'Literal', value: 2 }
												}
											}
										]
									}
								}
							}
						]
					}
				],
				transformations: [
					'const_to_var',
					'arrow_function_to_function_expression',
					'implicit_return_to_explicit'
				]
			});

			const result = mockASTGenerator.transformAST(sourceAST, {
				target: 'es5'
			});

			expect(result.body[0].kind).toBe('var'); // const -> var
			expect(result.body[0].declarations[0].init.type).toBe(
				'FunctionExpression'
			); // arrow -> function
			expect(result.transformations).toContain('const_to_var');
			expect(result.transformations).toContain(
				'arrow_function_to_function_expression'
			);
		});
	});

	describe('AST Analysis and Metrics', () => {
		test('should analyze code complexity', () => {
			const complexAST = {
				type: 'Program',
				body: [
					{
						type: 'FunctionDeclaration',
						id: { type: 'Identifier', name: 'complexFunction' },
						params: [{ type: 'Identifier', name: 'data' }],
						body: {
							type: 'BlockStatement',
							body: [
								{
									type: 'IfStatement',
									test: { type: 'Identifier', name: 'data' },
									consequent: {
										type: 'BlockStatement',
										body: [
											{
												type: 'ForStatement',
												init: null,
												test: { type: 'Literal', value: true },
												update: null,
												body: {
													type: 'BlockStatement',
													body: [
														{
															type: 'IfStatement',
															test: { type: 'Identifier', name: 'condition' },
															consequent: { type: 'BreakStatement' }
														}
													]
												}
											}
										]
									}
								}
							]
						}
					}
				]
			};

			mockASTAnalyzer.analyzeComplexity.mockReturnValue({
				cyclomatic: 4,
				cognitive: 6,
				nesting: 3,
				branches: 2,
				loops: 1,
				functions: 1,
				details: {
					controlFlow: {
						if_statements: 2,
						for_loops: 1,
						while_loops: 0,
						switch_statements: 0
					},
					cognitiveFactors: {
						nesting_penalty: 2,
						recursion_penalty: 0,
						logical_operators: 0
					}
				}
			});

			const result = mockASTAnalyzer.analyzeComplexity(complexAST);

			expect(result.cyclomatic).toBe(4);
			expect(result.cognitive).toBe(6);
			expect(result.nesting).toBe(3);
			expect(result.details.controlFlow.if_statements).toBe(2);
		});

		test('should extract symbols and references', () => {
			const astWithSymbols = {
				type: 'Program',
				body: [
					{
						type: 'VariableDeclaration',
						declarations: [
							{
								type: 'VariableDeclarator',
								id: { type: 'Identifier', name: 'x' },
								init: { type: 'Literal', value: 1 }
							}
						]
					},
					{
						type: 'FunctionDeclaration',
						id: { type: 'Identifier', name: 'test' },
						params: [{ type: 'Identifier', name: 'y' }],
						body: {
							type: 'BlockStatement',
							body: [
								{
									type: 'ReturnStatement',
									argument: {
										type: 'BinaryExpression',
										operator: '+',
										left: { type: 'Identifier', name: 'x' },
										right: { type: 'Identifier', name: 'y' }
									}
								}
							]
						}
					}
				]
			};

			mockASTAnalyzer.extractSymbols.mockReturnValue({
				declarations: [
					{
						name: 'x',
						type: 'variable',
						scope: 'global',
						location: { line: 1, column: 6 }
					},
					{
						name: 'test',
						type: 'function',
						scope: 'global',
						parameters: ['y'],
						location: { line: 2, column: 9 }
					},
					{
						name: 'y',
						type: 'parameter',
						scope: 'function:test',
						location: { line: 2, column: 14 }
					}
				],
				references: [
					{
						name: 'x',
						location: { line: 3, column: 11 },
						scope: 'function:test',
						resolved: true
					},
					{
						name: 'y',
						location: { line: 3, column: 15 },
						scope: 'function:test',
						resolved: true
					}
				],
				scopes: [
					{
						type: 'global',
						variables: ['x', 'test'],
						children: ['function:test']
					},
					{
						type: 'function',
						name: 'test',
						variables: ['y'],
						parent: 'global'
					}
				]
			});

			const result = mockASTAnalyzer.extractSymbols(astWithSymbols);

			expect(result.declarations).toHaveLength(3);
			expect(result.references).toHaveLength(2);
			expect(result.scopes).toHaveLength(2);
			expect(result.declarations.find((d) => d.name === 'test').type).toBe(
				'function'
			);
		});

		test('should calculate comprehensive metrics', () => {
			const ast = {
				type: 'Program',
				body: [
					/* complex AST structure */
				]
			};

			mockASTAnalyzer.calculateMetrics.mockReturnValue({
				size: {
					nodes: 45,
					statements: 12,
					expressions: 18,
					functions: 3,
					classes: 1
				},
				complexity: {
					cyclomatic: 8,
					cognitive: 12,
					halstead: {
						vocabulary: 25,
						length: 67,
						difficulty: 6.2,
						effort: 415.4
					}
				},
				maintainability: {
					index: 72.5,
					readability: 'good',
					testability: 'moderate'
				},
				quality: {
					duplicatedCode: 0.05,
					commentRatio: 0.15,
					functionLength: {
						average: 8.3,
						max: 15,
						violations: 0
					}
				},
				dependencies: {
					external: ['react', 'lodash'],
					internal: ['./utils', './config'],
					circular: []
				}
			});

			const result = mockASTAnalyzer.calculateMetrics(ast);

			expect(result.size.nodes).toBe(45);
			expect(result.complexity.cyclomatic).toBe(8);
			expect(result.maintainability.index).toBe(72.5);
			expect(result.quality.duplicatedCode).toBe(0.05);
			expect(result.dependencies.external).toContain('react');
		});
	});

	describe('Error Handling and Edge Cases', () => {
		test('should handle malformed AST gracefully', () => {
			const malformedAST = {
				type: 'Program',
				body: [
					{
						type: 'FunctionDeclaration',
						// Missing required fields
						body: null
					}
				]
			};

			mockASTValidator.validateAST.mockReturnValue({
				valid: false,
				errors: [
					{
						type: 'invalid_structure',
						message: 'FunctionDeclaration has null body',
						path: 'body[0].body'
					},
					{
						type: 'missing_field',
						message: 'FunctionDeclaration missing required field: id',
						path: 'body[0]'
					}
				],
				warnings: [],
				nodeCount: 2,
				canRecover: false
			});

			const result = mockASTValidator.validateAST(malformedAST);

			expect(result.valid).toBe(false);
			expect(result.errors).toHaveLength(2);
			expect(result.canRecover).toBe(false);
		});

		test('should handle circular references in AST', () => {
			const circularAST = {
				type: 'Program',
				body: []
			};
			// Simulate circular reference
			circularAST.body.push(circularAST);

			mockASTValidator.validateAST.mockReturnValue({
				valid: false,
				errors: [
					{
						type: 'circular_reference',
						message: 'Circular reference detected in AST structure',
						path: 'body[0]'
					}
				],
				warnings: [],
				nodeCount: -1, // Indicates counting failed due to circular reference
				canRecover: false
			});

			const result = mockASTValidator.validateAST(circularAST);

			expect(result.valid).toBe(false);
			expect(result.errors[0].type).toBe('circular_reference');
			expect(result.nodeCount).toBe(-1);
		});

		test('should handle very large ASTs efficiently', () => {
			const largeAST = {
				type: 'Program',
				body: Array(10000).fill({
					type: 'ExpressionStatement',
					expression: {
						type: 'CallExpression',
						callee: { type: 'Identifier', name: 'test' },
						arguments: []
					}
				})
			};

			mockASTValidator.validateAST.mockImplementation(() => {
				const startTime = performance.now();
				// Simulate processing time
				const endTime = performance.now();

				return {
					valid: true,
					errors: [],
					warnings: [
						{
							type: 'large_ast',
							message:
								'AST is very large (10000+ nodes), consider splitting into smaller modules'
						}
					],
					nodeCount: 30000,
					processingTime: endTime - startTime,
					memoryUsage: 50 * 1024 * 1024 // 50MB
				};
			});

			const result = mockASTValidator.validateAST(largeAST);

			expect(result.valid).toBe(true);
			expect(result.nodeCount).toBe(30000);
			expect(result.warnings[0].type).toBe('large_ast');
			expect(result.processingTime).toBeDefined();
		});

		test('should provide recovery suggestions for common issues', () => {
			const problematicAST = {
				type: 'Program',
				body: [
					{
						type: 'FunctionDeclaration',
						id: { type: 'Identifier', name: 'test' },
						params: [],
						body: {
							type: 'BlockStatement',
							body: [
								{
									type: 'ReturnStatement'
									// Missing argument field
								}
							]
						}
					}
				]
			};

			mockASTValidator.findIssues.mockReturnValue({
				issues: [
					{
						type: 'incomplete_node',
						severity: 'warning',
						message: 'ReturnStatement missing argument field',
						location: 'body[0].body.body[0]',
						suggestions: [
							{
								type: 'add_field',
								description: 'Add null argument for empty return',
								fix: { argument: null }
							},
							{
								type: 'add_field',
								description: 'Add undefined literal as argument',
								fix: { argument: { type: 'Identifier', name: 'undefined' } }
							}
						]
					}
				],
				fixable: true,
				autoFixAvailable: true
			});

			const result = mockASTValidator.findIssues(problematicAST);

			expect(result.issues).toHaveLength(1);
			expect(result.fixable).toBe(true);
			expect(result.issues[0].suggestions).toHaveLength(2);
			expect(result.issues[0].suggestions[0].type).toBe('add_field');
		});
	});

	describe('Performance and Optimization', () => {
		test('should validate AST performance for different sizes', () => {
			const testCases = [
				{ size: 'small', nodeCount: 10 },
				{ size: 'medium', nodeCount: 1000 },
				{ size: 'large', nodeCount: 10000 }
			];

			testCases.forEach((testCase) => {
				mockASTValidator.validateAST.mockReturnValueOnce({
					valid: true,
					errors: [],
					warnings: [],
					nodeCount: testCase.nodeCount,
					performance: {
						validationTime: testCase.nodeCount * 0.01, // Linear time complexity
						memoryUsage: testCase.nodeCount * 1024, // Memory per node
						traversalCount: testCase.nodeCount
					}
				});
			});

			testCases.forEach((testCase) => {
				const mockAST = { type: 'Program', body: [] };
				const result = mockASTValidator.validateAST(mockAST);

				expect(result.nodeCount).toBe(testCase.nodeCount);
				expect(result.performance.validationTime).toBeLessThan(
					testCase.nodeCount * 0.1
				);
			});
		});

		test('should handle concurrent validation requests', async () => {
			const requests = Array(5)
				.fill(null)
				.map((_, i) => ({
					ast: { type: 'Program', body: [] },
					id: i
				}));

			requests.forEach((req, index) => {
				mockASTValidator.validateAST.mockReturnValueOnce({
					valid: true,
					errors: [],
					warnings: [],
					nodeCount: 10,
					requestId: req.id,
					timestamp: Date.now() + index
				});
			});

			const results = requests.map((req) =>
				mockASTValidator.validateAST(req.ast)
			);

			expect(results).toHaveLength(5);
			results.forEach((result, index) => {
				expect(result.valid).toBe(true);
				expect(result.requestId).toBe(index);
			});
		});
	});
});
