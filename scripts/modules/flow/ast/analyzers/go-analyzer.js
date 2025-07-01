/**
 * Go Specific Analyzer - Phase 2.2
 *
 * Provides deep analysis of Go codebases with focus on:
 * - Concurrency patterns (goroutines, channels, sync)
 * - Error handling patterns (explicit error returns)
 * - Interface patterns and composition
 * - Web frameworks (Gin, Echo, Fiber)
 * - Testing patterns (table-driven tests)
 * - Package organization and naming conventions
 *
 * @author Task Master Flow
 * @version 2.2.0
 */

import CodeAnalyzer from '../context/code-analyzer.js';
import ComplexityScorer from '../context/complexity-scorer.js';
import DependencyMapper from '../context/dependency-mapper.js';

/**
 * Specialized Go analyzer
 */
export class GoAnalyzer {
	constructor(options = {}) {
		this.options = {
			enableConcurrencyAnalysis: true,
			enableErrorHandlingAnalysis: true,
			enableInterfaceAnalysis: true,
			enableWebFrameworkAnalysis: true,
			enableTestingAnalysis: true,
			...options
		};

		// Initialize Phase 2.1 components
		this.codeAnalyzer = new CodeAnalyzer();
		this.complexityScorer = new ComplexityScorer();
		this.dependencyMapper = new DependencyMapper();
	}

	/**
	 * Perform comprehensive Go analysis
	 * @param {Object} astData - Parsed AST data
	 * @param {string} filePath - File path for context
	 * @param {string} content - Source code content
	 * @returns {Promise<Object>} Comprehensive analysis results
	 */
	async analyzeGo(astData, filePath, content) {
		const analysis = {
			language: 'go',
			goVersion: this.detectGoVersion(content),
			packageName: this.extractPackageName(content),
			framework: await this.detectFramework(astData, content),
			patterns: await this.analyzeGoPatterns(astData, content),
			complexity: await this.analyzeComplexity(astData, content),
			codeQuality: await this.analyzeCodeQuality(astData, content, filePath),
			testing: this.analyzeTestingPatterns(content, filePath),
			recommendations: []
		};

		// Generate Go-specific recommendations
		analysis.recommendations = this.generateGoRecommendations(analysis);

		return analysis;
	}

	/**
	 * Detect Go version features
	 * @param {string} content - Source code
	 * @returns {string} Go version indicator
	 */
	detectGoVersion(content) {
		// Go 1.18+ features (generics)
		if (/\[.*\s+\w+.*\]/.test(content) && /interface\{.*\}/.test(content)) {
			return '1.18+';
		}

		// Go 1.16+ features (embed)
		if (/\/\/go:embed/.test(content)) {
			return '1.16+';
		}

		// Go 1.13+ features (error wrapping)
		if (
			/fmt\.Errorf.*%w/.test(content) ||
			/errors\.Is|errors\.As/.test(content)
		) {
			return '1.13+';
		}

		// Go modules (1.11+)
		if (/go\.mod|go\.sum/.test(content) || /go\s+\d+\.\d+/.test(content)) {
			return '1.11+';
		}

		return 'unknown';
	}

	/**
	 * Extract package name from Go file
	 * @param {string} content - Source code
	 * @returns {string} Package name
	 */
	extractPackageName(content) {
		const packageMatch = content.match(/^package\s+(\w+)/m);
		return packageMatch ? packageMatch[1] : 'unknown';
	}

	/**
	 * Detect Go frameworks and libraries
	 * @param {Object} astData - AST data
	 * @param {string} content - Source code
	 * @returns {Promise<Object>} Framework detection results
	 */
	async detectFramework(astData, content) {
		const frameworks = {
			gin: this.detectGinFramework(content),
			echo: this.detectEchoFramework(content),
			fiber: this.detectFiberFramework(content),
			mux: this.detectMuxFramework(content),
			gorm: this.detectGormFramework(content),
			grpc: this.detectGrpcFramework(content),
			cobra: this.detectCobraFramework(content),
			testing: this.detectTestingFramework(content, astData)
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
	 * Detect Gin web framework
	 * @param {string} content - Source code
	 * @returns {Object} Gin detection result
	 */
	detectGinFramework(content) {
		const evidence = [];
		let confidence = 0;

		// Gin imports
		if (/github\.com\/gin-gonic\/gin/.test(content)) {
			confidence += 0.5;
			evidence.push('Gin framework imports');
		}

		// Gin patterns
		if (/gin\.Default\(\)|gin\.New\(\)|\.Run\(/.test(content)) {
			confidence += 0.3;
			evidence.push('Gin engine initialization');
		}

		if (/\.GET\(|\.POST\(|\.PUT\(|\.DELETE\(/.test(content)) {
			confidence += 0.2;
			evidence.push('Gin route handlers');
		}

		if (/\*gin\.Context/.test(content)) {
			confidence += 0.2;
			evidence.push('Gin context usage');
		}

		return {
			detected: confidence > 0.3,
			confidence: Math.min(confidence, 1.0),
			evidence,
			version: null
		};
	}

	/**
	 * Detect Echo web framework
	 * @param {string} content - Source code
	 * @returns {Object} Echo detection result
	 */
	detectEchoFramework(content) {
		const evidence = [];
		let confidence = 0;

		// Echo imports
		if (/github\.com\/labstack\/echo/.test(content)) {
			confidence += 0.5;
			evidence.push('Echo framework imports');
		}

		// Echo patterns
		if (/echo\.New\(\)|\.Start\(/.test(content)) {
			confidence += 0.3;
			evidence.push('Echo server initialization');
		}

		if (/echo\.Context/.test(content)) {
			confidence += 0.2;
			evidence.push('Echo context usage');
		}

		return {
			detected: confidence > 0.3,
			confidence: Math.min(confidence, 1.0),
			evidence,
			version: null
		};
	}

	/**
	 * Detect Fiber web framework
	 * @param {string} content - Source code
	 * @returns {Object} Fiber detection result
	 */
	detectFiberFramework(content) {
		const evidence = [];
		let confidence = 0;

		// Fiber imports
		if (/github\.com\/gofiber\/fiber/.test(content)) {
			confidence += 0.5;
			evidence.push('Fiber framework imports');
		}

		// Fiber patterns
		if (/fiber\.New\(\)|\.Listen\(/.test(content)) {
			confidence += 0.3;
			evidence.push('Fiber app initialization');
		}

		if (/\*fiber\.Ctx/.test(content)) {
			confidence += 0.2;
			evidence.push('Fiber context usage');
		}

		return {
			detected: confidence > 0.3,
			confidence: Math.min(confidence, 1.0),
			evidence,
			version: null
		};
	}

	/**
	 * Detect Gorilla Mux framework
	 * @param {string} content - Source code
	 * @returns {Object} Mux detection result
	 */
	detectMuxFramework(content) {
		const evidence = [];
		let confidence = 0;

		// Mux imports
		if (/github\.com\/gorilla\/mux/.test(content)) {
			confidence += 0.5;
			evidence.push('Gorilla Mux imports');
		}

		// Mux patterns
		if (/mux\.NewRouter\(\)|\.HandleFunc\(/.test(content)) {
			confidence += 0.3;
			evidence.push('Mux router patterns');
		}

		return {
			detected: confidence > 0.3,
			confidence: Math.min(confidence, 1.0),
			evidence,
			version: null
		};
	}

	/**
	 * Detect GORM ORM
	 * @param {string} content - Source code
	 * @returns {Object} GORM detection result
	 */
	detectGormFramework(content) {
		const evidence = [];
		let confidence = 0;

		// GORM imports
		if (/gorm\.io\/gorm/.test(content)) {
			confidence += 0.4;
			evidence.push('GORM ORM imports');
		}

		// GORM patterns
		if (/\.Create\(|\.Find\(|\.Update\(|\.Delete\(|\.Where\(/.test(content)) {
			confidence += 0.3;
			evidence.push('GORM database operations');
		}

		return {
			detected: confidence > 0.3,
			confidence: Math.min(confidence, 1.0),
			evidence,
			version: null
		};
	}

	/**
	 * Detect gRPC framework
	 * @param {string} content - Source code
	 * @returns {Object} gRPC detection result
	 */
	detectGrpcFramework(content) {
		const evidence = [];
		let confidence = 0;

		// gRPC imports
		if (/google\.golang\.org\/grpc/.test(content)) {
			confidence += 0.4;
			evidence.push('gRPC imports');
		}

		// gRPC patterns
		if (/\.pb\.go|protobuf/.test(content)) {
			confidence += 0.3;
			evidence.push('Protocol buffer files');
		}

		return {
			detected: confidence > 0.3,
			confidence: Math.min(confidence, 1.0),
			evidence,
			version: null
		};
	}

	/**
	 * Detect Cobra CLI framework
	 * @param {string} content - Source code
	 * @returns {Object} Cobra detection result
	 */
	detectCobraFramework(content) {
		const evidence = [];
		let confidence = 0;

		// Cobra imports
		if (/github\.com\/spf13\/cobra/.test(content)) {
			confidence += 0.4;
			evidence.push('Cobra CLI framework imports');
		}

		// Cobra patterns
		if (/cobra\.Command|\.AddCommand\(|\.Execute\(\)/.test(content)) {
			confidence += 0.3;
			evidence.push('Cobra command patterns');
		}

		return {
			detected: confidence > 0.3,
			confidence: Math.min(confidence, 1.0),
			evidence,
			version: null
		};
	}

	/**
	 * Detect testing framework
	 * @param {string} content - Source code
	 * @param {Object} astData - AST data
	 * @returns {Object} Testing detection result
	 */
	detectTestingFramework(content, astData) {
		const evidence = [];
		let confidence = 0;

		// Standard testing package
		if (/import.*testing/.test(content)) {
			confidence += 0.3;
			evidence.push('Standard testing package');
		}

		// Test functions
		const functions = astData.functions || [];
		const testFunctions = functions.filter(
			(func) => func.name && func.name.startsWith('Test')
		);

		if (testFunctions.length > 0) {
			confidence += 0.4;
			evidence.push(`${testFunctions.length} test functions`);
		}

		// Benchmark functions
		const benchmarkFunctions = functions.filter(
			(func) => func.name && func.name.startsWith('Benchmark')
		);

		if (benchmarkFunctions.length > 0) {
			confidence += 0.2;
			evidence.push(`${benchmarkFunctions.length} benchmark functions`);
		}

		return {
			detected: confidence > 0.2,
			confidence: Math.min(confidence, 1.0),
			evidence,
			version: null
		};
	}

	/**
	 * Analyze Go-specific patterns
	 * @param {Object} astData - AST data
	 * @param {string} content - Source code
	 * @returns {Promise<Object>} Pattern analysis
	 */
	async analyzeGoPatterns(astData, content) {
		// Use Phase 2.1 CodeAnalyzer for base analysis
		const basePatterns = await this.codeAnalyzer.analyzePatterns(
			astData,
			'go',
			null,
			content
		);

		// Add Go-specific patterns
		const goPatterns = {
			...basePatterns,
			concurrency: this.analyzeConcurrencyPatterns(content),
			errorHandling: this.analyzeErrorHandlingPatterns(content),
			interfaces: this.analyzeInterfacePatterns(content),
			packageStructure: this.analyzePackageStructure(content),
			naming: this.analyzeNamingConventions(content, astData),
			channels: this.analyzeChannelPatterns(content),
			goroutines: this.analyzeGoroutinePatterns(content)
		};

		return goPatterns;
	}

	/**
	 * Analyze concurrency patterns
	 * @param {string} content - Source code
	 * @returns {Array} Concurrency patterns
	 */
	analyzeConcurrencyPatterns(content) {
		const patterns = [];

		// Goroutines
		const goroutines = content.match(/go\s+\w+\s*\(|go\s+func\s*\(/g);
		if (goroutines && goroutines.length > 0) {
			patterns.push({
				type: 'goroutines',
				count: goroutines.length,
				description: 'Goroutine usage for concurrency',
				confidence: 0.95
			});
		}

		// Channels
		const channels = content.match(/chan\s+\w+|make\s*\(\s*chan/g);
		if (channels && channels.length > 0) {
			patterns.push({
				type: 'channels',
				count: channels.length,
				description: 'Channel usage for communication',
				confidence: 0.9
			});
		}

		// Sync package usage
		if (/sync\.|sync\.Mutex|sync\.WaitGroup|sync\.RWMutex/.test(content)) {
			patterns.push({
				type: 'sync_primitives',
				description: 'Synchronization primitives usage',
				confidence: 0.9
			});
		}

		// Context package
		if (/context\.|context\.Context/.test(content)) {
			patterns.push({
				type: 'context_usage',
				description: 'Context package for cancellation and timeouts',
				confidence: 0.8
			});
		}

		return patterns;
	}

	/**
	 * Analyze error handling patterns
	 * @param {string} content - Source code
	 * @returns {Array} Error handling patterns
	 */
	analyzeErrorHandlingPatterns(content) {
		const patterns = [];

		// Standard error checking
		const errorChecks = content.match(/if\s+err\s*!=\s*nil/g);
		if (errorChecks && errorChecks.length > 0) {
			patterns.push({
				type: 'explicit_error_handling',
				count: errorChecks.length,
				description: 'Explicit error checking (if err != nil)',
				confidence: 0.95
			});
		}

		// Error wrapping (Go 1.13+)
		if (/fmt\.Errorf.*%w|errors\.Wrap/.test(content)) {
			patterns.push({
				type: 'error_wrapping',
				description: 'Error wrapping for context',
				confidence: 0.9
			});
		}

		// Custom error types
		if (/type\s+\w+Error\s+struct|Error\(\)\s+string/.test(content)) {
			patterns.push({
				type: 'custom_errors',
				description: 'Custom error type implementations',
				confidence: 0.8
			});
		}

		return patterns;
	}

	/**
	 * Analyze interface patterns
	 * @param {string} content - Source code
	 * @returns {Array} Interface patterns
	 */
	analyzeInterfacePatterns(content) {
		const patterns = [];

		// Interface definitions
		const interfaces = content.match(/type\s+\w+\s+interface\s*\{/g);
		if (interfaces && interfaces.length > 0) {
			patterns.push({
				type: 'interface_definitions',
				count: interfaces.length,
				description: 'Interface type definitions',
				confidence: 0.9
			});
		}

		// Empty interface usage
		if (/interface\s*\{\s*\}/.test(content)) {
			patterns.push({
				type: 'empty_interfaces',
				description: 'Empty interface usage',
				confidence: 0.8
			});
		}

		// Type assertions
		if (/\.\([^)]+\)/.test(content)) {
			patterns.push({
				type: 'type_assertions',
				description: 'Type assertion patterns',
				confidence: 0.8
			});
		}

		return patterns;
	}

	/**
	 * Analyze package structure patterns
	 * @param {string} content - Source code
	 * @returns {Array} Package structure patterns
	 */
	analyzePackageStructure(content) {
		const patterns = [];

		// Package declaration
		if (/^package\s+\w+/m.test(content)) {
			patterns.push({
				type: 'package_declaration',
				description: 'Proper package declaration',
				confidence: 1.0
			});
		}

		// Internal packages
		if (/\/internal\//.test(content)) {
			patterns.push({
				type: 'internal_packages',
				description: 'Internal package usage for encapsulation',
				confidence: 0.9
			});
		}

		return patterns;
	}

	/**
	 * Analyze naming conventions
	 * @param {string} content - Source code
	 * @param {Object} astData - AST data
	 * @returns {Array} Naming convention patterns
	 */
	analyzeNamingConventions(content, astData) {
		const patterns = [];
		const functions = astData.functions || [];

		// Exported functions (capitalized)
		const exportedFunctions = functions.filter(
			(func) => func.name && /^[A-Z]/.test(func.name)
		);

		if (exportedFunctions.length > 0) {
			patterns.push({
				type: 'exported_functions',
				count: exportedFunctions.length,
				description: 'Exported functions with proper capitalization',
				confidence: 0.9
			});
		}

		// Private functions (lowercase)
		const privateFunctions = functions.filter(
			(func) => func.name && /^[a-z]/.test(func.name)
		);

		if (privateFunctions.length > 0) {
			patterns.push({
				type: 'private_functions',
				count: privateFunctions.length,
				description: 'Private functions with proper naming',
				confidence: 0.9
			});
		}

		return patterns;
	}

	/**
	 * Analyze channel patterns
	 * @param {string} content - Source code
	 * @returns {Array} Channel patterns
	 */
	analyzeChannelPatterns(content) {
		const patterns = [];

		// Buffered channels
		if (/make\s*\(\s*chan\s+\w+\s*,\s*\d+\s*\)/.test(content)) {
			patterns.push({
				type: 'buffered_channels',
				description: 'Buffered channel usage',
				confidence: 0.9
			});
		}

		// Channel direction (send-only, receive-only)
		if (/<-\s*chan\s+\w+|chan<-\s+\w+/.test(content)) {
			patterns.push({
				type: 'directional_channels',
				description: 'Directional channel declarations',
				confidence: 0.9
			});
		}

		// Select statements
		if (/select\s*\{/.test(content)) {
			patterns.push({
				type: 'select_statements',
				description: 'Select statements for channel multiplexing',
				confidence: 0.95
			});
		}

		return patterns;
	}

	/**
	 * Analyze goroutine patterns
	 * @param {string} content - Source code
	 * @returns {Array} Goroutine patterns
	 */
	analyzeGoroutinePatterns(content) {
		const patterns = [];

		// Anonymous goroutines
		const anonGoroutines = content.match(/go\s+func\s*\(/g);
		if (anonGoroutines && anonGoroutines.length > 0) {
			patterns.push({
				type: 'anonymous_goroutines',
				count: anonGoroutines.length,
				description: 'Anonymous function goroutines',
				confidence: 0.9
			});
		}

		// Named function goroutines
		const namedGoroutines = content.match(/go\s+\w+\s*\(/g);
		if (namedGoroutines && namedGoroutines.length > 0) {
			patterns.push({
				type: 'named_goroutines',
				count: namedGoroutines.length,
				description: 'Named function goroutines',
				confidence: 0.9
			});
		}

		return patterns;
	}

	/**
	 * Analyze testing patterns
	 * @param {string} content - Source code
	 * @param {string} filePath - File path
	 * @returns {Object} Testing analysis
	 */
	analyzeTestingPatterns(content, filePath) {
		const analysis = {
			isTestFile: filePath.endsWith('_test.go'),
			patterns: []
		};

		if (!analysis.isTestFile) {
			return analysis;
		}

		// Table-driven tests
		if (/tests\s*:=\s*\[\]struct\s*\{|testCases\s*:=/.test(content)) {
			analysis.patterns.push({
				type: 'table_driven_tests',
				description: 'Table-driven test patterns',
				confidence: 0.9
			});
		}

		// Subtests
		if (/t\.Run\s*\(/.test(content)) {
			analysis.patterns.push({
				type: 'subtests',
				description: 'Subtest usage for organized testing',
				confidence: 0.9
			});
		}

		// Benchmarks
		if (/func\s+Benchmark\w+/.test(content)) {
			analysis.patterns.push({
				type: 'benchmarks',
				description: 'Benchmark functions for performance testing',
				confidence: 0.95
			});
		}

		// Test helpers
		if (/t\.Helper\(\)/.test(content)) {
			analysis.patterns.push({
				type: 'test_helpers',
				description: 'Test helper functions',
				confidence: 0.9
			});
		}

		return analysis;
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
			'go',
			content
		);
	}

	/**
	 * Analyze code quality
	 * @param {Object} astData - AST data
	 * @param {string} content - Source code
	 * @param {string} filePath - File path
	 * @returns {Promise<Object>} Code quality analysis
	 */
	async analyzeCodeQuality(astData, content, filePath) {
		const quality = {
			score: 10,
			issues: [],
			suggestions: []
		};

		const functions = astData.functions || [];

		// Check for long functions
		const longFunctions = functions.filter(
			(func) =>
				func.lineEnd && func.lineStart && func.lineEnd - func.lineStart > 30
		);

		if (longFunctions.length > 0) {
			quality.score -= 1;
			quality.issues.push({
				type: 'long_functions',
				severity: 'medium',
				count: longFunctions.length,
				message: `${longFunctions.length} functions exceed 30 lines`
			});
			quality.suggestions.push(
				'Break down large functions following single responsibility principle'
			);
		}

		// Check for missing error handling
		const errorReturns = (content.match(/return.*,.*err/g) || []).length;
		const errorChecks = (content.match(/if\s+err\s*!=\s*nil/g) || []).length;

		if (errorReturns > errorChecks + 2) {
			quality.score -= 0.8;
			quality.issues.push({
				type: 'missing_error_handling',
				severity: 'high',
				message: 'Some errors may not be properly handled'
			});
			quality.suggestions.push(
				'Ensure all errors are properly checked and handled'
			);
		}

		// Check for TODO/FIXME comments
		const todoComments = (content.match(/(TODO|FIXME|XXX)/g) || []).length;
		if (todoComments > 2) {
			quality.score -= 0.3;
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

		// Check for potential goroutine leaks
		const goroutines = (content.match(/go\s+\w+\s*\(|go\s+func\s*\(/g) || [])
			.length;
		const contextUsage = (
			content.match(/context\.|ctx\s+context\.Context/g) || []
		).length;

		if (goroutines > 2 && contextUsage === 0) {
			quality.score -= 0.5;
			quality.issues.push({
				type: 'potential_goroutine_leaks',
				severity: 'medium',
				message: 'Goroutines without context for cancellation'
			});
			quality.suggestions.push(
				'Use context.Context for goroutine cancellation and timeouts'
			);
		}

		return quality;
	}

	/**
	 * Generate Go-specific recommendations
	 * @param {Object} analysis - Complete analysis results
	 * @returns {Array} Recommendations
	 */
	generateGoRecommendations(analysis) {
		const recommendations = [];

		// Framework-specific recommendations
		if (analysis.framework.primary) {
			const framework = analysis.framework.primary.name;

			switch (framework) {
				case 'gin':
					recommendations.push({
						type: 'framework_best_practices',
						priority: 'high',
						message: 'Follow Gin framework best practices',
						details: [
							'Use middleware for cross-cutting concerns',
							'Implement proper error handling in handlers',
							'Use Gin context for request/response operations',
							'Structure routes logically with route groups',
							'Implement proper input validation and binding'
						]
					});
					break;

				case 'gorm':
					recommendations.push({
						type: 'framework_best_practices',
						priority: 'high',
						message: 'Follow GORM ORM best practices',
						details: [
							'Use transactions for related operations',
							'Implement proper model relationships',
							'Use hooks for business logic',
							'Handle database errors appropriately',
							'Use proper indexing for performance'
						]
					});
					break;
			}
		}

		// Concurrency recommendations
		const hasConcurrency =
			analysis.patterns.concurrency && analysis.patterns.concurrency.length > 0;
		if (hasConcurrency) {
			recommendations.push({
				type: 'concurrency_best_practices',
				priority: 'high',
				message: 'Optimize concurrent code usage',
				details: [
					'Use context.Context for goroutine cancellation',
					'Avoid goroutine leaks with proper cleanup',
					'Use channels or sync package for coordination',
					'Consider worker pool patterns for high loads',
					'Test concurrent code thoroughly'
				]
			});
		}

		// Error handling recommendations
		const hasErrorHandling =
			analysis.patterns.errorHandling &&
			analysis.patterns.errorHandling.length > 0;
		if (hasErrorHandling) {
			const explicitChecks = analysis.patterns.errorHandling.find(
				(p) => p.type === 'explicit_error_handling'
			);
			if (!explicitChecks || explicitChecks.count < 3) {
				recommendations.push({
					type: 'error_handling',
					priority: 'high',
					message: 'Improve error handling practices',
					details: [
						'Check all errors explicitly (if err != nil)',
						'Wrap errors with context using fmt.Errorf',
						'Use custom error types when appropriate',
						'Handle errors at the appropriate level',
						'Log errors with sufficient context'
					]
				});
			}
		}

		// Testing recommendations
		if (analysis.testing.isTestFile) {
			recommendations.push({
				type: 'testing_best_practices',
				priority: 'medium',
				message: 'Enhance testing practices',
				details: [
					'Use table-driven tests for multiple scenarios',
					'Implement subtests for better organization',
					'Add benchmarks for performance-critical code',
					'Use test helpers to reduce duplication',
					'Test error cases and edge conditions'
				]
			});
		} else if (analysis.codeQuality.score > 7) {
			recommendations.push({
				type: 'testing_coverage',
				priority: 'medium',
				message: 'Add comprehensive tests',
				details: [
					'Create corresponding _test.go files',
					'Test both happy path and error cases',
					'Use interfaces for better testability',
					'Mock external dependencies',
					'Aim for high test coverage'
				]
			});
		}

		// Package structure recommendations
		if (analysis.packageName === 'main') {
			recommendations.push({
				type: 'package_organization',
				priority: 'medium',
				message: 'Consider package organization',
				details: [
					'Separate business logic from main package',
					'Use internal packages for implementation details',
					'Follow Go package naming conventions',
					'Keep main package minimal and focused',
					'Group related functionality in packages'
				]
			});
		}

		// Go version recommendations
		if (
			analysis.goVersion === 'unknown' ||
			!analysis.goVersion.includes('1.1')
		) {
			recommendations.push({
				type: 'modernization',
				priority: 'medium',
				message: 'Consider upgrading Go version',
				details: [
					'Use Go 1.18+ for generics support',
					'Use Go 1.16+ for embed directive',
					'Use Go 1.13+ for error wrapping',
					'Take advantage of newer Go features',
					'Keep Go version up to date for security'
				]
			});
		}

		return recommendations;
	}
}

export default GoAnalyzer;
