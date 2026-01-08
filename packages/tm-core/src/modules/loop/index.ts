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
