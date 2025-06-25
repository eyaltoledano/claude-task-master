import { FlowBackend } from '../backend-interface.js';
import { connectionPool } from '../mcp/connection-pool.js';

export class MCPClientBackend extends FlowBackend {
	constructor(options = {}) {
		super(options);
		this.server = options.server;
		this.client = null;
	}

	async initialize() {
		this.client = connectionPool.getClient(this.server.id);
		if (!this.client) {
			throw new Error('MCP server not connected');
		}

		// Verify required tools are available
		const tools = await this.client.listTools();
		this.availableTools = new Set(tools.map((t) => t.name));

		return true;
	}

	async listTasks(options = {}) {
		if (!this.availableTools.has('get_tasks')) {
			throw new Error('Server does not support get_tasks tool');
		}

		const result = await this.client.callTool('get_tasks', {
			status: options.status,
			withSubtasks: true,
			tag: options.tag
		});

		// Handle both direct response and wrapped response formats
		const data = result.data || result;

		this.updateTelemetry(data);
		return {
			tasks: data.tasks || [],
			tag: data.currentTag || 'master',
			telemetryData: data.telemetryData
		};
	}

	async nextTask() {
		if (!this.availableTools.has('next_task')) {
			throw new Error('Server does not support next_task tool');
		}

		const result = await this.client.callTool('next_task', {});

		// Handle both direct response and wrapped response formats
		const data = result.data || result;

		this.updateTelemetry(data);
		return {
			task: data.task,
			suggestions: data.suggestions || [],
			telemetryData: data.telemetryData
		};
	}

	async getTask(taskId) {
		if (!this.availableTools.has('get_task')) {
			throw new Error('Server does not support get_task tool');
		}

		const result = await this.client.callTool('get_task', {
			id: String(taskId)
		});

		// Handle both direct response and wrapped response formats
		const data = result.data || result;

		this.updateTelemetry(data);
		return data;
	}

	async setTaskStatus(taskId, status) {
		if (!this.availableTools.has('set_task_status')) {
			throw new Error('Server does not support set_task_status tool');
		}

		const result = await this.client.callTool('set_task_status', {
			id: taskId,
			status: status
		});

		// Handle both direct response and wrapped response formats
		const data = result.data || result;

		this.updateTelemetry(data);
		return data;
	}

	async expandTask(taskId, options = {}) {
		if (!this.availableTools.has('expand_task')) {
			throw new Error('Server does not support expand_task tool');
		}

		const result = await this.client.callTool('expand_task', {
			id: taskId,
			num: options.num,
			research: options.research || false,
			force: options.force || false,
			prompt: options.prompt
		});

		// Handle both direct response and wrapped response formats
		const data = result.data || result;

		this.updateTelemetry(data);
		return data;
	}

	async addTask(taskData) {
		if (!this.availableTools.has('add_task')) {
			throw new Error('Server does not support add_task tool');
		}

		const result = await this.client.callTool('add_task', {
			prompt: taskData.prompt,
			dependencies: taskData.dependencies,
			priority: taskData.priority || 'medium',
			research: taskData.research || false
		});

		// Handle both direct response and wrapped response formats
		const data = result.data || result;

		this.updateTelemetry(data);
		return data;
	}

	async *researchStream(query, options = {}) {
		if (!this.availableTools.has('research')) {
			throw new Error('Server does not support research tool');
		}

		// For now, we'll run research non-streaming
		const result = await this.client.callTool('research', {
			query: query,
			taskIds: options.taskIds,
			filePaths: options.filePaths,
			customContext: options.customContext,
			includeProjectTree: options.includeProjectTree || false,
			detailLevel: options.detailLevel || 'medium',
			saveTo: options.saveTo,
			saveFile: options.saveFile || false
		});

		// Handle both direct response and wrapped response formats
		const data = result.data || result;

		this.updateTelemetry(data);

		// Yield the conversation in chunks
		const conversation = data.conversation || '';
		const chunks = conversation.match(/.{1,100}/g) || [];
		for (const chunk of chunks) {
			yield chunk;
		}
	}

	async listTags() {
		if (!this.availableTools.has('list_tags')) {
			// Return default if not supported
			return {
				tags: [{ name: 'master', isCurrent: true }],
				currentTag: 'master'
			};
		}

		const result = await this.client.callTool('list_tags', {});

		// Handle both direct response and wrapped response formats
		const data = result.data || result;

		return {
			tags: data.tags || [],
			currentTag: data.currentTag || 'master'
		};
	}

	async useTag(tagName) {
		if (!this.availableTools.has('use_tag')) {
			throw new Error('Server does not support use_tag tool');
		}

		const result = await this.client.callTool('use_tag', {
			name: tagName
		});

		return result;
	}

	async addTag(tagName, options = {}) {
		if (!this.availableTools.has('add_tag')) {
			throw new Error('Server does not support add_tag tool');
		}

		const result = await this.client.callTool('add_tag', {
			tagName: tagName,
			copyFromCurrent: options.copyFromCurrent || false,
			copyFrom: options.copyFrom,
			description: options.description
		});

		return result;
	}

	async deleteTag(tagName) {
		if (!this.availableTools.has('delete_tag')) {
			throw new Error('Server does not support delete_tag tool');
		}

		const result = await this.client.callTool('delete_tag', {
			tagName: tagName,
			yes: true
		});

		return result;
	}

	async renameTag(oldName, newName) {
		if (!this.availableTools.has('rename_tag')) {
			throw new Error('Server does not support rename_tag tool');
		}

		const result = await this.client.callTool('rename_tag', {
			oldName: oldName,
			newName: newName
		});

		return result;
	}

	async parsePRD(filePath, options = {}) {
		if (!this.availableTools.has('parse_prd')) {
			throw new Error('Server does not support parse_prd tool');
		}

		const result = await this.client.callTool('parse_prd', {
			input: filePath,
			tag: options.tag,
			numTasks: options.numTasks,
			force: options.force || false
		});

		// Handle both direct response and wrapped response formats
		const data = result.data || result;

		this.updateTelemetry(data);
		return data;
	}

	async analyzeComplexity(options = {}) {
		if (!this.availableTools.has('analyze')) {
			throw new Error('Server does not support analyze tool');
		}

		const result = await this.client.callTool('analyze', {
			tag: options.tag,
			research: options.research || false,
			threshold: options.threshold
		});

		// Handle both direct response and wrapped response formats
		const data = result.data || result;

		this.updateTelemetry(data);

		// Transform the result to match the expected format
		return {
			recommendations: data.recommendations || [],
			summary: data.summary || {},
			telemetryData: data.telemetryData
		};
	}

	async expandAll(options = {}) {
		if (!this.availableTools.has('expand_all')) {
			throw new Error('Server does not support expand_all tool');
		}

		const result = await this.client.callTool('expand_all', {
			tag: options.tag,
			research: options.research || false,
			num: options.num,
			force: options.force || false,
			prompt: options.prompt
		});

		// Handle both direct response and wrapped response formats
		const data = result.data || result;

		this.updateTelemetry(data);
		return data;
	}

	async getModels() {
		if (!this.availableTools.has('models')) {
			// Return empty if not supported
			return { models: {} };
		}

		const result = await this.client.callTool('models', {});

		// Handle both direct response and wrapped response formats
		const data = result.data || result;

		// Extract activeModels and rename modelId to model for consistency with StatusScreen
		const activeModels = data.activeModels || data;
		return {
			main: activeModels.main
				? {
						provider: activeModels.main.provider,
						model: activeModels.main.modelId || activeModels.main.model,
						sweScore: activeModels.main.sweScore,
						cost: activeModels.main.cost,
						keyStatus: activeModels.main.keyStatus
					}
				: null,
			research: activeModels.research
				? {
						provider: activeModels.research.provider,
						model: activeModels.research.modelId || activeModels.research.model,
						sweScore: activeModels.research.sweScore,
						cost: activeModels.research.cost,
						keyStatus: activeModels.research.keyStatus
					}
				: null,
			fallback: activeModels.fallback
				? {
						provider: activeModels.fallback.provider,
						model: activeModels.fallback.modelId || activeModels.fallback.model,
						sweScore: activeModels.fallback.sweScore,
						cost: activeModels.fallback.cost,
						keyStatus: activeModels.fallback.keyStatus
					}
				: null
		};
	}

	async getComplexityReport(tag = null) {
		// MCP servers might not support this method
		// Return null to indicate no report available
		return null;
	}

	async dispose() {
		// Don't close the connection here as it's managed by the pool
		this.client = null;
	}
}
