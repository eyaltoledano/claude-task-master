# Testing Roo Integration

This document provides instructions for testing the Roo integration in the Task Master package.

## Running Tests

To run the tests for the Roo integration:

```bash
# Run all tests
npm test

# Run only Roo integration tests
npm test -- -t "Roo"

# Run specific test file
npm test -- tests/integration/roo-files-inclusion.test.js
```

## Manual Testing

To manually verify that the Roo files are properly included in the package:

1. Create a test directory:

   ```bash
   mkdir test-tm
   cd test-tm
   ```

2. Create a package.json file:

   ```bash
   npm init -y
   ```

3. Install the task-master-ai package locally:

   ```bash
   # From the root of the claude-task-master repository
   cd ..
   npm pack
   # This will create a file like task-master-ai-0.12.0.tgz

   # Move back to the test directory
   cd test-tm
   npm install ../task-master-ai-0.12.0.tgz
   ```

4. Initialize a new Task Master project:

   ```bash
   npx task-master init --yes
   ```

5. Verify that all Roo files and directories are created:

   ```bash
   # Check that .roomodes file exists
   ls -la | grep .roomodes

   # Check that .roo directory exists and contains all mode directories
   ls -la .roo
   ls -la .roo/rules
   ls -la .roo/rules-architect
   ls -la .roo/rules-ask
   ls -la .roo/rules-boomerang
   ls -la .roo/rules-code
   ls -la .roo/rules-debug
   ls -la .roo/rules-test
   ```

## What to Look For

When running the tests or performing manual verification, ensure that:

1. The package includes `.roo/**` and `.roomodes` in the `files` array in package.json
2. The `prepare-package.js` script verifies the existence of all required Roo files
3. The `init.js` script creates all necessary .roo directories and copies .roomodes file
4. All source files for Roo integration exist in `assets/roocode/.roo` and `assets/roocode/.roomodes`

## Compatibility

Ensure that the Roo integration works alongside existing Cursor functionality:

1. Initialize a new project that uses both Cursor and Roo:

   ```bash
   npx task-master init --yes
   ```

2. Verify that both `.cursor` and `.roo` directories are created
3. Verify that both `.windsurfrules` and `.roomodes` files are created
4. Confirm that existing functionality continues to work as expected
