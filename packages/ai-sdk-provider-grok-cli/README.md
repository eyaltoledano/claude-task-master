# AI SDK Provider for Grok CLI

A provider for the [AI SDK](https://sdk.vercel.ai) that integrates with [Grok CLI](https://docs.x.ai/api) for accessing xAI's Grok language models.

## Features

- ✅ **AI SDK v5 Compatible** - Full support for the latest AI SDK interfaces
- ✅ **Streaming & Non-streaming** - Both generation modes supported
- ✅ **Error Handling** - Comprehensive error handling with retry logic
- ✅ **Type Safety** - Full TypeScript support with proper type definitions
- ✅ **JSON Mode** - Automatic JSON extraction from responses
- ✅ **Abort Signals** - Proper cancellation support

## Installation

```bash
npm install @tm/ai-sdk-provider-grok-cli
# or
yarn add @tm/ai-sdk-provider-grok-cli
```

## Prerequisites

1. Install the Grok CLI:

   ```bash
   npm install -g grok-cli
   # or follow xAI's installation instructions
   ```

2. Set up authentication:

   ```bash
   export GROK_CLI_API_KEY="your-api-key"
   # or configure via grok CLI: grok config set api-key your-key
   ```

## Usage

### Basic Usage

```typescript
import { grokCli } from '@tm/ai-sdk-provider-grok-cli';
import { generateText } from 'ai';

const result = await generateText({
  model: grokCli('grok-3-latest'),
  prompt: 'Write a haiku about TypeScript'
});

console.log(result.text);
```

### Streaming

```typescript
import { grokCli } from '@tm/ai-sdk-provider-grok-cli';
import { streamText } from 'ai';

const { textStream } = await streamText({
  model: grokCli('grok-4-latest'),
  prompt: 'Explain quantum computing'
});

for await (const delta of textStream) {
  process.stdout.write(delta);
}
```

### JSON Mode

```typescript
import { grokCli } from '@tm/ai-sdk-provider-grok-cli';
import { generateObject } from 'ai';
import { z } from 'zod';

const result = await generateObject({
  model: grokCli('grok-3-latest'),
  schema: z.object({
    name: z.string(),
    age: z.number(),
    hobbies: z.array(z.string())
  }),
  prompt: 'Generate a person profile'
});

console.log(result.object);
```

## Supported Models

- `grok-3-latest` - Grok 3 (latest version)
- `grok-4-latest` - Grok 4 (latest version)
- `grok-4` - Grok 4 (stable)
- Custom model strings supported

## Configuration

### Provider Settings

```typescript
import { createGrokCli } from '@tm/ai-sdk-provider-grok-cli';

const grok = createGrokCli({
  apiKey: 'your-api-key', // Optional if set via env/CLI
  timeout: 120000, // 2 minutes default
  workingDirectory: '/path/to/project', // Optional
  baseURL: 'https://api.x.ai' // Optional
});
```

### Model Settings

```typescript
const model = grok('grok-4-latest', {
  timeout: 300000, // 5 minutes for grok-4
  // Other CLI-specific settings
});
```

## Error Handling

The provider includes comprehensive error handling:

```typescript
import {
  isAuthenticationError,
  isTimeoutError,
  isInstallationError
} from '@tm/ai-sdk-provider-grok-cli';

try {
  const result = await generateText({
    model: grokCli('grok-4-latest'),
    prompt: 'Hello!'
  });
} catch (error) {
  if (isAuthenticationError(error)) {
    console.error('Authentication failed:', error.message);
  } else if (isTimeoutError(error)) {
    console.error('Request timed out:', error.message);
  } else if (isInstallationError(error)) {
    console.error('Grok CLI not installed or not found in PATH');
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Start development mode (keep running during development)
npm run dev

# Type check
npm run typecheck

# Run tests (requires build first)
NODE_ENV=production npm run build
npm test
```

**Important**: Always run `npm run dev` and keep it running during development. This ensures proper compilation and hot-reloading of TypeScript files.
