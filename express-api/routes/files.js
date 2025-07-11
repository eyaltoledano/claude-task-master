import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../utils/logger.js';
import CoreAdapter from '../services/core-adapter.js';
import { projectValidator } from '../middleware/project-validator.js';
import { ValidationError } from '../middleware/error-handler.js';

const router = express.Router({ mergeParams: true });
const logger = createLogger('files-router');
const coreAdapter = new CoreAdapter();

// 项目验证中间件
router.use(projectValidator);

// 生成任务文件
router.post('/generate', async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const { outputFormat = 'txt' } = req.body;
        
        const project = req.project;
        const options = {
            outputFormat
        };
        
        const result = await coreAdapter.generateTaskFiles(project.path, options);
        
        res.json({
            success: true,
            data: result,
            message: 'Task files generated successfully',
            projectId,
            requestId: req.requestId
        });
        
    } catch (error) {
        next(error);
    }
});

// 列出项目文件
router.get('/', async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const { directory = '' } = req.query;
        
        const project = req.project;
        const targetDir = directory 
            ? path.join(project.path, '.taskmaster', directory)
            : path.join(project.path, '.taskmaster');
        
        try {
            const files = await fs.readdir(targetDir, { withFileTypes: true });
            const fileList = [];
            
            for (const file of files) {
                const filePath = path.join(targetDir, file.name);
                const stats = await fs.stat(filePath);
                
                fileList.push({
                    name: file.name,
                    type: file.isDirectory() ? 'directory' : 'file',
                    path: path.relative(path.join(project.path, '.taskmaster'), filePath),
                    size: file.isFile() ? stats.size : null,
                    created: stats.birthtime,
                    modified: stats.mtime
                });
            }
            
            res.json({
                success: true,
                data: fileList,
                count: fileList.length,
                directory: directory || '/',
                projectId,
                requestId: req.requestId
            });
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new ValidationError(`Directory not found: ${directory}`);
            }
            throw error;
        }
        
    } catch (error) {
        next(error);
    }
});

// 下载文件
router.get('/:filename', async (req, res, next) => {
    try {
        const { projectId, filename } = req.params;
        const { directory = 'tasks' } = req.query;
        
        const project = req.project;
        const filePath = path.join(project.path, '.taskmaster', directory, filename);
        
        try {
            // 检查文件是否存在
            await fs.access(filePath);
            
            // 获取文件信息
            const stats = await fs.stat(filePath);
            
            if (stats.isDirectory()) {
                throw new ValidationError(`${filename} is a directory, not a file`);
            }
            
            // 读取文件内容
            const content = await fs.readFile(filePath, 'utf8');
            
            res.json({
                success: true,
                data: {
                    filename,
                    content,
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime,
                    path: path.relative(project.path, filePath)
                },
                projectId,
                requestId: req.requestId
            });
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new ValidationError(`File not found: ${filename}`);
            }
            throw error;
        }
        
    } catch (error) {
        next(error);
    }
});

// 上传/创建文件
router.post('/upload', async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const { filename, content, directory = 'tasks' } = req.body;
        
        if (!filename || content === undefined) {
            throw new ValidationError('Filename and content are required');
        }
        
        const project = req.project;
        const targetDir = path.join(project.path, '.taskmaster', directory);
        const filePath = path.join(targetDir, filename);
        
        // 确保目标目录存在
        await fs.mkdir(targetDir, { recursive: true });
        
        // 保存文件
        await fs.writeFile(filePath, content, 'utf8');
        
        // 获取文件信息
        const stats = await fs.stat(filePath);
        
        res.json({
            success: true,
            data: {
                filename,
                path: path.relative(project.path, filePath),
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime
            },
            message: `File ${filename} uploaded successfully`,
            projectId,
            requestId: req.requestId
        });
        
    } catch (error) {
        next(error);
    }
});

// 删除文件
router.delete('/:filename', async (req, res, next) => {
    try {
        const { projectId, filename } = req.params;
        const { directory = 'tasks' } = req.query;
        
        const project = req.project;
        const filePath = path.join(project.path, '.taskmaster', directory, filename);
        
        try {
            // 检查是否为文件
            const stats = await fs.stat(filePath);
            if (stats.isDirectory()) {
                throw new ValidationError(`${filename} is a directory, not a file`);
            }
            
            // 删除文件
            await fs.unlink(filePath);
            
            res.json({
                success: true,
                data: { deleted: true },
                message: `File ${filename} deleted successfully`,
                projectId,
                requestId: req.requestId
            });
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new ValidationError(`File not found: ${filename}`);
            }
            throw error;
        }
        
    } catch (error) {
        next(error);
    }
});

// 获取项目统计信息
router.get('/stats/summary', async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const project = req.project;
        const taskmasterDir = path.join(project.path, '.taskmaster');
        
        const stats = {
            directories: {},
            totalFiles: 0,
            totalSize: 0
        };
        
        const directories = ['tasks', 'docs', 'reports', 'templates', 'logs'];
        
        for (const dir of directories) {
            const dirPath = path.join(taskmasterDir, dir);
            
            try {
                const files = await fs.readdir(dirPath);
                let dirSize = 0;
                let fileCount = 0;
                
                for (const file of files) {
                    const filePath = path.join(dirPath, file);
                    const fileStat = await fs.stat(filePath);
                    
                    if (fileStat.isFile()) {
                        dirSize += fileStat.size;
                        fileCount++;
                    }
                }
                
                stats.directories[dir] = {
                    fileCount,
                    size: dirSize
                };
                
                stats.totalFiles += fileCount;
                stats.totalSize += dirSize;
                
            } catch (error) {
                if (error.code === 'ENOENT') {
                    stats.directories[dir] = {
                        fileCount: 0,
                        size: 0
                    };
                } else {
                    throw error;
                }
            }
        }
        
        res.json({
            success: true,
            data: stats,
            projectId,
            requestId: req.requestId
        });
        
    } catch (error) {
        next(error);
    }
});

export default router;
