/**
 * Project Structure Analyzer - Analyzes project structure and integrates with AST
 *
 * This service provides project structure analysis, with optional AST integration
 * when a local repository is available.
 */

import fs from 'fs';
import path from 'path';

export class ProjectStructureAnalyzer {
	constructor(projectRoot, astMode = 'none') {
		this.projectRoot = projectRoot;
		this.astMode = astMode; // 'none', 'optional', 'full'
		this.astAnalyzer = null;
	}

	async analyzeProject() {
		const [structure, packageInfo, dependencies, astContext] =
			await Promise.all([
				this.generateProjectStructure(),
				this.getPackageInfo(),
				this.analyzeDependencies(),
				this.getASTContext()
			]);

		return {
			structure,
			packageInfo,
			dependencies,
			astContext,
			astMode: this.astMode,
			timestamp: new Date().toISOString()
		};
	}

	async generateProjectStructure() {
		try {
			const structure = await this.buildDirectoryTree(this.projectRoot);
			return {
				tree: structure,
				summary: this.generateStructureSummary(structure)
			};
		} catch (error) {
			return {
				error: error.message
			};
		}
	}

	async buildDirectoryTree(dirPath, maxDepth = 3, currentDepth = 0) {
		if (currentDepth >= maxDepth) {
			return {
				name: path.basename(dirPath),
				type: 'directory',
				truncated: true
			};
		}

		const stats = await fs.promises.stat(dirPath);
		const name = path.basename(dirPath);

		if (stats.isFile()) {
			return {
				name,
				type: 'file',
				size: stats.size,
				ext: path.extname(name)
			};
		}

		const children = [];
		try {
			const items = await fs.promises.readdir(dirPath);

			// Filter out common ignore patterns
			const filteredItems = items
				.filter(
					(item) =>
						!item.startsWith('.') ||
						['.gitignore', '.env', '.taskmaster'].includes(item)
				)
				.filter(
					(item) =>
						!['node_modules', 'dist', 'build', 'coverage', '.git'].includes(
							item
						)
				);

			for (const item of filteredItems.slice(0, 20)) {
				// Limit items per directory
				const itemPath = path.join(dirPath, item);
				try {
					const child = await this.buildDirectoryTree(
						itemPath,
						maxDepth,
						currentDepth + 1
					);
					children.push(child);
				} catch (error) {
					// Skip inaccessible files
				}
			}
		} catch (error) {
			return {
				name,
				type: 'directory',
				error: 'Permission denied'
			};
		}

		return {
			name,
			type: 'directory',
			children: children.sort((a, b) => {
				// Directories first, then files
				if (a.type !== b.type) {
					return a.type === 'directory' ? -1 : 1;
				}
				return a.name.localeCompare(b.name);
			})
		};
	}

	generateStructureSummary(structure) {
		const summary = {
			totalFiles: 0,
			totalDirectories: 0,
			fileTypes: {},
			keyDirectories: [],
			configFiles: []
		};

		const traverse = (node) => {
			if (node.type === 'file') {
				summary.totalFiles++;
				const ext = node.ext || 'no-extension';
				summary.fileTypes[ext] = (summary.fileTypes[ext] || 0) + 1;

				// Identify config files
				if (
					[
						'package.json',
						'.gitignore',
						'tsconfig.json',
						'webpack.config.js'
					].includes(node.name)
				) {
					summary.configFiles.push(node.name);
				}
			} else if (node.type === 'directory') {
				summary.totalDirectories++;

				// Identify key directories
				if (
					[
						'src',
						'lib',
						'components',
						'services',
						'utils',
						'tests',
						'docs'
					].includes(node.name)
				) {
					summary.keyDirectories.push(node.name);
				}

				if (node.children) {
					node.children.forEach(traverse);
				}
			}
		};

		traverse(structure);
		return summary;
	}

	async getPackageInfo() {
		try {
			const packagePath = path.join(this.projectRoot, 'package.json');
			if (fs.existsSync(packagePath)) {
				const packageContent = await fs.promises.readFile(packagePath, 'utf8');
				const pkg = JSON.parse(packageContent);

				return {
					name: pkg.name,
					version: pkg.version,
					description: pkg.description,
					scripts: Object.keys(pkg.scripts || {}),
					dependencies: Object.keys(pkg.dependencies || {}),
					devDependencies: Object.keys(pkg.devDependencies || {}),
					main: pkg.main,
					type: pkg.type
				};
			}
		} catch (error) {
			return { error: error.message };
		}

		return null;
	}

	async analyzeDependencies() {
		const packageInfo = await this.getPackageInfo();
		if (!packageInfo || packageInfo.error) {
			return { error: 'No package.json found' };
		}

		const allDeps = [
			...(packageInfo.dependencies || []),
			...(packageInfo.devDependencies || [])
		];

		// Categorize dependencies
		const categories = {
			frameworks: [],
			ui: [],
			testing: [],
			build: [],
			utilities: [],
			other: []
		};

		const frameworkPatterns = [
			'react',
			'vue',
			'angular',
			'svelte',
			'next',
			'nuxt',
			'express',
			'fastify'
		];
		const uiPatterns = [
			'styled',
			'emotion',
			'tailwind',
			'bootstrap',
			'material',
			'antd',
			'chakra'
		];
		const testPatterns = [
			'jest',
			'mocha',
			'vitest',
			'cypress',
			'playwright',
			'testing-library'
		];
		const buildPatterns = [
			'webpack',
			'vite',
			'rollup',
			'parcel',
			'babel',
			'typescript',
			'esbuild'
		];

		allDeps.forEach((dep) => {
			const lowerDep = dep.toLowerCase();
			if (frameworkPatterns.some((pattern) => lowerDep.includes(pattern))) {
				categories.frameworks.push(dep);
			} else if (uiPatterns.some((pattern) => lowerDep.includes(pattern))) {
				categories.ui.push(dep);
			} else if (testPatterns.some((pattern) => lowerDep.includes(pattern))) {
				categories.testing.push(dep);
			} else if (buildPatterns.some((pattern) => lowerDep.includes(pattern))) {
				categories.build.push(dep);
			} else if (
				['lodash', 'axios', 'moment', 'date-fns', 'uuid'].includes(dep)
			) {
				categories.utilities.push(dep);
			} else {
				categories.other.push(dep);
			}
		});

		return categories;
	}

	async getASTContext() {
		if (this.astMode === 'none') {
			return { available: false, reason: 'AST disabled' };
		}

		try {
			// Try to import AST analyzer if available
			const { ASTContextBuilder } = await import(
				'../context/ast-context-builder.js'
			);
			this.astAnalyzer = new ASTContextBuilder(this.projectRoot);

			// Get basic AST context
			const astContext = await this.astAnalyzer.buildContext([]);

			return {
				available: true,
				mode: this.astMode,
				summary: this.summarizeASTContext(astContext),
				fullContext: this.astMode === 'full' ? astContext : null
			};
		} catch (error) {
			return {
				available: false,
				reason: `AST not available: ${error.message}`,
				error: error.message
			};
		}
	}

	summarizeASTContext(astContext) {
		if (!astContext) return null;

		return {
			totalFiles: astContext.analysisResults?.length || 0,
			languages:
				astContext.analysisResults?.reduce((langs, result) => {
					if (result.language && !langs.includes(result.language)) {
						langs.push(result.language);
					}
					return langs;
				}, []) || [],
			hasComponents:
				astContext.analysisResults?.some(
					(result) => result.components && result.components.length > 0
				) || false,
			hasFunctions:
				astContext.analysisResults?.some(
					(result) => result.functions && result.functions.length > 0
				) || false,
			hasImports:
				astContext.analysisResults?.some(
					(result) => result.imports && result.imports.length > 0
				) || false
		};
	}

	/**
	 * Format project structure for CLAUDE.md
	 */
	formatForMarkdown(projectAnalysis) {
		let markdown = '## Project Structure\n\n';

		// Package info
		if (projectAnalysis.packageInfo && !projectAnalysis.packageInfo.error) {
			const pkg = projectAnalysis.packageInfo;
			markdown += `**Project:** ${pkg.name} v${pkg.version}\n`;
			if (pkg.description) {
				markdown += `**Description:** ${pkg.description}\n`;
			}
			markdown += '\n';
		}

		// Structure summary
		if (projectAnalysis.structure && !projectAnalysis.structure.error) {
			const summary = projectAnalysis.structure.summary;
			markdown += `**Files:** ${summary.totalFiles} files, ${summary.totalDirectories} directories\n`;

			if (summary.keyDirectories.length > 0) {
				markdown += `**Key Directories:** ${summary.keyDirectories.join(', ')}\n`;
			}

			if (summary.configFiles.length > 0) {
				markdown += `**Config Files:** ${summary.configFiles.join(', ')}\n`;
			}
			markdown += '\n';
		}

		// Dependencies
		if (projectAnalysis.dependencies && !projectAnalysis.dependencies.error) {
			const deps = projectAnalysis.dependencies;
			markdown += '**Dependencies:**\n';

			if (deps.frameworks.length > 0) {
				markdown += `- Frameworks: ${deps.frameworks.join(', ')}\n`;
			}
			if (deps.ui.length > 0) {
				markdown += `- UI: ${deps.ui.join(', ')}\n`;
			}
			if (deps.testing.length > 0) {
				markdown += `- Testing: ${deps.testing.join(', ')}\n`;
			}
			if (deps.build.length > 0) {
				markdown += `- Build: ${deps.build.join(', ')}\n`;
			}
			markdown += '\n';
		}

		// AST Context
		if (projectAnalysis.astContext) {
			const ast = projectAnalysis.astContext;
			if (ast.available) {
				markdown += '**Code Analysis (AST):**\n';
				if (ast.summary) {
					markdown += `- Languages: ${ast.summary.languages.join(', ')}\n`;
					markdown += `- Files analyzed: ${ast.summary.totalFiles}\n`;
					if (ast.summary.hasComponents)
						markdown += `- Contains React/Vue components\n`;
					if (ast.summary.hasFunctions)
						markdown += `- Contains functions/methods\n`;
				}
				markdown += '\n';
			} else {
				markdown += `**Code Analysis:** Not available (${ast.reason})\n\n`;
			}
		}

		return markdown;
	}

	/**
	 * Get context for specific task requirements
	 */
	async getTaskSpecificContext(taskKeywords) {
		const projectAnalysis = await this.analyzeProject();

		// If AST is available, try to find relevant files
		let relevantFiles = [];
		if (projectAnalysis.astContext?.available && this.astAnalyzer) {
			try {
				// Use keywords to find relevant files
				relevantFiles = await this.astAnalyzer.findRelevantFiles(taskKeywords);
			} catch (error) {
				console.warn('Failed to get task-specific AST context:', error.message);
			}
		}

		return {
			...projectAnalysis,
			relevantFiles,
			taskKeywords
		};
	}
}
