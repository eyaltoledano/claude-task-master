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
import { createRequire } from 'module';
import { EventEmitter } from 'events';
const { glob } = globPkg;

const require = createRequire(import.meta.url);

// Import Phase 3.1 file watching components
let WatchManager;
try {
    const watchModule = await import('../watchers/watch-manager.js');
    WatchManager = watchModule.WatchManager;
} catch (error) {
    console.warn('Phase 3.1 file watching not available, using fallback mode');
}

// Import Phase 3.2 smart invalidation components
let DependencyTracker;
let SelectiveInvalidation;
let BatchInvalidation;
try {
    const invalidationModule = await import('../cache/index.js');
    DependencyTracker = invalidationModule.DependencyTracker;
    SelectiveInvalidation = invalidationModule.SelectiveInvalidation;
    BatchInvalidation = invalidationModule.BatchInvalidation;
} catch (error) {
    console.warn('Phase 3.2 smart invalidation not available, using basic invalidation');
}

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
     * Generate enhanced context for task data (main interface for real-time integration)
     */
    async generateEnhancedContext(taskData, options = {}) {
        try {
            // Use buildWorktreeContext as the base implementation
            const worktreePath = options.projectPath || this.projectRoot || process.cwd();
            
            const contextOptions = {
                ...options,
                includeTests: options.includeTests !== false,
                includeConfig: options.includeConfig !== false,
                maxDepth: options.maxDepth || 3
            };

            const context = await this.buildWorktreeContext(worktreePath, contextOptions);
            
            // Add task-specific information
            return {
                ...context,
                taskId: taskData.id,
                taskTitle: taskData.title,
                taskDescription: taskData.description,
                generatedAt: new Date().toISOString(),
                contextType: 'enhanced',
                realTimeMode: options.realTimeMode || false,
                fallbackMode: options.fallbackMode || false
            };

        } catch (error) {
            console.error('Error generating enhanced context:', error);
            throw error;
        }
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

/**
 * Enhanced AST Context Builder with Real-Time File Watching Integration (Phase 3.3)
 * 
 * Integrates with Phase 3.1 Universal File Watching System to provide real-time context updates.
 * Uses research-backed debouncing, preemptive analysis, and reactive switchboard patterns.
 * 
 * Key Features:
 * - Trailing-edge debouncing (500ms optimal window)
 * - Preemptive file analysis during idle periods
 * - Intelligent context invalidation
 * - Graceful fallback when real-time fails
 */

/**
 * Real-time change event processor with research-backed debouncing
 */
class ChangeEventProcessor {
    constructor(contextBuilder, options = {}) {
        this.contextBuilder = contextBuilder;
        this.debounceWindow = options.debounceWindow || 500; // Research optimal: 300-700ms
        this.rapidChangeThreshold = options.rapidChangeThreshold || 5; // changes/second
        this.maxConcurrentAnalysis = options.maxConcurrentAnalysis || 3;
        
        // State management
        this.pendingChanges = new Map();
        this.processingTimer = null;
        this.isProcessingBatch = false;
        this.changeRate = [];
        this.contextVersions = new Map();
        
        // Performance metrics
        this.metrics = {
            changesProcessed: 0,
            batchesProcessed: 0,
            debounceHits: 0,
            averageProcessingTime: 0
        };
    }

    /**
     * Process incoming file change with trailing-edge debouncing
     */
    async processFileChange(changeEvent) {
        const now = Date.now();
        this.changeRate.push(now);
        
        // Keep only recent changes for rate calculation
        this.changeRate = this.changeRate.filter(time => now - time < 1000);
        
        // Store pending change
        this.pendingChanges.set(changeEvent.path, {
            ...changeEvent,
            timestamp: now
        });

        // Schedule debounced processing
        this.scheduleProcessing();
        
        this.metrics.changesProcessed++;
    }

    /**
     * Schedule processing with intelligent debouncing
     */
    scheduleProcessing() {
        clearTimeout(this.processingTimer);
        
        // Calculate dynamic debounce window based on change rate
        const currentRate = this.changeRate.length;
        let debounceDelay = this.debounceWindow;
        
        if (currentRate > this.rapidChangeThreshold) {
            // Extend debounce during rapid changes (rapid typing)
            debounceDelay = Math.min(2000, this.debounceWindow * 2);
            this.metrics.debounceHits++;
        }

        this.processingTimer = setTimeout(() => {
            this.processBatchedChanges();
        }, debounceDelay);
    }

    /**
     * Process batched changes efficiently
     */
    async processBatchedChanges() {
        if (this.isProcessingBatch || this.pendingChanges.size === 0) {
            return;
        }

        this.isProcessingBatch = true;
        const startTime = Date.now();

        try {
            const changes = Array.from(this.pendingChanges.values());
            this.pendingChanges.clear();

            // Group changes by impact type
            const changeGroups = this.categorizeChanges(changes);
            
            // Process each group with appropriate strategy
            await this.processChangeGroups(changeGroups);
            
            this.metrics.batchesProcessed++;
            
        } catch (error) {
            console.error('Error processing batched changes:', error);
            // Fallback: clear pending changes to prevent infinite retry
            this.pendingChanges.clear();
        } finally {
            this.isProcessingBatch = false;
            
            // Update performance metrics
            const processingTime = Date.now() - startTime;
            this.metrics.averageProcessingTime = 
                (this.metrics.averageProcessingTime + processingTime) / 2;
        }
    }

    /**
     * Categorize changes by their impact on context
     */
    categorizeChanges(changes) {
        const groups = {
            critical: [], // Config changes requiring full rebuild
            high: [],     // Core code files affecting multiple contexts
            medium: [],   // Individual file changes
            low: []       // Documentation, comments only
        };

        for (const change of changes) {
            if (this.isCriticalChange(change)) {
                groups.critical.push(change);
            } else if (this.isHighImpactChange(change)) {
                groups.high.push(change);
            } else if (this.isMediumImpactChange(change)) {
                groups.medium.push(change);
            } else {
                groups.low.push(change);
            }
        }

        return groups;
    }

    /**
     * Check if change requires full context rebuild
     */
    isCriticalChange(change) {
        return change.path.includes('package.json') ||
               change.path.includes('.taskmaster/flow-config.json') ||
               change.path.includes('tsconfig.json') ||
               change.path.includes('.eslintrc');
    }

    /**
     * Check if change has high impact (affects multiple contexts)
     */
    isHighImpactChange(change) {
        // Core library files, shared utilities
        return change.path.includes('/src/lib/') ||
               change.path.includes('/src/utils/') ||
               change.path.includes('/src/types/') ||
               change.path.includes('index.js') ||
               change.path.includes('index.ts');
    }

    /**
     * Check if change has medium impact (single file)
     */
    isMediumImpactChange(change) {
        const ext = path.extname(change.path);
        return ['.js', '.ts', '.jsx', '.tsx', '.py', '.go'].includes(ext);
    }

    /**
     * Process change groups with appropriate strategies
     */
    async processChangeGroups(changeGroups) {
        // Critical changes: full context invalidation
        if (changeGroups.critical.length > 0) {
            await this.handleCriticalChanges(changeGroups.critical);
            return; // Skip other processing
        }

        // High impact: invalidate multiple contexts
        if (changeGroups.high.length > 0) {
            await this.handleHighImpactChanges(changeGroups.high);
        }

        // Medium impact: selective context updates
        if (changeGroups.medium.length > 0) {
            await this.handleMediumImpactChanges(changeGroups.medium);
        }

        // Low impact: minimal processing
        if (changeGroups.low.length > 0) {
            await this.handleLowImpactChanges(changeGroups.low);
        }
    }

    /**
     * Handle critical changes requiring full context rebuild
     */
    async handleCriticalChanges(changes) {
        console.log(`Processing ${changes.length} critical changes, full context rebuild required`);
        
        // Update metrics for critical changes
        this.metrics.changesProcessed += changes.length;
        this.metrics.batchesProcessed += 1;
        
        // Clear all cached contexts
        this.contextVersions.clear();
        
        // Notify context builder of critical changes
        if (this.contextBuilder.handleCriticalChanges) {
            await this.contextBuilder.handleCriticalChanges(changes);
        }
    }

    /**
     * Handle high impact changes affecting multiple contexts
     */
    async handleHighImpactChanges(changes) {
        console.log(`Processing ${changes.length} high impact changes`);
        
        // Update metrics for high impact changes
        this.metrics.changesProcessed += changes.length;
        
        // Use smart invalidation if available
        if (this.smartInvalidationManager) {
            try {
                const invalidationResult = await this.smartInvalidationManager.invalidateContext(changes, {
                    priority: 'high',
                    strategy: 'CONSERVATIVE'
                });
                
                console.log(`Smart invalidation processed ${invalidationResult.processedFiles.length} files, ` +
                           `invalidated ${invalidationResult.invalidatedContexts.length} contexts`);
                return;
            } catch (error) {
                console.error('Smart invalidation failed for high impact changes:', error);
            }
        }
        
        // Fallback to basic invalidation
        const affectedContexts = await this.findAffectedContexts(changes);
        for (const contextId of affectedContexts) {
            this.invalidateContext(contextId);
        }
    }

    /**
     * Handle medium impact changes (single files)
     */
    async handleMediumImpactChanges(changes) {
        console.log(`Processing ${changes.length} medium impact changes`);
        
        // Update metrics for medium impact changes
        this.metrics.changesProcessed += changes.length;
        
        // Use smart invalidation for better performance
        if (this.smartInvalidationManager) {
            try {
                const invalidationResult = await this.smartInvalidationManager.invalidateContext(changes, {
                    priority: 'normal',
                    strategy: 'BALANCED'
                });
                
                console.log(`Smart invalidation processed ${invalidationResult.processedFiles.length} files`);
                return;
            } catch (error) {
                console.error('Smart invalidation failed for medium impact changes:', error);
            }
        }
        
        // Fallback to batch processing
        const batches = this.createBatches(changes, this.maxConcurrentAnalysis);
        for (const batch of batches) {
            await Promise.all(batch.map(change => this.processSingleFileChange(change)));
        }
    }

    /**
     * Handle low impact changes (documentation, etc.)
     */
    async handleLowImpactChanges(changes) {
        // Minimal processing for low impact changes
        console.log(`Deferring ${changes.length} low impact changes`);
    }

    /**
     * Process a single file change
     */
    async processSingleFileChange(change) {
        try {
            // Check if file affects any active contexts
            const affectedContexts = await this.findAffectedContexts([change]);
            
            if (affectedContexts.length > 0) {
                // Queue for preemptive analysis
                await this.queuePreemptiveAnalysis(change.path, affectedContexts);
            }
            
        } catch (error) {
            console.error(`Error processing single file change ${change.path}:`, error);
        }
    }

    /**
     * Find contexts affected by changes using smart invalidation
     */
    async findAffectedContexts(changes) {
        // Use smart invalidation manager if available
        if (this.smartInvalidationManager && this.smartInvalidationManager.isSmartInvalidationAvailable()) {
            try {
                const dependencyAnalysis = await this.smartInvalidationManager.analyzeDependencies(changes);
                return Array.from(dependencyAnalysis.affectedContexts);
            } catch (error) {
                console.error('Smart context analysis failed, using fallback:', error);
            }
        }
        
        // Fallback to simple implementation
        const affectedContexts = new Set();
        
        for (const change of changes) {
            const contexts = await this.getAllActiveContexts();
            contexts.forEach(ctx => affectedContexts.add(ctx));
        }
        
        return Array.from(affectedContexts);
    }

    /**
     * Get all currently active contexts
     */
    async getAllActiveContexts() {
        // Return context IDs that are currently being used
        return Array.from(this.contextVersions.keys());
    }

    /**
     * Invalidate a specific context
     */
    invalidateContext(contextId) {
        const currentVersion = this.contextVersions.get(contextId) || 0;
        this.contextVersions.set(contextId, currentVersion + 1);
        
        // Notify subscribers of context invalidation
        this.notifyContextInvalidation(contextId, currentVersion + 1);
    }

    /**
     * Notify subscribers of context invalidation
     */
    notifyContextInvalidation(contextId, newVersion) {
        // Emit event for context invalidation
        if (this.contextBuilder.emit) {
            this.contextBuilder.emit('contextInvalidated', { contextId, version: newVersion });
        }
    }

    /**
     * Queue preemptive analysis for background processing
     */
    async queuePreemptiveAnalysis(filePath, affectedContexts) {
        // Will be implemented with preemptive analyzer
        console.log(`Queuing preemptive analysis for ${filePath}, affects ${affectedContexts.length} contexts`);
    }

    /**
     * Create batches for parallel processing
     */
    createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }

    /**
     * Get processing metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            pendingChanges: this.pendingChanges.size,
            isProcessing: this.isProcessingBatch,
            currentChangeRate: this.changeRate.length
        };
    }
}

/**
 * Preemptive file analyzer for background processing
 */
class PreemptiveAnalyzer {
    constructor(contextBuilder, options = {}) {
        this.contextBuilder = contextBuilder;
        this.maxConcurrentAnalysis = options.maxConcurrentAnalysis || 2;
        this.idleThreshold = options.idleThreshold || 100; // ms
        
        // Analysis queue with priority
        this.analysisQueue = [];
        this.isProcessing = false;
        this.analysisResults = new Map();
        
        // Performance tracking
        this.metrics = {
            analysisCompleted: 0,
            cacheHits: 0,
            averageAnalysisTime: 0
        };
    }

    /**
     * Queue file for preemptive analysis
     */
    async queuePreemptiveAnalysis(filePath, priority = 'normal', affectedContexts = []) {
        const analysisTask = {
            filePath,
            priority,
            affectedContexts,
            timestamp: Date.now(),
            id: `${filePath}-${Date.now()}`
        };

        this.analysisQueue.push(analysisTask);
        
        // Sort by priority (high -> normal -> low)
        this.analysisQueue.sort((a, b) => {
            const priorityOrder = { high: 3, normal: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });

        // Process queue when system is idle
        this.scheduleIdleProcessing();
    }

    /**
     * Schedule processing during system idle time
     */
    scheduleIdleProcessing() {
        if (this.isProcessing || this.analysisQueue.length === 0) {
            return;
        }

        // Use setTimeout to defer to next event loop iteration
        setTimeout(() => {
            this.processQueueWhenIdle();
        }, this.idleThreshold);
    }

    /**
     * Process analysis queue during idle periods
     */
    async processQueueWhenIdle() {
        if (this.isProcessing || this.analysisQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        try {
            // Process up to maxConcurrentAnalysis items
            const batch = this.analysisQueue.splice(0, this.maxConcurrentAnalysis);
            
            if (batch.length > 0) {
                await Promise.all(batch.map(task => this.analyzeFile(task)));
            }

        } catch (error) {
            console.error('Error in preemptive analysis:', error);
        } finally {
            this.isProcessing = false;
            
            // Schedule next batch if more items in queue
            if (this.analysisQueue.length > 0) {
                this.scheduleIdleProcessing();
            }
        }
    }

    /**
     * Analyze a single file preemptively
     */
    async analyzeFile(analysisTask) {
        const startTime = Date.now();
        
        try {
            const { filePath, affectedContexts } = analysisTask;
            
            // Check if we already have recent analysis
            const cached = this.analysisResults.get(filePath);
            if (cached && this.isCacheValid(cached)) {
                this.metrics.cacheHits++;
                return cached;
            }

            // Perform analysis
            const analysisResult = await this.performFileAnalysis(filePath, affectedContexts);
            
            // Cache result
            this.analysisResults.set(filePath, {
                ...analysisResult,
                timestamp: Date.now(),
                filePath
            });

            this.metrics.analysisCompleted++;
            
            return analysisResult;

        } catch (error) {
            console.error(`Error analyzing file ${analysisTask.filePath}:`, error);
            return null;
        } finally {
            const analysisTime = Date.now() - startTime;
            this.metrics.averageAnalysisTime = 
                (this.metrics.averageAnalysisTime + analysisTime) / 2;
        }
    }

    /**
     * Perform actual file analysis
     */
    async performFileAnalysis(filePath, affectedContexts) {
        // Use existing AST context builder for analysis
        if (!this.contextBuilder.analyzeCodeFile) {
            return null;
        }

        const analysisResult = await this.contextBuilder.analyzeCodeFile(filePath, {
            includeComplexity: true,
            includeDependencies: true,
            affectedContexts
        });

        return {
            ...analysisResult,
            preemptive: true,
            affectedContexts
        };
    }

    /**
     * Check if cached analysis is still valid
     */
    isCacheValid(cachedResult, maxAge = 30000) { // 30 seconds default
        return Date.now() - cachedResult.timestamp < maxAge;
    }

    /**
     * Get preemptively analyzed result
     */
    getPreanalyzedResult(filePath) {
        const cached = this.analysisResults.get(filePath);
        return cached && this.isCacheValid(cached) ? cached : null;
    }

    /**
     * Clear analysis cache
     */
    clearCache(filePath = null) {
        if (filePath) {
            this.analysisResults.delete(filePath);
        } else {
            this.analysisResults.clear();
        }
    }

    /**
     * Get analyzer metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            queueLength: this.analysisQueue.length,
            isProcessing: this.isProcessing,
            cacheSize: this.analysisResults.size
        };
    }
}

/**
 * Enhanced AST Context Builder with real-time integration
 */
class RealTimeASTContextBuilder extends EnhancedASTContextBuilder {
    constructor(options = {}) {
        super(options);
        
        // Add EventEmitter functionality
        this.eventEmitter = new EventEmitter();
        
        // Real-time components
        this.smartInvalidationManager = new SmartInvalidationManager(this, options);
        this.changeProcessor = new ChangeEventProcessor(this, options);
        this.preemptiveAnalyzer = new PreemptiveAnalyzer(this, options);
        this.watchManager = null;
        this.realTimeEnabled = options.realTimeEnabled !== false;
        this.fallbackMode = false;
        
        // Connect smart invalidation with change processor
        this.changeProcessor.smartInvalidationManager = this.smartInvalidationManager;
        
        // Initialize file watching integration
        this.initializeFileWatching();
    }

    // EventEmitter methods delegation
    emit(...args) {
        return this.eventEmitter.emit(...args);
    }

    on(...args) {
        return this.eventEmitter.on(...args);
    }

    once(...args) {
        return this.eventEmitter.once(...args);
    }

    off(...args) {
        return this.eventEmitter.off(...args);
    }

    /**
     * Initialize file watching integration with Phase 3.1
     */
    async initializeFileWatching() {
        if (!this.realTimeEnabled) {
            console.log('Real-time AST context updates disabled');
            return;
        }

        try {
            // Try to initialize Phase 3.1 file watching
            if (WatchManager) {
                this.watchManager = new WatchManager({
                    enableGitIntegration: false, // Safe default
                    throttleConfig: {
                        strategy: 'balanced',
                        windowMs: 500
                    }
                });

                // Subscribe to file change events
                this.watchManager.on('change', (changeEvent) => {
                    this.changeProcessor.processFileChange(changeEvent);
                });

                console.log('Real-time AST context updates enabled with Phase 3.1 integration');
            } else {
                throw new Error('Phase 3.1 file watching not available');
            }

        } catch (error) {
            console.warn('Failed to initialize real-time file watching, using fallback mode:', error.message);
            this.fallbackMode = true;
        }
    }

    /**
     * Enhanced context generation with real-time capabilities
     */
    async generateEnhancedContext(taskData, options = {}) {
        const startTime = Date.now();
        
        try {
            // Check for preemptively analyzed context
            const preanalyzedContext = await this.getPreanalyzedContext(taskData);
            
            if (preanalyzedContext && this.isContextCurrent(preanalyzedContext)) {
                console.log(`Using preanalyzed context for task ${taskData.id}`);
                return this.mergeWithRealTimeUpdates(preanalyzedContext, taskData);
            }

            // Generate context with real-time awareness
            const context = await super.generateEnhancedContext(taskData, {
                ...options,
                realTimeMode: this.realTimeEnabled && !this.fallbackMode
            });

            // Queue relevant files for preemptive analysis
            if (context.relevantFiles && context.relevantFiles.length > 0) {
                this.queueFilesForPreemptiveAnalysis(context.relevantFiles, taskData.id);
                
                // Register context dependencies with smart invalidation manager
                this.smartInvalidationManager.registerContextDependencies(taskData.id, context.relevantFiles);
            }

            return context;

        } catch (error) {
            console.error('Error in enhanced context generation:', error);
            
            // Fallback to standard context generation
            return this.generateFallbackContext(taskData, options);
        } finally {
            const duration = Date.now() - startTime;
            console.log(`Context generation completed in ${duration}ms`);
        }
    }

    /**
     * Get preemptively analyzed context if available
     */
    async getPreanalyzedContext(taskData) {
        if (!this.preemptiveAnalyzer) {
            return null;
        }

        // Check if we have preanalyzed results for task-relevant files
        const taskFiles = await this.getTaskRelevantFiles(taskData);
        const preanalyzedResults = [];

        for (const filePath of taskFiles) {
            const result = this.preemptiveAnalyzer.getPreanalyzedResult(filePath);
            if (result) {
                preanalyzedResults.push(result);
            }
        }

        return preanalyzedResults.length > 0 ? {
            taskId: taskData.id,
            preanalyzedFiles: preanalyzedResults,
            timestamp: Date.now()
        } : null;
    }

    /**
     * Get files relevant to a task (implementation for missing method)
     */
    async getTaskRelevantFiles(taskData) {
        // Simple implementation - in a real scenario this would analyze task requirements
        // For now, return all JavaScript files in the project
        try {
            const projectPath = this.options?.projectRoot || process.cwd();
            const glob = (await import('glob')).glob;
            const files = await glob('**/*.{js,ts,jsx,tsx}', { 
                cwd: projectPath,
                ignore: ['node_modules/**', '.git/**', '**/*.test.*', '**/*.spec.*']
            });
            return files.map(file => path.resolve(projectPath, file));
        } catch (error) {
            console.warn('Failed to get task relevant files:', error.message);
            return [];
        }
    }

    /**
     * Check if context is current and doesn't need regeneration
     */
    isContextCurrent(preanalyzedContext, maxAge = 60000) { // 1 minute default
        return Date.now() - preanalyzedContext.timestamp < maxAge;
    }

    /**
     * Merge preanalyzed context with real-time updates
     */
    async mergeWithRealTimeUpdates(preanalyzedContext, taskData) {
        // Start with preanalyzed data
        const baseContext = await this.buildContextFromPreanalyzed(preanalyzedContext);
        
        // Add real-time enhancements
        const enhancements = await this.getRealTimeEnhancements(taskData);
        
        return {
            ...baseContext,
            ...enhancements,
            realTimeMode: true,
            preanalyzed: true,
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Build context from preanalyzed results
     */
    async buildContextFromPreanalyzed(preanalyzedContext) {
        const context = {
            taskId: preanalyzedContext.taskId,
            analyzedFiles: preanalyzedContext.preanalyzedFiles,
            fromPreanalysis: true
        };

        // Process preanalyzed results into context format
        for (const fileResult of preanalyzedContext.preanalyzedFiles) {
            // Convert analysis results to context format
            if (fileResult.functions) {
                context.functions = (context.functions || []).concat(fileResult.functions);
            }
            if (fileResult.dependencies) {
                context.dependencies = (context.dependencies || []).concat(fileResult.dependencies);
            }
        }

        return context;
    }

    /**
     * Get real-time enhancements for context
     */
    async getRealTimeEnhancements(taskData) {
        return {
            realTimeStatus: this.fallbackMode ? 'fallback' : 'active',
            watchingEnabled: !!this.watchManager,
            lastChangeProcessed: this.changeProcessor.metrics.changesProcessed,
            preemptiveAnalysisActive: this.preemptiveAnalyzer.metrics.analysisCompleted > 0
        };
    }

    /**
     * Queue files for preemptive analysis
     */
    queueFilesForPreemptiveAnalysis(filePaths, taskId) {
        if (!this.preemptiveAnalyzer) {
            return;
        }

        for (const filePath of filePaths) {
            this.preemptiveAnalyzer.queuePreemptiveAnalysis(filePath, 'normal', [taskId]);
        }
    }

    /**
     * Generate fallback context when real-time fails
     */
    async generateFallbackContext(taskData, options) {
        console.log('Generating fallback context - real-time features disabled');
        
        // Use parent class method without real-time features
        return super.generateEnhancedContext(taskData, {
            ...options,
            realTimeMode: false,
            fallbackMode: true
        });
    }

    /**
     * Handle critical changes that require full context rebuild
     */
    async handleCriticalChanges(changes) {
        console.log('Handling critical changes - clearing all context caches');
        
        // Clear preemptive analysis cache
        if (this.preemptiveAnalyzer) {
            this.preemptiveAnalyzer.clearCache();
        }
        
        // Clear any other caches
        this.clearContextCache();
        
        // Emit critical change event
        this.emit('criticalChange', { changes, timestamp: Date.now() });
    }

    /**
     * Clear context cache (implementation for missing method)
     */
    clearContextCache() {
        // Clear any context-related caches
        if (this.contextCache) {
            this.contextCache.clear();
        }
        
        // Clear smart invalidation context dependencies
        if (this.smartInvalidationManager) {
            this.smartInvalidationManager.contextDependencies.clear();
        }
        
        console.log('Context caches cleared');
    }

    /**
     * Get comprehensive metrics for real-time system including Phase 3.2 metrics
     */
    getRealTimeMetrics() {
        return {
            realTimeEnabled: this.realTimeEnabled,
            fallbackMode: this.fallbackMode,
            watchManager: this.watchManager ? 'active' : 'inactive',
            changeProcessor: this.changeProcessor.getMetrics(),
            preemptiveAnalyzer: this.preemptiveAnalyzer.getMetrics(),
            smartInvalidation: this.smartInvalidationManager.getMetrics(),
            phase31Integration: this.watchManager ? 'active' : 'inactive',
            phase32Integration: this.smartInvalidationManager.isSmartInvalidationAvailable() ? 'active' : 'fallback'
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        if (this.watchManager) {
            await this.watchManager.stop();
        }
        
        if (this.changeProcessor) {
            clearTimeout(this.changeProcessor.processingTimer);
        }
    }
}

// Export the enhanced real-time context builder and Phase 3.2 integration
export { 
    RealTimeASTContextBuilder, 
    ChangeEventProcessor, 
    PreemptiveAnalyzer, 
    SmartInvalidationManager 
};

/**
 * Smart Invalidation Manager for Phase 3.2 Integration
 * 
 * Provides intelligent context invalidation using dependency analysis
 * and selective invalidation strategies
 */
class SmartInvalidationManager {
    constructor(contextBuilder, options = {}) {
        this.contextBuilder = contextBuilder;
        this.options = options;
        
        // Initialize Phase 3.2 components if available
        this.dependencyTracker = null;
        this.selectiveInvalidation = null;
        this.batchInvalidation = null;
        
        // Configuration
        this.invalidationStrategy = options.invalidationStrategy || 'BALANCED';
        this.batchStrategy = options.batchStrategy || 'HYBRID';
        this.maxDependencyDepth = options.maxDependencyDepth || 5;
        
        // State management
        this.contextDependencies = new Map();
        this.invalidationQueue = [];
        this.processedInvalidations = new Set();
        
        // Initialize smart invalidation components
        this.initializeSmartInvalidation();
    }

    /**
     * Initialize Phase 3.2 smart invalidation components
     */
    async initializeSmartInvalidation() {
        try {
            if (DependencyTracker && SelectiveInvalidation && BatchInvalidation) {
                // Initialize dependency tracker
                this.dependencyTracker = new DependencyTracker({
                    maxDepth: this.maxDependencyDepth,
                    trackTestFiles: true,
                    enableCrossLanguage: true
                });

                // Initialize selective invalidation
                this.selectiveInvalidation = new SelectiveInvalidation(this.dependencyTracker, {
                    strategy: this.invalidationStrategy,
                    enablePreview: false,
                    enableRollback: true
                });

                // Initialize batch invalidation
                this.batchInvalidation = new BatchInvalidation(this.selectiveInvalidation, {
                    strategy: this.batchStrategy,
                    enableDeduplication: true,
                    enablePrioritization: true
                });

                console.log('Phase 3.2 smart invalidation initialized successfully');
            }
        } catch (error) {
            console.error('Failed to initialize smart invalidation:', error);
        }
    }

    /**
     * Smart context invalidation using dependency analysis
     */
    async invalidateContext(changes, options = {}) {
        if (!this.isSmartInvalidationAvailable()) {
            return this.fallbackInvalidation(changes);
        }

        try {
            // Analyze dependencies for changed files
            const dependencyAnalysis = await this.analyzeDependencies(changes);
            
            // Determine invalidation strategy based on impact
            const invalidationPlan = await this.createInvalidationPlan(dependencyAnalysis);
            
            // Execute invalidation using batch processing
            const result = await this.executeInvalidation(invalidationPlan, options);
            
            return result;

        } catch (error) {
            console.error('Smart invalidation failed, falling back:', error);
            return this.fallbackInvalidation(changes);
        }
    }

    /**
     * Analyze dependencies for changed files
     */
    async analyzeDependencies(changes) {
        const analysis = {
            changedFiles: changes.map(c => c.path),
            dependencyGraph: new Map(),
            impactScores: new Map(),
            affectedContexts: new Set()
        };

        for (const change of changes) {
            try {
                // Get dependency information
                const dependencies = await this.dependencyTracker.getDependencies(change.path);
                const dependents = await this.dependencyTracker.getDependents(change.path);
                
                analysis.dependencyGraph.set(change.path, {
                    dependencies: dependencies.dependencies || [],
                    dependents: dependents.dependents || [],
                    type: change.type,
                    impact: dependencies.impact || 'medium'
                });

                // Calculate impact score
                const impactScore = this.calculateImpactScore(dependencies, dependents);
                analysis.impactScores.set(change.path, impactScore);
                
                // Find affected contexts
                const contexts = await this.findAffectedContexts(change.path, dependencies, dependents);
                contexts.forEach(ctx => analysis.affectedContexts.add(ctx));

            } catch (error) {
                console.error(`Error analyzing dependencies for ${change.path}:`, error);
            }
        }

        return analysis;
    }

    /**
     * Calculate impact score for a changed file
     */
    calculateImpactScore(dependencies, dependents) {
        let score = 1; // Base score
        
        // Factor in number of dependents (files that depend on this one)
        score += (dependents.dependents?.length || 0) * 0.5;
        
        // Factor in dependency depth
        score += (dependencies.maxDepth || 0) * 0.3;
        
        // Factor in cross-language dependencies
        if (dependencies.crossLanguage) {
            score += 1;
        }
        
        // Factor in test file dependencies
        if (dependencies.testFiles?.length > 0) {
            score += dependencies.testFiles.length * 0.2;
        }
        
        return Math.min(score, 10); // Cap at 10
    }

    /**
     * Find contexts affected by file changes
     */
    async findAffectedContexts(filePath, dependencies, dependents) {
        const affectedContexts = new Set();
        
        // Check direct context mappings
        for (const [contextId, contextFiles] of this.contextDependencies) {
            if (contextFiles.has(filePath)) {
                affectedContexts.add(contextId);
            }
            
            // Check dependent files
            for (const dependent of dependents.dependents || []) {
                if (contextFiles.has(dependent)) {
                    affectedContexts.add(contextId);
                }
            }
        }
        
        return Array.from(affectedContexts);
    }

    /**
     * Create invalidation plan based on dependency analysis
     */
    async createInvalidationPlan(analysis) {
        const plan = {
            strategy: this.determineOptimalStrategy(analysis),
            invalidationGroups: [],
            batchSize: this.calculateOptimalBatchSize(analysis),
            priority: this.calculatePriority(analysis)
        };

        // Group invalidations by impact level
        const highImpactFiles = [];
        const mediumImpactFiles = [];
        const lowImpactFiles = [];

        for (const [filePath, impactScore] of analysis.impactScores) {
            if (impactScore >= 7) {
                highImpactFiles.push(filePath);
            } else if (impactScore >= 4) {
                mediumImpactFiles.push(filePath);
            } else {
                lowImpactFiles.push(filePath);
            }
        }

        // Create invalidation groups
        if (highImpactFiles.length > 0) {
            plan.invalidationGroups.push({
                type: 'high_impact',
                files: highImpactFiles,
                strategy: 'CONSERVATIVE',
                priority: 'immediate'
            });
        }

        if (mediumImpactFiles.length > 0) {
            plan.invalidationGroups.push({
                type: 'medium_impact',
                files: mediumImpactFiles,
                strategy: 'BALANCED',
                priority: 'high'
            });
        }

        if (lowImpactFiles.length > 0) {
            plan.invalidationGroups.push({
                type: 'low_impact',
                files: lowImpactFiles,
                strategy: 'AGGRESSIVE',
                priority: 'normal'
            });
        }

        return plan;
    }

    /**
     * Determine optimal invalidation strategy
     */
    determineOptimalStrategy(analysis) {
        const totalFiles = analysis.changedFiles.length;
        const maxImpactScore = Math.max(...Array.from(analysis.impactScores.values()));
        
        if (maxImpactScore >= 8 || totalFiles >= 10) {
            return 'CONSERVATIVE';
        } else if (maxImpactScore >= 5 || totalFiles >= 5) {
            return 'BALANCED';
        } else {
            return 'AGGRESSIVE';
        }
    }

    /**
     * Calculate optimal batch size for processing
     */
    calculateOptimalBatchSize(analysis) {
        const totalFiles = analysis.changedFiles.length;
        const contextCount = analysis.affectedContexts.size;
        
        // Base batch size
        let batchSize = 5;
        
        // Adjust based on total files
        if (totalFiles > 20) {
            batchSize = 10;
        } else if (totalFiles < 5) {
            batchSize = 2;
        }
        
        // Adjust based on context count
        if (contextCount > 10) {
            batchSize = Math.min(batchSize, 3);
        }
        
        return batchSize;
    }

    /**
     * Calculate processing priority
     */
    calculatePriority(analysis) {
        const maxImpactScore = Math.max(...Array.from(analysis.impactScores.values()));
        const contextCount = analysis.affectedContexts.size;
        
        if (maxImpactScore >= 8 || contextCount >= 15) {
            return 'critical';
        } else if (maxImpactScore >= 5 || contextCount >= 8) {
            return 'high';
        } else if (maxImpactScore >= 3 || contextCount >= 3) {
            return 'normal';
        } else {
            return 'low';
        }
    }

    /**
     * Execute invalidation plan using batch processing
     */
    async executeInvalidation(plan, options = {}) {
        const results = {
            invalidatedContexts: [],
            processedFiles: [],
            errors: [],
            metrics: {
                startTime: Date.now(),
                totalFiles: plan.invalidationGroups.reduce((sum, group) => sum + group.files.length, 0),
                totalGroups: plan.invalidationGroups.length
            }
        };

        try {
            // Process invalidation groups in priority order
            plan.invalidationGroups.sort((a, b) => {
                const priorityOrder = { immediate: 4, critical: 3, high: 2, normal: 1, low: 0 };
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            });

            for (const group of plan.invalidationGroups) {
                try {
                    const groupResult = await this.processInvalidationGroup(group, options);
                    results.invalidatedContexts.push(...groupResult.invalidatedContexts);
                    results.processedFiles.push(...groupResult.processedFiles);
                } catch (error) {
                    results.errors.push({
                        group: group.type,
                        error: error.message,
                        files: group.files
                    });
                }
            }

        } catch (error) {
            results.errors.push({
                type: 'execution_error',
                error: error.message
            });
        } finally {
            results.metrics.endTime = Date.now();
            results.metrics.duration = results.metrics.endTime - results.metrics.startTime;
        }

        return results;
    }

    /**
     * Process a single invalidation group
     */
    async processInvalidationGroup(group, options) {
        const result = {
            invalidatedContexts: [],
            processedFiles: [],
            groupType: group.type
        };

        // Use batch invalidation for efficient processing
        if (this.batchInvalidation) {
            try {
                // Convert files to change events for batch processing
                const changeEvents = group.files.map(filePath => ({
                    filePath,
                    changeType: 'modify',
                    timestamp: new Date()
                }));

                const batchResults = await this.batchInvalidation.queueChanges(changeEvents, {
                    priority: this.mapPriorityToBatchPriority(group.priority)
                });

                // Process results
                result.processedFiles = batchResults
                    .filter(r => r.queued)
                    .map(r => r.change.filePath);
                    
                // If not all files were queued, flush to process immediately
                if (result.processedFiles.length < group.files.length) {
                    await this.batchInvalidation.flushBatches();
                    result.processedFiles = group.files; // Assume all processed after flush
                }

                result.invalidatedContexts = group.files.flatMap(filePath => 
                    this.findAffectedContextsForFile(filePath)
                );

            } catch (error) {
                console.error(`Batch invalidation failed for group ${group.type}:`, error);
                // Fallback to individual file processing
                result.processedFiles = await this.processFilesIndividually(group.files);
            }
        } else {
            // Fallback processing
            result.processedFiles = await this.processFilesIndividually(group.files);
        }

        return result;
    }

    /**
     * Process files individually as fallback
     */
    async processFilesIndividually(files) {
        const processed = [];
        
        for (const filePath of files) {
            try {
                await this.invalidateFileContext(filePath);
                processed.push(filePath);
            } catch (error) {
                console.error(`Failed to invalidate context for ${filePath}:`, error);
            }
        }
        
        return processed;
    }

    /**
     * Invalidate context for a single file
     */
    async invalidateFileContext(filePath) {
        // Find contexts that include this file
        const affectedContexts = [];
        
        for (const [contextId, contextFiles] of this.contextDependencies) {
            if (contextFiles.has(filePath)) {
                affectedContexts.push(contextId);
            }
        }

        // Invalidate affected contexts
        for (const contextId of affectedContexts) {
            await this.contextBuilder.invalidateContext?.(contextId);
        }
    }

    /**
     * Register context dependencies for tracking
     */
    registerContextDependencies(contextId, filePaths) {
        this.contextDependencies.set(contextId, new Set(filePaths));
    }

    /**
     * Fallback invalidation when smart invalidation is not available
     */
    async fallbackInvalidation(changes) {
        console.log('Using fallback invalidation for', changes.length, 'changes');
        
        const result = {
            invalidatedContexts: [],
            processedFiles: [],
            fallback: true
        };

        // Simple invalidation - invalidate all contexts that might be affected
        for (const change of changes) {
            try {
                const affectedContexts = await this.findAffectedContextsFallback(change.path);
                
                for (const contextId of affectedContexts) {
                    if (!result.invalidatedContexts.includes(contextId)) {
                        await this.contextBuilder.invalidateContext?.(contextId);
                        result.invalidatedContexts.push(contextId);
                    }
                }
                
                result.processedFiles.push(change.path);
                
            } catch (error) {
                console.error(`Fallback invalidation failed for ${change.path}:`, error);
            }
        }

        return result;
    }

    /**
     * Find affected contexts without dependency analysis
     */
    async findAffectedContextsFallback(filePath) {
        const affectedContexts = [];
        
        // Check all registered contexts
        for (const [contextId, contextFiles] of this.contextDependencies) {
            if (contextFiles.has(filePath)) {
                affectedContexts.push(contextId);
            }
        }
        
        // If no specific mapping, assume all contexts might be affected
        if (affectedContexts.length === 0) {
            affectedContexts.push(...this.contextDependencies.keys());
        }
        
        return affectedContexts;
    }

    /**
     * Check if smart invalidation is available
     */
    isSmartInvalidationAvailable() {
        return !!(this.dependencyTracker && this.selectiveInvalidation && this.batchInvalidation);
    }

    /**
     * Map string priority to batch priority enum
     */
    mapPriorityToBatchPriority(priority) {
        const mapping = {
            'critical': 0,  // BatchPriority.CRITICAL
            'immediate': 0,
            'high': 1,      // BatchPriority.HIGH
            'normal': 2,    // BatchPriority.MEDIUM
            'medium': 2,
            'low': 3        // BatchPriority.LOW
        };
        return mapping[priority] || 2; // Default to medium
    }

    /**
     * Find affected contexts for a single file
     */
    findAffectedContextsForFile(filePath) {
        const affectedContexts = [];
        
        for (const [contextId, contextFiles] of this.contextDependencies) {
            if (contextFiles.has(filePath)) {
                affectedContexts.push(contextId);
            }
        }
        
        return affectedContexts;
    }

    /**
     * Get smart invalidation metrics
     */
    getMetrics() {
        return {
            smartInvalidationEnabled: this.isSmartInvalidationAvailable(),
            invalidationStrategy: this.invalidationStrategy,
            batchStrategy: this.batchStrategy,
            maxDependencyDepth: this.maxDependencyDepth,
            contextDependencies: this.contextDependencies.size,
            queuedInvalidations: this.invalidationQueue.length,
            processedInvalidations: this.processedInvalidations.size,
            dependencyTracker: this.dependencyTracker?.getMetrics?.() || null,
            selectiveInvalidation: this.selectiveInvalidation?.getMetrics?.() || null,
            batchInvalidation: this.batchInvalidation?.getStats?.() || null
        };
    }
}
