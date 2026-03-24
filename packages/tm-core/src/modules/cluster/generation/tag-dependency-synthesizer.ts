/**
 * @fileoverview Bridged implementation of ITagDependencySynthesizer
 * Delegates to generateObjectService() from the legacy AI services module
 */

import { z } from 'zod';
import type { GenerateObjectServiceFn } from '../../ai/structured-generation/structured-generator.js';
import type {
	AIPrimitiveOptions,
	AIPrimitiveResult
} from '../../ai/types/primitives.types.js';
import type { ITagDependencySynthesizer } from './tag-dependency-synthesizer.interface.js';
import { tagDependencySynthesisPrompt } from './tag-dependency-synthesizer.prompt.js';
import type { SemanticAnalysis } from './tag-semantic-analyzer.types.js';
import type { DependencySuggestion } from './tag-dependency-synthesizer.types.js';

const dependencySuggestionSchema = z.object({
	dependencies: z
		.array(
			z.object({
				from: z.string().describe('Tag name that depends on another'),
				to: z.string().describe('Tag name that is depended upon'),
				reason: z.string().describe('Why this dependency exists'),
				confidence: z
					.enum(['high', 'medium', 'low'])
					.describe('Confidence level of the suggestion')
			})
		)
		.describe('Suggested inter-tag dependencies')
});

const DEFAULT_SYSTEM_PROMPT = tagDependencySynthesisPrompt().build();

export class BridgedTagDependencySynthesizer
	implements ITagDependencySynthesizer
{
	constructor(
		private readonly generateObjectService: GenerateObjectServiceFn
	) {}

	async synthesize(
		analyses: ReadonlyArray<{ label: string; analysis: SemanticAnalysis }>,
		options: AIPrimitiveOptions
	): Promise<AIPrimitiveResult<readonly DependencySuggestion[]>> {
		const startTime = Date.now();

		const analysisDescriptions = analyses
			.map(
				({ label, analysis }) =>
					`Tag: "${label}"\n  Summary: ${analysis.summary}\n  Domain: ${analysis.technicalDomain}\n  Themes: ${analysis.themes.join(', ')}\n  Capabilities: ${analysis.capabilities.join(', ')}\n  Key Entities: ${analysis.keyEntities.join(', ')}`
			)
			.join('\n\n');

		const prompt = `Given the following semantic analyses of project tags, suggest inter-tag dependencies that reflect a natural execution order:\n\n${analysisDescriptions}\n\nDetermine which tags should depend on which other tags for optimal project execution ordering.`;

		const result = await this.generateObjectService({
			role: 'main',
			systemPrompt: options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
			prompt,
			schema: dependencySuggestionSchema,
			objectName: 'dependency_suggestions',
			commandName: options.commandName,
			outputType: 'cli'
		});

		const duration = Date.now() - startTime;

		if (
			!result.mainResult ||
			!Array.isArray(
				(result.mainResult as Record<string, unknown>).dependencies
			)
		) {
			throw new Error(
				'Dependency synthesis failed: invalid or missing result from generateObjectService'
			);
		}

		const parsed = result.mainResult as {
			dependencies: DependencySuggestion[];
		};

		return {
			data: parsed.dependencies,
			usage: {
				inputTokens: result.telemetryData?.inputTokens ?? 0,
				outputTokens: result.telemetryData?.outputTokens ?? 0,
				model: result.modelId ?? 'unknown',
				provider: result.providerName ?? 'unknown',
				duration
			}
		};
	}
}
