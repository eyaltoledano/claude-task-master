# VS Code Extension Development Guide

## 📁 File Structure Overview

This VS Code extension uses a **3-file packaging system** to avoid dependency conflicts during publishing:

```
apps/extension/
├── package.json           # Development configuration
├── package.publish.json   # Clean publishing configuration  
├── package.mjs           # Build script for packaging
├── .vscodeignore         # Files to exclude from extension package
└── vsix-build/           # Generated clean package directory
```

## 📋 File Purposes

### `package.json` (Development)
- **Purpose**: Development environment with all build tools
- **Contains**: 
  - All `devDependencies` needed for building
  - Development scripts (`build`, `watch`, `lint`, etc.)
  - Development package name: `"taskr"`
- **Used for**: Local development, building, testing

### `package.publish.json` (Publishing)
- **Purpose**: Clean distribution version for VS Code Marketplace
- **Contains**:
  - **No devDependencies** (avoids dependency conflicts)
  - Publishing metadata (`keywords`, `repository`, `categories`)
  - Marketplace package name: `"taskr-kanban"`
  - VS Code extension configuration
- **Used for**: Final extension packaging

### `package.mjs` (Build Script)
- **Purpose**: Creates clean package for distribution
- **Process**:
  1. Builds the extension (`build:js` + `build:css`)
  2. Creates clean `vsix-build/` directory
  3. Copies only essential files (no source code)
  4. Renames `package.publish.json` → `package.json`
  5. Ready for `vsce package`

## 🚀 Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Start development with hot reload
npm run watch

# Run just JavaScript build
npm run build:js

# Run just CSS build  
npm run build:css

# Full production build
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Testing in VS Code
1. Press `F5` in VS Code to launch Extension Development Host
2. Test your extension functionality in the new window
3. Use `Developer: Reload Window` to reload after changes

## 📦 Production Packaging

### Step 1: Build Clean Package
```bash
npm run package
```
This creates `vsix-build/` with clean distribution files.

### Step 2: Create VSIX
```bash
cd vsix-build
npx vsce package --no-dependencies
```
Creates: `taskr-kanban-1.0.1.vsix`

### Alternative: One Command
```bash
npm run package && cd vsix-build && npx vsce package --no-dependencies
```

## 🔄 Keeping Files in Sync

### Critical Fields to Sync Between Files

When updating extension metadata, ensure these fields match between `package.json` and `package.publish.json`:

#### Version & Identity
```json
{
  "version": "1.0.1",                    // ⚠️ MUST MATCH
  "publisher": "Hamster",        // ⚠️ MUST MATCH  
  "displayName": "taskr: Task Master Kanban", // ⚠️ MUST MATCH
  "description": "A visual Kanban board...",  // ⚠️ MUST MATCH
}
```

#### VS Code Configuration
```json
{
  "engines": { "vscode": "^1.101.0" },   // ⚠️ MUST MATCH
  "categories": [...],                    // ⚠️ MUST MATCH
  "activationEvents": [...],              // ⚠️ MUST MATCH
  "main": "./dist/extension.js",          // ⚠️ MUST MATCH
  "contributes": { ... }                  // ⚠️ MUST MATCH EXACTLY
}
```

### Key Differences (Should NOT Match)
```json
// package.json (dev)
{
  "name": "taskr",                       // ✅ Short dev name
  "devDependencies": { ... },            // ✅ Only in dev file
  "scripts": { ... }                     // ✅ Build scripts
}

// package.publish.json (publishing)
{
  "name": "taskr-kanban",               // ✅ Marketplace name
  "keywords": [...],                     // ✅ Only in publish file
  "repository": "https://github.com/...", // ✅ Only in publish file
  // NO devDependencies                  // ✅ Clean for publishing
  // NO build scripts                    // ✅ Not needed in package
}
```

## 🤖 Automated Release Process

### Changesets Workflow
This extension uses [Changesets](https://github.com/changesets/changesets) for automated version management and publishing.

#### Adding Changes
When making changes to the extension:

1. **Make your code changes**
2. **Create a changeset**:
   ```bash
   # From project root
   npx changeset add
   ```
3. **Select the extension package**: Choose `taskr-kanban` when prompted
4. **Select version bump type**:
   - `patch`: Bug fixes, minor updates
   - `minor`: New features, backwards compatible
   - `major`: Breaking changes
5. **Write a summary**: Describe what changed for users

#### Automated Publishing
The automation workflow runs on pushes to `main`:

1. **Version Workflow** (`.github/workflows/version.yml`):
   - Detects when changesets exist
   - Creates a "Version Packages" PR with updated versions and CHANGELOG
   - When the PR is merged, automatically publishes the extension

2. **Release Process** (`scripts/release.sh`):
   - Builds the extension using the 3-file packaging system
   - Creates VSIX package
   - Publishes to VS Code Marketplace (if `VSCE_PAT` is set)
   - Publishes to Open VSX Registry (if `OVSX_PAT` is set)
   - Creates git tags for the extension version

#### Required Secrets
For automated publishing, these secrets must be set in the repository:

- `VSCE_PAT`: Personal Access Token for VS Code Marketplace
- `OVSX_PAT`: Personal Access Token for Open VSX Registry
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

#### Manual Release
If needed, you can manually trigger a release:

```bash
# From project root
./scripts/release.sh
```

### Extension Tagging
The extension uses a separate tagging strategy from the main package:

- **Extension tags**: `taskr-kanban@1.0.1`
- **Main package tags**: `task-master-ai@2.1.0`

This allows independent versioning and prevents conflicts in the monorepo.

## 🔍 Troubleshooting

### Dependency Conflicts
**Problem**: `vsce package` fails with missing dependencies
**Solution**: Use the 3-file system - never run `vsce package` from root

### Build Failures
**Problem**: Extension not working after build
**Check**:
1. All files copied to `vsix-build/dist/`
2. `package.publish.json` has correct `main` field
3. VS Code engine version compatibility

### Sync Issues
**Problem**: Extension works locally but fails when packaged
**Check**: Ensure critical fields are synced between package files

### Changeset Issues
**Problem**: Version workflow not triggering
**Check**: 
1. Changeset files exist in `.changeset/`
2. Package name in changeset matches `package.publish.json`
3. Changes are pushed to `main` branch

**Problem**: Publishing fails
**Check**:
1. Required secrets are set in repository settings
2. `package.publish.json` has correct repository URL
3. Build process completes successfully

## 📝 Version Release Checklist

### Manual Releases
1. **Create changeset**: `npx changeset add`
2. **Update critical fields** in both `package.json` and `package.publish.json`
3. **Test locally** with `F5` in VS Code
4. **Commit and push** to trigger automated workflow

### Automated Releases (Recommended)
1. **Create changeset**: `npx changeset add`
2. **Push to feature branch** and create PR
3. **Merge PR** - this triggers version PR creation
4. **Review and merge version PR** - this triggers automated publishing

## 🎯 Why This System?

- **Avoids dependency conflicts**: VS Code doesn't see dev dependencies
- **Clean distribution**: Only essential files in final package
- **Faster packaging**: No dependency resolution during `vsce package`
- **Maintainable**: Clear separation of dev vs. production configs
- **Reliable**: Consistent, conflict-free packaging process
- **Automated**: Changesets handle versioning and publishing automatically
- **Traceable**: Clear changelog and git tags for every release

---

**Remember**: Always use `npx changeset add` for changes, then push to trigger automated releases! 🚀 
