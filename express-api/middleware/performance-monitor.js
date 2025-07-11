import { createLogger } from '../utils/logger.js';

const logger = createLogger('performance-monitor');

/**
 * 性能监控中间件
 */
export function performanceMonitor(options = {}) {
    const {
        logSlowRequests = true,
        slowRequestThreshold = 1000, // 1秒
        logAllRequests = false,
        collectMetrics = true
    } = options;

    // 请求统计（使用全局stats对象）

    return (req, res, next) => {
        const startTime = Date.now();
        const startHrTime = process.hrtime();

        // 增强请求对象
        req.startTime = startTime;
        req.performance = {
            startTime,
            startHrTime
        };

        // 监听响应完成
        res.on('finish', () => {
            const endTime = Date.now();
            const endHrTime = process.hrtime(startHrTime);
            const responseTime = endTime - startTime;
            const hrResponseTime = endHrTime[0] * 1000 + endHrTime[1] / 1000000; // 毫秒

            // 收集统计信息
            if (collectMetrics) {
                updateStats(stats, req, res, responseTime);
            }

            // 记录性能信息
            const performanceData = {
                requestId: req.requestId,
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                responseTime: Math.round(responseTime),
                hrResponseTime: Math.round(hrResponseTime * 100) / 100,
                userAgent: req.get('User-Agent'),
                ip: req.ip,
                contentLength: res.get('Content-Length') || 0
            };

            // 记录慢请求
            if (logSlowRequests && responseTime > slowRequestThreshold) {
                logger.warn('Slow request detected', {
                    ...performanceData,
                    threshold: slowRequestThreshold,
                    isSlowRequest: true
                });
            }

            // 记录所有请求（如果启用）
            if (logAllRequests) {
                const level = res.statusCode >= 400 ? 'warn' : 'info';
                logger[level]('Request completed', performanceData);
            }

            // 记录错误请求
            if (res.statusCode >= 400) {
                logger.warn('Error request', {
                    ...performanceData,
                    isErrorRequest: true
                });
            }
        });

        next();
    };
}

/**
 * 更新统计信息
 */
function updateStats(stats, req, res, responseTime) {
    stats.totalRequests++;
    stats.totalResponseTime += responseTime;
    stats.averageResponseTime = stats.totalResponseTime / stats.totalRequests;

    // 按方法统计
    const method = req.method;
    if (!stats.requestsByMethod[method]) {
        stats.requestsByMethod[method] = { count: 0, totalTime: 0, avgTime: 0 };
    }
    stats.requestsByMethod[method].count++;
    stats.requestsByMethod[method].totalTime += responseTime;
    stats.requestsByMethod[method].avgTime = 
        stats.requestsByMethod[method].totalTime / stats.requestsByMethod[method].count;

    // 按路径统计
    const path = req.route ? req.route.path : req.path;
    if (!stats.requestsByPath[path]) {
        stats.requestsByPath[path] = { count: 0, totalTime: 0, avgTime: 0 };
    }
    stats.requestsByPath[path].count++;
    stats.requestsByPath[path].totalTime += responseTime;
    stats.requestsByPath[path].avgTime = 
        stats.requestsByPath[path].totalTime / stats.requestsByPath[path].count;

    // 慢请求统计
    if (responseTime > 1000) {
        stats.slowRequests++;
    }

    // 错误请求统计
    if (res.statusCode >= 400) {
        stats.errorRequests++;
    }
}

// 全局统计对象
const stats = {
    totalRequests: 0,
    totalResponseTime: 0,
    slowRequests: 0,
    errorRequests: 0,
    requestsByMethod: {},
    requestsByPath: {},
    averageResponseTime: 0
};

/**
 * 获取性能统计信息
 */
export function getPerformanceStats() {
    return {
        ...stats,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        timestamp: new Date().toISOString()
    };
}

/**
 * 重置统计信息
 */
export function resetPerformanceStats() {
    stats.totalRequests = 0;
    stats.totalResponseTime = 0;
    stats.slowRequests = 0;
    stats.errorRequests = 0;
    stats.requestsByMethod = {};
    stats.requestsByPath = {};
    stats.averageResponseTime = 0;
    
    logger.info('Performance stats reset');
}

/**
 * 性能统计路由处理器
 */
export async function getPerformanceStatsHandler(req, res) {
    try {
        const stats = getPerformanceStats();
        
        res.json({
            success: true,
            data: stats,
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Failed to get performance stats', {
            error: error.message,
            requestId: req.requestId
        });
        
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get performance stats'
            },
            requestId: req.requestId
        });
    }
}

/**
 * 重置性能统计路由处理器
 */
export async function resetPerformanceStatsHandler(req, res) {
    try {
        resetPerformanceStats();
        
        res.json({
            success: true,
            message: 'Performance stats reset successfully',
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Failed to reset performance stats', {
            error: error.message,
            requestId: req.requestId
        });
        
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to reset performance stats'
            },
            requestId: req.requestId
        });
    }
}

/**
 * 系统健康检查处理器
 */
export async function healthCheckHandler(req, res) {
    try {
        const stats = getPerformanceStats();
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        // 计算健康状态
        const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
        const errorRate = stats.totalRequests > 0 ? (stats.errorRequests / stats.totalRequests) * 100 : 0;
        const slowRequestRate = stats.totalRequests > 0 ? (stats.slowRequests / stats.totalRequests) * 100 : 0;
        
        let status = 'healthy';
        const issues = [];
        
        if (memoryUsagePercent > 90) {
            status = 'warning';
            issues.push('High memory usage');
        }
        
        if (errorRate > 10) {
            status = 'warning';
            issues.push('High error rate');
        }
        
        if (slowRequestRate > 20) {
            status = 'warning';
            issues.push('High slow request rate');
        }
        
        if (memoryUsagePercent > 95 || errorRate > 25) {
            status = 'unhealthy';
        }
        
        res.json({
            status,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {
                usage: memoryUsage,
                usagePercent: Math.round(memoryUsagePercent * 100) / 100
            },
            cpu: cpuUsage,
            performance: {
                totalRequests: stats.totalRequests,
                averageResponseTime: Math.round(stats.averageResponseTime * 100) / 100,
                errorRate: Math.round(errorRate * 100) / 100,
                slowRequestRate: Math.round(slowRequestRate * 100) / 100
            },
            issues,
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Health check failed', {
            error: error.message,
            requestId: req.requestId
        });
        
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        });
    }
}
