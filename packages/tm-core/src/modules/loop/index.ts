/**
 * @fileoverview Loop module exports
 */

export type {
	LoopPreset,
	LoopConfig,
	LoopIteration,
	LoopResult,
	LoopCompletionMarker
} from './types.js';

export {
	PRESET_NAMES,
	isValidPreset,
	getPresetPath,
	loadPreset,
	isFilePath,
	loadCustomPrompt,
	resolvePrompt,
	PresetError,
	PresetErrorCode
} from './presets/index.js';

export { LoopProgressService } from './services/loop-progress.service.js';
export type { ProgressEntry } from './services/loop-progress.service.js';

export { LoopCompletionService } from './services/loop-completion.service.js';
export type { CompletionCheckResult } from './services/loop-completion.service.js';
