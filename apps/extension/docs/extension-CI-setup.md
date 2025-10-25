# VS Code Extension CI/CD Setup

This document explains the CI/CD setup for the Task Master VS Code extension using automated changesets.

## 🔄 Workflows Overview

### 1. Extension CI (`extension-ci.yml`)

#### Triggers

- Push to `main` or `next` branches (only when extension files change)
- Pull requests to `main` or `next` (only when extension files change)

#### What it does

- ✅ Lints and type-checks the extension code
- 🔨 Builds the extension (`npm run build`)
- 📦 Creates a clean package (`npm run package`)
- 🧪 Runs tests with VS Code test framework
- 📋 Creates a test VSIX package to verify packaging works
- 💾 Uploads build artifacts for inspection

### 2. Version & Publish (`version.yml`)

**Triggers:**
- Push to `main` branch

**What it does:**
- 🔍 Detects changeset files for pending releases
- 📝 Creates "Version Packages" PR with updated versions and CHANGELOG
- 🤖 When Version PR is merged, automatically:
  - 🔨 Builds and packages the extension
  - 🏷️ Creates git tags with changeset automation
  - 📤 Publishes to VS Code Marketplace
  - 🌍 Publishes to Open VSX Registry
  - 📊 Updates package versions and CHANGELOG

## 🚀 Changeset Workflow

### Creating Changes
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
6. **Commit changeset file** along with your code changes
7. **Push to feature branch** and create PR

### Automated Publishing Process
1. **PR with changeset** gets merged to `main`
2. **Version workflow** detects changesets and creates "Version Packages" PR
3. **Review and merge** the Version PR
4. **Automated publishing** happens immediately:
   - Extension is built using 3-file packaging system
   - VSIX package is created and tested
   - Published to VS Code Marketplace (if `VSCE_PAT` is set)
   - Published to Open VSX Registry (if `OVSX_PAT` is set)
   - Git tags are created: `taskr-kanban@1.0.1`
   - CHANGELOG is updated automatically

## 🔑 Required Secrets

To use the automated publishing, you need to set up these GitHub repository secrets:

### `VSCE_PAT` (VS Code Marketplace Personal Access Token)
1. Go to [Azure DevOps](https://dev.azure.com/)
2. Sign in with your Microsoft account
3. Create a Personal Access Token:
   - **Name**: VS Code Extension Publishing
   - **Organization**: All accessible organizations
   - **Expiration**: Custom (recommend 1 year)
   - **Scopes**: Custom defined → **Marketplace** → **Manage**
4. Copy the token and add it to GitHub Secrets as `VSCE_PAT`

### `OVSX_PAT` (Open VSX Registry Personal Access Token)
1. Go to [Open VSX Registry](https://open-vsx.org/)
2. Sign in with your GitHub account
3. Go to your [User Settings](https://open-vsx.org/user-settings/tokens)
4. Create a new Access Token:
   - **Description**: VS Code Extension Publishing
   - **Scopes**: Leave default (full access)
5. Copy the token and add it to GitHub Secrets as `OVSX_PAT`

### `GITHUB_TOKEN` (automatically provided)
This is automatically available in GitHub Actions - no setup required.

## 📋 Version Management

### Changeset-Based Versioning
Versions are automatically managed by changesets:

- **No manual version updates needed** - changesets handle this automatically
- **Semantic versioning** is enforced based on changeset types
- **Changelog generation** happens automatically
- **Git tagging** is handled by the automation

### Critical Fields Sync
The automation ensures these fields stay in sync between `package.json` and `package.publish.json`:

```json
{
  "version": "1.0.2",                    // ✅ AUTO-SYNCED
  "publisher": "Hamster",        // ⚠️ MUST MATCH MANUALLY
  "displayName": "taskr: Task Master Kanban", // ⚠️ MUST MATCH MANUALLY
  "description": "...",                  // ⚠️ MUST MATCH MANUALLY
  "engines": { "vscode": "^1.93.0" },   // ⚠️ MUST MATCH MANUALLY
  "categories": [...],                   // ⚠️ MUST MATCH MANUALLY
  "contributes": { ... }                 // ⚠️ MUST MATCH MANUALLY
}
```

**Note**: Only `version` is automatically synced. Other fields must be manually kept in sync.

## 🔍 Monitoring Builds

### CI Status

- **Green ✅**: Extension builds and tests successfully
- **Red ❌**: Build/test failures - check logs for details
- **Yellow 🟡**: Partial success - some jobs may have warnings

### Version PR Status

- **Version PR Created**: Changesets detected, review and merge to publish
- **No Version PR**: No changesets found, no releases pending
- **Version PR Merged**: Automated publishing triggered

### Release Status

- **Published 🎉**: Extension live on VS Code Marketplace and Open VSX
- **Skipped ℹ️**: No changesets found, no release needed
- **Failed ❌**: Check logs - often missing secrets or build issues

### Artifacts

Workflows upload artifacts that you can download:

- **CI**: Test results, built files, and VSIX package
- **Version**: Final VSIX package and published extension

## 🛠️ Troubleshooting

### Common Issues

#### No Version PR Created

- **Check**: Changeset files exist in `.changeset/` directory
- **Check**: Changeset refers to `taskr-kanban` package name
- **Check**: Changes were pushed to `main` branch
- **Solution**: Create changeset with `npx changeset add`

#### Version PR Not Publishing

- **Check**: Version PR was actually merged (not just closed)
- **Check**: Required secrets (`VSCE_PAT`, `OVSX_PAT`) are set
- **Check**: No build failures in workflow logs
- **Solution**: Re-run workflow or check secret configuration

#### `VSCE_PAT` is not set Error

- Ensure `VSCE_PAT` secret is added to repository
- Check token hasn't expired
- Verify token has Marketplace → Manage permissions

#### `OVSX_PAT` is not set Error

- Ensure `OVSX_PAT` secret is added to repository
- Check token hasn't expired
- Verify you're signed in to Open VSX Registry with GitHub

#### Build Failures

- Check extension code compiles locally: `cd apps/extension && npm run build`
- Verify tests pass locally: `npm run test`
- Check for TypeScript errors: `npm run typecheck`

#### Packaging Failures

- Ensure clean package builds: `npm run package`
- Check vsix-build structure is correct
- Verify `package.publish.json` has correct `repository` field

#### Changeset Issues

- **Wrong package name**: Ensure changeset refers to `taskr-kanban`
- **Invalid format**: Check changeset markdown format is correct
- **Merge conflicts**: Resolve any conflicts in changeset files

## 📁 File Structure Impact

The CI workflows respect the 3-file packaging system:
- **Development**: Uses `package.json` for dependencies and scripts
- **Release**: Uses `package.publish.json` for clean marketplace package
- **Build**: Uses `package.mjs` to create `vsix-build/` for final packaging
- **Changesets**: Automatically manage versions across the system

## 🌍 Dual Registry Publishing

Your extension will be automatically published to both:
- **VS Code Marketplace** - For official VS Code users
- **Open VSX Registry** - For Cursor, Windsurf, VSCodium, Gitpod, Eclipse Theia, and other compatible editors

## 🎯 Benefits of Changeset Automation

- ✅ **Automated versioning**: No manual version bumps needed
- ✅ **Generated changelogs**: Automatic, accurate release notes
- ✅ **Semantic versioning**: Enforced through changeset types
- ✅ **Git tagging**: Proper tags for extension releases
- ✅ **Conflict prevention**: Clear separation of extension vs. main package versions
- ✅ **Review process**: Version changes are reviewable via PR
- ✅ **Rollback capability**: Easy to revert if issues arise

This ensures clean, predictable, and fully automated publishing to both registries! 🚀
