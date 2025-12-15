# AI SDK Provider for Minimax CLI

A provider for the [AI SDK](https://sdk.vercel.ai) that integrates with [Mini-agent](https://www.minimaxi.com/) for accessing Minimax's AI models through CLI interface.

## Installation

```bash
npm install @tm/ai-sdk-provider-minimax-cli
```

```bash
yarn add @tm/ai-sdk-provider-minimax-cli
```

## Usage

### Quick Start

```typescript
import { minimaxCli } from '@tm/ai-sdk-provider-minimax-cli';

const response = await llm.chat({
  model: minimaxCli('MiniMax-V3'),
  messages: [{ role: 'user', content: 'Hello, world!' }],
});
```

### With Custom Configuration

```typescript
import { createMinimaxCli } from '@tm/ai-sdk-provider-minimax-cli';

const minimax = createMinimaxCli({
  // optional configuration
});

const response = await llm.chat({
  model: minimax('MiniMax-M2'),
  messages: [{ role: 'user', content: 'Hello, world!' }],
});
```

### With Multiple Parameters

```typescript
import { createMinimaxCli } from '@tm/ai-sdk-provider-minimax-cli';

const minimax = createMinimaxCli({
  // optional API key, can also be set via MINIMAX_CLI_API_KEY environment variable
  apiKey: 'your-api-key',
  
  // optional configuration settings
  defaultHeaders: {},
  
  // optional timeout in milliseconds (default: 30000)
  timeout: 60000,
  
  // other CLI-specific settings
});

const response = await llm.chat({
  model: minimax('MiniMax-M2'),
  messages: [{ role: 'user', content: 'Hello, world!' }],
  temperature: 0.7,
});
```

### Provider Instance

```typescript
import { createMinimaxCli } from '@tm/ai-sdk-provider-minimax-cli';

const minimax = createMinimaxCli({
  // optional configuration
});

const response = await llm.chat({
  model: minimax('MiniMax-M2'),
  messages: [{ role: 'user', content: 'Hello, world!' }],
});
```

## Available Models

- `MiniMax-M2` - Minimax M2 model
- `MiniMax-M2-Stable` - Minimax M2 Stable model
- `MiniMax-V3` - Minimax V3 model
- `MiniMax-Coding` - Minimax Coding model (for coding plan subscribers)

## Requirements

1. Install the Mini-agent CLI:
   ```bash
   npm install -g @minimaxi/mini-agent
   ```
   
2. Configure the CLI with your credentials:
   ```bash
   export MINIMAX_CLI_API_KEY="your-api-key"
   # or configure via mini-agent CLI: mini-agent config set api-key your-key
   ```

## Error Handling

The provider includes specialized error handling for Minimax CLI operations:

```typescript
import { 
  isMinimaxCliInstallationError,
  getMinimaxCliErrorMetadata 
} from '@tm/ai-sdk-provider-minimax-cli';

try {
  const response = await llm.chat({
    model: minimaxCli('MiniMax-M2'),
    messages: [{ role: 'user', content: 'Hello, world!' }],
  });
} catch (error) {
  if (isMinimaxCliInstallationError(error)) {
    console.error('Mini-agent CLI not installed or not found in PATH');
    // handle installation error
  }
  
  const metadata = getMinimaxCliErrorMetadata(error);
  if (metadata) {
    console.error('Minimax CLI error:', metadata.code, metadata.message);
  }
}
```

## Configuration

The provider can be configured with the following options:

- `apiKey`: Mini-agent CLI API key (optional if set via env var)
- `defaultHeaders`: Additional headers to send with requests
- `timeout`: Request timeout in milliseconds (default: 30000)
- Additional CLI-specific settings

Environment variables:
- `MINIMAX_CLI_API_KEY`: API key for Mini-agent CLI

## Notes

- The provider uses the Mini-agent CLI to interface with Minimax's models
- Streaming is simulated since Mini-agent CLI doesn't natively support streaming
- All AI SDK features are supported, including structured outputs