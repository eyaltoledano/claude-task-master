import fs from 'fs/promises';
import path from 'path';
import { log } from './utils.js';

/**
 * Manages prompt templates for AI interactions
 */
export class PromptManager {
	constructor(projectRoot) {
		this.projectRoot = projectRoot;
		this.templatesDir = path.join(projectRoot, 'src/prompts');
		this.cache = new Map();
	}

	/**
	 * Load a prompt template and render it with variables
	 * @param {string} promptId - The prompt template ID
	 * @param {Object} variables - Variables to inject into the template
	 * @returns {Promise<{systemPrompt: string, userPrompt: string, metadata: Object}>}
	 */
	async loadPrompt(promptId, variables = {}) {
		try {
			// Check cache first
			const cacheKey = `${promptId}-${JSON.stringify(variables)}`;
			if (this.cache.has(cacheKey)) {
				return this.cache.get(cacheKey);
			}

			// Load template
			const template = await this.loadTemplate(promptId);

			// Select the best variant based on conditions
			const variant = this.selectVariant(template, variables);

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
	async loadTemplate(promptId) {
		const templatePath = path.join(this.templatesDir, `${promptId}.json`);

		try {
			const content = await fs.readFile(templatePath, 'utf-8');
			const template = JSON.parse(content);

			// Validate template structure
			if (!template.id || !template.prompts || !template.prompts.default) {
				throw new Error('Invalid template structure');
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

		// Handle conditionals {{#if variable}}...{{/if}}
		rendered = rendered.replace(
			/\{\{#if\s+(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/if\}\}/g,
			(match, path, content) => {
				const value = this.getNestedValue(variables, path);
				return value ? content : '';
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
	 * List all available prompt templates
	 */
	async listPrompts() {
		try {
			const files = await fs.readdir(this.templatesDir);
			const prompts = [];

			for (const file of files) {
				if (!file.endsWith('.json')) continue;

				const promptId = file.replace('.json', '');
				try {
					const template = await this.loadTemplate(promptId);
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
	async validateTemplate(templatePath) {
		try {
			const content = await fs.readFile(templatePath, 'utf-8');
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
 * @param {string} projectRoot - Project root directory
 * @returns {PromptManager}
 */
export function getPromptManager(projectRoot) {
	if (!promptManager || promptManager.projectRoot !== projectRoot) {
		promptManager = new PromptManager(projectRoot);
	}
	return promptManager;
}
