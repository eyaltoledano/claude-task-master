# LM Studio Integration

Task Master now supports LM Studio as a local AI provider, allowing you to run models locally without requiring API keys.

## Features

- **No API Key Required**: LM Studio runs locally and doesn't require authentication
- **Custom Base URL**: Configure your LM Studio server URL (default: `http://127.0.0.1:1234/v1`)
- **High Token Limits**: Support for large context windows (up to 131,072 tokens)
- **Multiple Models**: Support for various open-source models like Llama, Qwen, Mistral, etc.

## Setup

### 1. Install and Configure LM Studio

1. Download and install [LM Studio](https://lmstudio.ai/)
2. Start LM Studio and load your preferred model
3. Enable the local server (usually runs on `http://127.0.0.1:1234`)

### 2. Configure Task Master

Add LM Studio configuration to your `.taskmaster/config.json`:

```json
{
  "models": {
    "main": {
      "provider": "lmstudio",
      "modelId": "llama-3.1-8b-instruct",
      "maxTokens": 32000,
      "temperature": 0.2,
      "baseURL": "http://127.0.0.1:1234/v1"
    },
    "research": {
      "provider": "lmstudio",
      "modelId": "llama-3.1-70b-instruct",
      "maxTokens": 131072,
      "temperature": 0.1,
      "baseURL": "http://127.0.0.1:1234/v1"
    },
    "fallback": {
      "provider": "lmstudio",
      "modelId": "qwen2.5-7b-instruct",
      "maxTokens": 32768,
      "temperature": 0.2,
      "baseURL": "http://127.0.0.1:1234/v1"
    }
  },
  "global": {
    "lmstudioBaseURL": "http://127.0.0.1:1234/v1"
  }
}
```

### 3. Set Model Configuration

You can configure different models for different roles:

- **Main**: Primary model for task generation and updates
- **Research**: Model for research-backed operations (requires larger context)
- **Fallback**: Backup model if the main model fails

## Supported Models

Task Master includes support for common open-source models:

### Llama Models
- `llama-3.1-8b-instruct` (8B parameters, 131K context)
- `llama-3.1-70b-instruct` (70B parameters, 131K context)
- `llama-3.3-70b-instruct` (70B parameters, 131K context)

### Qwen Models
- `qwen2.5-7b-instruct` (7B parameters, 32K context)
- `qwen2.5-14b-instruct` (14B parameters, 32K context)
- `qwen2.5-32b-instruct` (32B parameters, 32K context)

### Mistral Models
- `mistral-7b-instruct` (7B parameters, 32K context)
- `mixtral-8x7b-instruct` (8x7B parameters, 32K context)

### Code Models
- `codellama-7b-instruct` (7B parameters, 16K context)
- `codellama-13b-instruct` (13B parameters, 16K context)

### Phi Models
- `phi-3-medium-4k-instruct` (Medium parameters, 4K context)
- `phi-3-mini-4k-instruct` (Mini parameters, 4K context)

### Custom Models
- `custom` (Generic model ID for any custom model you load in LM Studio)

## Configuration Options

### Base URL Configuration

You can configure the LM Studio server URL in multiple ways:

1. **Global Configuration**: Set `lmstudioBaseURL` in the global section
2. **Role-Specific**: Set `baseURL` for each model role
3. **Environment Variable**: Set `LMSTUDIO_BASE_URL` environment variable

### Token Limits

Configure `maxTokens` based on your model's capabilities:

- **Small Models (7B-8B)**: 4K-32K tokens
- **Medium Models (13B-14B)**: 16K-32K tokens  
- **Large Models (32B-70B)**: 32K-131K tokens

### Temperature Settings

- **Main Tasks**: 0.2 (focused, consistent output)
- **Research**: 0.1 (more deterministic for research)
- **Fallback**: 0.2 (balanced approach)

## Usage Examples

### Basic Usage

```bash
# Set LM Studio as your main provider
task-master models --set-main llama-3.1-8b-instruct --provider lmstudio

# Generate tasks with LM Studio
task-master parse-prd requirements.txt
```

### Advanced Configuration

```bash
# Configure different models for different roles
task-master models --setup

# Select LM Studio for main role
# Choose llama-3.1-8b-instruct for main
# Choose llama-3.1-70b-instruct for research
# Choose qwen2.5-7b-instruct for fallback
```

### Custom Server URL

If your LM Studio server runs on a different port or machine:

```json
{
  "global": {
    "lmstudioBaseURL": "http://192.168.1.100:8080/v1"
  }
}
```

## Troubleshooting

### Connection Issues

1. **Check LM Studio Server**: Ensure LM Studio is running and the server is enabled
2. **Verify URL**: Confirm the base URL matches your LM Studio server address
3. **Port Conflicts**: Make sure the port (default 1234) is not blocked

### Model Loading

1. **Model Availability**: Ensure the model is loaded in LM Studio
2. **Model ID**: Use the exact model ID as shown in LM Studio
3. **Context Limits**: Don't exceed the model's maximum context window

### Performance

1. **Hardware Requirements**: Larger models require more RAM and VRAM
2. **Token Limits**: Higher token limits may slow down generation
3. **Temperature**: Lower values (0.1-0.2) are faster and more consistent

## Benefits of LM Studio Integration

- **Privacy**: All processing happens locally
- **Cost**: No API costs for model usage
- **Customization**: Use any compatible model
- **Offline**: Works without internet connection
- **Performance**: Direct access to local hardware

## Next Steps

1. Install LM Studio and load your preferred model
2. Configure Task Master to use LM Studio
3. Test with a simple task generation
4. Adjust token limits and temperature based on your needs
5. Explore different models for different use cases
