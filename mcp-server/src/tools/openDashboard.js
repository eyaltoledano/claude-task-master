import logger from "../logger.js";
import findFreePort from "find-free-port";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { z } from "zod";
import { createContentResponse, createErrorResponse } from "./utils.js";

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Placeholder for accessing the main server instance or its properties
// This will be populated during tool registration
let getServerInstance = () => null;

export function setServerInstanceAccessor(accessor) {
  getServerInstance = accessor;
}

/**
 * Register the openDashboard tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerOpenDashboardTool(server) {
  server.addTool({
    name: "openDashboard",
    description: "Starts the Task Master web interface if not already running and returns its URL.",
    parameters: z.object({}),
    execute: async (toolArgs, { log }) => {
      try {
        const url = await openDashboard();
        log.info(`Web interface URL: ${url}`);
        return createContentResponse(url);
      } catch (error) {
        log.error(`Error in openDashboard tool: ${error.message}`);
        return createErrorResponse(`Error starting web interface: ${error.message}`);
      }
    },
  });
}

/**
 * MCP Tool: openDashboard
 * Description: Starts the web interface if not already running and returns its URL.
 * Input Schema: {} (No input parameters)
 * Output Schema: { type: "string", description: "The URL of the web interface." }
 */
async function openDashboard() {
  logger.info("Executing openDashboard tool");
  const serverInstance = getServerInstance();

  if (!serverInstance) {
    const message = "Failed to access server instance.";
    logger.error(message);
    return message;
  }

  // If the web interface is already running, return its URL
  if (serverInstance.webPort && serverInstance.httpServer) {
    const url = `http://localhost:${serverInstance.webPort}`;
    logger.info(`Web interface already running at ${url}`);
    return url;
  }

  // Otherwise, configure the web interface
  try {
    // Configure Express middleware and routes
    await configureWebApp(serverInstance);

    const url = `http://localhost:${serverInstance.webPort}`;
    logger.info(`Web interface configured at ${url}`);
    return url;
  } catch (error) {
    const message = `Failed to start web interface: ${error.message}`;
    logger.error(message);
    return message;
  }
}

/**
 * Configure the Express web app with middleware and routes
 * @param {Object} serverInstance - The TaskMasterMCPServer instance
 */
async function configureWebApp(serverInstance) {
  const webApp = serverInstance.webApp;
  
  // Determine if we're in development mode
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  if (isDevelopment) {
    logger.info('Running in development mode');
    
    // In development mode, we'll use Vite's development server middleware
    try {
      // Dynamically import Vite
      const { createServer } = await import('vite');
      
      // Create Vite server in middleware mode
      const vite = await createServer({
        root: path.join(__dirname, '../../web-ui'),
        server: { middlewareMode: true },
        appType: 'spa'
      });
      
      // Use Vite's connect instance as middleware
      webApp.use(vite.middlewares);
      
      logger.info('Vite development server middleware initialized');
    } catch (error) {
      logger.error(`Failed to initialize Vite development server: ${error.message}`);
      logger.info('Falling back to static file serving');
      
      // Fall back to static file serving
      const webUiBuildPath = path.join(__dirname, '../../web-ui/dist');
      if (fs.existsSync(webUiBuildPath)) {
        logger.info(`Serving static files from: ${webUiBuildPath}`);
        webApp.use(express.static(webUiBuildPath));
      } else {
        logger.warn(`Web UI build directory not found: ${webUiBuildPath}`);
        webApp.get('/', (req, res) => {
          res.status(404).send('Web UI not built. Run build command in mcp-server/web-ui.');
        });
      }
    }
  } else {
    // In production mode, serve static files
    const webUiBuildPath = path.join(__dirname, '../../web-ui/dist');
    if (fs.existsSync(webUiBuildPath)) {
      logger.info(`Serving static files from: ${webUiBuildPath}`);
      webApp.use(express.static(webUiBuildPath));
    } else {
      logger.warn(`Web UI build directory not found: ${webUiBuildPath}`);
      webApp.get('/', (req, res) => {
        res.status(404).send('Web UI not built. Run build command in mcp-server/web-ui.');
      });
    }
  }

  // --- API Routes ---
  webApp.get('/api/tasks', async (req, res) => {
    try {
      logger.info(`API Request: GET /api/tasks, Query: ${JSON.stringify(req.query)}`);
      const args = {
        status: req.query.status,
        withSubtasks: req.query.withSubtasks === 'true',
        file: req.query.file,
        projectRoot: req.query.projectRoot || process.cwd(),
        format: 'json'
      };
      
      // Import listTasksLogic dynamically to avoid circular dependencies
      const { listTasksLogic } = await import('./listTasks.js');
      const tasksJson = await listTasksLogic(args, logger);
      res.json(tasksJson);
    } catch (error) {
      logger.error(`API Error (GET /api/tasks): ${error.message}`);
      res.status(500).json({ error: 'Failed to fetch tasks', details: error.message });
    }
  });

  webApp.get('/api/tasks/:id', async (req, res) => {
    const taskId = req.params.id;
    try {
      logger.info(`API Request: GET /api/tasks/${taskId}, Query: ${JSON.stringify(req.query)}`);
      const args = {
        id: taskId,
        file: req.query.file,
        projectRoot: req.query.projectRoot || process.cwd(),
        format: 'json'
      };
      
      // Import showTaskLogic dynamically to avoid circular dependencies
      const { showTaskLogic } = await import('./showTask.js');
      const taskJson = await showTaskLogic(args, logger);
      res.json(taskJson);
    } catch (error) {
      logger.error(`API Error (GET /api/tasks/${taskId}): ${error.message}`);
      if (error.message.includes("not found")) {
        res.status(404).json({ error: 'Task not found', details: error.message });
      } else {
        res.status(500).json({ error: 'Failed to fetch task details', details: error.message });
      }
    }
  });

  // --- SPA Fallback Route ---
  // This ensures that direct navigation to frontend routes works correctly
  webApp.get('*', (req, res) => {
    // Check if the request looks like an API call or a file request first
    if (req.path.startsWith('/api/') || req.path.includes('.')) {
      // Let 404 handler deal with it if static middleware didn't find it
      res.status(404).send('Not found');
    } else {
      // Otherwise, serve index.html for SPA routing
      const webUiBuildPath = path.join(__dirname, '../../web-ui/dist');
      if (fs.existsSync(path.join(webUiBuildPath, 'index.html'))) {
        res.sendFile(path.join(webUiBuildPath, 'index.html'));
      } else {
        res.status(404).send('Web UI not built. Run build command in mcp-server/web-ui.');
      }
    }
  });
}