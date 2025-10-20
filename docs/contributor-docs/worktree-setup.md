# Git Worktree Setup for Parallel Development

Simple git worktree setup for running multiple AI coding assistants in parallel.

## Why Worktrees?

Instead of Docker complexity, use git worktrees to create isolated working directories:

✅ **Editor Agnostic** - Works with Cursor, Windsurf, VS Code, Claude Code, etc.
✅ **Simple** - No Docker, no containers, just git
✅ **Fast** - Instant setup, shared git history
✅ **Flexible** - Each worktree can be on a different branch
✅ **Task Master Works** - Full access to `.taskmaster/` in each worktree

## Quick Start

### 1. Create a Worktree

```bash
# Using current branch as base
./scripts/create-worktree.sh

# Or specify a branch name
./scripts/create-worktree.sh feature/my-feature
```

This creates a worktree in `../claude-task-master-worktrees/<branch-name>/`

### 2. Open in Your Editor

```bash
# Navigate to the worktree
cd ../claude-task-master-worktrees/auto-main/  # (or whatever branch)

# Open with your preferred AI editor
cursor .        # Cursor
code .          # VS Code
windsurf .      # Windsurf
claude          # Claude Code CLI
```

### 3. Work in Parallel

**Main directory** (where you are now):
```bash
# Keep working normally
git checkout main
cursor .
```

**Worktree directory**:
```bash
cd ../claude-task-master-worktrees/auto-main/
# Different files, different branch, same git repo
claude
```

## Usage Examples

### Example 1: Let Claude Work Autonomously

```bash
# Create worktree
./scripts/create-worktree.sh auto/taskmaster-work

# Navigate there
cd ../claude-task-master-worktrees/auto-taskmaster-work/

# Start Claude
claude

# In Claude session
> Use task-master to get the next task and complete it
```

**Meanwhile in your main directory:**
```bash
# You keep working normally
cursor .
# No conflicts!
```

### Example 2: Multiple AI Assistants in Parallel

```bash
# Create multiple worktrees
./scripts/create-worktree.sh cursor/feature-a
./scripts/create-worktree.sh claude/feature-b
./scripts/create-worktree.sh windsurf/feature-c

# Terminal 1
cd ../claude-task-master-worktrees/cursor-feature-a/
cursor .

# Terminal 2
cd ../claude-task-master-worktrees/claude-feature-b/
claude

# Terminal 3
cd ../claude-task-master-worktrees/windsurf-feature-c/
windsurf .
```

### Example 3: Test vs Implementation

```bash
# Main directory: Write implementation
cursor .

# Worktree: Have Claude write tests
cd ../claude-task-master-worktrees/auto-main/
claude -p "Write tests for the recent changes in the main branch"
```

## How It Works

### Directory Structure

```
/Volumes/Workspace/workspace/contrib/task-master/
├── claude-task-master/              # Main directory (this one)
│   ├── .git/                        # Shared git repo
│   ├── .taskmaster/                 # Synced via git
│   └── your code...
│
└── claude-task-master-worktrees/    # Worktrees directory
    ├── auto-main/                   # Worktree 1
    │   ├── .git -> (points to main .git)
    │   ├── .taskmaster/             # Same tasks, synced
    │   └── your code... (on branch auto/main)
    │
    └── feature-x/                   # Worktree 2
        ├── .git -> (points to main .git)
        ├── .taskmaster/
        └── your code... (on branch feature/x)
```

### Shared Git Repository

All worktrees share the same `.git`:
- Commits in one worktree are immediately visible in others
- Branches are shared
- Git history is shared
- Only the working files differ

## Task Master in Worktrees

Task Master works perfectly in worktrees:

```bash
# In any worktree
task-master list        # Same tasks
task-master next        # Same task queue
task-master show 1.2    # Same task data

# Changes are shared (if committed/pushed)
```

### Recommended Workflow

Use **tags** to separate task contexts:

```bash
# Main directory - use default tag
task-master list

# Worktree 1 - use separate tag
cd ../claude-task-master-worktrees/auto-main/
task-master add-tag --name=claude-auto
task-master use-tag --name=claude-auto
task-master list  # Shows claude-auto tasks only
```

## Managing Worktrees

### List All Worktrees

```bash
./scripts/list-worktrees.sh

# Or directly with git
git worktree list
```

### Remove a Worktree

```bash
# Remove specific worktree
git worktree remove ../claude-task-master-worktrees/auto-main/

# Or if there are uncommitted changes, force it
git worktree remove --force ../claude-task-master-worktrees/auto-main/
```

### Sync Changes Between Worktrees

Changes are automatically synced through git:

```bash
# In worktree
git add .
git commit -m "feat: implement feature"
git push

# In main directory
git pull
# Changes are now available
```

## Common Workflows

### 1. Autonomous Claude with Task Master

**Setup:**
```bash
./scripts/create-worktree.sh auto/claude-work
cd ../claude-task-master-worktrees/auto-claude-work/
```

**Run:**
```bash
# Copy the autonomous script
cp ../claude-task-master/run-autonomous-tasks.sh .

# Run Claude autonomously
./run-autonomous-tasks.sh
```

**Monitor from main directory:**
```bash
# In another terminal, in main directory
watch -n 5 "task-master list"
```

### 2. Code Review Workflow

**Main directory:**
```bash
# You write code
cursor .
git add .
git commit -m "feat: new feature"
```

**Worktree:**
```bash
cd ../claude-task-master-worktrees/auto-main/
git pull

# Have Claude review
claude -p "Review the latest commit and suggest improvements"
```

### 3. Parallel Feature Development

**Worktree 1 (Backend):**
```bash
./scripts/create-worktree.sh backend/api
cd ../claude-task-master-worktrees/backend-api/
cursor .
# Work on API
```

**Worktree 2 (Frontend):**
```bash
./scripts/create-worktree.sh frontend/ui
cd ../claude-task-master-worktrees/frontend-ui/
windsurf .
# Work on UI
```

**Main directory:**
```bash
# Monitor and merge
git log --all --graph --oneline
```

## Tips

### 1. Branch Naming Convention

Use prefixes to organize:
- `auto/*` - For autonomous AI work
- `cursor/*` - For Cursor-specific features
- `claude/*` - For Claude-specific features
- `review/*` - For code review worktrees

### 2. Commit Often in Worktrees

Worktrees make it easy to try things:
```bash
# In worktree
git commit -m "experiment: trying approach X"
# If it doesn't work, just delete the worktree
git worktree remove .
```

### 3. Use Different npm Dependencies

Each worktree can have different `node_modules`:
```bash
# Main directory
npm install

# Worktree (different dependencies)
cd ../claude-task-master-worktrees/auto-main/
npm install
# Installs independently
```

### 4. .env Files

Each worktree can have its own `.env`:
```bash
# Main directory
echo "API_URL=http://localhost:3000" > .env

# Worktree
cd ../claude-task-master-worktrees/auto-main/
echo "API_URL=http://localhost:4000" > .env
# Different config!
```

## Cleanup

### Remove All Worktrees

```bash
# List and manually remove
./scripts/list-worktrees.sh

# Remove each one
git worktree remove ../claude-task-master-worktrees/auto-main/
git worktree remove ../claude-task-master-worktrees/feature-x/

# Or remove all at once (careful!)
rm -rf ../claude-task-master-worktrees/
git worktree prune  # Clean up git's worktree metadata
```

### Delete Remote Branches

```bash
# After merging/done with branches
git branch -d auto/claude-work
git push origin --delete auto/claude-work
```

## Troubleshooting

### "Cannot create worktree: already exists"

```bash
# Remove the existing worktree first
git worktree remove ../claude-task-master-worktrees/auto-main/
```

### "Branch already checked out"

Git won't let you check out the same branch in multiple worktrees:
```bash
# Use a different branch name
./scripts/create-worktree.sh auto/main-2
```

### Changes Not Syncing

Worktrees don't auto-sync files. Use git:
```bash
# In worktree with changes
git add .
git commit -m "changes"
git push

# In other worktree
git pull
```

### npm install Fails

Each worktree needs its own `node_modules`:
```bash
cd ../claude-task-master-worktrees/auto-main/
npm install
```

## Comparison to Docker

| Feature | Git Worktrees | Docker |
|---------|---------------|--------|
| Setup time | Instant | Minutes (build) |
| Disk usage | Minimal (shared .git) | GBs per container |
| Editor support | Native (any editor) | Limited (need special setup) |
| File sync | Via git | Via volumes (can be slow) |
| Resource usage | None (native) | RAM/CPU overhead |
| Complexity | Simple (just git) | Complex (Dockerfile, compose, etc.) |
| npm install | Per worktree | Per container |
| AI editor support | ✅ All editors work | ⚠️ Need web-based or special config |

**TL;DR: Worktrees are simpler, faster, and more flexible for this use case.**

---

## Summary

```bash
# 1. Create worktree
./scripts/create-worktree.sh auto/claude-work

# 2. Open in AI editor
cd ../claude-task-master-worktrees/auto-claude-work/
cursor .   # or claude, windsurf, code, etc.

# 3. Work in parallel
# Main directory: You work
# Worktree: AI works
# No conflicts!
```

**Simple, fast, editor-agnostic.** 🚀
