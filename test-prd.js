/**
 * Test script for PRD generation functionality
 * 
 * Run this with:
 * node test-prd.js
 */

import { ideateProductConcept, simulateRoundTable, refineProductConcept, generatePRDFile } from './scripts/modules/task-manager.js';
import fs from 'fs';
import path from 'path';

// Set up a test directory
const testDir = './test-output';
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Define file paths
const conceptFile = path.join(testDir, 'concept.txt');
const discussionFile = path.join(testDir, 'discussion.txt');
const refinedConceptFile = path.join(testDir, 'refined-concept.txt');
const prdFile = path.join(testDir, 'prd.txt');

// Test idea
const testIdea = "A task management system for software development projects";

// Test participants
const testParticipants = [
  "Senior Software Engineer",
  "Product Manager",
  "UX Designer",
  "QA Specialist"
];

// Test refinement prompt
const testPrompt = "Focus on features that help with dependency tracking between tasks";

async function runTest() {
  console.log("Starting PRD generation test...");
  
  try {
    // Step 1: Generate concept
    console.log("Step 1: Generating concept from idea...");
    await ideateProductConcept(testIdea, conceptFile);
    console.log(`Concept generated: ${conceptFile}`);
    
    // Step 2: Simulate round table
    console.log("\nStep 2: Simulating expert discussion...");
    await simulateRoundTable(conceptFile, testParticipants, discussionFile, false);
    console.log(`Discussion generated: ${discussionFile}`);
    
    // Step 3: Refine concept
    console.log("\nStep 3: Refining concept...");
    await refineProductConcept(conceptFile, testPrompt, discussionFile, refinedConceptFile);
    console.log(`Refined concept generated: ${refinedConceptFile}`);
    
    // Step 4: Generate PRD
    console.log("\nStep 4: Generating PRD...");
    await generatePRDFile(refinedConceptFile, "", prdFile, false);
    console.log(`PRD generated: ${prdFile}`);
    
    console.log("\nTest completed successfully!");
    console.log("Generated files:");
    console.log(`- ${conceptFile}`);
    console.log(`- ${discussionFile}`);
    console.log(`- ${refinedConceptFile}`);
    console.log(`- ${prdFile}`);
  } catch (error) {
    console.error("Error during test:", error);
  }
}

// Run the test
runTest(); 