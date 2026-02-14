/**
 * @fileoverview Contract for inter-tag dependency synthesis
 */

import type {
	AIPrimitiveOptions,
	AIPrimitiveResult
} from '../../ai/types/primitives.types.js';
import type { SemanticAnalysis } from './tag-semantic-analyzer.types.js';
import type { DependencySuggestion } from './tag-dependency-synthesizer.types.js';

export interface ITagDependencySynthesizer {
	synthesize(
		analyses: ReadonlyArray<{ label: string; analysis: SemanticAnalysis }>,
		options: AIPrimitiveOptions
	): Promise<AIPrimitiveResult<readonly DependencySuggestion[]>>;
}
