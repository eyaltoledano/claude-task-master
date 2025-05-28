/**
 * MCP (Model Control Protocol) related types for claude-task-master
 */

import type { Task, Subtask } from '../models/task.js';

/**
 * MCP Tool definition
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  name: string;
  version: string;
  description?: string;
  tools: MCPTool[];
}

/**
 * MCP Request
 */
export interface MCPRequest<T = any> {
  jsonrpc: '2.0';
  method: string;
  params?: T;
  id: string | number;
}

/**
 * MCP Response
 */
export interface MCPResponse<T = any> {
  jsonrpc: '2.0';
  result?: T;
  error?: MCPError;
  id: string | number;
}

/**
 * MCP Error
 */
export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

/**
 * MCP Session
 */
export interface MCPSession {
  sessionId: string;
  startedAt: Date;
  lastActivity: Date;
  user?: string;
  metadata?: Record<string, any>;
}

/**
 * Tool invocation parameters
 */
export interface ToolInvocation<T = any> {
  name: string;
  arguments: T;
  session?: MCPSession;
}

/**
 * Tool result
 */
export interface ToolResult<T = any> {
  content: T;
  isError?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Task Master specific MCP tool parameters
 */
export interface TaskMasterToolParams {
  get_tasks: {
    status?: string;
    limit?: number;
  };
  
  get_task: {
    id: string;
  };
  
  set_task_status: {
    id: string;
    status: string;
  };
  
  add_task: {
    title: string;
    description?: string;
    priority?: string;
    dependencies?: string[];
    prompt?: string;
    research?: boolean;
  };
  
  update_task: {
    id: string;
    title?: string;
    description?: string;
    priority?: string;
    prompt?: string;
    research?: boolean;
  };
  
  expand_task: {
    id: string;
    research?: boolean;
    force?: boolean;
  };
  
  parse_prd: {
    content?: string;
    file?: string;
    append?: boolean;
  };
  
  analyze_project_complexity: {
    from?: string;
    to?: string;
    research?: boolean;
  };
}

/**
 * MCP notification
 */
export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

/**
 * MCP capabilities
 */
export interface MCPCapabilities {
  tools?: boolean;
  resources?: boolean;
  prompts?: boolean;
  logging?: boolean;
  experimental?: Record<string, boolean>;
}

/**
 * MCP initialization result
 */
export interface MCPInitResult {
  protocolVersion: string;
  capabilities: MCPCapabilities;
  serverInfo: {
    name: string;
    version: string;
  };
}