import { log } from './utils.js';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Import all prompt templates directly
import analyzeComplexityPrompt from '../../src/prompts/analyze-complexity.json' with {
	type: 'json'
};
import expandTaskPrompt from '../../src/prompts/expand-task.json' with {
	type: 'json'
};
import addTaskPrompt from '../../src/prompts/add-task.json' with {
	type: 'json'
};
import researchPrompt from '../../src/prompts/research.json' with {
	type: 'json'
};
import parsePrdPrompt from '../../src/prompts/parse-prd.json' with {
	type: 'json'
};
import updateTaskPrompt from '../../src/prompts/update-task.json' with {
	type: 'json'
};
import updateTasksPrompt from '../../src/prompts/update-tasks.json' with {
	type: 'json'
};
import updateSubtaskPrompt from '../../src/prompts/update-subtask.json' with {
	type: 'json'
};

// Import schema for validation
import promptTemplateSchema from '../../src/prompts/schemas/prompt-template.schema.json' with {
	type: 'json'
};

/**
 * Manages prompt templates for AI interactions
 */
export class PromptManager {
	constructor() {
		// Store all prompts in a map for easy lookup
		this.prompts = new Map([
			['analyze-complexity', analyzeComplexityPrompt],
			['expand-task', expandTaskPrompt],
			['add-task', addTaskPrompt],
			['research', researchPrompt],
			['parse-prd', parsePrdPrompt],
			['update-task', updateTaskPrompt],
			['update-tasks', updateTasksPrompt],
			['update-subtask', updateSubtaskPrompt]
		]);

		this.cache = new Map();
		this.setupValidation();
	}

	/**
	 * Set up JSON schema validation
	 * @private
	 */
	setupValidation() {
		this.ajv = new Ajv({ allErrors: true, strict: false });
		addFormats(this.ajv);

		try {
			// Use the imported schema directly
			this.validatePrompt = this.ajv.compile(promptTemplateSchema);
			log('debug', '✓ JSON schema validation enabled');
		} catch (error) {
			log('warn', `⚠ Schema validation disabled: ${error.message}`);
			this.validatePrompt = () => true; // Fallback to no validation
		}
	}

	/**
	 * Load a prompt template and render it with variables
	 * @param {string} promptId - The prompt template ID
	 * @param {Object} variables - Variables to inject into the template
	 * @param {string} [variantKey] - Optional specific variant to use
	 * @returns {{systemPrompt: string, userPrompt: string, metadata: Object}}
	 */
	loadPrompt(promptId, variables = {}, variantKey = null) {
		try {
			// Check cache first
			const cacheKey = `${promptId}-${JSON.stringify(variables)}-${variantKey}`;
			if (this.cache.has(cacheKey)) {
				return this.cache.get(cacheKey);
			}

			// Load template
			const template = this.loadTemplate(promptId);

			// Validate parameters if schema validation is available
			if (this.validatePrompt && this.validatePrompt !== true) {
				this.validateParameters(template, variables);
			}

			// Select the variant - use specified key or select based on conditions
			const variant = variantKey
				? { ...template.prompts[variantKey], name: variantKey }
				: this.selectVariant(template, variables);

			// Render the prompts with variables
			const rendered = {
				systemPrompt: this.renderTemplate(variant.system, variables),
				userPrompt: this.renderTemplate(variant.user, variables),
				metadata: {
					templateId: template.id,
					version: template.version,
					variant: variant.name || 'default',
					parameters: variables
				}
			};

			// Cache the result
			this.cache.set(cacheKey, rendered);

			return rendered;
		} catch (error) {
			log('error', `Failed to load prompt ${promptId}: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Load a prompt template from the imported prompts
	 * @private
	 */
	loadTemplate(promptId) {
		// Get template from the map
		const template = this.prompts.get(promptId);

		if (!template) {
			throw new Error(`Prompt template '${promptId}' not found`);
		}

		// Schema validation if available (do this first for detailed errors)
		if (this.validatePrompt && this.validatePrompt !== true) {
			const valid = this.validatePrompt(template);
			if (!valid) {
				const errors = this.validatePrompt.errors
					.map((err) => `${err.instancePath || 'root'}: ${err.message}`)
					.join(', ');
				throw new Error(`Schema validation failed: ${errors}`);
			}
		} else {
			// Fallback basic validation if no schema validation available
			if (!template.id || !template.prompts || !template.prompts.default) {
				throw new Error(
					'Invalid template structure: missing required fields (id, prompts.default)'
				);
			}
		}

		return template;
	}

	/**
	 * Validate parameters against template schema
	 * @private
	 */
	validateParameters(template, variables) {
		if (!template.parameters) return;

		const errors = [];

		for (const [paramName, paramConfig] of Object.entries(
			template.parameters
		)) {
			const value = variables[paramName];

			// Check required parameters
			if (paramConfig.required && value === undefined) {
				errors.push(`Required parameter '${paramName}' missing`);
				continue;
			}

			// Skip validation for undefined optional parameters
			if (value === undefined) continue;

			// Type validation
			if (!this.validateParameterType(value, paramConfig.type)) {
				errors.push(
					`Parameter '${paramName}' expected ${paramConfig.type}, got ${typeof value}`
				);
			}

			// Enum validation
			if (paramConfig.enum && !paramConfig.enum.includes(value)) {
				errors.push(
					`Parameter '${paramName}' must be one of: ${paramConfig.enum.join(', ')}`
				);
			}

			// Pattern validation for strings
			if (paramConfig.pattern && typeof value === 'string') {
				const regex = new RegExp(paramConfig.pattern);
				if (!regex.test(value)) {
					errors.push(
						`Parameter '${paramName}' does not match required pattern: ${paramConfig.pattern}`
					);
				}
			}

			// Range validation for numbers
			if (typeof value === 'number') {
				if (paramConfig.minimum !== undefined && value < paramConfig.minimum) {
					errors.push(
						`Parameter '${paramName}' must be >= ${paramConfig.minimum}`
					);
				}
				if (paramConfig.maximum !== undefined && value > paramConfig.maximum) {
					errors.push(
						`Parameter '${paramName}' must be <= ${paramConfig.maximum}`
					);
				}
			}
		}

		if (errors.length > 0) {
			throw new Error(`Parameter validation failed: ${errors.join('; ')}`);
		}
	}

	/**
	 * Validate parameter type
	 * @private
	 */
	validateParameterType(value, expectedType) {
		switch (expectedType) {
			case 'string':
				return typeof value === 'string';
			case 'number':
				return typeof value === 'number';
			case 'boolean':
				return typeof value === 'boolean';
			case 'array':
				return Array.isArray(value);
			case 'object':
				return (
					typeof value === 'object' && value !== null && !Array.isArray(value)
				);
			default:
				return true;
		}
	}

	/**
	 * Select the best variant based on conditions
	 * @private
	 */
	selectVariant(template, variables) {
		// Check each variant's condition
		for (const [name, variant] of Object.entries(template.prompts)) {
			if (name === 'default') continue;

			if (
				variant.condition &&
				this.evaluateCondition(variant.condition, variables)
			) {
				return { ...variant, name };
			}
		}

		// Fall back to default
		return { ...template.prompts.default, name: 'default' };
	}

	/**
	 * Evaluate a condition string
	 * @private
	 */
	evaluateCondition(condition, variables) {
		try {
			// Create a safe evaluation context
			const context = { ...variables };

			// Simple condition evaluation (can be enhanced)
			// For now, supports basic comparisons
			const func = new Function(...Object.keys(context), `return ${condition}`);
			return func(...Object.values(context));
		} catch (error) {
			log('warn', `Failed to evaluate condition: ${condition}`);
			return false;
		}
	}

	/**
	 * Render a template string with variables
	 * @private
	 */
	renderTemplate(template, variables) {
		let rendered = template;

		// Handle helper functions like (eq variable "value")
		rendered = rendered.replace(
			/\(eq\s+(\w+(?:\.\w+)*)\s+"([^"]+)"\)/g,
			(match, path, compareValue) => {
				const value = this.getNestedValue(variables, path);
				return value === compareValue ? 'true' : 'false';
			}
		);

		// Handle not helper function like (not variable)
		rendered = rendered.replace(/\(not\s+(\w+(?:\.\w+)*)\)/g, (match, path) => {
			const value = this.getNestedValue(variables, path);
			return !value ? 'true' : 'false';
		});

		// Handle gt (greater than) helper function like (gt variable 0)
		rendered = rendered.replace(
			/\(gt\s+(\w+(?:\.\w+)*)\s+(\d+(?:\.\d+)?)\)/g,
			(match, path, compareValue) => {
				const value = this.getNestedValue(variables, path);
				const numValue = parseFloat(compareValue);
				return typeof value === 'number' && value > numValue ? 'true' : 'false';
			}
		);

		// Handle gte (greater than or equal) helper function like (gte variable 0)
		rendered = rendered.replace(
			/\(gte\s+(\w+(?:\.\w+)*)\s+(\d+(?:\.\d+)?)\)/g,
			(match, path, compareValue) => {
				const value = this.getNestedValue(variables, path);
				const numValue = parseFloat(compareValue);
				return typeof value === 'number' && value >= numValue
					? 'true'
					: 'false';
			}
		);

		// Handle conditionals with else {{#if variable}}...{{else}}...{{/if}}
		rendered = rendered.replace(
			/\{\{#if\s+([^}]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g,
			(match, condition, trueContent, falseContent = '') => {
				// Handle boolean values and helper function results
				let value;
				if (condition === 'true') {
					value = true;
				} else if (condition === 'false') {
					value = false;
				} else {
					value = this.getNestedValue(variables, condition);
				}
				return value ? trueContent : falseContent;
			}
		);

		// Handle each loops {{#each array}}...{{/each}}
		rendered = rendered.replace(
			/\{\{#each\s+(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/each\}\}/g,
			(match, path, content) => {
				const array = this.getNestedValue(variables, path);
				if (!Array.isArray(array)) return '';

				return array
					.map((item, index) => {
						// Create a context with item properties and special variables
						const itemContext = {
							...variables,
							...item,
							'@index': index,
							'@first': index === 0,
							'@last': index === array.length - 1
						};

						// Recursively render the content with item context
						return this.renderTemplate(content, itemContext);
					})
					.join('');
			}
		);

		// Handle json helper {{{json variable}}} (triple braces for raw output)
		rendered = rendered.replace(
			/\{\{\{json\s+(\w+(?:\.\w+)*)\}\}\}/g,
			(match, path) => {
				const value = this.getNestedValue(variables, path);
				return value !== undefined ? JSON.stringify(value, null, 2) : '';
			}
		);

		// Handle variable substitution {{variable}}
		rendered = rendered.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
			const value = this.getNestedValue(variables, path);
			return value !== undefined ? value : '';
		});

		return rendered;
	}

	/**
	 * Get nested value from object using dot notation
	 * @private
	 */
	getNestedValue(obj, path) {
		return path
			.split('.')
			.reduce(
				(current, key) =>
					current && current[key] !== undefined ? current[key] : undefined,
				obj
			);
	}

	/**
	 * Validate all prompt templates
	 */
	validateAllPrompts() {
		const results = { total: 0, errors: [], valid: [] };

		// Iterate through all imported prompts
		for (const [promptId, template] of this.prompts.entries()) {
			results.total++;

			try {
				// Validate the template
				if (this.validatePrompt && this.validatePrompt !== true) {
					const valid = this.validatePrompt(template);
					if (!valid) {
						const errors = this.validatePrompt.errors
							.map((err) => `${err.instancePath || 'root'}: ${err.message}`)
							.join(', ');
						throw new Error(`Schema validation failed: ${errors}`);
					}
				}
				results.valid.push(promptId);
			} catch (error) {
				results.errors.push(`${promptId}: ${error.message}`);
			}
		}

		return results;
	}

	/**
	 * List all available prompt templates
	 */
	listPrompts() {
		const prompts = [];

		// Iterate through all imported prompts
		for (const [promptId, template] of this.prompts.entries()) {
			try {
				prompts.push({
					id: template.id,
					description: template.description,
					version: template.version,
					parameters: template.parameters,
					tags: template.metadata?.tags || []
				});
			} catch (error) {
				log('warn', `Failed to process template ${promptId}: ${error.message}`);
			}
		}

		return prompts;
	}

	/**
	 * Validate template structure
	 * @param {string|Object} templateOrId - Either a template ID or a template object
	 */
	validateTemplate(templateOrId) {
		try {
			let template;

			// Handle both template ID and direct template object
			if (typeof templateOrId === 'string') {
				template = this.prompts.get(templateOrId);
				if (!template) {
					return {
						valid: false,
						error: `Template '${templateOrId}' not found`
					};
				}
			} else {
				template = templateOrId;
			}

			// Check required fields
			const required = ['id', 'version', 'description', 'prompts'];
			for (const field of required) {
				if (!template[field]) {
					return { valid: false, error: `Missing required field: ${field}` };
				}
			}

			// Check default prompt exists
			if (!template.prompts.default) {
				return { valid: false, error: 'Missing default prompt variant' };
			}

			// Check each variant has required fields
			for (const [name, variant] of Object.entries(template.prompts)) {
				if (!variant.system || !variant.user) {
					return {
						valid: false,
						error: `Variant '${name}' missing system or user prompt`
					};
				}
			}

			// Schema validation if available
			if (this.validatePrompt && this.validatePrompt !== true) {
				const valid = this.validatePrompt(template);
				if (!valid) {
					const errors = this.validatePrompt.errors
						.map((err) => `${err.instancePath || 'root'}: ${err.message}`)
						.join(', ');
					return { valid: false, error: `Schema validation failed: ${errors}` };
				}
			}

			return { valid: true };
		} catch (error) {
			return { valid: false, error: error.message };
		}
	}
}

// Singleton instance
let promptManager = null;

/**
 * Get or create the prompt manager instance
 * @returns {PromptManager}
 */
export function getPromptManager() {
	if (!promptManager) {
		promptManager = new PromptManager();
	}
	return promptManager;
}
