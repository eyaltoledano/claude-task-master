import fs from 'fs';
import path from 'path';

class Logger {
    constructor(name) {
        this.name = name;
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.logLevels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
    }

    shouldLog(level) {
        return this.logLevels[level] <= this.logLevels[this.logLevel];
    }

    formatMessage(level, message, metadata = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            logger: this.name,
            message,
            ...metadata
        };

        return JSON.stringify(logEntry);
    }

    log(level, message, metadata = {}) {
        if (!this.shouldLog(level)) {
            return;
        }

        // 增强元数据
        const enhancedMetadata = {
            ...metadata,
            pid: process.pid,
            memory: this.getMemoryUsage(),
            uptime: process.uptime()
        };

        const formattedMessage = this.formatMessage(level, message, enhancedMetadata);

        // 输出到控制台
        if (level === 'error') {
            console.error(formattedMessage);
        } else if (level === 'warn') {
            console.warn(formattedMessage);
        } else {
            console.log(formattedMessage);
        }

        // 可以在这里添加文件日志记录
        // this.writeToFile(formattedMessage);
    }

    getMemoryUsage() {
        const usage = process.memoryUsage();
        return {
            rss: Math.round(usage.rss / 1024 / 1024), // MB
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
            external: Math.round(usage.external / 1024 / 1024) // MB
        };
    }

    error(message, metadata = {}) {
        this.log('error', message, metadata);
    }

    warn(message, metadata = {}) {
        this.log('warn', message, metadata);
    }

    info(message, metadata = {}) {
        this.log('info', message, metadata);
    }

    debug(message, metadata = {}) {
        this.log('debug', message, metadata);
    }
}

export function createLogger(name) {
    return new Logger(name);
}
