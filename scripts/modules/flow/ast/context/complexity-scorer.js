/**
 * Enhanced Complexity Scorer for AST Integration Phase 2.1
 *
 * Provides multi-dimensional complexity analysis beyond basic cyclomatic complexity.
 * Calculates cognitive, Halstead, nesting, and maintenance complexity metrics
 * with language-specific adjustments.
 *
 * @author Task Master Flow
 * @version 2.1.0
 */

/**
 * Multi-dimensional complexity analysis
 */
export class ComplexityScorer {
	constructor(options = {}) {
		this.options = {
			enableCognitiveComplexity: true,
			enableHalsteadComplexity: true,
			enableNestingComplexity: true,
			enableMaintenanceComplexity: true,
			enableLanguageSpecificAdjustments: true,
			cognitiveWeights: {
				increments: 1, // Base increment for control structures
				nesting: 1, // Additional increment per nesting level
				breaks: 1, // Break statements
				recursion: 2, // Recursive calls
				exceptions: 1 // Exception handling
			},
			...options
		};
	}

	/**
	 * Calculate comprehensive complexity scores for AST data
	 * @param {Object} astData - Parsed AST data
	 * @param {string} language - Programming language
	 * @param {string} content - Source code content
	 * @param {Object} context - Additional context (dependencies, etc.)
	 * @returns {Object} Multi-dimensional complexity analysis
	 */
	async calculateComplexity(astData, language, content, context = {}) {
		try {
			const analysis = {
				language,
				timestamp: new Date().toISOString(),
				overall: {},
				functions: [],
				classes: [],
				file: {},
				recommendations: []
			};

			// Calculate function-level complexity
			const functions = astData.functions || [];
			analysis.functions = functions.map((func) =>
				this.analyzeFunctionComplexity(func, language, content, context)
			);

			// Calculate class-level complexity
			const classes = astData.classes || [];
			analysis.classes = classes.map((cls) =>
				this.analyzeClassComplexity(cls, language, content, context)
			);

			// Calculate file-level complexity
			analysis.file = this.analyzeFileComplexity(
				astData,
				language,
				content,
				context
			);

			// Calculate overall complexity metrics
			analysis.overall = this.calculateOverallComplexity(analysis);

			// Generate recommendations
			analysis.recommendations =
				this.generateComplexityRecommendations(analysis);

			return analysis;
		} catch (error) {
			console.error('Complexity analysis failed:', error.message);
			return this.createErrorAnalysis(language, error);
		}
	}

	/**
	 * Analyze complexity for a single function
	 * @param {Object} func - Function AST data
	 * @param {string} language - Programming language
	 * @param {string} content - Source code content
	 * @param {Object} context - Additional context
	 * @returns {Object} Function complexity analysis
	 */
	analyzeFunctionComplexity(func, language, content, context) {
		const analysis = {
			name: func.name,
			lineStart: func.lineStart,
			lineEnd: func.lineEnd,
			lineCount: func.lineEnd - func.lineStart + 1,
			complexity: {
				cyclomatic: func.complexity || 1,
				cognitive: 0,
				halstead: {},
				nesting: 0,
				maintenance: 0,
				overall: 0
			},
			factors: {},
			issues: [],
			score: 0
		};

		// Extract function body from content
		const functionBody = this.extractFunctionBody(content, func);

		// Calculate cognitive complexity
		if (this.options.enableCognitiveComplexity) {
			analysis.complexity.cognitive = this.calculateCognitiveComplexity(
				functionBody,
				language
			);
		}

		// Calculate Halstead complexity
		if (this.options.enableHalsteadComplexity) {
			analysis.complexity.halstead = this.calculateHalsteadComplexity(
				functionBody,
				language
			);
		}

		// Calculate nesting complexity
		if (this.options.enableNestingComplexity) {
			analysis.complexity.nesting = this.calculateNestingComplexity(
				functionBody,
				language
			);
		}

		// Calculate maintenance complexity
		if (this.options.enableMaintenanceComplexity) {
			analysis.complexity.maintenance = this.calculateMaintenanceComplexity(
				func,
				functionBody,
				language,
				context
			);
		}

		// Apply language-specific adjustments
		if (this.options.enableLanguageSpecificAdjustments) {
			this.applyLanguageSpecificAdjustments(analysis, language, functionBody);
		}

		// Calculate overall complexity score
		analysis.complexity.overall = this.calculateOverallFunctionScore(
			analysis.complexity
		);
		analysis.score = analysis.complexity.overall;

		// Identify complexity factors and issues
		analysis.factors = this.identifyComplexityFactors(
			analysis,
			functionBody,
			language
		);
		analysis.issues = this.identifyComplexityIssues(analysis);

		return analysis;
	}

	/**
	 * Analyze complexity for a single class
	 * @param {Object} cls - Class AST data
	 * @param {string} language - Programming language
	 * @param {string} content - Source code content
	 * @param {Object} context - Additional context
	 * @returns {Object} Class complexity analysis
	 */
	analyzeClassComplexity(cls, language, content, context) {
		const analysis = {
			name: cls.name,
			lineStart: cls.lineStart,
			lineEnd: cls.lineEnd,
			lineCount: cls.lineEnd - cls.lineStart + 1,
			methodCount: cls.methods ? cls.methods.length : 0,
			complexity: {
				average: 0,
				maximum: 0,
				total: 0,
				cohesion: 0,
				coupling: 0,
				overall: 0
			},
			methods: [],
			issues: [],
			score: 0
		};

		// Analyze each method
		if (cls.methods) {
			analysis.methods = cls.methods.map((method) =>
				this.analyzeFunctionComplexity(method, language, content, context)
			);
		}

		// Calculate class-level metrics
		const methodComplexities = analysis.methods.map(
			(m) => m.complexity.overall
		);

		if (methodComplexities.length > 0) {
			analysis.complexity.total = methodComplexities.reduce(
				(sum, c) => sum + c,
				0
			);
			analysis.complexity.average =
				analysis.complexity.total / methodComplexities.length;
			analysis.complexity.maximum = Math.max(...methodComplexities);
		}

		// Calculate cohesion (simplified)
		analysis.complexity.cohesion = this.calculateClassCohesion(cls, content);

		// Calculate coupling (simplified)
		analysis.complexity.coupling = this.calculateClassCoupling(
			cls,
			content,
			context
		);

		// Calculate overall class complexity
		analysis.complexity.overall = this.calculateOverallClassScore(analysis);
		analysis.score = analysis.complexity.overall;

		// Identify class-level issues
		analysis.issues = this.identifyClassComplexityIssues(analysis);

		return analysis;
	}

	/**
	 * Analyze file-level complexity
	 * @param {Object} astData - Complete AST data
	 * @param {string} language - Programming language
	 * @param {string} content - Source code content
	 * @param {Object} context - Additional context
	 * @returns {Object} File complexity analysis
	 */
	analyzeFileComplexity(astData, language, content, context) {
		const functions = astData.functions || [];
		const classes = astData.classes || [];
		const imports = astData.imports || [];

		const analysis = {
			lineCount: content.split('\n').length,
			functionCount: functions.length,
			classCount: classes.length,
			importCount: imports.length,
			complexity: {
				average: 0,
				maximum: 0,
				maintainabilityIndex: 0,
				technicalDebt: 0,
				overall: 0
			},
			structure: {
				topLevelElements: functions.length + classes.length,
				averageFunctionLength: 0,
				longestFunction: 0
			},
			issues: []
		};

		// Calculate function statistics
		if (functions.length > 0) {
			const functionLengths = functions.map((f) => f.lineEnd - f.lineStart + 1);
			const functionComplexities = functions.map((f) => f.complexity || 1);

			analysis.structure.averageFunctionLength =
				functionLengths.reduce((sum, l) => sum + l, 0) / functionLengths.length;
			analysis.structure.longestFunction = Math.max(...functionLengths);
			analysis.complexity.average =
				functionComplexities.reduce((sum, c) => sum + c, 0) /
				functionComplexities.length;
			analysis.complexity.maximum = Math.max(...functionComplexities);
		}

		// Calculate maintainability index (simplified version of Microsoft's formula)
		analysis.complexity.maintainabilityIndex =
			this.calculateMaintainabilityIndex(analysis, content);

		// Estimate technical debt
		analysis.complexity.technicalDebt = this.estimateTechnicalDebt(
			analysis,
			functions,
			classes
		);

		// Calculate overall file complexity
		analysis.complexity.overall = this.calculateOverallFileScore(analysis);

		// Identify file-level issues
		analysis.issues = this.identifyFileComplexityIssues(analysis);

		return analysis;
	}

	/**
	 * Calculate cognitive complexity (how hard code is to understand)
	 * @param {string} code - Code to analyze
	 * @param {string} language - Programming language
	 * @returns {number} Cognitive complexity score
	 */
	calculateCognitiveComplexity(code, language) {
		let complexity = 0;
		let nestingLevel = 0;

		// Control flow structures that increase cognitive complexity
		const patterns = this.getCognitiveComplexityPatterns(language);

		patterns.forEach((pattern) => {
			const matches = code.match(pattern.regex) || [];
			matches.forEach(() => {
				complexity +=
					pattern.baseWeight +
					nestingLevel * this.options.cognitiveWeights.nesting;

				if (pattern.increasesNesting) {
					nestingLevel++;
				}
			});
		});

		return Math.min(complexity, 50); // Cap at 50
	}

	/**
	 * Calculate Halstead complexity metrics
	 * @param {string} code - Code to analyze
	 * @param {string} language - Programming language
	 * @returns {Object} Halstead metrics
	 */
	calculateHalsteadComplexity(code, language) {
		const operators = this.getOperators(language);
		const operands = this.getOperands(code, language);

		const n1 = operators.unique; // Number of distinct operators
		const n2 = operands.unique; // Number of distinct operands
		const N1 = operators.total; // Total number of operators
		const N2 = operands.total; // Total number of operands

		const n = n1 + n2; // Program vocabulary
		const N = N1 + N2; // Program length

		const V = N * Math.log2(n || 1); // Volume
		const D = (n1 / 2) * (N2 / (n2 || 1)); // Difficulty
		const E = D * V; // Effort

		return {
			vocabulary: n,
			length: N,
			volume: Math.round(V * 100) / 100,
			difficulty: Math.round(D * 100) / 100,
			effort: Math.round(E * 100) / 100,
			time: Math.round((E / 18) * 100) / 100, // Time in seconds
			bugs: Math.round((V / 3000) * 100) / 100 // Estimated bugs
		};
	}

	/**
	 * Calculate nesting depth complexity
	 * @param {string} code - Code to analyze
	 * @param {string} language - Programming language
	 * @returns {number} Maximum nesting depth
	 */
	calculateNestingComplexity(code, language) {
		let maxDepth = 0;
		let currentDepth = 0;

		// Split into lines and track nesting
		const lines = code.split('\n');

		lines.forEach((line) => {
			const trimmed = line.trim();

			// Count opening braces/blocks
			const opens = (trimmed.match(/[{(]/g) || []).length;
			const closes = (trimmed.match(/[})]/g) || []).length;

			currentDepth += opens - closes;
			maxDepth = Math.max(maxDepth, currentDepth);

			// Ensure depth doesn't go negative
			currentDepth = Math.max(0, currentDepth);
		});

		return maxDepth;
	}

	/**
	 * Calculate maintenance complexity
	 * @param {Object} func - Function data
	 * @param {string} code - Function code
	 * @param {string} language - Programming language
	 * @param {Object} context - Additional context
	 * @returns {number} Maintenance complexity score
	 */
	calculateMaintenanceComplexity(func, code, language, context) {
		let complexity = 1; // Base complexity

		// Length factor
		const lineCount = func.lineEnd - func.lineStart + 1;
		if (lineCount > 50) complexity += 2;
		else if (lineCount > 25) complexity += 1;

		// Parameter count factor
		const paramCount = func.parameters ? func.parameters.length : 0;
		if (paramCount > 5) complexity += 2;
		else if (paramCount > 3) complexity += 1;

		// Dependency factor (if available in context)
		const dependencies = context.dependencies || [];
		if (dependencies.length > 10) complexity += 2;
		else if (dependencies.length > 5) complexity += 1;

		// Language-specific factors
		complexity += this.getLanguageSpecificMaintenanceFactors(code, language);

		return Math.min(complexity, 10);
	}

	/**
	 * Calculate overall function complexity score
	 * @param {Object} complexity - All complexity metrics
	 * @returns {number} Overall score (1-10)
	 */
	calculateOverallFunctionScore(complexity) {
		const weights = {
			cyclomatic: 0.3,
			cognitive: 0.3,
			nesting: 0.2,
			maintenance: 0.2
		};

		let score = 0;
		score += (complexity.cyclomatic || 1) * weights.cyclomatic;
		score += (complexity.cognitive || 0) * weights.cognitive * 0.2; // Scale down cognitive
		score += (complexity.nesting || 0) * weights.nesting;
		score += (complexity.maintenance || 1) * weights.maintenance;

		return Math.min(Math.round(score * 10) / 10, 10);
	}

	/**
	 * Calculate overall class complexity score
	 * @param {Object} analysis - Class analysis data
	 * @returns {number} Overall score (1-10)
	 */
	calculateOverallClassScore(analysis) {
		let score = analysis.complexity.average || 1;

		// Adjust for method count
		if (analysis.methodCount > 10) score += 1;
		if (analysis.methodCount > 20) score += 1;

		// Adjust for cohesion and coupling
		score += (1 - analysis.complexity.cohesion) * 2; // Low cohesion increases complexity
		score += analysis.complexity.coupling * 0.5; // High coupling increases complexity

		return Math.min(Math.round(score * 10) / 10, 10);
	}

	/**
	 * Calculate overall file complexity score
	 * @param {Object} analysis - File analysis data
	 * @returns {number} Overall score (1-10)
	 */
	calculateOverallFileScore(analysis) {
		let score = analysis.complexity.average || 1;

		// Adjust for file size
		if (analysis.lineCount > 500) score += 2;
		else if (analysis.lineCount > 250) score += 1;

		// Adjust for maintainability index
		score += (100 - analysis.complexity.maintainabilityIndex) / 20;

		return Math.min(Math.round(score * 10) / 10, 10);
	}

	/**
	 * Calculate maintainability index
	 * @param {Object} analysis - Analysis data
	 * @param {string} content - Source content
	 * @returns {number} Maintainability index (0-100)
	 */
	calculateMaintainabilityIndex(analysis, content) {
		// Simplified version of Microsoft's Maintainability Index
		const loc = analysis.lineCount;
		const cc = analysis.complexity.average || 1;
		const hv = 20; // Simplified Halstead volume approximation

		// MI = 171 - 5.2 * ln(HV) - 0.23 * CC - 16.2 * ln(LOC)
		const mi = 171 - 5.2 * Math.log(hv) - 0.23 * cc - 16.2 * Math.log(loc);

		return Math.max(0, Math.min(100, Math.round(mi)));
	}

	/**
	 * Estimate technical debt
	 * @param {Object} analysis - Analysis data
	 * @param {Array} functions - Function list
	 * @param {Array} classes - Class list
	 * @returns {number} Technical debt estimate (hours)
	 */
	estimateTechnicalDebt(analysis, functions, classes) {
		let debt = 0;

		// Debt from high complexity functions
		functions.forEach((func) => {
			if ((func.complexity || 1) > 7) {
				debt += (func.complexity - 7) * 2; // 2 hours per excess complexity point
			}
		});

		// Debt from large files
		if (analysis.lineCount > 500) {
			debt += (analysis.lineCount - 500) / 100; // 1 hour per 100 excess lines
		}

		return Math.round(debt * 10) / 10;
	}

	// Helper methods

	/**
	 * Extract function body from content
	 * @param {string} content - Full content
	 * @param {Object} func - Function data
	 * @returns {string} Function body
	 */
	extractFunctionBody(content, func) {
		const lines = content.split('\n');
		const startLine = Math.max(0, func.lineStart - 1);
		const endLine = Math.min(lines.length, func.lineEnd);

		return lines.slice(startLine, endLine).join('\n');
	}

	/**
	 * Get cognitive complexity patterns for language
	 * @param {string} language - Programming language
	 * @returns {Array} Pattern definitions
	 */
	getCognitiveComplexityPatterns(language) {
		const basePatterns = [
			{ regex: /\bif\s*\(/g, baseWeight: 1, increasesNesting: true },
			{ regex: /\belse\s+if\b/g, baseWeight: 1, increasesNesting: false },
			{ regex: /\belse\b/g, baseWeight: 1, increasesNesting: true },
			{ regex: /\bwhile\s*\(/g, baseWeight: 1, increasesNesting: true },
			{ regex: /\bfor\s*\(/g, baseWeight: 1, increasesNesting: true },
			{ regex: /\bswitch\s*\(/g, baseWeight: 1, increasesNesting: true },
			{ regex: /\bcase\s+/g, baseWeight: 1, increasesNesting: false },
			{ regex: /\bcatch\s*\(/g, baseWeight: 1, increasesNesting: true },
			{ regex: /\?\s*.*?\s*:/g, baseWeight: 1, increasesNesting: false },
			{ regex: /&&/g, baseWeight: 1, increasesNesting: false },
			{ regex: /\|\|/g, baseWeight: 1, increasesNesting: false }
		];

		// Add language-specific patterns
		switch (language.toLowerCase()) {
			case 'python':
				basePatterns.push(
					{ regex: /\bwith\s+/g, baseWeight: 1, increasesNesting: true },
					{ regex: /\btry\s*:/g, baseWeight: 1, increasesNesting: true },
					{ regex: /\bexcept\s+/g, baseWeight: 1, increasesNesting: true }
				);
				break;
			case 'go':
				basePatterns.push(
					{ regex: /\bselect\s*\{/g, baseWeight: 1, increasesNesting: true },
					{ regex: /\bgo\s+/g, baseWeight: 1, increasesNesting: false }
				);
				break;
		}

		return basePatterns;
	}

	/**
	 * Get operators for Halstead analysis
	 * @param {string} language - Programming language
	 * @returns {Object} Operator counts
	 */
	getOperators(language) {
		// Simplified operator detection
		const commonOperators = [
			'+',
			'-',
			'*',
			'/',
			'=',
			'==',
			'!=',
			'<',
			'>',
			'&&',
			'||'
		];
		return {
			unique: commonOperators.length,
			total: commonOperators.length * 2 // Rough estimate
		};
	}

	/**
	 * Get operands for Halstead analysis
	 * @param {string} code - Code to analyze
	 * @param {string} language - Programming language
	 * @returns {Object} Operand counts
	 */
	getOperands(code, language) {
		// Simplified operand detection
		const variables = code.match(/\b[a-zA-Z_]\w*\b/g) || [];
		const uniqueVars = [...new Set(variables)];

		return {
			unique: uniqueVars.length,
			total: variables.length
		};
	}

	/**
	 * Apply language-specific complexity adjustments
	 * @param {Object} analysis - Function analysis
	 * @param {string} language - Programming language
	 * @param {string} code - Function code
	 */
	applyLanguageSpecificAdjustments(analysis, language, code) {
		switch (language.toLowerCase()) {
			case 'javascript':
			case 'typescript':
				// Async functions add complexity
				if (code.includes('async') || code.includes('await')) {
					analysis.complexity.cognitive += 1;
				}
				// Promise chains add complexity
				if (code.includes('.then(') || code.includes('.catch(')) {
					analysis.complexity.cognitive += 1;
				}
				break;

			case 'python':
				// Decorators add complexity
				if (code.includes('@')) {
					analysis.complexity.cognitive += 1;
				}
				// List comprehensions add cognitive load
				if (code.includes('[') && code.includes('for') && code.includes('in')) {
					analysis.complexity.cognitive += 1;
				}
				break;

			case 'go':
				// Error handling adds complexity
				if (code.includes('if err != nil')) {
					analysis.complexity.cognitive += 0.5; // Common pattern, less cognitive load
				}
				break;
		}
	}

	/**
	 * Get language-specific maintenance factors
	 * @param {string} code - Code to analyze
	 * @param {string} language - Programming language
	 * @returns {number} Additional maintenance complexity
	 */
	getLanguageSpecificMaintenanceFactors(code, language) {
		let factor = 0;

		switch (language.toLowerCase()) {
			case 'javascript':
			case 'typescript':
				// Dynamic typing and closures increase maintenance complexity
				if (code.includes('var ') || code.includes('this.')) factor += 0.5;
				break;

			case 'python':
				// Dynamic typing
				factor += 0.5;
				break;

			case 'go':
				// Static typing reduces maintenance complexity
				factor -= 0.5;
				break;
		}

		return Math.max(0, factor);
	}

	/**
	 * Calculate class cohesion (simplified)
	 * @param {Object} cls - Class data
	 * @param {string} content - Source content
	 * @returns {number} Cohesion score (0-1)
	 */
	calculateClassCohesion(cls, content) {
		// Simplified cohesion calculation
		// In reality, this would analyze method interactions
		const methodCount = cls.methods ? cls.methods.length : 0;

		if (methodCount === 0) return 1;
		if (methodCount > 20) return 0.3;
		if (methodCount > 10) return 0.6;

		return 0.8;
	}

	/**
	 * Calculate class coupling (simplified)
	 * @param {Object} cls - Class data
	 * @param {string} content - Source content
	 * @param {Object} context - Additional context
	 * @returns {number} Coupling score (0-10)
	 */
	calculateClassCoupling(cls, content, context) {
		// Simplified coupling calculation
		const dependencies = context.dependencies || [];
		return Math.min(dependencies.length / 5, 10);
	}

	/**
	 * Calculate overall complexity from all metrics
	 * @param {Object} analysis - Complete analysis
	 * @returns {Object} Overall complexity summary
	 */
	calculateOverallComplexity(analysis) {
		const functionScores = analysis.functions.map((f) => f.score);
		const classScores = analysis.classes.map((c) => c.score);
		const allScores = [...functionScores, ...classScores];

		return {
			average:
				allScores.length > 0
					? allScores.reduce((sum, s) => sum + s, 0) / allScores.length
					: 1,
			maximum: allScores.length > 0 ? Math.max(...allScores) : 1,
			minimum: allScores.length > 0 ? Math.min(...allScores) : 1,
			file: analysis.file.complexity.overall,
			distribution: this.calculateComplexityDistribution(allScores)
		};
	}

	/**
	 * Calculate complexity distribution
	 * @param {Array} scores - All complexity scores
	 * @returns {Object} Distribution statistics
	 */
	calculateComplexityDistribution(scores) {
		if (scores.length === 0) return { low: 0, medium: 0, high: 0 };

		const low = scores.filter((s) => s <= 3).length;
		const medium = scores.filter((s) => s > 3 && s <= 7).length;
		const high = scores.filter((s) => s > 7).length;

		return {
			low: Math.round((low / scores.length) * 100),
			medium: Math.round((medium / scores.length) * 100),
			high: Math.round((high / scores.length) * 100)
		};
	}

	/**
	 * Identify complexity factors for a function
	 * @param {Object} analysis - Function analysis
	 * @param {string} code - Function code
	 * @param {string} language - Programming language
	 * @returns {Object} Complexity factors
	 */
	identifyComplexityFactors(analysis, code, language) {
		const factors = {
			primary: [],
			secondary: [],
			suggestions: []
		};

		if (analysis.complexity.cyclomatic > 7) {
			factors.primary.push('High cyclomatic complexity');
			factors.suggestions.push('Break down into smaller functions');
		}

		if (analysis.complexity.cognitive > 10) {
			factors.primary.push('High cognitive complexity');
			factors.suggestions.push('Simplify control flow');
		}

		if (analysis.complexity.nesting > 4) {
			factors.secondary.push('Deep nesting');
			factors.suggestions.push('Reduce nesting levels');
		}

		if (analysis.lineCount > 50) {
			factors.secondary.push('Long function');
			factors.suggestions.push('Split into multiple functions');
		}

		return factors;
	}

	/**
	 * Identify complexity issues for a function
	 * @param {Object} analysis - Function analysis
	 * @returns {Array} Complexity issues
	 */
	identifyComplexityIssues(analysis) {
		const issues = [];

		if (analysis.complexity.overall > 8) {
			issues.push({
				type: 'high_complexity',
				severity: 'high',
				message: `Function ${analysis.name} has very high complexity (${analysis.complexity.overall})`,
				suggestion: 'Consider refactoring into smaller, focused functions'
			});
		} else if (analysis.complexity.overall > 5) {
			issues.push({
				type: 'medium_complexity',
				severity: 'medium',
				message: `Function ${analysis.name} has elevated complexity (${analysis.complexity.overall})`,
				suggestion: 'Consider simplifying or breaking down'
			});
		}

		return issues;
	}

	/**
	 * Identify class-level complexity issues
	 * @param {Object} analysis - Class analysis
	 * @returns {Array} Class complexity issues
	 */
	identifyClassComplexityIssues(analysis) {
		const issues = [];

		if (analysis.methodCount > 20) {
			issues.push({
				type: 'large_class',
				severity: 'high',
				message: `Class ${analysis.name} has too many methods (${analysis.methodCount})`,
				suggestion: 'Consider splitting into multiple classes'
			});
		}

		if (analysis.complexity.cohesion < 0.5) {
			issues.push({
				type: 'low_cohesion',
				severity: 'medium',
				message: `Class ${analysis.name} has low cohesion`,
				suggestion: 'Ensure methods work together toward a common purpose'
			});
		}

		return issues;
	}

	/**
	 * Identify file-level complexity issues
	 * @param {Object} analysis - File analysis
	 * @returns {Array} File complexity issues
	 */
	identifyFileComplexityIssues(analysis) {
		const issues = [];

		if (analysis.lineCount > 500) {
			issues.push({
				type: 'large_file',
				severity: 'medium',
				message: `File is very large (${analysis.lineCount} lines)`,
				suggestion: 'Consider splitting into multiple files'
			});
		}

		if (analysis.complexity.maintainabilityIndex < 20) {
			issues.push({
				type: 'low_maintainability',
				severity: 'high',
				message: `File has low maintainability index (${analysis.complexity.maintainabilityIndex})`,
				suggestion: 'Refactor to improve code quality and reduce complexity'
			});
		}

		return issues;
	}

	/**
	 * Generate complexity-based recommendations
	 * @param {Object} analysis - Complete analysis
	 * @returns {Array} Recommendations
	 */
	generateComplexityRecommendations(analysis) {
		const recommendations = [];

		// High-level recommendations based on overall complexity
		if (analysis.overall.average > 6) {
			recommendations.push({
				type: 'refactoring',
				priority: 'high',
				message: 'Consider refactoring high-complexity functions',
				impact: 'Improved maintainability and reduced bug risk'
			});
		}

		if (analysis.file.complexity.technicalDebt > 10) {
			recommendations.push({
				type: 'technical_debt',
				priority: 'medium',
				message: `Estimated ${analysis.file.complexity.technicalDebt} hours of technical debt`,
				impact: 'Allocate time for code quality improvements'
			});
		}

		// Function-specific recommendations
		const highComplexityFunctions = analysis.functions.filter(
			(f) => f.score > 7
		);
		if (highComplexityFunctions.length > 0) {
			recommendations.push({
				type: 'function_refactoring',
				priority: 'high',
				message: `${highComplexityFunctions.length} functions need refactoring`,
				targets: highComplexityFunctions.map((f) => f.name),
				impact: 'Easier testing and maintenance'
			});
		}

		return recommendations;
	}

	/**
	 * Create error analysis result
	 * @param {string} language - Programming language
	 * @param {Error} error - Error that occurred
	 * @returns {Object} Error analysis
	 */
	createErrorAnalysis(language, error) {
		return {
			language,
			timestamp: new Date().toISOString(),
			error: true,
			errorMessage: error.message,
			overall: { error: true },
			functions: [],
			classes: [],
			file: { error: true },
			recommendations: [
				{
					type: 'error',
					priority: 'high',
					message: `Complexity analysis failed: ${error.message}`,
					impact: 'Unable to assess code complexity'
				}
			]
		};
	}
}

export default ComplexityScorer;
