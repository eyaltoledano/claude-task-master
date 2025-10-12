# Taskmaster AI - Claude Code Marketplace

This repository includes a Claude Code plugin marketplace in `.claude-plugin/marketplace.json`.

## Installation

### From GitHub (Public Repository)

Once this repository is pushed to GitHub, users can install with:

```bash
# Add the marketplace
/plugin marketplace add eyaltoledano/claude-task-master

# Install the plugin
/plugin install taskmaster@taskmaster
```

### Local Development/Testing

```bash
# From the project root directory
cd /path/to/claude-task-master

# Build the plugin first
cd packages/claude-code-plugin
npm run build
cd ../..

# In Claude Code
/plugin marketplace add .
/plugin install taskmaster@taskmaster
```

## Marketplace Structure

```
claude-task-master/
├── .claude-plugin/
│   └── marketplace.json        # Marketplace manifest (at repo root)
│
├── packages/claude-code-plugin/
│   ├── src/build.ts           # Build tooling
│   └── [generated plugin files]
│
└── assets/claude/              # Plugin source files
    ├── commands/
    └── agents/
```

## Available Plugins

### taskmaster

AI-powered task management system for ambitious development workflows.

**Features:**

- 49 slash commands for comprehensive task management
- 3 specialized AI agents (orchestrator, executor, checker)
- MCP server integration
- Complexity analysis and auto-expansion
- Dependency management and validation
- Automated workflow capabilities

**Quick Start:**

```bash
/tm:init
/tm:parse-prd
/tm:next
```

## For Contributors

### Adding New Plugins

To add more plugins to this marketplace:

1. **Update marketplace.json**:

   ```json
   {
     "plugins": [
       {
         "name": "new-plugin",
         "source": "./path/to/plugin",
         "description": "Plugin description",
         "version": "1.0.0"
       }
     ]
   }
   ```

2. **Commit and push** the changes

3. **Users update** with: `/plugin marketplace update taskmaster`

### Marketplace Versioning

The marketplace version is tracked in `.claude-plugin/marketplace.json`:

```json
{
  "metadata": {
    "version": "1.0.0"
  }
}
```

Increment the version when adding or updating plugins.

## Team Configuration

Organizations can auto-install this marketplace for all team members by adding to `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "task-master": {
      "source": {
        "source": "github",
        "repo": "eyaltoledano/claude-task-master"
      }
    }
  },
  "enabledPlugins": {
    "taskmaster": {
      "marketplace": "taskmaster"
    }
  }
}
```

Team members who trust the repository folder will automatically get the marketplace and plugins installed.

## Documentation

- [Claude Code Plugin Docs](https://docs.claude.com/en/docs/claude-code/plugins)
- [Marketplace Documentation](https://docs.claude.com/en/docs/claude-code/plugin-marketplaces)
