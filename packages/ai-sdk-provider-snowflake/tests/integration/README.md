# Integration Tests

This directory contains organized integration tests for the Snowflake AI SDK Provider, broken down by feature domain for better maintainability and clarity.

## Test Structure

```
integration/
├── auth.test.ts                           # Authentication tests
├── execution-modes/                       # Execution mode tests
│   ├── rest-api.test.ts                  # REST API mode
│   ├── cli-mode.test.ts                  # CLI mode
│   └── auto-mode.test.ts                 # (covered in provider/configuration.test.ts)
├── provider/                              # Provider configuration tests
│   └── configuration.test.ts             # Provider setup and configuration
├── models/                                # Model-related tests
│   ├── model-ids.test.ts                 # Model ID handling
│   ├── capabilities.test.ts              # Model capability matrix
│   └── utilities.test.ts                 # ModelHelpers utilities
├── features/                              # Feature-specific tests
│   ├── claude-specific.test.ts           # Claude model features
│   ├── structured-outputs-e2e.test.ts    # Structured output generation
│   ├── prompt-caching.test.ts            # (existing)
│   ├── streaming.test.ts                 # (existing)
│   ├── structured-outputs.test.ts        # (existing)
│   └── thinking-reasoning.test.ts        # (existing)
├── schema/                                # Schema transformation tests
│   └── transformation.test.ts            # JSON schema cleaning
├── error-handling.test.ts                # Error handling tests
└── performance/                           # Performance tests
    └── benchmarks.test.ts                # Performance benchmarks
```

## Running Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific test file
npm test tests/integration/auth.test.ts

# Run tests in a directory
npm test tests/integration/models/

# Run with coverage
npm run test:coverage -- --testPathPattern=integration
```

## Test Categories

### Authentication (`auth.test.ts`)
- Basic authentication with credentials
- Token caching and reuse
- Connection-specific authentication
- Base URL validation

### Execution Modes (`execution-modes/`)
- **REST API Mode**: Text generation, streaming, structured output
- **CLI Mode**: CLI execution, streaming limitations
- **Auto Mode**: Automatic mode detection (in provider/configuration.test.ts)

### Provider Configuration (`provider/`)
- Provider creation with various settings
- Execution mode configuration
- Connection configuration
- Default provider instance

### Model Tests (`models/`)
- **Model IDs**: Prefix handling, model variations
- **Capabilities**: Structured output support, temperature support, model matrix
- **Utilities**: Model ID normalization, capability detection

### Feature Tests (`features/`)
- **Claude-Specific**: Prompt caching, reasoning mode
- **Structured Outputs**: Object generation, schema handling
- **Existing Features**: Prompt caching, streaming, thinking/reasoning

### Schema Tests (`schema/`)
- Schema transformation and cleaning
- Constraint removal (string, number, array)
- Nested schema handling
- anyOf/null flattening

### Error Handling (`error-handling.test.ts`)
- Invalid model errors
- Empty prompt handling
- Malformed JSON handling
- Missing schema errors

### Performance (`performance/`)
- Token caching performance
- Rapid sequential calls
- Function performance benchmarks

## Test Patterns

### Parallel Execution
Tests use `it.concurrent` for parallel execution where appropriate:

```typescript
it.concurrent('should test something', async () => {
  // Test implementation
}, 60000);
```

### Matrix Tests
Use `it.concurrent.each` for testing multiple variations:

```typescript
it.concurrent.each(testMatrix)(
  'should handle: %s',
  async (name, input, expected) => {
    // Test implementation
  },
  60000
);
```

### Credential Gating
Tests are wrapped with `describeWithCredentials` to skip when credentials are unavailable:

```typescript
describeWithCredentials('Test Suite Name', () => {
  // Tests that require Snowflake credentials
});
```

## Environment Setup

These tests require actual Snowflake credentials. See the main integration test file header or project documentation for setup details.

## Migration Notes

The original monolithic `integration.test.ts` file has been reorganized into this feature-based structure for better maintainability.

