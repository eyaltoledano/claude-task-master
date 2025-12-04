# @tm/ai-sdk-provider-snowflake

Unified Snowflake AI SDK Provider for Task Master AI. Supports both REST API and Cortex Code CLI backends with key pair authentication.

## Features

- **Unified Provider**: Single provider interface for both REST API and CLI modes
- **Key Pair Authentication**: JWT-based authentication using RSA key pairs
- **Connection Profiles**: Supports `~/.snowflake/connections.toml` and `config.toml`
- **Environment Variables**: Compatible with Snowflake CLI environment variables
- **Auto-Detection**: Automatically selects CLI or REST mode based on availability
- **Token Caching**: In-memory token caching with TTL-based expiry

## Installation

```bash
npm install @tm/ai-sdk-provider-snowflake
```

## Quick Start

```typescript
import { createSnowflake, snowflake } from '@tm/ai-sdk-provider-snowflake';

// Use default provider with auto-detection
const model = snowflake('cortex/claude-sonnet-4-5');

// Or create a custom provider
const provider = createSnowflake({
  connection: 'default',
  executionMode: 'auto' // 'auto' | 'rest' | 'cli'
});

const model = provider('cortex/claude-sonnet-4-5');
```

## Authentication

The provider supports multiple authentication methods (in priority order):

### 1. Direct API Token
Set `SNOWFLAKE_API_KEY` with either `SNOWFLAKE_ACCOUNT` or `SNOWFLAKE_BASE_URL`:

```bash
export SNOWFLAKE_API_KEY=your-oauth-token
export SNOWFLAKE_ACCOUNT=your-account  # URL derived automatically

# Or explicitly set the base URL (optional)
# export SNOWFLAKE_BASE_URL=https://your-account.snowflakecomputing.com
```

### 2. Key Pair Authentication
Configure key pair authentication via environment variables:

```bash
export SNOWFLAKE_ACCOUNT=your-account
export SNOWFLAKE_USER=your-user
export SNOWFLAKE_PRIVATE_KEY_PATH=/path/to/rsa_key.p8

# Optional: For encrypted keys
export SNOWFLAKE_PRIVATE_KEY_PASSPHRASE=your-passphrase
```

**Note**: The provider supports multiple passphrase variable names for compatibility:
- `SNOWFLAKE_PRIVATE_KEY_PASSPHRASE`
- `SNOWFLAKE_PRIVATE_KEY_FILE_PWD`
- `SNOWSQL_PRIVATE_KEY_PASSPHRASE`

### 3. Connection Profile
Configure a connection in `~/.snowflake/connections.toml`:

```toml
[default]
account = "your-account"
user = "your-user"
private_key_path = "/path/to/rsa_key.p8"
private_key_passphrase = "your-passphrase"
role = "YOUR_ROLE"
```

Or use `~/.snowflake/config.toml`:

```toml
[connections.default]
account = "your-account"
user = "your-user"
private_key_path = "/path/to/rsa_key.p8"
```

## Execution Modes

### Auto Mode (Default)
Automatically selects CLI if Cortex Code is available, otherwise falls back to REST:

```typescript
const provider = createSnowflake({
  executionMode: 'auto'
});
```

### REST Mode
Forces REST API for all requests:

```typescript
const provider = createSnowflake({
  executionMode: 'rest'
});
```

### CLI Mode
Forces Cortex Code CLI for all requests (fails if not installed):

```typescript
const provider = createSnowflake({
  executionMode: 'cli'
});
```

## Supported Models

All models use the `cortex/` prefix:

- `cortex/claude-sonnet-4-5`
- `cortex/claude-haiku-4-5`
- `cortex/claude-4-sonnet`
- `cortex/gpt-4o`
- `cortex/gpt-4o-mini`
- `cortex/llama3.1-70b`
- `cortex/llama3.1-8b`
- `cortex/llama3.3-70b`
- `cortex/mistral-large2`
- `cortex/deepseek-r1`
- And more...

## Configuration Options

```typescript
interface SnowflakeProviderSettings {
  /** Connection name from ~/.snowflake/connections.toml */
  connection?: string;
  
  /** Execution mode: 'auto' | 'rest' | 'cli' */
  executionMode?: 'auto' | 'rest' | 'cli';
  
  /** Request timeout in milliseconds (default: 120000) */
  timeout?: number;
  
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  
  /** Direct API key (bypasses connection loading) */
  apiKey?: string;
  
  /** Base URL for REST API */
  baseURL?: string;
  
  /** Working directory for CLI commands */
  workingDirectory?: string;
  
  /** Enable CLI planning mode */
  plan?: boolean;
  
  /** Disable MCP servers for CLI */
  noMcp?: boolean;
  
  /** Path to custom skills.json for CLI */
  skillsFile?: string;
}
```

## Advanced Usage

### Manual Token Management

```typescript
import { authenticate, clearAuthCache } from '@tm/ai-sdk-provider-snowflake';

// Get authentication token
const auth = await authenticate({
  connection: 'default'
});
console.log('Token:', auth.accessToken);
console.log('Base URL:', auth.baseURL);

// Clear cached tokens
clearAuthCache();
```

### Check CLI Availability

```typescript
import { isCortexCliAvailable } from '@tm/ai-sdk-provider-snowflake';

const available = await isCortexCliAvailable();
console.log('CLI available:', available);
```

## Migration Guide

### Model ID Prefix

All models use the standardized `cortex/` prefix:

```typescript
const model = snowflake('cortex/claude-sonnet-4-5');
const haikuModel = snowflake('cortex/claude-haiku-4-5');
const llamaModel = snowflake('cortex/llama3.1-70b');
```

### Execution Modes

Choose between REST API and Cortex Code CLI:

```typescript
// Auto mode (default): REST API if credentials available, else CLI
const provider = createSnowflake();

// Force REST API mode
const restProvider = createSnowflake({ executionMode: 'rest' });

// Force CLI mode  
const cliProvider = createSnowflake({ executionMode: 'cli' });
```

## License

MIT

