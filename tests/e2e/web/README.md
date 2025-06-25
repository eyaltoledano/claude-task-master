# Task Master Web API - Modular E2E Tests

> **Looking for web server/frontend build and development instructions?**  
> See [web/Readme.md](../../web/Readme.md).

This directory contains modular End-to-End (E2E) tests for the Task Master Web API. The tests are organized into focused, independent test suites for better maintainability and targeted testing.

**Location**: `tests/e2e/web/` - All web API tests are organized in this subfolder for better organization.

## 🏗️ Test Structure

### Test Suites (Modular Runner)

The main modular test runner (`run_modular_tests.sh`) recognizes the following suites:

| Test Suite Name | Script File                   | Description                                     |
| --------------- | ----------------------------- | ----------------------------------------------- |
| core            | test_core_task_operations.sh  | Basic CRUD operations on tasks                  |
| subtasks        | test_subtask_operations.sh    | Subtask creation, updating, and management      |
| expansion       | test_task_expansion.sh        | AI-powered task expansion functionality         |
| dependencies    | test_dependency_management.sh | Dependency creation, validation, and management |
| movement        | test_task_movement.sh         | Task movement and reorganization                |
| tags            | test_tag_management.sh        | Tag creation, modification, and management      |
| analysis        | test_analysis_research.sh     | AI-powered analysis and research functionality  |
| errors          | test_error_handling.sh        | Comprehensive error handling and validation     |

These are the suites you can run with the modular runner and are listed with `--list`.

### Additional Test Scripts (Direct Execution)

The following scripts exist but are **not** included in the main modular runner. They can be run directly for additional coverage:

| Script File                      | Description                                                      |
| -------------------------------- | ---------------------------------------------------------------- |
| test_web_server_functionality.sh | Comprehensive E2E for web server CLI (daemon, status, websocket) |
| test_web_basic_functionality.sh  | Basic web server CLI E2E (start/stop/status)                     |
| test_web_error_handling.sh       | Web server CLI error handling (port conflicts, invalid ports)    |
| test_robustness_improvements.sh  | Robustness, health monitoring, tag validation, error recovery    |

**To run these scripts:**

```bash
./tests/e2e/web/test_web_server_functionality.sh
# or
./tests/e2e/web/test_robustness_improvements.sh
```

## 🚀 Quick Start

### Prerequisites

1. **Start the web server in test mode**:

   ```bash
   # Option 1: Using npm script
   npm run start:web

   # Option 2: Direct node command
   node web/server.js --port=3002
   ```

2. **Verify server is running**:
   ```bash
   curl http://localhost:3002/api/health
   ```

### Running Tests

#### Using the Modular Test Runner (Recommended)

```bash
# Run all test suites
./tests/e2e/web/run_modular_tests.sh

# Run specific test suites
./tests/e2e/web/run_modular_tests.sh core subtasks errors

# Run with verbose output
./tests/e2e/web/run_modular_tests.sh --verbose analysis

# Run in parallel (not recommended - may cause server issues)
./tests/e2e/web/run_modular_tests.sh --parallel --all

# List available test suites
./tests/e2e/web/run_modular_tests.sh --list

# Show help
./tests/e2e/web/run_modular_tests.sh --help
```

#### Running Individual Test Files

```bash
# Run a specific test suite directly
./tests/e2e/web/test_core_task_operations.sh

# Run error handling tests
./tests/e2e/web/test_error_handling.sh

# Run tag management tests
./tests/e2e/web/test_tag_management.sh
```

## 📊 Test Runner Features

### Command Line Options

| Option              | Description                              |
| ------------------- | ---------------------------------------- |
| `-h, --help`        | Show help message                        |
| `-l, --list`        | List available test suites               |
| `-a, --all`         | Run all test suites (default)            |
| `-v, --verbose`     | Enable verbose output                    |
| `-q, --quiet`       | Suppress test output (show only summary) |
| `--port PORT`       | Use custom port (default: 3002)          |
| `--no-server-check` | Skip server availability check           |
| `--parallel`        | Run tests in parallel (not recommended)  |

### Test Suite Names

| Name           | Description           |
| -------------- | --------------------- |
| `core`         | Core task operations  |
| `subtasks`     | Subtask operations    |
| `expansion`    | Task expansion        |
| `dependencies` | Dependency management |
| `movement`     | Task movement         |
| `tags`         | Tag management        |
| `analysis`     | Analysis and research |
| `errors`       | Error handling        |

### Example Usage

```bash
# Run all tests with summary output
./tests/e2e/web/run_modular_tests.sh

# Run core and error tests with verbose output
./tests/e2e/web/run_modular_tests.sh --verbose core errors

# Run all tests with quiet mode (sequential)
./tests/e2e/web/run_modular_tests.sh --quiet

# Run specific tests on custom port
./tests/e2e/web/run_modular_tests.sh --port 3003 tags movement
```

## 🔧 Test Environment

### Test Mode Configuration

The tests require the web server to be running in **test mode** to ensure:

- Tests use `.taskmaster-test/` directory instead of `.taskmaster/`
- Production data is protected from test pollution
- Proper isolation between test runs

### Environment Variables

```bash
export TASKMASTER_TEST_MODE=true  # Automatically set by test utilities
TEST_PORT=3002                    # Default test port
```

### Test Data Management

- **Automatic Cleanup**: Tests automatically clean up created tasks and tags
- **Unique IDs**: Tests generate unique IDs to avoid conflicts
- **Isolation**: Each test suite can run independently
- **Shared State**: Tests use shared utilities for consistent behavior

### Sequential vs Parallel Execution

**Sequential execution is recommended** for the following reasons:

- **Single Server Bottleneck**: All tests hit the same local server instance
- **AI Service Limitations**: Task creation involves AI calls that can take 15+ seconds
- **Server Stability**: Concurrent AI requests can overwhelm the server and cause crashes
- **Predictable Results**: Sequential execution is more reliable and easier to debug
- **Simple Setup**: One developer, one server, one test run at a time

**Parallel execution** is available but not recommended because:

- May cause server timeouts or crashes under load
- AI rate limiting can cause test failures
- Debugging concurrent failures is more complex
- Time savings are minimal due to server bottlenecks

## 📝 Test Coverage

### API Endpoints Tested

The modular tests cover all 32 API endpoints across 8 functional areas:

#### Core Task Operations (11 endpoints)

- `GET /api/health` - Health check
- `GET /api/tasks` - List all tasks
- `GET /api/tasks` (with filters) - List filtered tasks
- `POST /api/tasks` - Create new task
- `GET /api/tasks/next` - Get next available task
- `GET /api/tasks/:id` - Show specific task
- `GET /api/tasks/:ids` - Show multiple tasks
- `PUT /api/tasks/:id` - Update specific task
- `PUT /api/tasks/bulk-update` - Bulk update tasks
- `PATCH /api/tasks/:id/status` - Set task status
- `DELETE /api/tasks/:id` - Delete task

#### Subtask Operations (3 endpoints)

- `POST /api/tasks/:id/subtasks` - Add subtask
- `PUT /api/tasks/:id/subtasks/:subtaskId` - Update subtask
- `DELETE /api/tasks/:id/subtasks/:subtaskId` - Remove subtask

#### Task Expansion (4 endpoints)

- `POST /api/tasks/:id/expand` - Expand single task
- `POST /api/tasks/expand-all` - Expand all tasks
- `DELETE /api/tasks/:id/subtasks` - Clear subtasks
- `POST /api/analysis/complexity` - Analyze complexity

#### Dependency Management (4 endpoints)

- `POST /api/tasks/:id/dependencies` - Add dependency
- `DELETE /api/tasks/:id/dependencies/:dependencyId` - Remove dependency
- `GET /api/tasks/validate-dependencies` - Validate dependencies
- `PUT /api/tasks/fix-dependencies` - Fix dependencies

#### Task Movement (2 endpoints)

- `PUT /api/tasks/:id/move/:targetId` - Move single task
- `PUT /api/tasks/move-batch` - Move multiple tasks

#### Tag Management (6 endpoints)

- `GET /api/tags` - List all tags
- `POST /api/tags` - Create new tag
- `PUT /api/tags/:name` - Update tag
- `DELETE /api/tags/:name` - Delete tag
- `PUT /api/tags/:name/use` - Switch to tag
- `POST /api/tags/:source/copy/:target` - Copy tag

#### Analysis & Research (3 endpoints)

- `POST /api/analysis/complexity` - Analyze task complexity
- `GET /api/analysis/complexity-report` - Get complexity report
- `POST /api/research` - Perform research

#### Error Handling

- Comprehensive validation testing across all endpoints
- HTTP status code verification
- Content-Type validation
- Payload size limits
- Malformed request handling

## 🛠️ Development

### Adding New Tests

1. **Create a new test file** following the naming convention:

   ```bash
   tests/e2e/web/test_new_feature.sh
   ```

2. **Use the standard template**:

   ```bash
   #!/bin/bash
   set -euo pipefail

   # New Feature E2E Test
   # Tests new feature functionality

   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
   source "$SCRIPT_DIR/shared/test-utils.sh"

   echo "=== Task Master Web API - New Feature Test ==="

   # Setup environment and cleanup trap
   setup_test_environment
   setup_cleanup_trap

   # Your tests here...

   echo "🎉 NEW FEATURE TESTS COMPLETED!"
   ```

3. **Update the test runner** by adding the new test to the `TEST_SUITE_NAMES` and `TEST_SUITE_FILES` arrays in `run_modular_tests.sh`

4. **Make the test executable**:
   ```bash
   chmod +x tests/e2e/web/test_new_feature.sh
   ```

### Debugging Tests

#### Verbose Mode

```bash
./tests/e2e/web/run_modular_tests.sh --verbose errors
```

#### Running Individual Tests

```bash
./tests/e2e/web/test_core_task_operations.sh
```

#### Checking Server Logs

```bash
# If running server manually
tail -f /path/to/server/logs

# Check server health
curl -v http://localhost:3002/api/health
```

### Best Practices

1. **Use shared utilities** for common operations
2. **Clean up test data** automatically with traps
3. **Generate unique IDs** to avoid conflicts
4. **Test both success and error cases**
5. **Verify HTTP status codes** and response structure
6. **Include descriptive test names** and output

## 🔍 Troubleshooting

### Common Issues

#### Server Not Running

```
❌ Server not accessible at http://localhost:3002
```

**Solution**: Start the server in test mode:

```bash
node web/server.js --port=3002 --test-mode
```

#### Permission Denied

```
bash: ./tests/e2e/run_modular_tests.sh: Permission denied
```

**Solution**: Make the script executable:

```bash
chmod +x tests/e2e/run_modular_tests.sh
```

#### Test Data Conflicts

```
❌ Task creation failed - ID already exists
```

**Solution**: Tests use unique ID generation, but if conflicts occur, clean up manually:

```bash
# Clean test directory
rm -rf .taskmaster-test/
```

#### Parallel Test Issues

```
❌ Some tests failed in parallel mode
```

**Solution**: Run tests sequentially for debugging:

```bash
./tests/e2e/web/run_modular_tests.sh --verbose core
```

### Getting Help

1. **Check test output** with verbose mode
2. **Run individual test suites** to isolate issues
3. **Verify server is in test mode** and accessible
4. **Check for port conflicts** if using custom ports
5. **Review server logs** for API errors

## 📈 Migration from Monolithic Tests

The modular structure provides several advantages over the original monolithic test file:

### Benefits

- **Focused Testing**: Run only the tests you need
- **Parallel Execution**: Run multiple test suites simultaneously
- **Better Debugging**: Isolate issues to specific functional areas
- **Maintenance**: Easier to update and maintain individual test areas
- **CI/CD Integration**: Better integration with continuous integration pipelines

### Migration Path

1. Use the modular test runner for new development
2. Gradually migrate existing test scripts to use modular approach
3. Leverage parallel execution for faster feedback cycles
4. Customize test suites based on development focus areas
