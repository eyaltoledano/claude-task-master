/**
 * Unit tests for the JSON Storage module
 * 
 * Note: These are functional tests that use a temporary directory to ensure actual file operations work.
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Use real fs for functional tests, but mock console.log to silence output
global.console.log = jest.fn();

// Import the module under test
import {
  saveConceptResponse,
  getConceptResponse,
  listConceptResponses,
  saveQuestionResponses,
  getQuestionResponses,
  generateSessionId,
  storagePaths
} from '../../scripts/modules/json-storage.js';

describe('JSON Storage Module', () => {
  // Create a temp test directory for storage
  const TEST_DIR = path.join(os.tmpdir(), `json-storage-test-${Date.now()}`);
  const TEST_CONCEPT_FILE = path.join(TEST_DIR, 'test-concepts.json');
  const TEST_RESPONSES_FILE = path.join(TEST_DIR, 'test-responses.json');
  
  // Set up the test environment
  beforeAll(() => {
    // Create the test directory
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });
  
  // Clean up after all tests
  afterAll(() => {
    // Remove test files and directory
    if (fs.existsSync(TEST_CONCEPT_FILE)) {
      fs.unlinkSync(TEST_CONCEPT_FILE);
    }
    if (fs.existsSync(TEST_RESPONSES_FILE)) {
      fs.unlinkSync(TEST_RESPONSES_FILE);
    }
    if (fs.existsSync(TEST_DIR)) {
      fs.rmdirSync(TEST_DIR);
    }
  });
  
  // Set up test variables
  const testConceptId = 'test-concept-123';
  const testCommandId = 'ideate';
  const testSessionId = 'test-session-123';
  const testResponseData = { foo: 'bar', baz: 42 };
  const testQuestionResponses = {
    question1: 'answer1',
    question2: 'answer2'
  };
  
  describe('saveConceptResponse and getConceptResponse', () => {
    test('should save and retrieve concept data', async () => {
      // Save the concept response
      const savedData = await saveConceptResponse(testConceptId, testResponseData, TEST_CONCEPT_FILE);
      
      // Verify that file was created
      expect(fs.existsSync(TEST_CONCEPT_FILE)).toBeTruthy();
      
      // Retrieve the concept response
      const retrievedData = await getConceptResponse(testConceptId, TEST_CONCEPT_FILE);
      
      // Verify the data matches
      expect(retrievedData).toMatchObject(testResponseData);
      expect(retrievedData.updatedAt).toBeDefined();
    });
    
    test('should return null when concept does not exist', async () => {
      const result = await getConceptResponse('non-existent', TEST_CONCEPT_FILE);
      expect(result).toBeNull();
    });
  });
  
  describe('listConceptResponses', () => {
    test('should list all stored concepts', async () => {
      // Save another concept
      await saveConceptResponse('test-concept-456', { name: 'Another Concept' }, TEST_CONCEPT_FILE);
      
      // List all concepts
      const allConcepts = await listConceptResponses(TEST_CONCEPT_FILE);
      
      // Verify both concepts are in the result
      expect(Object.keys(allConcepts).length).toBe(2);
      expect(allConcepts[testConceptId]).toBeDefined();
      expect(allConcepts['test-concept-456']).toBeDefined();
    });
  });
  
  describe('saveQuestionResponses and getQuestionResponses', () => {
    test('should save and retrieve question response data', async () => {
      // Save question responses
      await saveQuestionResponses(testCommandId, testSessionId, testQuestionResponses, TEST_RESPONSES_FILE);
      
      // Verify file exists
      expect(fs.existsSync(TEST_RESPONSES_FILE)).toBeTruthy();
      
      // Retrieve question responses
      const retrievedData = await getQuestionResponses(testCommandId, testSessionId, TEST_RESPONSES_FILE);
      
      // Verify data
      expect(retrievedData.responses).toEqual(testQuestionResponses);
      expect(retrievedData.timestamp).toBeDefined();
    });
    
    test('should return null for non-existent session', async () => {
      const result = await getQuestionResponses(testCommandId, 'non-existent', TEST_RESPONSES_FILE);
      expect(result).toBeNull();
    });
  });
  
  describe('generateSessionId', () => {
    test('should generate a unique session ID', () => {
      const sessionId = generateSessionId();
      expect(sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
    });
    
    test('should generate different IDs on consecutive calls', () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();
      expect(id1).not.toEqual(id2);
    });
  });
  
  describe('storagePaths', () => {
    test('should export storage path constants', () => {
      expect(storagePaths.DEFAULT_STORAGE_DIR).toBeDefined();
      expect(storagePaths.DEFAULT_CONCEPT_STORAGE).toBeDefined();
      expect(storagePaths.DEFAULT_RESPONSES_STORAGE).toBeDefined();
    });
  });
}); 