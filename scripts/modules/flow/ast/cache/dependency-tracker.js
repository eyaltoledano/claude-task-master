import path from 'path';
import fs from 'fs-extra';

/**
 * Dependency types for classification
 */
export const DependencyTypes = {
	IMPORT: 'import', // Static import/require statements
	DYNAMIC: 'dynamic', // Dynamic imports/requires
	REFERENCE: 'reference', // String references to files
	CONFIG: 'config', // Configuration file dependencies
	ASSET: 'asset', // Asset file references
	TEST: 'test' // Test file relationships
};

/**
 * Enhanced dependency tracker with multi-language support
 * Handles static analysis, dynamic import detection, and impact scoring
 */
export class DependencyTracker {
	constructor(options = {}) {
		this.maxDepth = options.maxDepth || 5;
		this.trackTestFiles = options.trackTestFiles !== false;
		this.trackDynamicImports = options.trackDynamicImports !== false;
		this.crossLanguageSupport = options.crossLanguageSupport !== false;
		this.circularDetection = options.circularDetection !== false;

		// Separate graphs for main and test dependencies
		this.mainDependencyGraph = new Map();
		this.testDependencyGraph = new Map();
		this.reverseDependencyGraph = new Map();

		// Dynamic imports tracking
		this.dynamicImports = new Map();

		// File metadata cache
		this.fileMetadata = new Map();

		// Statistics
		this.stats = {
			filesAnalyzed: 0,
			dependenciesFound: 0,
			dynamicImportsFound: 0,
			circularDependencies: 0,
			errors: 0
		};
	}

	/**
	 * Build dependency graph for a project
	 */
	async buildDependencyGraph(projectPath, files) {
		console.debug(
			`[DependencyTracker] Building dependency graph for ${files.length} files`
		);

		this.clear();

		// First pass: analyze all files and collect dependencies
		for (const filePath of files) {
			try {
				await this._analyzeFile(filePath, projectPath);
			} catch (error) {
				this.stats.errors++;
				console.error(
					`[DependencyTracker] Error analyzing ${filePath}: ${error.message}`
				);
			}
		}

		// Second pass: resolve cross-references and build reverse graph
		this._buildReverseGraph();

		// Third pass: detect circular dependencies if enabled
		if (this.circularDetection) {
			this._detectCircularDependencies();
		}

		console.debug(
			`[DependencyTracker] Analysis complete: ${this.stats.dependenciesFound} dependencies found`
		);

		return {
			mainGraph: this.mainDependencyGraph,
			testGraph: this.testDependencyGraph,
			reverseGraph: this.reverseDependencyGraph,
			stats: this.getStats()
		};
	}

	/**
	 * Update dependencies for a specific file
	 */
	async updateDependencies(filePath, dependencies) {
		const isTestFile = this.isTestFile(filePath);
		const graph = isTestFile
			? this.testDependencyGraph
			: this.mainDependencyGraph;

		// Remove old dependencies from reverse graph
		if (graph.has(filePath)) {
			const oldDeps = graph.get(filePath);
			this._removeFromReverseGraph(filePath, oldDeps);
		}

		// Update main graph
		graph.set(filePath, dependencies);

		// Update reverse graph
		this._addToReverseGraph(filePath, dependencies);

		this.stats.dependenciesFound += dependencies.length;
	}

	/**
	 * Get files that depend on the given file
	 */
	getDependents(filePath) {
		return this.reverseDependencyGraph.get(filePath) || [];
	}

	/**
	 * Get files that the given file depends on
	 */
	getDependencies(filePath) {
		const isTestFile = this.isTestFile(filePath);
		const graph = isTestFile
			? this.testDependencyGraph
			: this.mainDependencyGraph;
		return graph.get(filePath) || [];
	}

	/**
	 * Get all files impacted by changes to the given files
	 */
	async getImpactedFiles(changedFiles) {
		const impacted = new Set(changedFiles);
		const toProcess = [...changedFiles];
		const processed = new Set();

		while (toProcess.length > 0) {
			const currentFile = toProcess.shift();

			if (processed.has(currentFile)) continue;
			processed.add(currentFile);

			const dependents = this.getDependents(currentFile);

			for (const dependent of dependents) {
				if (!impacted.has(dependent)) {
					impacted.add(dependent);
					toProcess.push(dependent);
				}
			}
		}

		return Array.from(impacted);
	}

	/**
	 * Detect circular dependencies
	 */
	detectCircularDependencies() {
		return this._detectCircularDependencies();
	}

	/**
	 * Calculate impact score for a file
	 */
	calculateImpactScore(filePath) {
		const dependents = this.getDependents(filePath);
		const dependencies = this.getDependencies(filePath);
		const depth = this._calculateDepth(filePath);
		const isTestFile = this.isTestFile(filePath);

		// Research-based scoring algorithm
		let score = 0;

		// Base score from dependent count (files that depend on this one)
		score += dependents.length * 2;

		// Bonus for being a dependency of many files
		score += Math.min(dependents.length / 5, 3);

		// Penalty for deep dependency chains
		score += Math.max(0, 5 - depth);

		// Test files have slightly lower priority
		if (isTestFile) {
			score -= 1;
		}

		// Bonus for having many dependencies (likely core files)
		score += Math.min(dependencies.length / 10, 2);

		return Math.max(1, Math.min(score, 10)); // Cap between 1-10
	}

	/**
	 * Check if a file is a test file
	 */
	isTestFile(filePath) {
		const testPatterns = [
			/\.test\./,
			/\.spec\./,
			/\/__tests__\//,
			/\/tests?\//,
			/\/spec\//,
			/test_.*\.py$/,
			/_test\.go$/
		];

		return testPatterns.some((pattern) => pattern.test(filePath));
	}

	/**
	 * Analyze a single file for dependencies
	 */
	async _analyzeFile(filePath, projectRoot) {
		if (!(await fs.pathExists(filePath))) {
			return;
		}

		this.stats.filesAnalyzed++;

		const content = await fs.readFile(filePath, 'utf8');
		const ext = path.extname(filePath);
		const language = this._detectLanguage(ext);

		// Store file metadata
		this.fileMetadata.set(filePath, {
			language,
			extension: ext,
			isTest: this.isTestFile(filePath),
			size: content.length,
			lastAnalyzed: new Date()
		});

		const dependencies = await this._extractDependencies(
			filePath,
			content,
			language,
			projectRoot
		);
		await this.updateDependencies(filePath, dependencies);
	}

	/**
	 * Extract dependencies from file content
	 */
	async _extractDependencies(filePath, content, language, projectRoot) {
		const dependencies = [];

		switch (language) {
			case 'javascript':
			case 'typescript':
				dependencies.push(
					...this._extractJSDependencies(content, filePath, projectRoot)
				);
				break;
			case 'python':
				dependencies.push(
					...this._extractPythonDependencies(content, filePath, projectRoot)
				);
				break;
			case 'go':
				dependencies.push(
					...this._extractGoDependencies(content, filePath, projectRoot)
				);
				break;
			case 'json':
				dependencies.push(
					...this._extractJSONDependencies(content, filePath, projectRoot)
				);
				break;
		}

		// Add cross-language dependencies if enabled
		if (this.crossLanguageSupport) {
			dependencies.push(
				...this._extractCrossLanguageDependencies(
					content,
					filePath,
					projectRoot
				)
			);
		}

		return dependencies;
	}

	/**
	 * Extract JavaScript/TypeScript dependencies
	 */
	_extractJSDependencies(content, filePath, projectRoot) {
		const dependencies = [];

		// Static imports - import/export statements
		const importRegex = /(?:import|export).*?from\s+['"`]([^'"`]+)['"`]/g;
		let match;
		while ((match = importRegex.exec(content)) !== null) {
			const modulePath = this._resolveModulePath(
				match[1],
				filePath,
				projectRoot
			);
			if (modulePath) {
				dependencies.push({
					path: modulePath,
					type: DependencyTypes.IMPORT,
					raw: match[1],
					line: this._getLineNumber(content, match.index)
				});
			}
		}

		// Static require statements
		const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
		while ((match = requireRegex.exec(content)) !== null) {
			const modulePath = this._resolveModulePath(
				match[1],
				filePath,
				projectRoot
			);
			if (modulePath) {
				dependencies.push({
					path: modulePath,
					type: DependencyTypes.IMPORT,
					raw: match[1],
					line: this._getLineNumber(content, match.index)
				});
			}
		}

		// Dynamic imports if enabled
		if (this.trackDynamicImports) {
			// Dynamic import() calls
			const dynamicImportRegex = /import\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g;
			while ((match = dynamicImportRegex.exec(content)) !== null) {
				const modulePath = this._resolveModulePath(
					match[2],
					filePath,
					projectRoot
				);
				if (modulePath) {
					dependencies.push({
						path: modulePath,
						type: DependencyTypes.DYNAMIC,
						raw: match[2],
						line: this._getLineNumber(content, match.index)
					});
					this.stats.dynamicImportsFound++;
				}
			}

			// Dynamic require with variables (mark as unresolved)
			const dynamicRequireRegex = /require\s*\(\s*[^'"`][^)]*\)/g;
			while ((match = dynamicRequireRegex.exec(content)) !== null) {
				dependencies.push({
					path: null,
					type: DependencyTypes.DYNAMIC,
					raw: match[0],
					resolved: false,
					line: this._getLineNumber(content, match.index)
				});
				this.stats.dynamicImportsFound++;
			}
		}

		return dependencies;
	}

	/**
	 * Extract Python dependencies
	 */
	_extractPythonDependencies(content, filePath, projectRoot) {
		const dependencies = [];

		// Static imports
		const importRegex = /^(?:from\s+([^\s]+)\s+)?import\s+([^\s#]+)/gm;
		let match;
		while ((match = importRegex.exec(content)) !== null) {
			const fromModule = match[1];
			const importedModule = match[2];

			const modulePath = this._resolvePythonModule(
				fromModule || importedModule,
				filePath,
				projectRoot
			);
			if (modulePath) {
				dependencies.push({
					path: modulePath,
					type: DependencyTypes.IMPORT,
					raw: match[0],
					line: this._getLineNumber(content, match.index)
				});
			}
		}

		// Dynamic imports if enabled
		if (this.trackDynamicImports) {
			// importlib.import_module
			const dynamicImportRegex =
				/importlib\.import_module\s*\(\s*['"`]([^'"`]+)['"`]/g;
			while ((match = dynamicImportRegex.exec(content)) !== null) {
				const modulePath = this._resolvePythonModule(
					match[1],
					filePath,
					projectRoot
				);
				if (modulePath) {
					dependencies.push({
						path: modulePath,
						type: DependencyTypes.DYNAMIC,
						raw: match[1],
						line: this._getLineNumber(content, match.index)
					});
					this.stats.dynamicImportsFound++;
				}
			}

			// __import__ calls
			const builtinImportRegex = /__import__\s*\(\s*['"`]([^'"`]+)['"`]/g;
			while ((match = builtinImportRegex.exec(content)) !== null) {
				const modulePath = this._resolvePythonModule(
					match[1],
					filePath,
					projectRoot
				);
				if (modulePath) {
					dependencies.push({
						path: modulePath,
						type: DependencyTypes.DYNAMIC,
						raw: match[1],
						line: this._getLineNumber(content, match.index)
					});
					this.stats.dynamicImportsFound++;
				}
			}
		}

		return dependencies;
	}

	/**
	 * Extract Go dependencies
	 */
	_extractGoDependencies(content, filePath, projectRoot) {
		const dependencies = [];

		// Go imports are always static
		const importRegex = /import\s+(?:\(\s*([\s\S]*?)\s*\)|"([^"]+)")/g;
		let match;

		while ((match = importRegex.exec(content)) !== null) {
			if (match[1]) {
				// Multi-line import block
				const imports = match[1].split('\n');
				for (const imp of imports) {
					const cleaned = imp.trim().replace(/^["']|["']$/g, '');
					if (cleaned && !cleaned.startsWith('//')) {
						const modulePath = this._resolveGoModule(
							cleaned,
							filePath,
							projectRoot
						);
						if (modulePath) {
							dependencies.push({
								path: modulePath,
								type: DependencyTypes.IMPORT,
								raw: cleaned,
								line: this._getLineNumber(content, match.index)
							});
						}
					}
				}
			} else if (match[2]) {
				// Single import
				const modulePath = this._resolveGoModule(
					match[2],
					filePath,
					projectRoot
				);
				if (modulePath) {
					dependencies.push({
						path: modulePath,
						type: DependencyTypes.IMPORT,
						raw: match[2],
						line: this._getLineNumber(content, match.index)
					});
				}
			}
		}

		return dependencies;
	}

	/**
	 * Extract JSON dependencies (package.json, etc.)
	 */
	_extractJSONDependencies(content, filePath, projectRoot) {
		const dependencies = [];

		try {
			const parsed = JSON.parse(content);

			// For package.json files
			if (path.basename(filePath) === 'package.json') {
				const depTypes = [
					'dependencies',
					'devDependencies',
					'peerDependencies',
					'optionalDependencies'
				];

				for (const depType of depTypes) {
					if (parsed[depType]) {
						for (const packageName of Object.keys(parsed[depType])) {
							dependencies.push({
								path: packageName,
								type: DependencyTypes.CONFIG,
								raw: packageName,
								packageType: depType
							});
						}
					}
				}
			}
		} catch (error) {
			// Invalid JSON, skip
		}

		return dependencies;
	}

	/**
	 * Extract cross-language dependencies
	 */
	_extractCrossLanguageDependencies(content, filePath, projectRoot) {
		const dependencies = [];

		// Look for file references in strings
		const fileRefRegex =
			/['"`]([^'"`]*\.(?:js|ts|py|go|json|yaml|yml|toml))['"]/g;
		let match;

		while ((match = fileRefRegex.exec(content)) !== null) {
			const referencedPath = this._resolveRelativePath(
				match[1],
				filePath,
				projectRoot
			);
			if (referencedPath && referencedPath !== filePath) {
				dependencies.push({
					path: referencedPath,
					type: DependencyTypes.REFERENCE,
					raw: match[1],
					line: this._getLineNumber(content, match.index)
				});
			}
		}

		return dependencies;
	}

	/**
	 * Resolve module path to absolute file path
	 */
	_resolveModulePath(modulePath, fromFile, projectRoot) {
		// Relative imports
		if (modulePath.startsWith('.')) {
			return this._resolveRelativePath(modulePath, fromFile, projectRoot);
		}

		// Node modules or built-in modules - we don't track these
		return null;
	}

	/**
	 * Resolve relative path
	 */
	_resolveRelativePath(relativePath, fromFile, projectRoot) {
		const fromDir = path.dirname(fromFile);
		let resolved = path.resolve(fromDir, relativePath);

		// Try common extensions if file doesn't exist
		const extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.go'];

		if (!fs.existsSync(resolved)) {
			for (const ext of extensions) {
				const withExt = resolved + ext;
				if (fs.existsSync(withExt)) {
					resolved = withExt;
					break;
				}
			}
		}

		// Check if it's within project root
		if (resolved.startsWith(projectRoot) && fs.existsSync(resolved)) {
			return resolved;
		}

		return null;
	}

	/**
	 * Resolve Python module path
	 */
	_resolvePythonModule(modulePath, fromFile, projectRoot) {
		// For now, we only handle relative imports within the project
		if (modulePath.startsWith('.')) {
			return this._resolveRelativePath(
				modulePath.replace(/\./g, '/') + '.py',
				fromFile,
				projectRoot
			);
		}

		// Check if it's a local module in the project
		const possiblePath = path.join(
			projectRoot,
			modulePath.replace(/\./g, '/') + '.py'
		);
		if (fs.existsSync(possiblePath)) {
			return possiblePath;
		}

		return null;
	}

	/**
	 * Resolve Go module path
	 */
	_resolveGoModule(modulePath, fromFile, projectRoot) {
		// For now, we only handle local modules within the project
		if (
			modulePath.includes('/') &&
			!modulePath.includes('github.com') &&
			!modulePath.includes('golang.org')
		) {
			const possiblePath = path.join(projectRoot, modulePath);
			if (
				fs.existsSync(possiblePath) &&
				fs.statSync(possiblePath).isDirectory()
			) {
				return possiblePath;
			}
		}

		return null;
	}

	/**
	 * Get line number for a given string index
	 */
	_getLineNumber(content, index) {
		return content.substring(0, index).split('\n').length;
	}

	/**
	 * Build reverse dependency graph
	 */
	_buildReverseGraph() {
		this.reverseDependencyGraph.clear();

		const processGraph = (graph) => {
			for (const [filePath, dependencies] of graph.entries()) {
				for (const dep of dependencies) {
					if (dep.path && dep.type !== DependencyTypes.CONFIG) {
						if (!this.reverseDependencyGraph.has(dep.path)) {
							this.reverseDependencyGraph.set(dep.path, []);
						}
						this.reverseDependencyGraph.get(dep.path).push(filePath);
					}
				}
			}
		};

		processGraph(this.mainDependencyGraph);
		if (this.trackTestFiles) {
			processGraph(this.testDependencyGraph);
		}
	}

	/**
	 * Add dependencies to reverse graph
	 */
	_addToReverseGraph(filePath, dependencies) {
		for (const dep of dependencies) {
			if (dep.path && dep.type !== DependencyTypes.CONFIG) {
				if (!this.reverseDependencyGraph.has(dep.path)) {
					this.reverseDependencyGraph.set(dep.path, []);
				}
				const dependents = this.reverseDependencyGraph.get(dep.path);
				if (!dependents.includes(filePath)) {
					dependents.push(filePath);
				}
			}
		}
	}

	/**
	 * Remove dependencies from reverse graph
	 */
	_removeFromReverseGraph(filePath, dependencies) {
		for (const dep of dependencies) {
			if (dep.path && this.reverseDependencyGraph.has(dep.path)) {
				const dependents = this.reverseDependencyGraph.get(dep.path);
				const index = dependents.indexOf(filePath);
				if (index !== -1) {
					dependents.splice(index, 1);
				}
				if (dependents.length === 0) {
					this.reverseDependencyGraph.delete(dep.path);
				}
			}
		}
	}

	/**
	 * Calculate dependency depth for a file
	 */
	_calculateDepth(filePath, visited = new Set()) {
		if (visited.has(filePath)) {
			return Infinity; // Circular dependency
		}

		visited.add(filePath);

		const dependencies = this.getDependencies(filePath);
		if (dependencies.length === 0) {
			return 0;
		}

		let maxDepth = 0;
		for (const dep of dependencies) {
			if (dep.path && dep.type !== DependencyTypes.CONFIG) {
				const depth = this._calculateDepth(dep.path, new Set(visited));
				maxDepth = Math.max(maxDepth, depth);
			}
		}

		return 1 + maxDepth;
	}

	/**
	 * Detect circular dependencies
	 */
	_detectCircularDependencies() {
		const circular = [];
		const visited = new Set();
		const recursionStack = new Set();

		const detectCycle = (filePath, path = []) => {
			if (recursionStack.has(filePath)) {
				// Found a cycle
				const cycleStart = path.indexOf(filePath);
				const cycle = path.slice(cycleStart).concat([filePath]);
				circular.push(cycle);
				this.stats.circularDependencies++;
				return true;
			}

			if (visited.has(filePath)) {
				return false;
			}

			visited.add(filePath);
			recursionStack.add(filePath);

			const dependencies = this.getDependencies(filePath);
			for (const dep of dependencies) {
				if (dep.path && dep.type !== DependencyTypes.CONFIG) {
					if (detectCycle(dep.path, path.concat([filePath]))) {
						break; // Stop on first cycle found for this path
					}
				}
			}

			recursionStack.delete(filePath);
			return false;
		};

		// Check all files in main graph
		for (const filePath of this.mainDependencyGraph.keys()) {
			if (!visited.has(filePath)) {
				detectCycle(filePath);
			}
		}

		return circular;
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

		return languageMap[extension] || 'unknown';
	}

	/**
	 * Clear all data
	 */
	clear() {
		this.mainDependencyGraph.clear();
		this.testDependencyGraph.clear();
		this.reverseDependencyGraph.clear();
		this.dynamicImports.clear();
		this.fileMetadata.clear();

		this.stats = {
			filesAnalyzed: 0,
			dependenciesFound: 0,
			dynamicImportsFound: 0,
			circularDependencies: 0,
			errors: 0
		};
	}

	/**
	 * Get statistics
	 */
	getStats() {
		return {
			...this.stats,
			mainGraphSize: this.mainDependencyGraph.size,
			testGraphSize: this.testDependencyGraph.size,
			reverseGraphSize: this.reverseDependencyGraph.size,
			averageDependencies:
				this.stats.filesAnalyzed > 0
					? this.stats.dependenciesFound / this.stats.filesAnalyzed
					: 0
		};
	}
}

/**
 * Create a new dependency tracker instance
 */
export function createDependencyTracker(options = {}) {
	return new DependencyTracker(options);
}

export default DependencyTracker;
