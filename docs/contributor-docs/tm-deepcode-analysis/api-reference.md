# API Reference

## CLI Commands

### Task Management Commands

#### `parse-prd`
Parse a Product Requirements Document and generate tasks.

```bash
task-master parse-prd <file> [options]
```

**Arguments:**
- `file` - Path to the PRD file

**Options:**
- `-i, --input <file>` - Alternative to positional argument
- `-o, --output <file>` - Output file path (default: tasks.json)
- `-n, --num-tasks <number>` - Number of tasks to generate (default: 10)
- `-f, --force` - Skip confirmation when overwriting
- `--append` - Append to existing tasks
- `-r, --research` - Use Perplexity AI for research

---

#### `add-task`
Add a new task using AI or manually.

```bash
task-master add-task [options]
```

**Options:**
- `-p, --prompt <text>` - Task description for AI generation
- `-t, --title <title>` - Manual task title
- `-d, --dependencies <ids>` - Comma-separated dependency IDs
- `--priority <priority>` - Priority level (high/medium/low)

---

#### `update`
Update multiple tasks starting from a specific ID.

```bash
task-master update [options]
```

**Options:**
- `-f, --file <file>` - Tasks file path
- `--from <id>` - Starting task ID (default: 1)
- `-p, --prompt <text>` - Update instructions (required)
- `-r, --research` - Use research mode

---

#### `set-status`
Set the status of one or more tasks.

```bash
task-master set-status [options]
```

**Aliases:** `mark`, `set`

**Options:**
- `-i, --id <id>` - Task ID(s), comma-separated
- `-s, --status <status>` - New status
- `-f, --file <file>` - Tasks file path

**Valid Statuses:**
- `pending` - Not started
- `in-progress` - Currently working
- `done` - Completed
- `review` - Needs review
- `deferred` - Postponed
- `cancelled` - Cancelled

---

#### `list`
List all tasks with optional filtering.

```bash
task-master list [options]
```

**Options:**
- `-f, --file <file>` - Tasks file path
- `-s, --status <status>` - Filter by status
- `--with-subtasks` - Include subtasks
- `-r, --report <report>` - Include complexity scores

---

#### `next`
Show the next task to work on based on dependencies.

```bash
task-master next [options]
```

**Options:**
- `-f, --file <file>` - Tasks file path
- `-r, --report <report>` - Consider complexity scores

---

### Task Analysis Commands

#### `expand`
Expand a task into subtasks using AI.

```bash
task-master expand [options]
```

**Options:**
- `-i, --id <id>` - Task ID to expand
- `-a, --all` - Expand all pending tasks
- `-n, --num <number>` - Number of subtasks
- `-r, --research` - Research-backed generation
- `-p, --prompt <text>` - Additional context
- `-f, --force` - Force expansion
- `--file <file>` - Tasks file path

---

#### `analyze-complexity`
Analyze task complexity and generate recommendations.

```bash
task-master analyze-complexity [options]
```

**Options:**
- `-f, --file <file>` - Tasks file path
- `-o, --output <file>` - Output report file
- `-r, --regenerate` - Force regeneration

---

### Dependency Commands

#### `add-dependency`
Add a dependency between tasks.

```bash
task-master add-dependency [options]
```

**Options:**
- `-i, --id <id>` - Task ID
- `-d, --depends-on <id>` - Dependency task ID
- `-f, --file <file>` - Tasks file path

---

#### `validate-dependencies`
Check all dependencies for issues.

```bash
task-master validate-dependencies [options]
```

**Options:**
- `-f, --file <file>` - Tasks file path

---

### Project Commands

#### `init`
Initialize a new Task Master project.

```bash
task-master init [options]
```

**Options:**
- `-y, --yes` - Skip prompts
- `-n, --name <name>` - Project name
- `-d, --description <desc>` - Project description
- `-v, --version <version>` - Version (default: 0.1.0)
- `-a, --author <author>` - Author name
- `--skip-install` - Skip npm install
- `--dry-run` - Preview changes
- `--aliases` - Add shell aliases

---

#### `models`
Manage AI model configuration.

```bash
task-master models [options]
```

**Options:**
- `-l, --list` - List available models
- `-s, --status` - Show current config
- `--set <model>` - Set model (provider/model-id:role)
- `--setup` - Interactive setup
- `-r, --research` - Include research models

---

## MCP Tools

### Task Query Tools

#### `get_tasks`
Retrieve and filter tasks.

**Parameters:**
```typescript
{
  projectRoot?: string
  includeSubtasks?: boolean
  status?: 'pending' | 'in-progress' | 'done' | 'review' | 'deferred' | 'cancelled'
}
```

**Returns:**
```typescript
{
  success: boolean
  tasks?: Task[]
  totalTasks?: number
  tasksByStatus?: Record<string, number>
  error?: string
}
```

---

#### `get_task`
Get a specific task by ID.

**Parameters:**
```typescript
{
  projectRoot?: string
  taskId: string | number
}
```

**Returns:**
```typescript
{
  success: boolean
  task?: Task
  error?: string
}
```

---

### Task Modification Tools

#### `add_task`
Create a new task.

**Parameters:**
```typescript
{
  projectRoot?: string
  prompt?: string
  title?: string
  description?: string
  details?: string
  dependencies?: string
  priority?: 'high' | 'medium' | 'low'
}
```

---

#### `update_task`
Update an existing task.

**Parameters:**
```typescript
{
  projectRoot?: string
  taskId: string | number
  prompt: string
  useResearch?: boolean
}
```

---

#### `set_task_status`
Change task status.

**Parameters:**
```typescript
{
  projectRoot?: string
  taskId: string
  status: 'pending' | 'in-progress' | 'done' | 'review' | 'deferred' | 'cancelled'
}
```

---

### Analysis Tools

#### `analyze_project_complexity`
Analyze all tasks for complexity.

**Parameters:**
```typescript
{
  projectRoot?: string
  regenerate?: boolean
  threshold?: number
}
```

**Returns:**
```typescript
{
  success: boolean
  report?: {
    summary: ComplexitySummary
    recommendations: string[]
    tasks: TaskComplexityScore[]
  }
  error?: string
}
```

---

## Programmatic API

### Installation
```javascript
import { initProject, runCLI, version } from 'task-master-ai';
```

### Functions

#### `initProject(options)`
Initialize a new project programmatically.

**Parameters:**
```javascript
{
  name: string
  description?: string
  version?: string
  author?: string
  skipInstall?: boolean
  dryRun?: boolean
}
```

**Returns:** `Promise<void>`

---

#### `runCLI(args)`
Execute CLI commands programmatically.

**Parameters:**
- `args` - Array of command arguments

**Example:**
```javascript
await runCLI(['list', '--status', 'pending']);
```

---

## Data Structures

### Task Object
```typescript
interface Task {
  id: number
  title: string
  description: string
  details?: string
  testStrategy?: string
  status: TaskStatus
  dependencies: number[]
  priority: 'high' | 'medium' | 'low'
  subtasks: Subtask[]
}
```

### Subtask Object
```typescript
interface Subtask extends Omit<Task, 'subtasks'> {
  parentTaskId: number
}
```

### Configuration Object
```typescript
interface TaskMasterConfig {
  version: string
  models: {
    main: ModelConfig
    research: ModelConfig
    fallback: ModelConfig
  }
  providers?: Record<string, ProviderConfig>
}

interface ModelConfig {
  provider: string
  model: string
  temperature?: number
  maxTokens?: number
}
```

## Environment Variables

### Required
- `ANTHROPIC_API_KEY` - Anthropic API key (or at least one provider key)

### Optional Provider Keys
- `OPENAI_API_KEY` - OpenAI API key
- `PERPLEXITY_API_KEY` - Perplexity API key
- `GOOGLE_API_KEY` - Google API key
- `MISTRAL_API_KEY` - Mistral API key
- `XAI_API_KEY` - xAI API key
- `AZURE_OPENAI_API_KEY` - Azure OpenAI key
- `OLLAMA_API_KEY` - Ollama API key (for remote servers)

### Configuration
- `TASK_MASTER_PROJECT_ROOT` - Override project root detection
- `DEBUG` - Enable debug logging (set to 1)

## File Formats

### tasks.json
```json
{
  "meta": {
    "projectName": "string",
    "projectVersion": "string",
    "createdAt": "ISO 8601 date",
    "updatedAt": "ISO 8601 date"
  },
  "tasks": [
    {
      "id": 1,
      "title": "Task title",
      "description": "Task description",
      "status": "pending",
      "dependencies": [],
      "priority": "medium",
      "subtasks": []
    }
  ]
}
```

### .taskmaster/config.json
```json
{
  "version": "1.0.0",
  "models": {
    "main": {
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-latest",
      "temperature": 0.7,
      "maxTokens": 4000
    },
    "research": {
      "provider": "perplexity",
      "model": "llama-3.1-sonar-small-128k-online",
      "temperature": 0.5,
      "maxTokens": 2000
    },
    "fallback": {
      "provider": "anthropic",
      "model": "claude-3-5-haiku-latest",
      "temperature": 0.7,
      "maxTokens": 2000
    }
  }
}
```

### task-*.md Format
```markdown
## Task {id}: {title}

**Status:** {status}
**Priority:** {priority}
**Dependencies:** {dependencies}

### Description
{description}

### Details
{details}

### Test Strategy
{testStrategy}

### Subtasks
- [ ] {subtask.title} - {subtask.description}
```

## Error Codes

### CLI Errors
- **ENOENT** - File not found
- **EEXIST** - File already exists
- **EINVAL** - Invalid input/arguments
- **EAUTH** - Authentication/API key error
- **ENET** - Network/API call error

### MCP Errors
All MCP errors follow this format:
```json
{
  "success": false,
  "error": "Error message",
  "version": "0.16.2"
}
```

## Best Practices

### Task Organization
1. Keep task titles concise (< 80 chars)
2. Use clear, actionable descriptions
3. Break complex tasks into subtasks
4. Set realistic dependencies
5. Use priority levels consistently

### AI Integration
1. Use research mode for technical tasks
2. Provide context in prompts
3. Review AI-generated content
4. Set appropriate temperature values
5. Monitor token usage and costs

### Project Structure
1. Initialize with `task-master init`
2. Keep tasks.json in version control
3. Use .taskmaster/ for local config
4. Generate task files for AI agents
5. Regular dependency validation