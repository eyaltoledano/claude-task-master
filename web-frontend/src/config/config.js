/**
 * config/config.js
 * Configuration settings for Task Master Web API
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

export const config = {
  // Server configuration
  server: {
    port: parseInt(process.env.PORT) || 3001,
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development'
  },

  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Project-Root']
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
  },

  // API configuration
  api: {
    prefix: process.env.API_PREFIX || '/api',
    version: process.env.API_VERSION || 'v1',
    timeout: 30000, // 30 seconds
    maxFileSize: '10mb'
  },

  // Task Master specific configuration
  taskmaster: {
    projectRoot: process.env.TASKMASTER_PROJECT_ROOT || join(__dirname, '../../../'),
    // Maximum number of tasks to return in a single request
    maxTasksPerRequest: parseInt(process.env.TASKMASTER_MAX_TASKS) || 1000,
    // Enable/disable AI features
    enableAI: process.env.TASKMASTER_ENABLE_AI !== 'false'
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    file: process.env.LOG_FILE || null
  },

  // Security
  security: {
    // API key for authentication (if required)
    apiKey: process.env.API_KEY || 'your-secret-api-key-here',
    // Disable API key authentication for web-api
    requireAuth: false
  },

  // Swagger documentation
  swagger: {
    title: 'Task Master Web API',
    description: 'RESTful API for Task Master functionality',
    version: '1.0.0',
    basePath: '/api/v1'
  }
};

export default config; 