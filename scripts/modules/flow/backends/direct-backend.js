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
import { addTagDirect } from '../../../../mcp-server/src/core/direct-functions/add-tag.js';
import { deleteTagDirect } from '../../../../mcp-server/src/core/direct-functions/delete-tag.js';
import { renameTagDirect } from '../../../../mcp-server/src/core/direct-functions/rename-tag.js';
import { parsePRDDirect } from '../../../../mcp-server/src/core/direct-functions/parse-prd.js';
import { analyzeTaskComplexityDirect } from '../../../../mcp-server/src/core/direct-functions/analyze-task-complexity.js';
import { expandAllTasksDirect } from '../../../../mcp-server/src/core/direct-functions/expand-all-tasks.js';
import { modelsDirect } from '../../../../mcp-server/src/core/direct-functions/models.js';

/**
 * Direct Backend - uses MCP server direct functions
 */
export class DirectBackend extends FlowBackend {
	constructor(options = {}) {
		super(options);
		this.projectRoot =
			options.projectRoot || findProjectRoot() || process.cwd();
		this.log = createLogger({ console: false });
		this.tasksJsonPath = path.join(this.projectRoot, TASKMASTER_TASKS_FILE);
	}

	async initialize() {
		// Direct functions don't need initialization
		return true;
	}

	  async listTasks(options = {}) {
    // Get current tag
    const { tags } = await this.listTags();
    const currentTag = tags.find(t => t.isCurrent)?.name || 'master';
    const tagToUse = options.tag || currentTag;
    
    // Construct report path based on tag
    const reportDir = path.join(this.projectRoot, '.taskmaster', 'reports');
    const tagSuffix = tagToUse && tagToUse !== 'master' ? `_${tagToUse}` : '';
    const reportPath = path.join(reportDir, `task-complexity-report${tagSuffix}.json`);
    
    const args = {
      tasksJsonPath: this.tasksJsonPath,
      projectRoot: this.projectRoot,
      status: options.status,
      withSubtasks: true,
      tag: options.tag,
      reportPath: reportPath
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
			projectRoot: this.projectRoot,
			tasksJsonPath: this.tasksJsonPath
		};

		const result = await nextTaskDirect(args, this.log, { session: {} });
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		this.updateTelemetry(result.data);
		return {
			task: result.data.task,
			suggestions: result.data.suggestions || [],
			telemetryData: result.data.telemetryData
		};
	}

	  async getTask(taskId) {
    // Get current tag
    const { tags } = await this.listTags();
    const currentTag = tags.find(t => t.isCurrent)?.name || 'master';
    
    // Construct report path based on tag
    const reportDir = path.join(this.projectRoot, '.taskmaster', 'reports');
    const tagSuffix = currentTag && currentTag !== 'master' ? `_${currentTag}` : '';
    const reportPath = path.join(reportDir, `task-complexity-report${tagSuffix}.json`);
    
    const args = {
      projectRoot: this.projectRoot,
      tasksJsonPath: this.tasksJsonPath,
      id: String(taskId),
      reportPath: reportPath
    };

    const result = await showTaskDirect(args, this.log, { session: {} });
    if (!result.success) {
      throw new Error(result.error.message || result.error);
    }

    this.updateTelemetry(result.data);
    return result.data;
  }

	async setTaskStatus(taskId, status) {
		const args = {
			projectRoot: this.projectRoot,
			tasksJsonPath: this.tasksJsonPath,
			id: taskId,
			status: status
		};

		const result = await setTaskStatusDirect(args, this.log, { session: {} });
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		this.updateTelemetry(result.data);
		return result.data;
	}

	async expandTask(taskId, options = {}) {
		const args = {
			projectRoot: this.projectRoot,
			tasksJsonPath: this.tasksJsonPath,
			id: taskId,
			num: options.num,
			research: options.research || false,
			force: options.force || false,
			prompt: options.prompt
		};

		const result = await expandTaskDirect(args, this.log, { session: {} });
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		this.updateTelemetry(result.data);
		return result.data;
	}

	async addTask(taskData) {
		const args = {
			projectRoot: this.projectRoot,
			tasksJsonPath: this.tasksJsonPath,
			prompt: taskData.prompt,
			dependencies: taskData.dependencies,
			priority: taskData.priority || 'medium',
			research: taskData.research || false
		};

		const result = await addTaskDirect(args, this.log, { session: {} });
		if (!result.success) {
			throw new Error(result.error.message || result.error);
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
			projectRoot: this.projectRoot,
			tasksJsonPath: this.tasksJsonPath
		};

		const result = await listTagsDirect(args, this.log);
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		return {
			tags: result.data.tags || [],
			currentTag: result.data.currentTag || 'master'
		};
	}

	async useTag(tagName) {
		const args = {
			projectRoot: this.projectRoot,
			tasksJsonPath: this.tasksJsonPath,
			name: tagName
		};

		const result = await useTagDirect(args, this.log);
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		return result.data;
	}

	async addTag(tagName, options = {}) {
		const args = {
			projectRoot: this.projectRoot,
			tasksJsonPath: this.tasksJsonPath,
			tagName: tagName,
			copyFromCurrent: options.copyFromCurrent || false,
			copyFrom: options.copyFrom,
			description: options.description
		};

		const result = await addTagDirect(args, this.log);
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		return result.data;
	}

	async deleteTag(tagName) {
		const args = {
			projectRoot: this.projectRoot,
			tasksJsonPath: this.tasksJsonPath,
			tagName: tagName,
			yes: true // Skip confirmation for programmatic use
		};

		const result = await deleteTagDirect(args, this.log);
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		return result.data;
	}

	async renameTag(oldName, newName) {
		const args = {
			projectRoot: this.projectRoot,
			tasksJsonPath: this.tasksJsonPath,
			oldName: oldName,
			newName: newName
		};

		const result = await renameTagDirect(args, this.log);
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		return result.data;
	}

	async parsePRD(filePath, options = {}) {
		const args = {
			projectRoot: this.projectRoot,
			tasksJsonPath: this.tasksJsonPath,
			input: filePath,
			tag: options.tag,
			numTasks: options.numTasks,
			force: options.force || false
		};

		const result = await parsePRDDirect(args, this.log, { session: {} });
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		this.updateTelemetry(result.data);
		return result.data;
	}

	async analyzeComplexity(options = {}) {
		// Ensure projectRoot is a string
		const projectRootStr = String(this.projectRoot);

		// Generate output path for the complexity report
		const reportDir = path.join(projectRootStr, '.taskmaster', 'reports');
		const tagSuffix =
			options.tag && options.tag !== 'master' ? `_${options.tag}` : '';
		const outputPath = path.join(
			reportDir,
			`task-complexity-report${tagSuffix}.json`
		);

		const args = {
			projectRoot: projectRootStr,
			tasksJsonPath: this.tasksJsonPath,
			outputPath: outputPath,
			tag: options.tag,
			research: options.research || false,
			threshold: options.threshold,
			file: this.tasksJsonPath, // The core function expects 'file' parameter
			output: outputPath // The core function expects 'output' parameter
		};

		const result = await analyzeTaskComplexityDirect(args, this.log, {
			session: {}
		});
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		this.updateTelemetry(result.data);

		// Extract the relevant data from the full report
		const complexityAnalysis = result.data.fullReport?.complexityAnalysis || [];

		// Map the complexity analysis to include shouldExpand property
		const recommendations = complexityAnalysis.map((task) => ({
			...task,
			shouldExpand: task.complexityScore >= (options.threshold || 8)
		}));

		return {
			recommendations: recommendations,
			summary: {
				taskCount: result.data.reportSummary?.taskCount || 0,
				highComplexityCount:
					result.data.reportSummary?.highComplexityTasks || 0,
				mediumComplexityCount:
					result.data.reportSummary?.mediumComplexityTasks || 0,
				lowComplexityCount: result.data.reportSummary?.lowComplexityTasks || 0,
				averageComplexity:
					complexityAnalysis.reduce((sum, t) => sum + t.complexityScore, 0) /
						(complexityAnalysis.length || 1) || 0
			},
			telemetryData: result.data.telemetryData
		};
	}

	async expandAll(options = {}) {
		const args = {
			projectRoot: this.projectRoot,
			tasksJsonPath: this.tasksJsonPath,
			tag: options.tag,
			research: options.research || false,
			num: options.num,
			force: options.force || false,
			prompt: options.prompt
		};

		const result = await expandAllTasksDirect(args, this.log, { session: {} });
		if (!result.success) {
			throw new Error(result.error.message || result.error);
		}

		this.updateTelemetry(result.data);
		return result.data;
	}

	  async getModels() {
    const args = {
      projectRoot: this.projectRoot
    };

    const result = await modelsDirect(args, this.log);
    if (!result.success) {
      throw new Error(result.error.message || result.error);
    }

    return result.data;
  }

  async getComplexityReport(tag = null) {
    // Get current tag if not provided
    if (!tag) {
      const { tags } = await this.listTags();
      tag = tags.find(t => t.isCurrent)?.name || 'master';
    }
    
    // Construct report path based on tag
    const reportDir = path.join(this.projectRoot, '.taskmaster', 'reports');
    const tagSuffix = tag && tag !== 'master' ? `_${tag}` : '';
    const reportPath = path.join(reportDir, `task-complexity-report${tagSuffix}.json`);
    
    try {
      const fs = await import('fs');
      if (fs.existsSync(reportPath)) {
        const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        return reportData;
      }
    } catch (error) {
      this.log.debug(`Could not load complexity report: ${error.message}`);
    }
    
    return null;
  }
}
