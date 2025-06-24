import { FlowBackend } from '../backend-interface.js';
import { findProjectRoot } from '../../utils.js';
import { createLogger } from '../../../../mcp-server/src/logger.js';
import path from 'path';
import { TASKMASTER_TASKS_FILE } from '../../../../src/constants/paths.js';

// Import direct functions
import { listTasksDirect } from '../../../../mcp-server/src/core/direct-functions/list-tasks.js';
import { nextTaskDirect } from '../../../../mcp-server/src/core/direct-functions/next-task.js';
import { showTaskDirect } from '../../../../mcp-server/src/core/direct-functions/show-task.js';
import { setTaskStatusDirect } from '../../../../mcp-server/src/core/direct-functions/set-task-status.js';
import { expandTaskDirect } from '../../../../mcp-server/src/core/direct-functions/expand-task.js';
import { addTaskDirect } from '../../../../mcp-server/src/core/direct-functions/add-task.js';
import { researchDirect } from '../../../../mcp-server/src/core/direct-functions/research.js';
import { listTagsDirect } from '../../../../mcp-server/src/core/direct-functions/list-tags.js';
import { useTagDirect } from '../../../../mcp-server/src/core/direct-functions/use-tag.js';

/**
 * Direct Backend - uses MCP server direct functions
 */
export class DirectBackend extends FlowBackend {
  constructor(options = {}) {
    super(options);
    this.projectRoot = options.projectRoot || findProjectRoot() || process.cwd();
    this.log = createLogger({ console: false });
    this.tasksJsonPath = path.join(this.projectRoot, TASKMASTER_TASKS_FILE);
  }

  async initialize() {
    // Direct functions don't need initialization
    return true;
  }

  async listTasks(options = {}) {
    const args = {
      tasksJsonPath: this.tasksJsonPath,
      projectRoot: this.projectRoot,
      status: options.status,
      withSubtasks: true,
      tag: options.tag
    };

    const result = await listTasksDirect(args, this.log);
    if (!result.success) {
      throw new Error(result.error.message || result.error);
    }

    this.updateTelemetry(result.data);
    return {
      tasks: result.data.tasks || [],
      tag: result.data.currentTag || 'master',
      telemetryData: result.data.telemetryData
    };
  }

  async nextTask() {
    const args = {
      projectRoot: this.projectRoot
    };

    const result = await nextTaskDirect(args, this.log);
    if (!result.success) {
      throw new Error(result.error);
    }

    this.updateTelemetry(result.data);
    return {
      task: result.data.task,
      suggestions: result.data.suggestions || [],
      telemetryData: result.data.telemetryData
    };
  }

  async getTask(taskId) {
    const args = {
      projectRoot: this.projectRoot,
      id: String(taskId)
    };

    const result = await showTaskDirect(args, this.log);
    if (!result.success) {
      throw new Error(result.error.message || result.error);
    }

    this.updateTelemetry(result.data);
    return result.data;
  }

  async setTaskStatus(taskId, status) {
    const args = {
      projectRoot: this.projectRoot,
      id: taskId,
      status: status
    };

    const result = await setTaskStatusDirect(args, this.log);
    if (!result.success) {
      throw new Error(result.error);
    }

    this.updateTelemetry(result.data);
    return result.data;
  }

  async expandTask(taskId, options = {}) {
    const args = {
      projectRoot: this.projectRoot,
      id: taskId,
      num: options.num,
      research: options.research || false,
      force: options.force || false,
      prompt: options.prompt
    };

    const result = await expandTaskDirect(args, this.log);
    if (!result.success) {
      throw new Error(result.error);
    }

    this.updateTelemetry(result.data);
    return result.data;
  }

  async addTask(taskData) {
    const args = {
      projectRoot: this.projectRoot,
      prompt: taskData.prompt,
      dependencies: taskData.dependencies,
      priority: taskData.priority || 'medium',
      research: taskData.research || false
    };

    const result = await addTaskDirect(args, this.log);
    if (!result.success) {
      throw new Error(result.error);
    }

    this.updateTelemetry(result.data);
    return result.data;
  }

  async *researchStream(query, options = {}) {
    const args = {
      projectRoot: this.projectRoot,
      query: query,
      taskIds: options.taskIds,
      filePaths: options.filePaths,
      customContext: options.customContext,
      includeProjectTree: options.includeProjectTree || false,
      detailLevel: options.detailLevel || 'medium',
      saveTo: options.saveTo,
      saveFile: options.saveFile || false
    };

    // For now, we'll run research non-streaming and yield the result
    // TODO: Implement proper streaming when available
    const result = await researchDirect(args, this.log);
    if (!result.success) {
      throw new Error(result.error);
    }

    this.updateTelemetry(result.data);
    
    // Yield the conversation in chunks
    const conversation = result.data.conversation || '';
    const chunks = conversation.match(/.{1,100}/g) || [];
    for (const chunk of chunks) {
      yield chunk;
    }
  }

  async listTags() {
    const args = {
      projectRoot: this.projectRoot
    };

    const result = await listTagsDirect(args, this.log);
    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data.tags || [];
  }

  async useTag(tagName) {
    const args = {
      projectRoot: this.projectRoot,
      tagName: tagName
    };

    const result = await useTagDirect(args, this.log);
    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data;
  }
} 