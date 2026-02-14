/**
 * @fileoverview Prompt template for tag semantic analysis
 */

import { PromptBuilder } from '../../ai/prompts/index.js';

export const tagSemanticAnalysisPrompt = () =>
	new PromptBuilder()
		.setRole('software architecture analyst')
		.setTask(
			'Given a tag name, description, and its tasks, produce a semantic analysis that captures the essence of what this tag represents in a software project.'
		)
		.addInstructions([
			'What domain or capability this tag covers',
			'What themes or patterns emerge from its tasks',
			'What key entities or modules are involved'
		])
		.addConstraint('Be precise and technical')
		.setOutputFormat('Output valid JSON matching the requested schema.');
