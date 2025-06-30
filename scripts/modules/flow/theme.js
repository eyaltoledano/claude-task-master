/**
 * Theme System for Task Master Flow
 * Inspired by Gemini CLI's sophisticated color management
 * 
 * Features:
 * - Auto theme detection
 * - CSS-to-terminal color mapping
 * - Gradient support
 * - Semantic color naming
 * - Per-component theming
 * 
 * Full documentation: ./docs/theme-system.md
 * 
 * Quick usage:
 * import { theme, style, gradient, getComponentTheme } from './theme.js';
 * 
 * <Text color={theme.accent}>Cyan text</Text>
 * <Text>{style('Error!', 'state.error.primary')}</Text>
 * <Text>{gradient('Header', ['primary', 'secondary'])}</Text>
 */

import { execSync } from 'child_process';
import chalk from 'chalk';

// Color conversion utilities
export const ColorUtils = {
  /**
   * Convert hex color to RGB
   * @param {string} hex - Hex color string
   * @returns {{r: number, g: number, b: number}}
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  },

  /**
   * Convert RGB to HSL
   * @param {number} r - Red (0-255)
   * @param {number} g - Green (0-255)
   * @param {number} b - Blue (0-255)
   * @returns {{h: number, s: number, l: number}}
   */
  rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h;
    let s;
    const l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
  },

  /**
   * Adjust color brightness
   * @param {string} hex - Hex color
   * @param {number} percent - Adjustment percentage (-100 to 100)
   * @returns {string} Adjusted hex color
   */
  adjustBrightness(hex, percent) {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return hex;

    const factor = 1 + (percent / 100);
    const r = Math.min(255, Math.max(0, Math.round(rgb.r * factor)));
    const g = Math.min(255, Math.max(0, Math.round(rgb.g * factor)));
    const b = Math.min(255, Math.max(0, Math.round(rgb.b * factor)));

    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  },

  /**
   * Convert CSS color to terminal-compatible color
   * @param {string} cssColor - CSS color value
   * @returns {Function} Chalk color function
   */
  cssToTerminal(cssColor) {
    if (cssColor.startsWith('#')) {
      return chalk.hex(cssColor);
    }
    
    // Handle named colors
    const namedColors = {
      'red': '#ff0000',
      'green': '#00ff00',
      'blue': '#0000ff',
      'yellow': '#ffff00',
      'cyan': '#00ffff',
      'magenta': '#ff00ff',
      'white': '#ffffff',
      'black': '#000000',
      'gray': '#808080',
      'grey': '#808080'
    };
    
    if (namedColors[cssColor]) {
      return chalk.hex(namedColors[cssColor]);
    }
    
    // Default to chalk's built-in colors
    return chalk[cssColor] || chalk.white;
  }
};

// Gradient support
export const Gradients = {
  /**
   * Create a gradient between two colors
   * @param {string} startColor - Starting hex color
   * @param {string} endColor - Ending hex color
   * @param {number} steps - Number of steps in gradient
   * @returns {string[]} Array of hex colors
   */
  create(startColor, endColor, steps = 10) {
    const start = ColorUtils.hexToRgb(startColor);
    const end = ColorUtils.hexToRgb(endColor);
    
    if (!start || !end) return [startColor];
    
    const gradient = [];
    for (let i = 0; i < steps; i++) {
      const factor = i / (steps - 1);
      const r = Math.round(start.r + (end.r - start.r) * factor);
      const g = Math.round(start.g + (end.g - start.g) * factor);
      const b = Math.round(start.b + (end.b - start.b) * factor);
      
      gradient.push(`#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`);
    }
    
    return gradient;
  },

  /**
   * Apply gradient to text
   * @param {string} text - Text to apply gradient to
   * @param {string[]} colors - Array of colors for gradient
   * @returns {string} Formatted text with gradient
   */
  applyToText(text, colors) {
    if (!colors || colors.length === 0) return text;
    if (colors.length === 1) return ColorUtils.cssToTerminal(colors[0])(text);
    
    const chars = text.split('');
    const colorStep = (colors.length - 1) / (chars.length - 1);
    
    return chars.map((char, i) => {
      const colorIndex = Math.floor(i * colorStep);
      const color = colors[Math.min(colorIndex, colors.length - 1)];
      return ColorUtils.cssToTerminal(color)(char);
    }).join('');
  }
};

// Semantic color definitions
export const SemanticColors = {
  // Base semantic colors
  primary: '#0ea5e9',      // Sky blue
  secondary: '#8b5cf6',    // Purple
  tertiary: '#10b981',     // Emerald
  accent: '#06b6d4',       // Cyan
  
  // UI semantic colors
  background: {
    primary: '#ffffff',
    secondary: '#f9fafb',
    tertiary: '#f3f4f6',
    overlay: 'rgba(0, 0, 0, 0.5)'
  },
  
  surface: {
    primary: '#ffffff',
    secondary: '#f9fafb',
    elevated: '#ffffff',
    depressed: '#e5e7eb'
  },
  
  text: {
    primary: '#111827',
    secondary: '#6b7280',
    tertiary: '#9ca3af',
    inverse: '#ffffff',
    disabled: '#d1d5db'
  },
  
  border: {
    primary: '#e5e7eb',
    secondary: '#f3f4f6',
    focus: '#3b82f6',
    error: '#ef4444'
  },
  
  // State semantic colors
  state: {
    success: {
      primary: '#10b981',
      secondary: '#34d399',
      background: '#d1fae5',
      text: '#065f46'
    },
    error: {
      primary: '#ef4444',
      secondary: '#f87171',
      background: '#fee2e2',
      text: '#991b1b'
    },
    warning: {
      primary: '#f59e0b',
      secondary: '#fbbf24',
      background: '#fef3c7',
      text: '#92400e'
    },
    info: {
      primary: '#3b82f6',
      secondary: '#60a5fa',
      background: '#dbeafe',
      text: '#1e40af'
    }
  },
  
  // Interactive semantic colors
  interactive: {
    hover: 'rgba(0, 0, 0, 0.05)',
    active: 'rgba(0, 0, 0, 0.1)',
    selected: '#3b82f6',
    focus: '#3b82f6',
    disabled: '#e5e7eb'
  }
};

// Theme definitions with semantic mapping
export const Themes = {
  light: {
    name: 'Light',
    type: 'light',
    colors: {
      ...SemanticColors,
      // Override for light theme
      accent: '#3b82f6',       // Light blue for ASCII art and commands in light theme
      background: {
        primary: '#ffffff',
        secondary: '#f9fafb',
        tertiary: '#f3f4f6',
        overlay: 'rgba(0, 0, 0, 0.5)'
      },
      text: {
        primary: '#111827',
        secondary: '#6b7280',
        tertiary: '#9ca3af',
        inverse: '#ffffff',
        disabled: '#d1d5db'
      }
    }
  },
  
  dark: {
    name: 'Dark',
    type: 'dark',
    colors: {
      ...SemanticColors,
      // Override for dark theme
      primary: '#38bdf8',      // Lighter sky blue for dark mode
      secondary: '#a78bfa',    // Lighter purple
      tertiary: '#34d399',     // Lighter emerald
      accent: '#22d3ee',       // Light cyan for ASCII art and commands
      
      background: {
        primary: '#0f172a',
        secondary: '#1e293b',
        tertiary: '#334155',
        overlay: 'rgba(255, 255, 255, 0.1)'
      },
      
      surface: {
        primary: '#1e293b',
        secondary: '#334155',
        elevated: '#475569',
        depressed: '#0f172a'
      },
      
      text: {
        primary: '#f1f5f9',
        secondary: '#cbd5e1',
        tertiary: '#94a3b8',
        inverse: '#0f172a',
        disabled: '#475569'
      },
      
      border: {
        primary: '#334155',
        secondary: '#1e293b',
        focus: '#60a5fa',
        error: '#f87171'
      },
      
      state: {
        success: {
          primary: '#34d399',
          secondary: '#6ee7b7',
          background: '#064e3b',
          text: '#a7f3d0'
        },
        error: {
          primary: '#f87171',
          secondary: '#fca5a5',
          background: '#7f1d1d',
          text: '#fecaca'
        },
        warning: {
          primary: '#fbbf24',
          secondary: '#fde047',
          background: '#78350f',
          text: '#fef08a'
        },
        info: {
          primary: '#60a5fa',
          secondary: '#93c5fd',
          background: '#1e3a8a',
          text: '#bfdbfe'
        }
      }
    }
  }
};

// Per-component theming
export const ComponentThemes = {
  taskList: {
    background: 'surface.primary',
    text: {
      primary: 'text.primary',
      secondary: 'text.secondary',
      tertiary: 'text.tertiary',
      inverse: 'text.inverse'
    },
    accent: 'accent',
    header: {
      gradient: ['primary', 'secondary'],
      text: 'text.inverse'
    },
    item: {
      background: 'surface.primary',
      border: 'border.primary',
      text: 'text.primary',
      hover: 'interactive.hover',
      selected: 'interactive.selected'
    },
    status: {
      done: 'state.success.primary',
      'in-progress': 'state.info.primary',
      pending: 'state.warning.primary',
      blocked: 'state.error.primary'
    }
  },
  
  commandPalette: {
    background: 'background.secondary',
    border: 'border.focus',
    input: {
      background: 'surface.primary',
      text: 'text.primary',
      placeholder: 'text.tertiary'
    },
    suggestions: {
      background: 'surface.secondary',
      hover: 'interactive.hover',
      text: 'text.primary',
      highlight: 'accent'
    }
  },
  
  modal: {
    overlay: 'background.overlay',
    content: {
      background: 'surface.primary',
      border: 'border.primary',
      shadow: 'rgba(0, 0, 0, 0.1)'
    },
    header: {
      background: 'surface.secondary',
      text: 'text.primary',
      border: 'border.secondary'
    },
    footer: {
      background: 'surface.secondary',
      border: 'border.secondary'
    }
  },
  
  button: {
    primary: {
      background: 'primary',
      text: 'text.inverse',
      hover: ColorUtils.adjustBrightness,
      active: ColorUtils.adjustBrightness
    },
    secondary: {
      background: 'surface.secondary',
      text: 'text.primary',
      border: 'border.primary'
    },
    danger: {
      background: 'state.error.primary',
      text: 'text.inverse'
    }
  },
  
  status: {
    badge: {
      success: {
        background: 'state.success.background',
        text: 'state.success.text'
      },
      error: {
        background: 'state.error.background',
        text: 'state.error.text'
      },
      warning: {
        background: 'state.warning.background',
        text: 'state.warning.text'
      },
      info: {
        background: 'state.info.background',
        text: 'state.info.text'
      }
    }
  },

  taskFilters: {
    background: 'surface.primary',
    border: 'border.primary',
    text: {
      primary: 'text.primary',
      secondary: 'text.secondary',
      tertiary: 'text.tertiary'
    },
    accent: 'accent',
    filter: {
      active: 'accent',
      inactive: 'text.secondary'
    },
    search: {
      background: 'surface.secondary',
      placeholder: 'text.tertiary',
      text: 'text.primary'
    }
  },

  taskActions: {
    background: 'surface.primary',
    text: {
      primary: 'text.primary',
      secondary: 'text.secondary',
      disabled: 'text.disabled'
    },
    accent: 'accent',
    action: {
      available: 'accent',
      disabled: 'text.disabled'
    },
    expanding: {
      color: 'accent',
      background: 'surface.secondary'
    }
  },

  taskDetails: {
    background: 'surface.primary',
    border: 'border.primary',
    text: {
      primary: 'text.primary',
      secondary: 'text.secondary',
      tertiary: 'text.tertiary'
    },
    accent: 'accent',
    header: {
      background: 'surface.secondary',
      text: 'text.primary'
    },
    scroll: {
      indicator: 'text.tertiary',
      background: 'surface.tertiary'
    }
  },

  taskStats: {
    background: 'surface.primary',
    text: {
      primary: 'text.primary',
      secondary: 'text.secondary',
      tertiary: 'text.tertiary'
    },
    accent: 'accent',
    status: {
      complete: 'state.success.primary',
      partial: 'state.warning.primary',
      minimal: 'state.error.primary'
    },
    git: {
      clean: 'state.success.primary',
      dirty: 'state.warning.primary'
    }
  },

  // Claude Code component themes
  claudeCodeScreen: {
    background: 'surface.primary',
    text: {
      primary: 'text.primary',
      secondary: 'text.secondary',
      tertiary: 'text.tertiary'
    },
    accent: 'accent',
    border: 'border.primary',
    success: 'state.success.primary',
    error: 'state.error.primary',
    warning: 'state.warning.primary',
    info: 'state.info.primary'
  },
  
  claudeSessionList: {
    background: 'surface.primary',
    text: {
      primary: 'text.primary',
      secondary: 'text.secondary',
      tertiary: 'text.tertiary'
    },
    accent: 'accent',
    item: {
      selected: 'interactive.selected',
      highlighted: 'accent'
    },
    filter: {
      active: 'accent',
      inactive: 'text.secondary',
      count: 'text.tertiary'
    },
    session: {
      active: 'state.success.primary',
      finished: 'text.tertiary',
      subtask: 'state.warning.primary'
    }
  },
  
  claudeActiveSession: {
    background: 'surface.primary',
    text: {
      primary: 'text.primary',
      secondary: 'text.secondary',
      tertiary: 'text.tertiary'
    },
    accent: 'accent',
    message: {
      user: 'text.primary',
      assistant: 'accent',
      system: 'text.tertiary',
      error: 'state.error.primary'
    },
    insight: {
      category: 'state.warning.primary',
      text: 'text.secondary'
    },
    processing: 'accent',
    input: {
      background: 'surface.secondary',
      text: 'text.primary',
      placeholder: 'text.tertiary'
    }
  },
  
  claudeSessionActions: {
    background: 'surface.primary',
    text: {
      primary: 'text.primary',
      secondary: 'text.secondary',
      tertiary: 'text.tertiary'
    },
    accent: 'accent',
    action: {
      enabled: 'text.primary',
      disabled: 'text.disabled',
      primary: 'accent',
      danger: 'state.error.primary'
    },
    menu: {
      border: 'accent',
      item: 'text.primary',
      disabled: 'text.disabled'
    },
    config: {
      valid: 'state.success.primary',
      invalid: 'state.error.primary',
      status: 'text.tertiary'
    }
  }
};

// Advanced terminal detection
class ThemeDetector {
  constructor() {
    this.cache = null;
    this.cacheTimeout = 5000; // 5 seconds
    this.lastCacheTime = 0;
  }

  /**
   * Detect terminal theme with caching
   * @returns {string} 'light' or 'dark'
   */
  detect() {
    const now = Date.now();
    if (this.cache && (now - this.lastCacheTime) < this.cacheTimeout) {
      return this.cache;
    }

    const result = this._performDetection();
    this.cache = result;
    this.lastCacheTime = now;
    return result;
  }

  _performDetection() {
    // Check environment variable override
    if (process.env.TASKMASTER_THEME) {
      return process.env.TASKMASTER_THEME;
    }

    // Check for NO_COLOR standard
    if (process.env.NO_COLOR) {
      return 'light'; // Assume light theme when colors are disabled
    }

    // Check FORCE_COLOR
    if (process.env.FORCE_COLOR === '0') {
      return 'light';
    }

    // Platform-specific detection
    if (process.platform === 'darwin') {
      return this._detectMacOS();
    } else if (process.platform === 'win32') {
      return this._detectWindows();
    } else {
      return this._detectLinux();
    }
  }

  _detectMacOS() {
    try {
      // Check system appearance
      const appearance = execSync(
        'defaults read -g AppleInterfaceStyle 2>/dev/null',
        { encoding: 'utf8' }
      ).trim();
      
      if (appearance === 'Dark') {
        return 'dark';
      }
    } catch (e) {
      // Not in dark mode or command failed
    }

    // Check specific terminal apps
    const termProgram = process.env.TERM_PROGRAM;
    
    if (termProgram === 'iTerm.app') {
      return this._detectITerm2();
    } else if (termProgram === 'Apple_Terminal') {
      return this._detectAppleTerminal();
    } else if (termProgram === 'vscode') {
      return 'dark'; // VS Code terminal usually dark
    }

    return 'dark'; // Default for macOS
  }

  _detectITerm2() {
    // iTerm2 exposes theme info through environment variables
    if (process.env.ITERM_PROFILE) {
      const profile = process.env.ITERM_PROFILE.toLowerCase();
      if (profile.includes('light') || profile.includes('solarized')) {
        return 'light';
      }
    }
    return 'dark';
  }

  _detectAppleTerminal() {
    // Check TERM_APPEARANCE if available
    if (process.env.TERM_APPEARANCE) {
      return process.env.TERM_APPEARANCE;
    }

    try {
      const profile = execSync(
        'defaults read com.apple.Terminal "Default Window Settings" 2>/dev/null',
        { encoding: 'utf8' }
      ).trim();

      const lightProfiles = ['Basic', 'Man Page', 'Ocean', 'Grass', 'Homebrew'];
      if (lightProfiles.includes(profile)) {
        return 'light';
      }
    } catch (e) {
      // Ignore
    }

    return 'dark';
  }

  _detectWindows() {
    // Windows Terminal detection
    if (process.env.WT_SESSION) {
      // Windows Terminal usually uses dark theme
      return 'dark';
    }

    // PowerShell detection
    if (process.env.PSModulePath) {
      return 'dark'; // PowerShell usually dark
    }

    // Check registry for system theme (requires additional tools)
    // For now, default to dark
    return 'dark';
  }

  _detectLinux() {
    // Check common Linux terminal emulators
    const term = process.env.TERM || '';
    const colorterm = process.env.COLORTERM || '';

    // GNOME Terminal
    if (colorterm === 'truecolor' || colorterm === '24bit') {
      return 'dark'; // Modern terminals usually dark
    }

    // Check for specific terminals
    if (term.includes('256color')) {
      return 'dark';
    }

    // Check COLORFGBG
    const colorFgBg = process.env.COLORFGBG || '';
    if (colorFgBg) {
      const parts = colorFgBg.split(';');
      if (parts.length >= 2) {
        const bg = parseInt(parts[1], 10);
        // 7 = white, 15 = bright white (light backgrounds)
        if (bg === 7 || bg === 15) {
          return 'light';
        }
      }
    }

    return 'dark'; // Default for Linux
  }
}

// Theme manager
export class ThemeManager {
  constructor() {
    this.detector = new ThemeDetector();
    this.currentTheme = null;
    this.themeOverride = null;
  }

  /**
   * Get current theme
   * @returns {Object} Current theme object
   */
  getTheme() {
    if (this.themeOverride) {
      return Themes[this.themeOverride];
    }

    if (!this.currentTheme) {
      const detected = this.detector.detect();
      this.currentTheme = Themes[detected] || Themes.dark;
    }

    return this.currentTheme;
  }

  /**
   * Set theme override
   * @param {string} themeName - 'light', 'dark', or null for auto
   */
  setTheme(themeName) {
    if (themeName && Themes[themeName]) {
      this.themeOverride = themeName;
      this.currentTheme = Themes[themeName];
    } else {
      this.themeOverride = null;
      this.currentTheme = null;
    }
  }

  /**
   * Get themed color value
   * @param {string} colorPath - Dot notation path to color (e.g., 'text.primary')
   * @returns {string} Color value
   */
  getColor(colorPath) {
    // Ensure colorPath is a string
    if (typeof colorPath !== 'string') {
      console.warn('getColor called with non-string value:', colorPath);
      return '#ffffff';
    }

    const theme = this.getTheme();
    const parts = colorPath.split('.');
    let value = theme.colors;

    for (const part of parts) {
      value = value[part];
      if (!value) return '#ffffff';
    }

    return value;
  }

  /**
   * Get component theme
   * @param {string} componentName - Name of component
   * @returns {Object} Component theme configuration
   */
  getComponentTheme(componentName) {
    return ComponentThemes[componentName] || {};
  }

  /**
   * Apply theme to text
   * @param {string} text - Text to style
   * @param {string} colorPath - Color path or hex value
   * @returns {string} Styled text
   */
  style(text, colorPath) {
    const color = colorPath.startsWith('#') ? colorPath : this.getColor(colorPath);
    return ColorUtils.cssToTerminal(color)(text);
  }

  /**
   * Apply gradient to text
   * @param {string} text - Text to style
   * @param {string[]} colorPaths - Array of color paths
   * @returns {string} Styled text with gradient
   */
  gradient(text, colorPaths) {
    const colors = colorPaths.map(path => 
      path.startsWith('#') ? path : this.getColor(path)
    );
    const gradient = Gradients.create(colors[0], colors[colors.length - 1], text.length);
    return Gradients.applyToText(text, gradient);
  }
}

// Export singleton instance
export const themeManager = new ThemeManager();

// Export convenience functions
export const style = (text, color) => themeManager.style(text, color);
export const gradient = (text, colors) => themeManager.gradient(text, colors);
export const getTheme = () => themeManager.getTheme();
export const setTheme = (theme) => themeManager.setTheme(theme);
export const getColor = (path) => themeManager.getColor(path);
export const getComponentTheme = (component) => themeManager.getComponentTheme(component);

// Direct theme access via proxy
export const theme = new Proxy({}, {
  get(target, prop) {
    const currentTheme = themeManager.getTheme();
    const colors = currentTheme.colors;
    
    // Map common property names to theme paths
    const propertyMap = {
      // Primary colors
      background: colors.background.primary,
      foreground: colors.text.primary,
      accent: colors.accent,
      
      // Text colors
      text: colors.text.primary,
      textDim: colors.text.secondary,
      textBright: colors.text.primary,
      
      // UI elements
      border: colors.border.primary,
      selection: colors.interactive.selected,
      selectionText: colors.text.inverse,
      
      // Status colors
      success: colors.state.success.primary,
      error: colors.state.error.primary,
      warning: colors.state.warning.primary,
      info: colors.state.info.primary,
      
      // Task status colors
      statusDone: colors.state.success.primary,
      statusInProgress: colors.state.info.primary,
      statusPending: colors.state.warning.primary,
      statusBlocked: colors.state.error.primary,
      statusDeferred: colors.text.tertiary,
      
      // Priority colors
      priorityHigh: colors.state.error.primary,
      priorityMedium: colors.state.warning.primary,
      priorityLow: colors.state.info.primary
    };
    
    return propertyMap[prop] || themeManager.getColor(prop);
  }
});



export const getCurrentTheme = () => themeManager.getTheme();
export const lightModeTheme = Themes.light.colors;
export const darkModeTheme = Themes.dark.colors; 