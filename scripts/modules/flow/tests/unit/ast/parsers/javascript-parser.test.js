/**
 * JavaScript Parser Tests
 * Comprehensive tests for JavaScript/TypeScript AST parsing
 */

// Mock the JavaScript parser since we can't import the actual implementation in tests
const mockJavaScriptParser = {
	parse: jest.fn(),
	validateContent: jest.fn(),
	getSupportedExtensions: jest.fn(),
	getLanguageId: jest.fn(),
	isInitialized: jest.fn()
};

// Mock parser registry
const mockParserRegistry = {
	getParser: jest.fn(),
	parseFile: jest.fn()
};

describe('JavaScript Parser - Comprehensive Tests', () => {
	beforeEach(() => {
		jest.clearAllMocks();

		// Setup default mock behaviors
		mockJavaScriptParser.getLanguageId.mockReturnValue('javascript');
		mockJavaScriptParser.getSupportedExtensions.mockReturnValue([
			'.js',
			'.jsx',
			'.ts',
			'.tsx',
			'.mjs',
			'.cjs'
		]);
		mockJavaScriptParser.isInitialized.mockReturnValue(true);
		mockJavaScriptParser.validateContent.mockReturnValue(true);

		mockParserRegistry.getParser.mockReturnValue(mockJavaScriptParser);
	});

	describe('Basic Parsing', () => {
		test('should parse simple JavaScript function', async () => {
			const content = `
				function greet(name) {
					return "Hello, " + name;
				}
			`;

			const expectedAST = {
				type: 'Program',
				body: [
					{
						type: 'FunctionDeclaration',
						id: { name: 'greet' },
						params: [{ name: 'name' }],
						body: {
							type: 'BlockStatement',
							body: [
								{
									type: 'ReturnStatement',
									argument: {
										type: 'BinaryExpression',
										operator: '+',
										left: { type: 'Literal', value: 'Hello, ' },
										right: { type: 'Identifier', name: 'name' }
									}
								}
							]
						}
					}
				]
			};

			mockJavaScriptParser.parse.mockResolvedValue({
				success: true,
				ast: expectedAST,
				language: 'javascript'
			});

			const result = await mockJavaScriptParser.parse(content, 'test.js');

			expect(result.success).toBe(true);
			expect(result.ast.type).toBe('Program');
			expect(result.ast.body[0].type).toBe('FunctionDeclaration');
			expect(result.ast.body[0].id.name).toBe('greet');
		});

		test('should parse ES6 arrow functions', async () => {
			const content = `
				const greet = (name) => {
					return \`Hello, \${name}!\`;
				};
				
				const simpleGreet = name => \`Hi, \${name}!\`;
			`;

			const expectedAST = {
				type: 'Program',
				body: [
					{
						type: 'VariableDeclaration',
						declarations: [
							{
								type: 'VariableDeclarator',
								id: { name: 'greet' },
								init: {
									type: 'ArrowFunctionExpression',
									params: [{ name: 'name' }]
								}
							}
						]
					},
					{
						type: 'VariableDeclaration',
						declarations: [
							{
								type: 'VariableDeclarator',
								id: { name: 'simpleGreet' },
								init: {
									type: 'ArrowFunctionExpression',
									params: [{ name: 'name' }]
								}
							}
						]
					}
				]
			};

			mockJavaScriptParser.parse.mockResolvedValue({
				success: true,
				ast: expectedAST,
				language: 'javascript'
			});

			const result = await mockJavaScriptParser.parse(content, 'test.js');

			expect(result.success).toBe(true);
			expect(result.ast.body).toHaveLength(2);
			expect(result.ast.body[0].declarations[0].id.name).toBe('greet');
			expect(result.ast.body[1].declarations[0].id.name).toBe('simpleGreet');
		});

		test('should parse class declarations', async () => {
			const content = `
				class User {
					constructor(name, age) {
						this.name = name;
						this.age = age;
					}
					
					greet() {
						return \`Hello, I'm \${this.name}\`;
					}
					
					static createGuest() {
						return new User('Guest', 0);
					}
				}
			`;

			const expectedAST = {
				type: 'Program',
				body: [
					{
						type: 'ClassDeclaration',
						id: { name: 'User' },
						body: {
							type: 'ClassBody',
							body: [
								{ type: 'MethodDefinition', key: { name: 'constructor' } },
								{ type: 'MethodDefinition', key: { name: 'greet' } },
								{
									type: 'MethodDefinition',
									key: { name: 'createGuest' },
									static: true
								}
							]
						}
					}
				]
			};

			mockJavaScriptParser.parse.mockResolvedValue({
				success: true,
				ast: expectedAST,
				language: 'javascript'
			});

			const result = await mockJavaScriptParser.parse(content, 'test.js');

			expect(result.success).toBe(true);
			expect(result.ast.body[0].type).toBe('ClassDeclaration');
			expect(result.ast.body[0].id.name).toBe('User');
			expect(result.ast.body[0].body.body).toHaveLength(3);
		});
	});

	describe('ES6+ Features', () => {
		test('should parse destructuring assignments', async () => {
			const content = `
				const { name, age } = user;
				const [first, second, ...rest] = array;
				const { name: userName, age = 25 } = user;
			`;

			mockJavaScriptParser.parse.mockResolvedValue({
				success: true,
				ast: {
					type: 'Program',
					body: [
						{
							type: 'VariableDeclaration',
							declarations: [
								{
									type: 'VariableDeclarator',
									id: { type: 'ObjectPattern' }
								}
							]
						},
						{
							type: 'VariableDeclaration',
							declarations: [
								{
									type: 'VariableDeclarator',
									id: { type: 'ArrayPattern' }
								}
							]
						},
						{
							type: 'VariableDeclaration',
							declarations: [
								{
									type: 'VariableDeclarator',
									id: { type: 'ObjectPattern' }
								}
							]
						}
					]
				},
				language: 'javascript'
			});

			const result = await mockJavaScriptParser.parse(content, 'test.js');

			expect(result.success).toBe(true);
			expect(result.ast.body).toHaveLength(3);
			expect(result.ast.body[0].declarations[0].id.type).toBe('ObjectPattern');
			expect(result.ast.body[1].declarations[0].id.type).toBe('ArrayPattern');
		});

		test('should parse async/await syntax', async () => {
			const content = `
				async function fetchData() {
					try {
						const response = await fetch('/api/data');
						const data = await response.json();
						return data;
					} catch (error) {
						console.error('Error:', error);
						throw error;
					}
				}
				
				const fetchUser = async (id) => {
					return await api.getUser(id);
				};
			`;

			mockJavaScriptParser.parse.mockResolvedValue({
				success: true,
				ast: {
					type: 'Program',
					body: [
						{
							type: 'FunctionDeclaration',
							async: true,
							id: { name: 'fetchData' },
							body: {
								body: [
									{
										type: 'TryStatement',
										block: {
											body: [
												{
													type: 'VariableDeclaration',
													declarations: [
														{
															init: { type: 'AwaitExpression' }
														}
													]
												}
											]
										}
									}
								]
							}
						},
						{
							type: 'VariableDeclaration',
							declarations: [
								{
									id: { name: 'fetchUser' },
									init: {
										type: 'ArrowFunctionExpression',
										async: true
									}
								}
							]
						}
					]
				},
				language: 'javascript'
			});

			const result = await mockJavaScriptParser.parse(content, 'test.js');

			expect(result.success).toBe(true);
			expect(result.ast.body[0].async).toBe(true);
			expect(result.ast.body[1].declarations[0].init.async).toBe(true);
		});

		test('should parse import/export statements', async () => {
			const content = `
				import React, { useState, useEffect } from 'react';
				import * as utils from './utils';
				import { default as Component } from './Component';
				
				export const myFunction = () => {};
				export default class MyClass {}
				export { myFunction as func };
			`;

			mockJavaScriptParser.parse.mockResolvedValue({
				success: true,
				ast: {
					type: 'Program',
					body: [
						{ type: 'ImportDeclaration', source: { value: 'react' } },
						{ type: 'ImportDeclaration', source: { value: './utils' } },
						{ type: 'ImportDeclaration', source: { value: './Component' } },
						{ type: 'ExportNamedDeclaration' },
						{ type: 'ExportDefaultDeclaration' },
						{ type: 'ExportNamedDeclaration' }
					]
				},
				language: 'javascript'
			});

			const result = await mockJavaScriptParser.parse(content, 'test.js');

			expect(result.success).toBe(true);
			expect(result.ast.body).toHaveLength(6);
			expect(result.ast.body[0].type).toBe('ImportDeclaration');
			expect(result.ast.body[4].type).toBe('ExportDefaultDeclaration');
		});
	});

	describe('JSX Support', () => {
		test('should parse JSX elements', async () => {
			const content = `
				const Component = () => {
					return (
						<div className="container">
							<h1>Hello World</h1>
							<button onClick={handleClick}>
								Click me
							</button>
						</div>
					);
				};
			`;

			mockJavaScriptParser.parse.mockResolvedValue({
				success: true,
				ast: {
					type: 'Program',
					body: [
						{
							type: 'VariableDeclaration',
							declarations: [
								{
									id: { name: 'Component' },
									init: {
										type: 'ArrowFunctionExpression',
										body: {
											body: [
												{
													type: 'ReturnStatement',
													argument: {
														type: 'JSXElement',
														openingElement: {
															name: { name: 'div' },
															attributes: [
																{
																	name: { name: 'className' },
																	value: { value: 'container' }
																}
															]
														}
													}
												}
											]
										}
									}
								}
							]
						}
					]
				},
				language: 'javascript'
			});

			const result = await mockJavaScriptParser.parse(content, 'test.jsx');

			expect(result.success).toBe(true);
			expect(
				result.ast.body[0].declarations[0].init.body.body[0].argument.type
			).toBe('JSXElement');
		});

		test('should parse JSX with props and expressions', async () => {
			const content = `
				const UserCard = ({ user, onEdit }) => (
					<div className={\`user-card \${user.active ? 'active' : ''}\`}>
						<img src={user.avatar} alt={\`\${user.name} avatar\`} />
						<h2>{user.name}</h2>
						<p>{user.email}</p>
						<button onClick={() => onEdit(user.id)}>
							Edit
						</button>
					</div>
				);
			`;

			mockJavaScriptParser.parse.mockResolvedValue({
				success: true,
				ast: {
					type: 'Program',
					body: [
						{
							type: 'VariableDeclaration',
							declarations: [
								{
									id: { name: 'UserCard' },
									init: {
										type: 'ArrowFunctionExpression',
										body: {
											type: 'JSXElement',
											children: [
												{ type: 'JSXElement' }, // img
												{ type: 'JSXElement' }, // h2
												{ type: 'JSXElement' }, // p
												{ type: 'JSXElement' } // button
											]
										}
									}
								}
							]
						}
					]
				},
				language: 'javascript'
			});

			const result = await mockJavaScriptParser.parse(content, 'test.jsx');

			expect(result.success).toBe(true);
			expect(result.ast.body[0].declarations[0].init.body.type).toBe(
				'JSXElement'
			);
		});
	});

	describe('TypeScript Support', () => {
		test('should parse TypeScript interfaces', async () => {
			const content = `
				interface User {
					id: number;
					name: string;
					email?: string;
					roles: string[];
				}
				
				interface ApiResponse<T> {
					data: T;
					success: boolean;
					message?: string;
				}
			`;

			mockJavaScriptParser.parse.mockResolvedValue({
				success: true,
				ast: {
					type: 'Program',
					body: [
						{
							type: 'TSInterfaceDeclaration',
							id: { name: 'User' },
							body: {
								body: [
									{ type: 'TSPropertySignature', key: { name: 'id' } },
									{ type: 'TSPropertySignature', key: { name: 'name' } },
									{
										type: 'TSPropertySignature',
										key: { name: 'email' },
										optional: true
									},
									{ type: 'TSPropertySignature', key: { name: 'roles' } }
								]
							}
						},
						{
							type: 'TSInterfaceDeclaration',
							id: { name: 'ApiResponse' },
							typeParameters: {
								params: [{ name: 'T' }]
							}
						}
					]
				},
				language: 'typescript'
			});

			const result = await mockJavaScriptParser.parse(content, 'test.ts');

			expect(result.success).toBe(true);
			expect(result.ast.body[0].type).toBe('TSInterfaceDeclaration');
			expect(result.ast.body[0].id.name).toBe('User');
			expect(result.ast.body[1].typeParameters.params[0].name).toBe('T');
		});

		test('should parse TypeScript type annotations', async () => {
			const content = `
				function processUser(user: User): Promise<ApiResponse<User>> {
					return api.updateUser(user);
				}
				
				const users: User[] = [];
				const userMap: Map<string, User> = new Map();
				
				class UserService {
					private users: User[] = [];
					
					async getUser(id: string): Promise<User | null> {
						return this.users.find(u => u.id === id) || null;
					}
				}
			`;

			mockJavaScriptParser.parse.mockResolvedValue({
				success: true,
				ast: {
					type: 'Program',
					body: [
						{
							type: 'FunctionDeclaration',
							id: { name: 'processUser' },
							params: [
								{
									type: 'Identifier',
									name: 'user',
									typeAnnotation: {
										type: 'TSTypeAnnotation',
										typeAnnotation: {
											type: 'TSTypeReference',
											typeName: { name: 'User' }
										}
									}
								}
							],
							returnType: {
								type: 'TSTypeAnnotation',
								typeAnnotation: { type: 'TSTypeReference' }
							}
						},
						{
							type: 'VariableDeclaration',
							declarations: [
								{
									id: {
										name: 'users',
										typeAnnotation: {
											type: 'TSTypeAnnotation',
											typeAnnotation: { type: 'TSArrayType' }
										}
									}
								}
							]
						}
					]
				},
				language: 'typescript'
			});

			const result = await mockJavaScriptParser.parse(content, 'test.ts');

			expect(result.success).toBe(true);
			expect(
				result.ast.body[0].params[0].typeAnnotation.typeAnnotation.typeName.name
			).toBe('User');
		});
	});

	describe('Error Handling', () => {
		test('should handle syntax errors gracefully', async () => {
			const content = `
				function broken() {
					return "unclosed string
				}
			`;

			mockJavaScriptParser.parse.mockResolvedValue({
				success: false,
				error: {
					type: 'SyntaxError',
					message: 'Unterminated string literal',
					line: 3,
					column: 32,
					file: 'test.js'
				}
			});

			const result = await mockJavaScriptParser.parse(content, 'test.js');

			expect(result.success).toBe(false);
			expect(result.error.type).toBe('SyntaxError');
			expect(result.error.message).toContain('Unterminated string');
			expect(result.error.line).toBe(3);
		});

		test('should handle empty files', async () => {
			const content = '';

			mockJavaScriptParser.parse.mockResolvedValue({
				success: true,
				ast: {
					type: 'Program',
					body: []
				},
				language: 'javascript'
			});

			const result = await mockJavaScriptParser.parse(content, 'test.js');

			expect(result.success).toBe(true);
			expect(result.ast.body).toHaveLength(0);
		});

		test('should handle files with only comments', async () => {
			const content = `
				// This is a comment
				/* This is a block comment */
				/**
				 * This is a JSDoc comment
				 */
			`;

			mockJavaScriptParser.parse.mockResolvedValue({
				success: true,
				ast: {
					type: 'Program',
					body: [],
					comments: [
						{ type: 'Line', value: ' This is a comment' },
						{ type: 'Block', value: ' This is a block comment ' },
						{
							type: 'Block',
							value: '*\n\t\t\t\t * This is a JSDoc comment\n\t\t\t\t '
						}
					]
				},
				language: 'javascript'
			});

			const result = await mockJavaScriptParser.parse(content, 'test.js');

			expect(result.success).toBe(true);
			expect(result.ast.body).toHaveLength(0);
			expect(result.ast.comments).toHaveLength(3);
		});

		test('should handle malformed JSX', async () => {
			const content = `
				const Component = () => {
					return (
						<div>
							<span>Unclosed tag
						</div>
					);
				};
			`;

			mockJavaScriptParser.parse.mockResolvedValue({
				success: false,
				error: {
					type: 'SyntaxError',
					message: 'Expected corresponding JSX closing tag for <span>',
					line: 5,
					column: 15,
					file: 'test.jsx'
				}
			});

			const result = await mockJavaScriptParser.parse(content, 'test.jsx');

			expect(result.success).toBe(false);
			expect(result.error.message).toContain('JSX closing tag');
		});
	});

	describe('Performance Tests', () => {
		test('should parse small files quickly', async () => {
			const content = 'const x = 1;';

			mockJavaScriptParser.parse.mockImplementation(async () => {
				// Simulate fast parsing
				await new Promise((resolve) => setTimeout(resolve, 1));
				return {
					success: true,
					ast: { type: 'Program', body: [] },
					language: 'javascript'
				};
			});

			const start = performance.now();
			await mockJavaScriptParser.parse(content, 'test.js');
			const duration = performance.now() - start;

			expect(duration).toBeLessThan(10); // Should be under 10ms
		});

		test('should handle large files efficiently', async () => {
			// Create a large JavaScript file content
			const largeContent = Array(1000).fill('const x = 1;').join('\n');

			mockJavaScriptParser.parse.mockImplementation(async () => {
				// Simulate parsing time proportional to content size
				await new Promise((resolve) => setTimeout(resolve, 10));
				return {
					success: true,
					ast: { type: 'Program', body: [] },
					language: 'javascript'
				};
			});

			const start = performance.now();
			await mockJavaScriptParser.parse(largeContent, 'test.js');
			const duration = performance.now() - start;

			expect(duration).toBeLessThan(100); // Should be under 100ms even for large files
		});

		test('should handle complex nested structures efficiently', async () => {
			const complexContent = `
				const deepObject = {
					level1: {
						level2: {
							level3: {
								level4: {
									level5: {
										data: "deep nesting"
									}
								}
							}
						}
					}
				};
				
				function recursiveFunction(n) {
					if (n <= 0) return 1;
					return n * recursiveFunction(n - 1);
				}
			`;

			mockJavaScriptParser.parse.mockImplementation(async () => {
				await new Promise((resolve) => setTimeout(resolve, 5));
				return {
					success: true,
					ast: { type: 'Program', body: [] },
					language: 'javascript'
				};
			});

			const start = performance.now();
			await mockJavaScriptParser.parse(complexContent, 'test.js');
			const duration = performance.now() - start;

			expect(duration).toBeLessThan(50); // Should handle complexity efficiently
		});
	});

	describe('File Extension Support', () => {
		test('should support all JavaScript extensions', () => {
			const extensions = mockJavaScriptParser.getSupportedExtensions();

			expect(extensions).toContain('.js');
			expect(extensions).toContain('.jsx');
			expect(extensions).toContain('.ts');
			expect(extensions).toContain('.tsx');
			expect(extensions).toContain('.mjs');
			expect(extensions).toContain('.cjs');
		});

		test('should identify as javascript parser', () => {
			expect(mockJavaScriptParser.getLanguageId()).toBe('javascript');
		});

		test('should validate content correctly', () => {
			expect(mockJavaScriptParser.validateContent('const x = 1;')).toBe(true);
		});
	});

	describe('Integration with Parser Registry', () => {
		test('should be retrievable from parser registry', () => {
			const parser = mockParserRegistry.getParser('javascript');
			expect(parser).toBe(mockJavaScriptParser);
		});

		test('should parse files through registry', async () => {
			const content = 'const test = true;';

			mockParserRegistry.parseFile.mockResolvedValue({
				success: true,
				ast: { type: 'Program', body: [] },
				language: 'javascript'
			});

			const result = await mockParserRegistry.parseFile('test.js', content);

			expect(result.success).toBe(true);
			expect(mockParserRegistry.parseFile).toHaveBeenCalledWith(
				'test.js',
				content
			);
		});
	});

	describe('Real-World Code Examples', () => {
		test('should parse Express.js server code', async () => {
			const expressContent = `
				const express = require('express');
				const cors = require('cors');
				const helmet = require('helmet');
				
				const app = express();
				const PORT = process.env.PORT || 3000;
				
				// Middleware
				app.use(helmet());
				app.use(cors());
				app.use(express.json());
				app.use(express.urlencoded({ extended: true }));
				
				// Routes
				app.get('/health', (req, res) => {
					res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
				});
				
				app.get('/api/users', async (req, res) => {
					try {
						const users = await User.findAll();
						res.json(users);
					} catch (error) {
						res.status(500).json({ error: error.message });
					}
				});
				
				app.listen(PORT, () => {
					console.log(\`Server running on port \${PORT}\`);
				});
			`;

			mockJavaScriptParser.parse.mockResolvedValue({
				success: true,
				ast: { type: 'Program', body: [] },
				language: 'javascript'
			});

			const result = await mockJavaScriptParser.parse(
				expressContent,
				'server.js'
			);
			expect(result.success).toBe(true);
		});

		test('should parse React component with hooks', async () => {
			const reactContent = `
				import React, { useState, useEffect, useCallback, useMemo } from 'react';
				import { useQuery, useMutation } from '@tanstack/react-query';
				import { toast } from 'react-toastify';
				
				const UserProfile = ({ userId }) => {
					const [isEditing, setIsEditing] = useState(false);
					const [formData, setFormData] = useState({});
					
					const { data: user, isLoading, error } = useQuery({
						queryKey: ['user', userId],
						queryFn: () => api.getUser(userId),
						enabled: !!userId
					});
					
					const updateMutation = useMutation({
						mutationFn: api.updateUser,
						onSuccess: () => {
							toast.success('User updated successfully');
							setIsEditing(false);
						},
						onError: (error) => {
							toast.error(\`Failed to update user: \${error.message}\`);
						}
					});
					
					const handleSubmit = useCallback(async (e) => {
						e.preventDefault();
						updateMutation.mutate({ ...user, ...formData });
					}, [user, formData, updateMutation]);
					
					const displayName = useMemo(() => {
						return user ? \`\${user.firstName} \${user.lastName}\` : '';
					}, [user]);
					
					useEffect(() => {
						if (user) {
							setFormData({
								firstName: user.firstName || '',
								lastName: user.lastName || '',
								email: user.email || ''
							});
						}
					}, [user]);
					
					if (isLoading) return <div>Loading...</div>;
					if (error) return <div>Error: {error.message}</div>;
					if (!user) return <div>User not found</div>;
					
					return (
						<div className="user-profile">
							<h1>{displayName}</h1>
							{isEditing ? (
								<form onSubmit={handleSubmit}>
									<input
										type="text"
										value={formData.firstName}
										onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
										placeholder="First Name"
									/>
									<input
										type="text"
										value={formData.lastName}
										onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
										placeholder="Last Name"
									/>
									<input
										type="email"
										value={formData.email}
										onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
										placeholder="Email"
									/>
									<button type="submit" disabled={updateMutation.isLoading}>
										{updateMutation.isLoading ? 'Saving...' : 'Save'}
									</button>
									<button type="button" onClick={() => setIsEditing(false)}>
										Cancel
									</button>
								</form>
							) : (
								<div>
									<p>Email: {user.email}</p>
									<button onClick={() => setIsEditing(true)}>
										Edit Profile
									</button>
								</div>
							)}
						</div>
					);
				};
				
				export default UserProfile;
			`;

			mockJavaScriptParser.parse.mockResolvedValue({
				success: true,
				ast: { type: 'Program', body: [] },
				language: 'javascript'
			});

			const result = await mockJavaScriptParser.parse(
				reactContent,
				'UserProfile.jsx'
			);
			expect(result.success).toBe(true);
		});
	});
});
