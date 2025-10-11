# Task Master AI - Claude Code Marketplace

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

### task-master-ai

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

3. **Users update** with: `/plugin marketplace update task-master`

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
    "task-master-ai": {
      "marketplace": "task-master"
    }
  }
}
```

Team members who trust the repository folder will automatically get the marketplace and plugins installed.

## Marketplace Schema

Our marketplace follows the Claude Code marketplace schema:

**Required fields:**

- `name` - Marketplace identifier
- `owner` - Maintainer information
- `plugins` - Array of plugin definitions

**Plugin fields:**

- `name` - Plugin identifier (required)
- `source` - Where to fetch the plugin (required)
- `description` - Brief description
- `version` - Plugin version
- `author` - Author information
- `homepage` - Documentation URL
- `repository` - Source code URL
- `license` - SPDX license identifier
- `keywords` - Searchable tags
- `category` - Organization category
- `strict` - Require plugin.json (default: true)

## Plugin Development Workflow

1. **Edit source** in `assets/claude/`
2. **Build plugin**: `cd packages/claude-code-plugin && npm run build`
3. **Update marketplace version** if needed
4. **Test locally**: `/plugin marketplace add .`
5. **Commit** source files and marketplace.json
6. **Push** to GitHub

Users will automatically get updates on the next marketplace refresh.

## Documentation

- [Plugin Development Guide](CLAUDE_CODE_PLUGIN.md)
- [Claude Code Plugin Docs](https://docs.claude.com/en/docs/claude-code/plugins)
- [Marketplace Documentation](https://docs.claude.com/en/docs/claude-code/plugin-marketplaces)

## License

MIT WITH Commons-Clause

See [LICENSE](LICENSE) for details.
