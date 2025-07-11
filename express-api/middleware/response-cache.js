import crypto from 'crypto';
import { getCacheManager } from '../utils/cache-manager.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('response-cache');
const cache = getCacheManager();

/**
 * API响应缓存中间件
 */
export function responseCache(options = {}) {
    const {
        ttl = 300000, // 5分钟默认缓存
        keyGenerator = defaultKeyGenerator,
        shouldCache = defaultShouldCache,
        skipCache = false,
        cachePrefix = 'api:'
    } = options;

    return (req, res, next) => {
        // 跳过缓存的情况
        if (skipCache || !shouldCache(req)) {
            logger.debug('Skipping cache', {
                skipCache,
                shouldCache: shouldCache(req),
                method: req.method,
                path: req.path,
                originalUrl: req.originalUrl,
                requestId: req.requestId
            });
            return next();
        }

        const cacheKey = cachePrefix + keyGenerator(req);
        
        // 尝试从缓存获取响应
        const cachedResponse = cache.get(cacheKey);
        if (cachedResponse) {
            logger.debug('Cache hit for API response', {
                cacheKey,
                requestId: req.requestId,
                method: req.method,
                path: req.path
            });

            // 设置缓存头
            res.set('X-Cache', 'HIT');
            res.set('X-Cache-Key', cacheKey);
            
            // 返回缓存的响应
            res.status(cachedResponse.statusCode);
            if (cachedResponse.headers) {
                for (const [key, value] of Object.entries(cachedResponse.headers)) {
                    res.set(key, value);
                }
            }
            return res.json(cachedResponse.body);
        }

        // 缓存未命中，继续处理请求
        logger.debug('Cache miss for API response', {
            cacheKey,
            requestId: req.requestId,
            method: req.method,
            path: req.path
        });

        // 拦截响应
        const originalJson = res.json;
        const originalStatus = res.status;
        let statusCode = 200;
        let responseHeaders = {};

        // 重写status方法
        res.status = function(code) {
            statusCode = code;
            return originalStatus.call(this, code);
        };

        // 重写json方法
        res.json = function(body) {
            // 只缓存成功的响应
            if (statusCode >= 200 && statusCode < 300) {
                // 收集响应头
                const headersToCache = ['content-type', 'cache-control', 'etag'];
                for (const header of headersToCache) {
                    const value = res.get(header);
                    if (value) {
                        responseHeaders[header] = value;
                    }
                }

                const responseToCache = {
                    statusCode,
                    headers: responseHeaders,
                    body,
                    cachedAt: new Date().toISOString()
                };

                // 缓存响应
                cache.set(cacheKey, responseToCache, ttl);
                
                logger.debug('API response cached', {
                    cacheKey,
                    statusCode,
                    ttl,
                    requestId: req.requestId
                });
            }

            // 设置缓存头
            res.set('X-Cache', 'MISS');
            res.set('X-Cache-Key', cacheKey);
            
            return originalJson.call(this, body);
        };

        next();
    };
}

/**
 * 默认缓存键生成器
 */
function defaultKeyGenerator(req) {
    const { method, path, query, params } = req;
    
    // 包含项目ID（如果存在）
    const projectId = params.projectId || query.projectId || '';
    
    // 创建缓存键
    const keyData = {
        method,
        path,
        query: JSON.stringify(query),
        params: JSON.stringify(params),
        projectId
    };
    
    const keyString = JSON.stringify(keyData);
    return crypto.createHash('md5').update(keyString).digest('hex');
}

/**
 * 默认缓存条件判断
 */
function defaultShouldCache(req) {
    // 只缓存GET请求
    if (req.method !== 'GET') {
        return false;
    }
    
    // 不缓存健康检查
    if (req.path === '/health' || req.path === '/') {
        return false;
    }
    
    // 不缓存统计信息（实时性要求高）
    if (req.path.includes('/stats') || req.path.includes('/locks')) {
        return false;
    }
    
    return true;
}

/**
 * 任务列表专用缓存中间件
 */
export function taskListCache() {
    return responseCache({
        ttl: 60000, // 1分钟缓存
        cachePrefix: 'tasks:',
        shouldCache: (req) => {
            return req.method === 'GET' && (req.path === '/' || req.originalUrl.includes('/tasks'));
        }
    });
}

/**
 * 项目列表专用缓存中间件
 */
export function projectListCache() {
    return responseCache({
        ttl: 300000, // 5分钟缓存
        cachePrefix: 'projects:',
        shouldCache: (req) => {
            return req.method === 'GET' && (req.path === '/' || req.originalUrl.includes('/api/projects'));
        }
    });
}

/**
 * 配置信息专用缓存中间件
 */
export function configCache() {
    return responseCache({
        ttl: 600000, // 10分钟缓存
        cachePrefix: 'config:',
        shouldCache: (req) => {
            return req.method === 'GET' && req.path.includes('/config');
        }
    });
}

/**
 * 清除特定模式的缓存
 */
export function clearCacheByPattern(pattern) {
    const keys = cache.keys();
    const matchingKeys = keys.filter(key => key.includes(pattern));
    
    let clearedCount = 0;
    for (const key of matchingKeys) {
        if (cache.delete(key)) {
            clearedCount++;
        }
    }
    
    logger.info('Cache cleared by pattern', {
        pattern,
        clearedCount,
        totalKeys: keys.length
    });
    
    return clearedCount;
}

/**
 * 清除项目相关缓存
 */
export function clearProjectCache(projectId) {
    const patterns = [
        `projects:`,
        `tasks:`,
        `api:.*${projectId}`
    ];
    
    let totalCleared = 0;
    for (const pattern of patterns) {
        totalCleared += clearCacheByPattern(pattern);
    }
    
    logger.info('Project cache cleared', {
        projectId,
        totalCleared
    });
    
    return totalCleared;
}

/**
 * 缓存统计路由处理器
 */
export async function getCacheStatsHandler(req, res) {
    try {
        const stats = cache.getStats();
        
        res.json({
            success: true,
            data: stats,
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Failed to get cache stats', {
            error: error.message,
            requestId: req.requestId
        });
        
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get cache stats'
            },
            requestId: req.requestId
        });
    }
}

/**
 * 清除缓存路由处理器
 */
export async function clearCacheHandler(req, res) {
    try {
        const { pattern } = req.query;
        
        let clearedCount;
        if (pattern) {
            clearedCount = clearCacheByPattern(pattern);
        } else {
            clearedCount = cache.clear();
        }
        
        res.json({
            success: true,
            data: {
                clearedCount,
                pattern: pattern || 'all'
            },
            message: 'Cache cleared successfully',
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Failed to clear cache', {
            error: error.message,
            requestId: req.requestId
        });
        
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to clear cache'
            },
            requestId: req.requestId
        });
    }
}
