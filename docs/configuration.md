# Configuration

Taskmaster uses two primary methods for configuration:

1.  **`.taskmaster/config.json` File (Recommended - New Structure)**

    - This JSON file stores most configuration settings, including AI model selections, parameters, logging levels, and project defaults.
    - **Location:** This file is created in the `.taskmaster/` directory when you run the `task-master models --setup` interactive setup or initialize a new project with `task-master init`.
    - **Migration:** Existing projects with `.taskmasterconfig` in the root will continue to work, but should be migrated to the new structure using `task-master migrate`.
    - **Management:** Use the `task-master models --setup` command (or `models` MCP tool) to interactively create and manage this file. You can also set specific models directly using `task-master models --set-<role>=<model_id>`, adding `--ollama` or `--openrouter` flags for custom models. Manual editing is possible but not recommended unless you understand the structure.
    - **Example Structure:**
      ```json
      {
        "models": {
          "main": {
            "provider": "anthropic",
            "modelId": "claude-3-7-sonnet-20250219",
            "maxTokens": 64000,
            "temperature": 0.2,
            "baseURL": "https://api.anthropic.com/v1"
          },
          "research": {
            "provider": "perplexity",
            "modelId": "sonar-pro",
            "maxTokens": 8700,
            "temperature": 0.1,
            "baseURL": "https://api.perplexity.ai/v1"
          },
          "fallback": {
            "provider": "anthropic",
            "modelId": "claude-3-5-sonnet",
            "maxTokens": 64000,
            "temperature": 0.2
          }
        },
        "global": {
          "logLevel": "info",
          "debug": false,
          "defaultNumTasks": 10,
          "defaultSubtasks": 5,
          "defaultPriority": "medium",
          "defaultTag": "master",
          "projectName": "Your Project Name",
          "ollamaBaseURL": "http://localhost:11434/api",
          "azureBaseURL": "https://your-endpoint.azure.com/openai/deployments",
          "vertexProjectId": "your-gcp-project-id",
          "vertexLocation": "us-central1",
	      "responseLanguage": "English"
        }
      }
      ```

> For MCP-specific setup and troubleshooting, see [Provider-Specific Configuration](#provider-specific-configuration).

2.  **Legacy `.taskmasterconfig` File (Backward Compatibility)**

    - For projects that haven't migrated to the new structure yet.
    - **Location:** Project root directory.
    - **Migration:** Use `task-master migrate` to move this to `.taskmaster/config.json`.
    - **Deprecation:** While still supported, you'll see warnings encouraging migration to the new structure.

## MCP Tool Loading Configuration

### TASK_MASTER_TOOLS Environment Variable

The `TASK_MASTER_TOOLS` environment variable controls which tools are loaded by the Task Master MCP server. This allows you to optimize token usage based on your workflow needs.

> Note
> Prefer setting `TASK_MASTER_TOOLS` in your MCP client's `env` block (e.g., `.cursor/mcp.json`) or in CI/deployment env. The `.env` file is reserved for API keys/endpoints; avoid persisting non-secret settings there.

#### Configuration Options

- **`all`** (default): Loads all 36 available tools (~21,000 tokens)
  - Best for: Users who need the complete feature set
  - Use when: Working with complex projects requiring all Task Master features
  - Backward compatibility: This is the default to maintain compatibility with existing installations

- **`standard`**: Loads 15 commonly used tools (~10,000 tokens, 50% reduction)
  - Best for: Regular task management workflows
  - Tools included: All core tools plus project initialization, complexity analysis, task generation, and more
  - Use when: You need a balanced set of features with reduced token usage

- **`core`** (or `lean`): Loads 7 essential tools (~5,000 tokens, 70% reduction)
  - Best for: Daily development with minimal token overhead
  - Tools included: `get_tasks`, `next_task`, `get_task`, `set_task_status`, `update_subtask`, `parse_prd`, `expand_task`
  - Use when: Working in large contexts where token usage is critical
  - Note: "lean" is an alias for "core" (same tools, token estimate and recommended use). You can refer to it as either "core" or "lean" when configuring.

- **Custom list**: Comma-separated list of specific tool names
  - Best for: Specialized workflows requiring specific tools
  - Example: `"get_tasks,next_task,set_task_status"`
  - Use when: You know exactly which tools you need

#### How to Configure

1. **In MCP configuration files** (`.cursor/mcp.json`, `.vscode/mcp.json`, etc.) - **Recommended**:

   ```jsonc
   {
     "mcpServers": {
       "task-master-ai": {
         "env": {
           "TASK_MASTER_TOOLS": "standard",  // Set tool loading mode
           // API keys can still use .env for security
         }
       }
     }
   }
   ```

2. **Via Claude Code CLI**:

   ```bash
   claude mcp add task-master-ai --scope user \
     --env TASK_MASTER_TOOLS="core" \
     -- npx -y task-master-ai@latest
   ```

3. **In CI/deployment environment variables**:
   ```bash
   export TASK_MASTER_TOOLS="standard"
   node mcp-server/server.js
   ```

#### Tool Loading Behavior

- When `TASK_MASTER_TOOLS` is unset or empty, the system defaults to `"all"`
- Invalid tool names in a user-specified list are ignored (a warning is emitted for each)
- If every tool name in a custom list is invalid, the system falls back to `"all"`
- Tool names are case-insensitive (e.g., `"CORE"`, `"core"`, and `"Core"` are treated identically)

## Environment Variables (`.env` file or MCP `env` block - For API Keys Only)

- Used **exclusively** for sensitive API keys and specific endpoint URLs.
- **Location:**
  - For CLI usage: Create a `.env` file in your project root.
  - For MCP/Cursor usage: Configure keys in the `env` section of your `.cursor/mcp.json` file.
- **Required API Keys (Depending on configured providers):**
  - `ANTHROPIC_API_KEY`: Your Anthropic API key.
  - `PERPLEXITY_API_KEY`: Your Perplexity API key.
  - `OPENAI_API_KEY`: Your OpenAI API key.
  - `GOOGLE_API_KEY`: Your Google API key (also used for Vertex AI provider).
  - `MISTRAL_API_KEY`: Your Mistral API key.
  - `AZURE_OPENAI_API_KEY`: Your Azure OpenAI API key (also requires `AZURE_OPENAI_ENDPOINT`).
  - `OPENROUTER_API_KEY`: Your OpenRouter API key.
  - `XAI_API_KEY`: Your X-AI API key.
- **Optional Endpoint Overrides:**
  - **Per-role `baseURL` in `.taskmasterconfig`:** You can add a `baseURL` property to any model role (`main`, `research`, `fallback`) to override the default API endpoint for that provider. If omitted, the provider's standard endpoint is used.
  - **Environment Variable Overrides (`<PROVIDER>_BASE_URL`):** For greater flexibility, especially with third-party services, you can set an environment variable like `OPENAI_BASE_URL` or `MISTRAL_BASE_URL`. This will override any `baseURL` set in the configuration file for that provider. This is the recommended way to connect to OpenAI-compatible APIs.
  - `AZURE_OPENAI_ENDPOINT`: Required if using Azure OpenAI key (can also be set as `baseURL` for the Azure model role).
  - `OLLAMA_BASE_URL`: Override the default Ollama API URL (Default: `http://localhost:11434/api`).
  - `VERTEX_PROJECT_ID`: Your Google Cloud project ID for Vertex AI. Required when using the 'vertex' provider.
  - `VERTEX_LOCATION`: Google Cloud region for Vertex AI (e.g., 'us-central1'). Default is 'us-central1'.
  - `GOOGLE_APPLICATION_CREDENTIALS`: Path to service account credentials JSON file for Google Cloud auth (alternative to API key for Vertex AI).

**Important:** Settings like model ID selections (`main`, `research`, `fallback`), `maxTokens`, `temperature`, `logLevel`, `defaultSubtasks`, `defaultPriority`, and `projectName` are **managed in `.taskmaster/config.json`** (or `.taskmasterconfig` for unmigrated projects), not environment variables.

## Tagged Task Lists Configuration (v0.17+)

Taskmaster includes a tagged task lists system for multi-context task management.

### Global Tag Settings

```json
"global": {
  "defaultTag": "master"
}
```

- **`defaultTag`** (string): Default tag context for new operations (default: "master")

### Git Integration

Task Master provides manual git integration through the `--from-branch` option:

- **Manual Tag Creation**: Use `task-master add-tag --from-branch` to create a tag based on your current git branch name
- **User Control**: No automatic tag switching - you control when and how tags are created
- **Flexible Workflow**: Supports any git workflow without imposing rigid branch-tag mappings

## State Management File

Taskmaster uses `.taskmaster/state.json` to track tagged system runtime information:

```json
{
  "currentTag": "master",
  "lastSwitched": "2025-06-11T20:26:12.598Z",
  "migrationNoticeShown": true
}
```

- **`currentTag`**: Currently active tag context
- **`lastSwitched`**: Timestamp of last tag switch
- **`migrationNoticeShown`**: Whether migration notice has been displayed

This file is automatically created during tagged system migration and should not be manually edited.

## Example `.env` File (for API Keys)

```
# Required API keys for providers configured in .taskmaster/config.json
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
PERPLEXITY_API_KEY=pplx-your-key-here
# OPENAI_API_KEY=sk-your-key-here
# GOOGLE_API_KEY=AIzaSy...
# AZURE_OPENAI_API_KEY=your-azure-openai-api-key-here
# etc.

# Optional Endpoint Overrides
# Use a specific provider's base URL, e.g., for an OpenAI-compatible API
# OPENAI_BASE_URL=https://api.third-party.com/v1
#
# Azure OpenAI Configuration
# AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/ or https://your-endpoint-name.cognitiveservices.azure.com/openai/deployments
# OLLAMA_BASE_URL=http://custom-ollama-host:11434/api

# Google Vertex AI Configuration (Required if using 'vertex' provider)
# VERTEX_PROJECT_ID=your-gcp-project-id
```

## Troubleshooting

### Configuration Errors

- If Task Master reports errors about missing configuration or cannot find the config file, run `task-master models --setup` in your project root to create or repair the file.
- For new projects, config will be created at `.taskmaster/config.json`. For legacy projects, you may want to use `task-master migrate` to move to the new structure.
- Ensure API keys are correctly placed in your `.env` file (for CLI) or `.cursor/mcp.json` (for MCP) and are valid for the providers selected in your config file.

### If `task-master init` doesn't respond:

Try running it with Node directly:

```bash
node node_modules/claude-task-master/scripts/init.js
```

Or clone the repository and run:

```bash
git clone https://github.com/eyaltoledano/claude-task-master.git
cd claude-task-master
node scripts/init.js
```

## Provider-Specific Configuration

### MCP (Model Context Protocol) Provider

1. **Prerequisites**:
   - An active MCP session with sampling capability
   - MCP client with sampling support (e.g. VS Code)
   - No API keys required (uses session-based authentication)

2. **Configuration**:
   ```json
   {
     "models": {
       "main": {
         "provider": "mcp",
         "modelId": "mcp-sampling"
       },
       "research": {
         "provider": "mcp",
         "modelId": "mcp-sampling"
       }
     }
   }
   ```

3. **Available Model IDs**:
   - `mcp-sampling` - General text generation using MCP client sampling (supports all roles)
   - `claude-3-5-sonnet-20241022` - High-performance model for general tasks (supports all roles)
   - `claude-3-opus-20240229` - Enhanced reasoning model for complex tasks (supports all roles)

4. **Features**:
   - ✅ **Text Generation**: Standard AI text generation via MCP sampling
   - ✅ **Object Generation**: Full schema-driven structured output generation
   - ✅ **PRD Parsing**: Parse Product Requirements Documents into structured tasks
   - ✅ **Task Creation**: AI-powered task creation with validation
   - ✅ **Session Management**: Automatic session detection and context handling
   - ✅ **Error Recovery**: Robust error handling and fallback mechanisms

5. **Usage Requirements**:
   - Must be running in an MCP context (session must be available)
   - Session must provide `clientCapabilities.sampling` capability

6. **Best Practices**:
   - Always configure a non-MCP fallback provider
   - Use `mcp` for main/research roles when in MCP environments
   - Test sampling capability before production use

7. **Setup Commands**:
   ```bash
   # Set MCP provider for main role
   task-master models set-main --provider mcp --model claude-3-5-sonnet-20241022

   # Set MCP provider for research role
   task-master models set-research --provider mcp --model claude-3-opus-20240229

   # Verify configuration
   task-master models list
   ```

8. **Troubleshooting**:
   - "MCP provider requires session context" → Ensure running in MCP environment
   - See the [MCP Provider Guide](./mcp-provider-guide.md) for detailed troubleshooting

### MCP Timeout Configuration

Long-running AI operations in taskmaster-ai can exceed the default 60-second MCP timeout. Operations like `parse_prd`, `expand_task`, `research`, and `analyze_project_complexity` may take 2-5 minutes to complete.

#### Adding Timeout Configuration

Add a `timeout` parameter to your MCP configuration to extend the timeout limit. The timeout configuration works identically across MCP clients including Cursor, Windsurf, and RooCode:

```json
{
  "mcpServers": {
    "task-master-ai": {
      "command": "npx",
      "args": ["-y", "--package=task-master-ai", "task-master-ai"],
      "timeout": 300,
      "env": {
        "ANTHROPIC_API_KEY": "your-anthropic-api-key"
      }
    }
  }
}
```

**Configuration Details:**
- **`timeout: 300`** - Sets timeout to 300 seconds (5 minutes)
- **Value range**: 1-3600 seconds (1 second to 1 hour)
- **Recommended**: 300 seconds provides sufficient time for most AI operations
- **Format**: Integer value in seconds (not milliseconds)

#### Automatic Setup

When adding taskmaster rules for supported editors, the timeout configuration is automatically included:

```bash
# Automatically includes timeout configuration
task-master rules add cursor
task-master rules add roo
task-master rules add windsurf
task-master rules add vscode
```

#### Troubleshooting Timeouts

If you're still experiencing timeout errors:

1. **Verify configuration**: Check that `timeout: 300` is present in your MCP config
2. **Restart editor**: Restart your editor after making configuration changes
3. **Increase timeout**: For very complex operations, try `timeout: 600` (10 minutes)
4. **Check API keys**: Ensure required API keys are properly configured

**Expected behavior:**
- **Before fix**: Operations fail after 60 seconds with `MCP request timed out after 60000ms`
- **After fix**: Operations complete successfully within the configured timeout limit

### Google Vertex AI Configuration

Google Vertex AI is Google Cloud's enterprise AI platform and requires specific configuration:

1. **Prerequisites**:
   - A Google Cloud account with Vertex AI API enabled
   - Either a Google API key with Vertex AI permissions OR a service account with appropriate roles
   - A Google Cloud project ID
2. **Authentication Options**:
   - **API Key**: Set the `GOOGLE_API_KEY` environment variable
   - **Service Account**: Set `GOOGLE_APPLICATION_CREDENTIALS` to point to your service account JSON file
3. **Required Configuration**:
   - Set `VERTEX_PROJECT_ID` to your Google Cloud project ID
   - Set `VERTEX_LOCATION` to your preferred Google Cloud region (default: us-central1)
4. **Example Setup**:

   ```bash
   # In .env file
   GOOGLE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX
   VERTEX_PROJECT_ID=my-gcp-project-123
   VERTEX_LOCATION=us-central1
   ```

   Or using service account:

   ```bash
   # In .env file
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
   VERTEX_PROJECT_ID=my-gcp-project-123
   VERTEX_LOCATION=us-central1
   ```

5. **In .taskmaster/config.json**:
   ```json
   "global": {
     "vertexProjectId": "my-gcp-project-123",
     "vertexLocation": "us-central1"
   }
   ```

### Azure OpenAI Configuration

Azure OpenAI provides enterprise-grade OpenAI models through Microsoft's Azure cloud platform and requires specific configuration:

1. **Prerequisites**:
   - An Azure account with an active subscription
   - Azure OpenAI service resource created in the Azure portal
   - Azure OpenAI API key and endpoint URL
   - Deployed models (e.g., gpt-4o, gpt-4o-mini, gpt-4.1, etc) in your Azure OpenAI resource

2. **Authentication**:
   - Set the `AZURE_OPENAI_API_KEY` environment variable with your Azure OpenAI API key
   - Configure the endpoint URL using one of the methods below

3. **Configuration Options**:

   **Option 1: Using Global Azure Base URL (affects all Azure models)**
   ```json
   // In .taskmaster/config.json
   {
     "models": {
       "main": {
         "provider": "azure",
         "modelId": "gpt-4o",
         "maxTokens": 16000,
         "temperature": 0.7
       },
       "fallback": {
         "provider": "azure",
         "modelId": "gpt-4o-mini",
         "maxTokens": 10000,
         "temperature": 0.7
       }
     },
     "global": {
       "azureBaseURL": "https://your-resource-name.azure.com/openai/deployments"
     }
   }
   ```

   **Option 2: Using Per-Model Base URLs (recommended for flexibility)**
   ```json
   // In .taskmaster/config.json
   {
     "models": {
       "main": {
         "provider": "azure",
         "modelId": "gpt-4o",
         "maxTokens": 16000,
         "temperature": 0.7,
         "baseURL": "https://your-resource-name.azure.com/openai/deployments"
       },
       "research": {
         "provider": "perplexity",
         "modelId": "sonar-pro",
         "maxTokens": 8700,
         "temperature": 0.1
       },
       "fallback": {
         "provider": "azure",
         "modelId": "gpt-4o-mini",
         "maxTokens": 10000,
         "temperature": 0.7,
         "baseURL": "https://your-resource-name.azure.com/openai/deployments"
       }
     }
   }
   ```

4. **Environment Variables**:
   ```bash
   # In .env file
   AZURE_OPENAI_API_KEY=your-azure-openai-api-key-here

   # Optional: Override endpoint for all Azure models
   AZURE_OPENAI_ENDPOINT=https://your-resource-name.azure.com/openai/deployments
   ```

5. **Important Notes**:
   - **Model Deployment Names**: The `modelId` in your configuration should match the **deployment name** you created in Azure OpenAI Studio, not the underlying model name
   - **Base URL Priority**: Per-model `baseURL` settings override the global `azureBaseURL` setting
   - **Endpoint Format**: When using per-model `baseURL`, use the full path including `/openai/deployments`

6. **Troubleshooting**:

   **"Resource not found" errors:**
   - Ensure your `baseURL` includes the full path: `https://your-resource-name.openai.azure.com/openai/deployments`
   - Verify that your deployment name in `modelId` exactly matches what's configured in Azure OpenAI Studio
   - Check that your Azure OpenAI resource is in the correct region and properly deployed

   **Authentication errors:**
   - Verify your `AZURE_OPENAI_API_KEY` is correct and has not expired
   - Ensure your Azure OpenAI resource has the necessary permissions
   - Check that your subscription has not been suspended or reached quota limits

   **Model availability errors:**
   - Confirm the model is deployed in your Azure OpenAI resource
   - Verify the deployment name matches your configuration exactly (case-sensitive)
   - Ensure the model deployment is in a "Succeeded" state in Azure OpenAI Studio
   - Ensure youre not getting rate limited by `maxTokens` maintain appropriate Tokens per Minute Rate Limit (TPM) in your deployment.

### Codex CLI Provider

The Codex CLI provider integrates Task Master with OpenAI's Codex CLI, allowing you to use ChatGPT subscription models via OAuth authentication.

1. **Prerequisites**:
   - Node.js >= 18
   - Codex CLI >= 0.42.0 (>= 0.44.0 recommended)
   - ChatGPT subscription: Plus, Pro, Business, Edu, or Enterprise (for OAuth access to GPT-5 models)

2. **Installation**:
   ```bash
   npm install -g @openai/codex
   ```

3. **Authentication** (OAuth - Primary Method):
   ```bash
   codex login
   ```
   This will open a browser window for OAuth authentication with your ChatGPT account. Once authenticated, Task Master will automatically use these credentials.

4. **Optional API Key Method**:
   While OAuth is the primary and recommended authentication method, you can optionally set an OpenAI API key:
   ```bash
   # In .env file
   OPENAI_API_KEY=sk-your-openai-api-key-here
   ```
   **Note**: The API key will only be injected if explicitly provided. OAuth is always preferred.

5. **Configuration**:
   ```json
   // In .taskmaster/config.json
   {
     "models": {
       "main": {
         "provider": "codex-cli",
         "modelId": "gpt-5-codex",
         "maxTokens": 128000,
         "temperature": 0.2
       },
       "fallback": {
         "provider": "codex-cli",
         "modelId": "gpt-5",
         "maxTokens": 128000,
         "temperature": 0.2
       }
     },
     "codexCli": {
       "allowNpx": true,
       "skipGitRepoCheck": true,
       "approvalMode": "on-failure",
       "sandboxMode": "workspace-write"
     }
   }
   ```

6. **Available Models**:
   - `gpt-5` - Latest GPT-5 model (272K max input, 128K max output)
   - `gpt-5-codex` - GPT-5 optimized for agentic software engineering (272K max input, 128K max output)

7. **Codex CLI Settings (`codexCli` section)**:

   The `codexCli` section in your configuration file supports the following options:

   - **`allowNpx`** (boolean, default: `false`): Allow fallback to `npx @openai/codex` if CLI not found on PATH
   - **`skipGitRepoCheck`** (boolean, default: `false`): Skip git repository safety check (recommended for CI/non-repo usage)
   - **`approvalMode`** (string): Control command execution approval
     - `"untrusted"`: Require approval for all commands
     - `"on-failure"`: Only require approval after a command fails (default)
     - `"on-request"`: Approve only when explicitly requested
     - `"never"`: Never require approval (not recommended)
   - **`sandboxMode`** (string): Control filesystem access
     - `"read-only"`: Read-only access
     - `"workspace-write"`: Allow writes to workspace (default)
     - `"danger-full-access"`: Full filesystem access (use with caution)
   - **`codexPath`** (string, optional): Custom path to codex CLI executable
   - **`cwd`** (string, optional): Working directory for Codex CLI execution
   - **`fullAuto`** (boolean, optional): Fully automatic mode (equivalent to `--full-auto` flag)
   - **`dangerouslyBypassApprovalsAndSandbox`** (boolean, optional): Bypass all safety checks (dangerous!)
   - **`color`** (string, optional): Color handling - `"always"`, `"never"`, or `"auto"`
   - **`outputLastMessageFile`** (string, optional): Write last agent message to specified file
   - **`verbose`** (boolean, optional): Enable verbose logging
   - **`env`** (object, optional): Additional environment variables for Codex CLI

8. **Command-Specific Settings** (optional):
   You can override settings for specific Task Master commands:
   ```json
   {
     "codexCli": {
       "allowNpx": true,
       "approvalMode": "on-failure",
       "commandSpecific": {
         "parse-prd": {
           "approvalMode": "never",
           "verbose": true
         },
         "expand": {
           "sandboxMode": "read-only"
         }
       }
     }
   }
   ```

9. **Codebase Features**:
   The Codex CLI provider is codebase-capable, meaning it can analyze and interact with your project files. Codebase analysis features are automatically enabled when using `codex-cli` as your provider and `enableCodebaseAnalysis` is set to `true` in your global configuration (default).

10. **Setup Commands**:
    ```bash
    # Set Codex CLI for main role
    task-master models --set-main gpt-5-codex --codex-cli

    # Set Codex CLI for fallback role
    task-master models --set-fallback gpt-5 --codex-cli

    # Verify configuration
    task-master models
    ```

11. **Troubleshooting**:

    **"codex: command not found" error:**
    - Install Codex CLI globally: `npm install -g @openai/codex`
    - Verify installation: `codex --version`
    - Alternatively, enable `allowNpx: true` in your codexCli configuration

    **"Not logged in" errors:**
    - Run `codex login` to authenticate with your ChatGPT account
    - Verify authentication status: `codex` (opens interactive CLI)

    **"Old version" warnings:**
    - Check version: `codex --version`
    - Upgrade: `npm install -g @openai/codex@latest`
    - Minimum version: 0.42.0, recommended: >= 0.44.0

    **"Model not available" errors:**
    - Only `gpt-5` and `gpt-5-codex` are available via OAuth subscription
    - Verify your ChatGPT subscription is active
    - For other OpenAI models, use the standard `openai` provider with an API key

    **API key not being used:**
    - API key is only injected when explicitly provided
    - OAuth authentication is always preferred
    - If you want to use an API key, ensure `OPENAI_API_KEY` is set in your `.env` file

12. **Important Notes**:
    - OAuth subscription required for model access (no API key needed for basic operation)
    - Limited to OAuth-available models only (`gpt-5` and `gpt-5-codex`)
    - Pricing information is not available for OAuth models (shows as "Unknown" in cost calculations)
    - See [Codex CLI Provider Documentation](./providers/codex-cli.md) for more details
