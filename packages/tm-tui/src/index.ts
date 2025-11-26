/**
 * @tm/tui - Task Master TUI Framework
 *
 * An Ink/React-based TUI that replicates the timeless Task Master CLI aesthetic
 */

// Theme exports
export * from './theme/colors.js';
export * from './theme/borders.js';
export * from './theme/icons.js';

// Shell (REPL) - main export
export { Shell } from './shell/Shell.js';

// Re-export ink for convenience
export { render, Box, Text as InkText, useInput, useApp, useFocus, useFocusManager } from 'ink';
