/**
 * @fileoverview AI module - generic AI infrastructure
 * Domain-specific AI logic lives in consuming modules (e.g., cluster/generation/)
 */

// Shared types
export * from './types/index.js';

// Prompt engineering
export * from './prompts/index.js';

// Structured generation (generic AI bridge)
export * from './structured-generation/index.js';

// Providers
export * from './providers/index.js';

// Legacy AI services bridge (temporary until full migration)
export { loadGenerateObjectService } from './legacy-ai-loader.js';
