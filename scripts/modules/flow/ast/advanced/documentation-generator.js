/**
 * Documentation Generator Component
 * Generates comprehensive documentation from AST analysis
 */

import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';

export class DocumentationGenerator extends EventEmitter {
	constructor(analyzers, options = {}) {
		super();
		this.analyzers = analyzers;
		this.options = {
			outputFormat: 'markdown',
			includePrivate: false,
			includeExamples: true,
			outputDir: '.taskmaster/docs/generated',
			...options
		};
	}

	async generateFileDocumentation(filePath, ast, language) {
		this.emit('generation:start', { filePath, language });

		try {
			const elements = this.extractDocumentationElements(ast);
			const content = await this.generateDocumentationContent(
				elements,
				filePath,
				language
			);
			const formattedDoc = await this.formatDocumentation(content, language);

			const result = {
				filePath,
				language,
				documentation: formattedDoc,
				elements,
				summary: {
					functionsDocumented: elements.functions.length,
					classesDocumented: elements.classes.length,
					totalElements: elements.functions.length + elements.classes.length,
					completeness: this.calculateCompleteness(elements)
				},
				metadata: {
					generatedAt: new Date().toISOString(),
					generatorVersion: '5.1.0'
				}
			};

			this.emit('generation:complete', result.summary);
			return result;
		} catch (error) {
			this.emit('generation:error', error);
			throw new DocumentationGenerationError(
				`Documentation generation failed for ${filePath}: ${error.message}`,
				error
			);
		}
	}

	async generateProjectDocumentation(projectPath, astResults) {
		this.emit('project:start', { projectPath });

		try {
			const projectDoc = {
				projectPath,
				overview: this.generateProjectOverview(astResults),
				files: [],
				summary: { totalFiles: 0, totalFunctions: 0, totalClasses: 0 }
			};

			for (const astResult of astResults) {
				if (astResult.parseSuccess && astResult.ast) {
					const fileDoc = await this.generateFileDocumentation(
						astResult.file.path,
						astResult.ast,
						astResult.language
					);
					projectDoc.files.push(fileDoc);
				}
			}

			projectDoc.summary = {
				totalFiles: projectDoc.files.length,
				totalFunctions: projectDoc.files.reduce(
					(sum, f) => sum + f.summary.functionsDocumented,
					0
				),
				totalClasses: projectDoc.files.reduce(
					(sum, f) => sum + f.summary.classesDocumented,
					0
				)
			};

			this.emit('project:complete', projectDoc.summary);
			return projectDoc;
		} catch (error) {
			this.emit('project:error', error);
			throw error;
		}
	}

	extractDocumentationElements(ast) {
		return {
			functions: ast.functions || [],
			classes: ast.classes || [],
			variables: ast.variables || []
		};
	}

	async generateDocumentationContent(elements, filePath, language) {
		const content = {
			header: this.generateFileHeader(filePath, language),
			overview: this.generateFileOverview(elements),
			functions: elements.functions.map((func) =>
				this.generateFunctionDoc(func)
			),
			classes: elements.classes.map((cls) => this.generateClassDoc(cls)),
			examples: []
		};

		if (this.options.includeExamples) {
			content.examples = await this.generateUsageExamples(elements, language);
		}

		return content;
	}

	generateFunctionDoc(func) {
		return {
			name: func.name,
			signature: func.signature || `${func.name}()`,
			description: func.documentation?.description || 'No description provided',
			parameters: func.parameters || [],
			returns: func.documentation?.returns || {
				type: 'unknown',
				description: 'No return description'
			}
		};
	}

	generateClassDoc(cls) {
		return {
			name: cls.name,
			description: cls.documentation?.description || 'No description provided',
			methods: cls.methods || [],
			properties: cls.properties || []
		};
	}

	async generateUsageExamples(elements, language) {
		const examples = [];

		for (const func of elements.functions.slice(0, 2)) {
			const funcExamples = await this.generateFunctionExamples(func, language);
			examples.push(...funcExamples);
		}

		return examples;
	}

	async generateFunctionExamples(func, language) {
		const examples = [];

		if (language === 'javascript' || language === 'typescript') {
			examples.push({
				title: 'Basic Usage',
				code: this.generateJSExample(func),
				description: `Example usage of ${func.name} function`
			});
		}

		return examples;
	}

	generateJSExample(func) {
		const params = func.parameters
			? func.parameters.map((p) => p.name).join(', ')
			: '';
		return `// Example usage\nconst result = ${func.name}(${params});\nconsole.log(result);`;
	}

	async formatDocumentation(content, language) {
		if (this.options.outputFormat === 'markdown') {
			return this.generateMarkdown(content);
		}
		return JSON.stringify(content, null, 2);
	}

	generateMarkdown(content) {
		let markdown = content.header;

		if (content.overview) {
			markdown += `## Overview\n\n${content.overview}\n\n`;
		}

		if (content.functions.length > 0) {
			markdown += `## Functions\n\n`;
			for (const func of content.functions) {
				markdown += `### ${func.name}\n\n`;
				markdown += `**Signature:** \`${func.signature}\`\n\n`;
				markdown += `${func.description}\n\n`;
			}
		}

		if (content.classes.length > 0) {
			markdown += `## Classes\n\n`;
			for (const cls of content.classes) {
				markdown += `### ${cls.name}\n\n`;
				markdown += `${cls.description}\n\n`;
			}
		}

		return markdown;
	}

	generateFileHeader(filePath, language) {
		return `# ${path.basename(filePath)}\n\n**Language:** ${language}\n**File:** ${filePath}\n\n`;
	}

	generateFileOverview(elements) {
		const overview = [];
		if (elements.functions.length > 0) {
			overview.push(`Contains ${elements.functions.length} function(s)`);
		}
		if (elements.classes.length > 0) {
			overview.push(`Contains ${elements.classes.length} class(es)`);
		}
		return overview.join(', ') || 'No documented elements found';
	}

	generateProjectOverview(astResults) {
		const languages = new Set();
		let totalFiles = astResults.length;

		for (const result of astResults) {
			if (result.parseSuccess) {
				languages.add(result.language);
			}
		}

		return {
			description: 'Automated documentation generated from AST analysis',
			languages: Array.from(languages),
			statistics: { totalFiles },
			generatedAt: new Date().toISOString()
		};
	}

	calculateCompleteness(elements) {
		let documented = 0;
		let total = 0;

		for (const func of elements.functions) {
			total++;
			if (func.documentation?.description) documented++;
		}

		for (const cls of elements.classes) {
			total++;
			if (cls.documentation?.description) documented++;
		}

		return total > 0 ? Math.round((documented / total) * 100) : 0;
	}
}

/**
 * Custom error class
 */
export class DocumentationGenerationError extends Error {
	constructor(message, cause) {
		super(message);
		this.name = 'DocumentationGenerationError';
		this.cause = cause;
	}
}

export default DocumentationGenerator;
