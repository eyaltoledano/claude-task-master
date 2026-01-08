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
	loadPreset
} from './presets/index.js';

export { LoopProgressService } from './services/loop-progress.service.js';
export type { ProgressEntry } from './services/loop-progress.service.js';
