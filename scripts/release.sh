#!/bin/bash
set -e

echo "🚀 Starting release process..."

# Ensure we're in the project root
cd "$(dirname "$0")/.."

echo "📦 Building and packaging extension..."

# Navigate to extension directory and build
cd apps/extension

# Install dependencies (in case they're not cached)
echo "📥 Installing extension dependencies..."
pnpm install --frozen-lockfile

# Run quality checks first (same as CI)
echo "🔍 Running lint checks..."
pnpm run lint

echo "🔍 Running type checks..."
pnpm run check-types

# Build the extension
echo "🔨 Building extension..."
pnpm run build

# Create clean package
echo "📦 Creating clean package..."
pnpm run package

# Verify package contents (same as CI)
echo "🔍 Verifying package contents..."
echo "Checking vsix-build contents..."
ls -la vsix-build/
echo "Checking dist contents..."
ls -la vsix-build/dist/
echo "Checking package.json exists..."
test -f vsix-build/package.json

# Create VSIX package
echo "📦 Creating VSIX package..."
cd vsix-build
pnpm exec vsce package --no-dependencies --out "$PWD"

# Run tests before publishing
echo "🧪 Running extension tests..."
cd ..
# Note: Tests run with xvfb-run in CI, but in release context we'll skip or handle differently
echo "⚠️  Skipping tests in release context (run in CI validation)"

# Go back to project root for tagging and changeset operations
cd ../..

echo "🏷️ Checking extension tag..."
node scripts/tag-extension.mjs

echo "📝 Publishing packages with changesets..."
# Let changesets handle all the npm publishing first
npx changeset publish

echo "🌐 Publishing extension to VS Code Marketplace..."
# Find the generated VSIX file
VSIX_FILE=$(find apps/extension/vsix-build -name "*.vsix" | head -n 1)

if [ -n "$VSIX_FILE" ]; then
  echo "Found VSIX file: $VSIX_FILE"
  
  # Publish to VS Code Marketplace
  if [ -n "$VSCE_PAT" ]; then
    echo "Publishing to VS Code Marketplace..."
    npx vsce publish --packagePath "$VSIX_FILE"
  else
    echo "⚠️ VSCE_PAT not set, skipping VS Code Marketplace publish"
  fi
  
  # Publish to Open VSX Registry
  if [ -n "$OVSX_PAT" ]; then
    echo "Publishing to Open VSX Registry..."
    npx ovsx publish --packagePath "$VSIX_FILE"
  else
    echo "⚠️ OVSX_PAT not set, skipping Open VSX publish"
  fi
  
else
  echo "❌ No VSIX file found!"
  exit 1
fi

echo "✅ Release process completed!" 