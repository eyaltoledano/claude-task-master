/**
 * docs/swagger.js
 * Swagger documentation configuration
 */

import swaggerJsdoc from 'swagger-jsdoc';
import config from '../config/config.js';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: config.swagger.title,
      version: config.swagger.version,
      description: config.swagger.description,
      contact: {
        name: 'Task Master Team',
        url: 'https://github.com/your-org/task-master',
        email: 'support@taskmaster.dev'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: `http://localhost:${config.server.port}${config.api.prefix}`,
        description: 'Development server'
      },
      {
        url: `https://api.taskmaster.dev${config.api.prefix}`,
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for authentication'
        }
      },
      schemas: {
        Task: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique task identifier',
              example: '1'
            },
            title: {
              type: 'string',
              description: 'Task title',
              example: 'Initialize Project'
            },
            description: {
              type: 'string',
              description: 'Brief task description',
              example: 'Set up the initial project structure'
            },
            status: {
              type: 'string',
              enum: ['pending', 'in-progress', 'done', 'cancelled', 'blocked', 'deferred'],
              description: 'Current task status',
              example: 'pending'
            },
            priority: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: 'Task priority level',
              example: 'medium'
            },
            dependencies: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'List of task IDs that must be completed first',
              example: ['2', '3']
            },
            details: {
              type: 'string',
              description: 'Detailed implementation instructions',
              example: 'Create package.json, set up directory structure...'
            },
            testStrategy: {
              type: 'string',
              description: 'Testing approach for this task',
              example: 'Verify all files are created and dependencies installed'
            },
            subtasks: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Subtask'
              },
              description: 'List of subtasks'
            }
          },
          required: ['id', 'title', 'description', 'status']
        },
        Subtask: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Subtask identifier (e.g., "1.1")',
              example: '1.1'
            },
            title: {
              type: 'string',
              description: 'Subtask title',
              example: 'Create package.json'
            },
            description: {
              type: 'string',
              description: 'Subtask description',
              example: 'Initialize npm package with basic configuration'
            },
            status: {
              type: 'string',
              enum: ['pending', 'in-progress', 'done', 'cancelled', 'blocked', 'deferred'],
              description: 'Current subtask status',
              example: 'pending'
            },
            dependencies: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'List of task/subtask IDs that must be completed first',
              example: []
            },
            details: {
              type: 'string',
              description: 'Detailed implementation instructions',
              example: 'Run npm init and configure basic project metadata'
            }
          },
          required: ['id', 'title', 'description', 'status']
        },
        Project: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique project identifier',
              example: 'my-web-app'
            },
            name: {
              type: 'string',
              description: 'Project name',
              example: 'My Web Application'
            },
            description: {
              type: 'string',
              description: 'Project description',
              example: 'A modern web application for task management'
            },
            taskCount: {
              type: 'integer',
              description: 'Number of tasks in this project',
              example: 15
            },
            prCount: {
              type: 'integer',
              description: 'Number of product requirements',
              example: 5
            },
            crCount: {
              type: 'integer',
              description: 'Number of change requests',
              example: 3
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Project creation timestamp',
              example: '2024-01-15T10:30:00Z'
            }
          },
          required: ['id', 'name']
        },
        ProductRequirement: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique PR identifier',
              example: 'pr-001'
            },
            title: {
              type: 'string',
              description: 'PR title',
              example: 'User Authentication System'
            },
            description: {
              type: 'string',
              description: 'Detailed PR description',
              example: 'Implement secure user authentication with JWT tokens'
            },
            content: {
              type: 'string',
              description: 'Full PR content/specification',
              example: 'The system shall provide secure user authentication...'
            },
            status: {
              type: 'string',
              enum: ['draft', 'review', 'approved', 'implemented'],
              description: 'PR status',
              example: 'approved'
            },
            priority: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: 'PR priority',
              example: 'high'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'PR creation timestamp',
              example: '2024-01-15T10:30:00Z'
            }
          },
          required: ['id', 'title', 'description']
        },
        ChangeRequest: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique CR identifier',
              example: 'cr-001'
            },
            title: {
              type: 'string',
              description: 'CR title',
              example: 'Update Login UI Design'
            },
            description: {
              type: 'string',
              description: 'Detailed CR description',
              example: 'Update the login interface to match new design guidelines'
            },
            content: {
              type: 'string',
              description: 'Full CR content/specification',
              example: 'The login page should be updated to include...'
            },
            status: {
              type: 'string',
              enum: ['pending', 'approved', 'rejected', 'implemented'],
              description: 'CR status',
              example: 'pending'
            },
            priority: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: 'CR priority',
              example: 'medium'
            },
            relatedPr: {
              type: 'string',
              description: 'Related PR ID if applicable',
              example: 'pr-001'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'CR creation timestamp',
              example: '2024-01-15T10:30:00Z'
            }
          },
          required: ['id', 'title', 'description']
        },
        Tag: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Tag name',
              example: 'feature-auth'
            },
            description: {
              type: 'string',
              description: 'Tag description',
              example: 'Authentication feature tasks'
            },
            taskCount: {
              type: 'integer',
              description: 'Number of tasks in this tag',
              example: 15
            },
            completedTasks: {
              type: 'integer',
              description: 'Number of completed tasks',
              example: 8
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Tag creation timestamp',
              example: '2024-01-15T10:30:00Z'
            }
          },
          required: ['name', 'taskCount', 'completedTasks']
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              description: 'Error type',
              example: 'validation_error'
            },
            message: {
              type: 'string',
              description: 'Human-readable error message',
              example: 'Invalid task ID provided'
            },
            details: {
              type: 'object',
              description: 'Additional error details',
              example: {
                field: 'id',
                code: 'invalid_format'
              }
            }
          },
          required: ['success', 'error', 'message']
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'object',
              description: 'Response data'
            },
            meta: {
              type: 'object',
              description: 'Additional metadata',
              properties: {
                requestId: {
                  type: 'string',
                  description: 'Request identifier',
                  example: '1642234567890-abc123'
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Response timestamp',
                  example: '2024-01-15T10:30:00Z'
                }
              }
            }
          },
          required: ['success', 'data']
        }
      }
    },
    security: config.security.requireAuth ? [{ ApiKeyAuth: [] }] : [],
    tags: [
      {
        name: 'Projects',
        description: 'Project management operations - create, list, and manage projects'
      },
      {
        name: 'Product Requirements',
        description: 'Product Requirements (PRs) management - view and manage product specifications'
      },
      {
        name: 'Change Requests',
        description: 'Change Requests (CRs) management - view and manage change requests'
      },
      {
        name: 'Tasks',
        description: 'Task management operations - view tasks and task statistics'
      },
      {
        name: 'Tags',
        description: 'Tag management for organizing tasks'
      },
      {
        name: 'Research',
        description: 'AI-powered research functionality'
      },
      {
        name: 'Health',
        description: 'API health and status endpoints'
      }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/server.js'
  ]
};

export const swaggerSpec = swaggerJsdoc(options);
export default swaggerSpec; 