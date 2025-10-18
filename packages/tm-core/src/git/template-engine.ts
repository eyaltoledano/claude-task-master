/**
 * TemplateEngine - Configurable template system for generating text from templates
 *
 * Supports:
 * - Variable substitution using {{variableName}} syntax
 * - Custom templates via constructor or setTemplate
 * - Template validation with required variables
 * - Variable extraction from templates
 * - Multiple template storage and retrieval
 */

export interface TemplateValidationResult {
	isValid: boolean;
	missingVars: string[];
}

export interface TemplateVariables {
	[key: string]: string | number | boolean | undefined;
}

export interface TemplateCollection {
	[templateName: string]: string;
}

export interface TemplateEngineOptions {
	customTemplates?: TemplateCollection;
	preservePlaceholders?: boolean;
}

const DEFAULT_TEMPLATES: TemplateCollection = {
	commitMessage: `{{type}}{{#scope}}({{scope}}){{/scope}}{{#breaking}}!{{/breaking}}: {{description}}

{{#body}}{{body}}

{{/body}}{{#taskId}}Task: {{taskId}}{{/taskId}}{{#phase}}
Phase: {{phase}}{{/phase}}{{#testsPassing}}
Tests: {{testsPassing}} passing{{#testsFailing}}, {{testsFailing}} failing{{/testsFailing}}{{/testsPassing}}`
};

export class TemplateEngine {
	private templates: TemplateCollection;
	private preservePlaceholders: boolean;

	constructor(
		optionsOrTemplates: TemplateEngineOptions | TemplateCollection = {}
	) {
		// Backward compatibility: support old signature (TemplateCollection) and new signature (TemplateEngineOptions)
		const isOptions =
			'customTemplates' in optionsOrTemplates ||
			'preservePlaceholders' in optionsOrTemplates;
		const options: TemplateEngineOptions = isOptions
			? (optionsOrTemplates as TemplateEngineOptions)
			: { customTemplates: optionsOrTemplates as TemplateCollection };

		this.templates = {
			...DEFAULT_TEMPLATES,
			...(options.customTemplates || {})
		};
		this.preservePlaceholders = options.preservePlaceholders ?? false;
	}

	/**
	 * Render a template with provided variables
	 */
	render(
		templateName: string,
		variables: TemplateVariables,
		inlineTemplate?: string
	): string {
		const template =
			inlineTemplate !== undefined
				? inlineTemplate
				: this.templates[templateName];

		if (template === undefined) {
			throw new Error(`Template "${templateName}" not found`);
		}

		return this.substituteVariables(template, variables);
	}

	/**
	 * Set or update a template
	 */
	setTemplate(name: string, template: string): void {
		this.templates[name] = template;
	}

	/**
	 * Get a template by name
	 */
	getTemplate(name: string): string | undefined {
		return this.templates[name];
	}

	/**
	 * Check if a template exists
	 */
	hasTemplate(name: string): boolean {
		return name in this.templates;
	}

	/**
	 * Validate that a template contains all required variables
	 */
	validateTemplate(
		template: string,
		requiredVars: string[]
	): TemplateValidationResult {
		const templateVars = this.extractVariables(template);
		const missingVars = requiredVars.filter(
			(varName) => !templateVars.includes(varName)
		);

		return {
			isValid: missingVars.length === 0,
			missingVars
		};
	}

	/**
	 * Extract all variable names from a template
	 */
	extractVariables(template: string): string[] {
		const regex = /\{\{\s*([^}#/\s]+)\s*\}\}/g;
		const matches = template.matchAll(regex);
		const variables = new Set<string>();

		for (const match of matches) {
			variables.add(match[1]);
		}

		return Array.from(variables);
	}

	/**
	 * Substitute variables in template
	 * Supports both {{variable}} and {{#variable}}...{{/variable}} (conditional blocks)
	 */
	private substituteVariables(
		template: string,
		variables: TemplateVariables
	): string {
		let result = template;

		// Handle conditional blocks first ({{#var}}...{{/var}})
		result = this.processConditionalBlocks(result, variables);

		// Handle simple variable substitution ({{var}})
		result = result.replace(/\{\{\s*([^}#/\s]+)\s*\}\}/g, (_, varName) => {
			const value = variables[varName];
			return value !== undefined && value !== null
				? String(value)
				: this.preservePlaceholders
					? `{{${varName}}}`
					: '';
		});

		return result;
	}

	/**
	 * Process conditional blocks in template
	 * {{#variable}}content{{/variable}} - shows content only if variable is truthy
	 * Processes innermost blocks first to handle nesting
	 */
	private processConditionalBlocks(
		template: string,
		variables: TemplateVariables
	): string {
		let result = template;
		let hasChanges = true;

		// Keep processing until no more conditional blocks are found
		while (hasChanges) {
			const before = result;

			// Find and replace innermost conditional blocks (non-greedy match)
			result = result.replace(
				/\{\{#([^}]+)\}\}((?:(?!\{\{#).)*?)\{\{\/\1\}\}/gs,
				(_, varName, content) => {
					const value = variables[varName.trim()];

					// Show content if variable is truthy (not undefined, null, false, or empty string)
					if (
						value !== undefined &&
						value !== null &&
						value !== false &&
						value !== ''
					) {
						return content;
					}

					return '';
				}
			);

			hasChanges = result !== before;
		}

		return result;
	}
}
