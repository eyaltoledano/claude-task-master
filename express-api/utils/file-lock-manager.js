import fs from 'fs/promises';
import path from 'path';
import { createLogger } from './logger.js';

class FileLockManager {
    constructor() {
        this.logger = createLogger('file-lock-manager');
        this.locks = new Map(); // 文件路径 -> 锁信息
        this.lockQueue = new Map(); // 文件路径 -> 等待队列
        this.lockTimeout = 30000; // 30秒锁超时
        this.maxQueueSize = 10; // 最大队列长度
        
        // 定期清理过期锁
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredLocks();
        }, 5000);
    }

    /**
     * 获取文件锁
     */
    async acquireLock(filePath, requestId, timeout = this.lockTimeout) {
        const normalizedPath = path.resolve(filePath);
        
        this.logger.debug('Attempting to acquire lock', {
            filePath: normalizedPath,
            requestId,
            timeout
        });

        // 检查是否已经有锁
        const existingLock = this.locks.get(normalizedPath);
        if (existingLock) {
            // 如果是同一个请求，直接返回
            if (existingLock.requestId === requestId) {
                this.logger.debug('Lock already held by same request', {
                    filePath: normalizedPath,
                    requestId
                });
                return true;
            }

            // 否则加入等待队列
            return await this.waitForLock(normalizedPath, requestId, timeout);
        }

        // 创建新锁
        const lockInfo = {
            requestId,
            acquiredAt: Date.now(),
            expiresAt: Date.now() + timeout,
            filePath: normalizedPath
        };

        this.locks.set(normalizedPath, lockInfo);
        
        this.logger.info('Lock acquired', {
            filePath: normalizedPath,
            requestId,
            expiresAt: new Date(lockInfo.expiresAt).toISOString()
        });

        return true;
    }

    /**
     * 释放文件锁
     */
    async releaseLock(filePath, requestId) {
        const normalizedPath = path.resolve(filePath);
        const lockInfo = this.locks.get(normalizedPath);

        if (!lockInfo) {
            this.logger.warn('Attempted to release non-existent lock', {
                filePath: normalizedPath,
                requestId
            });
            return false;
        }

        if (lockInfo.requestId !== requestId) {
            this.logger.warn('Attempted to release lock held by different request', {
                filePath: normalizedPath,
                requestId,
                lockHolder: lockInfo.requestId
            });
            return false;
        }

        // 删除锁
        this.locks.delete(normalizedPath);
        
        this.logger.info('Lock released', {
            filePath: normalizedPath,
            requestId
        });

        // 处理等待队列
        await this.processQueue(normalizedPath);

        return true;
    }

    /**
     * 等待锁可用
     */
    async waitForLock(filePath, requestId, timeout) {
        return new Promise((resolve, reject) => {
            // 检查队列大小
            const queue = this.lockQueue.get(filePath) || [];
            if (queue.length >= this.maxQueueSize) {
                this.logger.warn('Lock queue full', {
                    filePath,
                    requestId,
                    queueSize: queue.length
                });
                reject(new Error('Lock queue is full'));
                return;
            }

            // 添加到等待队列
            const queueItem = {
                requestId,
                resolve,
                reject,
                enqueuedAt: Date.now(),
                timeout: setTimeout(() => {
                    this.removeFromQueue(filePath, requestId);
                    reject(new Error('Lock acquisition timeout'));
                }, timeout)
            };

            queue.push(queueItem);
            this.lockQueue.set(filePath, queue);

            this.logger.debug('Added to lock queue', {
                filePath,
                requestId,
                queuePosition: queue.length
            });
        });
    }

    /**
     * 处理等待队列
     */
    async processQueue(filePath) {
        const queue = this.lockQueue.get(filePath);
        if (!queue || queue.length === 0) {
            return;
        }

        // 取出队列中的第一个请求
        const nextRequest = queue.shift();
        if (queue.length === 0) {
            this.lockQueue.delete(filePath);
        }

        // 清除超时定时器
        clearTimeout(nextRequest.timeout);

        // 为下一个请求获取锁
        try {
            const lockInfo = {
                requestId: nextRequest.requestId,
                acquiredAt: Date.now(),
                expiresAt: Date.now() + this.lockTimeout,
                filePath
            };

            this.locks.set(filePath, lockInfo);
            
            this.logger.info('Lock granted from queue', {
                filePath,
                requestId: nextRequest.requestId
            });

            nextRequest.resolve(true);
        } catch (error) {
            this.logger.error('Failed to grant lock from queue', {
                filePath,
                requestId: nextRequest.requestId,
                error: error.message
            });
            nextRequest.reject(error);
        }
    }

    /**
     * 从队列中移除请求
     */
    removeFromQueue(filePath, requestId) {
        const queue = this.lockQueue.get(filePath);
        if (!queue) {
            return;
        }

        const index = queue.findIndex(item => item.requestId === requestId);
        if (index !== -1) {
            const removed = queue.splice(index, 1)[0];
            clearTimeout(removed.timeout);
            
            if (queue.length === 0) {
                this.lockQueue.delete(filePath);
            }

            this.logger.debug('Removed from lock queue', {
                filePath,
                requestId
            });
        }
    }

    /**
     * 清理过期锁
     */
    cleanupExpiredLocks() {
        const now = Date.now();
        const expiredLocks = [];

        for (const [filePath, lockInfo] of this.locks.entries()) {
            if (lockInfo.expiresAt < now) {
                expiredLocks.push({ filePath, lockInfo });
            }
        }

        for (const { filePath, lockInfo } of expiredLocks) {
            this.logger.warn('Cleaning up expired lock', {
                filePath,
                requestId: lockInfo.requestId,
                expiredAt: new Date(lockInfo.expiresAt).toISOString()
            });

            this.locks.delete(filePath);
            this.processQueue(filePath);
        }

        if (expiredLocks.length > 0) {
            this.logger.info('Cleaned up expired locks', {
                count: expiredLocks.length
            });
        }
    }

    /**
     * 获取锁状态
     */
    getLockStatus(filePath) {
        const normalizedPath = path.resolve(filePath);
        const lockInfo = this.locks.get(normalizedPath);
        const queue = this.lockQueue.get(normalizedPath) || [];

        return {
            isLocked: !!lockInfo,
            lockInfo: lockInfo ? {
                requestId: lockInfo.requestId,
                acquiredAt: new Date(lockInfo.acquiredAt).toISOString(),
                expiresAt: new Date(lockInfo.expiresAt).toISOString(),
                remainingTime: Math.max(0, lockInfo.expiresAt - Date.now())
            } : null,
            queueLength: queue.length,
            queueItems: queue.map(item => ({
                requestId: item.requestId,
                enqueuedAt: new Date(item.enqueuedAt).toISOString()
            }))
        };
    }

    /**
     * 获取所有锁的状态
     */
    getAllLockStatus() {
        const status = {
            totalLocks: this.locks.size,
            totalQueued: Array.from(this.lockQueue.values()).reduce((sum, queue) => sum + queue.length, 0),
            locks: {}
        };

        for (const filePath of this.locks.keys()) {
            status.locks[filePath] = this.getLockStatus(filePath);
        }

        return status;
    }

    /**
     * 销毁锁管理器
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        // 清理所有等待的超时
        for (const queue of this.lockQueue.values()) {
            for (const item of queue) {
                clearTimeout(item.timeout);
                item.reject(new Error('Lock manager destroyed'));
            }
        }

        this.locks.clear();
        this.lockQueue.clear();
        
        this.logger.info('File lock manager destroyed');
    }
}

// 单例实例
let instance = null;

export function getFileLockManager() {
    if (!instance) {
        instance = new FileLockManager();
    }
    return instance;
}

export { FileLockManager };
