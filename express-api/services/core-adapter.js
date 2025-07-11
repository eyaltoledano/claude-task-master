import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { createLogger } from '../utils/logger.js';
import ConfigManager from './config-manager.js';
import { generateObjectService } from '../../scripts/modules/ai-services-unified.js';

/**
 * 统一的项目路径管理工具
 * 确保所有数据操作都使用正确的 projects/{project-id}/.taskmaster/ 路径结构
 */
class ProjectPathManager {
    constructor(projectsDir = null) {
        // 使用传入的项目目录，或者从环境变量获取，或者使用默认值
        const configuredProjectsDir = projectsDir || process.env.PROJECTS_DIR || '../projects';
        this.projectsRoot = path.resolve(configuredProjectsDir);
    }

    /**
     * 获取项目根目录路径
     * @param {string} projectId - 项目ID
     * @returns {string} 项目根目录路径
     */
    getProjectRoot(projectId) {
        if (!projectId) {
            throw new Error('Project ID is required');
        }
        return path.join(this.projectsRoot, projectId);
    }

    /**
     * 获取项目的.taskmaster目录路径
     * @param {string} projectId - 项目ID
     * @returns {string} .taskmaster目录路径
     */
    getTaskmasterDir(projectId) {
        return path.join(this.getProjectRoot(projectId), '.taskmaster');
    }

    /**
     * 获取任务文件路径
     * @param {string} projectId - 项目ID
     * @returns {string} tasks.json文件路径
     */
    getTasksPath(projectId) {
        return path.join(this.getTaskmasterDir(projectId), 'tasks', 'tasks.json');
    }

    /**
     * 获取PRD文档路径
     * @param {string} projectId - 项目ID
     * @param {string} [filename='prd.txt'] - PRD文件名
     * @returns {string} PRD文档路径
     */
    getPrdPath(projectId, filename = 'prd.txt') {
        return path.join(this.getTaskmasterDir(projectId), 'docs', filename);
    }

    /**
     * 获取产品需求文件路径
     * @param {string} projectId - 项目ID
     * @returns {string} requirements.json文件路径
     */
    getRequirementsPath(projectId) {
        return path.join(this.getTaskmasterDir(projectId), 'product-requirements', 'requirements.json');
    }

    /**
     * 获取变更请求目录路径
     * @param {string} projectId - 项目ID
     * @returns {string} 变更请求目录路径
     */
    getChangeRequestsDir(projectId) {
        return path.join(this.getTaskmasterDir(projectId), 'change-requests');
    }

    /**
     * 获取报告目录路径
     * @param {string} projectId - 项目ID
     * @returns {string} 报告目录路径
     */
    getReportsDir(projectId) {
        return path.join(this.getTaskmasterDir(projectId), 'reports');
    }

    /**
     * 获取复杂度报告文件路径
     * @param {string} projectId - 项目ID
     * @returns {string} 复杂度报告文件路径
     */
    getComplexityReportPath(projectId) {
        return path.join(this.getReportsDir(projectId), 'task-complexity-report.json');
    }

    /**
     * 获取项目状态文件路径
     * @param {string} projectId - 项目ID
     * @returns {string} state.json文件路径
     */
    getStatePath(projectId) {
        return path.join(this.getTaskmasterDir(projectId), 'state.json');
    }

    /**
     * 获取日志目录路径
     * @param {string} projectId - 项目ID
     * @returns {string} 日志目录路径
     */
    getLogsDir(projectId) {
        return path.join(this.getTaskmasterDir(projectId), 'logs');
    }

    /**
     * 获取模板目录路径
     * @param {string} projectId - 项目ID
     * @returns {string} 模板目录路径
     */
    getTemplatesDir(projectId) {
        return path.join(this.getTaskmasterDir(projectId), 'templates');
    }

    /**
     * 确保项目目录结构存在
     * @param {string} projectId - 项目ID
     */
    async ensureProjectStructure(projectId) {
        const dirs = [
            this.getTaskmasterDir(projectId),
            path.join(this.getTaskmasterDir(projectId), 'tasks'),
            path.join(this.getTaskmasterDir(projectId), 'docs'),
            path.join(this.getTaskmasterDir(projectId), 'product-requirements'),
            this.getChangeRequestsDir(projectId),
            this.getReportsDir(projectId),
            this.getLogsDir(projectId),
            this.getTemplatesDir(projectId)
        ];

        for (const dir of dirs) {
            await fs.mkdir(dir, { recursive: true });
        }
    }

    /**
     * 检查项目是否存在
     * @param {string} projectId - 项目ID
     * @returns {boolean} 项目是否存在
     */
    async projectExists(projectId) {
        try {
            const projectRoot = this.getProjectRoot(projectId);
            const stats = await fs.stat(projectRoot);
            return stats.isDirectory();
        } catch (error) {
            return false;
        }
    }

    /**
     * 将原始TaskMaster的projectRoot转换为多项目结构的路径
     * 这个方法用于适配原始脚本，确保它们能在多项目环境中正确工作
     * @param {string} projectId - 项目ID
     * @returns {string} 适配后的项目根路径（指向项目目录，而不是.taskmaster目录）
     */
    getLegacyProjectRoot(projectId) {
        // 原始脚本期望projectRoot指向包含.taskmaster目录的项目根目录
        return this.getProjectRoot(projectId);
    }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createLogger('core-adapter');

// PRD解析的Zod schema
const prdSingleTaskSchema = z.object({
    id: z.number().int().positive(),
    title: z.string().min(1),
    description: z.string().min(1),
    details: z.string().nullable(),
    testStrategy: z.string().nullable(),
    priority: z.enum(['high', 'medium', 'low']).nullable(),
    dependencies: z.array(z.number().int().positive()).nullable(),
    status: z.string().nullable()
});

const prdResponseSchema = z.object({
    tasks: z.array(prdSingleTaskSchema),
    metadata: z.object({
        projectName: z.string(),
        totalTasks: z.number(),
        sourceFile: z.string(),
        generatedAt: z.string()
    })
});

class CoreAdapter {
    constructor(projectsDir = null) {
        this.logger = logger;
        this.scriptsPath = path.join(__dirname, '../../scripts');
        this.configManager = new ConfigManager();
        this.pathManager = new ProjectPathManager(projectsDir);
    }

    /**
     * 初始化适配器
     */
    async initialize() {
        await this.configManager.initialize();
    }

    /**
     * 将全局配置转换为原始脚本期望的格式
     */
    _convertToLegacyConfig(globalConfig) {
        // 安全检查
        if (!globalConfig) {
            this.logger.warn('No global config provided, using defaults');
            return {
                models: {
                    main: {
                        provider: 'openai',
                        modelId: 'gpt-4',
                        maxTokens: 4000,
                        temperature: 0.7,
                        model: 'gpt-4'
                    },
                    research: {
                        provider: 'openai',
                        modelId: 'gpt-4',
                        maxTokens: 4000,
                        temperature: 0.1,
                        model: 'gpt-4'
                    },
                    fallback: {
                        provider: 'openai',
                        modelId: 'gpt-4',
                        maxTokens: 4000,
                        temperature: 0.7,
                        model: 'gpt-4'
                    }
                }
            };
        }

        // 检查配置格式：支持两种格式 - 新的 'ai' 结构和旧的 'models' 结构
        this.logger.debug('Converting global config', { hasModels: !!globalConfig.models, hasAi: !!globalConfig.ai });

        if (globalConfig.models) {
            // 如果已经是 'models' 结构，直接返回
            this.logger.debug('Using existing models configuration format', {
                mainProvider: globalConfig.models.main?.provider,
                mainModel: globalConfig.models.main?.modelId
            });
            return globalConfig;
        } else if (globalConfig.ai && globalConfig.ai.main) {
            // 如果是 'ai' 结构，转换为 'models' 结构
            this.logger.debug('Converting ai configuration to models format');
            return {
                models: {
                    main: {
                        provider: globalConfig.ai.main.provider,
                        modelId: globalConfig.ai.main.modelId,
                        maxTokens: globalConfig.ai.main.maxTokens,
                        temperature: globalConfig.ai.main.temperature,
                        model: globalConfig.ai.main.modelId, // 添加model字段以兼容
                        ...(globalConfig.ai.main.baseURL && { baseURL: globalConfig.ai.main.baseURL })
                    },
                    research: {
                        provider: globalConfig.ai.research?.provider || globalConfig.ai.main.provider,
                        modelId: globalConfig.ai.research?.modelId || globalConfig.ai.main.modelId,
                        maxTokens: globalConfig.ai.research?.maxTokens || globalConfig.ai.main.maxTokens,
                        temperature: globalConfig.ai.research?.temperature || 0.1,
                        model: globalConfig.ai.research?.modelId || globalConfig.ai.main.modelId,
                        ...(globalConfig.ai.research?.baseURL && { baseURL: globalConfig.ai.research.baseURL })
                    },
                    fallback: {
                        provider: globalConfig.ai.fallback?.provider || globalConfig.ai.main.provider,
                        modelId: globalConfig.ai.fallback?.modelId || globalConfig.ai.main.modelId,
                        maxTokens: globalConfig.ai.fallback?.maxTokens || globalConfig.ai.main.maxTokens,
                        temperature: globalConfig.ai.fallback?.temperature || globalConfig.ai.main.temperature,
                        model: globalConfig.ai.fallback?.modelId || globalConfig.ai.main.modelId,
                    ...(globalConfig.ai.fallback?.baseURL && { baseURL: globalConfig.ai.fallback.baseURL })
                }
            },
            defaults: globalConfig.defaults || {},
            system: globalConfig.system || {},
            global: {
                logLevel: globalConfig.system?.logLevel || "info",
                debug: globalConfig.system?.debug || false,
                defaultSubtasks: globalConfig.defaults?.task?.subtasks || 5,
                defaultPriority: globalConfig.defaults?.task?.priority || "medium",
                projectName: "TaskMaster Project",
                userId: "default-user"
            }
        };
        } else {
            // 无效配置，使用默认值
            this.logger.warn('Invalid global config format, using defaults');
            return {
                models: {
                    main: {
                        provider: 'openai',
                        modelId: 'gpt-4',
                        maxTokens: 4000,
                        temperature: 0.7,
                        model: 'gpt-4'
                    },
                    research: {
                        provider: 'openai',
                        modelId: 'gpt-4',
                        maxTokens: 4000,
                        temperature: 0.1,
                        model: 'gpt-4'
                    },
                    fallback: {
                        provider: 'openai',
                        modelId: 'gpt-4',
                        maxTokens: 4000,
                        temperature: 0.7,
                        model: 'gpt-4'
                    }
                }
            };
        }
    }

    /**
     * 写入JSON文件
     */
    async _writeJSON(filePath, data) {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    }

    /**
     * 删除文件
     */
    async _deleteFile(filePath) {
        try {
            await fs.unlink(filePath);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }

    /**
     * 检查文件是否存在
     */
    async _fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 获取项目路径 - 统一的项目路径获取方法
     * @param {string} projectId - 项目ID
     * @returns {string} 项目根路径（用于传递给原始脚本）
     */
    getProjectPath(projectId) {
        if (!projectId) {
            throw new Error('Project ID is required');
        }
        return this.pathManager.getLegacyProjectRoot(projectId);
    }

    /**
     * 确保项目目录结构存在
     * @param {string} projectId - 项目ID
     */
    async ensureProjectStructure(projectId) {
        await this.pathManager.ensureProjectStructure(projectId);
    }

    /**
     * 使用新的配置系统解析PRD并生成任务
     * @param {string} projectId - 项目ID（而不是projectPath）
     * @param {string} prdPath - PRD文件路径（可选）
     * @param {number} numTasks - 生成任务数量
     * @param {Object} options - 选项
     */
    async parsePRD(projectId, prdPath, numTasks, options = {}) {
        try {
            // 使用统一的路径管理器获取路径
            const projectPath = this.getProjectPath(projectId);
            const tasksPath = this.pathManager.getTasksPath(projectId);
            let actualPrdPath = prdPath;
            let prdContent = '';

            // 确保项目目录结构存在
            await this.ensureProjectStructure(projectId);

            // 处理PRD内容
            if (options.prdContent && !prdPath) {
                // 如果提供了内容而不是路径，创建临时文件
                const tempFileName = `temp_prd_${Date.now()}.txt`;
                actualPrdPath = this.pathManager.getPrdPath(projectId, tempFileName);

                // 写入临时文件
                fsSync.writeFileSync(actualPrdPath, options.prdContent, 'utf8');
                prdContent = options.prdContent;
            } else if (actualPrdPath) {
                // 如果提供的是相对路径，转换为绝对路径
                if (!path.isAbsolute(actualPrdPath)) {
                    actualPrdPath = this.pathManager.getPrdPath(projectId, actualPrdPath);
                }
                // 读取PRD文件内容
                prdContent = fsSync.readFileSync(actualPrdPath, 'utf8');
            } else {
                // 使用默认PRD路径
                actualPrdPath = this.pathManager.getPrdPath(projectId);
                if (fsSync.existsSync(actualPrdPath)) {
                    prdContent = fsSync.readFileSync(actualPrdPath, 'utf8');
                } else {
                    throw new Error('Either prdPath or prdContent must be provided, or default prd.txt must exist');
                }
            }

            // 检查并读取现有任务文件
            let existingTasks = [];
            let nextId = 1;

            if (fsSync.existsSync(tasksPath)) {
                try {
                    const tasksData = JSON.parse(fsSync.readFileSync(tasksPath, 'utf8'));
                    if (tasksData.main && tasksData.main.tasks) {
                        existingTasks = tasksData.main.tasks;
                        nextId = Math.max(...existingTasks.map(t => t.id), 0) + 1;
                    }
                } catch (error) {
                    this.logger.warn('Failed to read existing tasks', { error: error.message });
                }
            }

            // 构建AI提示
            const systemPrompt = `You are an AI assistant specialized in analyzing Product Requirements Documents (PRDs) and generating a structured, logically ordered, dependency-aware and sequenced list of development tasks in JSON format.

Analyze the provided PRD content and generate approximately ${numTasks} top-level development tasks. If the complexity or the level of detail of the PRD is high, generate more tasks relative to the complexity of the PRD
Each task should represent a logical unit of work needed to implement the requirements and focus on the most direct and effective way to implement the requirements without unnecessary complexity or overengineering. Include pseudo-code, implementation details, and test strategy for each task. Find the most up to date information to implement each task.
Assign sequential IDs starting from ${nextId}. Infer title, description, details, and test strategy for each task based *only* on the PRD content.
Set status to 'pending', dependencies to an empty array [], and priority to 'medium' initially for all tasks.
Respond ONLY with a valid JSON object containing a single key "tasks", where the value is an array of task objects adhering to the provided Zod schema. Do not include any explanation or markdown formatting.

Each task should follow this JSON structure:
{
	"id": number,
	"title": string,
	"description": string,
	"status": "pending",
	"dependencies": number[] (IDs of tasks this depends on),
	"priority": "high" | "medium" | "low",
	"details": string (implementation details),
	"testStrategy": string (validation approach)
}

Guidelines:
1. Unless complexity warrants otherwise, create exactly ${numTasks} tasks, numbered sequentially starting from ${nextId}
2. Each task should be atomic and focused on a single responsibility following the most up to date best practices and standards
3. Order tasks logically - consider dependencies and implementation sequence
4. Early tasks should focus on setup, core functionality first, then advanced features
5. Include clear validation/testing approach for each task
6. Set appropriate dependency IDs (a task can only depend on tasks with lower IDs, potentially including existing tasks with IDs less than ${nextId} if applicable)
7. Assign priority (high/medium/low) based on criticality and dependency order
8. Include detailed implementation guidance in the "details" field
9. If the PRD contains specific requirements for libraries, database schemas, frameworks, tech stacks, or any other implementation details, STRICTLY ADHERE to these requirements in your task breakdown and do not discard them under any circumstance
10. Focus on filling in any gaps left by the PRD or areas that aren't fully specified, while preserving all explicit requirements
11. Always aim to provide the most direct path to implementation, avoiding over-engineering or roundabout approaches`;

            const userPrompt = `Here's the Product Requirements Document (PRD) to break down into approximately ${numTasks} tasks, starting IDs from ${nextId}:

${prdContent}



		Return your response in this format:
{
    "tasks": [
        {
            "id": 1,
            "title": "Setup Project Repository",
            "description": "...",
            ...
        },
        ...
    ],
    "metadata": {
        "projectName": "PRD Implementation",
        "totalTasks": ${numTasks},
        "sourceFile": "${actualPrdPath}",
        "generatedAt": "YYYY-MM-DD"
    }
}`;

            this.logger.info('Calling AI service to generate tasks from PRD...', {
                numTasks,
                nextId,
                research: options.research || false
            });

            // 调用AI服务，传递正确的项目根路径以确保使用正确的配置
            const aiResponse = await generateObjectService({
                role: options.research ? 'research' : 'main',
                schema: prdResponseSchema,
                objectName: 'tasks_data',
                systemPrompt,
                prompt: userPrompt,
                commandName: 'parse-prd',
                outputType: 'json',
                projectRoot: process.cwd() // 传递当前工作目录作为项目根路径
            });

            let generatedTasks = aiResponse.data || aiResponse;

            // 处理AI服务返回的嵌套数据结构
            // 如果返回的是 { mainResult: { tasks: [...] } } 格式，提取mainResult
            if (generatedTasks && generatedTasks.mainResult && generatedTasks.mainResult.tasks) {
                this.logger.debug('Extracting tasks from mainResult structure');
                generatedTasks = generatedTasks.mainResult;
            }

            // 添加调试日志来查看AI服务返回的数据结构
            this.logger.debug('AI service response structure', {
                hasData: !!aiResponse.data,
                responseType: typeof aiResponse,
                generatedTasksType: typeof generatedTasks,
                generatedTasksKeys: generatedTasks ? Object.keys(generatedTasks) : null,
                hasTasks: generatedTasks && generatedTasks.tasks,
                tasksType: generatedTasks && generatedTasks.tasks ? typeof generatedTasks.tasks : null,
                isTasksArray: generatedTasks && Array.isArray(generatedTasks.tasks)
            });

            // 处理生成的任务数据，确保ID连续性
            if (!generatedTasks || !Array.isArray(generatedTasks.tasks)) {
                this.logger.error('AI service data structure validation failed', {
                    generatedTasks: JSON.stringify(generatedTasks, null, 2)
                });
                throw new Error('AI service returned unexpected data structure');
            }

            let currentId = nextId;
            const taskMap = new Map();
            const processedNewTasks = generatedTasks.tasks.map((task) => {
                const newId = currentId++;
                taskMap.set(task.id, newId);
                return {
                    ...task,
                    id: newId,
                    status: 'pending',
                    priority: task.priority || 'medium',
                    dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
                    subtasks: []
                };
            });

            // 更新依赖关系
            processedNewTasks.forEach((task) => {
                if (Array.isArray(task.dependencies)) {
                    task.dependencies = task.dependencies.map((depId) => taskMap.get(depId) || depId);
                }
            });

            // 合并现有任务和新任务
            const finalTasks = options.append ? [...existingTasks, ...processedNewTasks] : processedNewTasks;

            // 读取现有文件以保留其他标签
            let outputData = {};
            if (await this._fileExists(tasksPath)) {
                try {
                    const existingFileContent = await fs.readFile(tasksPath, 'utf8');
                    outputData = JSON.parse(existingFileContent);
                } catch (error) {
                    // 如果无法读取现有文件，从空对象开始
                    outputData = {};
                }
            }

            // 更新目标标签，保留其他标签
            outputData['main'] = {
                tasks: finalTasks,
                metadata: {
                    created: outputData['main']?.metadata?.created || new Date().toISOString(),
                    updated: new Date().toISOString(),
                    description: 'Main tasks context'
                }
            };

            // 写入完整的数据结构到文件
            await fs.writeFile(tasksPath, JSON.stringify(outputData, null, 2));

            this.logger.info(`Successfully ${options.append ? 'appended' : 'generated'} ${processedNewTasks.length} tasks in ${tasksPath}`, {
                projectPath,
                numTasks: processedNewTasks.length,
                append: options.append
            });

            // 清理临时文件
            if (options.prdContent && !prdPath && fsSync.existsSync(actualPrdPath)) {
                try {
                    fsSync.unlinkSync(actualPrdPath);
                } catch (cleanupError) {
                    this.logger.warn('Failed to cleanup temporary PRD file', {
                        file: actualPrdPath,
                        error: cleanupError.message
                    });
                }
            }

            // 构建返回结果，与原始parsePRD格式兼容
            return {
                success: true,
                tasksPath,
                data: {
                    ...generatedTasks,
                    tasks: processedNewTasks
                },
                telemetryData: aiResponse.telemetryData || null,
                tagInfo: { tag: 'main', isNewTag: existingTasks.length === 0 }
            };

        } catch (error) {
            this.logger.error('PRD parsing failed', { error: error.message, projectId });
            throw error;
        }
    }

    /**
     * 适配现有的addTask函数到项目目录
     * @param {string} projectId - 项目ID（而不是projectPath）
     * @param {string} title - 任务标题
     * @param {string} description - 任务描述
     * @param {string} priority - 任务优先级
     * @param {Object} options - 选项
     */
    async addTask(projectId, title, description, priority = 'medium', options = {}) {
        let tempConfigPath = null;

        try {
            const projectPath = this.getProjectPath(projectId);
            const tasksPath = this.pathManager.getTasksPath(projectId);

            // 准备addTask函数的参数
            const prompt = `${title}\n\n${description}`;
            const dependencies = [];

            // 使用根目录的.taskmaster/config.json配置文件
            const rootConfigPath = path.join(process.cwd(), '.taskmaster', 'config.json');
            const projectConfigPath = path.join(projectPath, '.taskmaster', 'config.json');

            try {
                // 首先尝试读取根目录的配置文件
                const configData = await fs.readFile(rootConfigPath, 'utf8');
                const rootConfig = JSON.parse(configData);
                this.logger.debug('Using root config for project', {
                    hasModels: !!rootConfig.models,
                    mainProvider: rootConfig.models?.main?.provider,
                    mainModel: rootConfig.models?.main?.modelId
                });

                // 将根配置复制到项目目录（如果不存在或需要更新）
                try {
                    const existingConfigData = await fs.readFile(projectConfigPath, 'utf8');
                    const existingConfig = JSON.parse(existingConfigData);

                    // 检查是否需要更新项目配置
                    if (existingConfig.models?.main?.provider !== rootConfig.models?.main?.provider ||
                        existingConfig.models?.main?.modelId !== rootConfig.models?.main?.modelId) {
                        this.logger.info('Updating project config with root config');
                        await this._writeJSON(projectConfigPath, rootConfig);
                    }
                } catch (projectError) {
                    if (projectError.code === 'ENOENT') {
                        // 项目配置不存在，创建它
                        this.logger.info('Creating project config from root config');
                        await this._writeJSON(projectConfigPath, rootConfig);
                    } else {
                        throw projectError;
                    }
                }

                tempConfigPath = projectConfigPath;

            } catch (error) {
                if (error.code === 'ENOENT') {
                    // 根配置不存在，使用全局配置作为后备
                    this.logger.warn('Root config not found, using global config as fallback');
                    const globalConfig = await this.configManager.getGlobalConfig();
                    const legacyConfig = this._convertToLegacyConfig(globalConfig);

                    // 创建项目配置文件
                    await this._writeJSON(projectConfigPath, legacyConfig);
                    tempConfigPath = projectConfigPath;
                    this.logger.info('Created project config file from global config');
                } else {
                    throw error;
                }
            }

            // 创建兼容的logger对象
            const compatibleLogger = {
                info: (msg) => this.logger.info(msg),
                debug: (msg) => this.logger.debug(msg),
                warn: (msg) => this.logger.warn(msg),
                error: (msg) => this.logger.error(msg),
                success: (msg) => this.logger.info(msg)
            };

            const context = {
                projectRoot: projectPath,
                mcpLog: compatibleLogger,
                ...options
            };
            const outputFormat = 'json';

            // 支持手动任务数据，默认使用AI生成
            const manualTaskData = options.useManualData ? {
                title: title,
                description: description,
                details: `Implementation details for: ${title}\n\n${description}`,
                testStrategy: `Test strategy for: ${title}\n\n1. Verify the implementation meets requirements\n2. Test edge cases\n3. Validate expected behavior`,
                dependencies: dependencies
            } : null;

            const useResearch = options.useResearch || false;
            const tag = options.tag || null;

            const { default: addTask } = await import('../../scripts/modules/task-manager/add-task.js');
            const result = await addTask(
                tasksPath,
                prompt,
                dependencies,
                priority,
                context,
                outputFormat,
                manualTaskData,
                useResearch,
                tag
            );

            return result;
        } catch (error) {
            this.logger.error('Add task failed', { error: error.message, projectId });
            throw error;
        } finally {
            // 注意：不删除项目配置文件，因为它是项目的持久配置
            // tempConfigPath 现在指向项目的 .taskmaster/config.json，应该保留
            this.logger.debug('Task operation completed, project config preserved');
        }
    }

    /**
     * 适配现有的listTasks函数到项目目录
     * @param {string} projectId - 项目ID（而不是projectPath）
     * @param {Object} options - 选项
     */
    async listTasks(projectId, options = {}) {
        try {
            const projectPath = this.getProjectPath(projectId);
            const tasksPath = this.pathManager.getTasksPath(projectId);

            // 准备listTasks函数的参数
            const statusFilter = options.statusFilter || null;
            const reportPath = null; // 暂时不使用复杂度报告
            const withSubtasks = options.withSubtasks || false;
            const outputFormat = 'json';
            const tag = options.tag || 'main';  // 默认使用main标签
            const context = {
                projectRoot: projectPath,
                mcpLog: this.logger,
                ...options
            };

            const { default: listTasks } = await import('../../scripts/modules/task-manager/list-tasks.js');
            const result = await listTasks(
                tasksPath,
                statusFilter,
                reportPath,
                withSubtasks,
                outputFormat,
                tag,
                context
            );

            return result;
        } catch (error) {
            this.logger.error('List tasks failed', { error: error.message, projectId });
            throw error;
        }
    }

    /**
     * 适配现有的expandTask函数到项目目录
     * @param {string} projectId - 项目ID（而不是projectPath）
     * @param {string|number} taskId - 任务ID
     * @param {number} numSubtasks - 子任务数量
     * @param {Object} options - 选项
     */
    async expandTask(projectId, taskId, numSubtasks, options = {}) {
        let tempConfigPath = null;

        try {
            const projectPath = this.getProjectPath(projectId);
            const tasksPath = this.pathManager.getTasksPath(projectId);

            // 使用根目录的.taskmaster/config.json配置文件
            const rootConfigPath = path.join(process.cwd(), '.taskmaster', 'config.json');
            const projectConfigPath = path.join(projectPath, '.taskmaster', 'config.json');

            try {
                // 首先尝试读取根目录的配置文件
                const configData = await fs.readFile(rootConfigPath, 'utf8');
                const rootConfig = JSON.parse(configData);
                this.logger.debug('Using root config for expandTask', {
                    hasModels: !!rootConfig.models,
                    mainProvider: rootConfig.models?.main?.provider,
                    mainModel: rootConfig.models?.main?.modelId
                });

                // 将根配置复制到项目目录（如果不存在或需要更新）
                try {
                    const existingConfigData = await fs.readFile(projectConfigPath, 'utf8');
                    const existingConfig = JSON.parse(existingConfigData);

                    // 检查是否需要更新项目配置
                    if (existingConfig.models?.main?.provider !== rootConfig.models?.main?.provider ||
                        existingConfig.models?.main?.modelId !== rootConfig.models?.main?.modelId) {
                        this.logger.info('Updating project config with root config for expandTask');
                        await this._writeJSON(projectConfigPath, rootConfig);
                    }
                } catch (projectError) {
                    if (projectError.code === 'ENOENT') {
                        // 项目配置不存在，创建它
                        this.logger.info('Creating project config from root config for expandTask');
                        await this._writeJSON(projectConfigPath, rootConfig);
                    } else {
                        throw projectError;
                    }
                }

                tempConfigPath = projectConfigPath;

            } catch (error) {
                if (error.code === 'ENOENT') {
                    // 根配置不存在，使用全局配置作为后备
                    this.logger.warn('Root config not found for expandTask, using global config as fallback');
                    const globalConfig = await this.configManager.getGlobalConfig();
                    const legacyConfig = this._convertToLegacyConfig(globalConfig);

                    // 创建项目配置文件
                    await this._writeJSON(projectConfigPath, legacyConfig);
                    tempConfigPath = projectConfigPath;
                    this.logger.info('Created project config file from global config for expandTask');
                } else {
                    throw error;
                }
            }

            this.logger.debug(`Created temporary config file for expandTask: ${tempConfigPath}`);

            // 等待一小段时间确保文件系统同步
            await new Promise(resolve => setTimeout(resolve, 100));

            const useResearch = options.research || false;
            const additionalContext = options.additionalContext || '';
            const force = options.force || false;

            const context = {
                projectRoot: projectPath,
                mcpLog: this.logger,
                outputFormat: 'json',
                tag: 'main',  // 明确指定使用main标签
                ...options
            };

            // 验证任务文件和临时配置文件都存在
            const tasksExists = await this._fileExists(tasksPath);
            const configExists = await this._fileExists(tempConfigPath);

            if (!tasksExists) {
                throw new Error(`Tasks file not found: ${tasksPath}`);
            }
            if (!configExists) {
                throw new Error(`Temporary config file not found: ${tempConfigPath}`);
            }

            this.logger.debug(`Calling expandTask with taskId: ${taskId} (${typeof taskId})`);

            // 预先验证任务是否存在，避免原始脚本中的readJSON问题
            const tasksData = JSON.parse(await fs.readFile(tasksPath, 'utf8'));
            // 检查不同的可能结构：master.tasks 或 main.tasks 或直接的 tasks 数组
            const mainTasks = tasksData.master?.tasks || tasksData.main?.tasks || tasksData.tasks || [];
            const taskExists = mainTasks.some(t => t.id === parseInt(taskId, 10));

            this.logger.debug('Task validation', {
                taskId,
                taskIdType: typeof taskId,
                parsedTaskId: parseInt(taskId, 10),
                tasksStructure: Object.keys(tasksData),
                mainTasksLength: mainTasks.length,
                taskIds: mainTasks.map(t => t.id)
            });

            if (!taskExists) {
                throw new Error(`Task ${taskId} not found in project ${path.basename(projectPath)}`);
            }

            this.logger.debug(`Task ${taskId} verified to exist, proceeding with expansion`);

            const { default: expandTask } = await import('../../scripts/modules/task-manager/expand-task.js');
            const result = await expandTask(
                tasksPath,
                taskId,
                numSubtasks,
                useResearch,
                additionalContext,
                context,
                force
            );

            return result;
        } catch (error) {
            this.logger.error('Expand task failed', { error: error.message, projectId, taskId });
            throw error;
        } finally {
            // 注意：不删除项目配置文件，因为它是项目的持久配置
            // tempConfigPath 现在指向项目的 .taskmaster/config.json，应该保留
            this.logger.debug('ExpandTask operation completed, project config preserved');
        }
    }

    /**
     * 适配现有的setTaskStatus函数到项目目录
     * @param {string} projectId - 项目ID（而不是projectPath）
     * @param {string|number} taskId - 任务ID
     * @param {string} status - 任务状态
     * @param {Object} options - 选项
     */
    async setTaskStatus(projectId, taskId, status, options = {}) {
        try {
            const projectPath = this.getProjectPath(projectId);
            const tasksPath = this.pathManager.getTasksPath(projectId);

            const adaptedOptions = {
                ...options,
                projectRoot: projectPath,
                mcpLog: this.logger,
                outputFormat: 'json'
            };

            // 确保taskId是字符串格式
            const taskIdString = String(taskId);

            const { default: setTaskStatus } = await import('../../scripts/modules/task-manager/set-task-status.js');
            const result = await setTaskStatus(tasksPath, taskIdString, status, adaptedOptions);

            return result;
        } catch (error) {
            this.logger.error('Set task status failed', { error: error.message, projectId });
            throw error;
        }
    }

    /**
     * 适配现有的updateTaskById函数到项目目录
     * @param {string} projectId - 项目ID（而不是projectPath）
     * @param {string|number} taskId - 任务ID
     * @param {Object} updates - 更新内容
     * @param {Object} options - 选项
     */
    async updateTaskById(projectId, taskId, updates, options = {}) {
        try {
            const projectPath = this.getProjectPath(projectId);
            const tasksPath = this.pathManager.getTasksPath(projectId);

            const adaptedOptions = {
                ...options,
                projectRoot: projectPath,
                mcpLog: this.logger,
                outputFormat: 'json'
            };

            // 如果只是状态更新，使用setTaskStatus函数
            if (updates.status && Object.keys(updates).length === 1) {
                return await this.setTaskStatus(projectId, taskId, updates.status, adaptedOptions);
            }

            // 对于其他更新，构建一个prompt描述更新内容
            const updatePrompt = this.buildUpdatePrompt(updates);

            const { default: updateTaskById } = await import('../../scripts/modules/task-manager/update-task-by-id.js');
            const result = await updateTaskById(tasksPath, taskId, updatePrompt, false, adaptedOptions);

            return result;
        } catch (error) {
            this.logger.error('Update task failed', { error: error.message, projectId });
            throw error;
        }
    }

    /**
     * 构建更新提示
     */
    buildUpdatePrompt(updates) {
        const updateParts = [];

        if (updates.title) {
            updateParts.push(`Update title to: ${updates.title}`);
        }
        if (updates.description) {
            updateParts.push(`Update description to: ${updates.description}`);
        }
        if (updates.priority) {
            updateParts.push(`Update priority to: ${updates.priority}`);
        }
        if (updates.status) {
            updateParts.push(`Update status to: ${updates.status}`);
        }

        return updateParts.length > 0 ? updateParts.join('\n') : 'Update task';
    }

    /**
     * 适配现有的removeTask函数到项目目录
     * @param {string} projectId - 项目ID（而不是projectPath）
     * @param {string|number} taskId - 任务ID
     * @param {Object} options - 选项
     */
    async removeTask(projectId, taskId, options = {}) {
        try {
            const projectPath = this.getProjectPath(projectId);
            const tasksPath = this.pathManager.getTasksPath(projectId);
            
            const adaptedOptions = {
                ...options,
                projectRoot: projectPath,
                mcpLog: this.logger,
                outputFormat: 'json'
            };

            const { default: removeTask } = await import('../../scripts/modules/task-manager/remove-task.js');
            const result = await removeTask(tasksPath, taskId, adaptedOptions);
            
            return result;
        } catch (error) {
            this.logger.error('Remove task failed', { error: error.message, projectId });
            throw error;
        }
    }

    /**
     * 适配现有的generateTaskFiles函数到项目目录
     * @param {string} projectId - 项目ID（而不是projectPath）
     * @param {Object} options - 选项
     */
    async generateTaskFiles(projectId, options = {}) {
        try {
            const projectPath = this.getProjectPath(projectId);
            const tasksPath = this.pathManager.getTasksPath(projectId);
            const outputDir = path.join(this.pathManager.getTaskmasterDir(projectId), 'tasks');

            const adaptedOptions = {
                ...options,
                projectRoot: projectPath,
                mcpLog: this.logger
            };

            const { default: generateTaskFiles } = await import('../../scripts/modules/task-manager/generate-task-files.js');
            const result = await generateTaskFiles(tasksPath, outputDir, adaptedOptions);

            return result;
        } catch (error) {
            this.logger.error('Generate task files failed', { error: error.message, projectId });
            throw error;
        }
    }

    /**
     * 适配现有的analyzeTaskComplexity函数到项目目录
     * @param {string} projectId - 项目ID（而不是projectPath）
     * @param {string|number} taskId - 任务ID
     * @param {Object} options - 选项
     */
    async analyzeTaskComplexity(projectId, taskId, options = {}) {
        try {
            const projectPath = this.getProjectPath(projectId);
            const tasksPath = this.pathManager.getTasksPath(projectId);

            const adaptedOptions = {
                ...options,
                projectRoot: projectPath,
                mcpLog: this.logger,
                outputFormat: 'json'
            };

            const { default: analyzeTaskComplexity } = await import('../../scripts/modules/task-manager/analyze-task-complexity.js');
            const result = await analyzeTaskComplexity(tasksPath, taskId, adaptedOptions);

            return result;
        } catch (error) {
            this.logger.error('Analyze task complexity failed', { error: error.message, projectId });
            throw error;
        }
    }

    /**
     * 扩展所有任务
     * @param {string} projectId - 项目ID
     * @param {Object} options - 选项
     */
    async expandAllTasks(projectId, options = {}) {
        try {
            const projectPath = this.getProjectPath(projectId);
            const tasksPath = this.pathManager.getTasksPath(projectId);

            const adaptedOptions = {
                ...options,
                projectRoot: projectPath,
                mcpLog: this.logger,
                outputFormat: 'json'
            };

            const { default: expandAllTasks } = await import('../../scripts/modules/task-manager/expand-all-tasks.js');
            const result = await expandAllTasks(tasksPath, adaptedOptions);

            return result;
        } catch (error) {
            this.logger.error('Expand all tasks failed', { error: error.message, projectId });
            throw error;
        }
    }

    /**
     * 分析项目复杂度
     * @param {string} projectId - 项目ID
     * @param {Object} options - 选项
     */
    async analyzeProjectComplexity(projectId, options = {}) {
        try {
            const projectPath = this.getProjectPath(projectId);
            const tasksPath = this.pathManager.getTasksPath(projectId);

            // 使用现有的任务复杂度分析功能来分析整个项目
            const adaptedOptions = {
                ...options,
                projectRoot: projectPath,
                mcpLog: this.logger,
                outputFormat: 'json',
                analyzeAll: true // 分析所有任务
            };

            const { default: analyzeTaskComplexity } = await import('../../scripts/modules/task-manager/analyze-task-complexity.js');

            // 获取所有任务并分析
            const tasksResult = await this.listTasks(projectId);
            const tasks = tasksResult.tasks || [];

            if (tasks.length === 0) {
                return {
                    message: 'No tasks found in project',
                    complexity: 'low',
                    taskCount: 0
                };
            }

            // 分析每个任务的复杂度
            const taskAnalyses = [];
            for (const task of tasks) {
                try {
                    const taskResult = await analyzeTaskComplexity(tasksPath, task.id, adaptedOptions);
                    taskAnalyses.push({
                        taskId: task.id,
                        title: task.title,
                        complexity: taskResult
                    });
                } catch (taskError) {
                    this.logger.warn(`Failed to analyze task ${task.id}`, { error: taskError.message });
                }
            }

            // 汇总项目复杂度
            const result = {
                projectId,
                totalTasks: tasks.length,
                analyzedTasks: taskAnalyses.length,
                taskAnalyses: options.detailed ? taskAnalyses : undefined,
                summary: {
                    averageComplexity: 'medium', // 简化计算
                    highComplexityTasks: taskAnalyses.filter(t => t.complexity?.complexity === 'high').length,
                    mediumComplexityTasks: taskAnalyses.filter(t => t.complexity?.complexity === 'medium').length,
                    lowComplexityTasks: taskAnalyses.filter(t => t.complexity?.complexity === 'low').length
                }
            };

            return result;
        } catch (error) {
            this.logger.error('Analyze project complexity failed', { error: error.message, projectId });
            throw error;
        }
    }

    /**
     * 获取下一个任务
     * @param {string} projectId - 项目ID
     * @param {Object} options - 选项
     */
    async getNextTask(projectId, options = {}) {
        try {
            // 获取任务列表
            const tasksResult = await this.listTasks(projectId);
            const tasks = tasksResult.tasks || [];

            if (tasks.length === 0) {
                return null;
            }

            // 过滤指定状态的任务
            const { status = 'pending' } = options;
            const filteredTasks = tasks.filter(task => task.status === status);

            if (filteredTasks.length === 0) {
                return null;
            }

            const { default: findNextTask } = await import('../../scripts/modules/task-manager/find-next-task.js');
            const result = findNextTask(filteredTasks);

            return result;
        } catch (error) {
            this.logger.error('Get next task failed', { error: error.message, projectId });
            throw error;
        }
    }

    /**
     * 生成复杂度报告
     * @param {string} projectId - 项目ID
     * @param {Object} options - 选项
     */
    async generateComplexityReport(projectId, options = {}) {
        try {
            // 使用项目复杂度分析功能生成报告
            const analysisResult = await this.analyzeProjectComplexity(projectId, { detailed: true });

            const { format = 'json' } = options;

            if (format === 'markdown') {
                // 生成Markdown格式报告
                const markdown = this._generateMarkdownReport(analysisResult);
                return { format: 'markdown', content: markdown };
            } else {
                // 返回JSON格式报告
                return { format: 'json', content: analysisResult };
            }
        } catch (error) {
            this.logger.error('Generate complexity report failed', { error: error.message, projectId });
            throw error;
        }
    }

    /**
     * 生成Markdown格式的复杂度报告
     * @private
     */
    _generateMarkdownReport(analysisResult) {
        const { projectId, totalTasks, summary, taskAnalyses } = analysisResult;

        let markdown = `# Project Complexity Report: ${projectId}\n\n`;
        markdown += `## Summary\n`;
        markdown += `- Total Tasks: ${totalTasks}\n`;
        markdown += `- High Complexity: ${summary.highComplexityTasks}\n`;
        markdown += `- Medium Complexity: ${summary.mediumComplexityTasks}\n`;
        markdown += `- Low Complexity: ${summary.lowComplexityTasks}\n\n`;

        if (taskAnalyses && taskAnalyses.length > 0) {
            markdown += `## Task Details\n\n`;
            for (const task of taskAnalyses) {
                markdown += `### Task ${task.taskId}: ${task.title}\n`;
                markdown += `- Complexity: ${task.complexity?.complexity || 'unknown'}\n\n`;
            }
        }

        return markdown;
    }
}

export default CoreAdapter;
export { ProjectPathManager };
