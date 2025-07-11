import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../utils/logger.js';
import CoreAdapter, { ProjectPathManager } from '../services/core-adapter.js';
import { projectValidator } from '../middleware/project-validator.js';
import { prdFileLockMiddleware } from '../middleware/file-lock.js';
import { ValidationError } from '../middleware/error-handler.js';

const router = express.Router({ mergeParams: true });
const logger = createLogger('prd-router');

// 这些将在中间件中从 req.projectManager 获取
let coreAdapter = null;
let pathManager = null;

/**
 * 自动查找PRD文档
 * @param {string} projectId - 项目ID
 * @param {string} [prdFilePath] - 可选的PRD文件路径（已废弃，保留向后兼容）
 * @returns {string} PRD文档的完整路径
 */
async function findPrdDocument(projectId, prdFilePath = null) {
    const docsDir = path.join(pathManager.getTaskmasterDir(projectId), 'docs');

    // 确保docs目录存在
    await fs.mkdir(docsDir, { recursive: true });

    // 如果指定了文件路径，直接使用（向后兼容）
    if (prdFilePath) {
        const fullPath = pathManager.getPrdPath(projectId, prdFilePath);
        try {
            await fs.access(fullPath);
            logger.info(`Using specified PRD file: ${prdFilePath}`, { projectId });
            return fullPath;
        } catch (error) {
            logger.warn(`Specified PRD file not found: ${prdFilePath}, falling back to auto-detection`, { projectId });
        }
    }

    // 自动查找常见的PRD文件名
    const commonPrdNames = [
        'prd.md',
        'prd.txt',
        'PRD.md',
        'PRD.txt',
        'requirements.md',
        'requirements.txt',
        'product-requirements.md',
        'product-requirements.txt'
    ];

    for (const filename of commonPrdNames) {
        const fullPath = pathManager.getPrdPath(projectId, filename);
        try {
            await fs.access(fullPath);
            logger.info(`Found PRD document: ${filename}`, { projectId });
            return fullPath;
        } catch (error) {
            // 继续查找下一个文件
        }
    }

    // 如果没有找到任何PRD文档，抛出错误
    throw new ValidationError(
        `No PRD document found in project ${projectId}. ` +
        `Please ensure one of the following files exists in the docs directory: ${commonPrdNames.join(', ')}`
    );
}

// 项目验证中间件
router.use(projectValidator);

// 初始化适配器中间件
router.use((req, res, next) => {
    if (!coreAdapter || !pathManager) {
        coreAdapter = req.projectManager.coreAdapter;
        pathManager = req.projectManager.coreAdapter.pathManager;
    }
    next();
});

// 解析PRD时需要文件锁
router.use('/parse', prdFileLockMiddleware());

// 获取项目PRD概览信息
router.get('/', async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const project = req.project;
        const docsDir = path.join(pathManager.getTaskmasterDir(projectId), 'docs');

        try {
            const files = await fs.readdir(docsDir);
            const prdFiles = [];

            for (const file of files) {
                const filePath = path.join(docsDir, file);
                const stats = await fs.stat(filePath);

                if (stats.isFile() && /\.(txt|md|markdown)$/i.test(file)) {
                    prdFiles.push({
                        filename: file,
                        path: path.relative(pathManager.getProjectRoot(projectId), filePath),
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime
                    });
                }
            }

            res.json({
                success: true,
                data: {
                    files: prdFiles,
                    count: prdFiles.length,
                    projectId
                },
                message: 'PRD overview retrieved successfully',
                projectId,
                requestId: req.requestId
            });

        } catch (error) {
            if (error.code === 'ENOENT') {
                // docs目录不存在，返回空列表
                res.json({
                    success: true,
                    data: {
                        files: [],
                        count: 0,
                        projectId
                    },
                    message: 'No PRD documents found',
                    projectId,
                    requestId: req.requestId
                });
            } else {
                throw error;
            }
        }

    } catch (error) {
        next(error);
    }
});

// 获取PRD文件内容
router.get('/files/:filename', async (req, res, next) => {
    try {
        const { projectId, filename } = req.params;
        const project = req.project;
        const docsDir = path.join(pathManager.getTaskmasterDir(projectId), 'docs');
        const filePath = path.join(docsDir, filename);

        // 安全检查：确保文件在docs目录内
        const resolvedPath = path.resolve(filePath);
        const resolvedDocsDir = path.resolve(docsDir);
        if (!resolvedPath.startsWith(resolvedDocsDir)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PATH',
                    message: 'Invalid file path'
                },
                projectId,
                requestId: req.requestId
            });
        }

        try {
            const content = await fs.readFile(filePath, 'utf8');
            const stats = await fs.stat(filePath);

            res.json({
                success: true,
                data: {
                    filename,
                    content,
                    size: stats.size,
                    modified: stats.mtime,
                    projectId
                },
                message: 'PRD file content retrieved successfully',
                projectId,
                requestId: req.requestId
            });

        } catch (error) {
            if (error.code === 'ENOENT') {
                res.status(404).json({
                    success: false,
                    error: {
                        code: 'FILE_NOT_FOUND',
                        message: `PRD file ${filename} not found`
                    },
                    projectId,
                    requestId: req.requestId
                });
            } else {
                throw error;
            }
        }

    } catch (error) {
        next(error);
    }
});

// 下载PRD文件
router.get('/files/:filename/download', async (req, res, next) => {
    try {
        const { projectId, filename } = req.params;
        const project = req.project;
        const docsDir = path.join(pathManager.getTaskmasterDir(projectId), 'docs');
        const filePath = path.join(docsDir, filename);

        // 安全检查：确保文件在docs目录内
        const resolvedPath = path.resolve(filePath);
        const resolvedDocsDir = path.resolve(docsDir);
        if (!resolvedPath.startsWith(resolvedDocsDir)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PATH',
                    message: 'Invalid file path'
                },
                projectId,
                requestId: req.requestId
            });
        }

        try {
            const stats = await fs.stat(filePath);

            // 设置下载响应头
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Length', stats.size);

            // 创建文件流并发送
            const fileStream = await fs.readFile(filePath);
            res.send(fileStream);

        } catch (error) {
            if (error.code === 'ENOENT') {
                res.status(404).json({
                    success: false,
                    error: {
                        code: 'FILE_NOT_FOUND',
                        message: `PRD file ${filename} not found`
                    },
                    projectId,
                    requestId: req.requestId
                });
            } else {
                throw error;
            }
        }

    } catch (error) {
        next(error);
    }
});

// 解析PRD生成任务
router.post('/parse', async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const {
            prdContent,
            numTasks,
            useResearch = false,
            force = false,
            append = false
        } = req.body;

        let actualPrdPath;

        if (prdContent) {
            // 如果提供了内容，保存到临时文件（向后兼容）
            const tempFileName = `temp_prd_${Date.now()}.txt`;
            actualPrdPath = pathManager.getPrdPath(projectId, tempFileName);
            await fs.writeFile(actualPrdPath, prdContent, 'utf8');
        } else {
            // 自动查找PRD文档，不再需要prdFilePath参数
            actualPrdPath = await findPrdDocument(projectId);
        }
        
        const options = {
            force,
            append,
            research: useResearch
        };
        
        const result = await coreAdapter.parsePRD(
            projectId,
            actualPrdPath,
            numTasks || 10,
            options
        );
        
        // 如果是临时文件，删除它
        if (prdContent) {
            try {
                await fs.unlink(actualPrdPath);
            } catch (error) {
                logger.warn('Failed to delete temporary PRD file', { 
                    file: actualPrdPath, 
                    error: error.message 
                });
            }
        }
        
        res.json({
            success: true,
            data: result,
            message: 'PRD parsed successfully',
            projectId,
            requestId: req.requestId
        });
        
    } catch (error) {
        next(error);
    }
});

// 更新PRD文档（PUT方法）
router.put('/', async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const { filename, content } = req.body;

        if (!content) {
            throw new ValidationError('Content is required');
        }

        const project = req.project;
        const docsDir = path.join(pathManager.getTaskmasterDir(projectId), 'docs');

        // 确保docs目录存在
        await fs.mkdir(docsDir, { recursive: true });

        // 使用提供的文件名，或默认为prd.md
        const actualFilename = filename || 'prd.md';
        const filePath = path.join(docsDir, actualFilename);

        // 写入文件
        await fs.writeFile(filePath, content, 'utf8');

        logger.info(`PRD document updated: ${filePath}`);

        res.json({
            success: true,
            data: {
                filename: actualFilename,
                path: filePath,
                size: content.length,
                updatedAt: new Date().toISOString()
            },
            message: `PRD document updated successfully`,
            requestId: req.requestId
        });

    } catch (error) {
        next(error);
    }
});

// 上传PRD文件
router.post('/upload', async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const { filename, content } = req.body;
        
        if (!filename || !content) {
            throw new ValidationError('Filename and content are required');
        }
        
        // 验证文件扩展名
        const allowedExtensions = ['.txt', '.md', '.markdown'];
        const ext = path.extname(filename).toLowerCase();
        if (!allowedExtensions.includes(ext)) {
            throw new ValidationError('Only .txt, .md, and .markdown files are supported');
        }
        
        const project = req.project;
        const docsDir = path.join(pathManager.getTaskmasterDir(projectId), 'docs');
        const filePath = path.join(docsDir, filename);
        
        // 确保docs目录存在
        await fs.mkdir(docsDir, { recursive: true });
        
        // 保存文件
        await fs.writeFile(filePath, content, 'utf8');
        
        res.json({
            success: true,
            data: {
                filename,
                path: path.relative(pathManager.getProjectRoot(projectId), filePath),
                size: Buffer.byteLength(content, 'utf8')
            },
            message: 'PRD file uploaded successfully',
            projectId,
            requestId: req.requestId
        });
        
    } catch (error) {
        next(error);
    }
});

// 列出PRD文件
router.get('/files', async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const project = req.project;
        const docsDir = path.join(pathManager.getTaskmasterDir(projectId), 'docs');
        
        try {
            const files = await fs.readdir(docsDir);
            const prdFiles = [];
            
            for (const file of files) {
                const filePath = path.join(docsDir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.isFile() && /\.(txt|md|markdown)$/i.test(file)) {
                    prdFiles.push({
                        filename: file,
                        path: path.relative(pathManager.getProjectRoot(projectId), filePath),
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime
                    });
                }
            }
            
            res.json({
                success: true,
                data: prdFiles,
                count: prdFiles.length,
                projectId,
                requestId: req.requestId
            });
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                // docs目录不存在，返回空列表
                res.json({
                    success: true,
                    data: [],
                    count: 0,
                    projectId,
                    requestId: req.requestId
                });
            } else {
                throw error;
            }
        }
        
    } catch (error) {
        next(error);
    }
});

// 获取PRD文件内容
router.get('/files/:filename', async (req, res, next) => {
    try {
        const { projectId, filename } = req.params;
        const project = req.project;
        const filePath = pathManager.getPrdPath(projectId, filename);
        
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const stats = await fs.stat(filePath);
            
            res.json({
                success: true,
                data: {
                    filename,
                    content,
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime
                },
                projectId,
                requestId: req.requestId
            });
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new ValidationError(`PRD file not found: ${filename}`);
            }
            throw error;
        }
        
    } catch (error) {
        next(error);
    }
});

// 删除PRD文件
router.delete('/files/:filename', async (req, res, next) => {
    try {
        const { projectId, filename } = req.params;
        const project = req.project;
        const filePath = pathManager.getPrdPath(projectId, filename);
        
        try {
            await fs.unlink(filePath);
            
            res.json({
                success: true,
                data: { deleted: true },
                message: `PRD file ${filename} deleted successfully`,
                projectId,
                requestId: req.requestId
            });
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new ValidationError(`PRD file not found: ${filename}`);
            }
            throw error;
        }
        
    } catch (error) {
        next(error);
    }
});

export default router;
