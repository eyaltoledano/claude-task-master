# TODO: Move to apps/docs inside our documentation website

# Snowflake Provider Integration Guide

This guide covers how to use Task Master with Snowflake's Cortex AI models for AI-powered development workflows. The unified Snowflake provider supports both **REST API** and **Cortex Code CLI** backends.

## Overview

The Snowflake provider (`snowflake`) enables Task Master to leverage Snowflake's Cortex AI models with multiple authentication and execution options. All models use the standardized `cortex/<modelId>` naming convention.

**Key Benefits:**
- 🔒 Multiple authentication methods: key pair, connection profiles, direct tokens
- 🔄 Automatic backend selection: REST API (default) or Cortex Code CLI
- 🎯 Planning mode for read-only analysis (CLI mode)
- 🛠️ Custom skills support (CLI mode)
- 🔌 Built-in Model Context Protocol (MCP) support (CLI mode)
- ⚡ All Snowflake Cortex models available
- 💰 Use existing Snowflake credits - no additional AI subscriptions

**Execution Modes:**
- **REST API** (default): Direct API calls using key pair or token authentication
- **Cortex Code CLI**: Uses the `cortex` CLI tool for enhanced features
- **Auto**: Automatically selects REST if credentials are available, otherwise CLI

## Prerequisites

### For REST API (Default)

1. **Snowflake Account** with Cortex enabled
2. **Authentication credentials** (one of the following):
   - Key pair authentication (RSA private key)
   - OAuth/PAT token
   - Connection profile with credentials

### For Cortex Code CLI (Optional)

1. **Request Access**: Contact your Snowflake Account Executive for Cortex Code CLI access (private preview)

2. **Install Cortex Code CLI**: Follow Snowflake's installation instructions:

```bash
cortex --version
# Should display version number
```

Add to PATH if needed:
```bash
export PATH="$PATH:/path/to/cortex"
```

## Authentication Setup

The Snowflake provider supports multiple authentication methods in order of priority:

### Method 1: Environment Variables (Recommended for REST API)

The simplest approach for REST API is using environment variables:

```bash
# Required for key pair authentication
export SNOWFLAKE_ACCOUNT="your-account"       # e.g., "xyz12345" or "org-account"
export SNOWFLAKE_USER="your.name@company.com"
export SNOWFLAKE_PRIVATE_KEY_PATH="/path/to/rsa_key.p8"

# Optional: for encrypted private keys
export SNOWFLAKE_PRIVATE_KEY_PASSPHRASE="your-passphrase"
# Aliases also supported: SNOWFLAKE_PRIVATE_KEY_FILE_PWD, SNOWSQL_PRIVATE_KEY_PASSPHRASE, PRIVATE_KEY_PASSPHRASE

# Optional: specify role
export SNOWFLAKE_ROLE="YOUR_ROLE"
```

**Or** use direct token authentication:

```bash
export SNOWFLAKE_API_KEY="your-oauth-or-pat-token"
export SNOWFLAKE_ACCOUNT="your-account"  # URL derived automatically

# Optional: explicit base URL (only needed if account name differs from URL)
# export SNOWFLAKE_BASE_URL="https://your-account.snowflakecomputing.com"
```

### Method 2: Connection Profile (Recommended for CLI mode)

Create `~/.snowflake/connections.toml`:

```toml
[default]
account = "YOUR_ACCOUNT"
user = "YOUR_USERNAME"
private_key_path = "/path/to/rsa_key.p8"
private_key_passphrase = "optional-passphrase"
role = "YOUR_ROLE"
warehouse = "YOUR_WAREHOUSE"
```

Or use `~/.snowflake/config.toml` (legacy format):

```toml
[connections.default]
account = "YOUR_ACCOUNT"
user = "YOUR_USERNAME"
password = "YOUR_PAT"        # Personal Access Token
warehouse = "YOUR_WAREHOUSE"
role = "YOUR_ROLE"
```

### Generate RSA Key Pair (for Key Pair Auth)

```bash
# Generate private key (with passphrase)
openssl genrsa 2048 | openssl pkcs8 -topk8 -v2 des3 -inform PEM -out rsa_key.p8

# Generate public key
openssl rsa -in rsa_key.p8 -pubout -out rsa_key.pub

# Configure in Snowflake
ALTER USER YOUR_USER SET RSA_PUBLIC_KEY='<public_key_content>';
```

### Secure Your Configuration

Set appropriate file permissions:

```bash
chmod 600 ~/.snowflake/connections.toml
chmod 600 ~/.snowflake/config.toml
chmod 600 /path/to/rsa_key.p8
```

### Multiple Connections

Configure multiple connections for different environments:

```toml
[default]
account = "prod_account"
user = "prod_user"
private_key_path = "/path/to/prod_key.p8"

[dev]
account = "dev_account"
user = "dev_user"
private_key_path = "/path/to/dev_key.p8"
```

Then specify which to use in Task Master configuration.

## Configuration

### Basic Configuration

Configure Task Master to use Cortex Code:

```bash
task-master models --setup
# Select "cortex-code" as provider
# Select your preferred model
```

This creates/updates `.taskmaster/config.json`:

```json
{
  "models": {
    "main": { "provider": "cortex-code", "modelId": "claude-hai3-5-haiku-20241022" },
    "research": { "provider": "cortex-code", "modelId": "claude-3-5-sonnet-20241022" },
    "fallback": { "provider": "anthropic", "modelId": "claude-3-5-sonnet-20241022" }
  }
}
```

### Advanced Configuration

Add optional Cortex Code settings:

```json
{
  "models": {
    "main": { "provider": "cortex-code", "modelId": "claude-3-5-haiku-20241022" },
    "research": { "provider": "cortex-code", "modelId": "claude-3-5-sonnet-20241022" },
    "fallback": { "provider": "anthropic", "modelId": "claude-3-5-sonnet-20241022" }
  },
  "cortexCode": {
    "connection": "default",           // Snowflake connection name
    "timeout": 60000,                  // Request timeout in milliseconds
    "retries": 3,                      // Max retry attempts
    "enablePlanningMode": false,       // Read-only planning mode
    "enableSkills": true,              // Enable custom skills
    "disableMcp": false                // Disable MCP servers
  }
}
```

### Per-Command Settings

Override settings for specific commands:

```json
{
  "commands": {
    "next": {
      "cortexCode": {
        "enablePlanningMode": true    // Analyze without modifying
      }
    },
    "expand": {
      "cortexCode": {
        "timeout": 120000              // Longer timeout for complex expansions
      }
    }
  }
}
```

## Supported Models

All Snowflake Cortex models are supported via the [Cortex REST API](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api). Choose based on your use case:

### Claude Models (Anthropic) - Recommended

| Model | Best For | Structured Output | Context | Prompt Caching |
|-------|----------|-------------------|---------|----------------|
| **`claude-3-5-sonnet-20241022`** | Complex reasoning, code generation, analysis | ✅ | 200K | ✅ |
| **`claude-3-5-haiku-20241022`** | Fast responses, simple tasks, high volume | ✅ | 200K | ✅ |
| `claude-3-opus-20240229` | Most capable, complex tasks | ✅ | 200K | ✅ |
| `claude-3-sonnet-20240229` | Balanced performance and speed | ✅ | 200K | ✅ |
| `claude-3-haiku-20240307` | Fastest responses, cost-effective | ✅ | 200K | ✅ |

### OpenAI Models

| Model | Best For | Structured Output | Context | Prompt Caching |
|-------|----------|-------------------|---------|----------------|
| `gpt-4o` | Latest GPT-4, multimodal | ✅ | 128K | ✅ |
| `gpt-4-turbo` | Fast GPT-4, JSON mode | ✅ | 128K | ✅ |
| `gpt-4` | Complex reasoning | ✅ | 8K | ✅ |
| `gpt-3.5-turbo` | Fast, cost-effective | ⚠️ | 16K | ✅ |

### Meta Llama Models

| Model | Best For | Structured Output | Context | Prompt Caching |
|-------|----------|-------------------|---------|----------------|
| `llama3.1-405b` | Most capable open model | ⚠️ | 128K | ❌ |
| `llama3.1-70b` | Strong performance, open source | ⚠️ | 128K | ❌ |
| `llama3.1-8b` | Fast, lightweight | ❌ | 128K | ❌ |
| `llama3-70b` | General purpose tasks | ❌ | 8K | ❌ |
| `llama3-8b` | Very fast, low cost | ❌ | 8K | ❌ |

### Mistral Models

| Model | Best For | Structured Output | Context | Prompt Caching |
|-------|----------|-------------------|---------|----------------|
| `mistral-large2` | Multilingual, complex reasoning | ⚠️ | 128K | ❌ |
| `mistral-large` | Multilingual support | ⚠️ | 128K | ❌ |
| `mixtral-8x7b` | Mixture of experts, efficient | ❌ | 32K | ❌ |
| `mistral-7b` | Fast, lightweight | ❌ | 32K | ❌ |

### Google Gemini Models

| Model | Best For | Structured Output | Context | Prompt Caching |
|-------|----------|-------------------|---------|----------------|
| `gemini-1.5-pro` | Multimodal, long context | ⚠️ | 1M | ❌ |
| `gemini-1.5-flash` | Fast multimodal responses | ⚠️ | 1M | ❌ |

### Other Models

| Model | Best For | Structured Output | Context | Prompt Caching |
|-------|----------|-------------------|---------|----------------|
| `reka-flash` | Fast multilingual | ❌ | 128K | ❌ |
| `reka-core` | Balanced performance | ❌ | 128K | ❌ |

**Legend:**
- ✅ **Full support** - Reliable structured outputs with schema enforcement
- ⚠️ **Limited support** - JSON mode available but may require prompt engineering
- ❌ **Not supported** - No structured output support

**Recommendation**: Use **Claude 3.5 models** (`claude-3-5-sonnet-20241022` or `claude-3-5-haiku-20241022`) for best results with Task Master, especially for structured outputs, code generation, and prompt caching benefits.

### Model Selection by Use Case

**For Task Generation & Expansion:**
- Primary: `claude-3-5-sonnet-20241022` (best reasoning and code generation)
- Budget: `claude-3-5-haiku-20241022` (faster, lower cost)
- Alternative: `gpt-4o` (multimodal capabilities)

**For Research Operations:**
- Recommended: `claude-3-5-sonnet-20241022` (thorough analysis)
- Alternative: `claude-3-opus-20240229` (most capable)

**For Quick Status Updates:**
- Recommended: `claude-3-5-haiku-20241022` (speed optimized)
- Budget: `gpt-3.5-turbo` (very fast, lower cost)

**For Multilingual Tasks:**
- Primary: `mistral-large2` (strong multilingual support)
- Alternative: `gemini-1.5-pro` (long context + multilingual)

**For High-Volume Operations:**
- Recommended: `claude-3-5-haiku-20241022` with prompt caching
- Budget: `llama3.1-8b` (open source, fast)

## Usage Examples

### Basic Task Operations

```bash
# Add a task with AI assistance
task-master add-task --prompt="Implement user authentication system" --research

# Expand a task into subtasks
task-master expand --id=1 --research

# Update a specific task with new context
task-master update-task --id=1.1 --prompt="Add JWT token validation"

# Get next available task
task-master next
```

### Model Configuration Commands

```bash
# Set Cortex Code as main model
task-master models --set-main claude-3-5-sonnet-20241022

# Set Cortex Code as research model
task-master models --set-research claude-3-5-haiku-20241022

# Interactive setup
task-master models --setup
# Then select "cortex-code" from the provider list
```

### Using Different Connections

```bash
# Default connection (from config)
task-master next

# Override connection for specific command
# (requires manual config edit to set connection name)
```

## Advanced Features

### Planning Mode

Enable **read-only planning** mode to analyze tasks without modifying them:

```json
{
  "cortexCode": {
    "enablePlanningMode": true
  }
}
```

**Use cases:**
- Analyze task structure before making changes
- Preview AI suggestions without committing
- Safe experimentation with task planning

**Behavior:**
- AI analyzes and suggests changes
- No modifications are written to `tasks.json`
- Results displayed for review only

### Custom Skills

Leverage Cortex Code's **skills** system for specialized operations:

```json
{
  "cortexCode": {
    "enableSkills": true,
    "skillsFile": "./skills.json"
  }
}
```

Skills enable:
- Domain-specific operations
- Custom code analysis patterns
- Specialized task processing

Refer to [Snowflake Cortex Code documentation](https://docs.snowflake.com/en/developer-guide/cortex-cli) for skill definition format.

### Model Context Protocol (MCP)

Built-in **MCP server support** is enabled by default, providing:
- Enhanced context awareness
- Tool integration
- Extended capabilities

Disable if needed:

```json
{
  "cortexCode": {
    "disableMcp": true
  }
}
```

### Claude-Specific Features

The Snowflake provider uses the **OpenAI SDK-compatible endpoint** (`/api/v2/cortex/v1/chat/completions`) which supports OpenRouter-compatible features for Claude models.

See: [Snowflake OpenAI SDK Compatibility](https://docs.snowflake.com/en/user-guide/snowflake-cortex/open_ai_sdk)

**1. Prompt Caching** ✅ **Available**

Enable prompt caching for Claude models to reduce costs when using repeated system prompts:

```json
{
  "snowflake": {
    "enablePromptCaching": true
  }
}
```

When enabled, system messages are automatically marked with `cache_control: { type: "ephemeral" }`, which tells Claude to cache the system prompt content.

Benefits:
- Cache writes: 1.25x input cost (one-time)
- Cache reads: 0.1x input cost (subsequent requests)
- Ideal for repeated system instructions across requests

Note: Only Claude models support explicit `cache_control` for prompt caching. OpenAI models support implicit caching automatically.

**2. Reasoning Tokens** (Claude Models)

Enable extended thinking for Claude models with reasoning tokens:

```json
{
  "snowflake": {
    "reasoning": "medium"
  }
}
```

**Effort levels:**
- `"low"` - Minimal reasoning, faster responses
- `"medium"` - Balanced thinking time (recommended)
- `"high"` - Extended reasoning for complex problems

When enabled, the API response includes reasoning details in OpenRouter format.

**3. Extended Usage Information**

When using Claude models with caching or reasoning, the usage response includes extended details:

```typescript
// Response usage object
{
  inputTokens: 1500,
  outputTokens: 500,
  totalTokens: 2000,
  cachedInputTokens: 1200,  // Tokens read from cache (when prompt caching is available)
  reasoningTokens: 150       // Tokens used for reasoning (when reasoning is enabled)
}
```

### Performance Optimization

**2. Connection Reuse**
- CLI availability checks are cached (1-hour TTL)
- Reduces overhead for repeated operations

**3. Schema Caching**
- Repeated schemas cached automatically
- Improves performance for structured outputs

**4. Timeout Configuration**
- Set appropriate timeouts for your operations:
  ```json
  {
    "cortexCode": {
      "timeout": 120000  // 2 minutes for complex operations
    }
  }
  ```

**5. Retry Logic**
- Enable retries for reliability:
  ```json
  {
    "cortexCode": {
      "retries": 3  // Retry up to 3 times on failure
    }
  }
  ```

## Integration with AI SDK

Task Master's Snowflake integration uses the unified `@tm/ai-sdk-provider-snowflake` package, providing full compatibility with Vercel AI SDK.

### Features

- ✅ **Unified Provider**: Single package for both REST API and CLI backends
- ✅ **Full AI SDK Compatibility**: Works with `generateText` and other AI SDK functions
- ✅ **Type Safety**: Complete TypeScript support with proper type definitions
- ✅ **Multiple Auth Methods**: Key pair, connection profiles, direct token
- ✅ **Auto-Detection**: Automatically selects CLI or REST based on availability
- ✅ **Token Caching**: Persistent credential caching using Snowflake's credential manager
- ✅ **Retry Logic**: Built-in retry mechanism for reliability

### Credential Caching

The provider uses Snowflake's built-in credential manager for persistent token caching:

- **Shared with other Snowflake tools**: Uses the same cache as Snowflake CLI, drivers, etc.
- **Platform-specific secure storage**:
  - macOS: `~/Library/Caches/Snowflake/credential_cache_v1.json`
  - Linux: `~/.cache/snowflake/credential_cache_v1.json`
  - Windows: `%LOCALAPPDATA%\Snowflake\Caches\credential_cache_v1.json`
- **Automatic TTL expiry**: Tokens are refreshed before expiry
- **File locking**: Safe for concurrent access from multiple processes

See: [Snowflake Credential Manager](https://github.com/snowflakedb/snowflake-connector-nodejs/blob/master/lib/authentication/secure_storage/json_credential_manager.js)

### Direct SDK Usage

```typescript
import { generateText } from 'ai';
import { createSnowflake, snowflake } from '@tm/ai-sdk-provider-snowflake';

// Use default provider (auto-detects best backend)
const model = snowflake('cortex/claude-sonnet-4-5');

// Or create a custom provider
const provider = createSnowflake({
  connection: 'default',
  executionMode: 'auto' // 'auto' | 'rest' | 'cli'
});
const customModel = provider('cortex/claude-sonnet-4-5');

// Generate text
const result = await generateText({
  model,
  prompt: 'Explain Snowflake in one sentence'
});

console.log(result.text);
```

### Custom Configuration in SDK

```typescript
import { createSnowflake } from '@tm/ai-sdk-provider-snowflake';

// Force CLI mode
const cliProvider = createSnowflake({
  executionMode: 'cli',
  connection: 'production',
  timeout: 120000,
  maxRetries: 3
});

// Force REST API mode
const restProvider = createSnowflake({
  executionMode: 'rest',
  connection: 'production',
  // Or use direct authentication
  apiKey: 'your-oauth-token',
  baseURL: 'https://your-account.snowflakecomputing.com'
});

// With CLI-specific options
const model = cliProvider('cortex/llama3.1-70b', {
  plan: true,              // Enable planning mode
  noMcp: false,            // Enable MCP
  skillsFile: './skills.json'
});
```

### Error Handling

```typescript
import {
  isAuthenticationError,
  isConnectionError,
  isTimeoutError,
  isInstallationError
} from '@tm/ai-sdk-provider-snowflake';

try {
  const result = await generateText({ model, prompt: '...' });
} catch (error) {
  if (isAuthenticationError(error)) {
    console.error('Authentication failed - check credentials');
  } else if (isTimeoutError(error)) {
    console.error('Request timed out - try increasing timeout');
  } else if (isConnectionError(error)) {
    console.error('Connection not found - verify connections.toml');
  } else if (isInstallationError(error)) {
    console.error('Cortex CLI not installed - install first');
  }
}
```

## Troubleshooting

### Common Issues

#### 1. "Cortex Code CLI not found" Error

**Problem**: Task Master cannot find the `cortex` command.

**Solutions**:

1. Verify installation:
   ```bash
   cortex --version
   ```

2. Add to PATH if needed:
   ```bash
   export PATH="$PATH:/path/to/cortex"
   # Add to ~/.bashrc or ~/.zshrc for persistence
   ```

3. Restart your terminal after PATH changes

#### 2. Authentication Failed

**Problem**: `Authentication failed` or `Invalid credentials` errors.

**Solutions**:

1. Verify connection config exists:
   ```bash
   cat ~/.snowflake/config.toml
   ```

2. Test connection:
   ```bash
   cortex connection list
   ```

3. Check file permissions:
   ```bash
   chmod 600 ~/.snowflake/config.toml
   ```

4. Regenerate Personal Access Token:
   - Log into Snowflake web console
   - Settings → Security → Generate new PAT
   - Update `config.toml` with new token

5. Verify account details match your Snowflake account

#### 3. Connection Not Found

**Problem**: `Connection 'name' not found` error.

**Solutions**:

1. List available connections:
   ```bash
   cortex connection list
   ```

2. Check connection name in config matches:
   ```json
   {
     "cortexCode": {
       "connection": "default"  // Must match config.toml
     }
   }
   ```

3. Verify `config.toml` has the connection:
   ```bash
   grep -A 5 "\[connections.default\]" ~/.snowflake/config.toml
   ```

#### 4. Timeout Errors

**Problem**: `Operation timed out` errors during AI operations.

**Solutions**:

1. Increase timeout in configuration:
   ```json
   {
     "cortexCode": {
       "timeout": 120000  // 2 minutes
     }
   }
   ```

2. Check network connectivity:
   ```bash
   ping your-account.snowflakecomputing.com
   ```

3. Verify warehouse is running:
   ```bash
   cortex warehouse list
   ```

4. Try a lighter model first (e.g., `claude-3-5-haiku-20241022`)

#### 5. Model Not Available

**Problem**: `Model not available` or `not authorized` errors.

**Solutions**:

1. Verify model name is correct:
   ```bash
   cortex model list
   ```

2. Check role permissions in Snowflake:
   - Must have access to Cortex AI services
   - Verify role in `config.toml` has permissions

3. Try alternative model from supported list

4. Contact your Snowflake administrator for access

#### 6. Structured Output Issues

**Problem**: Structured outputs not working correctly.

**Solutions**:

1. Use Claude 3.5 models for reliable structured output:
   ```json
   {
     "models": {
       "main": {
         "provider": "cortex-code",
         "modelId": "claude-3-5-sonnet-20241022"
       }
     }
   }
   ```

2. Other models (Llama, Mistral) have limited structured output support

3. Verify your schema is valid JSON Schema format

### Debug Steps

**1. Test Cortex CLI directly:**

```bash
cortex --help
# Should show help without errors
```

**2. Test connection:**

```bash
cortex connection list
# Should list your connection(s)
```

**3. Test warehouse access:**

```bash
cortex warehouse list
# Should show available warehouses
```

**4. Test Task Master integration:**

```bash
task-master models --test claude-3-5-sonnet-20241022
# Should successfully connect and test the model
```

**5. Check logs:**
- Task Master logs show detailed error messages
- Use `--verbose` flag for more details
- Check `.taskmaster/logs/` directory

### Environment-Specific Configuration

#### Docker/Containers

When running in Docker:

1. **Install Cortex CLI** in your container:
   ```dockerfile
   # Add installation commands for your base image
   RUN curl -o /usr/local/bin/cortex https://...
   RUN chmod +x /usr/local/bin/cortex
   ```

2. **Mount configuration** as volume:
   ```yaml
   volumes:
     - ~/.snowflake:/root/.snowflake:ro  # Read-only mount
   ```

3. **Or use environment variables** to generate config at runtime

#### CI/CD Pipelines

For automated environments:

1. **Store credentials securely** (GitHub Secrets, etc.)

2. **Generate config file** at runtime:
   ```bash
   mkdir -p ~/.snowflake
   echo "[connections.default]" > ~/.snowflake/config.toml
   echo "account = \"$SNOWFLAKE_ACCOUNT\"" >> ~/.snowflake/config.toml
   # ... add other credentials
   chmod 600 ~/.snowflake/config.toml
   ```

3. **Ensure CLI is available** in pipeline environment

4. **Test connection** before running Task Master commands

## FAQ

### General Questions

**Q: Do I need an API key?**  
A: No, Cortex Code uses Snowflake connection authentication from `~/.snowflake/config.toml`. No API keys required.

**Q: Which models support structured output?**  
A: Claude 3.5 models (`claude-3-5-sonnet-20241022` and `claude-3-5-haiku-20241022`) and OpenAI models (`gpt-4o`, `gpt-4-turbo`) support structured outputs reliably. Other models have limited or no support.

**Q: Can I test without affecting my tasks?**  
A: Yes, enable planning mode in configuration: `{ "enablePlanningMode": true }`. This allows AI analysis without modifying `tasks.json`.

**Q: Is the Cortex CLI required?**  
A: Yes, the CortexCodeProvider requires the `cortex` CLI to be installed and accessible in your PATH.

**Q: What are the key benefits of using Cortex Code?**  
A: Secure connection-based authentication (no API keys), planning mode for safe experimentation, custom skills support, built-in MCP integration, and access to all Snowflake Cortex models.

**Q: Can I use multiple Snowflake accounts?**  
A: Yes, configure multiple connections in `config.toml` and specify which to use in Task Master configuration via the `connection` setting.

### Performance Questions

**Q: How can I improve response times?**  
A:
1. Use `claude-3-5-haiku-20241022` for faster responses
2. Enable prompt caching for repeated contexts (automatic for Claude/OpenAI)
3. Set appropriate timeouts
4. Use retry logic for reliability

**Q: Why are requests slow?**  
A:
1. Check warehouse size and status
2. Verify network connectivity
3. Consider using a lighter model
4. Check Snowflake region proximity

### Security Questions

**Q: How are credentials stored?**  
A: Credentials are stored in `~/.snowflake/config.toml` with restricted file permissions (chmod 600). Personal Access Tokens are used instead of passwords.

**Q: Can I use this in shared environments?**  
A: Yes, but ensure proper file permissions (600) and consider using separate connections per user/environment.

**Q: What data is sent to Snowflake?**  
A: Only the prompts and task data necessary for AI processing. Task Master doesn't send any credentials or additional project files.

## Security Notes

### Credential Management

- ✅ **Personal Access Tokens** are used instead of passwords
- ✅ **File permissions** should be `600` for `config.toml`
- ✅ **No API keys** stored in project files or environment variables
- ✅ **Connection-based auth** is more secure than API key authentication
- ✅ **Tokens managed** by Snowflake infrastructure

### Best Practices

1. **Restrict file permissions**:
   ```bash
   chmod 600 ~/.snowflake/config.toml
   ```

2. **Use separate connections** for different environments:
   - `connections.dev` for development
   - `connections.prod` for production

3. **Rotate tokens regularly** via Snowflake web console

4. **Audit access** through Snowflake query history

5. **Use role-based access control** in Snowflake

### In CI/CD

- Use secure secret management (GitHub Secrets, etc.)
- Generate config files at runtime
- Clean up credentials after pipeline runs
- Use service accounts with minimal permissions

## Getting Help

### Documentation Resources

- **Task Master Docs**: [docs.task-master.dev](https://docs.task-master.dev)
- **Snowflake Cortex Code**: [docs.snowflake.com/cortex-cli](https://docs.snowflake.com/en/developer-guide/cortex-cli)
- **Unified AI SDK Provider Package**: [README](../../packages/ai-sdk-provider-snowflake/README.md)

### Support Channels

- **GitHub Issues**: [Report bugs or request features](https://github.com/eyaltoledano/task-master-ai/issues)
- **GitHub Discussions**: [Ask questions and share tips](https://github.com/eyaltoledano/task-master-ai/discussions)
- **Snowflake Support**: Contact your account team for Cortex Code CLI issues

### Before Reporting Issues

Please include:

1. **Versions**:
   ```bash
   cortex --version
   task-master --version
   ```

2. **Configuration** (sanitized):
   - Remove sensitive data
   - Include model settings
   - Include timeout/retry settings

3. **Error messages**:
   - Full error output
   - Command that triggered the error
   - Any relevant logs

4. **Environment**:
   - OS and version
   - Node.js version
   - Shell (bash/zsh/etc.)

### Useful Commands for Debugging

```bash
# Check CLI installation
cortex --version

# List connections
cortex connection list

# List available models
cortex model list

# List warehouses
cortex warehouse list

# Test Task Master configuration
task-master models

# Verbose logging
task-master next --verbose
```

## What's New

### Latest Features

- ✅ **Full CLI Integration** - Seamless integration with Cortex Code CLI
- ✅ **All Cortex Models** - Support for all Snowflake Cortex AI models
- ✅ **Planning Mode** - Read-only analysis without modifications
- ✅ **Custom Skills** - Leverage specialized Cortex Code skills
- ✅ **MCP Support** - Built-in Model Context Protocol integration
- ✅ **Retry Logic** - Automatic retries for reliability
- ✅ **Connection Discovery** - Automatic detection from config.toml
- ✅ **Comprehensive Error Handling** - Clear, actionable error messages
- ✅ **Performance Optimization** - Caching and timeout management

### Roadmap

- 🔄 Streaming support for real-time responses
- 🔄 Enhanced structured output validation
- 🔄 Multi-connection management UI
- 🔄 Performance metrics and monitoring

