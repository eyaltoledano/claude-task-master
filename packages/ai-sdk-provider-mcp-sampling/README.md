# MCP Sampling AI SDK Provider

AI SDK v5 provider for MCP (Model Context Protocol) Sampling integration with Task Master.

## Overview

This package provides an AI SDK v5 compatible provider for using MCP sampling capabilities within Task Master. It implements the v2 specification required by AI SDK v5.

## Usage

```typescript
import { createMCPSampling } from '@tm/ai-sdk-provider-mcp-sampling';

// Create provider with MCP session
const mcpProvider = createMCPSampling({
  session: mcpSession, // Your MCP session object
  defaultSettings: {
    temperature: 0.7,
    maxTokens: 1000
  }
});

// Use with AI SDK
const model = mcpProvider('claude-3-5-sonnet-20241022');
const result = await generateText({
  model,
  prompt: 'Hello, world!'
});
```

## Features

- AI SDK v5 compatible with v2 specification
- Full support for MCP sampling protocol
- TypeScript support with comprehensive types
- Streaming support (simulated)
- Structured output support via JSON extraction
- Comprehensive error handling
- Proper usage tracking

## Requirements

- Node.js >= 20
- AI SDK v5
- Active MCP session with sampling capabilities

## Architecture

This provider follows the same patterns as other Task Master AI SDK providers:

- `MCPSamplingLanguageModel` - Main language model implementation
- `createMCPSampling` - Provider factory function
- Message conversion between AI SDK and MCP formats
- Error handling and mapping to AI SDK error types
- JSON extraction for structured outputs

## Error Handling

The provider maps MCP errors to appropriate AI SDK error types:

- Session errors → `MCPSamplingError`
- Authentication errors → `LoadAPIKeyError`
- API errors → `APICallError`
- Model not found → `NoSuchModelError`