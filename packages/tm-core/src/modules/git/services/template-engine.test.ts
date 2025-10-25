import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateEngine } from './template-engine.js';

describe('TemplateEngine', () => {
	let templateEngine: TemplateEngine;

	beforeEach(() => {
		templateEngine = new TemplateEngine();
	});

	describe('constructor and initialization', () => {
		it('should initialize with default templates', () => {
			expect(templateEngine).toBeDefined();
		});

		it('should accept custom templates in constructor', () => {
			const customTemplate = '{{type}}({{scope}}): {{description}}';
			const engine = new TemplateEngine({ commitMessage: customTemplate });

			const result = engine.render('commitMessage', {
				type: 'feat',
				scope: 'core',
				description: 'add feature'
			});

			expect(result).toBe('feat(core): add feature');
		});
	});

	describe('render', () => {
		it('should render simple template with single variable', () => {
			const template = 'Hello {{name}}';
			const result = templateEngine.render('test', { name: 'World' }, template);

			expect(result).toBe('Hello World');
		});

		it('should render template with multiple variables', () => {
			const template = '{{type}}({{scope}}): {{description}}';
			const result = templateEngine.render(
				'test',
				{
					type: 'feat',
					scope: 'api',
					description: 'add endpoint'
				},
				template
			);

			expect(result).toBe('feat(api): add endpoint');
		});

		it('should handle missing variables by leaving placeholder', () => {
			const template = 'Hello {{name}} from {{location}}';
			const result = templateEngine.render('test', { name: 'Alice' }, template);

			expect(result).toBe('Hello Alice from {{location}}');
		});

		it('should handle empty variable values', () => {
			const template = '{{prefix}}{{message}}';
			const result = templateEngine.render(
				'test',
				{
					prefix: '',
					message: 'hello'
				},
				template
			);

			expect(result).toBe('hello');
		});

		it('should handle numeric values', () => {
			const template = 'Count: {{count}}';
			const result = templateEngine.render('test', { count: 42 }, template);

			expect(result).toBe('Count: 42');
		});

		it('should handle boolean values', () => {
			const template = 'Active: {{active}}';
			const result = templateEngine.render('test', { active: true }, template);

			expect(result).toBe('Active: true');
		});
	});

	describe('setTemplate', () => {
		it('should set and use custom template', () => {
			templateEngine.setTemplate('custom', 'Value: {{value}}');
			const result = templateEngine.render('custom', { value: '123' });

			expect(result).toBe('Value: 123');
		});

		it('should override existing template', () => {
			templateEngine.setTemplate('commitMessage', 'Custom: {{msg}}');
			const result = templateEngine.render('commitMessage', { msg: 'hello' });

			expect(result).toBe('Custom: hello');
		});
	});

	describe('getTemplate', () => {
		it('should return existing template', () => {
			templateEngine.setTemplate('test', 'Template: {{value}}');
			const template = templateEngine.getTemplate('test');

			expect(template).toBe('Template: {{value}}');
		});

		it('should return undefined for non-existent template', () => {
			const template = templateEngine.getTemplate('nonexistent');

			expect(template).toBeUndefined();
		});
	});

	describe('hasTemplate', () => {
		it('should return true for existing template', () => {
			templateEngine.setTemplate('test', 'Template');

			expect(templateEngine.hasTemplate('test')).toBe(true);
		});

		it('should return false for non-existent template', () => {
			expect(templateEngine.hasTemplate('nonexistent')).toBe(false);
		});
	});

	describe('validateTemplate', () => {
		it('should validate template with all required variables', () => {
			const template = '{{type}}({{scope}}): {{description}}';
			const requiredVars = ['type', 'scope', 'description'];

			const result = templateEngine.validateTemplate(template, requiredVars);

			expect(result.isValid).toBe(true);
			expect(result.missingVars).toEqual([]);
		});

		it('should detect missing required variables', () => {
			const template = '{{type}}: {{description}}';
			const requiredVars = ['type', 'scope', 'description'];

			const result = templateEngine.validateTemplate(template, requiredVars);

			expect(result.isValid).toBe(false);
			expect(result.missingVars).toEqual(['scope']);
		});

		it('should detect multiple missing variables', () => {
			const template = '{{type}}';
			const requiredVars = ['type', 'scope', 'description'];

			const result = templateEngine.validateTemplate(template, requiredVars);

			expect(result.isValid).toBe(false);
			expect(result.missingVars).toEqual(['scope', 'description']);
		});

		it('should handle optional variables in template', () => {
			const template = '{{type}}({{scope}}): {{description}} [{{taskId}}]';
			const requiredVars = ['type', 'scope', 'description'];

			const result = templateEngine.validateTemplate(template, requiredVars);

			expect(result.isValid).toBe(true);
			expect(result.missingVars).toEqual([]);
		});
	});

	describe('extractVariables', () => {
		it('should extract all variables from template', () => {
			const template = '{{type}}({{scope}}): {{description}}';
			const variables = templateEngine.extractVariables(template);

			expect(variables).toEqual(['type', 'scope', 'description']);
		});

		it('should extract unique variables only', () => {
			const template = '{{name}} and {{name}} with {{other}}';
			const variables = templateEngine.extractVariables(template);

			expect(variables).toEqual(['name', 'other']);
		});

		it('should return empty array for template without variables', () => {
			const template = 'Static text with no variables';
			const variables = templateEngine.extractVariables(template);

			expect(variables).toEqual([]);
		});

		it('should handle template with whitespace in placeholders', () => {
			const template = '{{ type }} and {{ scope }}';
			const variables = templateEngine.extractVariables(template);

			expect(variables).toEqual(['type', 'scope']);
		});
	});

	describe('edge cases', () => {
		it('should handle empty template', () => {
			const result = templateEngine.render('test', { name: 'value' }, '');

			expect(result).toBe('');
		});

		it('should handle template with no variables', () => {
			const template = 'Static text';
			const result = templateEngine.render('test', {}, template);

			expect(result).toBe('Static text');
		});

		it('should handle empty variables object', () => {
			const template = 'Hello {{name}}';
			const result = templateEngine.render('test', {}, template);

			expect(result).toBe('Hello {{name}}');
		});

		it('should handle special characters in values', () => {
			const template = 'Value: {{value}}';
			const result = templateEngine.render(
				'test',
				{
					value: 'hello$world{test}'
				},
				template
			);

			expect(result).toBe('Value: hello$world{test}');
		});

		it('should handle multiline templates', () => {
			const template = '{{type}}: {{description}}\n\n{{body}}';
			const result = templateEngine.render(
				'test',
				{
					type: 'feat',
					description: 'add feature',
					body: 'Details here'
				},
				template
			);

			expect(result).toBe('feat: add feature\n\nDetails here');
		});
	});

	describe('default commit message template', () => {
		it('should have default commit message template', () => {
			const template = templateEngine.getTemplate('commitMessage');

			expect(template).toBeDefined();
			expect(template).toContain('{{type}}');
			expect(template).toContain('{{description}}');
		});

		it('should render default commit message template', () => {
			const result = templateEngine.render('commitMessage', {
				type: 'feat',
				scope: 'core',
				description: 'implement feature',
				body: 'Additional details',
				taskId: '5.1'
			});

			expect(result).toContain('feat');
			expect(result).toContain('core');
			expect(result).toContain('implement feature');
		});
	});
});
