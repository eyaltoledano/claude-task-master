/**
 * Feature test for JSON rendering functionality
 * Tests various scenarios of JSON rendering to ensure proper formatting and display
 */

import { renderJsonContent } from '../scripts/modules/markdown-renderer.js';

// Test helper function to run and log a test
function runTest(name, testFn) {
  console.log(`\n=== ${name} ===\n`);
  try {
    testFn();
    console.log(`✅ ${name} completed successfully`);
  } catch (error) {
    console.error(`❌ ${name} failed:`, error.message);
  }
}

// Test 1: Simple JSON object
runTest('Simple JSON Object', () => {
  const simpleJson = {
    name: "Test Project",
    version: "1.0.0",
    active: true
  };
  
  console.log(renderJsonContent(simpleJson));
});

// Test 2: Complex nested JSON
runTest('Complex Nested JSON', () => {
  const complexJson = {
    application: "Task Master",
    config: {
      features: ["tasks", "complexity", "json"],
      settings: {
        theme: "dark",
        fontSize: 14,
        showHidden: false
      }
    },
    statistics: {
      users: 42,
      tasks: {
        total: 156,
        completed: 89,
        pending: 67
      }
    },
    tags: ["dev", "testing", "documentation"]
  };
  
  console.log(renderJsonContent(complexJson));
});

// Test 3: JSON string input
runTest('JSON String Input', () => {
  const jsonString = '{"message": "This is a JSON string", "code": 200, "data": [1, 2, 3]}';
  
  console.log(renderJsonContent(jsonString));
});

// Test 4: Invalid JSON string (should handle gracefully)
runTest('Invalid JSON String', () => {
  const invalidJson = '{"broken": "json", missing: quotes}';
  
  console.log(renderJsonContent(invalidJson));
});

// Test 5: Empty object
runTest('Empty Object', () => {
  console.log(renderJsonContent({}));
});

// Test 6: Array of objects
runTest('Array of Objects', () => {
  const arrayOfObjects = [
    { id: 1, name: "Task 1", priority: "high" },
    { id: 2, name: "Task 2", priority: "medium" },
    { id: 3, name: "Task 3", priority: "low" }
  ];
  
  console.log(renderJsonContent(arrayOfObjects));
});

// Test 7: Large dataset (test performance)
runTest('Large Dataset', () => {
  const largeData = {
    items: Array(50).fill(0).map((_, i) => ({
      id: i,
      name: `Item ${i}`,
      description: `This is item number ${i} in the large dataset test`,
      metadata: {
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        tags: [`tag${i % 5}`, `category${i % 3}`]
      }
    }))
  };
  
  console.log(renderJsonContent(largeData));
});

console.log("\n=== All JSON Rendering Tests Complete ==="); 