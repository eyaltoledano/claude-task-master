# Start Working with Hamster Brief

End-to-end workflow for working on tasks from a connected Hamster brief. All tasks from the brief are worked on in a single branch, with one PR created at the end.

## Step 1: Verify Connection & Authentication

```bash
# Check current context and authentication status
tm context
```

If not connected or authentication fails:
- Get brief URL from user if not available
- Connect: `tm context <brief url>`
- Refresh token if needed: `tm auth refresh`

## Step 2: List Available Tasks

```bash
# View all tasks from the brief
tm list
```

Review the task list to understand what needs to be done. Note the total number of tasks.

## Step 3: Initialize Git Branch for Brief

```bash
# Ensure you're on dev branch and pull latest
git checkout dev
git pull origin dev

# Create a single branch for the entire brief (e.g., hamster-brief-YYYY-MM-DD or brief-specific name)
git checkout -b hamster-brief

# Verify branch creation
git branch
```

**Note**: This branch will be used for ALL tasks in the brief. Do not create separate branches per task.

## Step 4: Task Loop (Repeat for Each Task)

Work through all tasks sequentially in the same branch:

### 4.1: Read Task Details

```bash
# Get detailed information about the task
tm show 1

# If task has subtasks, examine them all
tm show 1,1.1,1.2,1.3  # Adjust IDs as needed
```

### 4.2: Log Initial Context

```bash
# Document task understanding and initial findings
tm update-task -i 1 --append --prompt="Starting task implementation.

Initial context:
- Task requirements: [summarize key requirements]
- Dependencies identified: [list any dependencies]
- Files that may need modification: [list relevant files]
- Approach planned: [brief implementation approach]"
```

### 4.3: Mark Task as In-Progress

```bash
# Mark task and first subtask (if exists) as in-progress
tm set-status -i 1,1.1 -s in-progress
```

### 4.4: Subtask Implementation Loop

For each subtask (1.1, 1.2, 1.3, etc.):

#### 4.4.1: Read Subtask Details
```bash
tm show 1.1  # Replace with current subtask ID
```

#### 4.4.2: Log Research & Context Gathering
```bash
# Document findings during implementation
tm update-task -i 1 --append --prompt="Subtask 1.1 - Context gathered:

- Code exploration findings: [what you discovered]
- Implementation approach: [how you plan to implement]
- Key decisions made: [important choices]
- Challenges encountered: [any blockers or issues]"
```

#### 4.4.3: Implement Subtask
- Write code following the subtask requirements
- Make necessary changes to files

#### 4.4.4: Quality Verification
```bash
# Run linting
pnpm lint

# Run type checking
pnpm typecheck

# If either fails, fix issues and re-run until both pass
```

#### 4.4.5: CodeRabbit Review
```bash
# Generate code review (wait for plain text results)
coderabbit --prompt-only

# Review the output and address any critical issues if needed
```

#### 4.4.6: Log Implementation Completion
```bash
# Document what was completed
tm update-task -i 1 --append --prompt="Subtask 1.1 - Implementation complete:

- Files modified: [list files changed]
- Key changes: [summary of implementation]
- CodeRabbit feedback addressed: [if any issues were fixed]
- Ready for commit"
```

#### 4.4.7: Commit Subtask Work
```bash
# Stage changes
git add .

# Commit with detailed message following git_workflow.mdc format
git commit -m "feat(task-1): Complete subtask 1.1 - [Subtask Title]

- Implementation details
- Key changes made
- Files modified: [list files]
- CodeRabbit review completed

Subtask 1.1: [Brief description of what was accomplished]
Relates to Task 1: [Main task title]"
```

#### 4.4.8: Mark Subtask as Done
```bash
tm set-status -i 1.1 -s done
```

#### 4.4.9: Move to Next Subtask
Repeat steps 4.4.1 through 4.4.8 for the next subtask (1.2, 1.3, etc.)

### 4.5: Complete Parent Task

After all subtasks are complete:

#### 4.5.1: Final Quality Checks
```bash
# Final linting
pnpm lint

# Final type checking
pnpm typecheck

# Final CodeRabbit review
coderabbit --prompt-only

# Address any remaining issues if critical
```

#### 4.5.2: Log Task Completion
```bash
# Document final task completion
tm update-task -i 1 --append --prompt="Task 1 - Complete:

- All subtasks completed: [list all subtasks]
- Final verification passed: lint, typecheck, CodeRabbit review
- Files changed: [comprehensive list]
- Committed to brief branch"
```

#### 4.5.3: Mark Parent Task as Done
```bash
tm set-status -i 1 -s done
```

**Note**: Do NOT push or create PR yet. Continue to next task in the same branch.

### 4.6: Move to Next Task

```bash
# Verify remaining tasks
tm list

# Continue with next task (e.g., Task 2)
# Repeat steps 4.1 through 4.5 for Task 2, then Task 3, etc.
```

## Step 5: Complete All Tasks

Continue working through all tasks (Steps 4.1-4.6) until all tasks in the brief are complete. All work is committed to the same `hamster-brief` branch.

## Step 6: Final Verification & PR Creation

After ALL tasks are complete:

### 6.1: Verify All Tasks Complete
```bash
# Verify all tasks are done
tm list

# Should show all tasks with status 'done'
```

### 6.2: Final Quality Checks
```bash
# Final comprehensive checks
pnpm lint
pnpm typecheck
coderabbit --prompt-only

# Address any remaining issues if critical
```

### 6.3: Push Branch
```bash
# Push the brief branch to remote
git push origin hamster-brief
```

### 6.4: Create Pull Request to Dev
```bash
# Get all task titles (adjust task IDs as needed)
# Create comprehensive PR description

gh pr create \
  --base dev \
  --title "Hamster Brief: Complete Implementation" \
  --body "## Brief Overview
Completed all tasks from Hamster brief.

## Tasks Completed
- [x] Task 1: [Task 1 title]
  - Subtasks: 1.1, 1.2, 1.3
- [x] Task 2: [Task 2 title]
  - Subtasks: 2.1, 2.2
- [x] Task 3: [Task 3 title]
  - [Continue listing all tasks]

## Implementation Summary
- Total tasks: [number]
- Total subtasks: [number]
- Files modified: [comprehensive list]
- All quality checks passed

## Quality Checks
- ✅ Linting passed (pnpm lint)
- ✅ Type checking passed (pnpm typecheck)
- ✅ CodeRabbit review completed for all changes

## Testing
- [ ] Manual testing completed
- [ ] All checks passing

Complete implementation of Hamster brief tasks"
```

## Step 7: Cleanup

```bash
# After PR is merged, switch back to dev
git checkout dev
git pull origin dev

# Delete local branch (optional)
git branch -d hamster-brief
```

## Important Notes

- **Use ONLY**: `tm list`, `tm show <id>`, `tm set-status`, `tm update-task`, `tm auth refresh`, `tm context <brief url>`
- **DON'T use MCP tools** - not compatible with Hamster integration
- **Single branch per brief**: All tasks work in the same branch (`hamster-brief`)
- **Single PR per brief**: One PR created after all tasks are complete
- **Always target dev branch** - never main branch
- **Regular logging**: Use `tm update-task -i <id> --append` frequently to document:
  - Context gathered during exploration
  - Implementation decisions made
  - Challenges encountered
  - Completion status
- **Quality gates**: Never skip lint, typecheck, or CodeRabbit review
- **Commit format**: Follow git_workflow.mdc commit message standards
- **PR format**: Always use `--base dev` when creating PRs

## Workflow Summary

```
1. Verify connection → tm context
2. List tasks → tm list
3. Create single branch → git checkout -b hamster-brief
4. For each task (in same branch):
   a. Read task → tm show X
   b. Log context → tm update-task -i X --append
   c. Mark in-progress → tm set-status -i X,X.Y -s in-progress
   d. For each subtask:
      - Read → tm show X.Y
      - Log context → tm update-task -i X --append
      - Implement code
      - Verify → pnpm lint && pnpm typecheck
      - Review → coderabbit --prompt-only
      - Log completion → tm update-task -i X --append
      - Commit → git commit (following git_workflow.mdc format)
      - Mark done → tm set-status -i X.Y -s done
   e. Final checks → pnpm lint && pnpm typecheck && coderabbit --prompt-only
   f. Log completion → tm update-task -i X --append
   g. Mark task done → tm set-status -i X -s done
   h. Continue to next task (same branch)
5. After ALL tasks complete:
   a. Final verification → pnpm lint && pnpm typecheck && coderabbit --prompt-only
   b. Push branch → git push origin hamster-brief
   c. Create PR → gh pr create --base dev
```

## References

- Full guidelines: [hamster.mdc](mdc:.cursor/rules/hamster.mdc)
- Git workflow: [git_workflow.mdc](mdc:.cursor/rules/git_workflow.mdc)
