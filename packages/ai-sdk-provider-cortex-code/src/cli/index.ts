/**
 * CLI management exports for Cortex Code Provider
 */

// Feature Detector exports (minimal - only used in integration tests)
export { detectAvailableFeatures } from './feature-detector.js';
export type { CortexCodeFeatures } from './feature-detector.js';

// Message Converter exports (used internally by language-model)
export {
	convertToCortexCodeMessages,
	convertFromCortexCodeResponse,
	createPromptFromMessages,
	escapeShellArg,
	buildCliArgs,
	formatConversationContext
} from './message-converter.js';

