---
description: Guidelines for implementing tasks imported from Hamster using Task Master CLI
globs: "**/*"
alwaysApply: true
---

# Hamster Integration Workflow

This guide outlines the process for working with tasks imported from Hamster briefs using Task Master. When connected to a Hamster brief, follow these specific guidelines to ensure proper task management and workflow execution.

## **Command Restrictions**

### **Supported Commands**
- **✅ DO**: Use only these Task Master CLI commands when working with Hamster briefs:
  ```bash
  tm list                      # List all tasks
  tm show <sub/task id> --json # Show task details
  tm set-status                # Update task status
  tm auth refresh              # Refresh authentication token
  tm context <brief url>       # Reconnect to Hamster brief context
  ```

### **Unsupported Commands**
- **❌ DON'T**: Use MCP tools when connected with Hamster briefs - they are not yet up to date with Hamster integration
- **❌ DON'T**: Use other Task Master CLI commands that haven't been verified to work with Hamster integration

## **Task Workflow Process**

### **Starting a Task**
```bash
# ✅ DO: Mark task and subtasks as in-progress when starting
tm set-status -i 1,1.1 -s in-progress

# Multiple tasks/subtasks can be marked at once using comma separation
tm set-status -i 1,1.1,1.2,2 -s in-progress
```

### **Task Implementation Flow**
1. **Read the Task**: Use `tm show <id> --json` to understand the task requirements (json used to save tokens, gets you same information)
2. **Check for Subtasks**: If the task has subtasks, implement them one at a time
3. **Implement Subtask**: Complete the subtask implementation
4. **Verify Quality**: Run lint and typecheck before marking as done
   ```bash
   npm lint
   npm typecheck
   ```
5. **Mark Complete**: If verification passes, mark the subtask as done
   ```bash
   tm set-status -i 1.1 -s done
   ```
6. **Commit Changes**: Commit the completed subtask work
7. **Repeat**: Continue until all subtasks are complete

### **Parent Task Completion**
- After all subtasks are done, run final verification:
  ```bash
  npm lint
  npm typecheck
  ```
- Mark the parent task as done:
  ```bash
  tm set-status -i 1 -s done
  ```
- Move to the next task and repeat the process

## **Multiple Task Context**

### **Viewing Multiple Tasks**
```bash
# ✅ DO: Use comma-separated IDs to get context from multiple tasks
tm show 1,1.1,2,2.1 --json

# This is more efficient than calling tm show multiple times
```

### **Parallel Subtask Execution**
- **When to Parallelize**: If a task has subtasks that can be completed in parallel
- **Requirements**:
  - Ensure work/files to adjust are **not the same** across subtasks
  - Spawn sub-agents for each parallel subtask
  - Verify clear separation of work before parallelizing
- **Example**: If subtask 1.1 modifies `src/api.js` and subtask 1.2 modifies `src/utils.js`, these can run in parallel

## **Pull Request Management**

### **PR Creation Strategy**
- **Preferred Approach**: Keep everything in one PR if scope remains manageable
- **When to Split**: Create separate PRs if the work becomes too large
- **Multi-PR Strategy**: If splitting is necessary:
  - Create PRs that build on top of previous ones
  - **Always confirm with the human** before creating multiple PRs
- **PR Creation**: Use GitHub CLI after completing a task:
  ```bash
  gh pr create --title "Task X: [Task Title]" --body "Description"
  ```

### **Committing to PRs**
- Keep committing to the same PR as long as the scope is maintained
- An entire task list (brief) might fit into a single PR
- If scope grows too large, discuss with human before creating new PRs

## **Authentication & Context Management**

### **Token Refresh**
```bash
# ✅ DO: Refresh token if JWT seems expired or commands don't work
tm auth refresh

# If refresh doesn't work, reconnect context
tm context <brief url>
```

### **Context Reconnection**
- **When Needed**: If commands stop working or authentication fails
- **Required Information**: Brief URL (ask user if not available)
- **Best Practice**: Store brief URL at the beginning of the session
- **Command**: `tm context <brief url>`

## **Integration with Git Workflow**

When working with Hamster briefs, follow the standard Git workflow patterns outlined in [git_workflow.mdc](mdc:.cursor/rules/git_workflow.mdc):

- Create task-specific branches: `task-XXX`
- Commit subtask work incrementally
- Create PRs after task completion
- Follow commit message standards

## **Workflow Summary**

```mermaid
flowchart TD
    A[Start: Connect to Hamster Brief] --> B[Get Brief URL]
    B --> C[tm list - View Tasks]
    C --> D[Select Task]
    D --> E[tm show <id> --json - Read Task]
    E --> F{Has Subtasks?}
    F -->|Yes| G[Select First Subtask]
    F -->|No| M[Implement Task]
    G --> H[tm set-status -i X.Y -s in-progress]
    H --> I[Implement Subtask]
    I --> J[npm lint && npm typecheck]
    J --> K{Passes?}
    K -->|Yes| L[tm set-status -i X.Y -s done]
    K -->|No| I
    L --> N{More Subtasks?}
    N -->|Yes| G
    N -->|No| O[Final lint/typecheck]
    M --> O
    O --> P[tm set-status -i X -s done]
    P --> Q[Commit & Create PR]
    Q --> R{More Tasks?}
    R -->|Yes| D
    R -->|No| S[Complete]
    
    style A fill:#e1f5fe
    style H fill:#fff3e0
    style L fill:#e8f5e8
    style Q fill:#fce4ec
```

## **Key Principles**

- **Incremental Progress**: Work through subtasks one at a time
- **Quality Gates**: Always run lint and typecheck before marking tasks as done
- **Clear Communication**: Confirm with human before splitting work across multiple PRs
- **Efficient Context Gathering**: Use comma-separated IDs when viewing multiple tasks
- **Authentication Management**: Proactively refresh tokens and reconnect context when needed

## **Related Rules**

- [Git Workflow](mdc:.cursor/rules/git_workflow.mdc) - Standard Git branching and PR practices
- [Development Workflow](mdc:.cursor/rules/dev_workflow.mdc) - General Task Master development patterns
- [Task Management](mdc:.cursor/rules/tasks.mdc) - Task structure and operations
