/**
 * AST Configuration Schema and Validation
 * Contains validation rules and the ConfigValidator class for AST configuration
 */

import { parseSize } from '../../shared/utils/config-utils.js';

/**
 * Configuration Validator with built-in rules
 */
export class ConfigValidator {
	constructor() {
		this.validationRules = this.getValidationRules();
	}

	/**
	 * Get validation rules organized by severity
	 */
	getValidationRules() {
		return {
			critical: [
				{
					path: 'ast',
					type: 'required',
					message: 'Missing required "ast" configuration section'
				},
				{
					path: 'ast.parsing.supportedLanguages',
					type: 'array',
					message: 'parsing.supportedLanguages must be an array'
				},
				{
					path: 'ast.parsing.timeoutMs',
					type: 'range',
					min: 1000,
					max: 30000,
					message: 'parsing.timeoutMs must be between 1000 and 30000'
				},
				{
					path: 'ast.cacheInvalidation.strategy',
					type: 'enum',
					values: ['conservative', 'selective', 'aggressive', 'immediate'],
					message:
						'cacheInvalidation.strategy must be one of: conservative, selective, aggressive, immediate'
				},
				{
					path: 'ast.worktreeManager.coordinationStrategy',
					type: 'enum',
					values: ['safe', 'balanced', 'fast'],
					message:
						'worktreeManager.coordinationStrategy must be one of: safe, balanced, fast'
				}
			],

			warning: [
				{
					path: 'ast.parsing.maxFileSize',
					type: 'size',
					max: '10MB',
					message: 'parsing.maxFileSize is very large, may impact performance'
				},
				{
					path: 'ast.fileWatching.maxConcurrentAnalysis',
					type: 'range',
					max: 10,
					message:
						'fileWatching.maxConcurrentAnalysis > 10 may cause high CPU usage'
				},
				{
					path: 'ast.fileWatching.batchDelay',
					type: 'range',
					min: 100,
					message:
						'fileWatching.batchDelay < 100ms may cause excessive processing'
				},
				{
					path: 'ast.cacheInvalidation.maxDependencyDepth',
					type: 'range',
					max: 10,
					message:
						'cacheInvalidation.maxDependencyDepth > 10 may impact performance'
				},
				{
					path: 'ast.worktreeManager.maxConcurrentWatchers',
					type: 'range',
					max: 20,
					message:
						'worktreeManager.maxConcurrentWatchers > 20 may cause resource exhaustion'
				},
				{
					path: 'ast.performance.maxAnalysisTime',
					type: 'range',
					max: 10000,
					message: 'performance.maxAnalysisTime > 10s may cause timeouts'
				},
				{
					path: 'ast.performance.maxMemoryUsage',
					type: 'size',
					max: '1GB',
					message:
						'performance.maxMemoryUsage > 1GB may impact system performance'
				}
			]
		};
	}

	/**
	 * Validate configuration and return results
	 */
	validate(config) {
		const result = {
			isValid: true,
			hasErrors: false,
			hasWarnings: false,
			errors: [],
			warnings: []
		};

		// Validate critical rules
		for (const rule of this.validationRules.critical) {
			const error = this.validateRule(config, rule);
			if (error) {
				result.errors.push(error);
				result.hasErrors = true;
				result.isValid = false;
			}
		}

		// Validate warning rules
		for (const rule of this.validationRules.warning) {
			const warning = this.validateRule(config, rule);
			if (warning) {
				result.warnings.push(warning);
				result.hasWarnings = true;
			}
		}

		return result;
	}

	/**
	 * Validate a single rule against configuration
	 */
	validateRule(config, rule) {
		const value = this.getNestedValue(config, rule.path);

		switch (rule.type) {
			case 'required':
				return this.validateRequired(value, rule);

			case 'array':
				return this.validateArray(value, rule);

			case 'range':
				return this.validateRange(value, rule);

			case 'enum':
				return this.validateEnum(value, rule);

			case 'size':
				return this.validateSize(value, rule);

			default:
				return null;
		}
	}

	/**
	 * Validate required field
	 */
	validateRequired(value, rule) {
		if (value === undefined || value === null) {
			return rule.message;
		}
		return null;
	}

	/**
	 * Validate array type
	 */
	validateArray(value, rule) {
		if (value !== undefined && value !== null && !Array.isArray(value)) {
			return rule.message;
		}
		return null;
	}

	/**
	 * Validate numeric range
	 */
	validateRange(value, rule) {
		if (value === undefined || value === null) {
			return null;
		}

		const numValue = typeof value === 'number' ? value : parseFloat(value);

		if (Number.isNaN(numValue)) {
			return `${rule.path} must be a number`;
		}

		if (rule.min !== undefined && numValue < rule.min) {
			return rule.message;
		}

		if (rule.max !== undefined && numValue > rule.max) {
			return rule.message;
		}

		return null;
	}

	/**
	 * Validate enum values
	 */
	validateEnum(value, rule) {
		if (value === undefined || value === null) {
			return null;
		}

		if (!rule.values.includes(value)) {
			return rule.message;
		}

		return null;
	}

	/**
	 * Validate size values (e.g., "1MB", "500KB")
	 */
	validateSize(value, rule) {
		if (value === undefined || value === null) {
			return null;
		}

		try {
			const sizeBytes = parseSize(value);
			const maxSizeBytes = parseSize(rule.max);

			if (sizeBytes > maxSizeBytes) {
				return rule.message;
			}

			return null;
		} catch (error) {
			return `${rule.path} has invalid size format: ${value}`;
		}
	}

	/**
	 * Get nested value from object using dot notation
	 */
	getNestedValue(obj, path) {
		return path.split('.').reduce((current, key) => {
			return current && current[key] !== undefined ? current[key] : undefined;
		}, obj);
	}

	/**
	 * Add custom validation rule
	 */
	addRule(severity, rule) {
		if (!this.validationRules[severity]) {
			this.validationRules[severity] = [];
		}

		this.validationRules[severity].push(rule);
	}

	/**
	 * Remove validation rule
	 */
	removeRule(severity, path) {
		if (this.validationRules[severity]) {
			this.validationRules[severity] = this.validationRules[severity].filter(
				(rule) => rule.path !== path
			);
		}
	}

	/**
	 * Get validation summary
	 */
	getValidationSummary() {
		const criticalCount = this.validationRules.critical.length;
		const warningCount = this.validationRules.warning.length;

		return {
			totalRules: criticalCount + warningCount,
			criticalRules: criticalCount,
			warningRules: warningCount,
			rules: this.validationRules
		};
	}
} 