/**
 * JSON Storage Module
 * 
 * Provides functionality to store and retrieve command responses in JSON format
 * for interoperability between the CLI and MCP server.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the directory name using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Default storage paths
const DEFAULT_STORAGE_DIR = path.join(dirname(__dirname), 'data');
const DEFAULT_CONCEPT_STORAGE = path.join(DEFAULT_STORAGE_DIR, 'concepts.json');
const DEFAULT_RESPONSES_STORAGE = path.join(DEFAULT_STORAGE_DIR, 'responses.json');

/**
 * Custom logger for the module - can be replaced with a proper logger
 * @param {string} level - Log level
 * @param {string} message - Message to log
 */
function log(level, message) {
  if (process.env.DEBUG === 'true') {
    console.log(`[${level.toUpperCase()}] ${message}`);
  }
}

/**
 * Ensures the storage directory exists
 * @param {string} storagePath - Path to the storage file
 * @returns {void}
 */
function ensureStorageExists(storagePath) {
  const storageDir = path.dirname(storagePath);
  
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
    log('info', `Created storage directory: ${storageDir}`);
  }
  
  if (!fs.existsSync(storagePath)) {
    fs.writeFileSync(storagePath, JSON.stringify({}, null, 2), 'utf8');
    log('info', `Created storage file: ${storagePath}`);
  }
}

/**
 * Saves concept response data to JSON storage
 * @param {string} conceptId - Unique identifier for the concept
 * @param {Object} responseData - The response data to store
 * @param {string} [storagePath=DEFAULT_CONCEPT_STORAGE] - Path to the storage file
 * @returns {Object} The saved data
 */
export async function saveConceptResponse(conceptId, responseData, storagePath = DEFAULT_CONCEPT_STORAGE) {
  try {
    ensureStorageExists(storagePath);
    
    // Read existing data
    const existingData = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
    
    // Add new data
    existingData[conceptId] = {
      ...responseData,
      updatedAt: new Date().toISOString()
    };
    
    // Write back to file
    fs.writeFileSync(storagePath, JSON.stringify(existingData, null, 2), 'utf8');
    log('info', `Saved concept response for ID: ${conceptId}`);
    
    return existingData[conceptId];
  } catch (error) {
    log('error', `Error saving concept response: ${error.message}`);
    throw error;
  }
}

/**
 * Retrieves concept response data from JSON storage
 * @param {string} conceptId - Unique identifier for the concept
 * @param {string} [storagePath=DEFAULT_CONCEPT_STORAGE] - Path to the storage file
 * @returns {Object|null} The retrieved data or null if not found
 */
export async function getConceptResponse(conceptId, storagePath = DEFAULT_CONCEPT_STORAGE) {
  try {
    if (!fs.existsSync(storagePath)) {
      log('warn', `Storage file not found: ${storagePath}`);
      return null;
    }
    
    const data = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
    return data[conceptId] || null;
  } catch (error) {
    log('error', `Error retrieving concept response: ${error.message}`);
    throw error;
  }
}

/**
 * Lists all stored concept responses
 * @param {string} [storagePath=DEFAULT_CONCEPT_STORAGE] - Path to the storage file
 * @returns {Object} Object containing all stored concepts
 */
export async function listConceptResponses(storagePath = DEFAULT_CONCEPT_STORAGE) {
  try {
    if (!fs.existsSync(storagePath)) {
      log('warn', `Storage file not found: ${storagePath}`);
      return {};
    }
    
    return JSON.parse(fs.readFileSync(storagePath, 'utf8'));
  } catch (error) {
    log('error', `Error listing concept responses: ${error.message}`);
    throw error;
  }
}

/**
 * Saves question responses from interactive prompts
 * @param {string} commandId - Identifier for the command (e.g., 'ideate')
 * @param {string} sessionId - Unique session identifier
 * @param {Object} responses - The user's responses to prompts
 * @param {string} [storagePath=DEFAULT_RESPONSES_STORAGE] - Path to the storage file
 * @returns {Object} The saved data
 */
export async function saveQuestionResponses(commandId, sessionId, responses, storagePath = DEFAULT_RESPONSES_STORAGE) {
  try {
    ensureStorageExists(storagePath);
    
    // Read existing data
    const existingData = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
    
    // Initialize command section if it doesn't exist
    if (!existingData[commandId]) {
      existingData[commandId] = {};
    }
    
    // Add new session data
    existingData[commandId][sessionId] = {
      responses,
      timestamp: new Date().toISOString()
    };
    
    // Write back to file
    fs.writeFileSync(storagePath, JSON.stringify(existingData, null, 2), 'utf8');
    log('info', `Saved responses for command: ${commandId}, session: ${sessionId}`);
    
    return existingData[commandId][sessionId];
  } catch (error) {
    log('error', `Error saving question responses: ${error.message}`);
    throw error;
  }
}

/**
 * Retrieves question responses for a specific session
 * @param {string} commandId - Identifier for the command
 * @param {string} sessionId - Unique session identifier
 * @param {string} [storagePath=DEFAULT_RESPONSES_STORAGE] - Path to the storage file
 * @returns {Object|null} The retrieved data or null if not found
 */
export async function getQuestionResponses(commandId, sessionId, storagePath = DEFAULT_RESPONSES_STORAGE) {
  try {
    if (!fs.existsSync(storagePath)) {
      log('warn', `Storage file not found: ${storagePath}`);
      return null;
    }
    
    const data = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
    return data[commandId]?.[sessionId] || null;
  } catch (error) {
    log('error', `Error retrieving question responses: ${error.message}`);
    throw error;
  }
}

/**
 * Generates a unique session ID
 * @returns {string} A unique session identifier
 */
export function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Export storage paths for use in other modules
 */
export const storagePaths = {
  DEFAULT_STORAGE_DIR,
  DEFAULT_CONCEPT_STORAGE,
  DEFAULT_RESPONSES_STORAGE
}; 