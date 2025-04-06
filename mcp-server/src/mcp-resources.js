/**
 * MCP Resources Module
 * 
 * This module handles the registration of resources and resource templates
 * for the MCP server, including roles and boomerangs from the content repository.
 */

import { roles, boomerangs, processVariables } from '../../scripts/content-repository.js';
import logger from './logger.js';

/**
 * Register roles and boomerangs as resources in the MCP server
 * @param {Object} server - The FastMCP server instance
 * @param {Object} options - Options for resource registration
 * @param {string} options.projectName - The project name to use in variable replacement
 */
export function registerRooResources(server, options = {}) {
  const { projectName = 'Task Master' } = options;
  
  logger.info('Registering Roo resources in MCP server');
  
  // Register roles as resources
  for (const [roleId, role] of Object.entries(roles)) {
    const processedContent = processVariables(role.content, role.variables, { projectName });
    
    server.addResource({
      uri: `role://${roleId}`,
      content: {
        type: "text",
        text: processedContent
      },
      metadata: {
        name: role.title,
        category: "roles",
        variables: role.variables
      }
    });
    
    logger.info(`Registered role resource: role://${roleId}`);
  }
  
  // Register boomerangs as resources
  for (const [boomerangId, boomerang] of Object.entries(boomerangs)) {
    const processedContent = processVariables(boomerang.content, boomerang.variables, { projectName });
    
    server.addResource({
      uri: `boomerang://${boomerangId}`,
      content: {
        type: "text",
        text: processedContent
      },
      metadata: {
        name: boomerang.title,
        category: "boomerangs",
        variables: boomerang.variables
      }
    });
    
    logger.info(`Registered boomerang resource: boomerang://${boomerangId}`);
  }
  
  // Register resource templates for parameterized access
  
  // Role template with project name parameter
  server.addResourceTemplate({
    uriTemplate: "role://{roleId}/{projectName}",
    arguments: [
      { name: "roleId", complete: async (value) => Object.keys(roles).filter(id => id.includes(value)) },
      { name: "projectName" }
    ],
    load: async (args) => {
      const { roleId, projectName } = args;
      const role = roles[roleId];
      
      if (!role) {
        throw new Error(`Role ${roleId} not found`);
      }
      
      // Replace variables in content
      const variables = { ...role.variables, projectName };
      const processedContent = processVariables(role.content, variables);
      
      return {
        content: {
          type: "text",
          text: processedContent
        },
        metadata: {
          name: role.title,
          category: "roles",
          projectName
        }
      };
    }
  });
  
  logger.info('Registered role template: role://{roleId}/{projectName}');
  
  // Boomerang template with project name parameter
  server.addResourceTemplate({
    uriTemplate: "boomerang://{boomerangId}/{projectName}",
    arguments: [
      { name: "boomerangId", complete: async (value) => Object.keys(boomerangs).filter(id => id.includes(value)) },
      { name: "projectName" }
    ],
    load: async (args) => {
      const { boomerangId, projectName } = args;
      const boomerang = boomerangs[boomerangId];
      
      if (!boomerang) {
        throw new Error(`Boomerang ${boomerangId} not found`);
      }
      
      // Replace variables in content
      const variables = { ...boomerang.variables, projectName };
      const processedContent = processVariables(boomerang.content, variables);
      
      return {
        content: {
          type: "text",
          text: processedContent
        },
        metadata: {
          name: boomerang.title,
          category: "boomerangs",
          projectName
        }
      };
    }
  });
  
  logger.info('Registered boomerang template: boomerang://{boomerangId}/{projectName}');
  
  // Register a resource listing all available roles
  server.addResource({
    uri: "role://index",
    content: {
      type: "text",
      text: `# Available Roles

The following roles are available for guidance on different aspects of the codebase:

${Object.entries(roles).map(([id, role]) => `- **${role.title}** - Access via \`role://${id}\``).join('\n')}

You can also access roles with a project name parameter:
\`role://{roleId}/{projectName}\`
`
    },
    metadata: {
      name: "Available Roles",
      category: "index"
    }
  });
  
  logger.info('Registered roles index: role://index');
  
  // Register a resource listing all available boomerangs
  server.addResource({
    uri: "boomerang://index",
    content: {
      type: "text",
      text: `# Available Boomerangs

The following boomerangs are available for implementing specific functionality:

${Object.entries(boomerangs).map(([id, boomerang]) => `- **${boomerang.title}** - Access via \`boomerang://${id}\``).join('\n')}

You can also access boomerangs with a project name parameter:
\`boomerang://{boomerangId}/{projectName}\`
`
    },
    metadata: {
      name: "Available Boomerangs",
      category: "index"
    }
  });
  
  logger.info('Registered boomerangs index: boomerang://index');
}