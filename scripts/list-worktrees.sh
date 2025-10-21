#!/bin/bash

# List all git worktrees with helpful information

set -e

echo "📋 Git Worktrees:"
echo ""
git worktree list
echo ""
echo "To remove a worktree:"
echo "  git worktree remove <path>"
echo ""
echo "To remove all worktrees:"
echo "  git worktree list | grep -v '(bare)' | tail -n +2 | awk '{print \$1}' | xargs -I {} git worktree remove {}"
