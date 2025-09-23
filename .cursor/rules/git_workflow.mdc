---
description: Git workflow integrated with Task Master for feature development and collaboration
globs: "**/*"
alwaysApply: true
---
# Git Workflow with Task Master Integration

## **Branch Strategy**

### **Main Branch Protection**
- **main** branch contains production-ready code
- All feature development happens on task-specific branches
- Direct commits to main are prohibited
- All changes merge via Pull Requests

### **Task Branch Naming**
```bash
# ✅ DO: Use consistent task branch naming
task-001  # For Task 1
task-004  # For Task 4
task-015  # For Task 15

# ❌ DON'T: Use inconsistent naming
feature/user-auth
fix-database-issue
random-branch-name
```

## **Tagged Task Lists Integration**

Task Master's **tagged task lists system** provides significant benefits for Git workflows:

### **Multi-Context Development**
- **Branch-Specific Tasks**: Each branch can have its own task context using tags
- **Merge Conflict Prevention**: Tasks in different tags are completely isolated
- **Context Switching**: Seamlessly switch between different development contexts
- **Parallel Development**: Multiple team members can work on separate task contexts

### **Migration and Compatibility**
- **Seamless Migration**: Existing projects automatically migrate to use a "master" tag
- **Zero Disruption**: All existing Git workflows continue unchanged
- **Backward Compatibility**: Legacy projects work exactly as before

### **Manual Git Integration**
- **Manual Tag Creation**: Use `--from-branch` option to create tags from current git branch
- **Manual Context Switching**: Explicitly switch tag contexts as needed for different branches
- **Simplified Integration**: Focused on manual control rather than automatic workflows

## **Workflow Overview**

```mermaid
flowchart TD
    A[Start: On main branch] --> B[Pull latest changes]
    B --> C[Create task branch<br/>git checkout -b task-XXX]
    C --> D[Set task status: in-progress]
    D --> E[Get task context & expand if needed<br/>Tasks automatically use current tag]
    E --> F[Identify next subtask]
    
    F --> G[Set subtask: in-progress]
    G --> H[Research & collect context<br/>update_subtask with findings]
    H --> I[Implement subtask]
    I --> J[Update subtask with completion]
    J --> K[Set subtask: done]
    K --> L[Git commit subtask]
    
    L --> M{More subtasks?}
    M -->|Yes| F
    M -->|No| N[Run final tests]
    
    N --> O[Commit tests if added]
    O --> P[Push task branch]
    P --> Q[Create Pull Request]
    Q --> R[Human review & merge]
    R --> S[Switch to main & pull]
    S --> T[Delete task branch]
    T --> U[Ready for next task]
    
    style A fill:#e1f5fe
    style C fill:#f3e5f5
    style G fill:#fff3e0
    style L fill:#e8f5e8
    style Q fill:#fce4ec
    style R fill:#f1f8e9
    style U fill:#e1f5fe
```

## **Complete Task Development Workflow**

### **Phase 1: Task Preparation**
```bash
# 1. Ensure you're on main branch and pull latest
git checkout main
git pull origin main

# 2. Check current branch status
git branch  # Verify you're on main

# 3. Create task-specific branch
git checkout -b task-004  # For Task 4

# 4. Set task status in Task Master (tasks automatically use current tag context)
# Use: set_task_status tool or `task-master set-status --id=4 --status=in-progress`
```

### **Phase 2: Task Analysis & Planning**
```bash
# 5. Get task context and expand if needed (uses current tag automatically)
# Use: get_task tool or `task-master show 4`
# Use: expand_task tool or `task-master expand --id=4 --research --force` (if complex)

# 6. Identify next subtask to work on
# Use: next_task tool or `task-master next`
```

### **Phase 3: Subtask Implementation Loop**
For each subtask, follow this pattern:

```bash
# 7. Mark subtask as in-progress
# Use: set_task_status tool or `task-master set-status --id=4.1 --status=in-progress`

# 8. Gather context and research (if needed)
# Use: update_subtask tool with research flag or:
# `task-master update-subtask --id=4.1 --prompt="Research findings..." --research`

# 9. Collect code context through AI exploration
# Document findings in subtask using update_subtask

# 10. Implement the subtask
# Write code, tests, documentation

# 11. Update subtask with completion details
# Use: update_subtask tool or:
# `task-master update-subtask --id=4.1 --prompt="Implementation complete..."`

# 12. Mark subtask as done
# Use: set_task_status tool or `task-master set-status --id=4.1 --status=done`

# 13. Commit the subtask implementation
git add .
git commit -m "feat(task-4): Complete subtask 4.1 - [Subtask Title]

- Implementation details
- Key changes made
- Any important notes

Subtask 4.1: [Brief description of what was accomplished]
Relates to Task 4: [Main task title]"
```

### **Phase 4: Task Completion**
```bash
# 14. When all subtasks are complete, run final testing
# Create test file if needed, ensure all tests pass
npm test  # or jest, or manual testing

# 15. If tests were added/modified, commit them
git add .
git commit -m "test(task-4): Add comprehensive tests for Task 4

- Unit tests for core functionality
- Integration tests for API endpoints
- All tests passing

Task 4: [Main task title] - Testing complete"

# 16. Push the task branch
git push origin task-004

# 17. Create Pull Request
# Title: "Task 4: [Task Title]"
# Description should include:
# - Task overview
# - Subtasks completed
# - Testing approach
# - Any breaking changes or considerations
```

### **Phase 5: PR Merge & Cleanup**
```bash
# 18. Human reviews and merges PR into main

# 19. Switch back to main and pull merged changes
git checkout main
git pull origin main

# 20. Delete the feature branch (optional cleanup)
git branch -d task-004
git push origin --delete task-004
```

## **Commit Message Standards**

### **Subtask Commits**
```bash
# ✅ DO: Consistent subtask commit format
git commit -m "feat(task-4): Complete subtask 4.1 - Initialize Express server

- Set up Express.js with TypeScript configuration
- Added CORS and body parsing middleware
- Implemented health check endpoints
- Basic error handling middleware

Subtask 4.1: Initialize project with npm and install dependencies
Relates to Task 4: Setup Express.js Server Project"

# ❌ DON'T: Vague or inconsistent commits
git commit -m "fixed stuff"
git commit -m "working on task"
```

### **Test Commits**
```bash
# ✅ DO: Separate test commits when substantial
git commit -m "test(task-4): Add comprehensive tests for Express server setup

- Unit tests for middleware configuration
- Integration tests for health check endpoints
- Mock tests for database connection
- All tests passing with 95% coverage

Task 4: Setup Express.js Server Project - Testing complete"
```

### **Commit Type Prefixes**
- `feat(task-X):` - New feature implementation
- `fix(task-X):` - Bug fixes
- `test(task-X):` - Test additions/modifications
- `docs(task-X):` - Documentation updates
- `refactor(task-X):` - Code refactoring
- `chore(task-X):` - Build/tooling changes

## **Task Master Commands Integration**

### **Essential Commands for Git Workflow**
```bash
# Task management (uses current tag context automatically)
task-master show <id>           # Get task/subtask details
task-master next                # Find next task to work on
task-master set-status --id=<id> --status=<status>
task-master update-subtask --id=<id> --prompt="..." --research

# Task expansion (for complex tasks)
task-master expand --id=<id> --research --force

# Progress tracking
task-master list                # View all tasks and status
task-master list --status=in-progress  # View active tasks
```

### **MCP Tool Equivalents**
When using Cursor or other MCP-integrated tools:
- `get_task` instead of `task-master show`
- `next_task` instead of `task-master next`
- `set_task_status` instead of `task-master set-status`
- `update_subtask` instead of `task-master update-subtask`

## **Branch Management Rules**

### **Branch Protection**
```bash
# ✅ DO: Always work on task branches
git checkout -b task-005
# Make changes
git commit -m "..."
git push origin task-005

# ❌ DON'T: Commit directly to main
git checkout main
git commit -m "..."  # NEVER do this
```

### **Keeping Branches Updated**
```bash
# ✅ DO: Regularly sync with main (for long-running tasks)
git checkout task-005
git fetch origin
git rebase origin/main  # or merge if preferred

# Resolve any conflicts and continue
```

## **Pull Request Guidelines**

### **PR Title Format**
```
Task <ID>: <Task Title>

Examples:
Task 4: Setup Express.js Server Project
Task 7: Implement User Authentication
Task 12: Add Stripe Payment Integration
```

### **PR Description Template**
```markdown
## Task Overview
Brief description of the main task objective.

## Subtasks Completed
- [x] 4.1: Initialize project with npm and install dependencies
- [x] 4.2: Configure TypeScript, ESLint and Prettier  
- [x] 4.3: Create basic Express app with middleware and health check route

## Implementation Details
- Key architectural decisions made
- Important code changes
- Any deviations from original plan

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests passing
- [ ] Manual testing completed

## Breaking Changes
List any breaking changes or migration requirements.

## Related Tasks
Mention any dependent tasks or follow-up work needed.
```

## **Conflict Resolution**

### **Task Conflicts with Tagged System**
```bash
# With tagged task lists, merge conflicts are significantly reduced:
# 1. Different branches can use different tag contexts
# 2. Tasks in separate tags are completely isolated
# 3. Use Task Master's move functionality to reorganize if needed

# Manual git integration available:
# - Use `task-master add-tag --from-branch` to create tags from current branch
# - Manually switch contexts with `task-master use-tag <name>`
# - Simple, predictable workflow without automatic behavior
```

### **Code Conflicts**
```bash
# Standard Git conflict resolution
git fetch origin
git rebase origin/main
# Resolve conflicts in files
git add .
git rebase --continue
```

## **Emergency Procedures**

### **Hotfixes**
```bash
# For urgent production fixes:
git checkout main
git pull origin main
git checkout -b hotfix-urgent-issue

# Make minimal fix
git commit -m "hotfix: Fix critical production issue

- Specific fix description
- Minimal impact change
- Requires immediate deployment"

git push origin hotfix-urgent-issue
# Create emergency PR for immediate review
```

### **Task Abandonment**
```bash
# If task needs to be abandoned or significantly changed:
# 1. Update task status
task-master set-status --id=<id> --status=cancelled

# 2. Clean up branch
git checkout main
git branch -D task-<id>
git push origin --delete task-<id>

# 3. Document reasoning in task
task-master update-task --id=<id> --prompt="Task cancelled due to..."
```

## **Tagged System Benefits for Git Workflows**

### **Multi-Team Development**
- **Isolated Contexts**: Different teams can work on separate tag contexts without conflicts
- **Feature Branches**: Each feature branch can have its own task context
- **Release Management**: Separate tags for different release versions or environments

### **Merge Conflict Prevention**
- **Context Separation**: Tasks in different tags don't interfere with each other
- **Clean Merges**: Reduced likelihood of task-related merge conflicts
- **Parallel Development**: Multiple developers can work simultaneously without task conflicts

### **Manual Git Integration**
- **Branch-Based Tag Creation**: Use `--from-branch` option to create tags from current git branch
- **Manual Context Management**: Explicitly switch tag contexts as needed
- **Predictable Workflow**: Simple, manual control without automatic behavior

---

**References:**
- [Task Master Workflow](mdc:.cursor/rules/dev_workflow.mdc)
- [Architecture Guidelines](mdc:.cursor/rules/architecture.mdc)
- [Task Master Commands](mdc:.cursor/rules/taskmaster.mdc)
