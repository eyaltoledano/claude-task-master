import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';

/**
 * Content-based hasher for cache invalidation
 * Uses SHA-256 hashing with language-aware normalization
 */
export class ContentHasher {
    constructor(options = {}) {
        this.algorithm = options.algorithm || 'sha256';
        this.cacheHashes = options.cacheHashes !== false;
        this.normalizeContent = options.normalizeContent !== false;
        this.gitIntegration = options.gitIntegration !== false;
        
        // In-memory hash cache for performance
        this.hashCache = new Map();
        
        // Statistics
        this.stats = {
            hashesGenerated: 0,
            cacheHits: 0,
            cacheMisses: 0,
            normalizationApplied: 0,
            errors: 0
        };
    }

    /**
     * Generate content hash with optional language normalization
     */
    async generateHash(filePath, content, language = null) {
        try {
            // Check cache first
            const cacheKey = `${filePath}:${content?.length || 0}`;
            if (this.cacheHashes && this.hashCache.has(cacheKey)) {
                this.stats.cacheHits++;
                return this.hashCache.get(cacheKey);
            }

            let processedContent = content;
            
            // Apply language-specific normalization
            if (this.normalizeContent && language) {
                processedContent = this._normalizeContent(content, language);
                this.stats.normalizationApplied++;
            }
            
            // Generate hash
            const hash = crypto.createHash(this.algorithm);
            hash.update(processedContent || '', 'utf8');
            const result = hash.digest('hex');
            
            // Cache result
            if (this.cacheHashes) {
                this.hashCache.set(cacheKey, result);
            }
            
            this.stats.hashesGenerated++;
            this.stats.cacheMisses++;
            
            return result;
        } catch (error) {
            this.stats.errors++;
            console.error(`[ContentHasher] Error generating hash for ${filePath}: ${error.message}`);
            return null;
        }
    }

    /**
     * Generate normalized hash for consistent comparison
     */
    async generateNormalizedHash(filePath, content, language) {
        return this.generateHash(filePath, content, language);
    }

    /**
     * Batch generate hashes for multiple files
     */
    async batchGenerateHashes(fileEntries) {
        const results = new Map();
        
        for (const { filePath, content, language } of fileEntries) {
            const hash = await this.generateHash(filePath, content, language);
            results.set(filePath, hash);
        }
        
        return results;
    }

    /**
     * Get existing file hash from cache or filesystem
     */
    async getFileHash(filePath) {
        try {
            // Check memory cache first
            const cacheEntries = Array.from(this.hashCache.entries());
            const entry = cacheEntries.find(([key]) => key.startsWith(filePath + ':'));
            
            if (entry) {
                return entry[1];
            }
            
            // Try to read and hash file if not in cache
            if (await fs.pathExists(filePath)) {
                const content = await fs.readFile(filePath, 'utf8');
                const ext = path.extname(filePath);
                const language = this._detectLanguage(ext);
                return this.generateHash(filePath, content, language);
            }
            
            return null;
        } catch (error) {
            this.stats.errors++;
            console.error(`[ContentHasher] Error getting file hash for ${filePath}: ${error.message}`);
            return null;
        }
    }

    /**
     * Validate hash consistency
     */
    async validateHashConsistency(filePath, expectedHash) {
        const currentHash = await this.getFileHash(filePath);
        return currentHash === expectedHash;
    }

    /**
     * Language-specific content normalization
     */
    _normalizeContent(content, language) {
        if (!content) return '';
        
        switch (language) {
            case 'javascript':
            case 'typescript':
                return this._normalizeJS(content);
            case 'python':
                return this._normalizePython(content);
            case 'go':
                return this._normalizeGo(content);
            case 'json':
                return this._normalizeJSON(content);
            default:
                return this._normalizeGeneric(content);
        }
    }

    /**
     * JavaScript/TypeScript normalization
     */
    _normalizeJS(content) {
        return content
            // Remove single-line comments
            .replace(/\/\/.*$/gm, '')
            // Remove multi-line comments
            .replace(/\/\*[\s\S]*?\*\//g, '')
            // Normalize whitespace
            .replace(/\s+/g, ' ')
            // Remove trailing whitespace
            .replace(/\s+$/gm, '')
            // Remove empty lines
            .replace(/\n\s*\n/g, '\n')
            .trim();
    }

    /**
     * Python normalization
     */
    _normalizePython(content) {
        return content
            // Remove comments
            .replace(/#.*$/gm, '')
            // Remove docstrings
            .replace(/"""[\s\S]*?"""/g, '')
            .replace(/'''[\s\S]*?'''/g, '')
            // Normalize whitespace (preserve indentation structure)
            .replace(/[ \t]+/g, ' ')
            // Remove trailing whitespace
            .replace(/\s+$/gm, '')
            // Remove empty lines
            .replace(/\n\s*\n/g, '\n')
            .trim();
    }

    /**
     * Go normalization
     */
    _normalizeGo(content) {
        return content
            // Remove single-line comments
            .replace(/\/\/.*$/gm, '')
            // Remove multi-line comments
            .replace(/\/\*[\s\S]*?\*\//g, '')
            // Normalize whitespace
            .replace(/\s+/g, ' ')
            // Remove trailing whitespace
            .replace(/\s+$/gm, '')
            // Remove empty lines
            .replace(/\n\s*\n/g, '\n')
            .trim();
    }

    /**
     * JSON normalization
     */
    _normalizeJSON(content) {
        try {
            // Parse and re-stringify for consistent formatting
            const parsed = JSON.parse(content);
            return JSON.stringify(parsed, null, 0);
        } catch (error) {
            // If parsing fails, just normalize whitespace
            return this._normalizeGeneric(content);
        }
    }

    /**
     * Generic normalization for unknown languages
     */
    _normalizeGeneric(content) {
        return content
            // Normalize line endings
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            // Remove trailing whitespace
            .replace(/\s+$/gm, '')
            // Normalize multiple spaces
            .replace(/\s{2,}/g, ' ')
            .trim();
    }

    /**
     * Detect language from file extension
     */
    _detectLanguage(extension) {
        const languageMap = {
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.mjs': 'javascript',
            '.cjs': 'javascript',
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.mts': 'typescript',
            '.cts': 'typescript',
            '.py': 'python',
            '.pyx': 'python',
            '.pyi': 'python',
            '.pyw': 'python',
            '.go': 'go',
            '.json': 'json',
            '.jsonc': 'json'
        };
        
        return languageMap[extension] || 'generic';
    }

    /**
     * Try to get Git hash for file if available
     */
    async _getGitHash(filePath) {
        if (!this.gitIntegration) return null;
        
        try {
            // This would integrate with git to get object hash
            // For now, return null and rely on content hashing
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Clear hash cache
     */
    clearCache() {
        this.hashCache.clear();
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.hashCache.size,
            hitRate: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) || 0
        };
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.clearCache();
    }
}

/**
 * Create a new content hasher instance
 */
export function createContentHasher(options = {}) {
    return new ContentHasher(options);
}

export default ContentHasher; 