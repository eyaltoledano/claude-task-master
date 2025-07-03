# Task Master E2E Tests

This directory contains the modern end-to-end test suite for Task Master AI. The JavaScript implementation provides parallel execution, better error handling, and improved maintainability compared to the legacy bash script.

## Features

- **Parallel Execution**: Run test groups concurrently for faster test completion
- **Modular Architecture**: Tests are organized into logical groups (setup, core, providers, advanced)
- **Comprehensive Logging**: Detailed logs with timestamps, cost tracking, and color-coded output
- **LLM Analysis**: Automatic analysis of test results using AI
- **Error Handling**: Robust error handling with categorization and recommendations
- **Flexible Configuration**: Easy to configure test settings and provider configurations

## Structure

```
tests/e2e/
├── config/
│   └── test-config.js      # Test configuration and settings
├── utils/
│   ├── logger.js           # Test logging utilities
│   ├── test-helpers.js     # Common test helper functions
│   ├── llm-analyzer.js     # LLM-based log analysis
│   └── error-handler.js    # Error handling and reporting
├── tests/
│   ├── setup.test.js       # Setup and initialization tests
│   ├── core.test.js        # Core task management tests
│   ├── providers.test.js   # Multi-provider tests
│   └── advanced.test.js    # Advanced feature tests
├── runners/
│   ├── parallel-runner.js  # Parallel test execution
│   └── test-worker.js      # Worker thread for parallel execution
├── run-e2e-tests.js        # Main test runner
├── run_e2e.sh              # Legacy bash implementation
└── e2e_helpers.sh          # Legacy bash helpers
```

## Usage

### Run All Tests (Recommended)

```bash
# Runs all test groups in the correct order
npm run test:e2e
```

### Run Tests Sequentially

```bash
# Runs all test groups sequentially instead of in parallel
npm run test:e2e:sequential
```

### Run Individual Test Groups

Each test command automatically handles setup if needed, creating a fresh test directory:

```bash
# Each command creates its own test environment automatically
npm run test:e2e:setup      # Setup only (initialize, parse PRD, analyze complexity)
npm run test:e2e:core       # Auto-runs setup + core tests (task CRUD, dependencies, status)
npm run test:e2e:providers  # Auto-runs setup + provider tests (multi-provider testing)
npm run test:e2e:advanced   # Auto-runs setup + advanced tests (tags, subtasks, expand)
```

**Note**: Each command creates a fresh test directory, so running individual tests will not share state. This ensures test isolation but means each run will parse the PRD and set up from scratch.

### Run Multiple Groups

```bash
# Specify multiple groups to run together
node tests/e2e/run-e2e-tests.js --groups core,providers

# This automatically runs setup first if needed
node tests/e2e/run-e2e-tests.js --groups providers,advanced
```

### Run Tests Against Existing Directory

If you want to reuse a test directory from a previous run:

```bash
# First, find your test directory from a previous run:
ls tests/e2e/_runs/

# Then run specific tests against that directory:
node tests/e2e/run-e2e-tests.js --groups core --test-dir tests/e2e/_runs/run_2025-07-03_094800611
```

### Analyze Existing Log
```bash
npm run test:e2e:analyze

# Or analyze specific log file
node tests/e2e/run-e2e-tests.js --analyze-log path/to/log.log
```

### Skip Verification Tests
```bash
node tests/e2e/run-e2e-tests.js --skip-verification
```

### Run Legacy Bash Tests
```bash
npm run test:e2e:bash
```

## Test Groups

### Setup (`setup`)
- NPM global linking
- Project initialization
- PRD parsing
- Complexity analysis

### Core (`core`)
- Task CRUD operations
- Dependency management
- Status management
- Subtask operations

### Providers (`providers`)
- Multi-provider add-task testing
- Provider comparison
- Model switching
- Error handling per provider

### Advanced (`advanced`)
- Tag management
- Model configuration
- Task expansion
- File generation

## Configuration

Edit `config/test-config.js` to customize:

- Test paths and directories
- Provider configurations
- Test prompts
- Parallel execution settings
- LLM analysis settings

## Output

- **Log Files**: Saved to `tests/e2e/log/` with timestamp
- **Test Artifacts**: Created in `tests/e2e/_runs/run_TIMESTAMP/`
- **Console Output**: Color-coded with progress indicators
- **Cost Tracking**: Automatic tracking of AI API costs

## Requirements

- Node.js >= 18.0.0
- Dependencies: chalk, boxen, dotenv, node-fetch
- System utilities: jq, bc
- Valid API keys in `.env` file

## Comparison with Bash Tests

| Feature | Bash Script | JavaScript |
|---------|------------|------------|
| Parallel Execution | ❌ | ✅ |
| Error Categorization | Basic | Advanced |
| Test Isolation | Limited | Full |
| Performance | Slower | Faster |
| Debugging | Harder | Easier |
| Cross-platform | Limited | Better |

## Troubleshooting

1. **Missing Dependencies**: Install system utilities with `brew install jq bc` (macOS) or `apt-get install jq bc` (Linux)
2. **API Errors**: Check `.env` file for valid API keys
3. **Permission Errors**: Ensure proper file permissions
4. **Timeout Issues**: Adjust timeout in config file

## Development

To add new tests:

1. Create a new test file in `tests/` directory
2. Export a default async function that accepts (logger, helpers, context)
3. Return a results object with status and errors
4. Add the test to appropriate group in `test-config.js`

Example test structure:
```javascript
export default async function myTest(logger, helpers, context) {
  const results = {
    status: 'passed',
    errors: []
  };

  try {
    logger.step('Running my test');
    // Test implementation
    logger.success('Test passed');
  } catch (error) {
    results.status = 'failed';
    results.errors.push(error.message);
  }

  return results;
}
```