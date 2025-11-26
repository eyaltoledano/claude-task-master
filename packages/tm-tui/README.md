# @tm/tui - Task Master Terminal User Interface

A TUI/REPL hybrid powered by **Ink** and **React**, designed to be a single, real-time runtime for Taskmaster.

## Features

- 🎨 **Preserves the timeless UI patterns** from the existing CLI (banners, boxes, tables, colors)
- ⚡ **Real-time, reactive interface** powered by React
- 🔄 **REPL shell** for interactive command execution
- 📦 **Modular components** that match the existing aesthetic

## Architecture

```
packages/tm-tui/
├── src/
│   ├── theme/              # Color system, borders, icons (matches ui.js patterns)
│   │   ├── colors.ts       # Cool/warm gradients, semantic colors
│   │   ├── borders.ts      # Box borders (round, single, double)
│   │   └── icons.ts        # Status icons, progress indicators
│   │
│   ├── components/
│   │   ├── primitives/     # Core building blocks
│   │   │   ├── Text.tsx    # Styled text with variants
│   │   │   ├── Box.tsx     # Boxen-style bordered boxes
│   │   │   └── Banner.tsx  # Figlet-style ASCII banners
│   │   │
│   │   ├── data/           # Data display components
│   │   │   └── Table.tsx   # cli-table3 style tables
│   │   │
│   │   ├── feedback/       # Loading & progress
│   │   │   └── Spinner.tsx # ora-style spinners, progress bars
│   │   │
│   │   ├── input/          # User input components
│   │   │   ├── SelectInput.tsx   # Inquirer-style selection
│   │   │   └── TextInput.tsx     # Readline-style prompts
│   │   │
│   │   └── flows/          # Full application flows
│   │       └── InitFlow.tsx      # Complete init experience
│   │
│   ├── shell/              # REPL infrastructure
│   │   └── Shell.tsx       # Interactive command shell
│   │
│   └── index.ts            # Main exports
│
└── package.json
```

## Usage

### Init Flow

```tsx
import { render } from 'ink';
import { InitFlow } from '@tm/tui';

render(
  <InitFlow 
    onComplete={(config) => {
      console.log('Initialized with:', config);
    }}
  />
);
```

### REPL Shell

```tsx
import { render } from 'ink';
import { Shell } from '@tm/tui';

render(
  <Shell
    showBanner={true}
    initialTag="master"
    storageType="local"
    onExit={() => process.exit(0)}
  />
);
```

### Individual Components

```tsx
import { render } from 'ink';
import { TMBox, Banner, Table, LoadingIndicator } from '@tm/tui';

// Boxed content
<TMBox variant="primary" title="Task Details">
  <Text>Task content here</Text>
</TMBox>

// ASCII banner
<Banner title="Task Master" version="1.0.0" />

// Data table
<Table 
  columns={[
    { header: 'ID', key: 'id' },
    { header: 'Title', key: 'title' }
  ]}
  data={tasks}
/>

// Loading spinner
<LoadingIndicator message="Processing..." status="loading" />
```

## Theme System

The theme system preserves the exact colors and styles from the existing CLI:

```tsx
import { colors, coolGradient, logIcons, statusIcons } from '@tm/tui/theme';

// Use the same color gradients
const gradient = [coolGradient.start, coolGradient.middle, coolGradient.end];

// Status colors match getStatusWithColor from ui.js
colors.statusDone      // Green
colors.statusPending   // Amber
colors.statusInProgress // Blue

// Icons match the existing patterns
logIcons.success  // ✓
logIcons.error    // ✗
statusIcons.done  // ✓
```

## Development

```bash
# Install dependencies
npm install

# Run the dev server (shows init flow)
npm run dev

# Run the shell
npm run dev shell

# Type check
npm run typecheck
```

## Design Principles

1. **Preserve the aesthetic** - The existing UI patterns (boxen, figlet, chalk, ora) are "timeless" and must be respected
2. **No overwrites** - This is a new package that adds capabilities without modifying existing code
3. **React-first** - Built on Ink for reactive, component-based terminal UIs
4. **Progressive enhancement** - Can be adopted incrementally alongside the existing CLI

