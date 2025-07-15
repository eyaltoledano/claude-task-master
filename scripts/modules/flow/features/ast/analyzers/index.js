/**
 * Phase 2.2 Language-Specific Analyzers Export Index
 *
 * Centralized exports for all Phase 2.2 language-specific analyzers
 * and the dispatcher that coordinates them.
 *
 * @author Task Master Flow
 * @version 2.2.0
 */

// Core dispatcher
export {
	AnalyzerDispatcher,
	createAnalyzerDispatcher
} from './analyzer-dispatcher.js';

// Language-specific analyzers
export { JavaScriptAnalyzer } from './javascript-analyzer.js';
export { PythonAnalyzer } from './python-analyzer.js';
export { GoAnalyzer } from './go-analyzer.js';
export { GenericAnalyzer } from './generic-analyzer.js';

// Default export is the dispatcher
export { AnalyzerDispatcher as default } from './analyzer-dispatcher.js';
