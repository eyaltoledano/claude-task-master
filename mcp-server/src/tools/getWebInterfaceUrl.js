import logger from "../logger.js";

// Placeholder for accessing the main server instance or its properties
// This will be populated during tool registration
let getServerInstance = () => null;

export function setServerInstanceAccessor(accessor) {
  getServerInstance = accessor;
}

/**
 * MCP Tool: getWebInterfaceUrl
 * Description: Returns the URL of the running web interface, if available.
 * Input Schema: {} (No input parameters)
 * Output Schema: { type: "string", description: "The URL of the web interface or an error message." }
 */
async function getWebInterfaceUrl() {
  logger.info("Executing getWebInterfaceUrl tool");
  const serverInstance = getServerInstance();

  if (serverInstance && serverInstance.webPort && serverInstance.httpServer) {
    const url = `http://localhost:${serverInstance.webPort}`;
    logger.info(`Web interface URL: ${url}`);
    return url;
  } else {
    const message = "Web interface is not currently running or port is not set.";
    logger.warn(message);
    // Consider throwing an error or returning a specific message format
    // For now, returning a descriptive string.
    return message;
  }
}

export const getWebInterfaceUrlTool = {
  name: "getWebInterfaceUrl",
  description: "Returns the URL of the running Task Master web interface.",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
  outputSchema: {
    type: "string",
    description: "The URL of the web interface (e.g., http://localhost:3001) or a message indicating it's not running.",
  },
  execute: getWebInterfaceUrl,
};