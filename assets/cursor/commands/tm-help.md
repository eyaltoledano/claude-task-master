Show help for Task Master commands.


Display help for Task Master commands. If arguments provided, show specific command help.

## Task Master Command Help

### Quick Navigation

Type `tm/` and use tab completion to explore all commands.

### Command Categories

#### 🚀 Setup & Installation
- `tm/setup/install` - Comprehensive installation guide
- `tm/setup/quick-install` - One-line global install

#### 📋 Project Setup
- `tm/init` - Initialize new project
- `tm/init/quick` - Quick setup with auto-confirm
- `tm/models` - View AI configuration
- `tm/models/setup` - Configure AI providers

#### 🎯 Task Generation
- `tm/parse-prd` - Generate tasks from PRD
- `tm/parse-prd/with-research` - Enhanced parsing
- `tm/generate` - Create task files

#### 📝 Task Management
- `tm/list` - List tasks (natural language filters)
- `tm/show <id>` - Display task details
- `tm/add-task` - Create new task
- `tm/update` - Update tasks naturally
- `tm/next` - Get next task recommendation

#### 🔄 Status Management
- `tm/set-status/to-pending <id>`
- `tm/set-status/to-in-progress <id>`
- `tm/set-status/to-done <id>`
- `tm/set-status/to-review <id>`
- `tm/set-status/to-deferred <id>`
- `tm/set-status/to-cancelled <id>`

#### 🔍 Analysis & Breakdown
- `tm/analyze-complexity` - Analyze task complexity
- `tm/expand <id>` - Break down complex task
- `tm/expand/all` - Expand all eligible tasks

#### 🔗 Dependencies
- `tm/add-dependency` - Add task dependency
- `tm/remove-dependency` - Remove dependency
- `tm/validate-dependencies` - Check for issues

#### 🤖 Workflows
- `tm/workflows/smart-flow` - Intelligent workflows
- `tm/workflows/pipeline` - Command chaining
- `tm/workflows/auto-implement` - Auto-implementation

#### 📊 Utilities
- `tm/utils/analyze` - Project analysis
- `tm/status` - Project dashboard
- `tm/learn` - Interactive learning

### Natural Language Examples

```
tm/list pending high priority
tm/update mark all API tasks as done
tm/add-task create login system with OAuth
tm/show current
```

### Getting Started

1. Install: `tm/setup/quick-install`
2. Initialize: `tm/init/quick`
3. Learn: `tm/learn start`
4. Work: `tm/workflows/smart-flow`

For detailed command info: `tm/help <command-name>`