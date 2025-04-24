# Configuration

Task Master can be configured through environment variables in a `.env` file at the root of your project.

## Required Configuration

- `ANTHROPIC_API_KEY`: Your Anthropic API key for Claude (Example: `ANTHROPIC_API_KEY=sk-ant-api03-...`)

## Optional Configuration

- `MODEL` (Default: `"claude-3-7-sonnet-20250219"`): Claude model to use (Example: `MODEL=claude-3-opus-20240229`)
- `MAX_TOKENS` (Default: `"4000"`): Maximum tokens for responses (Example: `MAX_TOKENS=8000`)
- `TEMPERATURE` (Default: `"0.7"`): Temperature for model responses (Example: `TEMPERATURE=0.5`)
- `DEBUG` (Default: `"false"`): Enable debug logging (Example: `DEBUG=true`)
- `LOG_LEVEL` (Default: `"info"`): Console output level (Example: `LOG_LEVEL=debug`)
- `DEFAULT_SUBTASKS` (Default: `"3"`): Default subtask count (Example: `DEFAULT_SUBTASKS=5`)
- `DEFAULT_PRIORITY` (Default: `"medium"`): Default priority (Example: `DEFAULT_PRIORITY=high`)
- `PROJECT_NAME` (Default: `"MCP SaaS MVP"`): Project name in metadata (Example: `PROJECT_NAME=My Awesome Project`)
- `PROJECT_VERSION` (Default: `"1.0.0"`): Version in metadata (Example: `PROJECT_VERSION=2.1.0`)
- `PERPLEXITY_API_KEY`: For research-backed features (Example: `PERPLEXITY_API_KEY=pplx-...`)
- `PERPLEXITY_MODEL` (Default: `"sonar-medium-online"`): Perplexity model (Example: `PERPLEXITY_MODEL=sonar-large-online`)

## Example .env File

```
# Required
ANTHROPIC_API_KEY=sk-ant-api03-your-api-key

# Optional - Claude Configuration
MODEL=claude-3-7-sonnet-20250219
MAX_TOKENS=4000
TEMPERATURE=0.7

# Optional - Perplexity API for Research
PERPLEXITY_API_KEY=pplx-your-api-key
PERPLEXITY_MODEL=sonar-medium-online

# Optional - Project Info
PROJECT_NAME=My Project
PROJECT_VERSION=1.0.0

# Optional - Application Configuration
DEFAULT_SUBTASKS=3
DEFAULT_PRIORITY=medium
DEBUG=false
LOG_LEVEL=info
```

## Troubleshooting

### If `task-master init` doesn't respond:

Try running it with Node directly:

```bash
node node_modules/claude-task-master/.taskmaster/scripts/init.js
```

Or clone the repository and run:

```bash
git clone https://github.com/eyaltoledano/claude-task-master.git
cd claude-task-master
node .taskmaster/scripts/init.js
```
