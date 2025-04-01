/**
 * Test script for concept generation only
 * 
 * Run this with:
 * node test-concept.js
 */

import { ideateProductConcept } from './scripts/modules/task-manager.js';
import fs from 'fs';
import path from 'path';

// Set up a test directory
const testDir = './test-output';
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Define file path
const conceptFile = path.join(testDir, 'concept.txt');

// Test idea
const testIdea = "A task management system for software development projects";

async function runTest() {
  console.log("Starting concept generation test...");
  
  try {
    // Generate concept
    console.log("Generating concept from idea...");
    await ideateProductConcept(testIdea, conceptFile);
    console.log(`Concept generated: ${conceptFile}`);
    
    // Read and show a preview of the generated concept
    const conceptContent = fs.readFileSync(conceptFile, 'utf8');
    console.log("\nPreview of generated concept:");
    console.log("-".repeat(50));
    console.log(conceptContent.substring(0, 500) + "...");
    console.log("-".repeat(50));
    
    console.log("\nTest completed successfully!");
  } catch (error) {
    console.error("Error during test:", error);
  }
}

// Run the test
runTest(); 