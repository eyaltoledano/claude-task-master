# AI SDK Provider for Kimi CLI

A provider for the [AI SDK](https://sdk.vercel.ai) that integrates with [Kimi CLI](https://www.moonshot.com/) for accessing Moonshot AI's Kimi language models through CLI interface.

## Installation

```bash
npm install @tm/ai-sdk-provider-kimi-cli
```

```bash
yarn add @tm/ai-sdk-provider-kimi-cli
```

## Usage

### Quick Start

```typescript
import { kimiCli } from '@tm/ai-sdk-provider-kimi-cli';

const response = await llm.chat({
  model: kimiCli('kimi-k2-instruct'),
  messages: [{ role: 'user', content: 'Hello, world!' }],
});
```

### With Custom Configuration

```typescript
import { createKimiCli } from '@tm/ai-sdk-provider-kimi-cli';

const kimi = createKimiCli({
  // optional configuration
});

const response = await llm.chat({
  model: kimi('kimi-k2-instruct'),
  messages: [{ role: 'user', content: 'Hello, world!' }],
});
```

### With Multiple Parameters

```typescript
import { createKimiCli } from '@tm/ai-sdk-provider-kimi-cli';

const kimi = createKimiCli({
  // optional API key, can also be set via KIMI_CLI_API_KEY environment variable
  apiKey: 'your-api-key',
  
  // optional configuration settings
  defaultHeaders: {},
  
  // optional timeout in milliseconds (default: 30000)
  timeout: 60000,
  
  // other CLI-specific settings
});

const response = await llm.chat({
  model: kimi('kimi-k2-instruct'),
  messages: [{ role: 'user', content: 'Hello, world!' }],
  temperature: 0.7,
});
```

### Provider Instance

```typescript
import { createKimiCli } from '@tm/ai-sdk-provider-kimi-cli';

const kimi = createKimiCli({
  // optional configuration
});

const response = await llm.chat({
  model: kimi('kimi-k2-instruct'),
  messages: [{ role: 'user', content: 'Hello, world!' }],
});
```

## Available Models

- `kimi-k2-instruct` - Kimi model from Moonshot AI

## Requirements

1. Install the Kimi CLI:
   ```bash
   npm install -g @moonshot/kimi-cli
   ```
   
2. Configure the CLI with your credentials:
   ```bash
   export KIMI_CLI_API_KEY="your-api-key"
   # or configure via kimi CLI: kimi config set api-key your-key
   ```

## Error Handling

The provider includes specialized error handling for Kimi CLI operations:

```typescript
import { 
  isKimiCliInstallationError,
  getKimiCliErrorMetadata 
} from '@tm/ai-sdk-provider-kimi-cli';

try {
  const response = await llm.chat({
    model: kimiCli('kimi-k2-instruct'),
    messages: [{ role: 'user', content: 'Hello, world!' }],
  });
} catch (error) {
  if (isKimiCliInstallationError(error)) {
    console.error('Kimi CLI not installed or not found in PATH');
    // handle installation error
  }
  
  const metadata = getKimiCliErrorMetadata(error);
  if (metadata) {
    console.error('Kimi CLI error:', metadata.code, metadata.message);
  }
}
```

## Configuration

The provider can be configured with the following options:

- `apiKey`: Kimi CLI API key (optional if set via env var)
- `defaultHeaders`: Additional headers to send with requests
- `timeout`: Request timeout in milliseconds (default: 30000)
- Additional CLI-specific settings

Environment variables:
- `KIMI_CLI_API_KEY`: API key for Kimi CLI

## Notes

- The provider uses the Kimi CLI to interface with Moonshot AI's models
- Streaming is simulated since Kimi CLI doesn't natively support streaming
- All AI SDK features are supported, including structured outputs