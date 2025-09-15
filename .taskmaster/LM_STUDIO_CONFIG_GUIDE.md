# LM Studio Configuration Guide for Task Master

This guide shows you how to configure Task Master to use LM Studio with your local models.

## Quick Setup

### 1. Basic Configuration

Here's a minimal `config.json` for LM Studio running on `http://127.0.0.1:1234` with the `gpt-oss:20b` model and 32,000 context length:

```json
{
  "models": {
    "main": {
      "provider": "lmstudio",
      "modelId": "gpt-oss:20b",
      "maxTokens": 32000,
      "temperature": 0.2
    },
    "research": {
      "provider": "lmstudio",
      "modelId": "gpt-oss:20b",
      "maxTokens": 32000,
      "temperature": 0.1
    },
    "fallback": {
      "provider": "lmstudio",
      "modelId": "gpt-oss:20b",
      "maxTokens": 32000,
      "temperature": 0.3
    }
  },
  "global": {
    "logLevel": "info",
    "debug": false,
    "defaultNumTasks": 10,
    "defaultSubtasks": 5,
    "defaultPriority": "medium",
    "projectName": "Task Master with LM Studio",
    "lmstudioBaseURL": "http://127.0.0.1:1234/v1",
    "responseLanguage": "English",
    "enableCodebaseAnalysis": true,
    "userId": "lmstudio-user",
    "defaultTag": "master"
  }
}
```

### 2. Using Different Models for Different Roles

You can use different LM Studio models for different roles:

```json
{
  "models": {
    "main": {
      "provider": "lmstudio",
      "modelId": "gpt-oss:20b",
      "maxTokens": 32000,
      "temperature": 0.2
    },
    "research": {
      "provider": "lmstudio",
      "modelId": "gpt-oss:120b",
      "maxTokens": 32000,
      "temperature": 0.1
    },
    "fallback": {
      "provider": "lmstudio",
      "modelId": "gpt-oss:latest",
      "maxTokens": 32000,
      "temperature": 0.3
    }
  },
  "global": {
    "lmstudioBaseURL": "http://127.0.0.1:1234/v1"
  }
}
```

## Available LM Studio Models

Task Master supports these LM Studio models (aligned with Ollama):

- `gpt-oss:latest` (60.7% SWE Score)
- `gpt-oss:20b` (60.7% SWE Score)
- `gpt-oss:120b` (62.4% SWE Score)
- `devstral:latest`
- `qwen3:latest`
- `qwen3:14b`
- `qwen3:32b`
- `mistral-small3.1:latest`
- `llama3.3:latest`
- `phi4:latest`
- `custom` (for flexible configuration)

## Configuration Options

### LM Studio Base URL

Set the base URL for your LM Studio server:

```json
{
  "global": {
    "lmstudioBaseURL": "http://127.0.0.1:1234/v1"
  }
}
```

**Common URLs:**
- Default: `http://127.0.0.1:1234/v1`
- Custom port: `http://localhost:8080/v1`
- Remote server: `http://192.168.1.100:1234/v1`

### Model Configuration

Each model role can be configured with:

- `provider`: Always `"lmstudio"`
- `modelId`: The model identifier (e.g., `"gpt-oss:20b"`)
- `maxTokens`: Maximum context length (e.g., `32000`)
- `temperature`: Response randomness (0.0-1.0)

### Temperature Settings

- **0.1**: Very focused, deterministic responses
- **0.2**: Balanced creativity and consistency (recommended for main)
- **0.3**: More creative responses (good for fallback)
- **0.5+**: Highly creative, less predictable

## Setup Commands

### Using the CLI

```bash
# Set main model to gpt-oss:20b
task-master models --set-main gpt-oss:20b --lmstudio

# Set research model
task-master models --set-research gpt-oss:120b --lmstudio

# Set fallback model
task-master models --set-fallback gpt-oss:latest --lmstudio

# Interactive setup
task-master models --setup
```

### Manual Configuration

1. Copy the example config to your `.taskmaster/config.json`
2. Modify the `modelId` to match your loaded model
3. Adjust `maxTokens` based on your model's context length
4. Set `lmstudioBaseURL` if using a non-default port

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Ensure LM Studio is running
   - Check the base URL matches your LM Studio server
   - Verify the port is correct

2. **Model Not Found**
   - Ensure the model is loaded in LM Studio
   - Check the model ID matches exactly
   - Use `custom` as modelId for flexible configuration

3. **Context Length Issues**
   - Reduce `maxTokens` if getting errors
   - Check your model's actual context length
   - Start with smaller values (e.g., 8192) and increase

### Verification

Test your configuration:

```bash
# Check current configuration
task-master models

# Test with a simple command
task-master list
```

## Example Configurations

### High-Performance Setup
```json
{
  "models": {
    "main": {
      "provider": "lmstudio",
      "modelId": "gpt-oss:120b",
      "maxTokens": 128000,
      "temperature": 0.2
    }
  },
  "global": {
    "lmstudioBaseURL": "http://127.0.0.1:1234/v1"
  }
}
```

### Balanced Setup
```json
{
  "models": {
    "main": {
      "provider": "lmstudio",
      "modelId": "gpt-oss:20b",
      "maxTokens": 32000,
      "temperature": 0.2
    }
  },
  "global": {
    "lmstudioBaseURL": "http://127.0.0.1:1234/v1"
  }
}
```

### Lightweight Setup
```json
{
  "models": {
    "main": {
      "provider": "lmstudio",
      "modelId": "phi4:latest",
      "maxTokens": 8192,
      "temperature": 0.2
    }
  },
  "global": {
    "lmstudioBaseURL": "http://127.0.0.1:1234/v1"
  }
}
```

## Notes

- LM Studio doesn't require API keys
- All models show as "Free" cost
- The `--lmstudio` flag is required when setting models via CLI
- Context length should match your model's capabilities
- Temperature affects response creativity vs consistency
