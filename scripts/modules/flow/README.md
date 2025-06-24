# Task Master Flow - Interactive TUI

Task Master Flow is an interactive Terminal User Interface (TUI) for managing tasks, inspired by [OpenCode](https://github.com/sst/opencode)'s elegant interface design but tailored specifically for Task Master's workflow needs.

## Features

- **OpenCode-style Interface**: Clean welcome screen with ASCII art and slash commands
- **Slash Command Navigation**: Use `/` commands to navigate between screens
- **Multiple Views**: Tasks, Sessions, Help screens, plus setup launchers
- **Keyboard Shortcuts**: Intuitive navigation with arrow keys and hotkeys
- **Real-time Updates**: See changes immediately as you modify tasks
- **Interactive Configuration**: Launch model and rules setup directly
- **Session Tracking**: View work history and AI usage costs (preview feature)
- **Tag Support**: Full support for Task Master's tagged task lists

## Usage

```bash
# Launch the interactive TUI
task-master flow

# Or use the alias
tm flow
```

## Interface Commands

### Slash Commands (type in the input bar)
- `/help` - Show help screen with all commands
- `/tasks` - View and manage your task list
- `/sessions` - View work session history
- `/new` - Start a new work session
- `/models` - Launch interactive AI model configuration
- `/rules` - Launch interactive AI rules setup
- `/exit` - Exit the application

### Task List Shortcuts
- `↑/↓` - Navigate through tasks
- `n` - Cycle task status (pending → in-progress → done → ...)
- `1-4` - Filter tasks (All/Pending/In Progress/Done)
- `Enter` - View task details (coming soon)
- `e` - Expand task with AI (coming soon)
- `r` - Research task context (coming soon)

### Global Shortcuts
- `ESC` - Return to previous screen or home
- `Ctrl+C` - Exit application

## Screens

### Welcome Screen
The main screen shows the Task Master ASCII logo and available slash commands. Type commands in the input bar at the bottom to navigate.

### Task List (`/tasks`)
View all your tasks with:
- Status indicators (○ pending, ● in-progress, ✓ done)
- Task IDs and titles
- Dependency information
- Quick filtering options

### Sessions (`/sessions`)
Track your work sessions with:
- Date and duration
- Tasks completed count
- AI usage costs
- Session descriptions

### Configuration Launchers

#### Model Configuration (`/models`)
Launches the interactive model setup (`task-master models --setup`) which allows you to:
- Configure primary AI model for task generation
- Set research model for research-backed operations
- Define fallback model if primary fails
- Select from pre-configured models or add custom Ollama/OpenRouter models

#### Rules Configuration (`/rules`)  
Launches the interactive rules setup (`task-master rules setup`) which allows you to:
- Select AI coding assistant profiles (Claude, Cursor, Windsurf, etc.)
- Configure which rule sets to include in your project
- Manage rule profiles after initialization

Note: The Flow interface will temporarily exit to run the interactive setup, then automatically return to the home screen when configuration is complete. A success notification will appear briefly to confirm the configuration was saved.

### Help (`/help`)
Comprehensive help showing all commands, shortcuts, and usage examples.

## Technical Details

### Backend Options
The Flow TUI uses a modular backend system:
- **Direct Backend** (default): Uses MCP server functions directly for best performance
- **CLI Backend**: Executes task-master CLI commands (future)
- **MCP Backend**: Connects to remote MCP servers (future)

### Architecture
```
flow/
├── index.jsx           # Main app component and context
├── backend-interface.js # Abstract backend interface
├── theme.js            # Task Master theme configuration
├── backends/
│   ├── direct-backend.js # Direct function calls
│   └── cli-backend.js    # CLI command execution
├── components/
│   ├── WelcomeScreen.jsx # Main screen with commands
│   ├── TaskListScreen.jsx # Task management view
│   ├── SessionsScreen.jsx # Work history view
│   └── HelpScreen.jsx     # Help documentation
└── cli-wrapper.js      # CLI integration wrapper
```

### Dependencies
- **ink** v5: React for CLIs
- **ink-text-input**: Text input component
- **React**: Component framework
- **tsx**: TypeScript/JSX execution

## Future Enhancements

- Natural language task management
- Real-time AI assistance integration
- Task detail view with expand/research
- Persistent session tracking
- Remote MCP server support
- Theme customization (`/theme` command)

## Development

To run the Flow TUI in development:
```bash
# Direct execution
npx tsx scripts/modules/flow/index.jsx

# Via CLI
node scripts/dev.js flow
```

## Credits

Interface design inspired by [OpenCode](https://github.com/sst/opencode) - an AI coding agent built for the terminal. 