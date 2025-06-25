# Testing Guide for Web commands

> **Looking for E2E test suite and test runner documentation?**  
> See [tests/e2e/web/README.md](../tests/e2e/web/README.md).

## E2E Test Development Guidelines

### Command Execution Rules

**NEVER** use direct CLI execution without timeout protection:

```bash
# ❌ DON'T: This can hang indefinitely
output=$($CLI_CMD some-command)
```

**ALWAYS** use timeout-protected functions from `e2e_helpers.sh`:

#### 1. For commands that SHOULD succeed:

```bash
# ✅ DO: Use expect_success for commands that should work
output=$(expect_success 30 "command-name" $CLI_CMD some-command --flag)
```

#### 2. For commands that SHOULD fail:

```bash
# ✅ DO: Use expect_failure for commands that should fail
output=$(expect_failure 10 "invalid-command" $CLI_CMD invalid --command)
```

#### 3. For commands with uncertain outcome:

```bash
# ✅ DO: Use safe_run_cmd when unsure of outcome
output=$(safe_run_cmd 20 "uncertain-command" $CLI_CMD some --command)
exit_code=$?
if [ $exit_code -eq 0 ]; then
    # Handle success
else
    # Handle failure
fi
```

### Timeout Guidelines

- **Simple commands**: 10-15 seconds
- **Server operations**: 30 seconds
- **AI operations**: 60-120 seconds

### Cross-Platform Compatibility

The timeout utilities automatically detect available timeout commands:

- **Linux**: Uses `timeout` command
- **macOS**: Uses `gtimeout` (from `brew install coreutils`)
- **Fallback**: Runs without timeout protection with warning

### Prevention of Hanging Issues

These patterns prevent common hanging scenarios:

- Commands waiting for user input
- Foreground servers that wait for Ctrl+C
- Network operations that timeout
- Infinite loops or deadlocks

### Examples from Fixed Tests

```bash
# Before (problematic):
error_output=$($CLI_CMD web-start --port=0 2>&1 || true)

# After (safe):
error_output=$(expect_failure 10 "zero-port" $CLI_CMD web-start --port=0)
```

This infrastructure ensures all E2E tests complete reliably without manual intervention.

## Web Server Build & Development

This guide provides instructions for building, running, and developing the web server and frontend components of Task Master.

<!-- For E2E and API test suite details, see the link at the top of this file. -->

### Development

To start the local development server for the frontend, which includes hot-reloading:

```bash
npm run dev:web
```

This command uses Vite to serve the frontend on a local port (typically `http://localhost:5173`). The underlying web API server is not started with this command; it is intended for frontend development in isolation.

### Building for Production

To create a production-ready build of the frontend assets:

```bash
npm run build:web
```

This will compile the React code and output the static assets to the `web/dist` directory.

### Running in Production Mode

To run the Node.js web server that serves the production-built frontend assets:

1.  **Build the assets first**:

    ```bash
    npm run build:web
    ```

2.  **Start the server**:
    ```bash
    npm run start:web
    ```

This starts the Express server (`web/server.js`), which serves the static files from `web/dist` and handles API requests.

### Previewing the Production Build

After building the assets, you can preview the production site without running the full Node.js server using Vite's preview command:

```bash
npm run preview:web
```

This is useful for quickly verifying that the production build works as expected.

### Scripts Overview

| Command               | Description                                                             | Environment   |
| --------------------- | ----------------------------------------------------------------------- | ------------- |
| `npm run dev:web`     | Starts the Vite dev server for frontend development with hot-reloading. | `development` |
| `npm run build:web`   | Builds the frontend assets for production into `web/dist`.              | `production`  |
| `npm run start:web`   | Starts the Node.js/Express server to serve production assets.           | `production`  |
| `npm run preview:web` | Serves the `web/dist` folder to preview the production build locally.   | `production`  |
| `npm run clean:web`   | Removes the `web/dist` directory.                                       | -             |
