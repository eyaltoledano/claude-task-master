# Task Master Terminal UI

A real-time, interactive terminal interface for Task Master built with React and Ink. This document provides a comprehensive overview of the terminal UI architecture, dependencies, and usage.

## Table of Contents

- [Overview](#overview)
- [Dependencies](#dependencies)
- [Architecture](#architecture)
- [Usage](#usage)
- [Panels](#panels)
- [Sections](#sections)
- [File Watcher](#file-watcher)
- [Components](#components)
- [Development](#development)

---

## Overview

The Task Master Terminal UI is a full-featured, responsive terminal interface that provides real-time task monitoring, project statistics, and dependency tracking. It automatically updates when tasks change on disk and provides an intuitive keyboard-driven interface for navigating and viewing task details.

**Key Features:**
- Real-time task updates via file watching
- Responsive layout that adapts to terminal size
- Multi-panel interface (Dashboard, Help)
- Task details modal
- Section maximization (Project, Dependencies, Task List)
- Keyboard-driven navigation
- Onboarding flow for uninitialized projects
- Error boundaries with recovery suggestions
- Colored progress bars with status breakdown

---

## Dependencies

### Core Dependencies

#### **Ink (v5.1.0)**
- **Purpose**: React renderer for building terminal UIs
- **Where Used**: Foundation for all components - provides `<Box>`, `<Text>`, hooks (`useInput`, `useApp`, `useStdout`)
- **Why**: Enables building complex terminal UIs using familiar React patterns with automatic layout, input handling, and rendering

#### **React (v18.3.1)**
- **Purpose**: UI component framework
- **Where Used**: All components, hooks, and state management throughout the application
- **Why**: Powers the component-based architecture, state management, and lifecycle management

#### **@tm/core**
- **Purpose**: Task Master core functionality
- **Where Used**:
  - `src/stores/taskStore.ts` - Uses `createTaskMasterCore()` to load tasks
  - `src/hooks/useTaskStore.ts` - Imports `TaskWatcher` for file watching
  - Type definitions (`Task`, `TaskStatus`, `TaskComplexity`) used throughout
- **Why**: Provides the core API for loading tasks, parsing task data, and watching for file changes

#### **@tm/cli**
- **Purpose**: CLI utilities and chalk integration
- **Where Used**:
  - `src/index.tsx` - Uses chalk for colored onboarding messages
  - Integrated via `apps/cli/src/commands/interactive.command.ts`
- **Why**: Provides terminal styling utilities and CLI command integration

#### **marked (v15.0.12) & marked-terminal (v7.3.0)**
- **Purpose**: Markdown rendering in terminal
- **Where Used**: Reserved for future task description rendering
- **Why**: Enables rich formatting of task descriptions and documentation in the terminal

#### **string-width (v8.1.0)**
- **Purpose**: Calculate display width of strings with ANSI codes
- **Where Used**: Reserved for accurate text width calculations in responsive layouts
- **Why**: Ensures proper alignment when working with colored text and Unicode characters

### Dev Dependencies

- **TypeScript (v5.9.2)**: Type safety and IDE support
- **Vitest (v2.1.8)**: Testing framework
- **tsx (v4.20.4)**: TypeScript execution for development
- **ink-testing-library (v4.0.0)**: Testing utilities for Ink components
- **Biome (v1.9.4)**: Code formatting and linting

---

## Architecture

### Project Structure

```
apps/terminal-ui/
├── src/
│   ├── index.tsx                    # Entry point & main app component
│   ├── components/                  # Reusable UI components
│   │   ├── BottomStatusBar.tsx     # Status bar with dimensions & controls
│   │   ├── ErrorBoundary.tsx       # Error catching & recovery UI
│   │   ├── Onboarding.tsx          # Onboarding messages (unused, kept for reference)
│   │   ├── StatusBar.tsx           # Generic status bar component
│   │   ├── TopBar.tsx              # Top navigation bar
│   │   └── index.ts                # Component exports
│   ├── views/                      # View layer components
│   │   ├── panels/                 # Full-screen panels
│   │   │   ├── DashboardPanel.tsx  # Main dashboard with 3 sections
│   │   │   └── HelpPanel.tsx       # Help & keyboard shortcuts
│   │   ├── sections/               # Dashboard sections
│   │   │   ├── ProjectDashboardSection.tsx    # Project stats & progress
│   │   │   ├── DependencyStatusSection.tsx    # Dependency metrics
│   │   │   └── TaskListSection.tsx            # Task list with selection
│   │   ├── modals/                 # Modal overlays
│   │   │   ├── TaskDetailsModal.tsx  # Task details popup
│   │   │   └── DimmedOverlay.tsx     # Dimmed background overlay
│   │   └── layouts/                # Layout components
│   │       └── AppLayout.tsx       # Main app layout wrapper
│   ├── hooks/                      # Custom React hooks
│   │   └── useTaskStore.ts         # Task data & file watching hook
│   ├── stores/                     # Data layer
│   │   └── taskStore.ts            # Task data provider & API
│   └── utils/                      # Utility functions
│       ├── error-handling.ts       # Error classification & recovery
│       ├── logger.ts               # Logging utilities
│       ├── project-state.ts        # Project initialization detection
│       └── task-helpers.ts         # Task formatting & display helpers
├── package.json                    # Package configuration
└── tsconfig.json                   # TypeScript configuration
```

### Architectural Layers

#### 1. **Entry Point** (`index.tsx`)
- Main app component with error boundary
- Panel routing (Dashboard, Help)
- Global keyboard shortcuts
- Onboarding flow detection
- Screen clearing on launch/exit

#### 2. **Panels** (`views/panels/`)
Full-screen views that occupy the entire content area:
- **DashboardPanel**: Main view with 3 sections (Project, Dependencies, Task List)
- **HelpPanel**: Keyboard shortcuts and usage tips

#### 3. **Sections** (`views/sections/`)
Sub-components that make up the Dashboard panel:
- **ProjectDashboardSection**: Task/subtask progress bars, status counts, priority breakdown
- **DependencyStatusSection**: Dependency metrics and next task recommendation
- **TaskListSection**: Scrollable task list with selection highlighting

#### 4. **Modals** (`views/modals/`)
Overlay components:
- **TaskDetailsModal**: Full task details with parent task info, description, dependencies, test strategy
- **DimmedOverlay**: Background dimming effect for modals

#### 5. **Components** (`components/`)
Reusable UI elements:
- **TopBar**: Panel indicator and navigation at the top
- **BottomStatusBar**: Terminal dimensions, panel name, contextual keyboard shortcuts
- **ErrorBoundary**: React error boundary with recovery suggestions and error classification
- **StatusBar**: Advanced status bar with live task statistics and system messages (alternative implementation, not currently used)
- **Onboarding**: Onboarding message components (alternative implementation, not currently used - onboarding is handled via console.log in index.tsx)

#### 6. **Hooks** (`hooks/`)
Custom React hooks:
- **useTaskStore**: Provides task data, loading state, error handling, and file watching

#### 7. **Stores** (`stores/`)
Data layer:
- **taskStore**: Abstracts task loading via `@tm/core`, loads complexity reports, filters tasks by status

#### 8. **Utils** (`utils/`)
Utility functions:
- **task-helpers.ts**: `getStatusColor`, `getPriorityColor`, `getComplexityDisplay`, `padText`, `flattenTasks`
- **error-handling.ts**: Error classification and recovery action suggestions
- **logger.ts**: Structured logging
- **project-state.ts**: Detects project initialization state for onboarding

---

## Usage

### Launching the Terminal UI

#### Via CLI Command

```bash
# Launch with default settings
task-master interactive

# Alternative alias
task-master tui

# Specify initial panel
task-master interactive --panel=dashboard
task-master interactive --panel=help

# Specify project path
task-master interactive --project=/path/to/project
```

#### Programmatic Launch

```typescript
import { launchTerminalUI } from '@tm/terminal-ui';

// Launch with default settings
await launchTerminalUI();

// Launch with specific panel
await launchTerminalUI({ panel: 'help' });
```

### Onboarding Flow

The terminal UI automatically detects project state and shows appropriate onboarding messages:

#### 1. **Uninitialized Project** (No `.taskmaster` directory)
Shows instructions to:
1. Run `task-master init`
2. Parse PRD: `task-master parse-prd .taskmaster/docs/prd.txt`
3. Launch UI: `task-master interactive`

#### 2. **No Tasks** (`.taskmaster` exists but no tasks)
Shows instructions to:
1. Create PRD file in `.taskmaster/docs/prd.txt`
2. Generate tasks: `task-master parse-prd .taskmaster/docs/prd.txt`
3. Or manually add tasks: `task-master add-task --prompt="description"`

#### 3. **Has Tasks** (Ready to use)
Launches the full terminal UI

### Keyboard Shortcuts

#### Global Controls
- **`Tab`** - Switch between Dashboard and Help panels
- **`q` or `Ctrl+C`** - Exit the application

#### Dashboard Panel
- **`↑` / `↓`** - Navigate up/down in task list
- **`PageUp` / `PageDown`** - Jump 10 tasks up/down
- **`Enter`** - Open task details modal
- **`0`** - Show all sections (default layout)
- **`1`** - Maximize Project Dashboard section
- **`2`** - Maximize Dependency Status section
- **`3`** - Maximize Task List section

#### Modal Controls (Task Details)
- **`Esc` / `Enter` / `q`** - Close modal

---

## Panels

### Dashboard Panel

The main panel showing project status and task list. It uses a responsive 2-row layout:

**Top Row (40% height)**: Split into two columns
- **Left**: Project Dashboard Section
- **Right**: Dependency Status Section

**Bottom Row (60% height)**: Full width
- **Task List Section** with scrolling and selection

#### Section Maximization

Users can maximize any section to full screen:
- Press `1` to maximize Project Dashboard
- Press `2` to maximize Dependency Status
- Press `3` to maximize Task List
- Press `0` to restore normal layout

**Layout Logic** (`DashboardPanel.tsx:32-62`):
```typescript
if (maximizedSection === 'project') {
  return <ProjectDashboardSection />; // Full height
}
if (maximizedSection === 'dependency') {
  return <DependencyStatusSection />; // Full height
}
if (maximizedSection === 'tasklist') {
  return <TaskListSection maxHeight={contentHeight} />; // Full height
}
// Default: Show all sections in 2-row layout
```

### Help Panel

Displays keyboard shortcuts and usage tips. Accessible via `Tab` from any panel.

**Contents**:
- Navigation shortcuts
- Panel-specific controls
- General tips

---

## Sections

### ProjectDashboardSection

**Location**: `views/sections/ProjectDashboardSection.tsx`

**Purpose**: Displays project-wide statistics and progress metrics

**Features**:
- **Task Progress Bar**: Visual progress with status breakdown
  - Green (█): Done tasks
  - Gray (█): Cancelled/Deferred tasks
  - Blue (█): In-progress tasks
  - Magenta (░): Review tasks
  - Yellow (░): Pending tasks
  - Red (░): Blocked tasks
- **Status Counts**: Detailed breakdown of tasks by status
- **Subtask Progress Bar**: Same visual style for subtasks
- **Priority Breakdown**: High/Medium/Low priority counts with colored indicators

**Data Sources**:
- Task list from `useTaskStore`
- Calculates statistics on each render

**Layout**: Vertical stack with bordered box

### DependencyStatusSection

**Location**: `views/sections/DependencyStatusSection.tsx`

**Purpose**: Shows dependency relationships and recommends next task to work on

**Features**:
- **Dependency Metrics**:
  - Tasks with no dependencies
  - Tasks ready to work on (dependencies satisfied)
  - Tasks blocked by dependencies
  - Most depended-on task (with dependent count)
  - Average dependencies per task
- **Next Task Recommendation**:
  - Automatically finds first pending task with satisfied dependencies
  - Shows task ID, title, priority, dependencies, and complexity
  - Uses complexity map if available from complexity report

**Algorithm** (`DependencyStatusSection.tsx:63-70`):
```typescript
const nextTask = tasks.find((t) => {
  if (t.status !== 'pending') return false;
  if (!t.dependencies || t.dependencies.length === 0) return true;
  return t.dependencies.every((depId) => {
    const depTask = tasks.find((dt) => dt.id === depId);
    return depTask?.status === 'done';
  });
});
```

**Layout**: Vertical stack with bordered box

### TaskListSection

**Location**: `views/sections/TaskListSection.tsx`

**Purpose**: Displays scrollable, selectable list of all tasks and subtasks

**Features**:
- **Hierarchical Display**:
  - Main tasks shown with full details
  - Subtasks indented with "↳" indicator
- **Columns**:
  - ID (fixed width 8 chars)
  - Title (flexible, grows with available space)
  - Description (flexible)
  - Status (fixed width 12 chars, colored)
  - Priority (fixed width 8 chars, colored)
  - Dependencies (flexible, comma-separated IDs)
  - Complexity (fixed width 8 chars, dot indicators)
- **Selection Highlighting**:
  - Selected row has blue background
  - White text on blue for readability
- **Scrolling**:
  - Managed by parent component via `scrollOffset` and `selectedIndex` props
  - Auto-scrolls to keep selected item visible
- **Responsive Width**:
  - Columns adjust based on terminal width
  - Text truncation with ellipsis (…) when needed

**Task Flattening** (`index.tsx:54-66`):
```typescript
const flattenedTasks: Array<any> = [];
tasks.forEach((task) => {
  flattenedTasks.push(task);
  if (task.subtasks && task.subtasks.length > 0) {
    task.subtasks.forEach((subtask) => {
      flattenedTasks.push({
        ...subtask,
        isSubtask: true,
        parentId: task.id
      });
    });
  }
});
```

**Layout**: Bordered table with header row and scrollable content

---

## File Watcher

### Implementation

**Location**: `hooks/useTaskStore.ts:41-89`

**Technology**: Uses `TaskWatcher` from `@tm/core/storage`

**Purpose**: Automatically reload tasks when files change in `.taskmaster` directory

### Configuration

```typescript
const watcher = new TaskWatcher(taskMasterDir, {
  ignoreInitial: true,           // Don't trigger on startup
  persistent: true,              // Keep watcher alive
  debounceDelay: 500,           // Wait 500ms after last change
  filePatterns: ['**/*.json'],  // Only watch JSON files
  ignorePatterns: [             // Ignore these directories
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**'
  ]
});
```

### Events Handled

- **`onTaskFileChanged`**: Triggers `loadTasks()` when task files are modified
- **`onTaskFileAdded`**: Triggers `loadTasks()` when new task files are added
- **`onTaskFileDeleted`**: Triggers `loadTasks()` when task files are deleted
- **`onReady`**: Sets `watcherReady` flag for proper cleanup

### Lifecycle

1. **Mount** (`useEffect`): Start watcher when component mounts
2. **File Change**: Debounced reload of tasks (500ms delay)
3. **Unmount**: Stop watcher and cleanup resources

### Error Handling

- Watcher failures are silently ignored (optional feature)
- Cleanup errors during unmount are caught and ignored
- UI remains functional even if watcher fails

### Benefits

- **Real-time Updates**: See task changes immediately without manual refresh
- **Multi-User Support**: Changes from CLI or other processes are reflected
- **Efficient**: Debouncing prevents excessive reloads during rapid changes
- **Resilient**: Graceful degradation if watcher fails

---

## Components

### TopBar

**Location**: `components/TopBar.tsx`

**Purpose**: Navigation bar showing application name, available panels, and basic controls

**Props**:
- `currentPanel: 'dashboard' | 'help'`

**Features**:
- **Application Name**: "Task Master" in bold cyan
- **Panel Indicators**: Shows Dashboard and Help with visual indicators
  - Current panel: Green color, bold text, with ">" prefix
  - Inactive panel: Gray color
- **Quick Controls**: "Tab to switch | q to quit" hint in dimmed text

**Layout**: Single border box with horizontal text layout, fixed height (1 line + borders)

### BottomStatusBar

**Location**: `components/BottomStatusBar.tsx`

**Purpose**: Displays terminal dimensions, current panel, and contextual keyboard shortcuts

**Props**:
- `dimensions: { width: number; height: number }`
- `currentPanel: 'dashboard' | 'help'`
- `maximizedSection?: null | 'project' | 'dependency' | 'tasklist'`

**Features**:
- Shows terminal size (e.g., "80x24")
- Shows current panel name in uppercase
- Shows contextual controls based on state:
  - Normal dashboard: "1=Project 2=Dependencies 3=Tasks | Enter for Details"
  - Maximized section: "0=Dashboard | Enter for Details"
  - Help panel: No controls shown

**Layout**: Centered text with single border, fixed height (1 line + borders)

### ErrorBoundary

**Location**: `components/ErrorBoundary.tsx`

**Purpose**: Catches React errors and displays user-friendly fallback UI

**Props**:
- `children: ReactNode` - Components to wrap
- `fallback?: ReactNode` - Custom fallback UI
- `onError?: (error, errorInfo) => void` - Error callback
- `showDetails?: boolean` - Show component stack trace

**Features**:
- Error classification via `classifyError()` utility
- Recovery action suggestions
- Optional component stack trace display
- Structured logging via logger

**Error Classification Categories**:
- File system errors
- Network errors
- Validation errors
- Configuration errors
- Runtime errors

**Layout**: Red bordered box with error message and recovery actions

### TaskDetailsModal

**Location**: `views/modals/TaskDetailsModal.tsx`

**Purpose**: Displays full task details in a centered modal overlay

**Props**:
- `task: Task` - Task to display
- `tasks: Task[]` - All tasks (for parent lookup)
- `complexityMap: Map<string, number> | null` - Complexity scores
- `dimensions: { width, height }` - Terminal size
- `getStatusColor: (status) => string` - Status color helper
- `getPriorityColor: (priority) => string` - Priority color helper
- `getComplexityDisplay: (complexity) => object` - Complexity formatter

**Features**:
- **Parent Task Info**: If subtask, shows parent task ID, title, and priority
- **Task Info Section**:
  - ID, title, status (colored)
  - Priority (colored), dependencies (comma-separated)
  - Complexity (colored with dot indicators)
- **Description**: Wrapped text
- **Test Strategy**: If defined
- **Subtasks**: If present, shows list with IDs and titles
- **Close Instruction**: "Press Esc, Enter, or q to close"

**Layout**:
- Centered modal (60% width, 70% height)
- Border style: "round"
- Dimmed overlay behind modal

### StatusBar (Alternative Implementation)

**Location**: `components/StatusBar.tsx`

**Purpose**: Advanced status bar with live task statistics and system messages

**Status**: Not currently used in production. Alternative to `BottomStatusBar` with more features.

**Features**:
- **Live Task Statistics**: Real-time counts via TaskMasterCore
- **System Messages**: Colored message banners with auto-dismiss
- **File Watching**: Optional live updates via Task Watcher
- **Polling Fallback**: Falls back to polling if watcher unavailable
- **Progress Percentage**: Completion percentage calculation
- **Status Breakdown**: In-progress, completed, pending, review, blocked counts
- **Message Types**: Error (red), warning (yellow), success (green), info (blue)

**Props**:
- `projectPath: string` - Project root for TaskMasterCore
- `tag?: string` - Optional tag filter
- `tmCore?: TaskMasterCore` - Reusable core instance
- `showExitInstructions?: boolean` - Show exit hint
- `exitKeyText?: string` - Custom exit key text
- `initialMessages?: SystemMessage[]` - Initial messages
- `onMessageDismissed?: (id) => void` - Message dismiss callback
- `defaultAutoDismissDelay?: number` - Auto-dismiss delay (default 5000ms)
- `enableLiveUpdates?: boolean` - Use file watching (default true)
- `refreshInterval?: number` - Polling interval if watcher disabled (default 10000ms)

**Use Case**: Can be used for future implementations requiring system-wide messages and more detailed statistics.

### AppLayout (Alternative Implementation)

**Location**: `views/layouts/AppLayout.tsx`

**Purpose**: Generic application layout with header, subtitle, instructions, and content area

**Status**: Not currently used in production. Reserved for future use.

**Features**:
- **Title Section**: Bold cyan title
- **Subtitle**: Optional dimmed text next to title
- **Instructions Section**: Optional instructional content area
- **Content Area**: Main content with flexible height

**Props**:
- `title: string` - Page/section title
- `subtitle?: ReactNode` - Optional subtitle
- `instructions?: ReactNode` - Optional instructions
- `dimensions: { width, height }` - Terminal size
- `children: ReactNode` - Main content

**Use Case**: Can be used for future wizard-style interfaces or multi-step workflows.

### Onboarding (Alternative Implementation)

**Location**: `components/Onboarding.tsx`

**Purpose**: React component for onboarding messages

**Status**: Not currently used in production. Current implementation uses `console.log` in `index.tsx` for onboarding.

**Features**:
- Structured onboarding UI as React components
- Visual formatting with Ink components

**Use Case**: Can be migrated to for more interactive onboarding experiences.

---

## Development

### Running Locally

```bash
# Development mode with hot reload
npm run dev

# Build
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint

# Formatting
npm run format
```

### Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# CI mode
npm run test:ci
```

### File Organization Best Practices

- **Components**: Reusable, generic UI elements without business logic
- **Views**: Feature-specific components with business logic
- **Panels**: Full-screen views
- **Sections**: Dashboard sub-components
- **Modals**: Overlay components
- **Hooks**: Reusable stateful logic
- **Stores**: Data layer abstractions
- **Utils**: Pure functions and helpers

### Unused Components

The following components exist in the codebase but are not currently used in the main application:

1. **StatusBar** (`components/StatusBar.tsx`):
   - More feature-rich alternative to BottomStatusBar
   - Includes system messages, live updates, progress tracking
   - Can be swapped in for enhanced status information

2. **AppLayout** (`views/layouts/AppLayout.tsx`):
   - Generic layout wrapper for future use
   - Supports title, subtitle, instructions sections
   - Reserved for wizard-style or multi-step interfaces

3. **Onboarding** (`components/Onboarding.tsx`):
   - React-based onboarding components
   - Current implementation uses `console.log` in `index.tsx`
   - Can be migrated to for interactive onboarding

These components are maintained in the codebase as:
- Reference implementations
- Future feature options
- Alternative approaches for specific use cases

### Adding a New Section

1. Create file in `views/sections/`
2. Import in `DashboardPanel.tsx`
3. Add to layout (consider responsive behavior)
4. Add maximization support if needed (add to `maximizedSection` type)
5. Add keyboard shortcut in `index.tsx`
6. Update `BottomStatusBar` to show the new shortcut

### Adding a New Panel

1. Create file in `views/panels/`
2. Import in `index.tsx`
3. Add to `PanelType` union type
4. Add routing logic in main component
5. Update `TopBar` if needed
6. Update keyboard shortcuts

### Error Handling Strategy

1. **Data Loading**: Try/catch in store with error state
2. **Component Errors**: ErrorBoundary wrapper
3. **User Input**: Validation in keyboard handlers
4. **File Watching**: Silent failure with graceful degradation
5. **Network/API**: Error classification with recovery actions

### Performance Considerations

- **Debounced File Watching**: Prevents excessive reloads (500ms)
- **Memoization**: Consider React.memo for expensive components
- **Virtual Scrolling**: Future optimization for large task lists (1000+ tasks)
- **Efficient Flattening**: Task flattening happens once per render at root level
- **Responsive Recalculation**: Only recalculates layout on terminal resize

---

## Integration with CLI

The terminal UI is integrated into the Task Master CLI via the `InteractiveCommand` class:

**File**: `apps/cli/src/commands/interactive.command.ts`

**Registration**:
```typescript
import { InteractiveCommand } from './commands/interactive.command.js';
InteractiveCommand.register(program);
```

**Command Definition**:
- **Name**: `interactive`
- **Alias**: `tui`
- **Description**: "Launch the interactive terminal UI"
- **Options**:
  - `--panel <panel>`: Initial panel ('dashboard', 'help')
  - `--section <section>`: Initial section to focus
  - `-p, --project <path>`: Project root directory

**Validation**:
- Panel name must be 'dashboard' or 'help'
- Section requires panel to be specified
- Project path defaults to `process.cwd()`

---

## Future Enhancements

### Planned Features
- **Virtual Scrolling**: For projects with 1000+ tasks
- **Search/Filter**: Real-time task filtering
- **Markdown Rendering**: Rich task descriptions using marked/marked-terminal
- **Keyboard Shortcuts Config**: User-customizable keybindings
- **Theme Support**: Custom color schemes
- **Task Actions**: Status updates, quick edits from UI
- **Multiple Tags Support**: Switch between task tags
- **Split View**: Multiple sections side-by-side
- **Task History**: Timeline of task changes

### Performance Optimizations
- Virtualized task list rendering
- Memoized section calculations
- Debounced search input
- Lazy loading of complexity reports
- Streaming task updates

### UX Improvements
- Breadcrumb navigation
- Contextual help tooltips
- Visual indicators for file changes
- Smooth animations/transitions
- Progress indicators for long operations

---

## Troubleshooting

### Terminal UI Won't Launch

**Problem**: Error message or immediate exit

**Solutions**:
1. Check project is initialized: `.taskmaster` directory exists
2. Verify tasks.json is valid JSON
3. Check terminal size is adequate (minimum 40x15)
4. Review error logs in console output

### Tasks Not Updating

**Problem**: Changes to tasks.json not reflected in UI

**Solutions**:
1. Check file watcher is running (should be automatic)
2. Verify file changes are being saved
3. Check debounce delay hasn't been modified
4. Try exiting and relaunching UI

### Layout Issues

**Problem**: Text overlap or misalignment

**Solutions**:
1. Resize terminal (minimum 80x24 recommended)
2. Check terminal font supports Unicode characters
3. Verify TERM environment variable is set correctly
4. Try different terminal emulator

### Performance Issues

**Problem**: Slow rendering or input lag

**Solutions**:
1. Check task count (>1000 tasks may cause lag)
2. Reduce debounce delay in watcher config
3. Disable complexity report if not needed
4. Consider upgrading Node.js version

---

## Summary

The Task Master Terminal UI provides a powerful, real-time interface for task management with:

- **React/Ink Architecture**: Component-based terminal UI with familiar patterns
- **Real-Time Updates**: File watcher automatically reloads tasks on change
- **Multi-Panel Interface**: Dashboard (Project/Dependencies/Tasks) and Help panels
- **Responsive Layout**: Adapts to terminal size with section maximization
- **Keyboard-Driven**: Efficient navigation without mouse
- **Error Resilience**: Error boundaries with recovery suggestions
- **Onboarding Flow**: Guides users through initialization
- **Extensible Design**: Clean architecture for adding features

For questions or contributions, refer to the main Task Master documentation.
