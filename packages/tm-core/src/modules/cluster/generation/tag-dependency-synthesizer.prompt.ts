/**
 * @fileoverview Prompt template for inter-tag dependency synthesis
 */

import { PromptBuilder } from '../../ai/prompts/index.js';

export const tagDependencySynthesisPrompt = () =>
	new PromptBuilder()
		.setRole('software architecture analyst specializing in dependency analysis')
		.setTask(
			'Given semantic analyses of multiple project tags, determine which tags should depend on which other tags.'
		)
		.addRules([
			"A tag depends on another if its work requires the other tag's capabilities to be complete first",
			'Infrastructure/config tags typically have no dependencies (they are foundations)',
			'UI/frontend tags typically depend on API/backend tags',
			'Testing/docs tags typically depend on the features they test/document',
			'Avoid suggesting circular dependencies',
			'Only suggest dependencies where there is a clear technical ordering need',
			'Use "high" confidence for obvious structural dependencies, "medium" for likely ones, "low" for suggested ones',
			'The "from" tag is the one that DEPENDS ON the "to" tag (from needs to, to must be done first)'
		])
		.setOutputFormat('Output valid JSON matching the requested schema.');
