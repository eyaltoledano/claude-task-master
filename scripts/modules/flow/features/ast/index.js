// AST Feature - Main exports
// This file provides a centralized export for all AST-related functionality

// Components
export { default as ASTDebugCommand } from './components/ast-debug-command.js';

// Services
export { TaskContextGenerator } from './services/task-context-generator.js';
export { ProjectStructureAnalyzer } from './services/project-structure-analyzer.js';

// Core AST modules
export * from './context/ast-context-builder.js';
export * from './context/enhanced-ast-context-builder.js';
export * from './context/code-analyzer.js';
export * from './context/complexity-scorer.js';
export * from './context/dependency-mapper.js';
export * from './context/context-builder.js';

// Language detection
export * from './language-detector.js';

// Analyzers
export * from './analyzers/index.js';
export * from './analyzers/analyzer-dispatcher.js';
export * from './analyzers/javascript-analyzer.js';
export * from './analyzers/python-analyzer.js';
export * from './analyzers/go-analyzer.js';
export * from './analyzers/generic-analyzer.js';

// Parsers
export * from './parsers/parser-registry.js';
export * from './parsers/base-parser.js';
export * from './parsers/javascript-parser.js';
export * from './parsers/python-parser.js';
export * from './parsers/go-parser.js';
export * from './parsers/css-parser.js';
export * from './parsers/html-parser.js';

// Cache system
export * from './cache/index.js';
export * from './cache/cache-manager.js';
export * from './cache/cache-key-generator.js';
export * from './cache/content-hasher.js';
export * from './cache/dependency-tracker.js';

// Error handling
export * from './error-handling/debug-tools.js';
export * from './error-handling/error-recovery.js';
export * from './error-handling/parser-fallbacks.js';
export * from './error-handling/validation.js';

// Performance
export * from './performance/performance-manager.js';
export * from './performance/resource-monitor.js';
export * from './performance/adaptive-worker-pool.js';
export * from './performance/lazy-loading-manager.js';

// Watchers
export * from './watchers/index.js';
export * from './watchers/file-watcher.js';
export * from './watchers/watch-manager.js';
export * from './watchers/change-processor.js';
export * from './watchers/batch-processor.js';

// Worktree
export * from './worktree/index.js';
export * from './worktree/simple-worktree-manager.js';
export * from './worktree/resource-monitor.js';

// Advanced features
export * from './advanced/index.js';
export * from './advanced/cross-language-analysis.js';
export * from './advanced/documentation-generator.js';
export * from './advanced/pattern-detection.js';
export * from './advanced/refactoring-suggestions.js'; 