/**
 * Task Master Flow TUI Theme
 * Consistent with Task Master branding colors
 */

export const theme = {
  // Primary colors
  primary: '#00bcd4',     // Task Master cyan
  accent: '#4caf50',      // Success green
  warning: '#ffc107',     // Warning yellow
  error: '#f44336',       // Error red
  
  // UI colors
  background: '#1a1a1a',
  surface: '#2d2d2d',
  text: '#ffffff',
  textDim: '#999999',
  border: '#3a3a3a',
  
  // Status colors
  status: {
    pending: '#999999',
    'in-progress': '#00bcd4',
    done: '#4caf50',
    blocked: '#f44336',
    deferred: '#ffc107',
    cancelled: '#666666'
  },
  
  // Cost thresholds for telemetry display
  costThresholds: {
    low: 1.0,    // Under $1 - green
    medium: 5.0  // Under $5 - yellow, over - red
  }
};

/**
 * Helper to get theme color with chalk
 */
export function getThemeColor(colorPath) {
  const parts = colorPath.split('.');
  let value = theme;
  for (const part of parts) {
    value = value[part];
    if (!value) return '#ffffff';
  }
  return value;
} 