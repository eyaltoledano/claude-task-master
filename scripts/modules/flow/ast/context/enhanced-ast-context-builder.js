/**
 * Enhanced AST Context Builder - Phase 2.2 Integration
 * 
 * Integrates Phase 2.1 advanced components with Phase 2.2 language-specific analyzers
 * to provide comprehensive, intelligent AST context generation for Claude.
 * 
 * This enhanced version supersedes the basic ast-context-builder.js by providing:
 * - Language-specific deep analysis
 * - Task-aware file selection and prioritization
 * - Multi-dimensional complexity scoring
 * - Advanced dependency mapping
 * - Rich, formatted context output
 * 
 * @author Task Master Flow
 * @version 2.2.0
 */

import { loadASTConfig } from '../../config/ast-config.js';
import { initializeDefaultRegistry } from '../parsers/parser-registry.js';
import { createCacheKey, getCachedOrExecute } from './cache-manager.js';
import { createAnalyzerDispatcher } from '../analyzers/analyzer-dispatcher.js';
import ContextBuilder from './context-builder.js';
import fs from 'fs-extra';
import path from 'path';
import globPkg from 'glob';
const { glob } = globPkg;

/**
 * Enhanced AST Context Builder with Phase 2.1 & 2.2 integration
 */
export class EnhancedASTContextBuilder {
    constructor(projectRoot, options = {}) {
        this.projectRoot = projectRoot;
        this.options = {
            enablePhase21: true,        // Enable Phase 2.1 advanced analysis
            enablePhase22: true,        // Enable Phase 2.2 language-specific analysis
            enableTaskAwareness: true,  // Enable task-aware context building
            enableIntelligentSelection: true, // Enable intelligent file selection
            maxFilesPerContext: 15,     // Maximum files in context
            maxTokensPerContext: 8000,  // Maximum tokens per context
            ...options
        };
        
        this.config = null;
        this.parserRegistry = null;
        this.analyzerDispatcher = null;
        this.contextBuilder = null;
        this.initialized = false;
    }

    /**
     * Initialize the enhanced AST context builder
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // Load AST configuration
            this.config = await loadASTConfig(this.projectRoot);
            
            // Check if AST is enabled
            if (!this.config.enabled) {
                console.debug('[Enhanced AST] AST analysis disabled in configuration');
                this.initialized = true;
                return;
            }

            // Initialize parser registry
            this.parserRegistry = initializeDefaultRegistry();
            
            // Initialize Phase 2.2 analyzer dispatcher
            if (this.options.enablePhase22) {
                this.analyzerDispatcher = createAnalyzerDispatcher({
                    enableLanguageSpecific: true,
                    fallbackToGeneric: true,
                    cacheResults: true
                });
            }

            // Initialize Phase 2.1 intelligent context builder
            if (this.options.enablePhase21) {
                this.contextBuilder = new ContextBuilder({
                    maxTokens: this.options.maxTokensPerContext,
                    maxFiles: this.options.maxFilesPerContext,
                    enableTaskAwareness: this.options.enableTaskAwareness,
                    enableIntelligentSelection: this.options.enableIntelligentSelection
                });
            }
            
            console.debug('[Enhanced AST] Context builder initialized', {
                supportedLanguages: this.config.supportedLanguages,
                phase21Enabled: this.options.enablePhase21,
                phase22Enabled: this.options.enablePhase22,
                taskAwarenessEnabled: this.options.enableTaskAwareness
            });

            this.initialized = true;
        } catch (error) {
            console.warn('[Enhanced AST] Failed to initialize context builder:', error.message);
            this.initialized = true; // Mark as initialized for graceful degradation
        }
    }

    /**
     * Build comprehensive AST context for a worktree with advanced analysis
     * @param {string} worktreePath - Path to the worktree
     * @param {Object} contextOptions - Options for context building
     * @returns {Promise<Object>} Enhanced AST context data
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
            console.debug('[Enhanced AST] Building enhanced worktree context', { 
                worktreePath,
                enablePhase21: this.options.enablePhase21,
                enablePhase22: this.options.enablePhase22
            });

            // Phase 1: File Discovery and Parsing
            const projectFiles = await this.discoverProjectFiles(worktreePath);
            console.debug('[Enhanced AST] Discovered files', { count: projectFiles.length });

            // Phase 2: Enhanced Parsing with Language Detection
            const parseResults = await this.parseFilesWithEnhancedAnalysis(projectFiles, worktreePath, contextOptions);
            
            // Phase 3: Intelligent Context Assembly (Phase 2.1)
            let assembledContext;
            if (this.options.enablePhase21 && this.contextBuilder) {
                assembledContext = await this.contextBuilder.buildIntelligentContext(
                    parseResults,
                    contextOptions.tasks,
                    {
                        worktreePath,
                        projectRoot: this.projectRoot,
                        config: this.config
                    }
                );
            } else {
                // Fallback to basic context assembly
                assembledContext = await this.assembleBasicContext(parseResults, contextOptions);
            }

            const duration = Date.now() - startTime;
            console.debug('[Enhanced AST] Context building completed', { 
                duration: `${duration}ms`,
                filesAnalyzed: projectFiles.length,
                languagesFound: Object.keys(parseResults.byLanguage || {}).length,
                phase: this.options.enablePhase21 ? '2.1' : '1.0'
            });

            return {
                enabled: true,
                success: true,
                context: assembledContext,
                metadata: {
                    filesAnalyzed: projectFiles.length,
                    languagesFound: Object.keys(parseResults.byLanguage || {}),
                    duration,
                    timestamp: new Date().toISOString(),
                    phase: this.options.enablePhase21 ? '2.1+2.2' : 'basic',
                    enhancedFeatures: {
                        intelligentSelection: this.options.enablePhase21,
                        languageSpecificAnalysis: this.options.enablePhase22,
                        taskAwareness: this.options.enableTaskAwareness
                    }
                }
            };

        } catch (error) {
            console.error('[Enhanced AST] Failed to build worktree context:', error.message);
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
     * @returns {Promise<Array>} Array of file objects with enhanced metadata
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
                    
                    // Skip very large files (>2MB for enhanced analysis)
                    if (stats.size > 2 * 1024 * 1024) {
                        console.debug('[Enhanced AST] Skipping large file:', filePath);
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
                            modified: stats.mtime,
                            // Enhanced metadata
                            isTestFile: this.isTestFile(filePath),
                            isConfigFile: this.isConfigFile(filePath),
                            estimatedComplexity: this.estimateFileComplexity(stats.size, language),
                            priority: this.calculateFilePriority(filePath, language)
                        });
                    }
                }
            }

            return files;
        } catch (error) {
            console.warn('[Enhanced AST] Error discovering project files:', error.message);
            return [];
        }
    }

    /**
     * Parse files with enhanced analysis (Phase 2.1 + 2.2)
     * @param {Array} projectFiles - Array of file objects
     * @param {string} worktreePath - Base path for caching
     * @param {Object} contextOptions - Context options
     * @returns {Promise<Object>} Enhanced parse results
     */
    async parseFilesWithEnhancedAnalysis(projectFiles, worktreePath, contextOptions) {
        const results = {
            byLanguage: {},
            byFile: {},
            summary: {
                totalFiles: projectFiles.length,
                successfulParses: 0,
                failedParses: 0,
                languageDistribution: {},
                complexityDistribution: { low: 0, medium: 0, high: 0 }
            }
        };

        // Group files by language for efficient processing
        const filesByLanguage = projectFiles.reduce((acc, file) => {
            if (!acc[file.language]) acc[file.language] = [];
            acc[file.language].push(file);
            return acc;
        }, {});

        // Process each language group
        for (const [language, files] of Object.entries(filesByLanguage)) {
            console.debug(`[Enhanced AST] Processing ${files.length} ${language} files`);
            
            results.byLanguage[language] = await this.parseLanguageFilesEnhanced(
                language, 
                files, 
                worktreePath,
                contextOptions
            );

            // Update summary
            results.summary.languageDistribution[language] = files.length;
        }

        // Process results by file for easier access
        Object.values(results.byLanguage).forEach(languageResults => {
            languageResults.forEach(result => {
                if (result.success) {
                    results.byFile[result.file.path] = result;
                    results.summary.successfulParses++;

                    // Update complexity distribution
                    const complexity = result.analysis?.complexity?.overall?.average || 0;
                    if (complexity <= 3) results.summary.complexityDistribution.low++;
                    else if (complexity <= 7) results.summary.complexityDistribution.medium++;
                    else results.summary.complexityDistribution.high++;
                } else {
                    results.summary.failedParses++;
                }
            });
        });

        return results;
    }

    /**
     * Parse files for a specific language with enhanced analysis
     * @param {string} language - Language identifier
     * @param {Array} files - Files to parse
     * @param {string} worktreePath - Base path
     * @param {Object} contextOptions - Context options
     * @returns {Promise<Array>} Enhanced parse results
     */
    async parseLanguageFilesEnhanced(language, files, worktreePath, contextOptions) {
        const results = [];
        
        for (const file of files) {
            try {
                // Generate cache key
                const cacheKey = await createCacheKey(file.fullPath, language, worktreePath);
                
                // Try to get cached result or execute parsing
                const parseResult = await getCachedOrExecute(
                    cacheKey,
                    async () => {
                        console.debug(`[Enhanced AST] Parsing ${language} file:`, file.path);
                        
                        // Basic AST parsing
                        const astResult = await this.parserRegistry.parseFile(file.fullPath);
                        if (!astResult.success) {
                            return astResult;
                        }

                        // Read file content for enhanced analysis
                        const content = await fs.readFile(file.fullPath, 'utf-8');

                        // Phase 2.2: Language-specific analysis
                        let enhancedAnalysis = null;
                        if (this.options.enablePhase22 && this.analyzerDispatcher) {
                            try {
                                enhancedAnalysis = await this.analyzerDispatcher.analyzeCode(
                                    astResult.ast,
                                    file.fullPath,
                                    content,
                                    language
                                );
                            } catch (analysisError) {
                                console.warn(`[Enhanced AST] Analysis failed for ${file.path}:`, analysisError.message);
                            }
                        }

                        return {
                            success: true,
                            ast: astResult.ast,
                            analysis: enhancedAnalysis,
                            content: content.length > 10000 ? content.substring(0, 10000) + '...' : content
                        };
                    },
                    {
                        maxAge: this.config.cacheMaxAge,
                        language,
                        filePath: file.path
                    }
                );

                if (parseResult.success) {
                    results.push({
                        file,
                        ast: parseResult.ast,
                        analysis: parseResult.analysis,
                        content: parseResult.content,
                        fromCache: parseResult.fromCache || false,
                        language,
                        success: true
                    });
                } else {
                    console.warn(`[Enhanced AST] Failed to parse ${file.path}:`, parseResult.error);
                    results.push({
                        file,
                        error: parseResult.error,
                        language,
                        success: false
                    });
                }

            } catch (error) {
                console.warn(`[Enhanced AST] Error processing ${file.path}:`, error.message);
                results.push({
                    file,
                    error: error.message,
                    language,
                    success: false
                });
            }
        }

        return results;
    }

    /**
     * Assemble basic context (fallback when Phase 2.1 is disabled)
     * @param {Object} parseResults - Parse results
     * @param {Object} contextOptions - Context options
     * @returns {Promise<Object>} Basic context
     */
    async assembleBasicContext(parseResults, contextOptions) {
        const context = {
            summary: parseResults.summary,
            languageBreakdown: parseResults.byLanguage,
            fileCount: parseResults.summary.totalFiles,
            successRate: parseResults.summary.totalFiles > 0 ? 
                (parseResults.summary.successfulParses / parseResults.summary.totalFiles) * 100 : 0
        };

        // Include basic file information
        context.files = Object.values(parseResults.byFile).map(result => ({
            path: result.file.path,
            language: result.language,
            size: result.file.size,
            complexity: result.analysis?.complexity?.overall?.average || 'unknown',
            hasAnalysis: !!result.analysis
        }));

        return context;
    }

    /**
     * Check if file is a test file
     * @param {string} filePath - File path
     * @returns {boolean} True if test file
     */
    isTestFile(filePath) {
        return /test|spec|__tests__|\.test\.|\.spec\.|_test\.|_spec\./i.test(filePath);
    }

    /**
     * Check if file is a configuration file
     * @param {string} filePath - File path
     * @returns {boolean} True if config file
     */
    isConfigFile(filePath) {
        return /config|settings|\.env|package\.json|tsconfig|webpack|babel/i.test(filePath);
    }

    /**
     * Estimate file complexity based on size and language
     * @param {number} size - File size in bytes
     * @param {string} language - Programming language
     * @returns {string} Complexity estimate
     */
    estimateFileComplexity(size, language) {
        // Language-specific complexity factors
        const complexityFactors = {
            javascript: 1.0,
            typescript: 1.2,
            python: 0.9,
            go: 0.8
        };

        const factor = complexityFactors[language] || 1.0;
        const adjustedSize = size * factor;

        if (adjustedSize < 5000) return 'low';
        if (adjustedSize < 20000) return 'medium';
        return 'high';
    }

    /**
     * Calculate file priority for analysis
     * @param {string} filePath - File path
     * @param {string} language - Programming language
     * @returns {number} Priority score (higher = more important)
     */
    calculateFilePriority(filePath, language) {
        let priority = 5; // Base priority

        // Boost priority for main files
        if (/main|index|app|server/i.test(filePath)) priority += 3;
        
        // Boost priority for core business logic
        if (/service|controller|handler|manager/i.test(filePath)) priority += 2;
        
        // Boost priority for models and data
        if (/model|entity|schema/i.test(filePath)) priority += 2;
        
        // Lower priority for tests and configs
        if (this.isTestFile(filePath)) priority -= 1;
        if (this.isConfigFile(filePath)) priority -= 1;

        // Language-specific adjustments
        if (language === 'typescript') priority += 1; // TypeScript often has better structure
        if (language === 'python') priority += 0.5; // Python is often well-structured

        return Math.max(1, priority);
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
     * Check if enhanced AST analysis is available
     * @returns {boolean} True if enhanced analysis can be used
     */
    isEnhancedAnalysisAvailable() {
        return this.initialized && 
               this.config && 
               this.config.enabled && 
               this.parserRegistry &&
               (this.options.enablePhase21 || this.options.enablePhase22);
    }

    /**
     * Get analysis statistics
     * @returns {Object} Analysis statistics
     */
    getStatistics() {
        const stats = {
            initialized: this.initialized,
            enabled: this.config?.enabled,
            phase21Enabled: this.options.enablePhase21,
            phase22Enabled: this.options.enablePhase22,
            supportedLanguages: this.config?.supportedLanguages || []
        };

        if (this.analyzerDispatcher) {
            stats.analyzerStats = this.analyzerDispatcher.getStatistics();
        }

        return stats;
    }
}

/**
 * Create enhanced AST context builder
 * @param {string} projectRoot - Project root directory
 * @param {Object} options - Builder options
 * @returns {EnhancedASTContextBuilder} Enhanced builder instance
 */
export function createEnhancedASTContextBuilder(projectRoot, options = {}) {
    return new EnhancedASTContextBuilder(projectRoot, options);
}

export default EnhancedASTContextBuilder;
