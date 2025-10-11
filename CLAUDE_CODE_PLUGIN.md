# Claude Code Plugin Development Guide

This document explains the architecture and workflow for developing and distributing the Task Master AI Claude Code plugin.

## Architecture Overview

### Source of Truth: `assets/claude/`

All plugin source files are maintained in `assets/claude/`:

```
assets/claude/
├── commands/              # Slash command definitions
│   └── tm/               # Task Master commands
│       ├── init/
│       ├── next/
│       ├── show/
│       └── ... (49 commands total)
├── agents/               # AI agent definitions
│   ├── task-executor.md
│   ├── task-orchestrator.md
│   └── task-checker.md
└── CLAUDE.md            # Main instructions (installed to .taskmaster/)
```

### Build Output: `packages/claude-code-plugin/`

The plugin is **generated** from assets during the build process:

```
packages/claude-code-plugin/
├── .gitignore           # Ignores all generated files
├── README.md           # Explains this is a build output
└── [generated files]   # Created by build script
```

**Important**: Files in `packages/claude-code-plugin/` are NOT committed to git (except `.gitignore` and `README.md`).

## Development Workflow

### Making Changes

1. **Edit source files** in `assets/claude/`:

   ```bash
   # Edit a command
   vim assets/claude/commands/tm/next/next-task.md

   # Edit an agent
   vim assets/claude/agents/task-executor.md
   ```

2. **Build the plugin**:

   ```bash
   cd packages/claude-code-plugin
   npm run build
   ```

3. **Test locally**:

   ```bash
   # In Claude Code (from project root)
   /plugin marketplace add .
   /plugin install taskmaster@taskmaster
   ```

4. **Iterate**:

   ```bash
   # Make changes to assets/claude/
   cd packages/claude-code-plugin
   npm run build

   # In Claude Code
   /plugin uninstall taskmaster@taskmaster
   /plugin install taskmaster@taskmaster
   # Restart Claude Code
   ```

5. **Commit source AND generated files**:

   ```bash
   # Commit source changes
   git add assets/claude/

   # Commit generated plugin files (needed for GitHub distribution)
   git add packages/claude-code-plugin/

   git commit -m "feat: improve task-executor agent"
   ```

   **Note**: Both source files and generated plugin files must be committed so GitHub can serve the plugin to Claude Code users.

## Build Process

### Build Script: `packages/claude-code-plugin/src/build.ts`

The TypeScript build script is co-located with the plugin package and performs these steps:

1. **Clean** - Removes old generated files
2. **Copy Commands** - From `assets/claude/commands/` → `packages/claude-code-plugin/commands/`
3. **Copy Agents** - From `assets/claude/agents/` → `packages/claude-code-plugin/agents/`
4. **Generate Manifest** - Creates `.claude-plugin/plugin.json` from root `package.json`
5. **Generate MCP Config** - Creates `.mcp.json` with API key placeholders
6. **Generate package.json** - Creates plugin-specific package metadata
7. **Copy Documentation** - Copies LICENSE and README template if available
8. **Validate** - Ensures all required files exist and JSON is valid
9. **Report** - Shows build summary with statistics

### What Gets Generated

#### `.claude-plugin/plugin.json`

- Metadata extracted from root `package.json`
- Version synchronized automatically
- Keywords, author, repository info

#### `.mcp.json`

- MCP server configuration for task-master-ai
- API key environment variable placeholders
- Proper stdio command configuration

#### `package.json`

- NPM package metadata for the plugin
- Workspace-compatible configuration
- Proper `peerDependencies` on task-master-ai

#### `LICENSE`

- Copied from root LICENSE file
- Ensures proper licensing in distribution

#### `README.md`

- Basic plugin documentation (if template not found)
- Installation and usage instructions
- Can be customized with `assets/claude/PLUGIN_README.md`

## File Organization

### Commands Structure

Commands follow Claude Code's nested structure:

```
commands/tm/
├── init/
│   ├── init-project.md
│   └── init-project-quick.md
├── next/
│   └── next-task.md
└── set-status/
    ├── to-done.md
    ├── to-in-progress.md
    └── to-review.md
```

Each command is a markdown file with optional frontmatter:

```markdown
---
description: Short description of what this command does
---

Full command prompt that Claude will receive.
Can include $ARGUMENTS placeholder for user input.
```

### Agents Structure

Agents are markdown files with frontmatter defining behavior:

```markdown
---
name: task-executor
description: When to use this agent...
model: sonnet
color: blue
---

You are an elite implementation specialist...

[Detailed agent instructions]
```

## Git Strategy

### What to Commit

✅ **DO commit** (GitHub needs to serve these):

- `assets/claude/` - All source files
- `packages/claude-code-plugin/src/` - TypeScript build script
- `packages/claude-code-plugin/package.json` - Build tooling config
- `packages/claude-code-plugin/tsconfig.json` - TypeScript config
- `packages/claude-code-plugin/.gitignore` - Ignore build artifacts
- `packages/claude-code-plugin/commands/` - **Generated - needed for distribution**
- `packages/claude-code-plugin/agents/` - **Generated - needed for distribution**
- `packages/claude-code-plugin/.claude-plugin/` - **Generated - needed for distribution**
- `packages/claude-code-plugin/.mcp.json` - **Generated - needed for distribution**
- `packages/claude-code-plugin/LICENSE` - Generated - needed for distribution
- `packages/claude-code-plugin/README.md` - Generated - needed for distribution
- `.claude-plugin/marketplace.json` - Marketplace manifest

❌ **DO NOT commit**:

- `packages/claude-code-plugin/node_modules/` - Dependencies
- `packages/claude-code-plugin/dist/` - Build artifacts
- `packages/claude-code-plugin/*.log` - Log files

### .gitignore Configuration

`packages/claude-code-plugin/.gitignore`:

```gitignore
# Only ignore build artifacts and dependencies
node_modules/
dist/
*.log
.DS_Store

# Everything else (including generated plugin files) should be committed
# so GitHub can serve them for Claude Code marketplace
```

**Important**: Generated plugin files (commands, agents, .claude-plugin, etc.) are committed so GitHub can serve them to Claude Code. Only build artifacts and dependencies are gitignored.

## Distribution

### Option 1: GitHub Marketplace

Create a separate repository for distribution:

```bash
# Create new repo: yourorg/task-master-plugin
mkdir task-master-plugin && cd task-master-plugin

# Build the plugin
cd packages/claude-code-plugin && npm run build

# Copy build output
cp -r packages/claude-code-plugin/* .

# Create marketplace manifest
mkdir .claude-plugin
cat > .claude-plugin/marketplace.json << 'EOF'
{
  "name": "task-master-marketplace",
  "owner": { "name": "Your Organization" },
  "plugins": [{
    "name": "task-master-ai",
    "source": ".",
    "description": "AI-powered task management for ambitious development"
  }]
}
EOF

# Publish to GitHub
git init
git add .
git commit -m "Initial plugin release"
git remote add origin git@github.com:yourorg/task-master-plugin.git
git push -u origin main

# Users install with:
# /plugin marketplace add yourorg/task-master-plugin
# /plugin install task-master-ai@yourorg
```

### Option 2: Monorepo Distribution

Keep the plugin in the same repo:

```bash
# Build the plugin
cd packages/claude-code-plugin && npm run build

# Create marketplace in repo
mkdir -p marketplace/.claude-plugin

cat > marketplace/.claude-plugin/marketplace.json << 'EOF'
{
  "name": "task-master",
  "owner": { "name": "Task Master Team" },
  "plugins": [{
    "name": "task-master-ai",
    "source": "../packages/claude-code-plugin",
    "description": "AI-powered task management"
  }]
}
EOF

# Users install with:
# /plugin marketplace add eyaltoledano/claude-task-master
# /plugin install taskmaster@taskmaster
```

### Option 3: Team/Organization Distribution

Add to repository's `.claude/settings.json`:

```json
{
  "marketplaces": [
    {
      "source": "yourorg/task-master-plugin"
    }
  ],
  "plugins": [
    {
      "name": "task-master-ai",
      "marketplace": "yourorg",
      "autoInstall": true
    }
  ]
}
```

Team members who trust the repo will automatically get the plugin.

## Maintenance

### Updating the Plugin

1. Make changes to `assets/claude/`
2. Update version in root `package.json`
3. Build: `cd packages/claude-code-plugin && npm run build`
4. Test with local marketplace
5. Commit changes to `assets/claude/`
6. Publish to distribution channel

### Version Management

Versions are synchronized from root `package.json`:

- Plugin manifest version matches package version
- Build script reads version automatically
- No manual version updates needed in multiple places

### Adding New Commands

1. Create command file in `assets/claude/commands/tm/category/`:

   ```bash
   mkdir -p assets/claude/commands/tm/my-feature
   vim assets/claude/commands/tm/my-feature/do-something.md
   ```

2. Write the command:

   ```markdown
   ---
   description: Does something useful
   ---

   Perform the following action: $ARGUMENTS

   [Detailed instructions for Claude]
   ```

3. Build and test:

   ```bash
   cd packages/claude-code-plugin
   npm run build
   # Test in Claude Code
   ```

### Adding New Agents

1. Create agent file in `assets/claude/agents/`:

   ```bash
   vim assets/claude/agents/my-new-agent.md
   ```

2. Write the agent definition:

   ```markdown
   ---
   name: my-new-agent
   description: When to use this agent...
   model: sonnet
   color: purple
   ---

   You are a specialized agent for...

   [Detailed agent instructions]
   ```

3. Build and test:

   ```bash
   cd packages/claude-code-plugin
   npm run build
   # Test in Claude Code
   ```

## Testing

### Local Testing Checklist

- [ ] Build completes without errors
- [ ] All JSON files are valid
- [ ] Commands appear in `/help`
- [ ] Commands execute correctly
- [ ] Agents can be deployed
- [ ] MCP server connects
- [ ] API keys are recognized

### Integration Testing

- [ ] Test in real project
- [ ] Run through complete workflow (init → parse-prd → next → implement → done)
- [ ] Test all command categories
- [ ] Deploy each agent
- [ ] Verify error handling

## Troubleshooting

### Build Fails

```bash
# Check source files exist
ls -la assets/claude/commands/
ls -la assets/claude/agents/

# Check for malformed JSON in root package.json
cat package.json | node -e "JSON.parse(require('fs').readFileSync(0))"

# Run build with verbose output
cd packages/claude-code-plugin && npm run build
```

### Plugin Doesn't Load

1. Verify build was successful
2. Check Claude Code version compatibility
3. Verify JSON files are valid
4. Check for errors in Claude Code logs

### Commands Not Appearing

1. Rebuild: `cd packages/claude-code-plugin && npm run build`
2. Reinstall plugin
3. Restart Claude Code
4. Check command files have `.md` extension
5. Verify commands are in correct directory structure

## Benefits of This Architecture

### ✅ Single Source of Truth

- Edit once in `assets/claude/`
- No duplicate files to maintain
- No sync issues between locations

### ✅ Clean Git History

- Only source files are tracked
- No generated files in commits
- Smaller repository size

### ✅ Flexible Distribution

- Build once, distribute anywhere
- Can publish to multiple marketplaces
- Easy to create variants

### ✅ Automated Consistency

- Version synchronized automatically
- Metadata extracted from package.json
- Build validation ensures completeness

### ✅ Easy Maintenance

- Change source, rebuild, test
- No manual file copying
- Clear separation of concerns

## Summary

The Claude Code plugin for Task Master AI follows a **build-from-source** architecture:

1. **Source**: `assets/claude/` (committed to git)
2. **Build**: `cd packages/claude-code-plugin && npm run build` (generates plugin)
3. **Output**: `packages/claude-code-plugin/` (not committed)
4. **Test**: Local marketplace installation
5. **Distribute**: Publish to marketplace repository

This ensures a clean development workflow, easy maintenance, and flexible distribution options.

---

For questions or issues, see the main Task Master documentation or open an issue on GitHub.
