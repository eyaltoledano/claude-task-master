/**
 * JavaScript/TypeScript Specific Analyzer - Phase 2.2
 *
 * Provides deep analysis of JavaScript and TypeScript codebases with focus on:
 * - React patterns (components, hooks, context)
 * - Node.js patterns (modules, async/await, streams)
 * - Modern ES6+ features (classes, modules, destructuring)
 * - Framework-specific patterns (Express, Next.js, Vue)
 *
 * @author Task Master Flow
 * @version 2.2.0
 */

import CodeAnalyzer from '../context/code-analyzer.js';
import ComplexityScorer from '../context/complexity-scorer.js';
import DependencyMapper from '../context/dependency-mapper.js';

/**
 * Specialized JavaScript/TypeScript analyzer
 */
export class JavaScriptAnalyzer {
	constructor(options = {}) {
		this.options = {
			enableReactAnalysis: true,
			enableNodeAnalysis: true,
			enableModernJSAnalysis: true,
			...options
		};

		// Initialize Phase 2.1 components
		this.codeAnalyzer = new CodeAnalyzer();
		this.complexityScorer = new ComplexityScorer();
		this.dependencyMapper = new DependencyMapper();
	}

	/**
	 * Perform comprehensive JavaScript/TypeScript analysis
	 * @param {Object} astData - Parsed AST data
	 * @param {string} filePath - File path for context
	 * @param {string} content - Source code content
	 * @returns {Promise<Object>} Comprehensive analysis results
	 */
	async analyzeJavaScript(astData, filePath, content) {
		const analysis = {
			language: this.detectLanguageVariant(filePath, content),
			framework: await this.detectFramework(astData, content),
			patterns: await this.analyzeJavaScriptPatterns(astData, content),
			complexity: await this.analyzeComplexity(astData, content),
			codeQuality: await this.analyzeCodeQuality(astData, content),
			recommendations: []
		};

		// Generate language-specific recommendations
		analysis.recommendations = this.generateJavaScriptRecommendations(analysis);

		return analysis;
	}

	/**
	 * Detect JavaScript language variant
	 * @param {string} filePath - File path
	 * @param {string} content - File content
	 * @returns {string} Language variant
	 */
	detectLanguageVariant(filePath, content) {
		const extension = filePath.split('.').pop().toLowerCase();

		if (extension === 'ts' || extension === 'tsx') {
			return 'typescript';
		}

		if (extension === 'jsx' || extension === 'tsx') {
			return content.includes('React') ? 'react' : 'javascript';
		}

		// Check for modern JS features
		const hasModernFeatures =
			/(?:import\s+.*from|export\s+(?:default\s+)?(?:class|function|const)|class\s+\w+|async\s+function|\=\>)/.test(
				content
			);

		return hasModernFeatures ? 'modern-javascript' : 'javascript';
	}

	/**
	 * Detect JavaScript frameworks
	 * @param {Object} astData - AST data
	 * @param {string} content - Source code
	 * @returns {Promise<Object>} Framework detection results
	 */
	async detectFramework(astData, content) {
		const frameworks = {
			react: this.detectReactFramework(astData, content),
			vue: this.detectVueFramework(content),
			angular: this.detectAngularFramework(content),
			express: this.detectExpressFramework(astData, content),
			nextjs: this.detectNextJSFramework(content),
			nodejs: this.detectNodeJSFramework(astData, content)
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
	 * Detect React framework patterns
	 * @param {Object} astData - AST data
	 * @param {string} content - Source code
	 * @returns {Object} React detection result
	 */
	detectReactFramework(astData, content) {
		const evidence = [];
		let confidence = 0;

		// Check imports
		const imports = astData.imports || [];
		const reactImports = imports.filter(
			(imp) =>
				imp.source &&
				(imp.source.includes('react') || imp.source.includes('React'))
		);

		if (reactImports.length > 0) {
			confidence += 0.4;
			evidence.push('React imports detected');
		}

		// Check for JSX patterns
		const jsxPatterns = [
			/<[A-Z]\w*\s*[^>]*>/, // JSX components
			/className\s*=/, // JSX className
			/onClick\s*=/, // JSX event handlers
			/useState|useEffect|useContext/ // React hooks
		];

		jsxPatterns.forEach((pattern) => {
			if (pattern.test(content)) {
				confidence += 0.15;
				evidence.push(`JSX pattern: ${pattern.source}`);
			}
		});

		// Check for functional components
		const functions = astData.functions || [];
		const componentFunctions = functions.filter(
			(func) => func.name && /^[A-Z]/.test(func.name) && func.returns
		);

		if (componentFunctions.length > 0) {
			confidence += 0.2;
			evidence.push(`${componentFunctions.length} potential React components`);
		}

		return {
			detected: confidence > 0.3,
			confidence: Math.min(confidence, 1.0),
			evidence,
			version: this.detectReactVersion(content)
		};
	}

	/**
	 * Detect Vue.js framework
	 * @param {string} content - Source code
	 * @returns {Object} Vue detection result
	 */
	detectVueFramework(content) {
		const evidence = [];
		let confidence = 0;

		// Vue imports
		if (/import.*vue/i.test(content)) {
			confidence += 0.4;
			evidence.push('Vue imports detected');
		}

		// Vue patterns
		if (/Vue\.component|new Vue|createApp/.test(content)) {
			confidence += 0.3;
			evidence.push('Vue instance patterns');
		}

		// Vue directives
		if (/v-if|v-for|v-model|v-show/.test(content)) {
			confidence += 0.2;
			evidence.push('Vue directives detected');
		}

		return {
			detected: confidence > 0.3,
			confidence: Math.min(confidence, 1.0),
			evidence,
			version: null
		};
	}

	/**
	 * Detect Angular framework
	 * @param {string} content - Source code
	 * @returns {Object} Angular detection result
	 */
	detectAngularFramework(content) {
		const evidence = [];
		let confidence = 0;

		// Angular imports
		if (/@angular/.test(content)) {
			confidence += 0.5;
			evidence.push('Angular imports detected');
		}

		// Angular decorators
		if (/@Component|@Injectable|@NgModule/.test(content)) {
			confidence += 0.3;
			evidence.push('Angular decorators detected');
		}

		return {
			detected: confidence > 0.3,
			confidence: Math.min(confidence, 1.0),
			evidence,
			version: null
		};
	}

	/**
	 * Detect Express.js framework
	 * @param {Object} astData - AST data
	 * @param {string} content - Source code
	 * @returns {Object} Express detection result
	 */
	detectExpressFramework(astData, content) {
		const evidence = [];
		let confidence = 0;

		// Express imports
		const imports = astData.imports || [];
		const expressImports = imports.filter(
			(imp) => imp.source && imp.source.includes('express')
		);

		if (expressImports.length > 0) {
			confidence += 0.4;
			evidence.push('Express imports detected');
		}

		// Express patterns
		if (/app\.get|app\.post|app\.put|app\.delete|app\.use/.test(content)) {
			confidence += 0.3;
			evidence.push('Express route patterns');
		}

		if (/req\.|res\.|next\(\)/.test(content)) {
			confidence += 0.2;
			evidence.push('Express middleware patterns');
		}

		return {
			detected: confidence > 0.3,
			confidence: Math.min(confidence, 1.0),
			evidence,
			version: null
		};
	}

	/**
	 * Detect Next.js framework
	 * @param {string} content - Source code
	 * @returns {Object} Next.js detection result
	 */
	detectNextJSFramework(content) {
		const evidence = [];
		let confidence = 0;

		// Next.js imports
		if (/next\/|from ['"]next['"]/.test(content)) {
			confidence += 0.4;
			evidence.push('Next.js imports detected');
		}

		// Next.js patterns
		if (/getServerSideProps|getStaticProps|getStaticPaths/.test(content)) {
			confidence += 0.3;
			evidence.push('Next.js data fetching patterns');
		}

		return {
			detected: confidence > 0.3,
			confidence: Math.min(confidence, 1.0),
			evidence,
			version: null
		};
	}

	/**
	 * Detect Node.js patterns
	 * @param {Object} astData - AST data
	 * @param {string} content - Source code
	 * @returns {Object} Node.js detection result
	 */
	detectNodeJSFramework(astData, content) {
		const evidence = [];
		let confidence = 0;

		// Node.js built-in modules
		const nodeModules = [
			'fs',
			'path',
			'http',
			'https',
			'crypto',
			'util',
			'stream',
			'events'
		];
		const imports = astData.imports || [];

		const nodeImports = imports.filter(
			(imp) => imp.source && nodeModules.includes(imp.source)
		);

		if (nodeImports.length > 0) {
			confidence += 0.3;
			evidence.push(
				`Node.js built-in modules: ${nodeImports.map((i) => i.source).join(', ')}`
			);
		}

		// Node.js patterns
		if (/require\s*\(|module\.exports|exports\.|process\./.test(content)) {
			confidence += 0.2;
			evidence.push('Node.js CommonJS patterns');
		}

		if (/__dirname|__filename|process\.env/.test(content)) {
			confidence += 0.15;
			evidence.push('Node.js global variables');
		}

		return {
			detected: confidence > 0.2,
			confidence: Math.min(confidence, 1.0),
			evidence,
			version: null
		};
	}

	/**
	 * Analyze JavaScript-specific patterns
	 * @param {Object} astData - AST data
	 * @param {string} content - Source code
	 * @returns {Promise<Object>} Pattern analysis
	 */
	async analyzeJavaScriptPatterns(astData, content) {
		// Use Phase 2.1 CodeAnalyzer for base analysis
		const basePatterns = await this.codeAnalyzer.analyzePatterns(
			astData,
			'javascript',
			null,
			content
		);

		// Add JavaScript-specific patterns
		const jsPatterns = {
			...basePatterns,
			modernJS: this.analyzeModernJSPatterns(content),
			asyncPatterns: this.analyzeAsyncPatterns(content),
			modulePatterns: this.analyzeModulePatterns(astData),
			testPatterns: this.analyzeTestPatterns(content),
			performancePatterns: this.analyzePerformancePatterns(content)
		};

		return jsPatterns;
	}

	/**
	 * Analyze modern JavaScript patterns
	 * @param {string} content - Source code
	 * @returns {Array} Modern JS patterns
	 */
	analyzeModernJSPatterns(content) {
		const patterns = [];

		// ES6+ features
		const modernFeatures = [
			{
				pattern: /const\s+\w+\s*=/,
				name: 'const_declarations',
				description: 'Const variable declarations'
			},
			{
				pattern: /let\s+\w+\s*=/,
				name: 'let_declarations',
				description: 'Let variable declarations'
			},
			{
				pattern: /\([^)]*\)\s*=>/,
				name: 'arrow_functions',
				description: 'Arrow functions'
			},
			{
				pattern: /`[^`]*\$\{[^}]*\}[^`]*`/,
				name: 'template_literals',
				description: 'Template literals with interpolation'
			},
			{
				pattern: /\[([^,\]]+),\s*\.\.\.(\w+)\]/,
				name: 'array_destructuring',
				description: 'Array destructuring with spread'
			},
			{
				pattern: /\{([^}]+)\}\s*=/,
				name: 'object_destructuring',
				description: 'Object destructuring'
			},
			{
				pattern: /class\s+\w+\s*(?:extends\s+\w+)?/,
				name: 'es6_classes',
				description: 'ES6 class declarations'
			},
			{
				pattern: /async\s+function|\basync\s*\(|\basync\s+\w+\s*=>/,
				name: 'async_functions',
				description: 'Async function declarations'
			}
		];

		modernFeatures.forEach((feature) => {
			const matches = content.match(new RegExp(feature.pattern, 'g'));
			if (matches && matches.length > 0) {
				patterns.push({
					type: feature.name,
					count: matches.length,
					description: feature.description,
					confidence: 0.9
				});
			}
		});

		return patterns;
	}

	/**
	 * Analyze async patterns
	 * @param {string} content - Source code
	 * @returns {Array} Async patterns
	 */
	analyzeAsyncPatterns(content) {
		const patterns = [];

		// Promise patterns
		const promiseCount = (
			content.match(/\.then\s*\(|\.catch\s*\(|new Promise\s*\(/g) || []
		).length;
		if (promiseCount > 0) {
			patterns.push({
				type: 'promise_usage',
				count: promiseCount,
				description: 'Promise-based asynchronous patterns',
				confidence: 0.8
			});
		}

		// Async/await patterns
		const awaitCount = (content.match(/await\s+/g) || []).length;
		if (awaitCount > 0) {
			patterns.push({
				type: 'async_await',
				count: awaitCount,
				description: 'Async/await patterns',
				confidence: 0.9
			});
		}

		// Callback patterns
		const callbackCount = (
			content.match(/function\s*\([^)]*err[^)]*\)|callback\s*\(|cb\s*\(/g) || []
		).length;
		if (callbackCount > 0) {
			patterns.push({
				type: 'callback_patterns',
				count: callbackCount,
				description: 'Traditional callback patterns',
				confidence: 0.7
			});
		}

		return patterns;
	}

	/**
	 * Analyze module patterns
	 * @param {Object} astData - AST data
	 * @returns {Array} Module patterns
	 */
	analyzeModulePatterns(astData) {
		const patterns = [];
		const imports = astData.imports || [];
		const exports = astData.exports || [];

		if (imports.length > 0) {
			patterns.push({
				type: 'es6_imports',
				count: imports.length,
				description: 'ES6 import statements',
				details: imports.map((imp) => imp.source),
				confidence: 0.9
			});
		}

		if (exports.length > 0) {
			patterns.push({
				type: 'es6_exports',
				count: exports.length,
				description: 'ES6 export statements',
				confidence: 0.9
			});
		}

		return patterns;
	}

	/**
	 * Analyze test patterns
	 * @param {string} content - Source code
	 * @returns {Array} Test patterns
	 */
	analyzeTestPatterns(content) {
		const patterns = [];

		// Jest patterns
		const jestPatterns = (
			content.match(/describe\s*\(|it\s*\(|test\s*\(|expect\s*\(/g) || []
		).length;
		if (jestPatterns > 0) {
			patterns.push({
				type: 'jest_testing',
				count: jestPatterns,
				description: 'Jest testing framework patterns',
				confidence: 0.9
			});
		}

		// Mocha patterns
		const mochaPatterns = (
			content.match(
				/describe\s*\(.*function|it\s*\(.*function|beforeEach|afterEach/g
			) || []
		).length;
		if (mochaPatterns > 0) {
			patterns.push({
				type: 'mocha_testing',
				count: mochaPatterns,
				description: 'Mocha testing framework patterns',
				confidence: 0.8
			});
		}

		return patterns;
	}

	/**
	 * Analyze performance patterns
	 * @param {string} content - Source code
	 * @returns {Array} Performance patterns
	 */
	analyzePerformancePatterns(content) {
		const patterns = [];

		// Memoization patterns
		if (/useMemo|useCallback|React\.memo/.test(content)) {
			patterns.push({
				type: 'react_memoization',
				description: 'React performance optimization patterns',
				confidence: 0.9
			});
		}

		// Web Performance API
		if (
			/performance\.now|performance\.mark|performance\.measure/.test(content)
		) {
			patterns.push({
				type: 'performance_monitoring',
				description: 'Performance monitoring and measurement',
				confidence: 0.8
			});
		}

		return patterns;
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
			'javascript',
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
				func.lineEnd && func.lineStart && func.lineEnd - func.lineStart > 50
		);

		if (longFunctions.length > 0) {
			quality.score -= 1;
			quality.issues.push({
				type: 'long_functions',
				severity: 'medium',
				count: longFunctions.length,
				message: `${longFunctions.length} functions exceed 50 lines`
			});
			quality.suggestions.push(
				'Consider breaking down large functions into smaller, focused functions'
			);
		}

		// Check for deeply nested code
		const nestedPatterns = content.match(/(\s{12,})/g);
		if (nestedPatterns && nestedPatterns.length > 5) {
			quality.score -= 0.5;
			quality.issues.push({
				type: 'deep_nesting',
				severity: 'low',
				message: 'Code has deep nesting levels'
			});
			quality.suggestions.push(
				'Reduce nesting with early returns and guard clauses'
			);
		}

		// Check for console.log statements
		const consoleLogs = (content.match(/console\.log\s*\(/g) || []).length;
		if (consoleLogs > 2) {
			quality.score -= 0.3;
			quality.issues.push({
				type: 'debug_statements',
				severity: 'low',
				count: consoleLogs,
				message: `${consoleLogs} console.log statements found`
			});
			quality.suggestions.push(
				'Remove debug console.log statements or use proper logging'
			);
		}

		return quality;
	}

	/**
	 * Generate JavaScript-specific recommendations
	 * @param {Object} analysis - Complete analysis results
	 * @returns {Array} Recommendations
	 */
	generateJavaScriptRecommendations(analysis) {
		const recommendations = [];

		// Framework-specific recommendations
		if (analysis.framework.primary) {
			const framework = analysis.framework.primary.name;

			switch (framework) {
				case 'react':
					recommendations.push({
						type: 'framework_best_practices',
						priority: 'high',
						message: 'Follow React best practices',
						details: [
							'Use functional components with hooks',
							'Implement proper key props for lists',
							'Use React.memo for performance optimization',
							'Follow React naming conventions'
						]
					});
					break;

				case 'express':
					recommendations.push({
						type: 'framework_best_practices',
						priority: 'high',
						message: 'Follow Express.js best practices',
						details: [
							'Use proper error handling middleware',
							'Implement input validation',
							'Use environment variables for configuration',
							'Add proper logging and monitoring'
						]
					});
					break;

				case 'nodejs':
					recommendations.push({
						type: 'framework_best_practices',
						priority: 'medium',
						message: 'Follow Node.js best practices',
						details: [
							'Use async/await instead of callbacks',
							'Handle unhandled promise rejections',
							'Use streams for large data processing',
							'Implement proper error handling'
						]
					});
					break;
			}
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
					'Break down complex functions into smaller ones',
					'Use early returns to reduce nesting',
					'Consider extracting utility functions',
					'Add comprehensive unit tests'
				]
			});
		}

		// Modern JS recommendations
		const hasModernPatterns =
			analysis.patterns.modernJS && analysis.patterns.modernJS.length > 0;
		if (!hasModernPatterns) {
			recommendations.push({
				type: 'modernization',
				priority: 'medium',
				message: 'Consider modernizing JavaScript code',
				details: [
					'Use const/let instead of var',
					'Adopt arrow functions where appropriate',
					'Use template literals for string interpolation',
					'Implement destructuring for cleaner code'
				]
			});
		}

		return recommendations;
	}

	/**
	 * Detect React version from content
	 * @param {string} content - Source code
	 * @returns {string|null} React version if detectable
	 */
	detectReactVersion(content) {
		// Check for React 18+ features
		if (/createRoot|useId|useDeferredValue|useTransition/.test(content)) {
			return '18+';
		}

		// Check for React 17+ features
		if (/jsx-runtime/.test(content)) {
			return '17+';
		}

		// Check for React 16.8+ hooks
		if (/useState|useEffect|useContext/.test(content)) {
			return '16.8+';
		}

		return null;
	}
}

export default JavaScriptAnalyzer;
