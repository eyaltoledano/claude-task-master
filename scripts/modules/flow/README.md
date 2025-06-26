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
- **Tag Support**: Full support for tagged task lists system
- **Multiple Backends**: Choose between direct, CLI, or MCP backends

## Usage

```bash
# Launch with default (direct) backend
task-master flow

# Launch with specific backend
task-master flow --backend direct    # Direct function calls (fastest)
task-master flow --backend cli       # Execute CLI commands (compatible)
task-master flow --backend mcp       # Connect to MCP servers (remote)

# Launch with MCP backend and specific server
task-master flow --backend mcp --mcp-server myserver
```

## Backend Options

Task Master Flow supports three backend implementations:

### 1. Direct Backend (Default)
The **direct** backend calls Task Master functions directly through the MCP server's internal APIs. This provides:
- **Best Performance**: No process spawning overhead
- **Real-time Updates**: Immediate feedback
- **Full Feature Support**: All Task Master features available
- **Recommended**: For local development

```bash
task-master flow --backend direct
```

### 2. CLI Backend
The **cli** backend executes task-master commands as child processes. This provides:
- **Compatibility**: Works with custom CLI configurations
- **Process Isolation**: Each command runs in its own process
- **Standard Output**: Uses the same output as CLI commands
- **Use When**: You have custom CLI modifications or need process isolation

```bash
task-master flow --backend cli
```

### 3. MCP Backend
The **mcp** backend connects to remote MCP servers. This provides:
- **Remote Management**: Control Task Master on other machines
- **Server Flexibility**: Connect to any MCP-compatible server
- **Multiple Projects**: Switch between different project servers
- **Use When**: Managing remote projects or using custom MCP servers

```bash
# Use default MCP server
task-master flow --backend mcp

# Use specific MCP server by ID
task-master flow --backend mcp --mcp-server production

# Configure servers through the Flow UI
task-master flow
# Then use /mcp command to manage servers
```

#### Configuring MCP Servers

1. **Through Flow UI**:
   - Launch Flow: `task-master flow`
   - Type `/mcp` to open server management
   - Press 'A' to add a new server
   - Fill in server details (name, script path, etc.)
   - Press Space to activate the server
   - Press 'U' to use it as the backend

2. **Server Configuration File**:
   Servers are stored in `scripts/modules/flow/mcp/servers.json`:
   ```json
   [
     {
       "id": "local",
       "name": "Local Task Master",
       "scriptPath": "./mcp-server/server.js",
       "description": "Built-in Task Master MCP server",
       "scriptType": "node",
       "default": true
     },
     {
       "id": "production",
       "name": "Production Server",
       "scriptPath": "/path/to/remote/server.js",
       "scriptType": "node",
       "env": {
         "API_KEY": "your-api-key"
       }
     }
   ]
   ```

3. **Default Server**:
   - The first server marked with `"default": true` is used when no server ID is specified
   - If no default is set, the first server in the list is used

## Slash Commands

Type `/` followed by a command to navigate:

- `/tasks` - View and manage tasks
- `/session` - View session history and AI usage
- `/models` - Configure AI models
- `/rules` - Configure rule profiles
- `/mcp` - Manage MCP servers
- `/help` - Show help and keyboard shortcuts
- `/quit` - Exit the application

## Keyboard Shortcuts

### Global
- `Ctrl+X` - Show shortcuts menu
- `Ctrl+C` or `Ctrl+Q` - Quit application
- `Esc` - Go back / Cancel
- `/` - Enter command mode

### Task View
- `↑↓` - Navigate tasks
- `Enter` - View task details
- `Space` - Toggle task status
- `E` - Expand task into subtasks
- `N` - Show next task to work on
- `F` - Filter by status
- `R` - Refresh task list

### Task Details
- `↑↓` - Navigate subtasks
- `Space` - Toggle subtask status
- `Esc` - Back to task list

### MCP Server Management
- `↑↓` - Navigate servers
- `Enter` - View server details
- `Space` - Toggle server connection
- `A` - Add new server
- `E` - Edit server
- `R` - Remove server
- `U` - Use server as backend

## Session Tracking (Preview)

The session view (`/session`) provides:
- Work history with timestamps
- AI model usage and costs
- Task completion metrics
- Session duration tracking

**Note**: This is a preview feature for development insights.

## Architecture

Flow uses a layered architecture:

1. **UI Layer** (`index.jsx`) - React + Ink components
2. **Backend Interface** (`backend-interface.js`) - Abstract backend API
3. **Backend Implementations**:
   - `direct-backend.js` - Direct function calls
   - `cli-backend.js` - CLI command execution
   - `mcp-client-backend.js` - MCP server communication
4. **Components** - Reusable UI components
5. **Theme** - Consistent styling system

## Development

### Adding New Features

1. Add new slash command in `CommandPalette.jsx`
2. Create new screen component in `components/`
3. Add navigation logic in main `App` component
4. Update help screen with new commands

### Backend Development

To add support for new Task Master commands:

1. Add method to `FlowBackend` interface
2. Implement in all three backends
3. Use in UI components

### Testing Backends

```bash
# Test all backends
node test-flow-backends.js

# Visual test (interactive)
node test-flow-visual.js
```

## Troubleshooting

### "Cannot find module" Errors
- Ensure you're in the project root directory
- Run `npm install` to install dependencies
- Check that `tsx` is installed globally or locally

### Terminal Issues
- Flow requires an interactive terminal (TTY)
- Won't work in non-interactive environments
- Use `--backend cli` if direct backend has issues

### MCP Connection Issues
- Verify server script path is correct
- Check server logs for errors
- Ensure required environment variables are set
- Try connecting through the UI first to test

## Future Enhancements

- Real-time collaboration features
- Task templates and automation
- Advanced filtering and search
- Customizable themes
- Plugin system for extensions

## Technical Details

### Backend Architecture
```
flow/
├── index.jsx           # Main app component and context
├── backend-interface.js # Abstract backend interface
├── theme.js            # Task Master theme configuration
├── backends/
│   ├── direct-backend.js # Direct function calls (default)
│   ├── cli-backend.js    # CLI command execution
│   └── mcp-client-backend.js # MCP server connections
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

## Credits

Interface design inspired by [OpenCode](https://github.com/sst/opencode) - an AI coding agent built for the terminal. 