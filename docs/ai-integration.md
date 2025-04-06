# AI Integration in Task Master

Task Master supports two methods of AI integration:

## 1. File-Based Integration (.roo directory)

Traditional file-based integration uses the `.roo` directory with:
- **Roles**: `.roo/roles/*.md` - Expertise areas for different parts of the codebase
- **Boomerangs**: `.roo/boomerangs/*.md` - Templates for implementing specific functionality

This approach works with any AI assistant that can read files from the filesystem, including Claude, GPT, and others.

### Using File-Based Integration

1. Initialize your project with file-based integration:
   ```bash
   task-master init
   # When prompted, select "Traditional files" for MCP integration
   ```

2. The initialization process will create the `.roo` directory with roles and boomerangs.

3. When working with an AI assistant, point it to the `.roo` directory for guidance:
   ```
   Please refer to the roles in .roo/roles/ for guidance on the architecture of this project.
   ```

## 2. MCP-Based Integration

Modern MCP-based integration uses the Model Context Protocol to provide:
- **Resources**: Accessible via URIs like `role://architecture` or `boomerang://expand-task`
- **Resource Templates**: Parameterized resources like `role://architecture/my-project`
- **Tools**: Task management operations via standardized MCP tools

This approach works with AI assistants that support the MCP protocol, such as Claude.

### Using MCP-Based Integration

1. Initialize your project with MCP integration:
   ```bash
   task-master init
   # When prompted, select "Use MCP" or "Both" for MCP integration
   ```

2. Start the MCP server:
   ```bash
   npm run start-mcp
   ```

3. Connect your AI assistant to the MCP server:
   - In Claude: Use the MCP server connection feature
   - In other MCP-compatible assistants: Follow their instructions for connecting to an MCP server

4. Access resources using MCP URIs:
   ```
   Please read the role://architecture resource for guidance on the architecture of this project.
   ```

## 3. Using Both Approaches (Recommended)

For maximum compatibility, you can use both approaches:

1. Initialize your project with both integrations:
   ```bash
   task-master init
   # When prompted, select "Both" for MCP integration
   ```

2. For AI assistants that support MCP, start the MCP server and connect to it.

3. For AI assistants that don't support MCP, point them to the `.roo` directory.

## Available Resources

### Roles

The following roles are available for guidance on different aspects of the codebase:

- **Architecture Expert** - `role://architecture` or `.roo/roles/architecture.md`
  - High-level architecture of the Task Master CLI application
  - Module structure and responsibilities

- **CLI Commands Expert** - `role://commands` or `.roo/roles/commands.md`
  - Implementation of CLI commands using Commander.js
  - Command naming conventions and structure

- **Testing Expert** - `role://testing` or `.roo/roles/testing.md`
  - Testing guidelines and best practices
  - Test organization and structure

### Boomerangs

The following boomerangs are available for implementing specific functionality:

- **Expand Task Boomerang** - `boomerang://expandTask` or `.roo/boomerangs/expandTask.md`
  - Template for implementing task expansion functionality

- **Add Task Boomerang** - `boomerang://addTask` or `.roo/boomerangs/addTask.md`
  - Template for implementing task creation functionality

## Resource Templates

MCP integration provides parameterized resource templates:

- `role://{roleId}/{projectName}` - Access a role with a custom project name
- `boomerang://{boomerangId}/{projectName}` - Access a boomerang with a custom project name

## Index Resources

MCP integration provides index resources that list all available resources:

- `role://index` - List all available roles
- `boomerang://index` - List all available boomerangs

## MCP Tools

MCP integration provides tools for task management:

- `listTasks` - List all tasks
- `showTask` - Show details of a specific task
- `setTaskStatus` - Set the status of a task
- `expandTask` - Expand a task into subtasks
- `nextTask` - Show the next task to work on
- `addTask` - Add a new task
- `getWebInterfaceUrl` - Get the URL of the web interface

## Configuration

The MCP server configuration is stored in `mcp-config.json` in your project root. You can modify this file to change the MCP server settings:

```json
{
  "projectName": "Your Project Name",
  "enableRooResources": true
}
```

- `projectName`: The name of your project, used in resource variables
- `enableRooResources`: Whether to enable Roo resources in the MCP server