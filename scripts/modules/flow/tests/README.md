# Task Master Flow Tests

This directory contains test scripts and utilities for testing Task Master Flow components and systems.

## Available Tests

### test-theme.js
Test script for the Flow theme system. Demonstrates:
- Theme detection (light/dark mode)
- Semantic colors
- Component theming
- Gradient effects
- Color utilities

**Run with:**
```bash
node scripts/modules/flow/tests/test-theme.js
```

## Adding New Tests

When creating new test scripts:
1. Name files with `test-` prefix (e.g., `test-navigation.js`)
2. Include clear documentation at the top of the file
3. Use the Flow theme system for any colored output
4. Export reusable test utilities when appropriate

## Test Categories

- **Visual Tests**: Theme system, UI components, color rendering
- **Integration Tests**: Backend communication, MCP integration
- **Unit Tests**: Individual component functionality
- **Performance Tests**: Rendering performance, data handling

## Notes

These are primarily manual test scripts for development and debugging. For automated testing, consider using a proper test framework like Jest or Mocha. 