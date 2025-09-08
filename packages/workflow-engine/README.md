# @tm/workflow-engine

Enhanced Task Master workflow execution engine with git worktree isolation and Claude Code process management.

## Overview

The Workflow Engine extends Task Master with advanced execution capabilities:

- **Git Worktree Isolation**: Each task runs in its own isolated worktree
- **Process Sandboxing**: Spawns dedicated Claude Code processes for task execution  
- **Real-time Monitoring**: Track workflow progress and process output
- **State Management**: Persistent workflow state across sessions
- **Parallel Execution**: Run multiple tasks concurrently with resource limits

## Architecture

```
TaskExecutionManager
├── WorktreeManager      # Git worktree lifecycle
├── ProcessSandbox       # Claude Code process management
└── WorkflowStateManager # Persistent state tracking
```

## Quick Start

```typescript
import { TaskExecutionManager } from '@tm/workflow-engine';

const manager = new TaskExecutionManager({
  projectRoot: '/path/to/project',
  worktreeBase: '/path/to/worktrees',
  claudeExecutable: 'claude',
  maxConcurrent: 3,
  defaultTimeout: 60,
  debug: true
});

await manager.initialize();

// Start task execution
const workflowId = await manager.startTaskExecution({
  id: '1.2',
  title: 'Implement authentication',
  description: 'Add JWT-based auth system',
  status: 'pending',
  priority: 'high'
});

// Monitor workflow
const workflow = manager.getWorkflowStatus(workflowId);
console.log(`Status: ${workflow.status}`);

// Stop when complete
await manager.stopTaskExecution(workflowId);
```

## CLI Integration

```bash
# Start workflow
tm workflow start 1.2

# List active workflows  
tm workflow list

# Check status
tm workflow status workflow-1.2-1234567890-abc123

# Stop workflow
tm workflow stop workflow-1.2-1234567890-abc123
```

## VS Code Extension

The workflow engine integrates with the Task Master VS Code extension to provide:

- **Workflow Tree View**: Visual workflow management
- **Process Monitoring**: Real-time output streaming
- **Worktree Navigation**: Quick access to isolated workspaces
- **Status Indicators**: Visual workflow state tracking

## Core Components

### TaskExecutionManager

Orchestrates complete workflow lifecycle:

```typescript
// Event-driven workflow management
manager.on('workflow.started', (event) => {
  console.log(`Started: ${event.workflowId}`);
});

manager.on('process.output', (event) => {
  console.log(`[${event.data.stream}]: ${event.data.data}`);
});
```

### WorktreeManager

Manages git worktree operations:

```typescript
import { WorktreeManager } from '@tm/workflow-engine';

const manager = new WorktreeManager({
  worktreeBase: './worktrees',
  projectRoot: process.cwd(),
  autoCleanup: true
});

// Create isolated workspace
const worktree = await manager.createWorktree('task-1.2');
console.log(`Created: ${worktree.path}`);

// List all worktrees
const worktrees = await manager.listWorktrees();

// Cleanup
await manager.removeWorktree('task-1.2');
```

### ProcessSandbox  

Spawns and manages Claude Code processes:

```typescript
import { ProcessSandbox } from '@tm/workflow-engine';

const sandbox = new ProcessSandbox({
  claudeExecutable: 'claude',
  defaultTimeout: 30,
  debug: true
});

// Start isolated process
const process = await sandbox.startProcess(
  'workflow-123',
  'task-1.2', 
  'Implement user authentication with JWT tokens',
  { cwd: '/path/to/worktree' }
);

// Send input
await sandbox.sendInput('workflow-123', 'npm test');

// Monitor output
sandbox.on('process.output', (event) => {
  console.log(event.data.data);
});
```

### WorkflowStateManager

Persistent workflow state management:

```typescript
import { WorkflowStateManager } from '@tm/workflow-engine';

const stateManager = new WorkflowStateManager({
  projectRoot: process.cwd()
});

await stateManager.loadState();

// Register workflow
const workflowId = await stateManager.registerWorkflow({
  taskId: '1.2',
  taskTitle: 'Authentication',
  // ... other context
});

// Update status
await stateManager.updateWorkflowStatus(workflowId, 'running');

// Query workflows
const running = stateManager.listWorkflowsByStatus('running');
```

## Configuration

### Environment Variables

- `TASKMASTER_WORKFLOW_DEBUG`: Enable debug logging
- `TASKMASTER_CLAUDE_PATH`: Custom Claude Code executable path
- `TASKMASTER_WORKTREE_BASE`: Base directory for worktrees
- `TASKMASTER_MAX_CONCURRENT`: Maximum concurrent workflows

### Config Object

```typescript
interface TaskExecutionManagerConfig {
  projectRoot: string;           // Project root directory
  worktreeBase: string;         // Worktree base path  
  claudeExecutable: string;     // Claude executable
  maxConcurrent: number;        // Concurrent limit
  defaultTimeout: number;       // Timeout (minutes)
  debug: boolean;              // Debug logging
}
```

## Workflow States

| State | Description |
|-------|-------------|
| `pending` | Created but not started |
| `initializing` | Setting up worktree/process |
| `running` | Active execution |
| `paused` | Temporarily stopped |
| `completed` | Successfully finished |
| `failed` | Error occurred |
| `cancelled` | User cancelled |
| `timeout` | Exceeded time limit |

## Events

The workflow engine emits events for real-time monitoring:

```typescript
// Workflow lifecycle
manager.on('workflow.started', (event) => {});
manager.on('workflow.completed', (event) => {});
manager.on('workflow.failed', (event) => {});

// Process events  
manager.on('process.started', (event) => {});
manager.on('process.output', (event) => {});
manager.on('process.stopped', (event) => {});

// Worktree events
manager.on('worktree.created', (event) => {});
manager.on('worktree.deleted', (event) => {});
```

## Error Handling

The workflow engine provides specialized error types:

```typescript
import { 
  WorkflowError,
  WorktreeError, 
  ProcessError,
  MaxConcurrentWorkflowsError 
} from '@tm/workflow-engine';

try {
  await manager.startTaskExecution(task);
} catch (error) {
  if (error instanceof MaxConcurrentWorkflowsError) {
    console.log('Too many concurrent workflows');
  } else if (error instanceof WorktreeError) {
    console.log('Worktree operation failed');
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Build package
npm run build

# Run tests
npm test

# Development mode
npm run dev
```

## Integration Examples

### With Task Master Core

```typescript
import { createTaskMasterCore } from '@tm/core';
import { TaskExecutionManager } from '@tm/workflow-engine';

const core = await createTaskMasterCore({ projectPath: '.' });
const workflows = new TaskExecutionManager({ /*...*/ });

// Get task from core
const tasks = await core.getTaskList({});
const task = tasks.tasks.find(t => t.id === '1.2');

// Execute with workflow engine
if (task) {
  const workflowId = await workflows.startTaskExecution(task);
}
```

### With VS Code Extension

```typescript
import { WorkflowProvider } from './workflow-provider';

// Register tree view
const provider = new WorkflowProvider(context);
vscode.window.createTreeView('taskmaster.workflows', {
  treeDataProvider: provider
});

// Register commands
vscode.commands.registerCommand('taskmaster.workflow.start', 
  async (taskId) => {
    await provider.startWorkflow(taskId);
  }
);
```

## Troubleshooting

### Common Issues

1. **Worktree Creation Fails**
   ```bash
   # Check git version (requires 2.5+)
   git --version
   
   # Verify project is git repository
   git status
   ```

2. **Claude Code Not Found**
   ```bash
   # Check Claude installation
   which claude
   
   # Set custom path
   export TASKMASTER_CLAUDE_PATH=/path/to/claude
   ```

3. **Permission Errors**
   ```bash
   # Check worktree directory permissions
   chmod -R 755 ./worktrees
   ```

### Debug Mode

Enable debug logging for troubleshooting:

```typescript
const manager = new TaskExecutionManager({
  // ... other config
  debug: true
});
```

Or via environment:

```bash
export TASKMASTER_WORKFLOW_DEBUG=true
tm workflow start 1.2
```

## Roadmap

- [ ] Process resource monitoring (CPU, memory)
- [ ] Workflow templates and presets
- [ ] Integration with CI/CD pipelines
- [ ] Workflow scheduling and queueing
- [ ] Multi-machine workflow distribution
- [ ] Advanced debugging and profiling tools

## License

MIT WITH Commons-Clause