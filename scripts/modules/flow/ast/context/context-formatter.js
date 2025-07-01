/**
 * AST Context Formatter - Formats AST analysis results for Claude context
 */

/**
 * Format AST analysis results into Claude-friendly context
 * @param {Object} filteredResults - Filtered AST results by language
 * @param {Object} options - Formatting options
 * @returns {Promise<string>} Formatted context string
 */
export async function formatASTContext(filteredResults, options = {}) {
	const {
		config,
		tasks = [],
		includeComplexity = true,
		includeImports = true
	} = options;

	if (!filteredResults || Object.keys(filteredResults).length === 0) {
		return '## Code Structure Analysis\n\n*AST analysis found no relevant code files for this context.*\n\n';
	}

	let context = '## Code Structure Analysis\n\n';
	context += '*AST-powered analysis of relevant project files*\n\n';

	// Summary section
	const summary = generateSummary(filteredResults);
	context += summary;

	// Per-language analysis
	for (const [language, results] of Object.entries(filteredResults)) {
		if (results.length === 0) continue;

		context += `### ${formatLanguageName(language)} Analysis\n\n`;

		// File overview
		context += `**Files analyzed:** ${results.length}\n\n`;

		// Functions and classes
		const functionsSection = formatFunctionsAndClasses(results, {
			includeComplexity
		});
		if (functionsSection) {
			context += functionsSection;
		}

		// Imports and dependencies
		if (includeImports) {
			const importsSection = formatImportsAndDependencies(results, language);
			if (importsSection) {
				context += importsSection;
			}
		}

		// Code patterns
		const patternsSection = formatCodePatterns(results, language);
		if (patternsSection) {
			context += patternsSection;
		}
	}

	// Cross-language insights
	const crossLangInsights = generateCrossLanguageInsights(filteredResults);
	if (crossLangInsights) {
		context += crossLangInsights;
	}

	// Implementation recommendations
	if (tasks.length > 0) {
		const recommendations = generateImplementationRecommendations(
			filteredResults,
			tasks
		);
		if (recommendations) {
			context += recommendations;
		}
	}

	return context;
}

/**
 * Generate a summary of the analysis
 * @param {Object} filteredResults - Results by language
 * @returns {string} Summary section
 */
function generateSummary(filteredResults) {
	const stats = {
		totalFiles: 0,
		totalFunctions: 0,
		totalClasses: 0,
		totalImports: 0,
		languages: Object.keys(filteredResults),
		avgComplexity: 0
	};

	let complexitySum = 0;
	let complexityCount = 0;

	for (const results of Object.values(filteredResults)) {
		stats.totalFiles += results.length;

		for (const result of results) {
			if (result.ast.functions)
				stats.totalFunctions += result.ast.functions.length;
			if (result.ast.classes) stats.totalClasses += result.ast.classes.length;
			if (result.ast.imports) stats.totalImports += result.ast.imports.length;

			if (result.ast.complexity) {
				complexitySum += result.ast.complexity;
				complexityCount++;
			}
		}
	}

	stats.avgComplexity =
		complexityCount > 0 ? (complexitySum / complexityCount).toFixed(1) : 0;

	let summary = '**Analysis Summary:**\n';
	summary += `- **${stats.totalFiles}** relevant files analyzed\n`;
	summary += `- **${stats.totalFunctions}** functions found\n`;
	summary += `- **${stats.totalClasses}** classes/types found\n`;
	summary += `- **${stats.totalImports}** imports/dependencies\n`;
	summary += `- **${stats.languages.join(', ')}** programming languages\n`;
	summary += `- **${stats.avgComplexity}/10** average complexity score\n\n`;

	return summary;
}

/**
 * Format functions and classes section
 * @param {Array} results - Parse results for a language
 * @param {Object} options - Formatting options
 * @returns {string} Formatted functions/classes
 */
function formatFunctionsAndClasses(results, options = {}) {
	const { includeComplexity = true } = options;
	const allFunctions = [];
	const allClasses = [];

	// Collect all functions and classes
	for (const result of results) {
		if (result.ast.functions) {
			for (const func of result.ast.functions) {
				allFunctions.push({
					...func,
					file: result.file.path,
					fromCache: result.fromCache
				});
			}
		}

		if (result.ast.classes) {
			for (const cls of result.ast.classes) {
				allClasses.push({
					...cls,
					file: result.file.path,
					fromCache: result.fromCache
				});
			}
		}
	}

	let section = '';

	// Format functions
	if (allFunctions.length > 0) {
		section += `**Key Functions (${allFunctions.length}):**\n`;

		// Sort by complexity (highest first) and take top 8
		const topFunctions = allFunctions
			.sort((a, b) => (b.complexity || 0) - (a.complexity || 0))
			.slice(0, 8);

		for (const func of topFunctions) {
			section += `- \`${func.name}()\``;

			if (includeComplexity && func.complexity) {
				section += ` - complexity: ${func.complexity}/10`;
			}

			if (func.lineCount) {
				section += `, lines: ${func.lineCount}`;
			}

			if (func.parameters && func.parameters.length > 0) {
				section += `, params: ${func.parameters.length}`;
			}

			section += ` *(${func.file})*\n`;
		}
		section += '\n';
	}

	// Format classes
	if (allClasses.length > 0) {
		section += `**Key Classes/Types (${allClasses.length}):**\n`;

		// Take first 6 classes
		const topClasses = allClasses.slice(0, 6);

		for (const cls of topClasses) {
			section += `- \`${cls.name}\``;

			if (cls.methods && cls.methods.length > 0) {
				section += ` - ${cls.methods.length} methods`;
			}

			if (cls.properties && cls.properties.length > 0) {
				section += `, ${cls.properties.length} properties`;
			}

			section += ` *(${cls.file})*\n`;
		}
		section += '\n';
	}

	return section;
}

/**
 * Format imports and dependencies section
 * @param {Array} results - Parse results for a language
 * @param {string} language - Programming language
 * @returns {string} Formatted imports section
 */
function formatImportsAndDependencies(results, language) {
	const allImports = new Set();
	const importsByCategory = {
		framework: [],
		library: [],
		local: [],
		builtin: []
	};

	// Collect all unique imports
	for (const result of results) {
		if (result.ast.imports) {
			for (const imp of result.ast.imports) {
				const importName = imp.source || imp.module || imp.name;
				if (importName && !allImports.has(importName)) {
					allImports.add(importName);

					// Categorize import
					const category = categorizeImport(importName, language);
					importsByCategory[category].push({
						name: importName,
						type: imp.type || 'import',
						file: result.file.path
					});
				}
			}
		}
	}

	if (allImports.size === 0) return '';

	let section = `**Dependencies & Imports (${allImports.size}):**\n`;

	// Format by category
	for (const [category, imports] of Object.entries(importsByCategory)) {
		if (imports.length === 0) continue;

		section += `\n*${category.charAt(0).toUpperCase() + category.slice(1)} Dependencies:*\n`;

		// Take top 6 per category
		const topImports = imports.slice(0, 6);
		for (const imp of topImports) {
			section += `- \`${imp.name}\``;
			if (imp.type !== 'import') {
				section += ` (${imp.type})`;
			}
			section += '\n';
		}

		if (imports.length > 6) {
			section += `- *...and ${imports.length - 6} more*\n`;
		}
	}

	section += '\n';
	return section;
}

/**
 * Categorize an import/dependency
 * @param {string} importName - Import name
 * @param {string} language - Programming language
 * @returns {string} Category name
 */
function categorizeImport(importName, language) {
	const lower = importName.toLowerCase();

	// Framework imports
	const frameworks = {
		javascript: [
			'react',
			'vue',
			'angular',
			'express',
			'fastify',
			'koa',
			'next',
			'nuxt'
		],
		python: ['django', 'flask', 'fastapi', 'tornado', 'pyramid'],
		go: ['gin', 'echo', 'fiber', 'chi', 'gorilla']
	};

	if (frameworks[language]?.some((fw) => lower.includes(fw))) {
		return 'framework';
	}

	// Local/relative imports
	if (
		importName.startsWith('.') ||
		importName.startsWith('/') ||
		importName.includes('./')
	) {
		return 'local';
	}

	// Built-in modules
	const builtins = {
		javascript: ['fs', 'path', 'util', 'crypto', 'http', 'https', 'url', 'os'],
		python: [
			'os',
			'sys',
			'json',
			'time',
			'datetime',
			'collections',
			're',
			'math'
		],
		go: ['fmt', 'os', 'time', 'strings', 'encoding/json', 'net/http', 'context']
	};

	if (
		builtins[language]?.some(
			(builtin) => lower === builtin || lower.startsWith(builtin + '/')
		)
	) {
		return 'builtin';
	}

	// Everything else is a library
	return 'library';
}

/**
 * Format code patterns section
 * @param {Array} results - Parse results for a language
 * @param {string} language - Programming language
 * @returns {string} Formatted patterns section
 */
function formatCodePatterns(results, language) {
	const patterns = detectCodePatterns(results, language);

	if (patterns.length === 0) return '';

	let section = `**Code Patterns:**\n`;
	for (const pattern of patterns.slice(0, 5)) {
		section += `- ${pattern}\n`;
	}
	section += '\n';

	return section;
}

/**
 * Detect common code patterns
 * @param {Array} results - Parse results
 * @param {string} language - Programming language
 * @returns {Array} Array of pattern descriptions
 */
function detectCodePatterns(results, language) {
	const patterns = [];

	// Analyze all functions for patterns
	const allFunctions = results.flatMap((r) => r.ast.functions || []);
	const allClasses = results.flatMap((r) => r.ast.classes || []);

	// Async patterns
	const asyncFunctions = allFunctions.filter(
		(f) => f.isAsync || f.name.includes('async')
	);
	if (asyncFunctions.length > 0) {
		patterns.push(
			`Async operations: ${asyncFunctions.length} async functions found`
		);
	}

	// Error handling patterns
	const errorHandlingFunctions = allFunctions.filter(
		(f) =>
			f.name.toLowerCase().includes('error') ||
			f.name.toLowerCase().includes('catch') ||
			f.name.toLowerCase().includes('handle')
	);
	if (errorHandlingFunctions.length > 0) {
		patterns.push(
			`Error handling: ${errorHandlingFunctions.length} error-related functions`
		);
	}

	// Test patterns
	const testFunctions = allFunctions.filter(
		(f) =>
			f.name.toLowerCase().includes('test') ||
			f.name.toLowerCase().includes('spec') ||
			f.name.toLowerCase().startsWith('it') ||
			f.name.toLowerCase().startsWith('describe')
	);
	if (testFunctions.length > 0) {
		patterns.push(`Testing: ${testFunctions.length} test functions found`);
	}

	// CRUD patterns
	const crudPatterns = [
		'create',
		'read',
		'update',
		'delete',
		'get',
		'set',
		'add',
		'remove'
	];
	const crudFunctions = allFunctions.filter((f) =>
		crudPatterns.some((pattern) => f.name.toLowerCase().includes(pattern))
	);
	if (crudFunctions.length > 0) {
		patterns.push(
			`CRUD operations: ${crudFunctions.length} data manipulation functions`
		);
	}

	// Language-specific patterns
	if (language === 'javascript' || language === 'typescript') {
		// React patterns
		const reactComponents = allFunctions.filter(
			(f) => f.name.match(/^[A-Z]/) || f.name.includes('Component')
		);
		if (reactComponents.length > 0) {
			patterns.push(
				`React components: ${reactComponents.length} component functions`
			);
		}

		// Hook patterns
		const hooks = allFunctions.filter((f) => f.name.startsWith('use'));
		if (hooks.length > 0) {
			patterns.push(`React hooks: ${hooks.length} custom hooks`);
		}
	} else if (language === 'python') {
		// Class-based patterns
		if (allClasses.length > 0) {
			patterns.push(`Object-oriented: ${allClasses.length} classes defined`);
		}

		// Decorator patterns
		const decoratedFunctions = allFunctions.filter(
			(f) => f.decorators && f.decorators.length > 0
		);
		if (decoratedFunctions.length > 0) {
			patterns.push(
				`Decorators: ${decoratedFunctions.length} decorated functions`
			);
		}
	} else if (language === 'go') {
		// Interface patterns
		const interfaces = allClasses.filter((c) => c.type === 'interface');
		if (interfaces.length > 0) {
			patterns.push(`Interfaces: ${interfaces.length} interface definitions`);
		}

		// Goroutine patterns
		const goroutineFunctions = allFunctions.filter(
			(f) =>
				f.name.toLowerCase().includes('goroutine') ||
				f.name.toLowerCase().includes('worker')
		);
		if (goroutineFunctions.length > 0) {
			patterns.push(
				`Concurrency: ${goroutineFunctions.length} goroutine-related functions`
			);
		}
	}

	return patterns;
}

/**
 * Generate cross-language insights
 * @param {Object} filteredResults - Results by language
 * @returns {string} Cross-language insights section
 */
function generateCrossLanguageInsights(filteredResults) {
	const languages = Object.keys(filteredResults);

	if (languages.length <= 1) return '';

	let section = '### Cross-Language Architecture\n\n';

	// API/interface patterns
	const hasApi = Object.values(filteredResults).some((results) =>
		results.some(
			(r) =>
				r.file.path.includes('api') ||
				r.ast.functions?.some((f) => f.name.toLowerCase().includes('api'))
		)
	);

	if (hasApi) {
		section += '- **API Layer**: Multi-language API implementation detected\n';
	}

	// Database patterns
	const hasDatabase = Object.values(filteredResults).some((results) =>
		results.some(
			(r) =>
				r.file.path.includes('db') ||
				r.file.path.includes('database') ||
				r.ast.imports?.some(
					(imp) =>
						(imp.source || '').toLowerCase().includes('sql') ||
						(imp.source || '').toLowerCase().includes('db')
				)
		)
	);

	if (hasDatabase) {
		section +=
			'- **Data Layer**: Database integration across multiple languages\n';
	}

	// Testing across languages
	const hasTests = Object.values(filteredResults).some((results) =>
		results.some(
			(r) =>
				r.file.path.includes('test') ||
				r.ast.functions?.some((f) => f.name.toLowerCase().includes('test'))
		)
	);

	if (hasTests) {
		section += '- **Testing**: Test coverage across multiple languages\n';
	}

	section += '\n';
	return section;
}

/**
 * Generate implementation recommendations based on tasks
 * @param {Object} filteredResults - Results by language
 * @param {Array} tasks - Current tasks
 * @returns {string} Recommendations section
 */
function generateImplementationRecommendations(filteredResults, tasks) {
	let section = '### Implementation Recommendations\n\n';

	// Analyze task complexity vs. code complexity
	const avgCodeComplexity = calculateAverageComplexity(filteredResults);

	if (avgCodeComplexity > 7) {
		section +=
			'- **High Complexity**: Consider breaking down complex functions before adding new features\n';
	}

	// Check for missing test coverage
	const hasTestFiles = Object.values(filteredResults).some((results) =>
		results.some((r) => r.file.path.includes('test'))
	);

	if (!hasTestFiles) {
		section +=
			'- **Testing**: No test files detected - consider adding tests for new implementations\n';
	}

	// Language-specific recommendations
	const languages = Object.keys(filteredResults);
	if (languages.includes('javascript') && languages.includes('typescript')) {
		section +=
			'- **Type Safety**: Consider migrating JavaScript files to TypeScript for better type safety\n';
	}

	// Check for authentication patterns in tasks
	const hasAuthTask = tasks.some(
		(task) =>
			(task.title || '').toLowerCase().includes('auth') ||
			(task.description || '').toLowerCase().includes('auth')
	);

	if (hasAuthTask) {
		const hasAuthCode = Object.values(filteredResults).some((results) =>
			results.some(
				(r) =>
					r.file.path.includes('auth') ||
					r.ast.functions?.some((f) => f.name.toLowerCase().includes('auth'))
			)
		);

		if (!hasAuthCode) {
			section +=
				'- **Authentication**: No existing auth code detected - starting from scratch\n';
		} else {
			section +=
				'- **Authentication**: Existing auth patterns found - follow established conventions\n';
		}
	}

	section += '\n';
	return section;
}

/**
 * Calculate average complexity across all results
 * @param {Object} filteredResults - Results by language
 * @returns {number} Average complexity
 */
function calculateAverageComplexity(filteredResults) {
	let totalComplexity = 0;
	let count = 0;

	for (const results of Object.values(filteredResults)) {
		for (const result of results) {
			if (result.ast.complexity) {
				totalComplexity += result.ast.complexity;
				count++;
			}
		}
	}

	return count > 0 ? totalComplexity / count : 0;
}

/**
 * Format language name for display
 * @param {string} language - Language identifier
 * @returns {string} Formatted language name
 */
function formatLanguageName(language) {
	const names = {
		javascript: 'JavaScript',
		typescript: 'TypeScript',
		python: 'Python',
		go: 'Go'
	};

	return (
		names[language] || language.charAt(0).toUpperCase() + language.slice(1)
	);
}
