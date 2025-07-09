import { loadASTConfig } from '../src/config/ast-config.js';
import { initializeDefaultRegistry } from '../parsers/parser-registry.js';
import { createCacheKey, getCachedOrExecute } from './cache-manager.js';
import { scoreCodeRelevance } from './code-relevance-scorer.js';
import { formatASTContext } from './context-formatter.js';
import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';

/**
 * AST Context Builder - Core engine for generating AST-powered context for Claude
 */
export class ASTContextBuilder {
	constructor(projectRoot, options = {}) {
		this.projectRoot = projectRoot;
		this.options = options;
		this.config = null;
		this.parserRegistry = null;
		this.initialized = false;
	}

	/**
	 * Initialize the AST context builder
	 */
	async initialize() {
		if (this.initialized) return;

		try {
			// Load AST configuration
			const configResult = await loadASTConfig(this.projectRoot);
			this.config = configResult.config;

			// Check if AST is enabled
			if (!this.config.enabled) {
				console.debug('[AST] AST analysis disabled in configuration');
				this.initialized = true;
				return;
			}

			// Initialize parser registry
			this.parserRegistry = initializeDefaultRegistry();

			console.debug('[AST] Context builder initialized', {
				supportedLanguages: this.config.supportedLanguages,
				cacheEnabled: this.config.cacheMaxAge !== 'disabled'
			});

			this.initialized = true;
		} catch (error) {
			console.warn(
				'[AST] Failed to initialize context builder:',
				error.message
			);
			this.initialized = true; // Mark as initialized even on failure for graceful degradation
		}
	}

	/**
	 * Build comprehensive AST context for a worktree
	 * @param {string} worktreePath - Path to the worktree
	 * @param {Object} contextOptions - Options for context building
	 * @returns {Promise<Object>} AST context data
	 */
	async buildWorktreeContext(worktreePath, contextOptions = {}) {
		await this.initialize();

		// Return empty context if AST is disabled
		if (!this.config || !this.config.enabled) {
			return {
				enabled: false,
				reason: 'AST analysis disabled in configuration'
			};
		}

		const startTime = Date.now();

		try {
			console.debug('[AST] Building worktree context', { worktreePath });

			// Get all relevant files in the worktree
			const projectFiles = await this.discoverProjectFiles(worktreePath);
			console.debug('[AST] Discovered files', { count: projectFiles.length });

			// Parse files by language
			const parseResults = await this.parseFilesByLanguage(
				projectFiles,
				worktreePath
			);

			// Score relevance if tasks provided
			let relevanceScores = {};
			if (contextOptions.tasks && contextOptions.tasks.length > 0) {
				relevanceScores = await this.scoreFilesRelevance(
					parseResults,
					contextOptions.tasks
				);
			}

			// Filter results based on configuration and relevance
			const filteredResults = this.filterResultsByRelevance(
				parseResults,
				relevanceScores
			);

			// Format for Claude context
			const formattedContext = await formatASTContext(filteredResults, {
				...contextOptions,
				config: this.config
			});

			const duration = Date.now() - startTime;
			console.debug('[AST] Context building completed', {
				duration: `${duration}ms`,
				filesAnalyzed: projectFiles.length,
				languagesFound: Object.keys(parseResults).length
			});

			return {
				enabled: true,
				success: true,
				context: formattedContext,
				metadata: {
					filesAnalyzed: projectFiles.length,
					languagesFound: Object.keys(parseResults),
					duration,
					timestamp: new Date().toISOString()
				}
			};
		} catch (error) {
			console.error('[AST] Failed to build worktree context:', error.message);
			return {
				enabled: true,
				success: false,
				error: error.message,
				context: null
			};
		}
	}

	/**
	 * Discover all relevant project files in the worktree
	 * @param {string} worktreePath - Path to search
	 * @returns {Promise<Array>} Array of file objects with path and language
	 */
	async discoverProjectFiles(worktreePath) {
		const files = [];

		// Get supported extensions from config
		const supportedExtensions = this.getSupportedExtensions();
		const excludePatterns = this.config.excludePatterns || [];

		try {
			// Create glob pattern for supported extensions
			const extensionPattern = `**/*{${supportedExtensions.join(',')}}`;

			// Find files matching extensions
			const foundFiles = await glob(extensionPattern, {
				cwd: worktreePath,
				ignore: excludePatterns,
				absolute: false
			});

			for (const filePath of foundFiles) {
				const fullPath = path.join(worktreePath, filePath);

				// Check if file exists and is readable
				if (await fs.pathExists(fullPath)) {
					const stats = await fs.stat(fullPath);

					// Skip very large files (>1MB)
					if (stats.size > 1024 * 1024) {
						console.debug('[AST] Skipping large file:', filePath);
						continue;
					}

					// Detect language
					const language = this.parserRegistry.detectLanguage(fullPath);

					if (language && this.config.supportedLanguages.includes(language)) {
						files.push({
							path: filePath,
							fullPath,
							language,
							size: stats.size,
							modified: stats.mtime
						});
					}
				}
			}

			return files;
		} catch (error) {
			console.warn('[AST] Error discovering project files:', error.message);
			return [];
		}
	}

	/**
	 * Parse files grouped by language
	 * @param {Array} projectFiles - Array of file objects
	 * @param {string} worktreePath - Base path for caching
	 * @returns {Promise<Object>} Results grouped by language
	 */
	async parseFilesByLanguage(projectFiles, worktreePath) {
		const resultsByLanguage = {};

		// Group files by language
		const filesByLanguage = projectFiles.reduce((acc, file) => {
			if (!acc[file.language]) acc[file.language] = [];
			acc[file.language].push(file);
			return acc;
		}, {});

		// Parse each language group
		for (const [language, files] of Object.entries(filesByLanguage)) {
			console.debug(`[AST] Parsing ${files.length} ${language} files`);

			resultsByLanguage[language] = await this.parseLanguageFiles(
				language,
				files,
				worktreePath
			);
		}

		return resultsByLanguage;
	}

	/**
	 * Parse files for a specific language
	 * @param {string} language - Language identifier
	 * @param {Array} files - Files to parse
	 * @param {string} worktreePath - Base path
	 * @returns {Promise<Array>} Parse results
	 */
	async parseLanguageFiles(language, files, worktreePath) {
		const results = [];

		for (const file of files) {
			try {
				// Generate cache key
				const cacheKey = await createCacheKey(
					file.fullPath,
					language,
					worktreePath
				);

				// Try to get cached result or execute parsing
				const parseResult = await getCachedOrExecute(
					cacheKey,
					async () => {
						console.debug(`[AST] Parsing ${language} file:`, file.path);
						// Read file content first
						const content = await fs.readFile(file.fullPath, 'utf-8');
						return await this.parserRegistry.parseFile(file.fullPath, content);
					},
					{
						maxAge: this.config.cacheMaxAge,
						language,
						filePath: file.path,
						projectRoot: worktreePath // Pass the correct project root
					}
				);

				if (parseResult.success) {
					results.push({
						file,
						ast: parseResult.ast,
						fromCache: parseResult.fromCache || false,
						language
					});
				} else {
					console.warn(
						`[AST] Failed to parse ${file.path}:`,
						parseResult.error
					);
				}
			} catch (error) {
				console.warn(`[AST] Error parsing ${file.path}:`, error.message);
			}
		}

		return results;
	}

	/**
	 * Score file relevance to tasks
	 * @param {Object} parseResults - Results grouped by language
	 * @param {Array} tasks - Task objects
	 * @returns {Promise<Object>} Relevance scores by file path
	 */
	async scoreFilesRelevance(parseResults, tasks) {
		const scores = {};

		try {
			for (const [language, results] of Object.entries(parseResults)) {
				for (const result of results) {
					const score = await scoreCodeRelevance(result, tasks, {
						language,
						config: this.config
					});
					scores[result.file.path] = score;
				}
			}
		} catch (error) {
			console.warn('[AST] Error scoring file relevance:', error.message);
		}

		return scores;
	}

	/**
	 * Filter results based on relevance and configuration limits
	 * @param {Object} parseResults - Results by language
	 * @param {Object} relevanceScores - Relevance scores by file
	 * @returns {Object} Filtered results
	 */
	filterResultsByRelevance(parseResults, relevanceScores) {
		const contextInclusion = this.config.contextInclusion || {};
		const maxFunctions = contextInclusion.maxFunctions || 10;
		const maxComplexityScore = contextInclusion.maxComplexityScore || 8;

		const filtered = {};

		for (const [language, results] of Object.entries(parseResults)) {
			filtered[language] = results
				.filter((result) => {
					// Check complexity limits
					if (result.ast.complexity > maxComplexityScore) {
						return false;
					}

					// Check relevance if scored
					const filePath = result.file.path;
					if (
						relevanceScores[filePath] !== undefined &&
						relevanceScores[filePath] < 0.3
					) {
						return false;
					}

					return true;
				})
				.slice(0, maxFunctions); // Limit total functions per language
		}

		return filtered;
	}

	/**
	 * Get supported file extensions from configuration
	 * @returns {Array} Array of file extensions
	 */
	getSupportedExtensions() {
		const extensions = [];

		for (const language of this.config.supportedLanguages) {
			switch (language) {
				case 'javascript':
				case 'typescript':
					extensions.push('.js', '.jsx', '.ts', '.tsx', '.mjs');
					break;
				case 'python':
					extensions.push('.py', '.pyw', '.pyi');
					break;
				case 'go':
					extensions.push('.go');
					break;
			}
		}

		return extensions;
	}

	/**
	 * Check if AST analysis is available
	 * @returns {boolean} True if AST can be used
	 */
	isAvailable() {
		return (
			this.initialized &&
			this.config &&
			this.config.enabled &&
			this.parserRegistry
		);
	}
}

/**
 * Create an AST context builder for a project
 * @param {string} projectRoot - Project root directory
 * @param {Object} options - Builder options
 * @returns {ASTContextBuilder} Configured builder instance
 */
export function createASTContextBuilder(projectRoot, options = {}) {
	return new ASTContextBuilder(projectRoot, options);
}
