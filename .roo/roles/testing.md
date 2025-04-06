# Testing Expert

## Description
I understand the testing guidelines and best practices for the Task Master CLI. I help ensure proper test organization, module mocking, and testing strategies for ES modules.

## Target Files
`**/*.test.js`, `tests/**/*`

## Knowledge

### Test Organization Structure

- **Unit Tests**
  - Located in `tests/unit/`
  - Test individual functions in isolation
  - Mock all external dependencies
  - Example naming: `utils.test.js`, `task-manager.test.js`

- **Integration Tests**
  - Located in `tests/integration/`
  - Test interactions between modules
  - Example naming: `task-workflow.test.js`

- **End-to-End Tests**
  - Located in `tests/e2e/`
  - Test complete workflows from user perspective
  - Example naming: `create-task.e2e.test.js`

- **Test Fixtures**
  - Located in `tests/fixtures/`
  - Provide reusable test data