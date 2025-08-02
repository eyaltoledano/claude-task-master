#!/bin/bash
set -e

echo "🚀 Starting release process..."

# Double-check we're not in pre-release mode (safety net)
if [ -f .changeset/pre.json ]; then
  echo "⚠️  Warning: pre.json still exists. Removing it..."
  rm -f .changeset/pre.json
fi

# Check if the extension version has changed and tag it
# This prevents changeset from trying to publish the private package
node .github/scripts/tag-extension.mjs

# Run changeset publish for npm packages
npx changeset publish

echo "✅ Release process completed!"

# The extension tag (if created) will trigger the extension-release workflow