import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { promisify } from 'util';

/**
 * CodeQualityAnalyzer - Lightweight code quality analysis for AI-generated code
 */
export class CodeQualityAnalyzer {
	constructor(options = {}) {
		this.options = {
			enableBiomeAnalysis: true,
			enableComplexityAnalysis: true,
			enableStructuralAnalysis: true,
			enableTaskAlignment: true,
			maxAnalysisTimeMs: 10000, // 10 seconds max
			...options
		};
	}

	/**
	 * Analyze code quality for a completed session
	 */
	async analyzeSession(session, task, worktree, services) {
		const startTime = Date.now();

		try {
			// Get changed files from the session
			const changes = await this.getSessionChanges(worktree, services);

			if (changes.length === 0) {
				return {
					hasChanges: false,
					message: 'No code changes detected',
					timestamp: new Date().toISOString()
				};
			}

			const analysis = {
				hasChanges: true,
				fileCount: changes.length,
				totalLines: 0,
				analysisTime: 0,
				timestamp: new Date().toISOString(),
				files: []
			};

			// Analyze each changed file
			for (const change of changes) {
				const fileAnalysis = await this.analyzeFile(change, task);
				analysis.files.push(fileAnalysis);
				analysis.totalLines += fileAnalysis.metrics.linesOfCode;
			}

			// Calculate aggregate metrics
			analysis.aggregateMetrics = this.calculateAggregateMetrics(
				analysis.files
			);

			// Run Biome analysis if enabled
			if (this.options.enableBiomeAnalysis) {
				analysis.lintResults = await this.runBiomeAnalysis(changes, worktree);
			}

			// Analyze task alignment
			if (this.options.enableTaskAlignment && task) {
				analysis.taskAlignment = await this.analyzeTaskAlignment(changes, task);
			}

			// Calculate overall quality score
			analysis.overallScore = this.calculateOverallScore(analysis);

			analysis.analysisTime = Date.now() - startTime;
			return analysis;
		} catch (error) {
			return {
				error: error.message,
				analysisTime: Date.now() - startTime,
				timestamp: new Date().toISOString()
			};
		}
	}

	/**
	 * Get changed files from the session
	 */
	async getSessionChanges(worktree, services) {
		try {
			// Use git to get changed files since the session started
			const gitCommand = 'git diff --name-status HEAD~1';
			const result = await this.executeCommand(gitCommand, worktree.path);

			const changes = [];
			const lines = result.stdout.split('\n').filter((line) => line.trim());

			for (const line of lines) {
				const [status, filePath] = line.split('\t');
				if (status && filePath && this.shouldAnalyzeFile(filePath)) {
					try {
						const fullPath = path.join(worktree.path, filePath);
						const content = await fs.readFile(fullPath, 'utf8');

						changes.push({
							path: filePath,
							fullPath,
							status, // A=added, M=modified, D=deleted
							content,
							size: content.length
						});
					} catch (fileError) {
						console.warn(`Could not read file ${filePath}:`, fileError.message);
					}
				}
			}

			return changes;
		} catch (error) {
			console.warn('Could not get git changes:', error.message);
			return [];
		}
	}

	/**
	 * Analyze a single file
	 */
	async analyzeFile(change, task) {
		const analysis = {
			path: change.path,
			status: change.status,
			size: change.size,
			language: this.detectLanguage(change.path),
			metrics: {},
			issues: []
		};

		try {
			// Basic structural metrics
			analysis.metrics = this.calculateStructuralMetrics(change.content);

			// Complexity analysis
			if (this.options.enableComplexityAnalysis) {
				analysis.metrics.complexity = this.calculateComplexity(
					change.content,
					analysis.language
				);
			}

			// Language-specific analysis
			if (
				analysis.language === 'javascript' ||
				analysis.language === 'typescript'
			) {
				analysis.jsMetrics = this.analyzeJavaScript(change.content);
			}
		} catch (error) {
			analysis.issues.push(`Analysis error: ${error.message}`);
		}

		return analysis;
	}

	/**
	 * Calculate structural metrics for code
	 */
	calculateStructuralMetrics(code) {
		const lines = code.split('\n');
		const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
		const commentLines = lines.filter((line) => {
			const trimmed = line.trim();
			return (
				trimmed.startsWith('//') ||
				trimmed.startsWith('/*') ||
				trimmed.startsWith('*') ||
				trimmed.startsWith('#')
			);
		});

		return {
			linesOfCode: nonEmptyLines.length,
			totalLines: lines.length,
			commentLines: commentLines.length,
			commentRatio: commentLines.length / Math.max(nonEmptyLines.length, 1),
			averageLineLength: this.calculateAverageLineLength(nonEmptyLines),
			maxLineLength: Math.max(...lines.map((line) => line.length)),
			blankLines: lines.length - nonEmptyLines.length
		};
	}

	/**
	 * Calculate cyclomatic complexity
	 */
	calculateComplexity(code, language) {
		const complexityPatterns = {
			javascript: [
				/\bif\s*\(/g, // if statements
				/\bwhile\s*\(/g, // while loops
				/\bfor\s*\(/g, // for loops
				/\bcase\s+/g, // switch cases
				/\bcatch\s*\(/g, // try-catch
				/\?\s*.*?\s*:/g, // ternary operators
				/&&|\|\|/g, // logical operators
				/\belse\s+if\b/g // else if
			],
			typescript: [
				/\bif\s*\(/g,
				/\bwhile\s*\(/g,
				/\bfor\s*\(/g,
				/\bcase\s+/g,
				/\bcatch\s*\(/g,
				/\?\s*.*?\s*:/g,
				/&&|\|\|/g,
				/\belse\s+if\b/g
			]
		};

		const patterns =
			complexityPatterns[language] || complexityPatterns.javascript;
		let complexity = 1; // Base complexity

		for (const pattern of patterns) {
			const matches = code.match(pattern);
			if (matches) {
				complexity += matches.length;
			}
		}

		return {
			cyclomaticComplexity: complexity,
			complexityLevel: this.getComplexityLevel(complexity)
		};
	}

	/**
	 * Analyze JavaScript/TypeScript specific patterns
	 */
	analyzeJavaScript(code) {
		return {
			functionCount: (
				code.match(/function\s+\w+|=>\s*{|async\s+function/g) || []
			).length,
			classCount: (code.match(/class\s+\w+/g) || []).length,
			importCount: (code.match(/import\s+.*from|require\s*\(/g) || []).length,
			exportCount: (code.match(/export\s+(default\s+)?/g) || []).length,
			asyncFunctionCount: (code.match(/async\s+function|\basync\s*\(/g) || [])
				.length,
			promiseUsage: (code.match(/\.then\(|\.catch\(|await\s+/g) || []).length,
			consoleUsage: (code.match(/console\.(log|error|warn|debug)/g) || [])
				.length,
			todoComments: (code.match(/\/\/\s*TODO|\/\*\s*TODO|\*\s*TODO/gi) || [])
				.length
		};
	}

	/**
	 * Run Biome analysis on changed files
	 */
	async runBiomeAnalysis(changes, worktree) {
		try {
			// Check if biome.json exists
			const biomeConfigPath = path.join(worktree.path, 'biome.json');
			try {
				await fs.access(biomeConfigPath);
			} catch {
				return { available: false, reason: 'No biome.json found' };
			}

			// Run biome check on changed files
			const filePaths = changes
				.filter((c) => this.isBiomeSupported(c.path))
				.map((c) => c.path)
				.join(' ');

			if (!filePaths) {
				return { available: true, files: 0, issues: [] };
			}

			const command = `npx biome check ${filePaths} --reporter=json`;
			const result = await this.executeCommand(command, worktree.path);

			try {
				const biomeOutput = JSON.parse(result.stdout);
				return this.parseBiomeResults(biomeOutput);
			} catch (parseError) {
				// Biome might return non-JSON output on errors
				return {
					available: true,
					error: 'Could not parse Biome output',
					rawOutput: result.stdout.substring(0, 500)
				};
			}
		} catch (error) {
			return {
				available: false,
				error: error.message
			};
		}
	}

	/**
	 * Analyze how well the code aligns with task requirements
	 */
	async analyzeTaskAlignment(changes, task) {
		const taskKeywords = this.extractTaskKeywords(task);
		const codeContent = changes
			.map((c) => c.content)
			.join('\n')
			.toLowerCase();

		// Calculate keyword coverage
		const foundKeywords = taskKeywords.filter((keyword) =>
			codeContent.includes(keyword.toLowerCase())
		);

		// Analyze file relevance
		const relevantFiles = changes.filter((change) =>
			this.isFileRelevantToTask(change.path, task)
		);

		return {
			keywordCoverage: foundKeywords.length / Math.max(taskKeywords.length, 1),
			foundKeywords,
			missedKeywords: taskKeywords.filter((k) => !foundKeywords.includes(k)),
			relevantFileRatio: relevantFiles.length / Math.max(changes.length, 1),
			implementationScope: this.assessImplementationScope(changes, task)
		};
	}

	/**
	 * Calculate aggregate metrics across all files
	 */
	calculateAggregateMetrics(fileAnalyses) {
		if (fileAnalyses.length === 0) {
			return {};
		}

		const totals = fileAnalyses.reduce(
			(acc, file) => {
				const metrics = file.metrics;
				acc.totalLines += metrics.linesOfCode || 0;
				acc.totalComplexity += metrics.complexity?.cyclomaticComplexity || 0;
				acc.totalComments += metrics.commentLines || 0;
				acc.totalFunctions += file.jsMetrics?.functionCount || 0;
				return acc;
			},
			{ totalLines: 0, totalComplexity: 0, totalComments: 0, totalFunctions: 0 }
		);

		return {
			averageComplexity: totals.totalComplexity / fileAnalyses.length,
			averageCommentRatio:
				totals.totalComments / Math.max(totals.totalLines, 1),
			totalLinesOfCode: totals.totalLines,
			totalFunctions: totals.totalFunctions,
			filesAnalyzed: fileAnalyses.length,
			complexityDistribution: this.calculateComplexityDistribution(fileAnalyses)
		};
	}

	/**
	 * Calculate overall quality score (1-10)
	 */
	calculateOverallScore(analysis) {
		let score = 10;
		const metrics = analysis.aggregateMetrics;

		// Complexity penalty
		if (metrics.averageComplexity > 15) score -= 2;
		else if (metrics.averageComplexity > 10) score -= 1;

		// Comment ratio bonus/penalty
		if (metrics.averageCommentRatio < 0.1) score -= 1;
		else if (metrics.averageCommentRatio > 0.2) score += 0.5;

		// Biome issues penalty
		if (analysis.lintResults?.issues?.length > 0) {
			const issueCount = analysis.lintResults.issues.length;
			score -= Math.min(issueCount * 0.5, 3);
		}

		// Task alignment bonus
		if (analysis.taskAlignment?.keywordCoverage > 0.7) score += 0.5;
		else if (analysis.taskAlignment?.keywordCoverage < 0.3) score -= 1;

		return Math.max(1, Math.min(10, Math.round(score * 10) / 10));
	}

	// Helper methods
	shouldAnalyzeFile(filePath) {
		const extensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.md'];
		const excludePaths = ['node_modules/', '.git/', 'dist/', 'build/'];

		return (
			extensions.some((ext) => filePath.endsWith(ext)) &&
			!excludePaths.some((exclude) => filePath.includes(exclude))
		);
	}

	detectLanguage(filePath) {
		const ext = path.extname(filePath).toLowerCase();
		const languageMap = {
			'.js': 'javascript',
			'.jsx': 'javascript',
			'.ts': 'typescript',
			'.tsx': 'typescript',
			'.json': 'json',
			'.md': 'markdown'
		};
		return languageMap[ext] || 'unknown';
	}

	isBiomeSupported(filePath) {
		const supportedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.json'];
		return supportedExtensions.some((ext) => filePath.endsWith(ext));
	}

	calculateAverageLineLength(lines) {
		if (lines.length === 0) return 0;
		const totalLength = lines.reduce((sum, line) => sum + line.length, 0);
		return Math.round(totalLength / lines.length);
	}

	getComplexityLevel(complexity) {
		if (complexity <= 5) return 'low';
		if (complexity <= 10) return 'medium';
		if (complexity <= 20) return 'high';
		return 'very-high';
	}

	extractTaskKeywords(task) {
		const text = `${task.title} ${task.description || ''} ${task.details || ''}`;
		const keywords =
			text
				.toLowerCase()
				.match(/\b\w{3,}\b/g) // Words with 3+ characters
				?.filter((word) => !this.isCommonWord(word))
				?.slice(0, 10) || []; // Limit to top 10 keywords

		return [...new Set(keywords)]; // Remove duplicates
	}

	isCommonWord(word) {
		const commonWords = [
			'the',
			'and',
			'for',
			'are',
			'but',
			'not',
			'you',
			'all',
			'can',
			'had',
			'her',
			'was',
			'one',
			'our',
			'out',
			'day',
			'get',
			'has',
			'him',
			'his',
			'how',
			'man',
			'new',
			'now',
			'old',
			'see',
			'two',
			'way',
			'who',
			'boy',
			'did',
			'its',
			'let',
			'put',
			'say',
			'she',
			'too',
			'use'
		];
		return commonWords.includes(word);
	}

	isFileRelevantToTask(filePath, task) {
		// Simple heuristic - could be enhanced
		const taskKeywords = this.extractTaskKeywords(task);
		const fileName = path
			.basename(filePath, path.extname(filePath))
			.toLowerCase();

		return taskKeywords.some((keyword) => fileName.includes(keyword));
	}

	assessImplementationScope(changes, task) {
		// Assess if the changes seem appropriate for the task scope
		const totalLines = changes.reduce(
			(sum, c) => sum + (c.content?.split('\n').length || 0),
			0
		);

		if (totalLines < 10) return 'minimal';
		if (totalLines < 50) return 'small';
		if (totalLines < 200) return 'medium';
		if (totalLines < 500) return 'large';
		return 'very-large';
	}

	calculateComplexityDistribution(fileAnalyses) {
		const distribution = { low: 0, medium: 0, high: 0, 'very-high': 0 };

		fileAnalyses.forEach((file) => {
			const level = file.metrics.complexity?.complexityLevel || 'low';
			distribution[level]++;
		});

		return distribution;
	}

	parseBiomeResults(biomeOutput) {
		// Parse Biome JSON output
		const issues = [];

		if (biomeOutput.diagnostics) {
			biomeOutput.diagnostics.forEach((diagnostic) => {
				issues.push({
					severity: diagnostic.severity,
					message: diagnostic.description,
					file: diagnostic.location?.path,
					line: diagnostic.location?.span?.start
				});
			});
		}

		return {
			available: true,
			filesChecked: biomeOutput.summary?.files || 0,
			issues,
			errorCount: issues.filter((i) => i.severity === 'error').length,
			warningCount: issues.filter((i) => i.severity === 'warning').length
		};
	}

	async executeCommand(command, cwd) {
		return new Promise((resolve, reject) => {
			// Use shell: true with the full command string (safer than splitting)
			const child = spawn(command, { cwd, shell: true, stdio: ['pipe', 'pipe', 'pipe'] });

			let stdout = '';
			let stderr = '';

			child.stdout?.on('data', (data) => {
				stdout += data;
			});
			child.stderr?.on('data', (data) => {
				stderr += data;
			});

			child.on('close', (code) => {
				resolve({ stdout, stderr, code });
			});

			child.on('error', reject);

			// Timeout after 5 seconds
			setTimeout(() => {
				child.kill();
				reject(new Error('Command timeout'));
			}, 5000);
		});
	}
}
