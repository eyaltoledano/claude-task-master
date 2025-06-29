import { useState, useRef, useCallback } from 'react';

/**
 * Hook that syncs state with refs for performance optimization
 * Prevents unnecessary re-renders while maintaining reactive updates
 * Based on Gemini CLI's useStateAndRef pattern
 */
export function useStateAndRef(initialValue) {
  const [state, setState] = useState(initialValue);
  const ref = useRef(initialValue);

  const setStateAndRef = useCallback((newValue) => {
    const value = typeof newValue === 'function' ? newValue(ref.current) : newValue;
    ref.current = value;
    setState(value);
  }, []);

  // Sync ref with state if they get out of sync
  if (ref.current !== state) {
    ref.current = state;
  }

  return [state, setStateAndRef, ref];
} 