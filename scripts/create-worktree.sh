#!/bin/bash

# Create a git worktree for parallel Claude Code development
# Usage: ./scripts/create-worktree.sh [branch-name]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKTREES_DIR="$(cd "$PROJECT_ROOT/.." && pwd)/claude-task-master-worktrees"

# Get branch name (default to current branch with auto/ prefix)
if [ -z "$1" ]; then
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
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

# Create new branch and worktree
git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" 2>/dev/null || \
    git worktree add "$WORKTREE_PATH" "$BRANCH_NAME"

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
