## ✨ New Feature

### 📋 Feature Description
Command-based API key resolution using `!cmd:` prefix allows retrieving API keys from secure credential managers instead of hardcoding them in configuration files.

### 🎯 Problem Statement
Hardcoded API keys in `.env` files and MCP configurations pose security risks:
- Keys get accidentally committed to version control
- Difficult to share `.env.example` files without exposing actual credentials
- Key rotation requires manual updates across all configuration files
- No integration with enterprise credential management systems

### 💡 Solution
Implemented `!cmd:` prefix syntax that executes shell commands to retrieve API keys dynamically:
- Commands executed synchronously using `/bin/sh`
- Output automatically trimmed and validated
- Configurable timeout via `TASKMASTER_CMD_TIMEOUT`
- Sanitized error logging (never exposes commands or outputs)
- Fully backward compatible with plain text keys

**Implementation details:**
- Added `parseTimeout()` helper for smart timeout parsing (seconds vs milliseconds)
- Added `executeCommandForKey()` for secure command execution with cross-platform shell support
- Extended `resolveEnvVariable()` to detect and process `!cmd:` prefix
- Uses `shell: true` for automatic platform-specific shell detection (cmd.exe on Windows, /bin/sh on POSIX)
- Comprehensive test suite with 22 passing tests

### 🔗 Related Issues
<!-- Link related issues: Fixes #123, Part of #456 -->

## How to Use It

### Quick Start
```bash
# In your .env file, replace plain text keys with command-based retrieval
ANTHROPIC_API_KEY=!cmd:security find-generic-password -a taskmaster -s anthropic -w
```

### Example
**macOS Keychain:**
```bash
# Store key in macOS Keychain first
security add-generic-password -a taskmaster -s anthropic -w sk-ant-api03-xxxxx

# Then use in .env
ANTHROPIC_API_KEY=!cmd:security find-generic-password -a taskmaster -s anthropic -w
```

**pass (password-store):**
```bash
# Store key in pass
pass insert taskmaster/openai

# Then use in .env
OPENAI_API_KEY=!cmd:pass show taskmaster/openai
```

**1Password CLI:**
```bash
# Use 1Password CLI
PERPLEXITY_API_KEY=!cmd:op item get "Perplexity API" --field credential
```

**AWS Secrets Manager:**
```bash
# Retrieve from AWS Secrets Manager
GOOGLE_API_KEY=!cmd:aws secretsmanager get-secret-value --secret-id taskmaster/google --query SecretString --output text
```

**What you should see:**
- API keys retrieved seamlessly from your credential manager
- On failure: Error logged with key name and error type only (no command/output exposure)
- Backward compatibility: Plain text keys continue to work

### Configuration Options
```bash
# Optional: Configure command timeout (default: 5000ms)
TASKMASTER_CMD_TIMEOUT=5           # <=60 treated as seconds
TASKMASTER_CMD_TIMEOUT=10000       # >60 treated as milliseconds
```

## Contributor Checklist
- [x] Created changeset: `npm run changeset`
- [x] Tests pass: `npm test` (22 new tests passing)
- [x] Format check passes: `npm run format-check`
- [x] Addressed CodeRabbit comments
- [x] Added tests for new functionality (utils-command-keys.test.js)
- [x] Manually tested in CLI mode ✅
- [x] Manually tested in MCP mode (if applicable) ✅
- [x] Documentation updated (.env.example, README.md, docs/configuration.md)
- [x] Version bumped to 0.30.0

## Changelog Entry
Added command-based API key resolution with `!cmd:` prefix - retrieve keys from credential managers (macOS Keychain, pass, 1Password CLI, AWS Secrets Manager, etc.) instead of hardcoding them in config files. Improves security and enables sharing .env.example files safely.

---

### For Maintainers

- [ ] Feature aligns with project vision
- [ ] CIs pass
- [ ] Changeset file exists
