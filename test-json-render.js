#!/usr/bin/env node

/**
 * test-json-render.js
 * 
 * Simple test script to verify JSON rendering functionality
 */

import fs from 'fs';
import path from 'path';
import { renderJsonContent } from './scripts/modules/markdown-renderer.js';

// Sample JSON data to render
const testJsonObject = {
  "name": "Task Master",
  "version": "1.0.0",
  "description": "A task management system for AI-driven development",
  "features": [
    "Task Management",
    "PRD Parsing",
    "Rich Text Rendering",
    "JSON Formatting"
  ],
  "components": {
    "cli": {
      "commands": [
        "list",
        "next",
        "show",
        "expand"
      ]
    },
    "rendering": {
      "formats": [
        "Markdown",
        "JSON",
        "TaskFiles"
      ],
      "libraries": [
        "marked",
        "marked-terminal",
        "chalk"
      ]
    }
  },
  "statistics": {
    "taskCount": 15,
    "completedTasks": 5,
    "pendingTasks": 10
  }
};

// Test rendering JSON object
console.log("\n=== Rendering JSON Object ===\n");
console.log(renderJsonContent(testJsonObject));

// Try to read tasks.json if it exists
try {
  const tasksPath = path.join(process.cwd(), 'tasks', 'tasks.json');
  if (fs.existsSync(tasksPath)) {
    const tasksJson = fs.readFileSync(tasksPath, 'utf8');
    console.log("\n=== Rendering tasks.json ===\n");
    console.log(renderJsonContent(tasksJson));
  } else {
    console.log("\nTasks file not found at:", tasksPath);
  }
} catch (error) {
  console.error("Error reading tasks.json:", error.message);
}

console.log("\n=== Test Complete ===\n"); 