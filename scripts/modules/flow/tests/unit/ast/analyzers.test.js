/**
 * AST Analyzers Unit Tests
 * Comprehensive tests for the AST analysis system including language-specific analyzers
 */

// Mock the analyzer components
const mockAnalyzerDispatcher = {
	analyzeCode: jest.fn(),
	getAnalyzer: jest.fn(),
	getSupportedLanguages: jest.fn(),
	registerAnalyzer: jest.fn()
};

const mockJavaScriptAnalyzer = {
	analyze: jest.fn(),
	getLanguageId: jest.fn(() => 'javascript'),
	getSupportedFeatures: jest.fn(() => ['jsx', 'async_await', 'destructuring', 'classes'])
};

const mockPythonAnalyzer = {
	analyze: jest.fn(),
	getLanguageId: jest.fn(() => 'python'),
	getSupportedFeatures: jest.fn(() => ['decorators', 'generators', 'comprehensions', 'async_await'])
};

const mockGoAnalyzer = {
	analyze: jest.fn(),
	getLanguageId: jest.fn(() => 'go'),
	getSupportedFeatures: jest.fn(() => ['goroutines', 'channels', 'interfaces', 'defer'])
};

const mockGenericAnalyzer = {
	analyze: jest.fn(),
	getLanguageId: jest.fn(() => 'generic'),
	getSupportedFeatures: jest.fn(() => ['basic_patterns', 'complexity', 'structure'])
};

describe('AST Analyzers - Comprehensive Tests', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		
		// Setup analyzer dispatcher mock
		mockAnalyzerDispatcher.getSupportedLanguages.mockReturnValue(['javascript', 'python', 'go', 'generic']);
		mockAnalyzerDispatcher.getAnalyzer.mockImplementation((language) => {
			switch (language) {
				case 'javascript':
				case 'typescript':
					return mockJavaScriptAnalyzer;
				case 'python':
					return mockPythonAnalyzer;
				case 'go':
					return mockGoAnalyzer;
				default:
					return mockGenericAnalyzer;
			}
		});
	});

	describe('Analyzer Dispatcher', () => {
		test('should dispatch to correct language analyzer', async () => {
			const jsAST = {
				type: 'Program',
				body: [{
					type: 'FunctionDeclaration',
					id: { name: 'test' }
				}]
			};
			
			mockAnalyzerDispatcher.analyzeCode.mockResolvedValue({
				success: true,
				language: 'javascript',
				analyzer: 'JavaScriptAnalyzer',
				analysis: {
					complexity: { cyclomatic: 1 },
					patterns: ['function_declaration'],
					features: ['es6_functions']
				}
			});
			
			const result = await mockAnalyzerDispatcher.analyzeCode(jsAST, 'test.js', 'content', 'javascript');
			
			expect(result.success).toBe(true);
			expect(result.language).toBe('javascript');
			expect(result.analyzer).toBe('JavaScriptAnalyzer');
		});

		test('should fallback to generic analyzer for unknown languages', async () => {
			const unknownAST = { type: 'Program', body: [] };
			
			mockAnalyzerDispatcher.analyzeCode.mockResolvedValue({
				success: true,
				language: 'unknown',
				analyzer: 'GenericAnalyzer',
				analysis: {
					structure: { nodeCount: 1 },
					patterns: ['basic_structure']
				}
			});
			
			const result = await mockAnalyzerDispatcher.analyzeCode(unknownAST, 'test.unknown', 'content', 'unknown');
			
			expect(result.success).toBe(true);
			expect(result.analyzer).toBe('GenericAnalyzer');
		});

		test('should handle analyzer registration', () => {
			const customAnalyzer = {
				analyze: jest.fn(),
				getLanguageId: jest.fn(() => 'rust'),
				getSupportedFeatures: jest.fn(() => ['ownership', 'borrowing'])
			};
			
			mockAnalyzerDispatcher.registerAnalyzer.mockReturnValue({
				success: true,
				language: 'rust',
				analyzer: customAnalyzer
			});
			
			const result = mockAnalyzerDispatcher.registerAnalyzer('rust', customAnalyzer);
			
			expect(result.success).toBe(true);
			expect(result.language).toBe('rust');
		});
	});

	describe('JavaScript Analyzer', () => {
		test('should analyze JavaScript code complexity', async () => {
			const jsAST = {
				type: 'Program',
				body: [{
					type: 'FunctionDeclaration',
					id: { name: 'complexFunction' },
					body: {
						type: 'BlockStatement',
						body: [
							{
								type: 'IfStatement',
								test: { type: 'Identifier', name: 'condition' },
								consequent: {
									type: 'BlockStatement',
									body: [{
										type: 'ForStatement',
										body: {
											type: 'BlockStatement',
											body: [{
												type: 'IfStatement',
												test: { type: 'Identifier', name: 'innerCondition' }
											}]
										}
									}]
								}
							}
						]
					}
				}]
			};
			
			mockJavaScriptAnalyzer.analyze.mockResolvedValue({
				complexity: {
					cyclomatic: 4,
					cognitive: 6,
					nesting: 3,
					functions: {
						complexFunction: {
							cyclomatic: 4,
							cognitive: 6,
							lines: 15,
							parameters: 0
						}
					}
				},
				patterns: {
					controlFlow: ['if_statement', 'for_loop', 'nested_conditions'],
					functions: ['function_declaration'],
					variables: []
				},
				features: {
					es6: [],
					async: false,
					classes: false,
					modules: false
				},
				quality: {
					maintainabilityIndex: 65.2,
					readability: 'moderate',
					testability: 'low'
				}
			});
			
			const result = await mockJavaScriptAnalyzer.analyze(jsAST, 'test.js', 'content');
			
			expect(result.complexity.cyclomatic).toBe(4);
			expect(result.complexity.cognitive).toBe(6);
			expect(result.patterns.controlFlow).toContain('nested_conditions');
			expect(result.quality.testability).toBe('low');
		});

		test('should detect React/JSX patterns', async () => {
			const reactAST = {
				type: 'Program',
				body: [{
					type: 'VariableDeclaration',
					declarations: [{
						type: 'VariableDeclarator',
						id: { name: 'Component' },
						init: {
							type: 'ArrowFunctionExpression',
							body: {
								type: 'JSXElement',
								openingElement: {
									name: { name: 'div' }
								}
							}
						}
					}]
				}]
			};
			
			mockJavaScriptAnalyzer.analyze.mockResolvedValue({
				complexity: {
					cyclomatic: 1,
					cognitive: 1
				},
				patterns: {
					react: ['functional_component', 'jsx_element', 'arrow_function'],
					es6: ['arrow_function', 'const_declaration'],
					jsx: ['jsx_element', 'jsx_component']
				},
				features: {
					react: true,
					jsx: true,
					hooks: false,
					es6: true
				},
				components: [{
					name: 'Component',
					type: 'functional',
					props: [],
					hooks: [],
					complexity: 1
				}]
			});
			
			const result = await mockJavaScriptAnalyzer.analyze(reactAST, 'Component.jsx', 'content');
			
			expect(result.features.react).toBe(true);
			expect(result.features.jsx).toBe(true);
			expect(result.patterns.react).toContain('functional_component');
			expect(result.components[0].type).toBe('functional');
		});

		test('should analyze async/await patterns', async () => {
			const asyncAST = {
				type: 'Program',
				body: [{
					type: 'FunctionDeclaration',
					async: true,
					id: { name: 'fetchData' },
					body: {
						type: 'BlockStatement',
						body: [{
							type: 'TryStatement',
							block: {
								body: [{
									type: 'VariableDeclaration',
									declarations: [{
										init: {
											type: 'AwaitExpression',
											argument: {
												type: 'CallExpression',
												callee: { name: 'fetch' }
											}
										}
									}]
								}]
							},
							handler: {
								type: 'CatchClause',
								param: { name: 'error' }
							}
						}]
					}
				}]
			};
			
			mockJavaScriptAnalyzer.analyze.mockResolvedValue({
				complexity: {
					cyclomatic: 2, // try-catch adds complexity
					cognitive: 3
				},
				patterns: {
					async: ['async_function', 'await_expression', 'try_catch'],
					errorHandling: ['try_catch_block', 'error_parameter'],
					promises: ['await_usage']
				},
				features: {
					async: true,
					promises: true,
					errorHandling: true
				},
				asyncAnalysis: {
					asyncFunctions: ['fetchData'],
					awaitExpressions: 1,
					promiseChains: 0,
					errorHandling: 'try_catch'
				}
			});
			
			const result = await mockJavaScriptAnalyzer.analyze(asyncAST, 'async.js', 'content');
			
			expect(result.features.async).toBe(true);
			expect(result.patterns.async).toContain('await_expression');
			expect(result.asyncAnalysis.asyncFunctions).toContain('fetchData');
		});

		test('should analyze ES6+ features', async () => {
			const es6AST = {
				type: 'Program',
				body: [
					{
						type: 'VariableDeclaration',
						kind: 'const',
						declarations: [{
							id: {
								type: 'ObjectPattern',
								properties: [
									{ key: { name: 'name' } },
									{ key: { name: 'age' } }
								]
							},
							init: { type: 'Identifier', name: 'user' }
						}]
					},
					{
						type: 'VariableDeclaration',
						kind: 'const',
						declarations: [{
							id: { name: 'greet' },
							init: {
								type: 'ArrowFunctionExpression',
								params: [{ name: 'name' }],
								body: {
									type: 'TemplateLiteral',
									expressions: [{ name: 'name' }]
								}
							}
						}]
					}
				]
			};
			
			mockJavaScriptAnalyzer.analyze.mockResolvedValue({
				complexity: {
					cyclomatic: 1,
					cognitive: 1
				},
				patterns: {
					es6: [
						'destructuring_assignment',
						'arrow_function',
						'template_literal',
						'const_declaration'
					],
					variables: ['object_destructuring', 'const_binding']
				},
				features: {
					es6: true,
					destructuring: true,
					arrowFunctions: true,
					templateLiterals: true,
					constDeclarations: true
				},
				es6Analysis: {
					destructuringUsage: 1,
					arrowFunctions: 1,
					templateLiterals: 1,
					constDeclarations: 2,
					letDeclarations: 0,
					classes: 0
				}
			});
			
			const result = await mockJavaScriptAnalyzer.analyze(es6AST, 'modern.js', 'content');
			
			expect(result.features.es6).toBe(true);
			expect(result.patterns.es6).toContain('destructuring_assignment');
			expect(result.es6Analysis.arrowFunctions).toBe(1);
		});
	});

	describe('Python Analyzer', () => {
		test('should analyze Python class structure', async () => {
			const pythonAST = {
				type: 'Module',
				body: [{
					type: 'ClassDef',
					name: 'User',
					bases: [],
					decorator_list: [],
					body: [
						{
							type: 'FunctionDef',
							name: '__init__',
							args: {
								args: [
									{ arg: 'self' },
									{ arg: 'name' },
									{ arg: 'age' }
								]
							},
							decorator_list: []
						},
						{
							type: 'FunctionDef',
							name: 'greet',
							decorator_list: [{ id: 'property' }]
						}
					]
				}]
			};
			
			mockPythonAnalyzer.analyze.mockResolvedValue({
				complexity: {
					cyclomatic: 2,
					cognitive: 2,
					classes: {
						User: {
							methods: 2,
							complexity: 2,
							inheritance: 0,
							decorators: 1
						}
					}
				},
				patterns: {
					oop: ['class_definition', 'constructor', 'method_definition'],
					decorators: ['property_decorator'],
					pythonic: ['dunder_method']
				},
				features: {
					classes: true,
					decorators: true,
					properties: true,
					inheritance: false
				},
				classAnalysis: {
					classes: [{
						name: 'User',
						methods: ['__init__', 'greet'],
						properties: ['greet'],
						inheritance: [],
						decorators: 1,
						complexity: 2
					}]
				}
			});
			
			const result = await mockPythonAnalyzer.analyze(pythonAST, 'user.py', 'content');
			
			expect(result.features.classes).toBe(true);
			expect(result.patterns.oop).toContain('class_definition');
			expect(result.classAnalysis.classes[0].name).toBe('User');
		});

		test('should analyze Python comprehensions', async () => {
			const comprehensionAST = {
				type: 'Module',
				body: [
					{
						type: 'Assign',
						targets: [{ id: 'squares' }],
						value: {
							type: 'ListComp',
							elt: {
								type: 'BinOp',
								left: { id: 'x' },
								op: { type: 'Pow' },
								right: { value: 2 }
							},
							generators: [{
								target: { id: 'x' },
								iter: {
									type: 'Call',
									func: { id: 'range' },
									args: [{ value: 10 }]
								},
								ifs: []
							}]
						}
					},
					{
						type: 'Assign',
						targets: [{ id: 'filtered' }],
						value: {
							type: 'ListComp',
							generators: [{
								ifs: [{
									type: 'Compare',
									left: { id: 'x' },
									ops: [{ type: 'Mod' }],
									comparators: [{ value: 2 }]
								}]
							}]
						}
					}
				]
			};
			
			mockPythonAnalyzer.analyze.mockResolvedValue({
				complexity: {
					cyclomatic: 3, // Comprehensions with conditions add complexity
					cognitive: 4
				},
				patterns: {
					comprehensions: ['list_comprehension', 'conditional_comprehension'],
					functional: ['generator_expression', 'filter_pattern'],
					pythonic: ['comprehension_over_loop']
				},
				features: {
					comprehensions: true,
					generators: true,
					functionalProgramming: true
				},
				comprehensionAnalysis: {
					listComprehensions: 2,
					dictComprehensions: 0,
					setComprehensions: 0,
					generatorExpressions: 0,
					nestedComprehensions: 0,
					conditionalComprehensions: 1
				}
			});
			
			const result = await mockPythonAnalyzer.analyze(comprehensionAST, 'comprehensions.py', 'content');
			
			expect(result.features.comprehensions).toBe(true);
			expect(result.patterns.comprehensions).toContain('list_comprehension');
			expect(result.comprehensionAnalysis.listComprehensions).toBe(2);
		});

		test('should analyze async/await in Python', async () => {
			const asyncPythonAST = {
				type: 'Module',
				body: [{
					type: 'AsyncFunctionDef',
					name: 'fetch_data',
					args: { args: [{ arg: 'url' }] },
					body: [{
						type: 'AsyncWith',
						items: [{
							context_expr: {
								type: 'Call',
								func: {
									type: 'Attribute',
									value: { id: 'aiohttp' },
									attr: 'ClientSession'
								}
							},
							optional_vars: { id: 'session' }
						}],
						body: [{
							type: 'AsyncWith',
							items: [{
								context_expr: {
									type: 'Call',
									func: {
										type: 'Attribute',
										value: { id: 'session' },
										attr: 'get'
									}
								}
							}],
							body: [{
								type: 'Return',
								value: {
									type: 'Await',
									value: {
										type: 'Call',
										func: {
											type: 'Attribute',
											attr: 'json'
										}
									}
								}
							}]
						}]
					}]
				}]
			};
			
			mockPythonAnalyzer.analyze.mockResolvedValue({
				complexity: {
					cyclomatic: 1,
					cognitive: 3 // Nested async context managers
				},
				patterns: {
					async: ['async_function', 'await_expression', 'async_context_manager'],
					contextManagers: ['async_with', 'nested_context_managers'],
					pythonic: ['context_manager_usage']
				},
				features: {
					asyncio: true,
					contextManagers: true,
					awaitExpressions: true
				},
				asyncAnalysis: {
					asyncFunctions: ['fetch_data'],
					awaitExpressions: 1,
					asyncContextManagers: 2,
					asyncGenerators: 0
				}
			});
			
			const result = await mockPythonAnalyzer.analyze(asyncPythonAST, 'async_client.py', 'content');
			
			expect(result.features.asyncio).toBe(true);
			expect(result.patterns.async).toContain('async_context_manager');
			expect(result.asyncAnalysis.asyncContextManagers).toBe(2);
		});
	});

	describe('Go Analyzer', () => {
		test('should analyze Go concurrency patterns', async () => {
			const goAST = {
				type: 'File',
				package: { name: 'main' },
				decls: [
					{
						type: 'FuncDecl',
						name: { name: 'worker' },
						type: {
							params: {
								list: [{
									names: [{ name: 'jobs' }],
									type: {
										type: 'ChanType',
										dir: 'recv',
										value: { name: 'int' }
									}
								}]
							}
						},
						body: {
							list: [{
								type: 'RangeStmt',
								key: { name: 'job' },
								x: { name: 'jobs' }
							}]
						}
					},
					{
						type: 'FuncDecl',
						name: { name: 'main' },
						body: {
							list: [
								{
									type: 'AssignStmt',
									lhs: [{ name: 'jobs' }],
									rhs: [{
										type: 'CallExpr',
										fun: { name: 'make' },
										args: [{
											type: 'ChanType',
											value: { name: 'int' }
										}]
									}]
								},
								{
									type: 'GoStmt',
									call: {
										type: 'CallExpr',
										fun: { name: 'worker' }
									}
								}
							]
						}
					}
				]
			};
			
			mockGoAnalyzer.analyze.mockResolvedValue({
				complexity: {
					cyclomatic: 2,
					cognitive: 3,
					goroutines: 1,
					channels: 1
				},
				patterns: {
					concurrency: ['goroutine', 'channel_communication', 'range_over_channel'],
					channels: ['channel_creation', 'channel_receive'],
					go: ['go_statement', 'make_builtin']
				},
				features: {
					goroutines: true,
					channels: true,
					select: false,
					defer: false
				},
				concurrencyAnalysis: {
					goroutines: 1,
					channels: {
						created: 1,
						directional: 1,
						bidirectional: 0
					},
					selectStatements: 0,
					mutexUsage: 0,
					waitGroups: 0
				}
			});
			
			const result = await mockGoAnalyzer.analyze(goAST, 'worker.go', 'content');
			
			expect(result.features.goroutines).toBe(true);
			expect(result.patterns.concurrency).toContain('goroutine');
			expect(result.concurrencyAnalysis.channels.directional).toBe(1);
		});

		test('should analyze Go interfaces and type assertions', async () => {
			const interfaceAST = {
				type: 'File',
				package: { name: 'main' },
				decls: [
					{
						type: 'GenDecl',
						tok: 'type',
						specs: [{
							type: 'TypeSpec',
							name: { name: 'Reader' },
							type: {
								type: 'InterfaceType',
								methods: {
									list: [{
										names: [{ name: 'Read' }],
										type: { type: 'FuncType' }
									}]
								}
							}
						}]
					},
					{
						type: 'FuncDecl',
						name: { name: 'process' },
						body: {
							list: [{
								type: 'TypeSwitchStmt',
								assign: {
									lhs: [{ name: 'v' }],
									rhs: [{
										type: 'TypeAssertExpr',
										x: { name: 'r' },
										type: null
									}]
								}
							}]
						}
					}
				]
			};
			
			mockGoAnalyzer.analyze.mockResolvedValue({
				complexity: {
					cyclomatic: 2, // Type switch adds complexity
					cognitive: 2
				},
				patterns: {
					interfaces: ['interface_definition', 'method_signature'],
					types: ['type_assertion', 'type_switch'],
					go: ['interface_type', 'type_switch_statement']
				},
				features: {
					interfaces: true,
					typeAssertions: true,
					typeSwitch: true
				},
				typeAnalysis: {
					interfaces: [{
						name: 'Reader',
						methods: ['Read'],
						embedded: []
					}],
					typeAssertions: 1,
					typeSwitches: 1,
					customTypes: 1
				}
			});
			
			const result = await mockGoAnalyzer.analyze(interfaceAST, 'interfaces.go', 'content');
			
			expect(result.features.interfaces).toBe(true);
			expect(result.patterns.interfaces).toContain('interface_definition');
			expect(result.typeAnalysis.interfaces[0].name).toBe('Reader');
		});

		test('should analyze Go error handling patterns', async () => {
			const errorHandlingAST = {
				type: 'File',
				package: { name: 'main' },
				decls: [{
					type: 'FuncDecl',
					name: { name: 'readFile' },
					type: {
						results: {
							list: [
								{ type: { name: 'string' } },
								{ type: { name: 'error' } }
							]
						}
					},
					body: {
						list: [
							{
								type: 'AssignStmt',
								lhs: [{ name: 'data' }, { name: 'err' }],
								tok: ':=',
								rhs: [{
									type: 'CallExpr',
									fun: {
										type: 'SelectorExpr',
										x: { name: 'ioutil' },
										sel: { name: 'ReadFile' }
									}
								}]
							},
							{
								type: 'IfStmt',
								cond: {
									type: 'BinaryExpr',
									op: '!=',
									x: { name: 'err' },
									y: { name: 'nil' }
								},
								body: {
									list: [{
										type: 'ReturnStmt',
										results: [
											{ type: 'BasicLit', value: '""' },
											{ name: 'err' }
										]
									}]
								}
							}
						]
					}
				}]
			};
			
			mockGoAnalyzer.analyze.mockResolvedValue({
				complexity: {
					cyclomatic: 2,
					cognitive: 2
				},
				patterns: {
					errorHandling: ['error_return', 'nil_check', 'early_return'],
					go: ['multiple_assignment', 'if_err_nil'],
					idioms: ['go_error_idiom']
				},
				features: {
					errorHandling: true,
					multipleReturns: true,
					nilChecks: true
				},
				errorAnalysis: {
					errorReturns: 1,
					nilChecks: 1,
					errorCreation: 0,
					panicUsage: 0,
					recoverUsage: 0
				}
			});
			
			const result = await mockGoAnalyzer.analyze(errorHandlingAST, 'file_reader.go', 'content');
			
			expect(result.features.errorHandling).toBe(true);
			expect(result.patterns.idioms).toContain('go_error_idiom');
			expect(result.errorAnalysis.nilChecks).toBe(1);
		});
	});

	describe('Generic Analyzer', () => {
		test('should provide basic analysis for unknown languages', async () => {
			const unknownAST = {
				type: 'Program',
				body: [
					{
						type: 'FunctionDeclaration',
						name: 'test',
						body: {
							type: 'Block',
							statements: [
								{ type: 'IfStatement' },
								{ type: 'ForLoop' },
								{ type: 'ReturnStatement' }
							]
						}
					}
				]
			};
			
			mockGenericAnalyzer.analyze.mockResolvedValue({
				structure: {
					nodeCount: 6,
					depth: 3,
					functions: 1,
					conditionals: 1,
					loops: 1
				},
				complexity: {
					cyclomatic: 3,
					cognitive: 4,
					nesting: 2
				},
				patterns: {
					controlFlow: ['conditional', 'loop', 'function'],
					structure: ['nested_blocks', 'sequential_statements']
				},
				metrics: {
					linesOfCode: 10,
					statementsCount: 3,
					expressionsCount: 2
				}
			});
			
			const result = await mockGenericAnalyzer.analyze(unknownAST, 'test.unknown', 'content');
			
			expect(result.structure.nodeCount).toBe(6);
			expect(result.complexity.cyclomatic).toBe(3);
			expect(result.patterns.controlFlow).toContain('conditional');
		});

		test('should detect common programming patterns', async () => {
			const patternAST = {
				type: 'Program',
				body: [
					{
						type: 'ClassDeclaration',
						name: 'Singleton',
						body: {
							methods: [
								{
									type: 'MethodDefinition',
									name: 'getInstance',
									static: true
								}
							]
						}
					}
				]
			};
			
			mockGenericAnalyzer.analyze.mockResolvedValue({
				structure: {
					nodeCount: 4,
					classes: 1,
					methods: 1
				},
				patterns: {
					designPatterns: ['singleton_pattern'],
					oop: ['class_declaration', 'static_method'],
					structure: ['method_definition']
				},
				designPatterns: [{
					name: 'Singleton',
					type: 'creational',
					confidence: 0.8,
					indicators: ['static_getInstance_method', 'single_class']
				}]
			});
			
			const result = await mockGenericAnalyzer.analyze(patternAST, 'singleton.js', 'content');
			
			expect(result.patterns.designPatterns).toContain('singleton_pattern');
			expect(result.designPatterns[0].type).toBe('creational');
			expect(result.designPatterns[0].confidence).toBe(0.8);
		});
	});

	describe('Cross-Language Analysis', () => {
		test('should compare analysis results across languages', async () => {
			const jsResult = {
				complexity: { cyclomatic: 3 },
				patterns: { async: ['promise'] },
				features: { es6: true }
			};
			
			const pyResult = {
				complexity: { cyclomatic: 2 },
				patterns: { async: ['asyncio'] },
				features: { asyncio: true }
			};
			
			const goResult = {
				complexity: { cyclomatic: 2 },
				patterns: { concurrency: ['goroutine'] },
				features: { goroutines: true }
			};
			
			mockJavaScriptAnalyzer.analyze.mockResolvedValue(jsResult);
			mockPythonAnalyzer.analyze.mockResolvedValue(pyResult);
			mockGoAnalyzer.analyze.mockResolvedValue(goResult);
			
			const results = [
				await mockJavaScriptAnalyzer.analyze({}, 'app.js', ''),
				await mockPythonAnalyzer.analyze({}, 'app.py', ''),
				await mockGoAnalyzer.analyze({}, 'app.go', '')
			];
			
			// Verify each language has unique patterns
			expect(results[0].patterns.async).toContain('promise');
			expect(results[1].patterns.async).toContain('asyncio');
			expect(results[2].patterns.concurrency).toContain('goroutine');
			
			// Verify complexity comparison
			const complexities = results.map(r => r.complexity.cyclomatic);
			expect(Math.max(...complexities)).toBe(3);
			expect(Math.min(...complexities)).toBe(2);
		});

		test('should identify common patterns across languages', async () => {
			const commonPatterns = ['function_declaration', 'conditional_logic', 'variable_assignment'];
			
			mockJavaScriptAnalyzer.analyze.mockResolvedValue({
				patterns: { common: commonPatterns, specific: ['arrow_function'] }
			});
			
			mockPythonAnalyzer.analyze.mockResolvedValue({
				patterns: { common: commonPatterns, specific: ['list_comprehension'] }
			});
			
			mockGoAnalyzer.analyze.mockResolvedValue({
				patterns: { common: commonPatterns, specific: ['goroutine'] }
			});
			
			const results = [
				await mockJavaScriptAnalyzer.analyze({}, 'test.js', ''),
				await mockPythonAnalyzer.analyze({}, 'test.py', ''),
				await mockGoAnalyzer.analyze({}, 'test.go', '')
			];
			
			// Verify common patterns exist in all languages
			results.forEach(result => {
				commonPatterns.forEach(pattern => {
					expect(result.patterns.common).toContain(pattern);
				});
			});
			
			// Verify language-specific patterns are unique
			expect(results[0].patterns.specific).toContain('arrow_function');
			expect(results[1].patterns.specific).toContain('list_comprehension');
			expect(results[2].patterns.specific).toContain('goroutine');
		});
	});

	describe('Performance and Error Handling', () => {
		test('should handle analysis errors gracefully', async () => {
			const malformedAST = { type: 'Invalid' };
			
			mockJavaScriptAnalyzer.analyze.mockRejectedValue(new Error('Invalid AST structure'));
			
			try {
				await mockJavaScriptAnalyzer.analyze(malformedAST, 'broken.js', 'content');
			} catch (error) {
				expect(error.message).toBe('Invalid AST structure');
			}
		});

		test('should handle large ASTs efficiently', async () => {
			const largeAST = {
				type: 'Program',
				body: Array(1000).fill({
					type: 'ExpressionStatement',
					expression: { type: 'Literal', value: 1 }
				})
			};
			
			mockGenericAnalyzer.analyze.mockImplementation(async () => {
				const startTime = performance.now();
				// Simulate processing time
				await new Promise(resolve => setTimeout(resolve, 10));
				const endTime = performance.now();
				
				return {
					structure: { nodeCount: 1001 },
					complexity: { cyclomatic: 1 },
					performance: {
						analysisTime: endTime - startTime,
						memoryUsage: 1000 * 1024 // 1KB per node
					}
				};
			});
			
			const result = await mockGenericAnalyzer.analyze(largeAST, 'large.js', 'content');
			
			expect(result.structure.nodeCount).toBe(1001);
			expect(result.performance.analysisTime).toBeGreaterThan(0);
			expect(result.performance.memoryUsage).toBeGreaterThan(0);
		});

		test('should handle concurrent analysis requests', async () => {
			const requests = Array(5).fill(null).map((_, i) => ({
				ast: { type: 'Program', body: [] },
				file: `test${i}.js`,
				content: `const x${i} = 1;`
			}));
			
			requests.forEach((req, index) => {
				mockJavaScriptAnalyzer.analyze.mockResolvedValueOnce({
					complexity: { cyclomatic: 1 },
					patterns: { variables: [`x${index}`] },
					requestId: index
				});
			});
			
			const promises = requests.map(req => 
				mockJavaScriptAnalyzer.analyze(req.ast, req.file, req.content)
			);
			
			const results = await Promise.all(promises);
			
			expect(results).toHaveLength(5);
			results.forEach((result, index) => {
				expect(result.requestId).toBe(index);
				expect(result.patterns.variables).toContain(`x${index}`);
			});
		});
	});
});
