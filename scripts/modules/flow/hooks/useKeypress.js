import { useEffect, useRef } from 'react';
import { useInput } from 'ink';

/**
 * Centralized keyboard handling with modifier support
 * Based on Gemini CLI's useKeypress implementation
 */
export function useKeypress(handlers = {}, options = {}) {
  const { isActive = true } = options;
  const handlersRef = useRef(handlers);
  
  // Keep handlers ref up to date
  handlersRef.current = handlers;

  useInput((input, key) => {
    if (!isActive) return;

    const currentHandlers = handlersRef.current;
    
    // Handle special key combinations first
    if (key.ctrl && key.name) {
      const ctrlHandler = currentHandlers[`ctrl+${key.name}`];
      if (ctrlHandler) {
        ctrlHandler(input, key);
        return;
      }
    }

    if (key.shift && key.name) {
      const shiftHandler = currentHandlers[`shift+${key.name}`];
      if (shiftHandler) {
        shiftHandler(input, key);
        return;
      }
    }

    if (key.meta && key.name) {
      const metaHandler = currentHandlers[`meta+${key.name}`];
      if (metaHandler) {
        metaHandler(input, key);
        return;
      }
    }

    // Handle individual keys
    if (key.name && currentHandlers[key.name]) {
      currentHandlers[key.name](input, key);
      return;
    }

    // Handle raw input
    if (input && currentHandlers.input) {
      currentHandlers.input(input, key);
      return;
    }

    // Handle escape key
    if (key.escape && currentHandlers.escape) {
      currentHandlers.escape();
      return;
    }

    // Handle arrow keys
    if (key.upArrow && currentHandlers.upArrow) {
      currentHandlers.upArrow();
      return;
    }

    if (key.downArrow && currentHandlers.downArrow) {
      currentHandlers.downArrow();
      return;
    }

    if (key.leftArrow && currentHandlers.leftArrow) {
      currentHandlers.leftArrow();
      return;
    }

    if (key.rightArrow && currentHandlers.rightArrow) {
      currentHandlers.rightArrow();
      return;
    }

    // Handle return key
    if (key.return && currentHandlers.return) {
      currentHandlers.return();
      return;
    }

    // Handle tab key
    if (key.tab && currentHandlers.tab) {
      currentHandlers.tab();
      return;
    }

    // Handle specific character inputs
    if (input && currentHandlers[input]) {
      currentHandlers[input]();
      return;
    }

    // Fallback to default handler
    if (currentHandlers.default) {
      currentHandlers.default(input, key);
    }
  }, { isActive });
}

/**
 * Common key handler factory functions
 */
export const createKeyHandlers = {
  navigation: (onUp, onDown, onLeft, onRight) => ({
    up: onUp,
    down: onDown,
    left: onLeft,
    right: onRight,
    k: onUp,    // vim-style
    j: onDown,  // vim-style
    h: onLeft,  // vim-style
    l: onRight, // vim-style
  }),

  modal: (onEscape, onEnter, onTab) => ({
    escape: onEscape,
    return: onEnter,
    tab: onTab,
  }),

  search: (onSearch, onClear) => ({
    'ctrl+f': onSearch,
    'ctrl+k': onClear,
    '/': onSearch,
  }),

  common: (onRefresh, onHelp, onQuit) => ({
    'ctrl+r': onRefresh,
    'ctrl+c': onQuit,
    'ctrl+h': onHelp,
    '?': onHelp,
    q: onQuit,
  }),
}; 