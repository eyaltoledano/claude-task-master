# Cortex Code Provider for Vercel AI SDK

AI SDK adapter for Snowflake Cortex Code CLI integration.

## Features

- CLI-based execution via `cortex` command
- All Snowflake Cortex models supported
- Planning mode, MCP, and custom skills
- Full TypeScript support
- **Single dependency:** `@ai-sdk/provider`

## Prerequisites

1. Cortex Code CLI installed and in PATH
2. Snowflake authentication configured

See [Integration Guide](../../docs/cortex-code-integration.md) for setup.

## Usage

```typescript
import { createCortexCode } from '@tm/ai-sdk-provider-cortex-code';
import { generateText } from 'ai';

const provider = createCortexCode();
const model = provider('cortex/claude-sonnet-4-5');

const result = await generateText({
  model,
  prompt: 'Explain Snowflake in one sentence'
});
```

## Supported Models

```typescript
// Claude (recommended)
'cortex/claude-sonnet-4-5'
'cortex/claude-haiku-4-5'

// Llama
'cortex/llama3-70b'
'cortex/llama3-8b'

// Mistral
'cortex/mistral-large2'

// Other
'cortex/gemini-1.5-pro'
```

## Configuration

```typescript
const provider = createCortexCode({
  defaultSettings: {
    connection: 'production',
    timeout: 120000,
    plan: true,              // Enable planning mode
    noMcp: false,           // Enable MCP
    skillsFile: './skills.json'
  }
});
```

## Error Handling

```typescript
import {
  isAuthenticationError,
  isConnectionError,
  isTimeoutError
} from '@tm/ai-sdk-provider-cortex-code';

try {
  const result = await generateText({ model, prompt: '...' });
} catch (error) {
  if (isAuthenticationError(error)) {
    // Handle auth failure
  }
}
```

## Development

```bash
npm test        # Run tests
npm run build   # Build package
```

## Documentation

- [Integration Guide](../../docs/cortex-code-integration.md)
- [Snowflake Cortex Docs](https://docs.snowflake.com/en/developer-guide/cortex-cli)
