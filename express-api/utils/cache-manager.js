import { createLogger } from './logger.js';

class CacheManager {
    constructor(options = {}) {
        this.logger = createLogger('cache-manager');
        this.defaultTTL = options.defaultTTL || 300000; // 5分钟
        this.maxSize = options.maxSize || 1000; // 最大缓存条目数
        this.cleanupInterval = options.cleanupInterval || 60000; // 1分钟清理间隔
        
        this.cache = new Map();
        this.accessTimes = new Map(); // 记录访问时间用于LRU
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0,
            cleanups: 0
        };
        
        // 定期清理过期缓存
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.cleanupInterval);
        
        this.logger.info('Cache manager initialized', {
            defaultTTL: this.defaultTTL,
            maxSize: this.maxSize,
            cleanupInterval: this.cleanupInterval
        });
    }

    /**
     * 设置缓存
     */
    set(key, value, ttl = this.defaultTTL) {
        try {
            // 检查缓存大小限制
            if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
                this.evictLRU();
            }

            const expiresAt = Date.now() + ttl;
            const cacheItem = {
                value,
                expiresAt,
                createdAt: Date.now(),
                accessCount: 0
            };

            this.cache.set(key, cacheItem);
            this.accessTimes.set(key, Date.now());
            this.stats.sets++;

            this.logger.debug('Cache set', {
                key,
                ttl,
                expiresAt: new Date(expiresAt).toISOString(),
                cacheSize: this.cache.size
            });

            return true;
        } catch (error) {
            this.logger.error('Failed to set cache', {
                key,
                error: error.message
            });
            return false;
        }
    }

    /**
     * 获取缓存
     */
    get(key) {
        try {
            const cacheItem = this.cache.get(key);
            
            if (!cacheItem) {
                this.stats.misses++;
                this.logger.debug('Cache miss', { key });
                return null;
            }

            // 检查是否过期
            if (Date.now() > cacheItem.expiresAt) {
                this.delete(key);
                this.stats.misses++;
                this.logger.debug('Cache expired', { key });
                return null;
            }

            // 更新访问信息
            cacheItem.accessCount++;
            this.accessTimes.set(key, Date.now());
            this.stats.hits++;

            this.logger.debug('Cache hit', {
                key,
                accessCount: cacheItem.accessCount
            });

            return cacheItem.value;
        } catch (error) {
            this.logger.error('Failed to get cache', {
                key,
                error: error.message
            });
            this.stats.misses++;
            return null;
        }
    }

    /**
     * 删除缓存
     */
    delete(key) {
        try {
            const deleted = this.cache.delete(key);
            this.accessTimes.delete(key);
            
            if (deleted) {
                this.stats.deletes++;
                this.logger.debug('Cache deleted', { key });
            }
            
            return deleted;
        } catch (error) {
            this.logger.error('Failed to delete cache', {
                key,
                error: error.message
            });
            return false;
        }
    }

    /**
     * 检查缓存是否存在且未过期
     */
    has(key) {
        const cacheItem = this.cache.get(key);
        if (!cacheItem) {
            return false;
        }
        
        if (Date.now() > cacheItem.expiresAt) {
            this.delete(key);
            return false;
        }
        
        return true;
    }

    /**
     * 清空所有缓存
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        this.accessTimes.clear();
        
        this.logger.info('Cache cleared', { clearedItems: size });
        return size;
    }

    /**
     * LRU驱逐
     */
    evictLRU() {
        let oldestKey = null;
        let oldestTime = Date.now();

        for (const [key, accessTime] of this.accessTimes) {
            if (accessTime < oldestTime) {
                oldestTime = accessTime;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.delete(oldestKey);
            this.stats.evictions++;
            this.logger.debug('LRU eviction', { evictedKey: oldestKey });
        }
    }

    /**
     * 清理过期缓存
     */
    cleanup() {
        const now = Date.now();
        const expiredKeys = [];

        for (const [key, cacheItem] of this.cache) {
            if (now > cacheItem.expiresAt) {
                expiredKeys.push(key);
            }
        }

        for (const key of expiredKeys) {
            this.delete(key);
        }

        if (expiredKeys.length > 0) {
            this.stats.cleanups++;
            this.logger.debug('Cache cleanup completed', {
                expiredItems: expiredKeys.length,
                remainingItems: this.cache.size
            });
        }
    }

    /**
     * 获取缓存统计信息
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0 ? 
            (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 : 0;

        return {
            ...this.stats,
            hitRate: Math.round(hitRate * 100) / 100,
            size: this.cache.size,
            maxSize: this.maxSize,
            memoryUsage: this.getMemoryUsage()
        };
    }

    /**
     * 估算内存使用量
     */
    getMemoryUsage() {
        let totalSize = 0;
        
        for (const [key, cacheItem] of this.cache) {
            // 粗略估算
            totalSize += JSON.stringify(key).length;
            totalSize += JSON.stringify(cacheItem.value).length;
            totalSize += 100; // 元数据开销
        }
        
        return {
            estimatedBytes: totalSize,
            estimatedMB: Math.round(totalSize / 1024 / 1024 * 100) / 100
        };
    }

    /**
     * 获取所有缓存键
     */
    keys() {
        return Array.from(this.cache.keys());
    }

    /**
     * 获取缓存大小
     */
    size() {
        return this.cache.size;
    }

    /**
     * 销毁缓存管理器
     */
    destroy() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        
        this.clear();
        this.logger.info('Cache manager destroyed');
    }
}

// 单例实例
let instance = null;

export function getCacheManager() {
    if (!instance) {
        instance = new CacheManager();
    }
    return instance;
}

export { CacheManager };
