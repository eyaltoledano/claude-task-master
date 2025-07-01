/**
 * Intelligent Context Builder for AST Integration Phase 2.1
 *
 * Advanced context assembly that supersedes basic ast-context-builder.js
 * Provides task-aware context selection, smart code prioritization, and
 * optimized context assembly for Claude integration.
 *
 * @author Task Master Flow
 * @version 2.1.0
 */

import path from 'path';
import { readFile } from 'fs/promises';
import CodeAnalyzer from './code-analyzer.js';
import DependencyMapper from './dependency-mapper.js';
import ComplexityScorer from './complexity-scorer.js';

/**
 * Intelligent context assembly for enhanced Claude integration
 */
export class ContextBuilder {
	constructor(options = {}) {
		this.options = {
			maxTokens: 8000, // Maximum tokens for context
			maxFiles: 15, // Maximum files to include
			enableTaskAwareness: true, // Task-specific context selection
			enableProgressiveContext: true, // Build context progressively
			enableOptimization: true, // Optimize context size
			prioritizationWeights: {
				taskRelevance: 0.4, // Weight for task relevance
				complexity: 0.3, // Weight for complexity
				dependencies: 0.2, // Weight for dependencies
				recency: 0.1 // Weight for file recency
			},
			...options
		};

		// Initialize analysis components
		this.codeAnalyzer = new CodeAnalyzer();
		this.dependencyMapper = new DependencyMapper();
		this.complexityScorer = new ComplexityScorer();
	}

	/**
	 * Build intelligent, task-aware context for Claude
	 * @param {string} taskDescription - Description of the task
	 * @param {Map} allFiles - Map of file paths to AST data
	 * @param {Object} options - Context building options
	 * @returns {Promise<Object>} Optimized context for Claude
	 */
	async buildTaskAwareContext(taskDescription, allFiles, options = {}) {
		try {
			const context = {
				timestamp: new Date().toISOString(),
				taskDescription,
				totalFiles: allFiles.size,
				analysis: {},
				selectedFiles: [],
				insights: [],
				recommendations: [],
				metadata: {}
			};

			// Phase 1: Analyze all files with advanced analysis
			console.log('🔍 Analyzing code patterns and complexity...');
			context.analysis = await this.performComprehensiveAnalysis(allFiles);

			// Phase 2: Extract task keywords and intent
			console.log('🎯 Analyzing task requirements...');
			const taskAnalysis = this.analyzeTaskRequirements(taskDescription);

			// Phase 3: Score and prioritize files based on task relevance
			console.log('📊 Scoring file relevance...');
			const fileScores = await this.scoreFileRelevance(
				allFiles,
				taskAnalysis,
				context.analysis
			);

			// Phase 4: Select optimal set of files for context
			console.log('🎨 Building optimized context...');
			context.selectedFiles = this.selectOptimalFiles(fileScores, allFiles);

			// Phase 5: Generate insights and recommendations
			console.log('💡 Generating insights...');
			context.insights = this.generateContextInsights(
				context.analysis,
				taskAnalysis
			);
			context.recommendations = this.generateTaskRecommendations(
				context.analysis,
				taskAnalysis
			);

			// Phase 6: Create metadata for context optimization
			context.metadata = this.createContextMetadata(context);

			return context;
		} catch (error) {
			console.error('Context building failed:', error.message);
			return this.createErrorContext(taskDescription, error);
		}
	}

	/**
	 * Perform comprehensive analysis on all files
	 * @param {Map} allFiles - Map of file paths to AST data
	 * @returns {Promise<Object>} Complete analysis results
	 */
	async performComprehensiveAnalysis(allFiles) {
		const analysis = {
			patterns: new Map(),
			dependencies: {},
			complexity: new Map(),
			frameworks: [],
			statistics: {}
		};

		// Analyze each file for patterns
		for (const [filePath, astData] of allFiles) {
			if (astData.content) {
				const language = this.detectLanguage(filePath, astData);

				// Pattern analysis
				const patterns = await this.codeAnalyzer.analyzePatterns(
					astData,
					language,
					filePath,
					astData.content
				);
				analysis.patterns.set(filePath, patterns);

				// Complexity analysis
				const complexity = await this.complexityScorer.calculateComplexity(
					astData,
					language,
					astData.content
				);
				analysis.complexity.set(filePath, complexity);

				// Collect frameworks
				if (patterns.frameworks && patterns.frameworks.length > 0) {
					analysis.frameworks.push(...patterns.frameworks);
				}
			}
		}

		// Dependency analysis
		analysis.dependencies =
			await this.dependencyMapper.buildDependencyGraph(allFiles);

		// Calculate overall statistics
		analysis.statistics = this.calculateAnalysisStatistics(analysis);

		return analysis;
	}

	/**
	 * Analyze task requirements and extract keywords
	 * @param {string} taskDescription - Task description
	 * @returns {Object} Task analysis
	 */
	analyzeTaskRequirements(taskDescription) {
		const analysis = {
			keywords: [],
			intent: '',
			language: '',
			framework: '',
			type: '',
			complexity: 'medium',
			focusAreas: []
		};

		const description = taskDescription.toLowerCase();

		// Extract keywords
		analysis.keywords = this.extractTaskKeywords(description);

		// Determine task intent
		analysis.intent = this.determineTaskIntent(description);

		// Identify target language
		analysis.language = this.identifyTargetLanguage(description);

		// Identify framework
		analysis.framework = this.identifyTargetFramework(description);

		// Determine task type
		analysis.type = this.determineTaskType(description);

		// Estimate complexity
		analysis.complexity = this.estimateTaskComplexity(description);

		// Identify focus areas
		analysis.focusAreas = this.identifyFocusAreas(description);

		return analysis;
	}

	/**
	 * Score file relevance based on task requirements
	 * @param {Map} allFiles - All project files
	 * @param {Object} taskAnalysis - Task analysis results
	 * @param {Object} codeAnalysis - Code analysis results
	 * @returns {Promise<Array>} Scored files
	 */
	async scoreFileRelevance(allFiles, taskAnalysis, codeAnalysis) {
		const scoredFiles = [];

		for (const [filePath, astData] of allFiles) {
			const score = {
				filePath,
				relevance: 0,
				complexity: 0,
				dependencies: 0,
				recency: 0,
				total: 0,
				reasons: []
			};

			// Task relevance scoring
			score.relevance = this.calculateTaskRelevance(
				filePath,
				astData,
				taskAnalysis
			);

			// Complexity scoring
			const complexityData = codeAnalysis.complexity.get(filePath);
			if (complexityData) {
				score.complexity = this.calculateComplexityRelevance(
					complexityData,
					taskAnalysis
				);
			}

			// Dependency scoring
			score.dependencies = this.calculateDependencyRelevance(
				filePath,
				codeAnalysis.dependencies
			);

			// Recency scoring (simplified - could use git timestamps)
			score.recency = this.calculateRecencyScore(filePath);

			// Calculate weighted total
			const weights = this.options.prioritizationWeights;
			score.total =
				score.relevance * weights.taskRelevance +
				score.complexity * weights.complexity +
				score.dependencies * weights.dependencies +
				score.recency * weights.recency;

			// Add explanations
			score.reasons = this.explainFileScore(score, taskAnalysis);

			scoredFiles.push(score);
		}

		return scoredFiles.sort((a, b) => b.total - a.total);
	}

	/**
	 * Select optimal set of files for context
	 * @param {Array} fileScores - Scored files
	 * @param {Map} allFiles - All files
	 * @returns {Array} Selected files for context
	 */
	selectOptimalFiles(fileScores, allFiles) {
		const selected = [];
		let totalTokens = 0;
		let fileCount = 0;

		// Use greedy selection based on scores
		for (const scoreData of fileScores) {
			if (fileCount >= this.options.maxFiles) break;

			const filePath = scoreData.filePath;
			const astData = allFiles.get(filePath);

			if (!astData || !astData.content) continue;

			// Estimate tokens for this file
			const estimatedTokens = this.estimateTokens(astData.content);

			if (totalTokens + estimatedTokens > this.options.maxTokens) {
				// Try to include summary instead of full content
				if (totalTokens + 200 <= this.options.maxTokens) {
					selected.push({
						filePath,
						content: this.createFileSummary(astData, scoreData),
						included: 'summary',
						score: scoreData.total,
						reasons: scoreData.reasons,
						tokenEstimate: 200
					});
					totalTokens += 200;
					fileCount++;
				}
				continue;
			}

			// Include full file
			selected.push({
				filePath,
				content: astData.content,
				included: 'full',
				score: scoreData.total,
				reasons: scoreData.reasons,
				tokenEstimate: estimatedTokens,
				functions: astData.functions || [],
				classes: astData.classes || [],
				imports: astData.imports || []
			});

			totalTokens += estimatedTokens;
			fileCount++;
		}

		return selected;
	}

	/**
	 * Generate insights from analysis
	 * @param {Object} analysis - Complete analysis
	 * @param {Object} taskAnalysis - Task analysis
	 * @returns {Array} Context insights
	 */
	generateContextInsights(analysis, taskAnalysis) {
		const insights = [];

		// Framework insights
		const frameworks = [...new Set(analysis.frameworks.map((f) => f.name))];
		if (frameworks.length > 0) {
			insights.push({
				type: 'framework_usage',
				level: 'info',
				message: `Project uses: ${frameworks.join(', ')}`,
				actionable: `Leverage ${frameworks[0]} patterns and conventions for the task`,
				confidence: 0.9
			});
		}

		// Complexity insights
		let highComplexityFiles = 0;
		for (const [filePath, complexity] of analysis.complexity) {
			if (complexity.overall && complexity.overall.average > 6) {
				highComplexityFiles++;
			}
		}

		if (highComplexityFiles > 0) {
			insights.push({
				type: 'complexity_awareness',
				level: 'warning',
				message: `${highComplexityFiles} files have high complexity`,
				actionable:
					'Be careful when modifying complex files; consider refactoring opportunities',
				confidence: 0.8
			});
		}

		// Dependency insights
		if (
			analysis.dependencies.circularDependencies &&
			analysis.dependencies.circularDependencies.length > 0
		) {
			insights.push({
				type: 'circular_dependencies',
				level: 'warning',
				message: `Found ${analysis.dependencies.circularDependencies.length} circular dependencies`,
				actionable: 'Avoid creating additional circular dependencies',
				confidence: 0.95
			});
		}

		// Task-specific insights
		if (taskAnalysis.type === 'feature_addition') {
			insights.push({
				type: 'feature_guidance',
				level: 'info',
				message: 'Adding new feature to existing codebase',
				actionable:
					'Follow existing patterns and maintain consistency with current architecture',
				confidence: 0.8
			});
		}

		return insights;
	}

	/**
	 * Generate task-specific recommendations
	 * @param {Object} analysis - Complete analysis
	 * @param {Object} taskAnalysis - Task analysis
	 * @returns {Array} Recommendations
	 */
	generateTaskRecommendations(analysis, taskAnalysis) {
		const recommendations = [];

		// Language-specific recommendations
		if (
			taskAnalysis.language === 'javascript' ||
			taskAnalysis.language === 'typescript'
		) {
			recommendations.push({
				type: 'language_best_practices',
				priority: 'medium',
				message: 'Follow JavaScript/TypeScript best practices',
				details: [
					'Use async/await for asynchronous operations',
					'Implement proper error handling',
					'Consider TypeScript for better type safety'
				]
			});
		}

		// Framework-specific recommendations
		if (taskAnalysis.framework === 'react') {
			recommendations.push({
				type: 'framework_guidance',
				priority: 'high',
				message: 'Follow React patterns and hooks guidelines',
				details: [
					'Use functional components with hooks',
					'Implement proper component lifecycle',
					'Consider component composition over inheritance'
				]
			});
		}

		// Complexity-based recommendations
		if (taskAnalysis.complexity === 'high') {
			recommendations.push({
				type: 'complexity_management',
				priority: 'high',
				message: 'Manage complexity in implementation',
				details: [
					'Break down complex functionality into smaller functions',
					'Write comprehensive tests',
					'Document complex logic clearly'
				]
			});
		}

		return recommendations;
	}

	/**
	 * Create context metadata for optimization
	 * @param {Object} context - Context being built
	 * @returns {Object} Context metadata
	 */
	createContextMetadata(context) {
		return {
			version: '2.1.0',
			contextSize: context.selectedFiles.reduce(
				(sum, f) => sum + f.tokenEstimate,
				0
			),
			fileCount: context.selectedFiles.length,
			compressionRatio:
				context.selectedFiles.filter((f) => f.included === 'summary').length /
				context.selectedFiles.length,
			analysisTime: new Date().toISOString(),
			optimization: {
				tokenUtilization: this.calculateTokenUtilization(context.selectedFiles),
				relevanceScore: this.calculateAverageRelevance(context.selectedFiles),
				completeness: this.calculateContextCompleteness(context)
			}
		};
	}

	// Helper methods for task analysis

	/**
	 * Extract keywords from task description
	 * @param {string} description - Task description
	 * @returns {Array} Extracted keywords
	 */
	extractTaskKeywords(description) {
		const keywords = [];

		// Technical keywords
		const techKeywords = [
			'api',
			'database',
			'frontend',
			'backend',
			'component',
			'function',
			'class',
			'interface',
			'service',
			'controller',
			'model',
			'view',
			'authentication',
			'authorization',
			'validation',
			'testing',
			'deployment'
		];

		techKeywords.forEach((keyword) => {
			if (description.includes(keyword)) {
				keywords.push(keyword);
			}
		});

		// Extract camelCase and kebab-case identifiers
		const identifiers =
			description.match(
				/[a-zA-Z][a-zA-Z0-9]*(?:[A-Z][a-zA-Z0-9]*)*|[a-z]+-[a-z-]+/g
			) || [];
		keywords.push(...identifiers.filter((id) => id.length > 2));

		return [...new Set(keywords)];
	}

	/**
	 * Determine task intent
	 * @param {string} description - Task description
	 * @returns {string} Task intent
	 */
	determineTaskIntent(description) {
		if (
			description.includes('add') ||
			description.includes('create') ||
			description.includes('implement')
		) {
			return 'create';
		}
		if (
			description.includes('fix') ||
			description.includes('bug') ||
			description.includes('error')
		) {
			return 'fix';
		}
		if (
			description.includes('update') ||
			description.includes('modify') ||
			description.includes('change')
		) {
			return 'modify';
		}
		if (
			description.includes('refactor') ||
			description.includes('improve') ||
			description.includes('optimize')
		) {
			return 'refactor';
		}
		if (description.includes('test') || description.includes('spec')) {
			return 'test';
		}

		return 'general';
	}

	/**
	 * Identify target programming language
	 * @param {string} description - Task description
	 * @returns {string} Target language
	 */
	identifyTargetLanguage(description) {
		const languages = {
			javascript: ['javascript', 'js', 'node'],
			typescript: ['typescript', 'ts'],
			python: ['python', 'py'],
			go: ['go', 'golang'],
			java: ['java'],
			'c#': ['csharp', 'c#', '.net']
		};

		for (const [lang, keywords] of Object.entries(languages)) {
			if (keywords.some((keyword) => description.includes(keyword))) {
				return lang;
			}
		}

		return 'unknown';
	}

	/**
	 * Identify target framework
	 * @param {string} description - Task description
	 * @returns {string} Target framework
	 */
	identifyTargetFramework(description) {
		const frameworks = {
			react: ['react', 'jsx', 'component'],
			vue: ['vue', 'vuejs'],
			angular: ['angular'],
			express: ['express', 'expressjs'],
			django: ['django'],
			fastapi: ['fastapi'],
			gin: ['gin'],
			spring: ['spring']
		};

		for (const [framework, keywords] of Object.entries(frameworks)) {
			if (keywords.some((keyword) => description.includes(keyword))) {
				return framework;
			}
		}

		return 'unknown';
	}

	/**
	 * Determine task type
	 * @param {string} description - Task description
	 * @returns {string} Task type
	 */
	determineTaskType(description) {
		if (
			description.includes('feature') ||
			description.includes('functionality')
		) {
			return 'feature_addition';
		}
		if (description.includes('bug') || description.includes('fix')) {
			return 'bug_fix';
		}
		if (description.includes('refactor') || description.includes('clean')) {
			return 'refactoring';
		}
		if (description.includes('test') || description.includes('spec')) {
			return 'testing';
		}
		if (
			description.includes('performance') ||
			description.includes('optimize')
		) {
			return 'optimization';
		}

		return 'general';
	}

	/**
	 * Estimate task complexity
	 * @param {string} description - Task description
	 * @returns {string} Complexity estimate
	 */
	estimateTaskComplexity(description) {
		let complexity = 0;

		// Complexity indicators
		const highComplexityWords = [
			'complex',
			'advanced',
			'multiple',
			'integration',
			'system'
		];
		const mediumComplexityWords = ['modify', 'update', 'enhance', 'extend'];
		const lowComplexityWords = ['simple', 'basic', 'small', 'quick'];

		highComplexityWords.forEach((word) => {
			if (description.includes(word)) complexity += 2;
		});

		mediumComplexityWords.forEach((word) => {
			if (description.includes(word)) complexity += 1;
		});

		lowComplexityWords.forEach((word) => {
			if (description.includes(word)) complexity -= 1;
		});

		if (complexity >= 3) return 'high';
		if (complexity >= 1) return 'medium';
		return 'low';
	}

	/**
	 * Identify focus areas from task description
	 * @param {string} description - Task description
	 * @returns {Array} Focus areas
	 */
	identifyFocusAreas(description) {
		const areas = [];

		const areaKeywords = {
			database: ['database', 'db', 'sql', 'query', 'schema'],
			api: ['api', 'endpoint', 'route', 'http', 'rest'],
			ui: ['ui', 'interface', 'component', 'view', 'frontend'],
			auth: ['auth', 'login', 'permission', 'security'],
			testing: ['test', 'spec', 'unit', 'integration'],
			performance: ['performance', 'speed', 'optimize', 'cache']
		};

		for (const [area, keywords] of Object.entries(areaKeywords)) {
			if (keywords.some((keyword) => description.includes(keyword))) {
				areas.push(area);
			}
		}

		return areas;
	}

	// Scoring helper methods

	/**
	 * Calculate task relevance score for a file
	 * @param {string} filePath - File path
	 * @param {Object} astData - AST data
	 * @param {Object} taskAnalysis - Task analysis
	 * @returns {number} Relevance score (0-1)
	 */
	calculateTaskRelevance(filePath, astData, taskAnalysis) {
		let score = 0;

		// File path relevance
		const fileName = path.basename(filePath).toLowerCase();
		taskAnalysis.keywords.forEach((keyword) => {
			if (fileName.includes(keyword)) {
				score += 0.2;
			}
		});

		// Content relevance
		if (astData.content) {
			const content = astData.content.toLowerCase();
			taskAnalysis.keywords.forEach((keyword) => {
				const matches = (content.match(new RegExp(keyword, 'g')) || []).length;
				score += Math.min(matches * 0.1, 0.3);
			});
		}

		// Language relevance
		const fileLanguage = this.detectLanguage(filePath, astData);
		if (fileLanguage === taskAnalysis.language) {
			score += 0.3;
		}

		// Framework relevance
		const functions = astData.functions || [];
		const imports = astData.imports || [];

		if (taskAnalysis.framework === 'react') {
			const hasReactImports = imports.some((imp) =>
				imp.source.includes('react')
			);
			const hasComponents = functions.some((func) => /^[A-Z]/.test(func.name));
			if (hasReactImports || hasComponents) score += 0.4;
		}

		return Math.min(score, 1);
	}

	/**
	 * Calculate complexity relevance
	 * @param {Object} complexityData - Complexity analysis
	 * @param {Object} taskAnalysis - Task analysis
	 * @returns {number} Complexity relevance score
	 */
	calculateComplexityRelevance(complexityData, taskAnalysis) {
		if (!complexityData.overall) return 0;

		const avgComplexity = complexityData.overall.average || 1;

		// For complex tasks, prefer complex files
		if (taskAnalysis.complexity === 'high') {
			return Math.min(avgComplexity / 10, 1);
		}

		// For simple tasks, prefer simpler files
		if (taskAnalysis.complexity === 'low') {
			return Math.max(0, 1 - avgComplexity / 10);
		}

		// For medium tasks, balanced approach
		return Math.max(0, 1 - Math.abs(5 - avgComplexity) / 5);
	}

	/**
	 * Calculate dependency relevance
	 * @param {string} filePath - File path
	 * @param {Object} dependencies - Dependency analysis
	 * @returns {number} Dependency relevance score
	 */
	calculateDependencyRelevance(filePath, dependencies) {
		if (!dependencies.dependencies || !dependencies.dependencies[filePath]) {
			return 0;
		}

		const fileDeps = dependencies.dependencies[filePath];
		const importCount = fileDeps.imports.length;
		const importedByCount = fileDeps.importedBy.length;

		// Files that are heavily interconnected are more relevant
		return Math.min((importCount + importedByCount * 2) / 20, 1);
	}

	/**
	 * Calculate recency score (simplified)
	 * @param {string} filePath - File path
	 * @returns {number} Recency score
	 */
	calculateRecencyScore(filePath) {
		// Simplified - in reality would use git timestamps
		if (filePath.includes('test')) return 0.8;
		if (filePath.includes('src')) return 0.9;
		return 0.5;
	}

	/**
	 * Explain file score
	 * @param {Object} score - Score data
	 * @param {Object} taskAnalysis - Task analysis
	 * @returns {Array} Explanation reasons
	 */
	explainFileScore(score, taskAnalysis) {
		const reasons = [];

		if (score.relevance > 0.5) {
			reasons.push(
				`High task relevance (${Math.round(score.relevance * 100)}%)`
			);
		}
		if (score.complexity > 0.6) {
			reasons.push(`Complexity matches task requirements`);
		}
		if (score.dependencies > 0.5) {
			reasons.push(`Central to project dependencies`);
		}
		if (score.total > 0.7) {
			reasons.push(`High overall relevance for task`);
		}

		return reasons.length > 0 ? reasons : ['Included for context completeness'];
	}

	// Utility methods

	/**
	 * Detect programming language from file
	 * @param {string} filePath - File path
	 * @param {Object} astData - AST data
	 * @returns {string} Detected language
	 */
	detectLanguage(filePath, astData) {
		const ext = path.extname(filePath).toLowerCase();

		const languageMap = {
			'.js': 'javascript',
			'.jsx': 'javascript',
			'.ts': 'typescript',
			'.tsx': 'typescript',
			'.py': 'python',
			'.go': 'go',
			'.java': 'java',
			'.cs': 'csharp'
		};

		return languageMap[ext] || 'unknown';
	}

	/**
	 * Estimate tokens for content
	 * @param {string} content - Content to estimate
	 * @returns {number} Estimated token count
	 */
	estimateTokens(content) {
		// Rough estimation: ~4 characters per token
		return Math.ceil(content.length / 4);
	}

	/**
	 * Create file summary when full content won't fit
	 * @param {Object} astData - AST data
	 * @param {Object} scoreData - Score data
	 * @returns {string} File summary
	 */
	createFileSummary(astData, scoreData) {
		const functions = astData.functions || [];
		const classes = astData.classes || [];
		const imports = astData.imports || [];

		let summary = `// ${scoreData.filePath} - Summary\n`;
		summary += `// Relevance: ${Math.round(scoreData.total * 100)}%\n`;
		summary += `// ${scoreData.reasons.join(', ')}\n\n`;

		if (imports.length > 0) {
			summary += `// Imports: ${imports
				.slice(0, 3)
				.map((imp) => imp.source)
				.join(', ')}\n`;
		}

		if (functions.length > 0) {
			summary += `// Functions: ${functions
				.slice(0, 5)
				.map((f) => f.name)
				.join(', ')}\n`;
		}

		if (classes.length > 0) {
			summary += `// Classes: ${classes
				.slice(0, 3)
				.map((c) => c.name)
				.join(', ')}\n`;
		}

		return summary;
	}

	/**
	 * Calculate analysis statistics
	 * @param {Object} analysis - Analysis results
	 * @returns {Object} Statistics
	 */
	calculateAnalysisStatistics(analysis) {
		return {
			totalFiles: analysis.patterns.size,
			uniqueFrameworks: [...new Set(analysis.frameworks.map((f) => f.name))]
				.length,
			averageComplexity: this.calculateAverageComplexity(analysis.complexity),
			dependencyComplexity:
				analysis.dependencies.statistics?.dependencyComplexity || 'unknown'
		};
	}

	/**
	 * Calculate average complexity across all files
	 * @param {Map} complexityMap - Complexity data by file
	 * @returns {number} Average complexity
	 */
	calculateAverageComplexity(complexityMap) {
		let total = 0;
		let count = 0;

		for (const [filePath, complexity] of complexityMap) {
			if (complexity.overall && complexity.overall.average) {
				total += complexity.overall.average;
				count++;
			}
		}

		return count > 0 ? total / count : 1;
	}

	/**
	 * Calculate token utilization
	 * @param {Array} selectedFiles - Selected files
	 * @returns {number} Token utilization percentage
	 */
	calculateTokenUtilization(selectedFiles) {
		const totalTokens = selectedFiles.reduce(
			(sum, f) => sum + f.tokenEstimate,
			0
		);
		return Math.round((totalTokens / this.options.maxTokens) * 100);
	}

	/**
	 * Calculate average relevance of selected files
	 * @param {Array} selectedFiles - Selected files
	 * @returns {number} Average relevance score
	 */
	calculateAverageRelevance(selectedFiles) {
		if (selectedFiles.length === 0) return 0;
		const totalScore = selectedFiles.reduce((sum, f) => sum + f.score, 0);
		return Math.round((totalScore / selectedFiles.length) * 100) / 100;
	}

	/**
	 * Calculate context completeness
	 * @param {Object} context - Context object
	 * @returns {number} Completeness score
	 */
	calculateContextCompleteness(context) {
		// Simplified completeness calculation
		const hasAnalysis = Object.keys(context.analysis).length > 0;
		const hasFiles = context.selectedFiles.length > 0;
		const hasInsights = context.insights.length > 0;

		const completenessFactors = [hasAnalysis, hasFiles, hasInsights];
		const completeness =
			completenessFactors.filter(Boolean).length / completenessFactors.length;

		return Math.round(completeness * 100);
	}

	/**
	 * Create error context when analysis fails
	 * @param {string} taskDescription - Task description
	 * @param {Error} error - Error that occurred
	 * @returns {Object} Error context
	 */
	createErrorContext(taskDescription, error) {
		return {
			timestamp: new Date().toISOString(),
			taskDescription,
			error: true,
			errorMessage: error.message,
			analysis: {},
			selectedFiles: [],
			insights: [
				{
					type: 'error',
					level: 'error',
					message: `Context building failed: ${error.message}`,
					actionable: 'Check file accessibility and syntax',
					confidence: 1.0
				}
			],
			recommendations: [],
			metadata: { error: true }
		};
	}
}

export default ContextBuilder;
