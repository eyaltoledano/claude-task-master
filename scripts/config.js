/**
 * Task Master Configuration
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

// Get the project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Default configuration
const defaultConfig = {
  // Project metadata
  projectName: process.env.PROJECT_NAME || 'Task Master',
  projectVersion: '1.0.0',
  authorName: '',
  
  // AI model config
  model: process.env.MODEL || 'claude-3-7-sonnet',
  maxTokens: process.env.MAX_TOKENS ? parseInt(process.env.MAX_TOKENS) : 4000,
  temperature: process.env.TEMPERATURE ? parseFloat(process.env.TEMPERATURE) : 0.7,
  
  // Task generation defaults
  defaultSubtasks: process.env.DEFAULT_SUBTASKS ? parseInt(process.env.DEFAULT_SUBTASKS) : 3,
  defaultPriority: process.env.DEFAULT_PRIORITY || 'medium',
  
  // Paths
  tasksDir: 'tasks',
  scriptsDir: 'scripts',
  configFile: 'taskmaster.json',
  
  // Formats
  dateFormat: 'yyyy-MM-dd HH:mm:ss',
  
  // Allowed task statuses
  statuses: ['pending', 'in-progress', 'review', 'done', 'deferred', 'cancelled']
};

/**
 * Load user configuration from taskmaster.json if it exists
 * @returns {Object} Merged configuration
 */
function loadConfig() {
  const configPath = path.join(process.cwd(), 'taskmaster.json');
  let userConfig = {};
  
  if (fs.existsSync(configPath)) {
    try {
      const fileContent = fs.readFileSync(configPath, 'utf8');
      userConfig = JSON.parse(fileContent);
    } catch (error) {
      console.warn(`Warning: Could not parse taskmaster.json: ${error.message}`);
    }
  }
  
  // Merge default config with user config
  return {
    ...defaultConfig,
    ...userConfig,
    // Environment variables always take precedence
    model: process.env.MODEL || userConfig.model || defaultConfig.model,
    maxTokens: process.env.MAX_TOKENS ? parseInt(process.env.MAX_TOKENS) : userConfig.maxTokens || defaultConfig.maxTokens,
    temperature: process.env.TEMPERATURE ? parseFloat(process.env.TEMPERATURE) : userConfig.temperature || defaultConfig.temperature,
    projectName: process.env.PROJECT_NAME || userConfig.projectName || defaultConfig.projectName
  };
}

export const CONFIG = loadConfig();
export const PROJECT_ROOT_DIR = PROJECT_ROOT;

export default {
  CONFIG,
  PROJECT_ROOT_DIR
}; 