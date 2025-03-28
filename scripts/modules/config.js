/**
 * Config Module
 * 
 * Centralizes application configuration values and environment variable handling
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Application configuration with environment variable fallbacks
 */
export const CONFIG = {
  // API model configuration
  model: process.env.MODEL || 'claude-3-7-sonnet-20250219',
  maxTokens: parseInt(process.env.MAX_TOKENS || '4000', 10),
  temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
  
  // Logging and debug
  debug: process.env.DEBUG === 'true' || process.env.DEBUG === '1',
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Task configuration
  defaultSubtasks: parseInt(process.env.DEFAULT_SUBTASKS || '3', 10),
  defaultPriority: process.env.DEFAULT_PRIORITY || 'medium',
  
  // Project metadata
  projectName: process.env.PROJECT_NAME || 'Task Master Project',
  projectVersion: process.env.PROJECT_VERSION || '1.0.0',
  
  // Feature flags
  enableResearch: process.env.ENABLE_RESEARCH === 'true' || false,
  
  // File paths
  tasksFile: process.env.TASKS_FILE || 'tasks/tasks.json',
  tasksDir: process.env.TASKS_DIR || 'tasks',
  prdDir: process.env.PRD_DIR || 'prd'
}; 