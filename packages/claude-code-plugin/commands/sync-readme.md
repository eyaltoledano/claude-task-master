Export tasks to README.md with professional formatting.

Arguments: $ARGUMENTS

Generate a well-formatted README with current task information.

## README Synchronization

Creates or updates README.md with beautifully formatted task information.

## Argument Parsing

Optional filters:
- "pending" → Only pending tasks
- "with-subtasks" → Include subtask details
- "by-priority" → Group by priority
- "sprint" → Current sprint only

## Execution

```bash
task-master sync-readme [--with-subtasks] [--status=<status>]
```

## README Generation

### 1. **Project Header**
```markdown
# Project Name

## 📋 Task Progress

Last Updated: 2024-01-15 10:30 AM

### Summary
- Total Tasks: 45
- Completed: 15 (33%)
- In Progress: 5 (11%)
- Pending: 25 (56%)
```

### 2. **Task Sections**
Organized by status or priority:
- Progress indicators
- Task descriptions
- Dependencies noted
- Time estimates

### 3. **Visual Elements**
- Progress bars
- Status badges
- Priority indicators
- Completion checkmarks

## Smart Features

1. **Intelligent Grouping**
   - By feature area
   - By sprint/milestone
   - By assigned developer
   - By priority

2. **Progress Tracking**
   - Overall completion
   - Sprint velocity
   - Burndown indication
   - Time tracking

3. **Formatting Options**
   - GitHub-flavored markdown
   - Task checkboxes
   - Collapsible sections
   - Table format available

## Example Output

```markdown
## 🚀 Current Sprint

### In Progress
- [ ] 🔄 #5 **Implement user authentication** (60% complete)
  - Dependencies: API design (#3 ✅)
  - Subtasks: 4 (2 completed)
  - Est: 8h / Spent: 5h

### Pending (High Priority)
- [ ] ⚡ #8 **Create dashboard UI**
  - Blocked by: #5
  - Complexity: High
  - Est: 12h
```

## Customization

Based on arguments:
- Include/exclude sections
- Detail level control
- Custom grouping
- Filter by criteria

## Post-Sync

After generation:
1. Show diff preview
2. Backup existing README
3. Write new content
4. Commit reminder
5. Update timestamp

## Integration

Works well with:
- Git workflows
- CI/CD pipelines
- Project documentation
- Team updates
- Client reports