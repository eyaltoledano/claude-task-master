/**
 * Advanced Code Analyzer for AST Integration Phase 2.1
 *
 * Provides sophisticated pattern detection and code intelligence analysis
 * beyond basic AST parsing. Detects language-specific patterns, architectural
 * patterns, and code quality insights.
 *
 * @author Task Master Flow
 * @version 2.1.0
 */

import { readFile } from 'fs/promises';
import path from 'path';

/**
 * Advanced code analysis patterns and insights
 */
export class CodeAnalyzer {
	constructor(options = {}) {
		this.options = {
			enablePatternDetection: true,
			enableArchitecturalAnalysis: true,
			enableCodeSmellDetection: true,
			enableFrameworkDetection: true,
			...options
		};
	}

	/**
	 * Analyze code patterns and generate insights
	 * @param {Object} astData - Parsed AST data from language parser
	 * @param {string} language - Programming language
	 * @param {string} filePath - Path to the analyzed file
	 * @param {string} content - Source code content
	 * @returns {Promise<Object>} Analysis results with patterns and insights
	 */
	async analyzePatterns(astData, language, filePath, content) {
		try {
			const analysis = {
				filePath,
				language,
				timestamp: new Date().toISOString(),
				patterns: {},
				insights: [],
				codeQuality: {},
				frameworks: [],
				architecture: {}
			};

			// Core pattern detection
			if (this.options.enablePatternDetection) {
				analysis.patterns = await this.detectPatterns(
					astData,
					language,
					content
				);
			}

			// Architectural pattern analysis
			if (this.options.enableArchitecturalAnalysis) {
				analysis.architecture = this.analyzeArchitecture(astData, language);
			}

			// Code smell detection
			if (this.options.enableCodeSmellDetection) {
				analysis.codeQuality = this.analyzeCodeQuality(astData, language);
			}

			// Framework detection
			if (this.options.enableFrameworkDetection) {
				analysis.frameworks = this.detectFrameworks(
					astData,
					language,
					filePath
				);
			}

			// Generate actionable insights
			analysis.insights = this.generateInsights(analysis);

			return analysis;
		} catch (error) {
			console.error(`Code analysis failed for ${filePath}:`, error.message);
			return this.createErrorAnalysis(filePath, language, error);
		}
	}

	/**
	 * Detect language-specific and general patterns
	 * @param {Object} astData - Parsed AST data
	 * @param {string} language - Programming language
	 * @param {string} content - Source code content
	 * @returns {Promise<Object>} Detected patterns
	 */
	async detectPatterns(astData, language, content) {
		const patterns = {
			languageSpecific: {},
			designPatterns: {},
			asyncPatterns: {},
			errorHandling: {},
			testingPatterns: {}
		};

		// Language-specific pattern detection
		switch (language.toLowerCase()) {
			case 'javascript':
			case 'typescript':
				patterns.languageSpecific = this.detectJavaScriptPatterns(
					astData,
					content
				);
				break;
			case 'python':
				patterns.languageSpecific = this.detectPythonPatterns(astData, content);
				break;
			case 'go':
				patterns.languageSpecific = this.detectGoPatterns(astData, content);
				break;
		}

		// General design patterns
		patterns.designPatterns = this.detectDesignPatterns(astData, language);

		// Async patterns
		patterns.asyncPatterns = this.detectAsyncPatterns(astData, language);

		// Error handling patterns
		patterns.errorHandling = this.detectErrorHandlingPatterns(
			astData,
			language
		);

		// Testing patterns
		patterns.testingPatterns = this.detectTestingPatterns(
			astData,
			language,
			content
		);

		return patterns;
	}

	/**
	 * Detect JavaScript/TypeScript specific patterns
	 * @param {Object} astData - Parsed AST data
	 * @param {string} content - Source code content
	 * @returns {Object} JavaScript-specific patterns
	 */
	detectJavaScriptPatterns(astData, content) {
		const patterns = {
			reactPatterns: [],
			modulePatterns: [],
			closurePatterns: [],
			prototypePatterns: [],
			functionPatterns: []
		};

		const functions = astData.functions || [];
		const imports = astData.imports || [];

		// React patterns detection
		const reactImports = imports.filter(
			(imp) =>
				imp.source.includes('react') ||
				imp.imports.some((name) =>
					['useState', 'useEffect', 'useCallback', 'useMemo'].includes(name)
				)
		);

		if (reactImports.length > 0) {
			patterns.reactPatterns = this.analyzeReactPatterns(functions, content);
		}

		// Module patterns
		patterns.modulePatterns = this.analyzeModulePatterns(imports, content);

		// Function patterns
		patterns.functionPatterns = this.analyzeFunctionPatterns(
			functions,
			content
		);

		// Closure detection
		patterns.closurePatterns = this.detectClosurePatterns(content);

		return patterns;
	}

	/**
	 * Analyze React-specific patterns
	 * @param {Array} functions - Function AST data
	 * @param {string} content - Source code content
	 * @returns {Array} React patterns found
	 */
	analyzeReactPatterns(functions, content) {
		const patterns = [];

		// Functional components
		const functionalComponents = functions.filter(
			(func) =>
				func.name && /^[A-Z]/.test(func.name) && content.includes('return')
		);
		if (functionalComponents.length > 0) {
			patterns.push({
				type: 'functional_components',
				count: functionalComponents.length,
				components: functionalComponents.map((f) => f.name),
				confidence: 0.9
			});
		}

		// Hook usage patterns
		const hookUsage = this.detectHookUsage(content);
		if (hookUsage.length > 0) {
			patterns.push({
				type: 'hook_usage',
				hooks: hookUsage,
				confidence: 0.95
			});
		}

		return patterns;
	}

	/**
	 * Detect React hook usage
	 * @param {string} content - Source code content
	 * @returns {Array} Hook usage patterns
	 */
	detectHookUsage(content) {
		const hooks = [];
		const hookPatterns = {
			useState: /useState\s*\(/g,
			useEffect: /useEffect\s*\(/g,
			useCallback: /useCallback\s*\(/g,
			useMemo: /useMemo\s*\(/g,
			useContext: /useContext\s*\(/g,
			useReducer: /useReducer\s*\(/g,
			useRef: /useRef\s*\(/g
		};

		for (const [hook, pattern] of Object.entries(hookPatterns)) {
			const matches = content.match(pattern);
			if (matches) {
				hooks.push({
					hook,
					count: matches.length,
					usage: 'standard'
				});
			}
		}

		return hooks;
	}

	/**
	 * Detect Python specific patterns
	 * @param {Object} astData - Parsed AST data
	 * @param {string} content - Source code content
	 * @returns {Object} Python-specific patterns
	 */
	detectPythonPatterns(astData, content) {
		const patterns = {
			decoratorPatterns: [],
			contextManagerPatterns: [],
			generatorPatterns: [],
			classPatterns: [],
			comprehensionPatterns: []
		};

		// Decorator patterns
		patterns.decoratorPatterns = this.detectDecoratorPatterns(content);

		// Context manager patterns (with statements)
		patterns.contextManagerPatterns =
			this.detectContextManagerPatterns(content);

		return patterns;
	}

	/**
	 * Detect decorator patterns in Python
	 * @param {string} content - Source code content
	 * @returns {Array} Decorator patterns
	 */
	detectDecoratorPatterns(content) {
		const patterns = [];
		const decoratorRegex = /@(\w+)/g;
		const matches = [...content.matchAll(decoratorRegex)];

		if (matches.length > 0) {
			const decorators = matches.map((match) => match[1]);
			patterns.push({
				type: 'decorators',
				count: decorators.length,
				decorators: [...new Set(decorators)],
				confidence: 0.95
			});
		}

		return patterns;
	}

	/**
	 * Detect context manager patterns in Python
	 * @param {string} content - Source code content
	 * @returns {Array} Context manager patterns
	 */
	detectContextManagerPatterns(content) {
		const patterns = [];
		const withRegex = /with\s+(\w+)/g;
		const matches = [...content.matchAll(withRegex)];

		if (matches.length > 0) {
			patterns.push({
				type: 'context_managers',
				count: matches.length,
				confidence: 0.9
			});
		}

		return patterns;
	}

	/**
	 * Detect Go specific patterns
	 * @param {Object} astData - Parsed AST data
	 * @param {string} content - Source code content
	 * @returns {Object} Go-specific patterns
	 */
	detectGoPatterns(astData, content) {
		const patterns = {
			interfacePatterns: [],
			errorHandlingPatterns: [],
			concurrencyPatterns: [],
			packagePatterns: [],
			testPatterns: []
		};

		// Error handling patterns
		patterns.errorHandlingPatterns = this.detectGoErrorPatterns(content);

		// Concurrency patterns (goroutines, channels)
		patterns.concurrencyPatterns = this.detectGoConcurrencyPatterns(content);

		return patterns;
	}

	/**
	 * Detect Go error handling patterns
	 * @param {string} content - Source code content
	 * @returns {Array} Error handling patterns
	 */
	detectGoErrorPatterns(content) {
		const patterns = [];

		// if err != nil pattern
		const errorCheckRegex = /if\s+err\s*!=\s*nil/g;
		const errorChecks = content.match(errorCheckRegex);

		if (errorChecks && errorChecks.length > 0) {
			patterns.push({
				type: 'explicit_error_handling',
				count: errorChecks.length,
				confidence: 0.95
			});
		}

		return patterns;
	}

	/**
	 * Detect Go concurrency patterns
	 * @param {string} content - Source code content
	 * @returns {Array} Concurrency patterns
	 */
	detectGoConcurrencyPatterns(content) {
		const patterns = [];

		// Goroutine patterns
		const goroutineRegex = /go\s+\w+/g;
		const goroutines = content.match(goroutineRegex);

		if (goroutines && goroutines.length > 0) {
			patterns.push({
				type: 'goroutines',
				count: goroutines.length,
				confidence: 0.95
			});
		}

		return patterns;
	}

	/**
	 * Detect design patterns across languages
	 * @param {Object} astData - Parsed AST data
	 * @param {string} language - Programming language
	 * @returns {Object} Design patterns detected
	 */
	detectDesignPatterns(astData, language) {
		return {
			singleton: [],
			factory: [],
			observer: [],
			strategy: [],
			decorator: [],
			adapter: []
		};
	}

	/**
	 * Detect async patterns
	 * @param {Object} astData - Parsed AST data
	 * @param {string} language - Programming language
	 * @returns {Object} Async patterns detected
	 */
	detectAsyncPatterns(astData, language) {
		const patterns = {
			promises: [],
			asyncAwait: [],
			callbacks: [],
			generators: []
		};

		const functions = astData.functions || [];

		// Async/await functions
		const asyncFunctions = functions.filter((func) => func.isAsync);
		if (asyncFunctions.length > 0) {
			patterns.asyncAwait.push({
				type: 'async_functions',
				count: asyncFunctions.length,
				functions: asyncFunctions.map((f) => f.name),
				confidence: 0.95
			});
		}

		return patterns;
	}

	/**
	 * Analyze code architecture
	 * @param {Object} astData - Parsed AST data
	 * @param {string} language - Programming language
	 * @returns {Object} Architectural analysis
	 */
	analyzeArchitecture(astData, language) {
		return {
			complexity: this.calculateArchitecturalComplexity(astData),
			coupling: {},
			cohesion: {},
			responsibilities: {}
		};
	}

	/**
	 * Calculate architectural complexity
	 * @param {Object} astData - AST data
	 * @returns {Object} Complexity metrics
	 */
	calculateArchitecturalComplexity(astData) {
		const functions = astData.functions || [];
		const classes = astData.classes || [];

		return {
			functionCount: functions.length,
			classCount: classes.length,
			averageComplexity:
				functions.length > 0
					? functions.reduce((sum, f) => sum + (f.complexity || 1), 0) /
						functions.length
					: 1,
			maxComplexity: Math.max(...functions.map((f) => f.complexity || 1), 1)
		};
	}

	/**
	 * Analyze code quality and detect code smells
	 * @param {Object} astData - Parsed AST data
	 * @param {string} language - Programming language
	 * @returns {Object} Code quality analysis
	 */
	analyzeCodeQuality(astData, language) {
		const quality = {
			score: 0,
			issues: [],
			strengths: [],
			recommendations: []
		};

		const functions = astData.functions || [];
		const classes = astData.classes || [];

		// High complexity functions
		const complexFunctions = functions.filter((func) => func.complexity > 7);
		if (complexFunctions.length > 0) {
			quality.issues.push({
				type: 'high_complexity',
				severity: 'high',
				count: complexFunctions.length,
				functions: complexFunctions.map((f) => ({
					name: f.name,
					complexity: f.complexity
				})),
				recommendation: 'Refactor complex functions to improve maintainability'
			});
		}

		// Calculate overall quality score
		quality.score = this.calculateQualityScore(
			functions,
			classes,
			quality.issues
		);

		return quality;
	}

	/**
	 * Calculate overall code quality score
	 * @param {Array} functions - Function data
	 * @param {Array} classes - Class data
	 * @param {Array} issues - Quality issues
	 * @returns {number} Quality score (0-10)
	 */
	calculateQualityScore(functions, classes, issues) {
		let score = 10;

		// Deduct points for issues
		issues.forEach((issue) => {
			switch (issue.severity) {
				case 'high':
					score -= 2;
					break;
				case 'medium':
					score -= 1;
					break;
				case 'low':
					score -= 0.5;
					break;
			}
		});

		return Math.max(score, 0);
	}

	/**
	 * Detect frameworks and libraries
	 * @param {Object} astData - Parsed AST data
	 * @param {string} language - Programming language
	 * @param {string} filePath - File path for context
	 * @returns {Array} Frameworks detected
	 */
	detectFrameworks(astData, language, filePath) {
		const frameworks = [];
		const imports = astData.imports || [];

		// Framework detection by imports
		const frameworkPatterns = {
			react: ['react', 'react-dom', 'react-router'],
			vue: ['vue', '@vue/'],
			angular: ['@angular/', 'angular'],
			express: ['express'],
			fastapi: ['fastapi', 'pydantic'],
			django: ['django'],
			gin: ['github.com/gin-gonic/gin'],
			echo: ['github.com/labstack/echo']
		};

		for (const [framework, patterns] of Object.entries(frameworkPatterns)) {
			const matches = imports.filter((imp) =>
				patterns.some((pattern) => imp.source.includes(pattern))
			);

			if (matches.length > 0) {
				frameworks.push({
					name: framework,
					confidence: 0.9,
					evidence: matches.map((m) => m.source)
				});
			}
		}

		return frameworks;
	}

	/**
	 * Generate actionable insights from analysis
	 * @param {Object} analysis - Complete analysis results
	 * @returns {Array} Actionable insights
	 */
	generateInsights(analysis) {
		const insights = [];

		// Framework-specific insights
		if (analysis.frameworks.length > 0) {
			const framework = analysis.frameworks[0];
			insights.push({
				type: 'framework_usage',
				level: 'info',
				message: `Detected ${framework.name} framework usage`,
				actionable: `Follow ${framework.name} best practices and conventions`,
				confidence: framework.confidence
			});
		}

		// Complexity insights
		const highComplexityIssues =
			analysis.codeQuality.issues?.filter(
				(issue) => issue.type === 'high_complexity'
			) || [];

		if (highComplexityIssues.length > 0) {
			insights.push({
				type: 'complexity_warning',
				level: 'warning',
				message: `${highComplexityIssues[0].count} functions have high complexity`,
				actionable:
					'Consider refactoring complex functions for better maintainability',
				confidence: 0.9
			});
		}

		// Pattern insights
		if (analysis.patterns.languageSpecific?.reactPatterns?.length > 0) {
			insights.push({
				type: 'react_patterns',
				level: 'info',
				message: 'React component patterns detected',
				actionable: 'Ensure consistent component structure and hook usage',
				confidence: 0.8
			});
		}

		return insights;
	}

	/**
	 * Create error analysis result
	 * @param {string} filePath - File path
	 * @param {string} language - Programming language
	 * @param {Error} error - Error that occurred
	 * @returns {Object} Error analysis
	 */
	createErrorAnalysis(filePath, language, error) {
		return {
			filePath,
			language,
			timestamp: new Date().toISOString(),
			error: true,
			errorMessage: error.message,
			patterns: {},
			insights: [
				{
					type: 'analysis_error',
					level: 'error',
					message: `Failed to analyze ${filePath}: ${error.message}`,
					actionable: 'Check file syntax and ensure parser compatibility',
					confidence: 1.0
				}
			],
			codeQuality: { score: 0, issues: [], strengths: [], recommendations: [] },
			frameworks: [],
			architecture: {}
		};
	}

	// Placeholder methods for future implementation
	detectErrorHandlingPatterns(astData, language) {
		return {};
	}
	detectTestingPatterns(astData, language, content) {
		return {};
	}
	analyzeModulePatterns(imports, content) {
		return [];
	}
	analyzeFunctionPatterns(functions, content) {
		return [];
	}
	detectClosurePatterns(content) {
		return [];
	}
}

export default CodeAnalyzer;
