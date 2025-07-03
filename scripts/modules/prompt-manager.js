import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { log } from './utils.js';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

/**
 * Manages prompt templates for AI interactions
 */
export class PromptManager {
	constructor() {
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = path.dirname(__filename);
		this.promptsDir = path.join(__dirname, '..', '..', 'src', 'prompts');
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
			// Load schema from src/prompts/schemas
			const schemaPath = path.join(
				this.promptsDir,
				'schemas',
				'prompt-template.schema.json'
			);
			const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
			const schema = JSON.parse(schemaContent);

			this.validatePrompt = this.ajv.compile(schema);
			log('info', '✓ JSON schema validation enabled');
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
	 * Load a prompt template from disk
	 * @private
	 */
	loadTemplate(promptId) {
		const templatePath = path.join(this.promptsDir, `${promptId}.json`);

		try {
			const content = fs.readFileSync(templatePath, 'utf-8');
			const template = JSON.parse(content);

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
		} catch (error) {
			if (error.code === 'ENOENT') {
				throw new Error(`Prompt template '${promptId}' not found`);
			}
			throw error;
		}
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

		try {
			const files = fs.readdirSync(this.promptsDir);
			const promptFiles = files.filter((file) => file.endsWith('.json'));

			for (const file of promptFiles) {
				const promptId = file.replace('.json', '');
				results.total++;

				try {
					this.loadTemplate(promptId);
					results.valid.push(promptId);
				} catch (error) {
					results.errors.push(`${promptId}: ${error.message}`);
				}
			}
		} catch (error) {
			results.errors.push(
				`Failed to read templates directory: ${error.message}`
			);
		}

		return results;
	}

	/**
	 * List all available prompt templates
	 */
	listPrompts() {
		try {
			const files = fs.readdirSync(this.promptsDir);
			const prompts = [];

			for (const file of files) {
				if (!file.endsWith('.json')) continue;

				const promptId = file.replace('.json', '');
				try {
					const template = this.loadTemplate(promptId);
					prompts.push({
						id: template.id,
						description: template.description,
						version: template.version,
						parameters: template.parameters,
						tags: template.metadata?.tags || []
					});
				} catch (error) {
					log('warn', `Failed to load template ${promptId}: ${error.message}`);
				}
			}

			return prompts;
		} catch (error) {
			if (error.code === 'ENOENT') {
				// Templates directory doesn't exist yet
				return [];
			}
			throw error;
		}
	}

	/**
	 * Validate template structure
	 */
	validateTemplate(templatePath) {
		try {
			const content = fs.readFileSync(templatePath, 'utf-8');
			const template = JSON.parse(content);

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
