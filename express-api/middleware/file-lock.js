import path from 'path';
import { getFileLockManager } from '../utils/file-lock-manager.js';
import { createLogger } from '../utils/logger.js';
import { ValidationError } from './error-handler.js';

const logger = createLogger('file-lock-middleware');
const lockManager = getFileLockManager();

/**
 * 文件锁中间件
 * 为需要文件访问的操作提供锁定机制
 */
export function fileLockMiddleware(options = {}) {
    const {
        timeout = 30000, // 30秒超时
        skipLockForRead = true, // 读操作是否跳过锁定
        getLockPath = null // 自定义锁路径获取函数
    } = options;

    return async (req, res, next) => {
        // 跳过不需要锁定的请求
        if (shouldSkipLock(req, skipLockForRead)) {
            return next();
        }

        const requestId = req.requestId;
        const lockPath = getLockPath ? getLockPath(req) : getDefaultLockPath(req);

        if (!lockPath) {
            logger.warn('No lock path determined, skipping lock', {
                requestId,
                method: req.method,
                path: req.path
            });
            return next();
        }

        try {
            // 获取锁
            logger.debug('Acquiring file lock', {
                requestId,
                lockPath,
                method: req.method,
                path: req.path
            });

            const acquired = await lockManager.acquireLock(lockPath, requestId, timeout);
            
            if (!acquired) {
                throw new ValidationError('Failed to acquire file lock');
            }

            // 将锁信息添加到请求对象
            req.fileLock = {
                path: lockPath,
                requestId,
                acquired: true
            };

            // 确保在响应结束时释放锁
            const originalEnd = res.end;
            res.end = function(...args) {
                releaseLockSafely(lockPath, requestId);
                originalEnd.apply(this, args);
            };

            // 处理连接中断
            req.on('close', () => {
                if (!res.headersSent) {
                    releaseLockSafely(lockPath, requestId);
                }
            });

            next();

        } catch (error) {
            logger.error('Failed to acquire file lock', {
                requestId,
                lockPath,
                error: error.message
            });

            if (error.message.includes('timeout')) {
                res.status(423).json({
                    success: false,
                    error: {
                        code: 'LOCK_TIMEOUT',
                        message: 'File is currently locked by another operation. Please try again later.'
                    },
                    requestId
                });
            } else if (error.message.includes('queue is full')) {
                res.status(503).json({
                    success: false,
                    error: {
                        code: 'LOCK_QUEUE_FULL',
                        message: 'Too many concurrent requests. Please try again later.'
                    },
                    requestId
                });
            } else {
                next(error);
            }
        }
    };
}

/**
 * 判断是否应该跳过锁定
 */
function shouldSkipLock(req, skipLockForRead) {
    // GET请求通常是读操作
    if (skipLockForRead && req.method === 'GET') {
        return true;
    }

    // 健康检查等不需要锁定
    if (req.path === '/health' || req.path === '/') {
        return true;
    }

    // 项目列表不需要锁定
    if (req.path === '/api/projects' && req.method === 'GET') {
        return true;
    }

    return false;
}

/**
 * 获取默认锁路径
 */
function getDefaultLockPath(req) {
    const { projectId } = req.params;
    
    if (!projectId) {
        return null;
    }

    // 对于项目相关的操作，锁定项目的任务文件
    const projectPath = req.projectManager ? 
        req.projectManager.getProjectPath(projectId) : 
        path.join(process.cwd(), 'projects', projectId);
    
    return path.join(projectPath, '.taskmaster', 'tasks', 'tasks.json');
}

/**
 * 安全释放锁
 */
async function releaseLockSafely(lockPath, requestId) {
    try {
        await lockManager.releaseLock(lockPath, requestId);
        logger.debug('File lock released', {
            requestId,
            lockPath
        });
    } catch (error) {
        logger.error('Failed to release file lock', {
            requestId,
            lockPath,
            error: error.message
        });
    }
}

/**
 * 任务操作专用的文件锁中间件
 */
export function taskFileLockMiddleware() {
    return fileLockMiddleware({
        timeout: 30000,
        skipLockForRead: false, // 任务操作都需要锁定
        getLockPath: (req) => {
            const { projectId } = req.params;
            if (!projectId || !req.projectManager) {
                return null;
            }
            
            const projectPath = req.projectManager.getProjectPath(projectId);
            return path.join(projectPath, '.taskmaster', 'tasks', 'tasks.json');
        }
    });
}

/**
 * PRD操作专用的文件锁中间件
 */
export function prdFileLockMiddleware() {
    return fileLockMiddleware({
        timeout: 60000, // PRD解析可能需要更长时间
        skipLockForRead: true,
        getLockPath: (req) => {
            const { projectId } = req.params;
            if (!projectId || !req.projectManager) {
                return null;
            }
            
            const projectPath = req.projectManager.getProjectPath(projectId);
            return path.join(projectPath, '.taskmaster', 'tasks', 'tasks.json');
        }
    });
}

/**
 * 获取锁状态的路由处理器
 */
export async function getLockStatus(req, res) {
    try {
        const { projectId } = req.params;
        
        if (projectId) {
            // 获取特定项目的锁状态
            const projectPath = req.projectManager.getProjectPath(projectId);
            const lockPath = path.join(projectPath, '.taskmaster', 'tasks', 'tasks.json');
            const status = lockManager.getLockStatus(lockPath);
            
            res.json({
                success: true,
                data: {
                    projectId,
                    lockPath,
                    ...status
                },
                requestId: req.requestId
            });
        } else {
            // 获取所有锁状态
            const status = lockManager.getAllLockStatus();
            
            res.json({
                success: true,
                data: status,
                requestId: req.requestId
            });
        }
    } catch (error) {
        logger.error('Failed to get lock status', {
            error: error.message,
            requestId: req.requestId
        });
        
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get lock status'
            },
            requestId: req.requestId
        });
    }
}
