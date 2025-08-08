import { jest } from '@jest/globals';
import { PromptManager } from '../../../scripts/modules/prompt-manager.js';

describe('expand-task prompt template', () => {
	let promptManager;

	beforeEach(() => {
		promptManager = new PromptManager();
	});

	const testTask = {
		id: 1,
		title: 'Setup AWS Infrastructure',
		description: 'Provision core AWS services',
		details: 'Create VPC, subnets, and security groups'
	};

	const baseParams = {
		task: testTask,
		subtaskCount: 3,
		nextSubtaskId: 1,
		additionalContext: '',
		complexityReasoningContext: '',
		gatheredContext: '',
		useResearch: false,
		expansionPrompt: undefined
	};

	test('default variant includes task context', () => {
		const { userPrompt } = promptManager.loadPrompt(
			'expand-task',
			baseParams,
			'default'
		);

		expect(userPrompt).toContain(testTask.title);
		expect(userPrompt).toContain(testTask.description);
		expect(userPrompt).toContain(testTask.details);
		expect(userPrompt).toContain('Task ID: 1');
	});

	test('research variant includes task context', () => {
		const params = { ...baseParams, useResearch: true };
		const { userPrompt } = promptManager.loadPrompt(
			'expand-task',
			params,
			'research'
		);

		expect(userPrompt).toContain(testTask.title);
		expect(userPrompt).toContain(testTask.description);
		expect(userPrompt).toContain(testTask.details);
		expect(userPrompt).toContain('Parent Task:');
		expect(userPrompt).toContain('ID: 1');
	});

	test('complexity-report variant includes task context', () => {
		const params = {
			...baseParams,
			expansionPrompt: 'Focus on security best practices',
			complexityReasoningContext: 'High complexity due to security requirements'
		};
		const { userPrompt } = promptManager.loadPrompt(
			'expand-task',
			params,
			'complexity-report'
		);

		// The fix ensures task context is included
		expect(userPrompt).toContain('Parent Task:');
		expect(userPrompt).toContain(`ID: ${testTask.id}`);
		expect(userPrompt).toContain(`Title: ${testTask.title}`);
		expect(userPrompt).toContain(`Description: ${testTask.description}`);
		expect(userPrompt).toContain(`Current details: ${testTask.details}`);

		// Also includes the expansion prompt
		expect(userPrompt).toContain('Expansion Guidance:');
		expect(userPrompt).toContain(params.expansionPrompt);
		expect(userPrompt).toContain(params.complexityReasoningContext);
	});

	test('all variants request JSON format with subtasks array', () => {
		const variants = ['default', 'research', 'complexity-report'];

		variants.forEach((variant) => {
			const params =
				variant === 'complexity-report'
					? { ...baseParams, expansionPrompt: 'test' }
					: baseParams;

			const { systemPrompt, userPrompt } = promptManager.loadPrompt(
				'expand-task',
				params,
				variant
			);
			const combined = systemPrompt + userPrompt;

			expect(combined.toLowerCase()).toContain('subtasks');
			expect(combined).toContain('JSON');
		});
	});

	test('complexity-report variant fails without task context regression test', () => {
		// This test ensures we don't regress to the old behavior where
		// complexity-report variant only used expansionPrompt without task context
		const params = {
			...baseParams,
			expansionPrompt: 'Generic expansion prompt'
		};

		const { userPrompt } = promptManager.loadPrompt(
			'expand-task',
			params,
			'complexity-report'
		);

		// Count occurrences of task-specific content
		const titleOccurrences = (
			userPrompt.match(new RegExp(testTask.title, 'g')) || []
		).length;
		const descriptionOccurrences = (
			userPrompt.match(new RegExp(testTask.description, 'g')) || []
		).length;

		// Should have at least one occurrence of title and description
		expect(titleOccurrences).toBeGreaterThanOrEqual(1);
		expect(descriptionOccurrences).toBeGreaterThanOrEqual(1);

		// Should not be ONLY the expansion prompt
		expect(userPrompt.length).toBeGreaterThan(
			params.expansionPrompt.length + 100
		);
	});
});
