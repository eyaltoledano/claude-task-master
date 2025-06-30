import { getComponentTheme } from '../theme.js';

/**
 * Hook to access component-specific theme
 * @param {string} componentName - Name of the component
 * @returns {Object} Theme object for the component
 */
export function useComponentTheme(componentName) {
  const theme = getComponentTheme(componentName);
  return { theme };
} 