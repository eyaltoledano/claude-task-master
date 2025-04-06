import { FastMCP } from "fastmcp";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import fs from "fs";
import logger from "./logger.js";
import { registerTaskMasterTools } from "./tools/index.js";
import { registerRooResources } from "./mcp-resources.js";
import { registerTaskResources } from "./task-resources.js";

// Load environment variables
dotenv.config();

// Constants
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main MCP server class that integrates with Task Master
 */
class TaskMasterMCPServer {
  /**
   * @typedef {Object} TaskMasterMCPServerOptions
   * @property {string} [projectName] - The project name to use in resource variables
   * @property {boolean} [enableRooResources=true] - Whether to enable Roo resources
   */
  
  /**
   * Create a new TaskMasterMCPServer
   * @param {TaskMasterMCPServerOptions} options - Server options
   */
  constructor(options = {}) {
    this.options = {
      projectName: options.projectName || 'Task Master',
      enableRooResources: options.enableRooResources !== false,
      port: options.port || 8080
    };
    
    // Get version from package.json using synchronous fs
    const packagePath = path.join(__dirname, "../../package.json");
    const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));

    this.serverOptions = {
      name: "Task Master MCP Server",
      version: packageJson.version,
    };
this.server = new FastMCP(this.serverOptions);
this.webPort = this.options.port;
this.initialized = false;
    this.initialized = false;

    // Bind methods
    this.init = this.init.bind(this);
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);

    // Setup logging
    this.logger = logger;
  }

  /**
   * Initialize the MCP server with necessary tools and routes
   */
  async init() {
    if (this.initialized) return;

    // Register Task Master tools
    registerTaskMasterTools(this.server);
    
    // Register Roo resources if enabled
    if (this.options.enableRooResources) {
      registerRooResources(this.server, {
        projectName: this.options.projectName
      });
    }
    
    // Ensure task resources are registered
    registerTaskResources(this.server);

    this.initialized = true;

    return this;
  }

  /**
   * Start the MCP server
   */
  async start() {
    if (!this.initialized) {
      await this.init();
    }

    // Start the FastMCP server with stdio transport
    this.logger.info('Starting MCP server with stdio transport');
    await this.server.start({
      transportType: "stdio",
      silent: true // Suppress ping messages
    });

    this.logger.info('MCP server started successfully');

    return this;
  }

  /**
   * Stop the MCP server
   */
  async stop() {
    // Stop the FastMCP server
    if (this.server) {
      await this.server.stop();
    }
  }
}

export default TaskMasterMCPServer;
