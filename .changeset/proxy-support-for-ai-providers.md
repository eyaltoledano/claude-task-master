---
"task-master-ai": patch
---

Added opt-in proxy support for all AI providers - respects http_proxy/https_proxy environment variables when enabled.

When using Task Master in corporate or restricted network environments that require HTTP/HTTPS proxies, API calls to AI providers (OpenAI, Anthropic, Google, AWS Bedrock, etc.) would previously fail with ECONNRESET errors. This update adds seamless proxy support that can be enabled via environment variable or configuration file.

**How to enable:**

Proxy support is opt-in. Enable it using either method:

**Method 1: Environment Variable**
```bash
export TASKMASTER_ENABLE_PROXY=true
export http_proxy=http://your-proxy:port
export https_proxy=http://your-proxy:port
export no_proxy=localhost,127.0.0.1  # Optional: bypass proxy for specific hosts

# Then use Task Master normally
task-master add-task "Create a new feature"
```

**Method 2: Configuration File**

Add to `.taskmaster/config.json`:
```json
{
  "global": {
    "enableProxy": true
  }
}
```

Then set your proxy environment variables:
```bash
export http_proxy=http://your-proxy:port
export https_proxy=http://your-proxy:port
```

**Technical details:**

- Uses undici's `EnvHttpProxyAgent` for automatic proxy detection
- Centralized implementation in `BaseAIProvider` for consistency across all providers
- Supports all AI providers: OpenAI, Anthropic, Perplexity, Azure OpenAI, Google AI, Google Vertex AI, AWS Bedrock, and OpenAI-compatible providers
- Opt-in design ensures users without proxy requirements are not affected
- Priority: `TASKMASTER_ENABLE_PROXY` environment variable > `config.json` setting
