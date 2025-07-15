import path from 'path';

/**
 * Invalidation strategies for different performance/accuracy trade-offs
 */
export const InvalidationStrategy = {
	CONSERVATIVE: 'conservative', // Invalidate more to be safe
	BALANCED: 'balanced', // Smart invalidation with moderate risk
	AGGRESSIVE: 'aggressive', // Minimal invalidation, maximum performance
	IMMEDIATE: 'immediate' // Invalidate everything for debugging
};

/**
 * Change impact classification
 */
export const ChangeImpact = {
	CRITICAL: 'critical', // API changes, exports, major structural changes
	HIGH: 'high', // Function/class changes that affect interface
	MEDIUM: 'medium', // Implementation changes within functions
	LOW: 'low', // Comments, formatting, minor changes
	NONE: 'none' // No semantic changes (whitespace only)
};

/**
 * Selective cache invalidation with strategy-based decision making
 */
export class SelectiveInvalidation {
	constructor(options = {}) {
		this.strategy = options.strategy || InvalidationStrategy.BALANCED;
		this.contentHasher = options.contentHasher;
		this.dependencyTracker = options.dependencyTracker;
		this.maxDepth = options.maxDepth || 5;
		this.previewMode = options.previewMode || false;

		// Invalidation history for rollback capability
		this.invalidationHistory = [];
		this.maxHistorySize = options.maxHistorySize || 100;

		// Strategy configurations
		this.strategyConfigs = {
			[InvalidationStrategy.CONSERVATIVE]: {
				maxDepth: 5,
				includeTransitive: true,
				impactThreshold: 3,
				includeTestFiles: true
			},
			[InvalidationStrategy.BALANCED]: {
				maxDepth: 2,
				includeTransitive: false,
				impactThreshold: 7,
				includeTestFiles: false
			},
			[InvalidationStrategy.AGGRESSIVE]: {
				maxDepth: 1,
				includeTransitive: false,
				impactThreshold: 8,
				includeTestFiles: false
			},
			[InvalidationStrategy.IMMEDIATE]: {
				invalidateAll: true
			}
		};

		// Statistics
		this.stats = {
			invalidationsPerformed: 0,
			filesInvalidated: 0,
			strategiesUsed: {},
			averageScope: 0,
			rollbacksPerformed: 0
		};
	}

	/**
	 * Main invalidation entry point
	 */
	async invalidateByChange(changeEvent, options = {}) {
		const strategy = options.strategy || this.strategy;
		const { filePath, changeType, oldContent, newContent } = changeEvent;

		try {
			// Analyze change impact if content is available
			let changeImpact = ChangeImpact.MEDIUM;
			if (oldContent && newContent && this.contentHasher) {
				changeImpact = await this._analyzeChangeImpact(
					filePath,
					oldContent,
					newContent
				);
			}

			// Skip if no semantic changes detected
			if (changeImpact === ChangeImpact.NONE) {
				return {
					invalidated: [],
					reason: 'no_semantic_changes',
					strategy,
					changeImpact
				};
			}

			// Calculate invalidation scope based on strategy
			const scope = await this._calculateInvalidationScope(
				filePath,
				strategy,
				changeImpact
			);

			// Preview mode - return what would be invalidated without doing it
			if (this.previewMode || options.preview) {
				return {
					preview: true,
					scope,
					strategy,
					changeImpact,
					estimatedFiles: scope.total || 0
				};
			}

			// Execute invalidation
			const invalidated = await this._executeInvalidation(scope);

			// Record for potential rollback
			this._recordInvalidation({
				id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
				filePath,
				strategy,
				changeImpact,
				scope,
				invalidated,
				timestamp: new Date()
			});

			// Update statistics
			this._updateStats(strategy, invalidated.length);

			return {
				invalidated,
				scope,
				strategy,
				changeImpact,
				reason: 'change_detected'
			};
		} catch (error) {
			console.error(
				`[SelectiveInvalidation] Error processing change for ${filePath}: ${error.message}`
			);
			return {
				invalidated: [],
				error: error.message,
				strategy,
				reason: 'error'
			};
		}
	}

	/**
	 * Invalidate based on dependency changes
	 */
	async invalidateByDependency(filePath, dependencyGraph, options = {}) {
		const strategy = options.strategy || this.strategy;

		if (!this.dependencyTracker) {
			throw new Error(
				'Dependency tracker required for dependency-based invalidation'
			);
		}

		const dependents = this.dependencyTracker.getDependents(filePath);
		const impactScore = this.dependencyTracker.calculateImpactScore(filePath);

		const scope = {
			direct: [filePath],
			dependents: dependents,
			reason: 'dependency_change',
			impactScore
		};

		if (this.previewMode || options.preview) {
			return { preview: true, scope, strategy };
		}

		const invalidated = await this._executeInvalidation(scope);

		this._recordInvalidation({
			id: `dep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			filePath,
			strategy,
			scope,
			invalidated,
			timestamp: new Date()
		});

		this._updateStats(strategy, invalidated.length);

		return { invalidated, scope, strategy };
	}

	/**
	 * Invalidate based on content hash changes
	 */
	async invalidateByContent(filePath, oldHash, newHash, options = {}) {
		if (!this.contentHasher) {
			throw new Error('Content hasher required for content-based invalidation');
		}

		// Skip if hashes are the same
		if (oldHash === newHash) {
			return {
				invalidated: [],
				reason: 'content_unchanged',
				oldHash,
				newHash
			};
		}

		// Treat as medium impact change
		return this.invalidateByChange(
			{
				filePath,
				changeType: 'content',
				reason: 'hash_mismatch'
			},
			options
		);
	}

	/**
	 * Calculate invalidation scope based on strategy and change impact
	 */
	async _calculateInvalidationScope(filePath, strategy, changeImpact) {
		const config = this.strategyConfigs[strategy];

		if (config.invalidateAll) {
			return {
				type: 'all',
				reason: 'immediate_strategy',
				total: this.dependencyTracker
					? this.dependencyTracker.mainDependencyGraph.size
					: 1
			};
		}

		const scope = {
			direct: [filePath],
			dependents: [],
			transitive: [],
			testFiles: [],
			total: 0
		};

		if (!this.dependencyTracker) {
			scope.total = 1;
			return scope;
		}

		const impactScore = this.dependencyTracker.calculateImpactScore(filePath);
		const directDependents = this.dependencyTracker.getDependents(filePath);

		// Adjust scope based on change impact
		let effectiveDepth = config.maxDepth;
		let effectiveImpactThreshold = config.impactThreshold;

		switch (changeImpact) {
			case ChangeImpact.CRITICAL:
				effectiveDepth = Math.min(effectiveDepth + 2, this.maxDepth);
				effectiveImpactThreshold = Math.max(effectiveImpactThreshold - 3, 1);
				break;
			case ChangeImpact.HIGH:
				effectiveDepth = Math.min(effectiveDepth + 1, this.maxDepth);
				effectiveImpactThreshold = Math.max(effectiveImpactThreshold - 1, 1);
				break;
			case ChangeImpact.LOW:
				effectiveDepth = Math.max(effectiveDepth - 1, 1);
				effectiveImpactThreshold = Math.min(effectiveImpactThreshold + 1, 10);
				break;
		}

		// Get dependents based on impact score and strategy
		for (const dependent of directDependents) {
			const dependentImpactScore =
				this.dependencyTracker.calculateImpactScore(dependent);

			if (dependentImpactScore >= effectiveImpactThreshold) {
				scope.dependents.push(dependent);
			}
		}

		// Get transitive dependencies if enabled
		if (config.includeTransitive && effectiveDepth > 1) {
			const transitive = await this._getTransitiveDependents(
				filePath,
				effectiveDepth - 1,
				effectiveImpactThreshold
			);
			scope.transitive = transitive.filter(
				(f) => !scope.direct.includes(f) && !scope.dependents.includes(f)
			);
		}

		// Include test files if strategy allows
		if (config.includeTestFiles) {
			const allFiles = [
				...scope.direct,
				...scope.dependents,
				...scope.transitive
			];
			for (const file of allFiles) {
				const testFiles = this._findRelatedTestFiles(file);
				scope.testFiles.push(...testFiles);
			}
		}

		scope.total =
			scope.direct.length +
			scope.dependents.length +
			scope.transitive.length +
			scope.testFiles.length;

		return scope;
	}

	/**
	 * Get transitive dependents up to specified depth
	 */
	async _getTransitiveDependents(filePath, depth, impactThreshold = 0) {
		if (depth <= 0 || !this.dependencyTracker) {
			return [];
		}

		const visited = new Set();
		const transitive = [];
		const toProcess = [{ file: filePath, currentDepth: 0 }];

		while (toProcess.length > 0) {
			const { file, currentDepth } = toProcess.shift();

			if (visited.has(file) || currentDepth >= depth) {
				continue;
			}

			visited.add(file);

			const dependents = this.dependencyTracker.getDependents(file);

			for (const dependent of dependents) {
				const dependentImpactScore =
					this.dependencyTracker.calculateImpactScore(dependent);

				if (dependentImpactScore >= impactThreshold) {
					if (!transitive.includes(dependent)) {
						transitive.push(dependent);
					}

					if (currentDepth + 1 < depth) {
						toProcess.push({ file: dependent, currentDepth: currentDepth + 1 });
					}
				}
			}
		}

		return transitive;
	}

	/**
	 * Find related test files for a given file
	 */
	_findRelatedTestFiles(filePath) {
		if (!this.dependencyTracker) return [];

		const testFiles = [];
		const baseName = path.basename(filePath, path.extname(filePath));
		const dirName = path.dirname(filePath);

		// Common test file patterns
		const testPatterns = [
			`${baseName}.test.js`,
			`${baseName}.test.ts`,
			`${baseName}.spec.js`,
			`${baseName}.spec.ts`,
			`${baseName}_test.py`,
			`${baseName}_test.go`
		];

		// Check common test directories
		const testDirs = [
			path.join(dirName, '__tests__'),
			path.join(dirName, 'tests'),
			path.join(dirName, 'test'),
			path.join(dirName, 'spec')
		];

		for (const testDir of testDirs) {
			for (const pattern of testPatterns) {
				const testFilePath = path.join(testDir, pattern);
				if (this.dependencyTracker.testDependencyGraph.has(testFilePath)) {
					testFiles.push(testFilePath);
				}
			}
		}

		// Also check same directory
		for (const pattern of testPatterns) {
			const testFilePath = path.join(dirName, pattern);
			if (this.dependencyTracker.testDependencyGraph.has(testFilePath)) {
				testFiles.push(testFilePath);
			}
		}

		return testFiles;
	}

	/**
	 * Execute the actual invalidation
	 */
	async _executeInvalidation(scope) {
		const invalidated = [];

		if (scope.type === 'all') {
			// Invalidate everything - this would integrate with cache manager
			if (this.dependencyTracker) {
				invalidated.push(...this.dependencyTracker.mainDependencyGraph.keys());
				if (this.dependencyTracker.trackTestFiles) {
					invalidated.push(
						...this.dependencyTracker.testDependencyGraph.keys()
					);
				}
			}
		} else {
			// Selective invalidation
			const filesToInvalidate = [
				...scope.direct,
				...scope.dependents,
				...scope.transitive,
				...scope.testFiles
			];

			invalidated.push(...filesToInvalidate);
		}

		// Remove duplicates
		const uniqueInvalidated = [...new Set(invalidated)];

		// Here we would actually invalidate cache entries
		// This would integrate with the cache manager from Phase 1.4
		for (const filePath of uniqueInvalidated) {
			await this._invalidateCacheEntry(filePath);
		}

		return uniqueInvalidated;
	}

	/**
	 * Invalidate a single cache entry
	 */
	async _invalidateCacheEntry(filePath) {
		// This would integrate with the actual cache manager
		// For now, just log the invalidation
		console.debug(
			`[SelectiveInvalidation] Invalidating cache for: ${filePath}`
		);
	}

	/**
	 * Analyze change impact based on content differences
	 */
	async _analyzeChangeImpact(filePath, oldContent, newContent) {
		if (!oldContent || !newContent) {
			return ChangeImpact.MEDIUM;
		}

		// Generate normalized hashes to detect semantic changes
		const language = this.contentHasher._detectLanguage(path.extname(filePath));
		const oldHash = await this.contentHasher.generateHash(
			filePath,
			oldContent,
			language
		);
		const newHash = await this.contentHasher.generateHash(
			filePath,
			newContent,
			language
		);

		// No semantic changes
		if (oldHash === newHash) {
			return ChangeImpact.NONE;
		}

		// Analyze specific changes to determine impact level
		const changes = this._analyzeContentChanges(
			oldContent,
			newContent,
			language
		);

		if (changes.exportsChanged || changes.apiChanges) {
			return ChangeImpact.CRITICAL;
		}

		if (changes.functionsChanged || changes.classesChanged) {
			return ChangeImpact.HIGH;
		}

		if (changes.implementationOnly) {
			return ChangeImpact.MEDIUM;
		}

		return ChangeImpact.LOW;
	}

	/**
	 * Analyze specific content changes
	 */
	_analyzeContentChanges(oldContent, newContent, language) {
		const changes = {
			exportsChanged: false,
			apiChanges: false,
			functionsChanged: false,
			classesChanged: false,
			implementationOnly: false
		};

		switch (language) {
			case 'javascript':
			case 'typescript':
				return this._analyzeJSChanges(oldContent, newContent);
			case 'python':
				return this._analyzePythonChanges(oldContent, newContent);
			case 'go':
				return this._analyzeGoChanges(oldContent, newContent);
			default:
				// For unknown languages, assume medium impact
				changes.implementationOnly = true;
				return changes;
		}
	}

	/**
	 * Analyze JavaScript/TypeScript changes
	 */
	_analyzeJSChanges(oldContent, newContent) {
		const changes = {
			exportsChanged: false,
			apiChanges: false,
			functionsChanged: false,
			classesChanged: false,
			implementationOnly: false
		};

		// Check for export changes
		const oldExports = this._extractJSExports(oldContent);
		const newExports = this._extractJSExports(newContent);

		if (JSON.stringify(oldExports) !== JSON.stringify(newExports)) {
			changes.exportsChanged = true;
			changes.apiChanges = true;
		}

		// Check for function signature changes
		const oldFunctions = this._extractJSFunctions(oldContent);
		const newFunctions = this._extractJSFunctions(newContent);

		if (JSON.stringify(oldFunctions) !== JSON.stringify(newFunctions)) {
			changes.functionsChanged = true;
		}

		// Check for class changes
		const oldClasses = this._extractJSClasses(oldContent);
		const newClasses = this._extractJSClasses(newContent);

		if (JSON.stringify(oldClasses) !== JSON.stringify(newClasses)) {
			changes.classesChanged = true;
		}

		// If only implementation changed
		if (!changes.exportsChanged && !changes.apiChanges) {
			changes.implementationOnly = true;
		}

		return changes;
	}

	/**
	 * Extract JavaScript exports for comparison
	 */
	_extractJSExports(content) {
		const exports = [];

		// Named exports
		const namedExportRegex =
			/export\s+(?:const|let|var|function|class)\s+(\w+)/g;
		let match;
		while ((match = namedExportRegex.exec(content)) !== null) {
			exports.push(match[1]);
		}

		// Export statements
		const exportStatementRegex = /export\s*\{([^}]+)\}/g;
		while ((match = exportStatementRegex.exec(content)) !== null) {
			const exportList = match[1]
				.split(',')
				.map((e) => e.trim().split(' as ')[0].trim());
			exports.push(...exportList);
		}

		// Default exports
		if (/export\s+default/.test(content)) {
			exports.push('default');
		}

		return exports.sort();
	}

	/**
	 * Extract JavaScript function signatures
	 */
	_extractJSFunctions(content) {
		const functions = [];

		// Function declarations
		const functionRegex =
			/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)/g;
		let match;
		while ((match = functionRegex.exec(content)) !== null) {
			functions.push(match[1]);
		}

		// Arrow functions assigned to variables
		const arrowFunctionRegex =
			/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\)|[^=])\s*=>/g;
		while ((match = arrowFunctionRegex.exec(content)) !== null) {
			functions.push(match[1]);
		}

		return functions.sort();
	}

	/**
	 * Extract JavaScript class names
	 */
	_extractJSClasses(content) {
		const classes = [];

		const classRegex = /(?:export\s+)?class\s+(\w+)/g;
		let match;
		while ((match = classRegex.exec(content)) !== null) {
			classes.push(match[1]);
		}

		return classes.sort();
	}

	/**
	 * Analyze Python changes (simplified)
	 */
	_analyzePythonChanges(oldContent, newContent) {
		const changes = {
			exportsChanged: false,
			apiChanges: false,
			functionsChanged: false,
			classesChanged: false,
			implementationOnly: true
		};

		// For now, assume any change in Python could affect imports
		// A more sophisticated analysis would parse the AST
		if (oldContent !== newContent) {
			changes.functionsChanged = true;
		}

		return changes;
	}

	/**
	 * Analyze Go changes (simplified)
	 */
	_analyzeGoChanges(oldContent, newContent) {
		const changes = {
			exportsChanged: false,
			apiChanges: false,
			functionsChanged: false,
			classesChanged: false,
			implementationOnly: true
		};

		// Check for public function changes (functions starting with capital letter)
		const oldPublicFuncs = this._extractGoPublicFunctions(oldContent);
		const newPublicFuncs = this._extractGoPublicFunctions(newContent);

		if (JSON.stringify(oldPublicFuncs) !== JSON.stringify(newPublicFuncs)) {
			changes.exportsChanged = true;
			changes.apiChanges = true;
		}

		return changes;
	}

	/**
	 * Extract Go public functions
	 */
	_extractGoPublicFunctions(content) {
		const functions = [];

		const functionRegex = /func\s+([A-Z]\w*)\s*\(/g;
		let match;
		while ((match = functionRegex.exec(content)) !== null) {
			functions.push(match[1]);
		}

		return functions.sort();
	}

	/**
	 * Preview invalidation without executing
	 */
	async previewInvalidation(changes, strategy = null) {
		const previews = [];

		for (const changeEvent of changes) {
			const preview = await this.invalidateByChange(changeEvent, {
				strategy: strategy || this.strategy,
				preview: true
			});
			previews.push({
				file: changeEvent.filePath,
				...preview
			});
		}

		return previews;
	}

	/**
	 * Rollback a previous invalidation
	 */
	async rollbackInvalidation(invalidationId) {
		const invalidation = this.invalidationHistory.find(
			(inv) => inv.id === invalidationId
		);

		if (!invalidation) {
			throw new Error(`Invalidation ${invalidationId} not found in history`);
		}

		// This would restore cache entries that were invalidated
		for (const filePath of invalidation.invalidated) {
			await this._restoreCacheEntry(filePath);
		}

		this.stats.rollbacksPerformed++;

		return {
			rolledBack: invalidation.invalidated.length,
			invalidation
		};
	}

	/**
	 * Restore a cache entry (placeholder)
	 */
	async _restoreCacheEntry(filePath) {
		console.debug(`[SelectiveInvalidation] Restoring cache for: ${filePath}`);
	}

	/**
	 * Record invalidation for potential rollback
	 */
	_recordInvalidation(invalidation) {
		this.invalidationHistory.push(invalidation);

		// Keep history size manageable
		if (this.invalidationHistory.length > this.maxHistorySize) {
			this.invalidationHistory.shift();
		}
	}

	/**
	 * Update statistics
	 */
	_updateStats(strategy, filesInvalidated) {
		this.stats.invalidationsPerformed++;
		this.stats.filesInvalidated += filesInvalidated;

		if (!this.stats.strategiesUsed[strategy]) {
			this.stats.strategiesUsed[strategy] = 0;
		}
		this.stats.strategiesUsed[strategy]++;

		this.stats.averageScope =
			this.stats.filesInvalidated / this.stats.invalidationsPerformed;
	}

	/**
	 * Get invalidation statistics
	 */
	getStats() {
		return {
			...this.stats,
			historySize: this.invalidationHistory.length,
			currentStrategy: this.strategy
		};
	}

	/**
	 * Clear invalidation history
	 */
	clearHistory() {
		this.invalidationHistory = [];
	}
}

/**
 * Create a new selective invalidation instance
 */
export function createSelectiveInvalidation(options = {}) {
	return new SelectiveInvalidation(options);
}

export default SelectiveInvalidation;
