# Corporate Proxy Configuration for Claude Code

This guide explains how to configure Task Master AI to work with Claude Code in corporate environments that require proxy servers.

## Overview

When using Task Master with the Claude Code provider in a corporate environment, you may need to configure proxy settings for the Claude Code CLI subprocess to successfully communicate with Anthropic's API servers.

## Configuration

Task Master supports two methods for configuring proxies, with different scopes:

### Method 1: Global Environment Variables

Set proxy environment variables in your shell configuration file (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
export http_proxy="http://proxy.company.com:8080"
export https_proxy="http://proxy.company.com:8080"
export HTTP_PROXY="http://proxy.company.com:8080"
export HTTPS_PROXY="http://proxy.company.com:8080"
```

This applies proxy settings to **all projects** automatically. Task Master will automatically detect and use these environment variables when invoking Claude Code CLI.

### Method 2: Per-Project Configuration File

Add proxy environment variables to your `.taskmaster/config.json` file:

```json
{
  "models": {
    "main": {
      "provider": "claude-code",
      "modelId": "sonnet"
    }
  },
  "claudeCode": {
    "env": {
      "http_proxy": "http://proxy.company.com:8080",
      "https_proxy": "http://proxy.company.com:8080",
      "HTTP_PROXY": "http://proxy.company.com:8080",
      "HTTPS_PROXY": "http://proxy.company.com:8080"
    }
  }
}
```

### Configuration Priority

When both methods are used, **project configuration takes precedence** over environment variables:

1. **Highest Priority**: `.taskmaster/config.json` `claudeCode.env` settings
2. **Lower Priority**: Shell environment variables (`http_proxy`, etc.)

This allows you to:
- Set a default corporate proxy globally in your shell
- Override it for specific projects if needed

**Example**: If your shell has `http_proxy=http://proxy.company.com:8080` but your project config has `http_proxy=http://proxy-alt.company.com:9090`, Task Master will use `proxy-alt.company.com:9090` for that project.

### Method 3: Command-Specific Configuration

If you need different proxy settings for specific commands:

```json
{
  "claudeCode": {
    "env": {
      "http_proxy": "http://proxy.company.com:8080",
      "https_proxy": "http://proxy.company.com:8080"
    },
    "commandSpecific": {
      "parse-prd": {
        "env": {
          "http_proxy": "http://proxy-alt.company.com:8080",
          "https_proxy": "http://proxy-alt.company.com:8080"
        }
      }
    }
  }
}
```

## Proxy Formats

### HTTP Proxy
```json
{
  "env": {
    "http_proxy": "http://proxy.company.com:8080",
    "https_proxy": "http://proxy.company.com:8080"
  }
}
```

### Authenticated Proxy
```json
{
  "env": {
    "http_proxy": "http://username:password@proxy.company.com:8080",
    "https_proxy": "http://username:password@proxy.company.com:8080"
  }
}
```

### SOCKS Proxy
```json
{
  "env": {
    "http_proxy": "socks5://proxy.company.com:1080",
    "https_proxy": "socks5://proxy.company.com:1080"
  }
}
```

## Additional Environment Variables

You can pass any environment variables needed by your corporate environment:

```json
{
  "claudeCode": {
    "env": {
      "http_proxy": "http://proxy.company.com:8080",
      "https_proxy": "http://proxy.company.com:8080",
      "NO_PROXY": "localhost,127.0.0.1,.local",
      "NODE_TLS_REJECT_UNAUTHORIZED": "0"
    }
  }
}
```

> **Warning**: Setting `NODE_TLS_REJECT_UNAUTHORIZED=0` disables SSL certificate verification and should only be used in trusted corporate environments with internal certificates.

## Testing Your Configuration

After configuring proxy settings, test with a simple command:

```bash
task-master models
```

If the command succeeds and shows your configured models, the proxy is working correctly.

## Troubleshooting

### 403 Forbidden Error

If you see `Error: 403 {"error":{"type":"forbidden","message":"Request not allowed"}}`, check:

1. Proxy URL is correct and accessible
2. Proxy credentials are valid (if using authentication)
3. Corporate firewall allows connections to Anthropic API endpoints
4. You're in a supported geographic region for Claude Code

### Connection Timeout

If requests time out:

1. Verify proxy server is reachable: `curl -x http://proxy.company.com:8080 https://api.anthropic.com`
2. Check if proxy requires authentication
3. Ensure no typos in proxy URL

### Certificate Errors

If you see SSL/TLS certificate errors:

1. Your corporate proxy may use custom certificates
2. Add `NODE_TLS_REJECT_UNAUTHORIZED: "0"` to env (use with caution)
3. Or configure your system to trust corporate certificates

## Geographic Restrictions

Claude Code only works in supported countries. If you're outside a supported region:

1. Use a proxy/VPN that routes through a supported country
2. Configure the proxy in `env` as shown above
3. Ensure the proxy consistently routes all Claude Code traffic

## Security Considerations

- Store sensitive proxy credentials securely
- Consider using environment variables instead of hardcoding credentials
- Regularly rotate proxy passwords if required by your organization
- Use HTTPS proxies when possible for encrypted connections

## Support

For additional help:
- Check [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code/overview)
- Report issues at [Task Master GitHub](https://github.com/eyaltoledano/claude-task-master/issues)
- Contact your IT department for corporate proxy details
