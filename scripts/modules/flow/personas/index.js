/**
 * Persona System for Task Master
 * Central export for all persona-related functionality
 */

export * from './persona-definitions.js';
export * from './persona-detector.js';
export * from './persona-prompt-builder.js';

// Convenience exports
export {
	personaDefinitions,
	getPersona,
	getAllPersonaIds
} from './persona-definitions.js';
export {
	detectPersona,
	detectMultiPersonaWorkflow
} from './persona-detector.js';
export {
	PersonaPromptBuilder,
	buildMultiPersonaPrompt,
	createInteractivePersonaContext
} from './persona-prompt-builder.js';
