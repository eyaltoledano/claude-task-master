import express from 'express';
import { createLogger } from '../utils/logger.js';
import { projectListCache } from '../middleware/response-cache.js';
import { ValidationError, NotFoundError } from '../middleware/error-handler.js';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';

const router = express.Router();
const logger = createLogger('projects-router');

// 获取所有项目（带缓存）
router.get('/', projectListCache(), async (req, res, next) => {
    try {
        const projectManager = req.projectManager;
        const projects = projectManager.listProjects();
        
        res.json({
            success: true,
            data: projects,
            count: projects.length,
            requestId: req.requestId
        });
        
    } catch (error) {
        next(error);
    }
});

// 创建新项目
router.post('/', async (req, res, next) => {
    try {
        const { id, name, description, template } = req.body;
        
        // 验证必需字段
        if (!id || !name) {
            throw new ValidationError('Project ID and name are required');
        }
        
        const projectManager = req.projectManager;
        const project = await projectManager.createProject(
            id,
            name,
            description || '',
            template || 'default'
        );

        // 获取项目配置信息
        const projectsConfig = projectManager.configManager.getProjectsConfig();
        const projectInfo = projectsConfig.projects[id];

        res.status(201).json({
            success: true,
            data: {
                id: project.id,
                name: projectInfo.name,
                description: projectInfo.description,
                template: projectInfo.template,
                created: projectInfo.createdAt,
                lastAccessed: project.lastAccessed
            },
            message: `Project ${id} created successfully`,
            requestId: req.requestId
        });
        
    } catch (error) {
        if (error.message.includes('already exists')) {
            next(new ValidationError(error.message));
        } else if (error.message.includes('Invalid project ID')) {
            next(new ValidationError(error.message));
        } else {
            next(error);
        }
    }
});

// 获取单个项目
router.get('/:projectId', async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const projectManager = req.projectManager;

        const project = await projectManager.ensureProject(projectId);
        const config = await projectManager.getProjectConfig(projectId);

        res.json({
            success: true,
            data: {
                id: project.id,
                name: config.project?.name || projectId,
                description: config.project?.description || '',
                template: config.project?.template || 'default',
                created: config.project?.createdAt || new Date().toISOString(),
                updated: config.project?.lastAccessed || new Date().toISOString(),
                lastAccessed: project.lastAccessed,
                ai: config.ai,
                defaults: config.defaults,
                system: config.system
            },
            requestId: req.requestId
        });
        
    } catch (error) {
        if (error.message.includes('not found')) {
            next(new NotFoundError(error.message));
        } else {
            next(error);
        }
    }
});

// 更新项目
router.put('/:projectId', async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const { name, description, settings, models, tags } = req.body;
        
        const projectManager = req.projectManager;
        const project = await projectManager.ensureProject(projectId);
        
        // 更新配置
        const updatedConfig = { ...project.config };
        
        if (name) updatedConfig.projectInfo.name = name;
        if (description !== undefined) updatedConfig.projectInfo.description = description;
        if (settings) updatedConfig.settings = { ...updatedConfig.settings, ...settings };
        if (models) updatedConfig.models = { ...updatedConfig.models, ...models };
        if (tags) updatedConfig.tags = { ...updatedConfig.tags, ...tags };
        
        await projectManager.saveProjectConfig(projectId, updatedConfig);
        
        // 更新缓存
        project.config = updatedConfig;
        
        res.json({
            success: true,
            data: {
                id: project.id,
                name: updatedConfig.projectInfo.name,
                description: updatedConfig.projectInfo.description,
                template: updatedConfig.projectInfo.template,
                created: updatedConfig.projectInfo.created,
                updated: updatedConfig.projectInfo.updated,
                lastAccessed: project.lastAccessed
            },
            message: `Project ${projectId} updated successfully`,
            requestId: req.requestId
        });
        
    } catch (error) {
        if (error.message.includes('not found')) {
            next(new NotFoundError(error.message));
        } else {
            next(error);
        }
    }
});

// 初始化项目（用于MCP工具）
router.post('/:projectId/initialize', async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const { force = false } = req.body;

        const projectManager = req.projectManager;

        // 检查项目是否已存在
        const exists = projectManager.projectExists(projectId);
        if (exists && !force) {
            return res.json({
                success: true,
                data: {
                    initialized: false,
                    message: 'Project already exists'
                },
                message: `Project ${projectId} already initialized`,
                requestId: req.requestId
            });
        }

        // 创建或重新初始化项目
        const { name, description, template } = req.body;
        const project = await projectManager.ensureProject(
            projectId,
            name || projectId,
            description || '',
            template || 'default'
        );

        res.json({
            success: true,
            data: {
                id: project.id,
                initialized: true,
                path: project.path,
                config: project.config
            },
            message: `Project ${projectId} initialized successfully`,
            requestId: req.requestId
        });

    } catch (error) {
        next(error);
    }
});

// 删除项目
router.delete('/:projectId', async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const { deleteFiles = false } = req.body;
        const projectManager = req.projectManager;

        await projectManager.deleteProject(projectId, { deleteFiles });

        // 清理项目相关缓存
        const { clearProjectCache } = await import('../middleware/response-cache.js');
        clearProjectCache(projectId);

        res.json({
            success: true,
            data: {
                deleted: true,
                deleteFiles,
                projectId
            },
            message: deleteFiles
                ? `Project ${projectId} and all files deleted successfully`
                : `Project ${projectId} deleted successfully (files preserved)`,
            requestId: req.requestId
        });

    } catch (error) {
        if (error.message.includes('not found')) {
            next(new NotFoundError(error.message));
        } else {
            next(error);
        }
    }
});

// 分析项目复杂度
router.post('/:projectId/analyze', async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const { detailed = false } = req.body;
        const projectManager = req.projectManager;

        // 验证项目是否存在
        const project = projectManager.getProject(projectId);
        if (!project) {
            throw new NotFoundError(`Project ${projectId} not found`);
        }

        const result = await projectManager.coreAdapter.analyzeProjectComplexity(
            projectId,
            { detailed }
        );

        res.json({
            success: true,
            data: result,
            message: `Project ${projectId} complexity analyzed`,
            projectId,
            requestId: req.requestId
        });

    } catch (error) {
        next(error);
    }
});

// 生成复杂度报告
router.get('/:projectId/reports/complexity', async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const { format = 'json' } = req.query;
        const projectManager = req.projectManager;

        // 验证项目是否存在
        const project = projectManager.getProject(projectId);
        if (!project) {
            throw new NotFoundError(`Project ${projectId} not found`);
        }

        const result = await projectManager.coreAdapter.generateComplexityReport(
            projectId,
            { format }
        );

        res.json({
            success: true,
            data: result,
            message: `Complexity report generated for project ${projectId}`,
            projectId,
            requestId: req.requestId
        });

    } catch (error) {
        next(error);
    }
});

// 下载项目的IDE配置文件
router.get('/:projectId/ide-config/:ideType?', async (req, res, next) => {
    try {
        const { projectId, ideType } = req.params;
        const projectManager = req.projectManager;

        // 验证项目是否存在
        const project = projectManager.getProject(projectId);
        if (!project) {
            throw new NotFoundError(`Project ${projectId} not found`);
        }

        const projectPath = project.path;

        // 所有支持的IDE配置目录
        const ideDirectories = [
            '.claude',
            '.clinerules',
            '.cursor',
            '.github',
            '.ide',
            '.roo',
            '.trae',
            '.vscode',
            '.windsurf'
        ];

        // 创建ZIP文件
        const archive = archiver('zip', {
            zlib: { level: 9 }
        });

        let filename;
        let foundConfigs = [];

        if (ideType) {
            // 下载特定IDE配置
            const ideDir = `.${ideType}`;
            if (!ideDirectories.includes(ideDir)) {
                throw new ValidationError(`Unsupported IDE type: ${ideType}. Supported types: ${ideDirectories.map(d => d.substring(1)).join(', ')}`);
            }

            const ideConfigDir = path.join(projectPath, ideDir);
            if (!fs.existsSync(ideConfigDir)) {
                throw new NotFoundError(`IDE configuration for ${ideType} not found in project ${projectId}`);
            }

            archive.directory(ideConfigDir, ideDir);
            filename = `${projectId}-${ideType}-config.zip`;
            foundConfigs.push(ideType);

        } else {
            // 下载所有存在的IDE配置
            for (const ideDir of ideDirectories) {
                const ideConfigDir = path.join(projectPath, ideDir);
                if (fs.existsSync(ideConfigDir)) {
                    archive.directory(ideConfigDir, ideDir);
                    foundConfigs.push(ideDir.substring(1));
                }
            }

            if (foundConfigs.length === 0) {
                throw new NotFoundError(`No IDE configurations found in project ${projectId}`);
            }

            filename = `${projectId}-ide-configs.zip`;
        }

        // 设置响应头
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // 管道输出到响应
        archive.pipe(res);

        // 完成归档
        await archive.finalize();

        logger.info(`IDE config downloaded`, {
            projectId,
            ideType: ideType || 'all',
            foundConfigs,
            requestId: req.requestId
        });

    } catch (error) {
        logger.error('Download IDE config failed', {
            error: error.message,
            projectId: req.params.projectId,
            ideType: req.params.ideType,
            requestId: req.requestId
        });

        if (error.message.includes('not found')) {
            next(new NotFoundError(error.message));
        } else {
            next(error);
        }
    }
});

export default router;
