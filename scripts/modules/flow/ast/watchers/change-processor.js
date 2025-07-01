/**
 * Change Processor - Phase 3.1.2
 *
 * Processes file changes detected by the file watcher and determines their impact
 * on the AST cache and analysis results. Provides intelligent analysis of change
 * types and priority scoring for efficient cache management.
 *
 * Features:
 * - Language-aware change classification
 * - Impact analysis for dependency relationships
 * - Priority scoring for processing order
 * - Content-based change detection
 * - Intelligent filtering of irrelevant changes
 *
 * @author Task Master Flow
 * @version 3.1.0
 */

import path from 'path';
import fs from 'fs-extra';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { loadASTConfig } from '../config/ast-config.js';

/**
 * Change types classification
 */
export const ChangeTypes = {
	CONTENT: 'content', // File content changed
	METADATA: 'metadata', // File metadata changed (permissions, timestamps)
	CREATION: 'creation', // New file created
	DELETION: 'deletion', // File deleted
	MOVE: 'move', // File moved/renamed
	DEPENDENCY: 'dependency' // File change affects dependencies
};

/**
 * Change priority levels
 */
export const ChangePriority = {
	CRITICAL: 5, // Changes that affect many other files
	HIGH: 4, // Changes to core files or entry points
	MEDIUM: 3, // Regular file content changes
	LOW: 2, // Minor changes or non-critical files
	IGNORE: 1 // Changes that can be ignored
};

/**
 * Change processor for analyzing file modifications and their impact
 */
export class ChangeProcessor extends EventEmitter {
	constructor(projectPath, options = {}) {
		super();

		this.projectPath = path.resolve(projectPath);
		this.options = {
			contentHashAlgorithm: 'sha256',
			maxFileSize: 10 * 1024 * 1024, // 10MB
			enableImpactAnalysis: true,
			enableContentComparison: true,
			dependencyAnalysisDepth: 3,
			...options
		};

		this.astConfig = null;
		this.contentHashes = new Map();
		this.dependencyGraph = new Map();
		this.stats = {
			changesProcessed: 0,
			contentChanges: 0,
			dependencyChanges: 0,
			ignoredChanges: 0,
			startTime: new Date()
		};
	}

	/**
	 * Initialize the change processor
	 */
	async initialize() {
		try {
			this.astConfig = await loadASTConfig(this.projectPath);

			console.debug(`[ChangeProcessor] Initialized for ${this.projectPath}`);
			console.debug(
				`[ChangeProcessor] Impact analysis: ${this.options.enableImpactAnalysis}`
			);
			console.debug(
				`[ChangeProcessor] Content comparison: ${this.options.enableContentComparison}`
			);

			return true;
		} catch (error) {
			console.error(
				`[ChangeProcessor] Initialization failed: ${error.message}`
			);
			return false;
		}
	}

	/**
	 * Process a single file change
	 */
	async processChange(changeEvent) {
		try {
			const analysis = await this._analyzeChange(changeEvent);

			if (analysis.shouldIgnore) {
				this.stats.ignoredChanges++;
				console.debug(
					`[ChangeProcessor] Ignoring change: ${changeEvent.relativePath}`
				);
				return null;
			}

			this.stats.changesProcessed++;

			// Update statistics based on change type
			switch (analysis.changeType) {
				case ChangeTypes.CONTENT:
					this.stats.contentChanges++;
					break;
				case ChangeTypes.DEPENDENCY:
					this.stats.dependencyChanges++;
					break;
			}

			console.debug(
				`[ChangeProcessor] Processed ${analysis.changeType} change: ${changeEvent.relativePath} (priority: ${analysis.priority})`
			);

			this.emit('changeProcessed', {
				original: changeEvent,
				analysis,
				timestamp: new Date()
			});

			return analysis;
		} catch (error) {
			console.error(
				`[ChangeProcessor] Error processing change ${changeEvent.relativePath}: ${error.message}`
			);
			this.emit('processingError', { changeEvent, error });
			return null;
		}
	}

	/**
	 * Process multiple changes together for batch analysis
	 */
	async processBatchChanges(changes) {
		const analyses = [];
		const errors = [];

		console.debug(
			`[ChangeProcessor] Processing batch of ${changes.length} changes`
		);

		try {
			// Process changes individually first
			for (const change of changes) {
				try {
					const analysis = await this.processChange(change);
					if (analysis) {
						analyses.push(analysis);
					}
				} catch (error) {
					errors.push({ change, error });
				}
			}

			// Perform batch-level analysis
			const batchAnalysis = await this._analyzeBatchImpact(analyses);

			console.debug(
				`[ChangeProcessor] Batch analysis complete: ${analyses.length} changes processed`
			);

			this.emit('batchProcessed', {
				changes: analyses,
				batchAnalysis,
				errors,
				timestamp: new Date()
			});

			return {
				analyses,
				batchAnalysis,
				errors
			};
		} catch (error) {
			console.error(
				`[ChangeProcessor] Error processing batch: ${error.message}`
			);
			throw error;
		}
	}

	/**
	 * Analyze a single change event
	 */
	async _analyzeChange(changeEvent) {
		const { path: filePath, relativePath, type, language, size } = changeEvent;

		const analysis = {
			filePath,
			relativePath,
			language,
			changeType: this._classifyChangeType(changeEvent),
			priority: ChangePriority.MEDIUM,
			shouldIgnore: false,
			affectedFiles: [],
			cacheKeys: [],
			contentHash: null,
			previousHash: null,
			metadata: {
				size,
				language,
				isEntry: false,
				isCore: false,
				dependencyCount: 0
			}
		};

		// Check if file should be ignored
		if (await this._shouldIgnoreChange(changeEvent)) {
			analysis.shouldIgnore = true;
			return analysis;
		}

		// Analyze content changes if enabled
		if (
			this.options.enableContentComparison &&
			(type === 'change' || type === 'add')
		) {
			await this._analyzeContentChange(analysis);
		}

		// Determine priority based on file characteristics
		analysis.priority = await this._calculatePriority(analysis);

		// Perform impact analysis if enabled
		if (this.options.enableImpactAnalysis) {
			await this._analyzeImpact(analysis);
		}

		// Generate cache keys that need invalidation
		analysis.cacheKeys = this._generateCacheKeys(analysis);

		return analysis;
	}

	/**
	 * Classify the type of change
	 */
	_classifyChangeType(changeEvent) {
		const { type, size } = changeEvent;

		switch (type) {
			case 'add':
				return ChangeTypes.CREATION;
			case 'unlink':
				return ChangeTypes.DELETION;
			case 'change':
				// Could be content or metadata change
				return size > 0 ? ChangeTypes.CONTENT : ChangeTypes.METADATA;
			default:
				return ChangeTypes.CONTENT;
		}
	}

	/**
	 * Check if a change should be ignored
	 */
	async _shouldIgnoreChange(changeEvent) {
		const { relativePath, size, type } = changeEvent;

		// Ignore very large files
		if (size > this.options.maxFileSize) {
			console.debug(
				`[ChangeProcessor] Ignoring large file: ${relativePath} (${size} bytes)`
			);
			return true;
		}

		// Ignore temporary files
		if (this._isTempFile(relativePath)) {
			return true;
		}

		// Ignore metadata-only changes for unchanged content
		if (type === 'change' && this.options.enableContentComparison) {
			const hasContentChanged = await this._hasContentChanged(changeEvent.path);
			if (!hasContentChanged) {
				console.debug(
					`[ChangeProcessor] Ignoring metadata-only change: ${relativePath}`
				);
				return true;
			}
		}

		return false;
	}

	/**
	 * Analyze content changes by comparing file hashes
	 */
	async _analyzeContentChange(analysis) {
		try {
			const { filePath, relativePath } = analysis;

			// Calculate current content hash
			const currentHash = await this._calculateFileHash(filePath);
			analysis.contentHash = currentHash;

			// Get previous hash if available
			const previousHash = this.contentHashes.get(relativePath);
			analysis.previousHash = previousHash;

			// Update stored hash
			this.contentHashes.set(relativePath, currentHash);

			// If hashes are the same, this is not a content change
			if (previousHash && previousHash === currentHash) {
				analysis.changeType = ChangeTypes.METADATA;
			}
		} catch (error) {
			console.warn(
				`[ChangeProcessor] Failed to analyze content for ${analysis.relativePath}: ${error.message}`
			);
		}
	}

	/**
	 * Calculate priority score for a change
	 */
	async _calculatePriority(analysis) {
		let priority = ChangePriority.MEDIUM;
		const { relativePath, language, changeType } = analysis;

		// High priority for certain file types
		if (this._isEntryPoint(relativePath)) {
			analysis.metadata.isEntry = true;
			priority = Math.max(priority, ChangePriority.HIGH);
		}

		if (this._isCoreFile(relativePath)) {
			analysis.metadata.isCore = true;
			priority = Math.max(priority, ChangePriority.HIGH);
		}

		// Higher priority for configuration files
		if (this._isConfigFile(relativePath)) {
			priority = Math.max(priority, ChangePriority.HIGH);
		}

		// Deletions are high priority
		if (changeType === ChangeTypes.DELETION) {
			priority = Math.max(priority, ChangePriority.HIGH);
		}

		// Language-specific priority adjustments
		priority = this._adjustPriorityForLanguage(
			priority,
			language,
			relativePath
		);

		return priority;
	}

	/**
	 * Analyze the impact of a change on other files
	 */
	async _analyzeImpact(analysis) {
		if (!this.options.enableImpactAnalysis) {
			return;
		}

		try {
			const { relativePath, changeType } = analysis;

			// Find files that depend on this file
			const dependents = this._findDependentFiles(relativePath);
			analysis.affectedFiles = dependents;
			analysis.metadata.dependencyCount = dependents.length;

			// If this file has many dependents, increase priority
			if (dependents.length > 5) {
				analysis.priority = Math.max(
					analysis.priority,
					ChangePriority.CRITICAL
				);
				analysis.changeType = ChangeTypes.DEPENDENCY;
			} else if (dependents.length > 2) {
				analysis.priority = Math.max(analysis.priority, ChangePriority.HIGH);
			}
		} catch (error) {
			console.warn(
				`[ChangeProcessor] Failed to analyze impact for ${analysis.relativePath}: ${error.message}`
			);
		}
	}

	/**
	 * Analyze batch-level impacts and relationships
	 */
	async _analyzeBatchImpact(analyses) {
		const batchAnalysis = {
			totalChanges: analyses.length,
			changeTypes: {},
			languageBreakdown: {},
			priorityBreakdown: {},
			affectedFilesCount: 0,
			hasCriticalChanges: false,
			recommendedAction: 'partial_invalidation'
		};

		const allAffectedFiles = new Set();

		for (const analysis of analyses) {
			// Count change types
			batchAnalysis.changeTypes[analysis.changeType] =
				(batchAnalysis.changeTypes[analysis.changeType] || 0) + 1;

			// Count languages
			batchAnalysis.languageBreakdown[analysis.language] =
				(batchAnalysis.languageBreakdown[analysis.language] || 0) + 1;

			// Count priorities
			batchAnalysis.priorityBreakdown[analysis.priority] =
				(batchAnalysis.priorityBreakdown[analysis.priority] || 0) + 1;

			// Track affected files
			analysis.affectedFiles.forEach((file) => allAffectedFiles.add(file));

			// Check for critical changes
			if (analysis.priority === ChangePriority.CRITICAL) {
				batchAnalysis.hasCriticalChanges = true;
			}
		}

		batchAnalysis.affectedFilesCount = allAffectedFiles.size;

		// Determine recommended action
		if (
			batchAnalysis.hasCriticalChanges ||
			batchAnalysis.affectedFilesCount > 20
		) {
			batchAnalysis.recommendedAction = 'full_invalidation';
		} else if (batchAnalysis.affectedFilesCount > 10) {
			batchAnalysis.recommendedAction = 'aggressive_invalidation';
		}

		return batchAnalysis;
	}

	/**
	 * Generate cache keys that need to be invalidated
	 */
	_generateCacheKeys(analysis) {
		const keys = [];
		const { relativePath, affectedFiles } = analysis;

		// Primary file cache key
		keys.push(this._generateCacheKey(relativePath));

		// Affected files cache keys
		affectedFiles.forEach((filePath) => {
			keys.push(this._generateCacheKey(filePath));
		});

		return [...new Set(keys)]; // Remove duplicates
	}

	/**
	 * Generate a cache key for a file
	 */
	_generateCacheKey(filePath) {
		// This should match the cache key generation in the cache manager
		const normalizedPath = path.posix.normalize(filePath);
		return `ast:${normalizedPath}`;
	}

	/**
	 * Calculate content hash for a file
	 */
	async _calculateFileHash(filePath) {
		try {
			const content = await fs.readFile(filePath, 'utf8');
			return crypto
				.createHash(this.options.contentHashAlgorithm)
				.update(content)
				.digest('hex');
		} catch (error) {
			return null;
		}
	}

	/**
	 * Check if file content has actually changed
	 */
	async _hasContentChanged(filePath) {
		try {
			const currentHash = await this._calculateFileHash(filePath);
			const relativePath = path.relative(this.projectPath, filePath);
			const previousHash = this.contentHashes.get(relativePath);

			return !previousHash || previousHash !== currentHash;
		} catch (error) {
			return true; // Assume changed if we can't determine
		}
	}

	/**
	 * Check if a file is a temporary file
	 */
	_isTempFile(filePath) {
		const tempPatterns = [
			/\.tmp$/,
			/\.temp$/,
			/~$/,
			/\.swp$/,
			/\.swo$/,
			/\.bak$/,
			/^\.#/,
			/#$/
		];

		return tempPatterns.some((pattern) => pattern.test(filePath));
	}

	/**
	 * Check if a file is an entry point
	 */
	_isEntryPoint(filePath) {
		const entryPatterns = [
			/^(index|main|app)\.(js|jsx|ts|tsx)$/,
			/^src\/(index|main|app)\.(js|jsx|ts|tsx)$/,
			/^__main__\.py$/,
			/^main\.go$/,
			/^main\.py$/
		];

		return entryPatterns.some((pattern) => pattern.test(filePath));
	}

	/**
	 * Check if a file is a core file
	 */
	_isCoreFile(filePath) {
		const corePatterns = [
			/^src\/.*\.(js|jsx|ts|tsx)$/,
			/^lib\/.*\.(js|jsx|ts|tsx)$/,
			/.*\/core\/.*$/,
			/.*\/utils\/.*$/,
			/.*\/helpers\/.*$/
		];

		return corePatterns.some((pattern) => pattern.test(filePath));
	}

	/**
	 * Check if a file is a configuration file
	 */
	_isConfigFile(filePath) {
		const configPatterns = [
			/package\.json$/,
			/tsconfig\.json$/,
			/\.eslintrc/,
			/webpack\.config/,
			/vite\.config/,
			/rollup\.config/,
			/go\.mod$/,
			/requirements\.txt$/,
			/pyproject\.toml$/,
			/setup\.py$/
		];

		return configPatterns.some((pattern) => pattern.test(filePath));
	}

	/**
	 * Adjust priority based on language and file characteristics
	 */
	_adjustPriorityForLanguage(priority, language, filePath) {
		switch (language) {
			case 'javascript':
			case 'typescript':
				if (filePath.includes('node_modules')) {
					return ChangePriority.LOW;
				}
				if (filePath.endsWith('.d.ts')) {
					return ChangePriority.LOW;
				}
				break;

			case 'python':
				if (filePath.endsWith('__pycache__')) {
					return ChangePriority.IGNORE;
				}
				if (filePath.endsWith('.pyc')) {
					return ChangePriority.IGNORE;
				}
				break;

			case 'go':
				if (filePath.endsWith('_test.go')) {
					return Math.max(priority, ChangePriority.MEDIUM);
				}
				break;
		}

		return priority;
	}

	/**
	 * Find files that depend on the given file
	 */
	_findDependentFiles(filePath) {
		// This is a simplified implementation
		// In a full implementation, this would use the dependency graph
		// built from import/export analysis

		const dependents = [];

		// For now, return cached dependency information if available
		if (this.dependencyGraph.has(filePath)) {
			return Array.from(this.dependencyGraph.get(filePath));
		}

		return dependents;
	}

	/**
	 * Update dependency graph with new relationships
	 */
	updateDependencyGraph(filePath, dependencies) {
		this.dependencyGraph.set(filePath, new Set(dependencies));
	}

	/**
	 * Get processing statistics
	 */
	getStats() {
		const uptime = Date.now() - this.stats.startTime;

		return {
			...this.stats,
			uptime,
			contentHashesStored: this.contentHashes.size,
			dependencyGraphSize: this.dependencyGraph.size
		};
	}

	/**
	 * Clear cached data
	 */
	clearCache() {
		this.contentHashes.clear();
		this.dependencyGraph.clear();
		console.debug('[ChangeProcessor] Cache cleared');
	}
}

/**
 * Create a new change processor instance
 */
export function createChangeProcessor(projectPath, options = {}) {
	return new ChangeProcessor(projectPath, options);
}

export default ChangeProcessor;
