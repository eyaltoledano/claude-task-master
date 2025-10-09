#!/bin/bash

# Create a git worktree for parallel Claude Code development
# Usage: ./scripts/create-worktree.sh [branch-name]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKTREES_DIR="$(cd "$PROJECT_ROOT/.." && pwd)/claude-task-master-worktrees"
cd "$PROJECT_ROOT"

# Get branch name (default to current branch with auto/ prefix)
if [ -z "$1" ]; then
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    if [ "$CURRENT_BRANCH" = "HEAD" ]; then
        echo "Detached HEAD detected. Please specify a branch: ./scripts/create-worktree.sh <branch-name>"
        exit 1
    fi
    BRANCH_NAME="auto/$CURRENT_BRANCH"
    echo "No branch specified, using: $BRANCH_NAME"
else
    BRANCH_NAME="$1"
fi

# Create worktrees directory if it doesn't exist
mkdir -p "$WORKTREES_DIR"

# Sanitize branch name for directory (replace / with -)
DIR_NAME=$(echo "$BRANCH_NAME" | sed 's/\//-/g')
WORKTREE_PATH="$WORKTREES_DIR/$DIR_NAME"

echo "Creating git worktree..."
echo "  Branch: $BRANCH_NAME"
echo "  Path: $WORKTREE_PATH"

# Check if worktree already exists
if [ -d "$WORKTREE_PATH" ]; then
    echo "❌ Worktree already exists at: $WORKTREE_PATH"
    echo "   Remove it first with: git worktree remove $WORKTREE_PATH"
    exit 1
fi

# Create worktree (new or existing branch)
if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
  git worktree add "$WORKTREE_PATH" "$BRANCH_NAME"
elif git remote get-url origin >/dev/null 2>&1 && git ls-remote --exit-code --heads origin "$BRANCH_NAME" >/dev/null 2>&1; then
  # Create a local branch from the remote and attach worktree
  git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" "origin/$BRANCH_NAME"
  # Ensure the new branch tracks the remote
  git -C "$WORKTREE_PATH" branch --set-upstream-to="origin/$BRANCH_NAME" "$BRANCH_NAME"
else
  git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH"
fi

echo ""
echo "✅ Worktree created successfully!"
echo ""
echo "📂 Location: $WORKTREE_PATH"
echo "🌿 Branch: $BRANCH_NAME"
echo ""
echo "Next steps:"
echo "  1. cd $WORKTREE_PATH"
echo "  2. Open with your AI editor:"
echo "     - Cursor: cursor ."
echo "     - VS Code: code ."
echo "     - Windsurf: windsurf ."
echo "     - Claude Code: claude"
echo ""
echo "To remove this worktree later:"
echo "  git worktree remove $WORKTREE_PATH"
