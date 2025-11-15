/**
 * @fileoverview UI utilities for Task Master CLI (Re-export module)
 *
 * @deprecated: This file is kept for backward compatibility.
 * All functionality has been moved to organized modules under src/ui/:
 * - ui/formatters/ (status, priority, complexity, dependencies)
 * - ui/display/ (messages, tables)
 * - ui/layout/ (helpers)
 * - ui/components/ (high-level UI components)
 *
 * Please import from '../ui/index.js' or specific modules for new code.
 */

// Re-export everything from the new organized UI structure
export * from '../ui/index.js';
