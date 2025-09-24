Generate individual task files from tasks.json.

## Task File Generation

Creates separate markdown files for each task, perfect for AI agents or documentation.

## Execution

```bash
task-master generate
```

## What It Creates

For each task, generates a file like `task_001.txt`:

```
Task ID: 1
Title: Implement user authentication
Status: pending
Priority: high
Dependencies: []
Created: 2024-01-15
Complexity: 7

## Description
Create a secure user authentication system with login, logout, and session management.

## Details
- Use JWT tokens for session management
- Implement secure password hashing
- Add remember me functionality
- Include password reset flow

## Test Strategy
- Unit tests for auth functions
- Integration tests for login flow
- Security testing for vulnerabilities
- Performance tests for concurrent logins

## Subtasks
1.1 Setup authentication framework (pending)
1.2 Create login endpoints (pending)
1.3 Implement session management (pending)
1.4 Add password reset (pending)
```

## File Organization

Creates structure:
```
.taskmaster/
└── tasks/
    ├── task_001.txt
    ├── task_002.txt
    ├── task_003.txt
    └── ...
```

## Smart Features

1. **Consistent Formatting**
   - Standardized structure
   - Clear sections
   - AI-readable format
   - Markdown compatible

2. **Contextual Information**
   - Full task details
   - Related task references
   - Progress indicators
   - Implementation notes

3. **Incremental Updates**
   - Only regenerate changed tasks
   - Preserve custom additions
   - Track generation timestamp
   - Version control friendly

## Use Cases

- **AI Context**: Provide task context to AI assistants
- **Documentation**: Standalone task documentation
- **Archival**: Task history preservation
- **Sharing**: Send specific tasks to team members
- **Review**: Easier task review process

## Generation Options

Based on arguments:
- Filter by status
- Include/exclude completed
- Custom templates
- Different formats

## Post-Generation

```
Task File Generation Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated: 45 task files
Location: .taskmaster/tasks/
Total size: 156 KB

New files: 5
Updated files: 12
Unchanged: 28

Ready for:
- AI agent consumption
- Version control
- Team distribution
```

## Integration Benefits

- Git-trackable task history
- Easy task sharing
- AI tool compatibility
- Offline task access
- Backup redundancy