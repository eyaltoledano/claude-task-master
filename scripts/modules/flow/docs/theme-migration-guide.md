# Theme System Migration Guide

This guide helps you migrate from the old theme system to the new advanced theme system inspired by Gemini CLI.

## Key Improvements

1. **Semantic Color System** - Colors now have purpose-driven names
2. **CSS-to-Terminal Mapping** - Use web colors in terminal
3. **Gradient Support** - Beautiful gradient text effects
4. **Per-Component Theming** - Component-specific color schemes
5. **Advanced Detection** - Better terminal theme detection with caching

## Migration Steps

### 1. Update Imports

**Old:**
```javascript
import { theme, getCurrentTheme } from './theme.js';
```

**New:**
```javascript
import { themeManager, style, gradient, getComponentTheme } from './theme-advanced.js';
```

### 2. Color Access

**Old:**
```javascript
// Direct color access
const color = theme.text;
const borderColor = theme.border;
```

**New:**
```javascript
// Semantic color access
const color = themeManager.getColor('text.primary');
const borderColor = themeManager.getColor('border.primary');

// Or use the style helper
const styledText = style('Hello', 'text.primary');
```

### 3. Status Colors

**Old:**
```javascript
const statusColor = theme.statusDone; // or statusInProgress, etc.
```

**New:**
```javascript
// More semantic and nested structure
const statusColor = themeManager.getColor('state.success.primary');

// Or for component-specific status
const taskTheme = getComponentTheme('taskList');
const doneColor = themeManager.getColor(taskTheme.status.done);
```

### 4. Text Styling

**Old:**
```javascript
import chalk from 'chalk';
const text = chalk.hex(theme.text)('Hello World');
```

**New:**
```javascript
// Simple styling
const text = style('Hello World', 'text.primary');

// With gradients
const title = gradient('Task Master', ['primary', 'secondary']);
```

### 5. Component Theming

**Old:**
```javascript
// Manual color application
<Box borderColor={theme.border}>
  <Text color={theme.text}>Content</Text>
</Box>
```

**New:**
```javascript
// Component-aware theming
const modalTheme = getComponentTheme('modal');

<Box borderColor={themeManager.getColor(modalTheme.content.border)}>
  <Text>{style('Content', 'text.primary')}</Text>
</Box>
```

## Color Mapping Reference

| Old Color Name | New Semantic Path |
|----------------|-------------------|
| `background` | `background.primary` |
| `foreground` | `text.primary` |
| `text` | `text.primary` |
| `textDim` | `text.secondary` |
| `textBright` | `text.primary` |
| `border` | `border.primary` |
| `selection` | `interactive.selected` |
| `success` | `state.success.primary` |
| `error` | `state.error.primary` |
| `warning` | `state.warning.primary` |
| `info` | `state.info.primary` |
| `statusDone` | `state.success.primary` |
| `statusInProgress` | `state.info.primary` |
| `statusPending` | `state.warning.primary` |
| `statusBlocked` | `state.error.primary` |
| `priorityHigh` | `state.error.primary` |
| `priorityMedium` | `state.warning.primary` |
| `priorityLow` | `state.info.primary` |

## New Features Usage

### Gradients
```javascript
// Simple gradient
const header = gradient('Welcome to Task Master', ['primary', 'secondary']);

// Multi-color gradient
const rainbow = gradient('Rainbow Text', ['#ff0000', '#00ff00', '#0000ff']);
```

### Color Manipulation
```javascript
import { ColorUtils } from './theme-advanced.js';

// Adjust brightness
const lighter = ColorUtils.adjustBrightness('#0066cc', 20); // 20% lighter
const darker = ColorUtils.adjustBrightness('#0066cc', -20); // 20% darker

// Convert CSS to terminal
const terminalColor = ColorUtils.cssToTerminal('#0066cc');
```

### Component Themes
```javascript
// Get complete component theme
const buttonTheme = getComponentTheme('button');

// Apply variant
const primaryButton = buttonTheme.primary;
const dangerButton = buttonTheme.danger;
```

### Theme Detection
```javascript
// Get current theme info
const theme = themeManager.getTheme();
console.log(`Using ${theme.name} theme (${theme.type})`);

// Override theme
themeManager.setTheme('dark'); // Force dark theme
themeManager.setTheme('light'); // Force light theme
themeManager.setTheme(null); // Back to auto-detection
```

## Best Practices

1. **Use Semantic Colors** - Prefer `text.primary` over hardcoded hex values
2. **Component Consistency** - Use `getComponentTheme()` for component-specific styling
3. **Leverage Gradients** - Use gradients for headers and important UI elements
4. **Cache Theme Access** - Store theme references in component state when possible
5. **Test Both Themes** - Always test your UI in both light and dark modes

## Environment Variables

- `TASKMASTER_THEME` - Set to 'light' or 'dark' to override detection
- `NO_COLOR` - Standard env var to disable colors (forces light theme)
- `FORCE_COLOR` - Set to '0' to disable colors

## Backward Compatibility

The new system maintains backward compatibility through proxy exports:
```javascript
// These still work but are deprecated
export const theme = /* proxy to current theme colors */;
export const getCurrentTheme = () => themeManager.getTheme();
export const lightModeTheme = Themes.light.colors;
export const darkModeTheme = Themes.dark.colors;
```

Consider migrating to the new API for better functionality and future compatibility. 