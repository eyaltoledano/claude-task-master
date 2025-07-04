/**
 * Python Specific Analyzer - Phase 2.2
 *
 * Provides deep analysis of Python codebases with focus on:
 * - Django patterns (models, views, templates)
 * - FastAPI patterns (dependencies, routes, schemas)
 * - Flask patterns (blueprints, decorators)
 * - Modern Python features (type hints, dataclasses, async)
 * - Data science patterns (pandas, numpy, sklearn)
 *
 * @author Task Master Flow
 * @version 2.2.0
 */

import CodeAnalyzer from '../context/code-analyzer.js';
import ComplexityScorer from '../context/complexity-scorer.js';
import DependencyMapper from '../context/dependency-mapper.js';

/**
 * Specialized Python analyzer
 */
export class PythonAnalyzer {
	constructor(options = {}) {
		this.options = {
			enableDjangoAnalysis: true,
			enableFastAPIAnalysis: true,
			enableFlaskAnalysis: true,
			enableDataScienceAnalysis: true,
			enableAsyncAnalysis: true,
			...options
		};

		// Initialize Phase 2.1 components
		this.codeAnalyzer = new CodeAnalyzer();
		this.complexityScorer = new ComplexityScorer();
		this.dependencyMapper = new DependencyMapper();
	}

	/**
	 * Perform comprehensive Python analysis
	 * @param {Object} astData - Parsed AST data
	 * @param {string} filePath - File path for context
	 * @param {string} content - Source code content
	 * @returns {Promise<Object>} Comprehensive analysis results
	 */
	async analyzePython(astData, filePath, content) {
		const analysis = {
			language: 'python',
			pythonVersion: this.detectPythonVersion(content),
			framework: await this.detectFramework(astData, content),
			patterns: await this.analyzePythonPatterns(astData, content),
			complexity: await this.analyzeComplexity(astData, content),
			codeQuality: await this.analyzeCodeQuality(astData, content),
			typeHints: this.analyzeTypeHints(content),
			recommendations: []
		};

		// Generate Python-specific recommendations
		analysis.recommendations = this.generatePythonRecommendations(analysis);

		return analysis;
	}

	/**
	 * Detect Python version from content
	 * @param {string} content - Source code
	 * @returns {string} Python version indicator
	 */
	detectPythonVersion(content) {
		// Python 3.10+ features
		if (/match\s+\w+:|case\s+\w+:/.test(content)) {
			return '3.10+';
		}

		// Python 3.8+ features
		if (/:=|\/(?!\*)/.test(content)) {
			return '3.8+';
		}

		// Python 3.6+ features (f-strings)
		if (/f["'][^"']*\{[^}]*\}[^"']*["']/.test(content)) {
			return '3.6+';
		}

		// Python 3.5+ features (type hints)
		if (/def\s+\w+\([^)]*\)\s*->\s*\w+:/.test(content)) {
			return '3.5+';
		}

		// Check for print function vs statement
		if (/print\s*\(/.test(content) && !/print\s+[^(]/.test(content)) {
			return '3.x';
		}

		return 'unknown';
	}

	/**
	 * Detect Python frameworks
	 * @param {Object} astData - AST data
	 * @param {string} content - Source code
	 * @returns {Promise<Object>} Framework detection results
	 */
	async detectFramework(astData, content) {
		const frameworks = {
			django: this.detectDjangoFramework(astData, content),
			fastapi: this.detectFastAPIFramework(astData, content),
			flask: this.detectFlaskFramework(astData, content),
			pandas: this.detectPandasFramework(astData, content),
			numpy: this.detectNumpyFramework(astData, content),
			sklearn: this.detectSklearnFramework(astData, content),
			asyncio: this.detectAsyncioFramework(content),
			pytest: this.detectPytestFramework(content)
		};

		// Filter detected frameworks
		const detected = Object.entries(frameworks)
			.filter(([name, result]) => result.detected)
			.map(([name, result]) => ({
				name,
				confidence: result.confidence,
				evidence: result.evidence,
				version: result.version
			}));

		return {
			primary: detected[0] || null,
			all: detected,
			count: detected.length
		};
	}

	/**
	 * Detect Django framework
	 * @param {Object} astData - AST data
	 * @param {string} content - Source code
	 * @returns {Object} Django detection result
	 */
	detectDjangoFramework(astData, content) {
		const evidence = [];
		let confidence = 0;

		// Django imports
		const imports = astData.imports || [];
		const djangoImports = imports.filter(
			(imp) => imp.source && imp.source.includes('django')
		);

		if (djangoImports.length > 0) {
			confidence += 0.5;
			evidence.push(
				`Django imports: ${djangoImports.map((i) => i.source).join(', ')}`
			);
		}

		// Django patterns
		const djangoPatterns = [
			{
				pattern: /class\s+\w+\(models\.Model\):/,
				description: 'Django model classes'
			},
			{
				pattern: /def\s+\w+\(request[^)]*\):/,
				description: 'Django view functions'
			},
			{
				pattern: /@login_required|@permission_required/,
				description: 'Django decorators'
			},
			{ pattern: /urlpatterns\s*=/, description: 'Django URL patterns' },
			{
				pattern: /INSTALLED_APPS|DATABASES|SECRET_KEY/,
				description: 'Django settings'
			}
		];

		djangoPatterns.forEach(({ pattern, description }) => {
			if (pattern.test(content)) {
				confidence += 0.1;
				evidence.push(description);
			}
		});

		return {
			detected: confidence > 0.3,
			confidence: Math.min(confidence, 1.0),
			evidence,
			version: null
		};
	}

	/**
	 * Detect FastAPI framework
	 * @param {Object} astData - AST data
	 * @param {string} content - Source code
	 * @returns {Object} FastAPI detection result
	 */
	detectFastAPIFramework(astData, content) {
		const evidence = [];
		let confidence = 0;

		// FastAPI imports
		const imports = astData.imports || [];
		const fastapiImports = imports.filter(
			(imp) => imp.source && imp.source.includes('fastapi')
		);

		if (fastapiImports.length > 0) {
			confidence += 0.5;
			evidence.push('FastAPI imports detected');
		}

		// FastAPI patterns
		if (/@app\.(get|post|put|delete|patch)/.test(content)) {
			confidence += 0.3;
			evidence.push('FastAPI route decorators');
		}

		if (/FastAPI\s*\(|app\s*=\s*FastAPI/.test(content)) {
			confidence += 0.2;
			evidence.push('FastAPI app instance');
		}

		if (/Depends\s*\(|Path\s*\(|Query\s*\(|Body\s*\(/.test(content)) {
			confidence += 0.2;
			evidence.push('FastAPI dependency injection');
		}

		return {
			detected: confidence > 0.3,
			confidence: Math.min(confidence, 1.0),
			evidence,
			version: null
		};
	}

	/**
	 * Detect Flask framework
	 * @param {Object} astData - AST data
	 * @param {string} content - Source code
	 * @returns {Object} Flask detection result
	 */
	detectFlaskFramework(astData, content) {
		const evidence = [];
		let confidence = 0;

		// Flask imports
		const imports = astData.imports || [];
		const flaskImports = imports.filter(
			(imp) => imp.source && imp.source.includes('flask')
		);

		if (flaskImports.length > 0) {
			confidence += 0.4;
			evidence.push('Flask imports detected');
		}

		// Flask patterns
		if (/@app\.route|@bp\.route/.test(content)) {
			confidence += 0.3;
			evidence.push('Flask route decorators');
		}

		if (/Flask\s*\(__name__\)|app\s*=\s*Flask/.test(content)) {
			confidence += 0.2;
			evidence.push('Flask app instance');
		}

		return {
			detected: confidence > 0.3,
			confidence: Math.min(confidence, 1.0),
			evidence,
			version: null
		};
	}

	/**
	 * Detect pandas framework
	 * @param {Object} astData - AST data
	 * @param {string} content - Source code
	 * @returns {Object} Pandas detection result
	 */
	detectPandasFramework(astData, content) {
		const evidence = [];
		let confidence = 0;

		// Pandas imports
		if (/import\s+pandas|from\s+pandas/.test(content)) {
			confidence += 0.4;
			evidence.push('Pandas imports detected');
		}

		// Pandas patterns
		if (/pd\.|DataFrame|Series/.test(content)) {
			confidence += 0.3;
			evidence.push('Pandas data structures');
		}

		if (/\.read_csv|\.to_csv|\.groupby|\.merge/.test(content)) {
			confidence += 0.2;
			evidence.push('Pandas data operations');
		}

		return {
			detected: confidence > 0.3,
			confidence: Math.min(confidence, 1.0),
			evidence,
			version: null
		};
	}

	/**
	 * Detect numpy framework
	 * @param {Object} astData - AST data
	 * @param {string} content - Source code
	 * @returns {Object} Numpy detection result
	 */
	detectNumpyFramework(astData, content) {
		const evidence = [];
		let confidence = 0;

		// NumPy imports
		if (/import\s+numpy|from\s+numpy/.test(content)) {
			confidence += 0.4;
			evidence.push('NumPy imports detected');
		}

		// NumPy patterns
		if (/np\.|array\(|ndarray/.test(content)) {
			confidence += 0.3;
			evidence.push('NumPy arrays and operations');
		}

		return {
			detected: confidence > 0.3,
			confidence: Math.min(confidence, 1.0),
			evidence,
			version: null
		};
	}

	/**
	 * Detect scikit-learn framework
	 * @param {Object} astData - AST data
	 * @param {string} content - Source code
	 * @returns {Object} Sklearn detection result
	 */
	detectSklearnFramework(astData, content) {
		const evidence = [];
		let confidence = 0;

		// Scikit-learn imports
		if (/from\s+sklearn|import\s+sklearn/.test(content)) {
			confidence += 0.4;
			evidence.push('Scikit-learn imports detected');
		}

		// ML patterns
		if (/\.fit\(|\.predict\(|\.transform\(/.test(content)) {
			confidence += 0.2;
			evidence.push('Machine learning patterns');
		}

		return {
			detected: confidence > 0.3,
			confidence: Math.min(confidence, 1.0),
			evidence,
			version: null
		};
	}

	/**
	 * Detect asyncio framework
	 * @param {string} content - Source code
	 * @returns {Object} Asyncio detection result
	 */
	detectAsyncioFramework(content) {
		const evidence = [];
		let confidence = 0;

		// Async patterns
		if (/async\s+def|await\s+/.test(content)) {
			confidence += 0.3;
			evidence.push('Async/await patterns');
		}

		if (/asyncio\.|import\s+asyncio/.test(content)) {
			confidence += 0.3;
			evidence.push('Asyncio module usage');
		}

		return {
			detected: confidence > 0.2,
			confidence: Math.min(confidence, 1.0),
			evidence,
			version: null
		};
	}

	/**
	 * Detect pytest framework
	 * @param {string} content - Source code
	 * @returns {Object} Pytest detection result
	 */
	detectPytestFramework(content) {
		const evidence = [];
		let confidence = 0;

		// Pytest patterns
		if (/def\s+test_|import\s+pytest|from\s+pytest/.test(content)) {
			confidence += 0.4;
			evidence.push('Pytest testing patterns');
		}

		if (/@pytest\.|fixture|parametrize/.test(content)) {
			confidence += 0.3;
			evidence.push('Pytest decorators and fixtures');
		}

		return {
			detected: confidence > 0.3,
			confidence: Math.min(confidence, 1.0),
			evidence,
			version: null
		};
	}

	/**
	 * Analyze Python-specific patterns
	 * @param {Object} astData - AST data
	 * @param {string} content - Source code
	 * @returns {Promise<Object>} Pattern analysis
	 */
	async analyzePythonPatterns(astData, content) {
		// Use Phase 2.1 CodeAnalyzer for base analysis
		const basePatterns = await this.codeAnalyzer.analyzePatterns(
			astData,
			'python',
			null,
			content
		);

		// Add Python-specific patterns
		const pythonPatterns = {
			...basePatterns,
			decorators: this.analyzeDecoratorPatterns(content),
			contextManagers: this.analyzeContextManagerPatterns(content),
			comprehensions: this.analyzeComprehensionPatterns(content),
			generators: this.analyzeGeneratorPatterns(content),
			dataClasses: this.analyzeDataClassPatterns(content),
			typeHints: this.analyzeTypeHintPatterns(content),
			asyncPatterns: this.analyzeAsyncPatterns(content)
		};

		return pythonPatterns;
	}

	/**
	 * Analyze decorator patterns
	 * @param {string} content - Source code
	 * @returns {Array} Decorator patterns
	 */
	analyzeDecoratorPatterns(content) {
		const patterns = [];

		// Standard decorators
		const decoratorPatterns = [
			{
				pattern: /@property/,
				name: 'property_decorators',
				description: 'Property decorators'
			},
			{
				pattern: /@staticmethod/,
				name: 'staticmethod_decorators',
				description: 'Static method decorators'
			},
			{
				pattern: /@classmethod/,
				name: 'classmethod_decorators',
				description: 'Class method decorators'
			},
			{
				pattern: /@dataclass/,
				name: 'dataclass_decorators',
				description: 'Dataclass decorators'
			},
			{
				pattern: /@functools\./,
				name: 'functools_decorators',
				description: 'Functools decorators'
			},
			{
				pattern: /@app\.|@bp\./,
				name: 'route_decorators',
				description: 'Route decorators'
			}
		];

		decoratorPatterns.forEach(({ pattern, name, description }) => {
			const matches = content.match(new RegExp(pattern, 'g'));
			if (matches && matches.length > 0) {
				patterns.push({
					type: name,
					count: matches.length,
					description,
					confidence: 0.9
				});
			}
		});

		return patterns;
	}

	/**
	 * Analyze context manager patterns
	 * @param {string} content - Source code
	 * @returns {Array} Context manager patterns
	 */
	analyzeContextManagerPatterns(content) {
		const patterns = [];

		// With statements
		const withStatements = content.match(/with\s+[^:]+:/g);
		if (withStatements && withStatements.length > 0) {
			patterns.push({
				type: 'with_statements',
				count: withStatements.length,
				description: 'Context manager usage (with statements)',
				confidence: 0.9
			});
		}

		// Custom context managers
		if (/def\s+__enter__|def\s+__exit__/.test(content)) {
			patterns.push({
				type: 'custom_context_managers',
				description: 'Custom context manager implementation',
				confidence: 0.95
			});
		}

		return patterns;
	}

	/**
	 * Analyze comprehension patterns
	 * @param {string} content - Source code
	 * @returns {Array} Comprehension patterns
	 */
	analyzeComprehensionPatterns(content) {
		const patterns = [];

		// List comprehensions
		const listComps = content.match(/\[[^\]]*for\s+\w+\s+in[^\]]*\]/g);
		if (listComps && listComps.length > 0) {
			patterns.push({
				type: 'list_comprehensions',
				count: listComps.length,
				description: 'List comprehensions',
				confidence: 0.9
			});
		}

		// Dict comprehensions
		const dictComps = content.match(/\{[^}]*for\s+\w+\s+in[^}]*\}/g);
		if (dictComps && dictComps.length > 0) {
			patterns.push({
				type: 'dict_comprehensions',
				count: dictComps.length,
				description: 'Dictionary comprehensions',
				confidence: 0.9
			});
		}

		return patterns;
	}

	/**
	 * Analyze generator patterns
	 * @param {string} content - Source code
	 * @returns {Array} Generator patterns
	 */
	analyzeGeneratorPatterns(content) {
		const patterns = [];

		// Yield statements
		const yields = content.match(/yield\s+/g);
		if (yields && yields.length > 0) {
			patterns.push({
				type: 'generators',
				count: yields.length,
				description: 'Generator functions with yield',
				confidence: 0.9
			});
		}

		// Generator expressions
		const genExps = content.match(/\([^)]*for\s+\w+\s+in[^)]*\)/g);
		if (genExps && genExps.length > 0) {
			patterns.push({
				type: 'generator_expressions',
				count: genExps.length,
				description: 'Generator expressions',
				confidence: 0.8
			});
		}

		return patterns;
	}

	/**
	 * Analyze dataclass patterns
	 * @param {string} content - Source code
	 * @returns {Array} Dataclass patterns
	 */
	analyzeDataClassPatterns(content) {
		const patterns = [];

		if (/@dataclass/.test(content)) {
			const dataclassCount = (content.match(/@dataclass/g) || []).length;
			patterns.push({
				type: 'dataclasses',
				count: dataclassCount,
				description: 'Dataclass usage for structured data',
				confidence: 0.95
			});
		}

		return patterns;
	}

	/**
	 * Analyze type hint patterns
	 * @param {string} content - Source code
	 * @returns {Array} Type hint patterns
	 */
	analyzeTypeHintPatterns(content) {
		const patterns = [];

		// Function type hints
		const funcHints = content.match(/def\s+\w+\([^)]*\)\s*->\s*\w+:/g);
		if (funcHints && funcHints.length > 0) {
			patterns.push({
				type: 'function_type_hints',
				count: funcHints.length,
				description: 'Function return type hints',
				confidence: 0.9
			});
		}

		// Variable type hints
		const varHints = content.match(/\w+:\s*\w+\s*=/g);
		if (varHints && varHints.length > 0) {
			patterns.push({
				type: 'variable_type_hints',
				count: varHints.length,
				description: 'Variable type annotations',
				confidence: 0.9
			});
		}

		return patterns;
	}

	/**
	 * Analyze async patterns
	 * @param {string} content - Source code
	 * @returns {Array} Async patterns
	 */
	analyzeAsyncPatterns(content) {
		const patterns = [];

		// Async functions
		const asyncFuncs = content.match(/async\s+def\s+\w+/g);
		if (asyncFuncs && asyncFuncs.length > 0) {
			patterns.push({
				type: 'async_functions',
				count: asyncFuncs.length,
				description: 'Asynchronous function definitions',
				confidence: 0.9
			});
		}

		// Await expressions
		const awaits = content.match(/await\s+\w+/g);
		if (awaits && awaits.length > 0) {
			patterns.push({
				type: 'await_expressions',
				count: awaits.length,
				description: 'Await expressions for async operations',
				confidence: 0.9
			});
		}

		return patterns;
	}

	/**
	 * Analyze type hints coverage
	 * @param {string} content - Source code
	 * @returns {Object} Type hints analysis
	 */
	analyzeTypeHints(content) {
		const functions =
			content.match(/def\s+\w+\([^)]*\)(?:\s*->\s*\w+)?:/g) || [];
		const typedFunctions =
			content.match(/def\s+\w+\([^)]*\)\s*->\s*\w+:/g) || [];

		const coverage =
			functions.length > 0
				? (typedFunctions.length / functions.length) * 100
				: 0;

		return {
			totalFunctions: functions.length,
			typedFunctions: typedFunctions.length,
			coverage: Math.round(coverage),
			hasTypeHints: typedFunctions.length > 0
		};
	}

	/**
	 * Analyze complexity using Phase 2.1 components
	 * @param {Object} astData - AST data
	 * @param {string} content - Source code
	 * @returns {Promise<Object>} Complexity analysis
	 */
	async analyzeComplexity(astData, content) {
		return await this.complexityScorer.calculateComplexity(
			astData,
			'python',
			content
		);
	}

	/**
	 * Analyze code quality
	 * @param {Object} astData - AST data
	 * @param {string} content - Source code
	 * @returns {Promise<Object>} Code quality analysis
	 */
	async analyzeCodeQuality(astData, content) {
		const quality = {
			score: 10,
			issues: [],
			suggestions: []
		};

		const functions = astData.functions || [];

		// Check for long functions
		const longFunctions = functions.filter(
			(func) =>
				func.lineEnd && func.lineStart && func.lineEnd - func.lineStart > 40
		);

		if (longFunctions.length > 0) {
			quality.score -= 1;
			quality.issues.push({
				type: 'long_functions',
				severity: 'medium',
				count: longFunctions.length,
				message: `${longFunctions.length} functions exceed 40 lines`
			});
			quality.suggestions.push(
				'Break down large functions following single responsibility principle'
			);
		}

		// Check for missing docstrings
		const functionsWithoutDocstrings = functions.filter(
			(func) =>
				!content.slice(func.lineStart, func.lineEnd).includes('"""') &&
				!content.slice(func.lineStart, func.lineEnd).includes("'''")
		);

		if (functionsWithoutDocstrings.length > functions.length * 0.5) {
			quality.score -= 0.5;
			quality.issues.push({
				type: 'missing_docstrings',
				severity: 'low',
				count: functionsWithoutDocstrings.length,
				message: 'Many functions lack docstrings'
			});
			quality.suggestions.push(
				'Add docstrings to document function behavior and parameters'
			);
		}

		// Check for print statements (should use logging)
		const printStatements = (content.match(/print\s*\(/g) || []).length;
		if (printStatements > 2) {
			quality.score -= 0.3;
			quality.issues.push({
				type: 'print_statements',
				severity: 'low',
				count: printStatements,
				message: `${printStatements} print statements found`
			});
			quality.suggestions.push(
				'Use logging module instead of print statements'
			);
		}

		// Check for TODO/FIXME comments
		const todoComments = (content.match(/(TODO|FIXME|XXX)/g) || []).length;
		if (todoComments > 3) {
			quality.score -= 0.2;
			quality.issues.push({
				type: 'todo_comments',
				severity: 'low',
				count: todoComments,
				message: `${todoComments} TODO/FIXME comments found`
			});
			quality.suggestions.push(
				'Address TODO/FIXME comments or create proper issues'
			);
		}

		return quality;
	}

	/**
	 * Generate Python-specific recommendations
	 * @param {Object} analysis - Complete analysis results
	 * @returns {Array} Recommendations
	 */
	generatePythonRecommendations(analysis) {
		const recommendations = [];

		// Framework-specific recommendations
		if (analysis.framework.primary) {
			const framework = analysis.framework.primary.name;

			switch (framework) {
				case 'django':
					recommendations.push({
						type: 'framework_best_practices',
						priority: 'high',
						message: 'Follow Django best practices',
						details: [
							'Use Django models for database interactions',
							'Implement proper URL routing and views',
							'Use Django forms for input validation',
							'Follow Django security best practices',
							'Use Django migrations for schema changes'
						]
					});
					break;

				case 'fastapi':
					recommendations.push({
						type: 'framework_best_practices',
						priority: 'high',
						message: 'Follow FastAPI best practices',
						details: [
							'Use Pydantic models for request/response validation',
							'Implement proper dependency injection',
							'Use async/await for I/O operations',
							'Add comprehensive API documentation',
							'Implement proper error handling'
						]
					});
					break;

				case 'flask':
					recommendations.push({
						type: 'framework_best_practices',
						priority: 'high',
						message: 'Follow Flask best practices',
						details: [
							'Use blueprints for application organization',
							'Implement proper error handling',
							'Use Flask-WTF for form handling',
							'Configure proper logging',
							'Use Flask extensions for common functionality'
						]
					});
					break;
			}
		}

		// Type hints recommendations
		if (analysis.typeHints.coverage < 50) {
			recommendations.push({
				type: 'type_safety',
				priority: 'medium',
				message: 'Improve type hint coverage',
				details: [
					'Add type hints to function parameters and return values',
					'Use typing module for complex types',
					'Consider using mypy for static type checking',
					`Current coverage: ${analysis.typeHints.coverage}%`
				]
			});
		}

		// Python version recommendations
		if (
			analysis.pythonVersion === 'unknown' ||
			analysis.pythonVersion.startsWith('2.')
		) {
			recommendations.push({
				type: 'modernization',
				priority: 'high',
				message: 'Upgrade to modern Python',
				details: [
					'Use Python 3.8+ for better performance and features',
					'Migrate from Python 2 if still using it',
					'Use f-strings for string formatting',
					'Adopt dataclasses for structured data'
				]
			});
		}

		// Async recommendations
		const hasAsyncPatterns =
			analysis.patterns.asyncPatterns &&
			analysis.patterns.asyncPatterns.length > 0;
		if (hasAsyncPatterns) {
			recommendations.push({
				type: 'async_best_practices',
				priority: 'medium',
				message: 'Optimize async code usage',
				details: [
					'Use async/await consistently in async functions',
					'Avoid blocking operations in async code',
					'Use asyncio.gather() for concurrent operations',
					'Implement proper async context managers'
				]
			});
		}

		// Complexity-based recommendations
		if (
			analysis.complexity.overall &&
			analysis.complexity.overall.average > 6
		) {
			recommendations.push({
				type: 'complexity_reduction',
				priority: 'high',
				message: 'Reduce code complexity',
				details: [
					'Extract complex logic into separate functions',
					'Use early returns to reduce nesting',
					'Consider using design patterns for complex operations',
					'Add comprehensive unit tests for complex functions'
				]
			});
		}

		return recommendations;
	}
}

export default PythonAnalyzer;
