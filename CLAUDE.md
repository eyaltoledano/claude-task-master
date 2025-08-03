# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Task Master AI Development Guide

Task Master is an AI-driven task management system designed for seamless integration with Claude Code, Cursor AI, and other AI coding assistants. It uses AI to break down Product Requirements Documents (PRDs) into manageable tasks, tracks progress, and provides intelligent task expansion and updates.

## Development Commands

### Build & Development
```bash
# Install dependencies
npm install

# Run tests
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage report
npm run test:fails         # Run only failed tests
npm run test:e2e           # End-to-end tests

# Code quality
npm run format             # Format code with Biome
npm run format-check       # Check formatting

# MCP Server development
npm run inspector          # Run MCP inspector
npm run mcp-server        # Run MCP server directly
```

### Task Master CLI Commands
```bash
# Project initialization
task-master init                                    # Initialize in current directory
task-master parse-prd <file>                       # Generate tasks from PRD
task-master models --setup                         # Configure AI models

# Daily workflow
task-master list                                   # Show all tasks
task-master next                                   # Get next available task
task-master show <id>                             # View task details
task-master set-status --id=<id> --status=done   # Update task status

# Task management
task-master add-task --prompt="desc" --research   # Add AI-generated task
task-master expand --id=<id> --research          # Expand task to subtasks
task-master update-task --id=<id> --prompt="..."  # Update single task
task-master update --from=<id> --prompt="..."     # Update multiple tasks
```

## High-Level Architecture

### Core Components

1. **CLI Entry Points**
   - `bin/task-master.js` - Global CLI entry point
   - `scripts/dev.js` - Development command handler
   - `scripts/init.js` - Project initialization logic

2. **MCP Server** (`mcp-server/`)
   - FastMCP-based server for editor integration
   - Direct function implementations in `src/core/direct-functions/`
   - Tool definitions in `src/tools/`
   - Custom SDK for Claude Code integration

3. **AI Providers** (`src/ai-providers/`)
   - Unified interface for multiple AI providers
   - Supports: Anthropic, OpenAI, Google, Perplexity, xAI, etc.
   - Special Claude Code provider for API-key-free usage

4. **Task Management** (`scripts/modules/task-manager/`)
   - Task CRUD operations
   - Dependency management
   - Tag-based organization
   - Complexity analysis

5. **Profile System** (`src/profiles/`)
   - Editor-specific configurations (Cursor, Windsurf, VS Code, etc.)
   - Rule transformations for different environments
   - MCP configuration generation

### Key Architectural Patterns

- **Modular Command System**: Commands are implemented as separate modules in `scripts/modules/`
- **Provider Abstraction**: All AI providers implement a common interface via `base-provider.js`
- **Tag Isolation**: Tasks can be organized by tags, each tag maintains its own task namespace
- **Direct Function Pattern**: MCP tools call direct functions for better testability
- **Progressive Enhancement**: Works as CLI, MCP server, or imported module

## Testing Strategy

### Unit Tests
- Provider implementations: `tests/unit/ai-providers/`
- Task management logic: `tests/unit/task-manager/`
- Profile integrations: `tests/unit/profiles/`

### Integration Tests
- CLI command testing: `tests/integration/cli/`
- MCP server functionality: `tests/integration/mcp-server/`
- Profile initialization: `tests/integration/profiles/`

### Running Tests
```bash
# Run specific test suites
npm test -- tests/unit/ai-providers
npm test -- tests/integration/mcp-server

# Debug failing tests
npm run test:fails
DEBUG=1 npm test -- --verbose
```

## Working with MCP

The MCP server provides direct access to Task Master functionality within editors:

```javascript
// Available MCP tools (prefix: mcp__task-master-ai__)
initialize_project      // Initialize Task Master
parse_prd              // Parse PRD to tasks
get_tasks              // List all tasks
get_task               // Get specific task
set_task_status        // Update task status
expand_task            // Expand to subtasks
update_task            // Update task details
analyze_project_complexity  // Analyze complexity
```

## Development Tips

1. **Environment Variables**: Set in `.env` or MCP config
   - At least one AI provider API key required
   - `DEBUG=1` for verbose output
   - `NODE_ENV=test` for testing

2. **File Conventions**:
   - Never manually edit `tasks.json` - use CLI/MCP commands
   - Task files in `.taskmaster/tasks/` are auto-generated
   - PRDs go in `.taskmaster/docs/`

3. **Code Style**:
   - Uses Biome for formatting (tabs, single quotes)
   - ESM modules throughout
   - Async/await preferred over callbacks

4. **Error Handling**:
   - AI operations may take up to 60 seconds
   - Graceful fallbacks for API failures
   - Detailed error messages with recovery suggestions

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md

The `.taskmaster/CLAUDE.md` file contains comprehensive Task Master usage instructions. Key workflows:

1. **Project Setup**: Initialize → Create PRD → Parse → Analyze complexity → Expand tasks
2. **Development Loop**: Get next task → Implement → Update progress → Mark complete
3. **Complex Features**: Create feature PRD → Parse with `--append` → Expand new tasks

## Debugging & Troubleshooting

```bash
# Debug mode
DEBUG=1 task-master list

# Check MCP connection
npm run inspector

# Verify API keys
task-master models

# Fix task dependencies
task-master validate-dependencies
task-master fix-dependencies
```

## Contributing

When modifying Task Master:

1. Follow existing patterns in similar files
2. Add tests for new functionality
3. Update command help text
4. Test with multiple AI providers
5. Verify MCP tool definitions match CLI functionality

### Important Files for Contributors

- `src/prompts/` - AI prompt templates
- `scripts/modules/commands.js` - CLI command registration
- `mcp-server/src/tools/` - MCP tool definitions
- `tests/` - Test suite organization
- `docs/` - User documentation

## Development Principles & Best Practices

- Always follow TDD methodology when developing features or addressing bugs/issues
- Always commit changes AFTER marking a task as done
- Always commit any pending changes before starting a task
- Use git emoji in git commit messages

## Kanban UI Development

### Running the Kanban UI

```bash
# Start the Kanban board UI server
task-master ui

# Custom port
task-master ui --port 4000

# Without auto-opening browser
task-master ui --no-browser
```

### Frontend Structure

The Kanban UI is built with pure HTML/CSS/JavaScript (no build process):

```
src/ui/
├── server/
│   ├── index.js          # Express server
│   ├── routes/
│   │   └── api.js        # REST API endpoints
│   └── services/
│       └── taskSync.js   # Task synchronization
└── client/
    ├── index.html        # Main HTML (5-column Kanban board)
    ├── css/
    │   ├── main.css      # Base styles and layout
    │   └── kanban.css    # Kanban-specific styles
    └── js/
        ├── kanban.js     # Core Kanban logic
        ├── api.js        # API communication
        └── components/
            ├── taskCard.js   # Task card component
            └── column.js     # Column management

```

### API Endpoints

- `GET /api/tasks` - Retrieve all tasks with filtering
- `GET /api/tasks/:id` - Get specific task
- `PATCH /api/tasks/:id/status` - Update task status
- `POST /api/commands/:command` - Execute safe CLI commands

### Features

- **5 Columns**: Backlog, Ready, In Progress, Review, Done
- **Drag & Drop**: HTML5 drag/drop with keyboard alternatives
- **Responsive**: Desktop (5 cols), Tablet (3 cols), Mobile (1 col)
- **Accessibility**: Full WCAG 2.1 AA compliance
- **Dark Mode**: System preference detection + manual toggle
- **Priority Colors**: High (red), Medium (yellow), Low (green)
- **Real-time Updates**: 30-second polling + immediate UI updates