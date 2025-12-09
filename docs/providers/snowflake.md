# Snowflake Provider Integration Guide

Use Task Master with Snowflake's Cortex AI models via **REST API** (default) or **Cortex Code CLI**.

## Quick Start

### 1. Set Up Authentication

#### Option A: Environment Variables (Recommended)

```bash
# Key pair authentication
export SNOWFLAKE_ACCOUNT="your-account"
export SNOWFLAKE_USER="your.name@company.com"
export SNOWFLAKE_PRIVATE_KEY_PATH="/path/to/rsa_key.p8"
export SNOWFLAKE_PRIVATE_KEY_PASSPHRASE="optional-passphrase"  # if encrypted
```

#### Option B: Connection Profile

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

### 2. Configure Task Master

```bash
task-master models --setup
# Select "snowflake" as provider
# Select your preferred model (e.g., claude-sonnet-4-5)
```

### 3. Start Using

```bash
task-master add-task --prompt="Implement user authentication" --research
task-master expand --id=1 --research
task-master next
```

## Authentication Methods

| Method | Use Case | Setup |
|--------|----------|-------|
| **Key Pair** | Most secure, recommended | RSA private key + public key registered in Snowflake |
| **Connection Profile** | CLI mode, multiple accounts | `~/.snowflake/connections.toml` |
| **Direct Token** | Quick setup | `SNOWFLAKE_API_KEY` environment variable |

### Generate RSA Key Pair

```bash
# Generate private key (with passphrase)
openssl genrsa 2048 | openssl pkcs8 -topk8 -v2 des3 -inform PEM -out rsa_key.p8

# Generate public key
openssl rsa -in rsa_key.p8 -pubout -out rsa_key.pub

# Register in Snowflake
ALTER USER YOUR_USER SET RSA_PUBLIC_KEY='<public_key_content>';

# Secure permissions
chmod 600 rsa_key.p8 ~/.snowflake/connections.toml
```

## Supported Models

Any model available via the [Snowflake Cortex REST API](https://docs.snowflake.com/developer-guide/snowflake-rest-api/reference/cortex-inference) can be used.

**Claude Models (Recommended)** - Best for Task Master with structured output support:

| Model | Best For | Structured Output |
|-------|----------|-------------------|
| `claude-sonnet-4-5` | Complex reasoning, code generation | ✅ |
| `claude-haiku-4-5` | Fast responses, high volume | ✅ |
| `claude-4-sonnet` | Balanced performance and speed | ✅ |
| `claude-4-opus` | Most capable, complex tasks | ✅ |

**OpenAI Models:**

| Model | Best For | Structured Output |
|-------|----------|-------------------|
| `openai-gpt-5` | Latest GPT-5, most capable | ✅ |
| `openai-gpt-5-mini` | Balanced GPT-5, efficient | ✅ |
| `openai-gpt-5-nano` | Fast GPT-5, lightweight | ✅ |
| `openai-gpt-4.1` | Reliable, large context | ✅ |

> **Note:** Use Claude or OpenAI models for best results with Task Master's structured outputs. Other Cortex models (Llama, Mistral, DeepSeek) do not support structured outputs.

## Configuration

Basic `.taskmaster/config.json`:

```json
{
  "models": {
    "main": { "provider": "snowflake", "modelId": "claude-haiku-4-5" },
    "research": { "provider": "snowflake", "modelId": "claude-sonnet-4-5" }
  }
}
```

Advanced options:

```json
{
  "snowflake": {
    "connection": "default",
    "executionMode": "auto",
    "timeout": 60000,
    "retries": 3,
    "enablePromptCaching": true,
    "thinkingLevel": "medium"
  }
}
```

| Option | Description | Default |
|--------|-------------|---------|
| `connection` | Connection name from `connections.toml` | `"default"` |
| `executionMode` | `"auto"`, `"rest"`, or `"cli"` | `"auto"` |
| `timeout` | Request timeout in ms | `60000` |
| `retries` | Max retry attempts | `3` |
| `enablePromptCaching` | Cache repeated prompts (Claude) | `false` |
| `thinkingLevel` | Extended thinking: `"low"`, `"medium"`, `"high"` | - |

## CLI-Only Features

These features require the Cortex Code CLI (private preview):

- **Planning Mode**: Read-only analysis without modifying tasks
- **Custom Skills**: Domain-specific operations
- **MCP Support**: Built-in Model Context Protocol

```json
{
  "snowflake": {
    "executionMode": "cli",
    "enablePlanningMode": true,
    "enableSkills": true
  }
}
```

## Troubleshooting

### Authentication Failed

```bash
# Verify config exists
cat ~/.snowflake/connections.toml

# Check permissions
chmod 600 ~/.snowflake/connections.toml

# Test with CLI (if installed)
cortex connection list
```

### Timeout Errors

Increase timeout or use a faster model:

```json
{
  "snowflake": {
    "timeout": 120000,
    "modelId": "claude-haiku-4-5"
  }
}
```

### Model Not Available

1. Verify model name: `cortex model list`
2. Check role permissions in Snowflake
3. Contact your Snowflake administrator

## Security Best Practices

- Use **key pair authentication** over passwords
- Set file permissions to `600` for keys and config files
- Use **separate connections** for dev/prod environments
- **Rotate keys** regularly via Snowflake console
- Use **role-based access control** in Snowflake

## Resources

- [Snowflake Cortex REST API](https://docs.snowflake.com/developer-guide/snowflake-rest-api/reference/cortex-inference)
