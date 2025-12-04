/**
 * CLI module exports
 */

export { CliLanguageModel, isCortexCliAvailable } from './language-model.js';
export type { CliLanguageModelOptions } from './language-model.js';

export * from './errors.js';
export * from './message-converter.js';

// Feature detection
export { detectAvailableFeatures } from './feature-detector.js';
export type { CortexCodeFeatures } from './feature-detector.js';

// Validation utilities
export {
	getCortexCliVersion,
	validateCortexCli
} from './validation.js';
export type { ValidationResult } from './validation.js';
