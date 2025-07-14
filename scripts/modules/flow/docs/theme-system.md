# Task Master Flow Theme System

The Task Master Flow UI includes a sophisticated theme system with automatic dark/light mode detection, semantic colors, gradients, and component-specific theming.

## Table of Contents

- [Overview](#overview)
- [Core Features](#core-features)
- [Basic Usage](#basic-usage)
- [Color System](#color-system)
- [Component Themes](#component-themes)
- [Advanced Features](#advanced-features)
- [API Reference](#api-reference)
- [Examples](#examples)

## Overview

The theme system (`scripts/modules/flow/theme.js`) provides:

- **Automatic theme detection** - Detects terminal dark/light mode
- **Semantic color system** - Purpose-driven color naming
- **CSS-to-terminal mapping** - Use web colors in terminal
- **Gradient support** - Beautiful text effects
- **Per-component theming** - Consistent component styling

## Core Features

### Auto Theme Detection

The system automatically detects your terminal's theme:

- **macOS**: Checks system appearance and terminal profiles
- **Windows**: Detects Windows Terminal and PowerShell themes
- **Linux**: Analyzes terminal color settings
- **Override**: Use `TASKMASTER_THEME=light` or `TASKMASTER_THEME=dark`

### Semantic Colors

Instead of hardcoded hex values, use meaningful color names:

```javascript
// Instead of this:
<Text color="#ef4444">Error!</Text>

// Use this:
<Text color={style('', 'state.error.primary')}>Error!</Text>
```

## Basic Usage

### Import Theme Utilities

```javascript
import { theme, style, gradient, getComponentTheme } from '../theme.js';
```

### Direct Color Access

```javascript
// Simple property access
<Text color={theme.accent}>Highlighted text</Text>
<Text color={theme.textDim}>Dimmed text</Text>
<Box borderColor={theme.border}>Content</Box>

// Available direct properties:
// accent, text, textDim, textBright, background, foreground
// border, success, error, warning, info
// statusDone, statusInProgress, statusPending, statusBlocked
// priorityHigh, priorityMedium, priorityLow
```

### Styled Text

```javascript
// Apply color to text
const styledText = style('Hello World', 'accent');
const errorText = style('Error!', 'state.error.primary');
```

### Gradients

```javascript
// Create gradient text
const header = gradient('Task Master Flow', ['primary', 'secondary']);
const title = gradient('Welcome!', ['accent', 'primary']);
```

## Color System

### Base Semantic Colors

```javascript
// Brand colors
primary: '#3b82f6'      // Blue
secondary: '#8b5cf6'    // Purple  
tertiary: '#10b981'     // Emerald
accent: '#06b6d4'       // Cyan

// State colors
state.success.primary   // Green shades
state.error.primary     // Red shades
state.warning.primary   // Yellow/amber shades
state.info.primary      // Blue shades

// Text colors
text.primary           // Main text
text.secondary         // Subdued text
text.tertiary          // Very dim text
text.inverse           // Inverted text

// UI colors
background.primary     // Main background
border.primary         // Main borders
surface.primary        // Card/panel backgrounds
```

### Theme-Specific Overrides

Light and dark themes override certain colors:

```javascript
// Light theme
accent: '#0891b2'       // Darker cyan for readability

// Dark theme  
accent: '#22d3ee'       // Bright cyan for contrast
text.primary: '#f1f5f9' // Light gray for dark backgrounds
```

## Component Themes

Pre-defined themes for common UI components:

### Task List Theme

```javascript
const taskTheme = getComponentTheme('taskList');

// Available properties:
taskTheme.header.gradient    // ['primary', 'secondary']
taskTheme.item.background    // 'surface.primary'
taskTheme.item.border        // 'border.primary'
taskTheme.status.done        // 'state.success.primary'
taskTheme.status.pending     // 'state.warning.primary'
```

### Command Palette Theme

```javascript
const cmdTheme = getComponentTheme('commandPalette');

// Available properties:
cmdTheme.background          // 'background.secondary'
cmdTheme.border              // 'border.focus'
cmdTheme.input.text          // 'text.primary'
cmdTheme.suggestions.hover   // 'interactive.hover'
```

### Modal Theme

```javascript
const modalTheme = getComponentTheme('modal');

// Available properties:
modalTheme.overlay           // 'background.overlay'
modalTheme.content.background // 'surface.primary'
modalTheme.header.background  // 'surface.secondary'
```

### Button Theme

```javascript
const buttonTheme = getComponentTheme('button');

// Available properties:
buttonTheme.primary.background  // 'primary'
buttonTheme.primary.text        // 'text.inverse'
buttonTheme.danger.background   // 'state.error.primary'
```

### Status Badge Theme

```javascript
const statusTheme = getComponentTheme('status');

// Available properties:
statusTheme.badge.success.background  // 'state.success.background'
statusTheme.badge.success.text        // 'state.success.text'
statusTheme.badge.error.background    // 'state.error.background'
```

## Advanced Features

### Theme Detection & Override

```javascript
import { getTheme, setTheme } from '../theme.js';

// Get current theme info
const currentTheme = getTheme();
console.log(currentTheme.name); // 'Light' or 'Dark'
console.log(currentTheme.type); // 'light' or 'dark'

// Force a specific theme
setTheme('dark');   // Force dark mode
setTheme('light');  // Force light mode
setTheme(null);     // Back to auto-detection
```

### Direct Color Access

```javascript
import { getColor } from '../theme.js';

// Get color value using dot notation
const primaryColor = getColor('primary');           // '#3b82f6'
const successBg = getColor('state.success.background'); // '#d1fae5'
const borderColor = getColor('border.primary');     // '#e5e7eb' or '#334155'
```

### Color Utilities

```javascript
import { ColorUtils } from '../theme.js';

// Convert CSS color to terminal color
const terminalRed = ColorUtils.cssToTerminal('#ff0000');
console.log(terminalRed('Error text'));

// Adjust brightness
const lighter = ColorUtils.adjustBrightness('#3b82f6', 20);  // 20% lighter
const darker = ColorUtils.adjustBrightness('#3b82f6', -20);  // 20% darker

// Color conversion
const rgb = ColorUtils.hexToRgb('#3b82f6');  // { r: 59, g: 130, b: 246 }
const hsl = ColorUtils.rgbToHsl(59, 130, 246); // { h: 217, s: 91, l: 60 }
```

### Custom Gradients

```javascript
import { Gradients } from '../theme.js';

// Create custom gradient
const colors = Gradients.create('#ff0000', '#0000ff', 10);
const gradientText = Gradients.applyToText('Gradient Text', colors);

// Multi-color gradient
const rainbow = gradient('Rainbow Text', ['red', 'yellow', 'green', 'blue']);
```

## API Reference

### Main Exports

```javascript
// Theme manager instance
export const themeManager = new ThemeManager();

// Direct theme object with common properties
export const theme = { /* proxy object */ };

// Utility functions
export const style = (text, colorPath) => string;
export const gradient = (text, colorPaths) => string;
export const getTheme = () => ThemeObject;
export const setTheme = (theme) => void;
export const getColor = (colorPath) => string;
export const getComponentTheme = (componentName) => Object;
```

### ThemeManager Methods

```javascript
class ThemeManager {
  getTheme()              // Get current theme object
  setTheme(themeName)     // Set theme override
  getColor(colorPath)     // Get color by path
  getComponentTheme(name) // Get component theme
  style(text, colorPath)  // Apply color to text
  gradient(text, colors)  // Apply gradient to text
}
```

## Examples

### Welcome Screen with Theme

```javascript
import { theme, gradient } from '../theme.js';

export function WelcomeScreen() {
  return (
    <Box>
      <Text color={theme.accent}>
        ████████╗ █████╗ ███████╗██╗  ██╗███╗   ███╗ █████╗ ███████╗████████╗███████╗██████╗
      </Text>
      
      <Box flexDirection="row">
        <Text color={theme.accent}>/init</Text>
        <Text>Initialize a new project</Text>
        <Text color={theme.textDim}>ctrl+x i</Text>
      </Box>
    </Box>
  );
}
```

### Status Indicator

```javascript
import { style, getComponentTheme } from '../theme.js';

const StatusBadge = ({ status, text }) => {
  const statusTheme = getComponentTheme('status');
  const colors = statusTheme.badge[status];
  
  return (
    <Box backgroundColor={style('', colors.background)}>
      <Text color={style('', colors.text)}>
        {text}
      </Text>
    </Box>
  );
};

// Usage
<StatusBadge status="success" text="✓ Complete" />
<StatusBadge status="error" text="✗ Failed" />
```

### Task List with Gradients

```javascript
import { gradient, style, getComponentTheme } from '../theme.js';

const TaskList = ({ tasks }) => {
  const taskTheme = getComponentTheme('taskList');
  
  return (
    <Box>
      <Text>
        {gradient('═══ Task List ═══', taskTheme.header.gradient)}
      </Text>
      
      {tasks.map(task => (
        <Box key={task.id}>
          <Text>{task.title}</Text>
          <Text color={style('', taskTheme.status[task.status])}>
            {task.status}
          </Text>
        </Box>
      ))}
    </Box>
  );
};
```

### Theme-Aware Component

```javascript
import { getTheme, style } from '../theme.js';

const ThemeAwareBox = ({ children }) => {
  const theme = getTheme();
  const isLight = theme.type === 'light';
  
  return (
    <Box 
      backgroundColor={style('', isLight ? 'background.secondary' : 'surface.primary')}
      borderColor={style('', 'border.primary')}
    >
      {children}
    </Box>
  );
};
```

## Best Practices

1. **Use Semantic Colors**: Prefer `state.error.primary` over hardcoded `#ef4444`
2. **Component Themes**: Use pre-defined component themes for consistency
3. **Theme Detection**: Let the system auto-detect unless user explicitly overrides
4. **Gradients**: Use sparingly for headers and special emphasis
5. **Color Paths**: Use dot notation for nested color access
6. **Testing**: Test your UI in both light and dark themes

## Migration from Old Theme

If migrating from the old theme system:

```javascript
// Old way
import { theme } from './theme.js';
<Text color={theme.accent}>{text}</Text>

// New way (works the same!)
import { theme } from './theme.js';
<Text color={theme.accent}>{text}</Text>

// Or use semantic colors
import { style } from './theme.js';
<Text color={style('', 'accent')}>{text}</Text>
```

The new system maintains backward compatibility while adding powerful new features! 