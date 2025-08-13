import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ContextGathererService {
	constructor() {
		this.projectRoot = process.cwd();
	}

	async gatherFullContext(subtask, options = {}) {
		try {
			// Use existing context gathering logic
			const claudeMdContent = await this.generateClaudeContext(
				subtask,
				options
			);

			// Build structured prompt
			const prompt = this.buildPrompt(claudeMdContent, subtask);

			// Extract metadata
			const metadata = this.extractMetadata(claudeMdContent, subtask);

			return {
				prompt,
				rawContext: claudeMdContent,
				metadata,
				subtask: {
					id: subtask.id,
					title: subtask.title,
					description: subtask.description,
					details: subtask.details,
					testStrategy: subtask.testStrategy,
					parentId: subtask.parentId,
					parentTitle: subtask.parentTitle
				}
			};
		} catch (error) {
			console.error('Error gathering context:', error);
			throw new Error(
				`Failed to gather context for subtask ${subtask.id}: ${error.message}`
			);
		}
	}

	async generateClaudeContext(subtask, options = {}) {
		try {
			// Try to use existing context generation logic
			// This would typically interface with the existing context gathering system
			const contextOptions = {
				subtaskId: subtask.id,
				includeAST: options.includeAST !== false,
				includeProjectStructure: options.includeProjectStructure !== false,
				includeRelatedFiles: options.includeRelatedFiles !== false,
				includeDependencies: options.includeDependencies !== false,
				includeTestStrategy: options.includeTestStrategy !== false,
				maxFiles: options.maxFiles || 50,
				maxFileSize: options.maxFileSize || 10000
			};

			// Generate comprehensive context similar to CLAUDE.md
			const sections = await this.buildContextSections(subtask, contextOptions);

			return this.formatContextAsMarkdown(sections);
		} catch (error) {
			console.error('Error generating Claude context:', error);
			// Fallback to basic context
			return this.generateBasicContext(subtask);
		}
	}

	async buildContextSections(subtask, options) {
		const sections = {
			projectOverview: await this.getProjectOverview(),
			taskContext: this.getTaskContext(subtask),
			codeStructure: await this.getCodeStructure(options),
			relatedFiles: await this.getRelatedFiles(subtask, options),
			dependencies: await this.getDependencies(subtask, options),
			testingContext: await this.getTestingContext(subtask, options),
			implementationGuidelines: await this.getImplementationGuidelines()
		};

		return sections;
	}

	async getProjectOverview() {
		try {
			// Read package.json for project info
			const packageJsonPath = path.join(this.projectRoot, 'package.json');
			const packageJson = JSON.parse(
				await fs.readFile(packageJsonPath, 'utf8')
			);

			// Read README if it exists
			let readme = '';
			try {
				const readmePath = path.join(this.projectRoot, 'README.md');
				readme = await fs.readFile(readmePath, 'utf8');
			} catch (error) {
				// README doesn't exist, that's okay
			}

			return {
				name: packageJson.name,
				description: packageJson.description,
				version: packageJson.version,
				dependencies: Object.keys(packageJson.dependencies || {}),
				devDependencies: Object.keys(packageJson.devDependencies || {}),
				scripts: packageJson.scripts || {},
				readme: readme.substring(0, 2000) // Limit README size
			};
		} catch (error) {
			return {
				name: 'Unknown Project',
				description: 'No package.json found',
				error: error.message
			};
		}
	}

	getTaskContext(subtask) {
		return {
			id: subtask.id,
			title: subtask.title,
			description: subtask.description,
			details: subtask.details,
			testStrategy: subtask.testStrategy,
			parentTask: {
				id: subtask.parentId,
				title: subtask.parentTitle
			},
			status: subtask.status,
			dependencies: subtask.dependencies || []
		};
	}

	async getCodeStructure(options) {
		try {
			// Get basic project structure
			const structure = await this.getDirectoryStructure(this.projectRoot, {
				maxDepth: 3,
				excludePatterns: ['node_modules', '.git', 'dist', 'build', '.cache']
			});

			return {
				structure,
				mainDirectories: this.identifyMainDirectories(structure),
				framework: await this.detectFramework(),
				architecture: await this.detectArchitecture()
			};
		} catch (error) {
			return {
				error: error.message,
				structure: 'Unable to analyze code structure'
			};
		}
	}

	async getDirectoryStructure(dirPath, options = {}) {
		const maxDepth = options.maxDepth || 3;
		const excludePatterns = options.excludePatterns || [];

		const getStructure = async (currentPath, depth = 0) => {
			if (depth > maxDepth) return null;

			const entries = await fs.readdir(currentPath, { withFileTypes: true });
			const structure = {};

			for (const entry of entries) {
				// Skip excluded patterns
				if (excludePatterns.some((pattern) => entry.name.includes(pattern))) {
					continue;
				}

				const fullPath = path.join(currentPath, entry.name);

				if (entry.isDirectory()) {
					structure[entry.name] = await getStructure(fullPath, depth + 1);
				} else if (entry.isFile()) {
					// Only include certain file types
					const ext = path.extname(entry.name);
					if (
						[
							'.js',
							'.jsx',
							'.ts',
							'.tsx',
							'.json',
							'.md',
							'.css',
							'.scss'
						].includes(ext)
					) {
						structure[entry.name] = 'file';
					}
				}
			}

			return structure;
		};

		return await getStructure(dirPath);
	}

	identifyMainDirectories(structure) {
		const mainDirs = [];

		if (structure.src) mainDirs.push('src');
		if (structure.lib) mainDirs.push('lib');
		if (structure.scripts) mainDirs.push('scripts');
		if (structure.components) mainDirs.push('components');
		if (structure.pages) mainDirs.push('pages');
		if (structure.utils) mainDirs.push('utils');
		if (structure.services) mainDirs.push('services');
		if (structure.hooks) mainDirs.push('hooks');
		if (structure.contexts) mainDirs.push('contexts');

		return mainDirs;
	}

	async detectFramework() {
		try {
			const packageJsonPath = path.join(this.projectRoot, 'package.json');
			const packageJson = JSON.parse(
				await fs.readFile(packageJsonPath, 'utf8')
			);

			const deps = {
				...packageJson.dependencies,
				...packageJson.devDependencies
			};

			if (deps.react) return 'React';
			if (deps.vue) return 'Vue.js';
			if (deps.angular || deps['@angular/core']) return 'Angular';
			if (deps.svelte) return 'Svelte';
			if (deps.next) return 'Next.js';
			if (deps.nuxt) return 'Nuxt.js';
			if (deps.express) return 'Express.js';
			if (deps.fastify) return 'Fastify';
			if (deps['@nestjs/core']) return 'NestJS';

			return 'Unknown';
		} catch (error) {
			return 'Unknown';
		}
	}

	async detectArchitecture() {
		try {
			const structure = await fs.readdir(this.projectRoot);

			// Check for common architecture patterns
			const hasComponents = structure.includes('components');
			const hasPages = structure.includes('pages');
			const hasHooks = structure.includes('hooks');
			const hasServices = structure.includes('services');
			const hasUtils = structure.includes('utils');
			const hasContexts = structure.includes('contexts');

			if (hasComponents && hasPages && hasHooks) {
				return 'Component-based architecture with custom hooks';
			} else if (hasComponents && hasServices) {
				return 'Service-oriented component architecture';
			} else if (hasComponents) {
				return 'Component-based architecture';
			} else {
				return 'Traditional file-based architecture';
			}
		} catch (error) {
			return 'Unknown architecture';
		}
	}

	async getRelatedFiles(subtask, options) {
		try {
			// This would typically use AST analysis to find related files
			// For now, we'll use a simpler approach based on naming patterns
			const relatedFiles = await this.findRelatedFiles(subtask, options);

			return {
				files: relatedFiles,
				totalFiles: relatedFiles.length,
				analysisMethod: 'Pattern-based (AST analysis not implemented)'
			};
		} catch (error) {
			return {
				files: [],
				error: error.message
			};
		}
	}

	async findRelatedFiles(subtask, options) {
		const searchTerms = this.extractSearchTerms(subtask);
		const files = [];

		// Basic file search based on subtask content
		const searchPaths = [
			'src',
			'lib',
			'components',
			'pages',
			'utils',
			'services',
			'hooks'
		];

		for (const searchPath of searchPaths) {
			const fullPath = path.join(this.projectRoot, searchPath);
			try {
				const pathFiles = await this.searchFilesInPath(
					fullPath,
					searchTerms,
					options
				);
				files.push(...pathFiles);
			} catch (error) {
				// Path doesn't exist, continue
			}
		}

		return files.slice(0, options.maxFiles || 20);
	}

	async searchFilesInPath(searchPath, searchTerms, options) {
		const files = [];
		const entries = await fs.readdir(searchPath, { withFileTypes: true });

		for (const entry of entries) {
			if (entry.isFile()) {
				const filePath = path.join(searchPath, entry.name);
				const ext = path.extname(entry.name);

				// Only search code files
				if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
					try {
						const content = await fs.readFile(filePath, 'utf8');

						// Check if file contains any search terms
						const hasRelevantContent = searchTerms.some((term) =>
							content.toLowerCase().includes(term.toLowerCase())
						);

						if (hasRelevantContent) {
							files.push({
								path: filePath,
								name: entry.name,
								size: content.length,
								preview: content.substring(0, 500) + '...'
							});
						}
					} catch (error) {
						// File too large or unreadable, skip
					}
				}
			} else if (entry.isDirectory() && !entry.name.startsWith('.')) {
				// Recursively search subdirectories (limited depth)
				const subFiles = await this.searchFilesInPath(
					path.join(searchPath, entry.name),
					searchTerms,
					options
				);
				files.push(...subFiles);
			}
		}

		return files;
	}

	extractSearchTerms(subtask) {
		const text = `${subtask.title} ${subtask.description} ${subtask.details}`;
		const words = text.toLowerCase().match(/\b\w{3,}\b/g) || [];

		// Filter out common words and focus on technical terms
		const stopWords = [
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
			'its',
			'may',
			'new',
			'now',
			'old',
			'see',
			'two',
			'who',
			'boy',
			'did',
			'man',
			'men',
			'put',
			'say',
			'she',
			'too',
			'use'
		];

		return words
			.filter((word) => !stopWords.includes(word))
			.filter((word) => word.length > 2)
			.slice(0, 10); // Limit to top 10 terms
	}

	async getDependencies(subtask, options) {
		try {
			// This would analyze task dependencies and related code dependencies
			return {
				taskDependencies: subtask.dependencies || [],
				codeDependencies: await this.analyzeDependencies(subtask),
				installedPackages: await this.getInstalledPackages()
			};
		} catch (error) {
			return {
				taskDependencies: subtask.dependencies || [],
				error: error.message
			};
		}
	}

	async analyzeDependencies(subtask) {
		// Simple dependency analysis based on common patterns
		const dependencies = [];
		const text =
			`${subtask.title} ${subtask.description} ${subtask.details}`.toLowerCase();

		// Check for common framework/library references
		const commonDeps = [
			'react',
			'redux',
			'axios',
			'lodash',
			'moment',
			'dayjs',
			'express',
			'mongoose',
			'prisma',
			'sequelize',
			'typeorm',
			'jest',
			'mocha',
			'chai',
			'cypress',
			'testing-library'
		];

		for (const dep of commonDeps) {
			if (text.includes(dep)) {
				dependencies.push(dep);
			}
		}

		return dependencies;
	}

	async getInstalledPackages() {
		try {
			const packageJsonPath = path.join(this.projectRoot, 'package.json');
			const packageJson = JSON.parse(
				await fs.readFile(packageJsonPath, 'utf8')
			);

			return {
				dependencies: Object.keys(packageJson.dependencies || {}),
				devDependencies: Object.keys(packageJson.devDependencies || {})
			};
		} catch (error) {
			return { dependencies: [], devDependencies: [] };
		}
	}

	async getTestingContext(subtask, options) {
		try {
			return {
				testStrategy: subtask.testStrategy,
				testingFramework: await this.detectTestingFramework(),
				existingTests: await this.findExistingTests(subtask),
				testPatterns: await this.getTestPatterns()
			};
		} catch (error) {
			return {
				testStrategy: subtask.testStrategy,
				error: error.message
			};
		}
	}

	async detectTestingFramework() {
		try {
			const packageJsonPath = path.join(this.projectRoot, 'package.json');
			const packageJson = JSON.parse(
				await fs.readFile(packageJsonPath, 'utf8')
			);

			const deps = {
				...packageJson.dependencies,
				...packageJson.devDependencies
			};

			if (deps.jest) return 'Jest';
			if (deps.mocha) return 'Mocha';
			if (deps.vitest) return 'Vitest';
			if (deps.ava) return 'AVA';
			if (deps.tape) return 'Tape';

			return 'Unknown';
		} catch (error) {
			return 'Unknown';
		}
	}

	async findExistingTests(subtask) {
		const tests = [];
		const testDirs = ['test', 'tests', '__tests__', 'spec'];

		for (const testDir of testDirs) {
			const testPath = path.join(this.projectRoot, testDir);
			try {
				const testFiles = await this.findTestFiles(testPath);
				tests.push(...testFiles);
			} catch (error) {
				// Test directory doesn't exist, continue
			}
		}

		return tests;
	}

	async findTestFiles(testPath) {
		const files = [];
		const entries = await fs.readdir(testPath, { withFileTypes: true });

		for (const entry of entries) {
			if (entry.isFile()) {
				const fileName = entry.name;
				if (fileName.includes('.test.') || fileName.includes('.spec.')) {
					files.push({
						name: fileName,
						path: path.join(testPath, fileName)
					});
				}
			} else if (entry.isDirectory()) {
				const subFiles = await this.findTestFiles(
					path.join(testPath, entry.name)
				);
				files.push(...subFiles);
			}
		}

		return files;
	}

	async getTestPatterns() {
		return {
			unitTests: 'Focus on testing individual functions and components',
			integrationTests: 'Test interactions between components',
			e2eTests: 'Test complete user workflows',
			errorHandling: 'Test error cases and edge conditions',
			performance: 'Consider performance implications'
		};
	}

	async getImplementationGuidelines() {
		return {
			codeStyle: 'Follow existing code patterns and conventions',
			errorHandling: 'Implement comprehensive error handling',
			performance: 'Consider performance implications',
			security: 'Follow security best practices',
			accessibility: 'Ensure accessibility requirements are met',
			testing: 'Include appropriate tests for new functionality',
			documentation: 'Document complex logic and public APIs'
		};
	}

	formatContextAsMarkdown(sections) {
		const markdown = `# Project Context for Task Implementation

## Project Overview
- **Name**: ${sections.projectOverview.name}
- **Description**: ${sections.projectOverview.description}
- **Version**: ${sections.projectOverview.version}
- **Framework**: ${sections.codeStructure.framework}
- **Architecture**: ${sections.codeStructure.architecture}

## Task Context
- **Task ID**: ${sections.taskContext.id}
- **Title**: ${sections.taskContext.title}
- **Description**: ${sections.taskContext.description}
- **Parent Task**: ${sections.taskContext.parentTask.title} (ID: ${sections.taskContext.parentTask.id})

## Implementation Details
${sections.taskContext.details}

## Test Strategy
${sections.taskContext.testStrategy}

## Code Structure
Main directories: ${sections.codeStructure.mainDirectories.join(', ')}

## Dependencies
- **Runtime**: ${sections.dependencies.installedPackages.dependencies.join(', ')}
- **Development**: ${sections.dependencies.installedPackages.devDependencies.join(', ')}

## Testing Framework
${sections.testingContext.testingFramework}

## Implementation Guidelines
${Object.entries(sections.implementationGuidelines)
	.map(([key, value]) => `- **${key}**: ${value}`)
	.join('\n')}

## Related Files
${sections.relatedFiles.files
	.slice(0, 5)
	.map((file) => `- ${file.name}: ${file.preview.substring(0, 100)}...`)
	.join('\n')}
`;

		return markdown;
	}

	generateBasicContext(subtask) {
		return `# Basic Task Context

## Task: ${subtask.title}
**ID**: ${subtask.id}
**Parent**: ${subtask.parentTitle} (${subtask.parentId})

## Description
${subtask.description}

## Implementation Details
${subtask.details}

## Test Strategy
${subtask.testStrategy}

## Notes
This is a basic context due to limited project analysis capabilities.
Please implement following standard best practices for the detected framework.
`;
	}

	buildPrompt(contextContent, subtask) {
		return `You are implementing a subtask for the Task Master CLI project. Use the comprehensive project context below to implement the solution correctly.

${contextContent}

## Your Task
Please implement the subtask "${subtask.title}" (ID: ${subtask.id}) following these requirements:

1. **Follow the existing code patterns** and architecture shown in the context
2. **Implement comprehensive error handling** for edge cases
3. **Include appropriate tests** based on the test strategy
4. **Use the existing dependencies** and frameworks identified
5. **Maintain code quality** and follow the project's conventions

## Implementation Requirements
- Create all necessary files and directories
- Ensure the implementation is complete and tested
- Follow the test strategy: ${subtask.testStrategy}
- Handle errors gracefully
- Use TypeScript/JavaScript best practices
- Include JSDoc comments for public APIs

## Deliverables
Provide a complete implementation including:
- Main implementation files
- Test files
- Any configuration changes needed
- Documentation updates if required

Begin implementation now.`;
	}

	extractMetadata(contextContent, subtask) {
		return {
			contextSize: contextContent.length,
			timestamp: new Date().toISOString(),
			subtaskId: subtask.id,
			analysisMethod: 'Enhanced project analysis',
			includedSections: [
				'projectOverview',
				'taskContext',
				'codeStructure',
				'relatedFiles',
				'dependencies',
				'testingContext',
				'implementationGuidelines'
			]
		};
	}
}
