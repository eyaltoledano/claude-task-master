# Claude Task Master - AI Prompts Quick Reference

## CLI Commands → Prompts Mapping

| Command | Description | AI Prompt Location | Modes |
|---------|-------------|-------------------|--------|
| `parse-prd` | Generate tasks from PRD | `parse-prd.js` | Standard, Research |
| `add-task` | Add new task with AI | `parse-prd.js` (modified) | Standard |
| `expand` | Break task into subtasks | `expand-task.js` | Main, Research, Simplified |
| `analyze-complexity` | Analyze task complexity | `analyze-task-complexity.js` | Standard |
| `update` | Update multiple tasks | `update-tasks.js` | Standard |
| `update-task` | Update single task | `update-task-by-id.js` | Standard |
| `update-subtask` | Update subtask content | `update-subtask-by-id.js` | Standard |

## MCP Tools → Prompts Mapping

| MCP Tool | CLI Equivalent | Shared Prompt |
|----------|----------------|---------------|
| `parse_prd` | `parse-prd` | Yes - via direct function |
| `add_task` | `add-task` | Yes - via direct function |
| `expand_task` | `expand` | Yes - via direct function |
| `analyze_project_complexity` | `analyze-complexity` | Yes - via direct function |
| `update_tasks` | `update` | Yes - via direct function |
| `update_task` | `update-task` | Yes - via direct function |
| `update_subtask` | `update-subtask` | Yes - via direct function |

## Prompt Categories

### 1. Generation Prompts
- **parse-prd**: Creates new tasks from requirements
- **expand**: Generates subtasks from parent tasks

### 2. Analysis Prompts
- **analyze-complexity**: Evaluates task difficulty and provides recommendations

### 3. Update Prompts
- **update**: Modifies multiple tasks while preserving structure
- **update-task-by-id**: Updates single task properties
- **update-subtask-by-id**: Generates subtask descriptions

## Key Prompt Features by Type

### Generation Prompts
- Structured output requirements
- Explicit task count constraints
- Dependency management rules
- Time estimation guidelines (2-8 hours per task)

### Analysis Prompts
- Multi-factor scoring (technical, scope, dependencies, risk, testing)
- Percentage-based weighting
- Recommendation generation
- Critical path identification

### Update Prompts
- Preservation of IDs and status
- Selective field updates
- Consistency maintenance
- Context awareness

## AI Provider Usage

| Provider Type | Used For | Commands |
|--------------|----------|----------|
| Main Provider | General task operations | All commands |
| Research Provider | Enhanced research mode | `parse-prd -r`, `expand -r` |
| Fallback Provider | Backup when main fails | All commands (automatic) |

## Template Variable Categories

### Task Properties
- `${task.id}`, `${task.title}`, `${task.description}`
- `${task.details}`, `${task.testStrategy}`
- `${task.status}`, `${task.priority}`

### Control Variables
- `${numTasks}` - Task generation count
- `${numSubtasks}` - Subtask generation count
- `${fromTaskId}` - Update starting point

### Content Variables
- `${prdContent}` - PRD document text
- `${prompt}` - User instructions
- `${promptAdditionalContext}` - Extra context

## Prompt Engineering Best Practices

1. **Always specify output format** - JSON structure in prompts
2. **Include role definition** - "You are a senior software architect..."
3. **Use numbered rules** - Clear, enforceable constraints
4. **Preserve existing data** - Explicit preservation instructions
5. **Provide full context** - Include all relevant task data
6. **Handle edge cases** - Default values for missing data

## Common Prompt Patterns

### Input Structure
```
1. Role definition
2. Context/current state
3. Task requirements
4. Explicit rules
5. Output format specification
```

### Output Requirements
- JSON format for structured data
- Plain text for descriptions only
- Consistent schema across commands
- Validation-friendly structures