# Technical Context

## Technology Stack

### Core Runtime
- **Node.js**: v14.0.0+ (ES Modules required)
- **Package Management**: npm (with global installation support)
- **Module System**: ES Modules (`"type": "module"` in package.json)

### AI Integration Dependencies
- **Vercel AI SDK**: Universal interface for AI providers (`generateText`, `streamText`, `generateObject`)
- **Provider SDKs**: 
  - `@ai-sdk/anthropic` (Claude models)
  - `@ai-sdk/openai` (GPT models)
  - `@ai-sdk/google` (Gemini models)
  - `@ai-sdk/google-vertex` (Vertex AI)
  - `@ai-sdk/azure` (Azure OpenAI)
  - `@ai-sdk/amazon-bedrock` (AWS Bedrock)
  - `@ai-sdk/xai` (Grok models)
  - `@openrouter/ai-sdk-provider` (OpenRouter)
  - `ollama-ai-provider` (Local Ollama)

### CLI Framework
- **Commander.js**: Command-line interface framework
- **Inquirer.js**: Interactive prompts and user input
- **Chalk**: Terminal colors and formatting
- **Boxen**: Terminal boxes and banners
- **CLI-Table3**: Structured table output

### Data Processing
- **Fuse.js**: Fuzzy search for task discovery
- **gpt-tokens**: Token counting for AI context management
- **Zod**: Schema validation (planned for object generation)

### Development Tools
- **Jest**: Unit testing framework with ES modules support
- **ESLint**: Code linting (if configured)
- **Biome**: Code formatting and linting

## Configuration Management

### Project Configuration (`.taskmasterconfig`)
```json
{
  "projectName": "My Project",
  "models": {
    "main": {
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20241022",
      "maxTokens": 4000,
      "temperature": 0.3
    },
    "research": {
      "provider": "perplexity", 
      "model": "llama-3.1-sonar-large-128k-online",
      "maxTokens": 8000,
      "temperature": 0.1
    },
    "fallback": {
      "provider": "openai",
      "model": "gpt-4o",
      "maxTokens": 4000,
      "temperature": 0.3
    }
  },
  "global": {
    "debug": false,
    "logLevel": "info",
    "defaultPriority": "medium",
    "defaultSubtasks": 3
  }
}
```

### Environment Variables
- **API Keys**: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, etc.
- **Service Endpoints**: `OLLAMA_BASE_URL`, `AZURE_OPENAI_ENDPOINT`
- **AWS Credentials**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (for Bedrock)

### MCP Configuration
```json
{
  "mcpServers": {
    "taskmaster-ai": {
      "command": "npx",
      "args": ["-y", "--package=task-master-ai", "task-master-ai"],
      "env": {
        "ANTHROPIC_API_KEY": "your_key_here",
        "PERPLEXITY_API_KEY": "your_key_here"
      }
    }
  }
}
```

## Data Storage Patterns

### Tasks JSON Structure
```json
{
  "meta": {
    "projectName": "Project Name",
    "version": "1.0.0",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "prdSource": "path/to/prd.txt"
  },
  "tasks": [
    {
      "id": 1,
      "title": "Task Title",
      "description": "Brief description",
      "status": "pending|done|deferred", 
      "priority": "high|medium|low",
      "dependencies": [2, 3],
      "details": "Implementation details",
      "testStrategy": "Testing approach",
      "subtasks": [
        {
          "id": 1,
          "title": "Subtask Title",
          "description": "Subtask description",
          "status": "pending|done|deferred",
          "dependencies": [],
          "acceptanceCriteria": "Completion criteria"
        }
      ]
    }
  ]
}
```

### Tag-Based Organization
- **Tagged Data**: Tasks organized by tags (e.g., feature branches)
- **Current Tag**: Stored in `.taskmaster/current-tag`
- **Tag Metadata**: Creation time, descriptions, task counts

### File Generation
- **Task Files**: `task_001.md`, `task_002.md` (AI-optimized format)
- **Subtask Files**: `subtask_001_001.md` (parent_task_subtask format)
- **Project Files**: Generated in `.taskmaster/tasks/` directory

## Development Constraints

### Node.js Version Requirements
- **Minimum**: Node.js 14.0.0 (ES Modules support)
- **Recommended**: Node.js 18+ (better ES module stability)
- **ES Modules**: All code uses `import/export` syntax
- **Module Resolution**: Explicit `.js` extensions required

### API Limitations
- **Rate Limiting**: Each provider has different rate limits
- **Token Limits**: Context must fit within model token windows
- **Cost Management**: Token usage tracking for cost optimization
- **API Key Security**: Keys stored in environment variables, never in code

### File System Dependencies
- **Project Root**: Must be determinable (contains `.taskmaster/` folder)
- **Write Permissions**: Required for task files and configuration
- **Sync Requirements**: JSON and markdown files must stay synchronized

### Network Dependencies
- **AI Provider APIs**: Internet connectivity required for AI features
- **MCP Protocol**: Uses JSON-RPC over stdio or HTTP
- **Research Features**: Require external internet access

## Performance Considerations

### Context Size Management
- **Token Counting**: Real-time token counting for AI context
- **Context Prioritization**: Most relevant tasks included first
- **Truncation Strategies**: Intelligent truncation when context exceeds limits
- **Caching**: No persistent caching (stateless operations)

### AI Provider Optimization
- **Provider Selection**: Different providers optimized for different tasks
- **Parallel Calls**: No concurrent AI calls (sequential processing)
- **Error Recovery**: Automatic fallback to alternative providers
- **Retry Logic**: Exponential backoff for transient failures

### File System Performance
- **Lazy Loading**: Tasks loaded only when needed
- **Atomic Writes**: Prevent corruption during file updates
- **Minimal I/O**: Batch file operations when possible

## Security Considerations

### API Key Management
- **Environment Variables**: Never store API keys in configuration files
- **MCP Security**: Keys provided via MCP environment configuration
- **CLI Security**: Keys read from `.env` files (added to `.gitignore`)

### Data Privacy
- **Local Storage**: All task data stored locally
- **AI Provider Privacy**: User data sent to configured AI providers
- **No Telemetry**: No usage tracking or data collection

### Input Validation
- **Configuration Validation**: Validate model/provider combinations
- **Task Data Validation**: Ensure task structure integrity
- **Command Validation**: Validate all CLI inputs

## Deployment Patterns

### Global Installation
```bash
npm install -g task-master-ai
task-master init
```

### Local Project Installation
```bash
npm install task-master-ai
npx task-master init
```

### MCP Server Installation
- **Global Package**: Installed globally for MCP access
- **Per-Project Config**: Each project has own `.taskmasterconfig`
- **Environment Isolation**: API keys per MCP server instance

## Integration Patterns

### AI Coding Assistant Integration
- **MCP Protocol**: Primary integration method for modern AI tools
- **CLI Access**: Direct command execution in terminal
- **Context Sharing**: Rich task context available to AI assistants

### Git Workflow Integration
- **Branch-Tag Mapping**: Tags automatically switch with git branches
- **Commit Context**: Task progress can inform commit messages
- **Feature Development**: Tag-based task organization supports feature branches

### IDE Integration
- **MCP Servers**: Native support in Claude Desktop, Cline, Continue
- **Terminal Integration**: CLI commands available in integrated terminals
- **File Generation**: Task files visible in IDE file explorers
