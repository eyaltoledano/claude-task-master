# Theme Migration Guide

This guide documents the completed migration of Task Master Flow components to the unified theme system.

## Migration Status

### ✅ Fully Migrated (28 components)
- AnalyzeComplexityScreen - uses `style`, `gradient`
- CommandPalette - uses `style`, `getComponentTheme`  
- LoadingSpinner - uses `theme` proxy
- StatusScreen - uses `style`, `gradient`, `getComponentTheme`, `getColor`
- WelcomeScreen - uses `theme` proxy
- ThemeDemo - demonstration component
- FileBrowser - uses `theme` proxy
- NextTaskModal - uses `theme` proxy
- TaskListPopup - uses `theme` proxy
- TagManagementScreen - uses `theme` proxy
- MCPServerDetails - uses `theme` proxy
- ExpandModal - uses `theme` proxy
- MCPToolViewer - uses `theme` proxy
- ParsePRDScreen - uses `theme` proxy
- MCPServerForm - uses `theme` proxy
- WorktreeBranchConflictModal - uses `theme` proxy
- MCPManagementScreen - uses `theme` proxy (has linter errors)
- CommandSuggestions - uses `theme` proxy
- MCPServerManager - uses `theme` proxy (has linter errors)
- GitWorktreeScreen - uses `getTheme()`
- AddWorktreeModal - uses `getTheme()`
- WorktreeDetailsModal - uses `getTheme()`
- LinkTasksModal - uses `getTheme()`
- ClaudeWorktreeLauncherModal - uses `getTheme()`
- ChatScreen - uses `getCurrentTheme()` (has linter errors)
- WorktreePromptModal - uses `getCurrentTheme()`
- ClaudeCodeScreen - uses `getTheme()`
- TaskManagementScreen - uses `getTheme()` (has linter errors)

### ⚠️ Linter Errors (Need Fixing)
Several migrated components have linter errors unrelated to the theme migration:
- MCPManagementScreen - switch clause declarations, array index keys
- MCPServerManager - useless catch clause
- ChatScreen - multiple array index keys, unused variable
- TaskManagementScreen - multiple array index keys

These errors existed before migration and should be fixed separately.

## Migration Steps

### Step 1: Update Import Statement

**Old:**
```javascript
import { theme } from '../theme.js';
// or
import { getTheme } from '../theme.js';
// or
import { getCurrentTheme } from '../theme.js';
```

**New:**
```javascript
import { theme } from '../theme.js';
// or
import { getTheme } from '../theme.js';
// or
import { getCurrentTheme } from '../theme.js';
// or for advanced features:
import { style, gradient, getComponentTheme } from '../theme.js';
```

### Step 2: Update Color Usage

The theme proxy object provides backward compatibility for most common properties:

**Direct Properties (work as-is):**
- `theme.accent` - Accent color
- `theme.text` - Primary text color
- `theme.textDim` - Secondary text color
- `theme.border` - Border color
- `theme.success`, `theme.error`, `theme.warning`, `theme.info` - Status colors
- `theme.selection`, `theme.selectionText` - Selection colors

**For Advanced Usage:**
```javascript
// Style text with semantic colors
<Text>{style('Hello', 'primary')}</Text>

// Apply gradients
<Text>{gradient('Rainbow text', ['primary', 'secondary'])}</Text>

// Get component-specific theme
const taskTheme = getComponentTheme('taskList');
```

## Common Patterns

### Pattern 1: Simple Color Usage
Most components just use theme colors directly and only need the import changed:

```javascript
// Works with just import change
<Text color={theme.accent}>Title</Text>
<Box borderColor={theme.border}>Content</Box>
```

### Pattern 2: Theme Function Usage
Components using `getTheme()` or `getCurrentTheme()` work with just the import change:

```javascript
const theme = getTheme(); // Works as before
// or
const theme = getCurrentTheme(); // Also works
```

### Pattern 3: Advanced Features
For components that need gradient or advanced theming:

```javascript
import { gradient, style, getComponentTheme } from '../theme.js';

// Use gradient for headers
<Text>{gradient('Welcome', ['primary', 'secondary'])}</Text>

// Use semantic styling
<Text>{style('Error!', 'state.error.primary')}</Text>
```

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
import { themeManager, style, gradient, getComponentTheme } from './theme.js';
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
import { ColorUtils } from './theme.js';

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