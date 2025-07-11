import fs from 'fs/promises';
import path from 'path';
import { createLogger } from './logger.js';
import { getCacheManager } from './cache-manager.js';
import ConfigManager from '../services/config-manager.js';
import CoreAdapter from '../services/core-adapter.js';

class ProjectManager {
    constructor(projectsDir) {
        this.projectsDir = projectsDir;
        this.logger = createLogger('project-manager');
        this.cache = getCacheManager();
        this.projects = new Map();
        this.configManager = new ConfigManager();
        this.coreAdapter = new CoreAdapter(projectsDir);
        this.cachePrefix = 'project:';
        this.cacheTTL = 600000; // 10分钟缓存
    }

    async init() {
        // 初始化配置管理器
        await this.configManager.initialize();

        // 初始化核心适配器
        await this.coreAdapter.initialize();

        // 确保projects目录存在
        await this.ensureProjectsDirectory();

        // 加载现有项目
        await this.loadExistingProjects();
    }

    async ensureProjectsDirectory() {
        try {
            await fs.mkdir(this.projectsDir, { recursive: true });
            this.logger.info(`Projects directory ensured: ${this.projectsDir}`);
        } catch (error) {
            this.logger.error('Failed to create projects directory', { error: error.message });
            throw error;
        }
    }

    async loadExistingProjects() {
        try {
            const entries = await fs.readdir(this.projectsDir, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    try {
                        const project = await this.loadProject(entry.name);
                        this.projects.set(entry.name, project);
                        this.logger.info(`Loaded project: ${entry.name}`);
                    } catch (error) {
                        this.logger.warn(`Failed to load project ${entry.name}`, { 
                            error: error.message 
                        });
                    }
                }
            }
            
            this.logger.info(`Loaded ${this.projects.size} projects`);
        } catch (error) {
            this.logger.error('Failed to load existing projects', { error: error.message });
        }
    }

    async loadProject(projectId) {
        const projectPath = this.getProjectPath(projectId);
        const taskmasterPath = path.join(projectPath, '.taskmaster');

        try {
            // 检查.taskmaster目录是否存在
            await fs.access(taskmasterPath);

            // 检查项目是否在配置管理器中注册
            const projectsConfig = this.configManager.getProjectsConfig();
            if (!projectsConfig.projects[projectId]) {
                // 如果项目未注册，自动注册
                await this.configManager.registerProject(projectId, {
                    name: projectId,
                    description: '',
                    template: 'default'
                });
            }

            return {
                id: projectId,
                path: projectPath,
                lastAccessed: new Date().toISOString()
            };
        } catch (error) {
            throw new Error(`Failed to load project ${projectId}: ${error.message}`);
        }
    }

    async createProject(projectId, name, description = '', template = 'default') {
        // 验证项目ID
        if (!this.isValidProjectId(projectId)) {
            throw new Error('Invalid project ID. Must contain only letters, numbers, hyphens, and underscores.');
        }

        // 检查项目是否已存在
        if (this.projects.has(projectId)) {
            throw new Error(`Project ${projectId} already exists`);
        }

        const projectPath = this.getProjectPath(projectId);
        
        try {
            // 创建项目目录结构
            await this.createProjectStructure(projectPath);

            // 在配置管理器中注册项目
            await this.configManager.registerProject(projectId, {
                name,
                description,
                template: template || 'default'
            });

            // 初始化项目数据
            await this.initializeProjectData(projectPath, template);

            // 缓存项目
            const project = {
                id: projectId,
                path: projectPath,
                lastAccessed: new Date().toISOString()
            };

            this.projects.set(projectId, project);
            
            this.logger.info(`Created project: ${projectId}`, { name, template });
            
            return project;
            
        } catch (error) {
            // 清理失败的项目创建
            try {
                await fs.rm(projectPath, { recursive: true, force: true });
            } catch (cleanupError) {
                this.logger.warn('Failed to cleanup failed project creation', {
                    projectId,
                    error: cleanupError.message
                });
            }
            
            throw new Error(`Failed to create project ${projectId}: ${error.message}`);
        }
    }

    async createProjectStructure(projectPath) {
        const taskmasterPath = path.join(projectPath, '.taskmaster');
        const directories = [
            'tasks',
            'docs', 
            'reports',
            'templates',
            'logs'
        ];

        await fs.mkdir(projectPath, { recursive: true });
        await fs.mkdir(taskmasterPath, { recursive: true });
        
        for (const dir of directories) {
            await fs.mkdir(path.join(taskmasterPath, dir), { recursive: true });
        }
    }

    /**
     * 获取项目配置（通过配置管理器）
     */
    async getProjectConfig(projectId) {
        // 更新项目访问时间
        await this.configManager.updateProjectAccess(projectId);
        return await this.configManager.getProjectConfig(projectId);
    }

    /**
     * 获取全局配置
     */
    getGlobalConfig() {
        return this.configManager.getGlobalConfig();
    }

    /**
     * 获取项目列表配置
     */
    getProjectsConfig() {
        return this.configManager.getProjectsConfig();
    }

    async initializeProjectData(projectPath, template) {
        const taskmasterPath = path.join(projectPath, '.taskmaster');

        // 注意：不再创建项目级config.json，使用全局配置
        // 项目信息存储在全局projects.json中

        // 初始化空的任务文件
        const tasksData = {
            main: {
                tasks: [],
                metadata: {
                    created: new Date().toISOString(),
                    description: 'Main tasks context'
                }
            }
        };

        const tasksPath = path.join(taskmasterPath, 'tasks', 'tasks.json');
        await fs.writeFile(tasksPath, JSON.stringify(tasksData, null, 2));

        // 初始化状态文件
        const stateData = {
            currentTag: 'main',
            lastActivity: new Date().toISOString(),
            statistics: {
                totalTasks: 0,
                completedTasks: 0,
                pendingTasks: 0,
                lastTaskId: 0
            }
        };

        const statePath = path.join(taskmasterPath, 'state.json');
        await fs.writeFile(statePath, JSON.stringify(stateData, null, 2));

        // 初始化产品需求文件
        const requirementsData = {
            requirements: [],
            metadata: {
                version: "1.0.0",
                lastUpdated: new Date().toISOString(),
                sourceFile: null,
                extractionMethod: null,
                totalRequirements: 0
            }
        };

        const requirementsDir = path.join(taskmasterPath, 'product-requirements');
        await fs.mkdir(requirementsDir, { recursive: true });
        const requirementsPath = path.join(requirementsDir, 'requirements.json');
        await fs.writeFile(requirementsPath, JSON.stringify(requirementsData, null, 2));

        // 初始化变更请求目录
        const changeRequestsDir = path.join(taskmasterPath, 'change-requests');
        await fs.mkdir(changeRequestsDir, { recursive: true });

        // 根据模板创建初始文件
        if (template !== 'default') {
            await this.applyProjectTemplate(taskmasterPath, template);
        }
    }

    async applyProjectTemplate(taskmasterPath, template) {
        const templates = {
            'web-app': {
                prd: `# Web Application PRD

## Project Overview
[Describe your web application]

## Features
- [ ] User Authentication
- [ ] Dashboard
- [ ] Data Management

## Technical Requirements
- Frontend: React/Vue/Angular
- Backend: Node.js/Python/Java
- Database: PostgreSQL/MongoDB
`,
                initialTasks: [
                    {
                        id: 1,
                        title: 'Setup Development Environment',
                        description: 'Configure development tools and dependencies',
                        priority: 'high',
                        status: 'pending'
                    }
                ]
            }
        };

        const templateData = templates[template];
        if (templateData) {
            // 创建PRD文件
            if (templateData.prd) {
                const prdPath = path.join(taskmasterPath, 'docs', 'prd.txt');
                await fs.writeFile(prdPath, templateData.prd);
            }

            // 添加初始任务
            if (templateData.initialTasks) {
                const tasksPath = path.join(taskmasterPath, 'tasks', 'tasks.json');
                const tasksData = JSON.parse(await fs.readFile(tasksPath, 'utf8'));
                tasksData.main.tasks = templateData.initialTasks;
                await fs.writeFile(tasksPath, JSON.stringify(tasksData, null, 2));
            }
        }
    }

    async ensureProject(projectId, name = null, description = '', template = 'default') {
        if (!this.projects.has(projectId)) {
            // 尝试从磁盘加载项目
            try {
                const project = await this.loadProject(projectId);
                this.projects.set(projectId, project);
                this.logger.info(`Loaded project from disk: ${projectId}`);
            } catch (error) {
                // 项目不存在，创建新项目
                this.logger.info(`Project ${projectId} not found, creating new project`);
                return await this.createProject(projectId, name || projectId, description, template);
            }
        }

        // 更新最后访问时间
        const project = this.projects.get(projectId);
        project.lastAccessed = new Date().toISOString();

        return project;
    }

    getProject(projectId) {
        return this.projects.get(projectId);
    }

    listProjects() {
        const projects = [];
        const activeProjects = this.configManager.getActiveProjects();

        for (const [projectId, project] of this.projects) {
            // 只显示活跃状态的项目
            const projectInfo = activeProjects[projectId];
            if (projectInfo) {
                projects.push({
                    id: projectId,
                    name: projectInfo.name,
                    description: projectInfo.description,
                    template: projectInfo.template,
                    created: projectInfo.createdAt,
                    lastAccessed: project.lastAccessed,
                    status: projectInfo.status
                });
            }
        }

        return projects.sort((a, b) =>
            new Date(b.lastAccessed) - new Date(a.lastAccessed)
        );
    }

    async deleteProject(projectId, options = {}) {
        const { deleteFiles = false } = options;

        if (!this.projects.has(projectId)) {
            throw new Error(`Project ${projectId} not found`);
        }

        const projectPath = this.getProjectPath(projectId);

        try {
            if (deleteFiles) {
                // 硬删除：删除项目文件夹和注册信息
                await fs.rm(projectPath, { recursive: true, force: true });
                await this.configManager.removeProjectFromRegistry(projectId);
                this.logger.info(`Hard deleted project: ${projectId} (files and registry)`);
            } else {
                // 软删除：只更新状态为deleted
                await this.configManager.updateProjectStatus(projectId, 'deleted');
                this.logger.info(`Soft deleted project: ${projectId} (status updated)`);
            }

            // 从内存缓存中移除
            this.projects.delete(projectId);

        } catch (error) {
            throw new Error(`Failed to delete project ${projectId}: ${error.message}`);
        }
    }

    getProjectPath(projectId) {
        return path.join(this.projectsDir, projectId);
    }

    getTasksPath(projectId) {
        return path.join(this.getProjectPath(projectId), '.taskmaster', 'tasks', 'tasks.json');
    }

    getProjectCount() {
        return this.projects.size;
    }

    projectExists(projectId) {
        return this.projects.has(projectId);
    }

    isValidProjectId(projectId) {
        return /^[a-zA-Z0-9_-]+$/.test(projectId) && projectId.length >= 1 && projectId.length <= 50;
    }
}

export default ProjectManager;
