/**
 * Lazy Loading Manager for AST Performance System
 * 
 * On-demand resource loading with intelligent caching and memory pressure response.
 */

import { EventEmitter } from 'events';
import path from 'path';

export class LazyLoadingManager extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            enabled: config.enabled !== false,
            cleanupInterval: this._parseDuration(config.cleanupInterval || '5m'),
            maxIdleTime: this._parseDuration(config.maxIdleTime || '10m'),
            maxCachedParsers: config.maxCachedParsers || 4,
            maxCachedASTs: config.maxCachedASTs || 50
        };
        
        // Resource caches
        this.loadedParsers = new Map();
        this.parserAccessTimes = new Map();
        this.astCache = new Map();
        this.astAccessTimes = new Map();
        
        // Cleanup timers
        this.cleanupTimer = null;
        
        // Performance metrics
        this.metrics = {
            parsersLoaded: 0,
            parsersUnloaded: 0,
            astsLoaded: 0,
            astsUnloaded: 0,
            cacheHits: 0,
            cacheMisses: 0,
            memoryPressureEvents: 0
        };
        
        // Resource monitor integration
        this.resourceMonitor = null;
        this.currentAnalysisDepth = 'full';
    }
    
    /**
     * Initialize the lazy loading system
     */
    async initialize(resourceMonitor = null) {
        if (!this.config.enabled) {
            return;
        }
        
        this.resourceMonitor = resourceMonitor;
        
        // Start cleanup scheduler
        this._startCleanupScheduler();
        
        // Listen to resource monitor for memory pressure
        if (this.resourceMonitor) {
            this.resourceMonitor.on('degradation:changed', (event) => {
                this._handleResourceDegradation(event);
            });
        }
        
        this.emit('lazy-loading:initialized', {
            config: this.config
        });
    }
    
    /**
     * Load parser on demand with complexity reduction under high load
     */
    async loadParser(language) {
        if (!this.config.enabled) {
            return this._loadParserDirect(language);
        }
        
        // Check if parser is already loaded
        if (this.loadedParsers.has(language)) {
            this.parserAccessTimes.set(language, Date.now());
            this.metrics.cacheHits++;
            this.emit('parser:cache-hit', { language });
            return this.loadedParsers.get(language);
        }
        
        this.metrics.cacheMisses++;
        
        // Check if we should reduce complexity
        if (this._shouldReduceComplexity()) {
            const reducedParser = this._createReducedParser(language);
            this.emit('parser:reduced-complexity', { 
                language, 
                reason: 'high_load_or_memory_pressure',
                analysisDepth: this.currentAnalysisDepth
            });
            return reducedParser;
        }
        
        // Load full parser
        const parser = await this._loadParserDirect(language);
        
        // Cache the parser
        this.loadedParsers.set(language, parser);
        this.parserAccessTimes.set(language, Date.now());
        this.metrics.parsersLoaded++;
        
        // Enforce cache limits
        this._enforceCacheLimits();
        
        this.emit('parser:loaded', { 
            language, 
            cacheSize: this.loadedParsers.size 
        });
        
        return parser;
    }
    
    /**
     * Load AST from cache or parse with complexity awareness
     */
    async loadAST(filePath, content, options = {}) {
        if (!this.config.enabled) {
            return this._parseFileDirect(filePath, content, options);
        }
        
        // Generate cache key
        const cacheKey = this._generateASTCacheKey(filePath, content);
        
        // Check cache
        if (this.astCache.has(cacheKey)) {
            this.astAccessTimes.set(cacheKey, Date.now());
            this.metrics.cacheHits++;
            this.emit('ast:cache-hit', { filePath, cacheKey });
            return this.astCache.get(cacheKey);
        }
        
        this.metrics.cacheMisses++;
        
        // Load AST with current complexity level
        const ast = await this._loadASTWithComplexity(filePath, content, options);
        
        // Cache the result
        this.astCache.set(cacheKey, ast);
        this.astAccessTimes.set(cacheKey, Date.now());
        this.metrics.astsLoaded++;
        
        // Enforce cache limits
        this._enforceCacheLimits();
        
        this.emit('ast:loaded', { 
            filePath, 
            cacheKey, 
            cacheSize: this.astCache.size 
        });
        
        return ast;
    }
    
    /**
     * Schedule cleanup of unused resources
     */
    scheduleCleanup(maxAge = null) {
        const cleanupAge = maxAge || this.config.maxIdleTime;
        const now = Date.now();
        
        let cleanedCount = 0;
        
        // Clean up old parsers
        for (const [language, lastAccess] of this.parserAccessTimes.entries()) {
            if (now - lastAccess > cleanupAge) {
                this.unloadParser(language);
                cleanedCount++;
            }
        }
        
        // Clean up old ASTs
        for (const [cacheKey, lastAccess] of this.astAccessTimes.entries()) {
            if (now - lastAccess > cleanupAge) {
                this.astCache.delete(cacheKey);
                this.astAccessTimes.delete(cacheKey);
                this.metrics.astsUnloaded++;
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            this.emit('cleanup:completed', { 
                cleanedCount, 
                parserCacheSize: this.loadedParsers.size,
                astCacheSize: this.astCache.size
            });
        }
        
        return cleanedCount;
    }
    
    /**
     * Get cache statistics
     */
    getCacheStatistics() {
        const now = Date.now();
        
        return {
            parsers: {
                loaded: this.loadedParsers.size,
                languages: Array.from(this.loadedParsers.keys())
            },
            asts: {
                cached: this.astCache.size
            },
            metrics: this.metrics,
            configuration: {
                analysisDepth: this.currentAnalysisDepth,
                memoryPressure: this._isUnderMemoryPressure()
            }
        };
    }
    
    /**
     * Unload parser to free memory
     */
    unloadParser(language) {
        if (this.loadedParsers.has(language)) {
            this.loadedParsers.delete(language);
            this.parserAccessTimes.delete(language);
            this.metrics.parsersUnloaded++;
            
            this.emit('parser:unloaded', { 
                language, 
                cacheSize: this.loadedParsers.size 
            });
            
            return true;
        }
        
        return false;
    }
    
    /**
     * Shutdown the lazy loading system
     */
    async shutdown() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        
        // Clear all caches
        this.loadedParsers.clear();
        this.parserAccessTimes.clear();
        this.astCache.clear();
        this.astAccessTimes.clear();
        
        this.emit('lazy-loading:shutdown', {
            finalMetrics: this.metrics
        });
    }
    
    // Private methods
    
    /**
     * Load parser directly without caching
     */
    async _loadParserDirect(language) {
        // Simplified parser - in real implementation would load actual parser modules
        return {
            language,
            parse: async (filePath, content, options = {}) => {
                return {
                    success: true,
                    ast: { type: 'full', functions: [], classes: [] },
                    complexity: 1
                };
            },
            loadedAt: Date.now()
        };
    }
    
    /**
     * Create reduced complexity parser for high load situations
     */
    _createReducedParser(language) {
        return {
            language,
            reduced: true,
            analysisDepth: this.currentAnalysisDepth,
            parse: async (filePath, content, options = {}) => {
                switch (this.currentAnalysisDepth) {
                    case 'minimal':
                        return { 
                            success: true, 
                            ast: { type: 'minimal', basic: true }, 
                            complexity: 0 
                        };
                    case 'reduced':
                        return { 
                            success: true, 
                            ast: { type: 'reduced', functions: [] }, 
                            complexity: 1 
                        };
                    case 'disabled':
                        return { 
                            success: false, 
                            ast: null, 
                            complexity: 0,
                            reason: 'Analysis disabled due to resource constraints'
                        };
                    default:
                        return this._loadParserDirect(language);
                }
            }
        };
    }
    
    /**
     * Parse file with complexity-aware approach
     */
    async _loadASTWithComplexity(filePath, content, options) {
        const language = this._detectLanguage(filePath);
        const parser = await this.loadParser(language);
        
        // Adjust parsing options based on current analysis depth
        const adjustedOptions = this._adjustOptionsForComplexity(options);
        
        return parser.parse(filePath, content, adjustedOptions);
    }
    
    /**
     * Parse file directly without caching
     */
    async _parseFileDirect(filePath, content, options) {
        return {
            success: true,
            ast: { type: 'direct', file: filePath },
            complexity: 1
        };
    }
    
    /**
     * Handle resource degradation events
     */
    _handleResourceDegradation(event) {
        this.currentAnalysisDepth = this.resourceMonitor.getRecommendedAnalysisDepth();
        
        if (event.newLevel > event.oldLevel) {
            // Increased degradation - free up memory
            this.metrics.memoryPressureEvents++;
            this._unloadLRUResources();
            
            this.emit('memory-pressure:response', {
                degradationLevel: event.newLevel,
                analysisDepth: this.currentAnalysisDepth,
                action: 'unload_lru_resources'
            });
        }
    }
    
    /**
     * Check if we should reduce complexity
     */
    _shouldReduceComplexity() {
        return this._isUnderMemoryPressure() || this.currentAnalysisDepth !== 'full';
    }
    
    /**
     * Check if system is under memory pressure
     */
    _isUnderMemoryPressure() {
        if (!this.resourceMonitor) return false;
        
        const usage = this.resourceMonitor.getCurrentUsage();
        return usage.memory.exceeding || usage.cpu.exceeding;
    }
    
    /**
     * Start cleanup scheduler
     */
    _startCleanupScheduler() {
        this.cleanupTimer = setInterval(() => {
            this.scheduleCleanup();
        }, this.config.cleanupInterval);
    }
    
    /**
     * Enforce cache size limits
     */
    _enforceCacheLimits() {
        // Enforce parser cache limit
        while (this.loadedParsers.size > this.config.maxCachedParsers) {
            const lruLanguage = this._findLRUParser();
            if (lruLanguage) {
                this.unloadParser(lruLanguage);
            } else {
                break;
            }
        }
        
        // Enforce AST cache limit
        while (this.astCache.size > this.config.maxCachedASTs) {
            const lruKey = this._findLRUAST();
            if (lruKey) {
                this.astCache.delete(lruKey);
                this.astAccessTimes.delete(lruKey);
                this.metrics.astsUnloaded++;
            } else {
                break;
            }
        }
    }
    
    /**
     * Utility methods
     */
    _generateASTCacheKey(filePath, content) {
        const normalizedPath = path.resolve(filePath).replace(/\\/g, '/');
        const contentHash = this._simpleHash(content);
        return `${normalizedPath}:${contentHash}`;
    }
    
    _simpleHash(content) {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }
    
    _detectLanguage(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        switch (ext) {
            case '.js': case '.jsx': return 'javascript';
            case '.ts': case '.tsx': return 'typescript';
            case '.py': return 'python';
            case '.go': return 'go';
            default: return 'javascript';
        }
    }
    
    _adjustOptionsForComplexity(options) {
        const adjusted = { ...options };
        
        switch (this.currentAnalysisDepth) {
            case 'minimal':
                adjusted.skipPatterns = true;
                adjusted.skipComplexity = true;
                adjusted.skipDependencies = true;
                break;
            case 'reduced':
                adjusted.skipPatterns = true;
                adjusted.skipComplexity = false;
                adjusted.skipDependencies = true;
                break;
            case 'disabled':
                return null;
        }
        
        return adjusted;
    }
    
    _findLRUParser() {
        let lruLanguage = null;
        let oldestTime = Date.now();
        
        for (const [language, accessTime] of this.parserAccessTimes.entries()) {
            if (accessTime < oldestTime) {
                oldestTime = accessTime;
                lruLanguage = language;
            }
        }
        
        return lruLanguage;
    }
    
    _findLRUAST() {
        let lruKey = null;
        let oldestTime = Date.now();
        
        for (const [key, accessTime] of this.astAccessTimes.entries()) {
            if (accessTime < oldestTime) {
                oldestTime = accessTime;
                lruKey = key;
            }
        }
        
        return lruKey;
    }
    
    _unloadLRUResources() {
        // Unload half of the cached resources
        const parsersToUnload = Math.floor(this.loadedParsers.size / 2);
        const astsToUnload = Math.floor(this.astCache.size / 2);
        
        for (let i = 0; i < parsersToUnload; i++) {
            const lruLanguage = this._findLRUParser();
            if (lruLanguage) {
                this.unloadParser(lruLanguage);
            }
        }
        
        for (let i = 0; i < astsToUnload; i++) {
            const lruKey = this._findLRUAST();
            if (lruKey) {
                this.astCache.delete(lruKey);
                this.astAccessTimes.delete(lruKey);
                this.metrics.astsUnloaded++;
            }
        }
    }
    
    _parseDuration(duration) {
        if (typeof duration === 'number') return duration;
        const match = duration.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)?$/);
        if (!match) throw new Error(`Invalid duration: ${duration}`);
        const value = parseFloat(match[1]);
        const unit = match[2] || 'ms';
        switch (unit) {
            case 'ms': return value;
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            default: throw new Error(`Invalid duration unit: ${unit}`);
        }
    }
}

export default LazyLoadingManager; 