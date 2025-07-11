/**
 * utils/logger.js
 * Logging utility for Task Master Web API
 */

import winston from 'winston';
import { config } from '../config/config.js';

// 创建Winston logger实例
export const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    config.logging.format === 'json' 
      ? winston.format.json()
      : winston.format.simple()
  ),
  defaultMeta: { service: 'taskmaster-web-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// 如果不是生产环境，记录到文件
if (config.server.env !== 'production') {
  logger.add(new winston.transports.File({ 
    filename: 'logs/error.log', 
    level: 'error' 
  }));
  logger.add(new winston.transports.File({ 
    filename: 'logs/combined.log' 
  }));
}

/**
 * 创建MCP兼容的日志包装器
 * @param {Function} mcpLogFunction - MCP日志函数
 * @returns {Object} 包装后的日志对象
 */
export const createMcpLogWrapper = (mcpLogFunction) => {
  return {
    info: (message, meta = {}) => {
      logger.info(message, meta);
      if (mcpLogFunction) {
        mcpLogFunction(`INFO: ${message}`, meta);
      }
    },
    error: (message, meta = {}) => {
      logger.error(message, meta);
      if (mcpLogFunction) {
        mcpLogFunction(`ERROR: ${message}`, meta);
      }
    },
    warn: (message, meta = {}) => {
      logger.warn(message, meta);
      if (mcpLogFunction) {
        mcpLogFunction(`WARN: ${message}`, meta);
      }
    },
    debug: (message, meta = {}) => {
      logger.debug(message, meta);
      if (mcpLogFunction) {
        mcpLogFunction(`DEBUG: ${message}`, meta);
      }
    }
  };
};

/**
 * 请求日志中间件
 */
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      requestId: req.requestId,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  });
  
  next();
};

export default logger; 