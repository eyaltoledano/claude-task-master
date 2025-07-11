/**
 * middleware/auth.js
 * Authentication middleware for Task Master Web API
 * Note: Authentication is disabled to keep web-api simple
 */

/**
 * No-op authentication middleware (authentication disabled)
 */
export const apiKeyAuth = (req, res, next) => {
  // Authentication is disabled for web-api to keep it simple
  next();
}

/**
 * Project root validation middleware
 */
export const validateProjectRoot = (req, res, next) => {
  // Set default project root if not provided
  if (!req.body.projectRoot && !req.query.projectRoot) {
    req.body.projectRoot = config.taskmaster.defaultProjectRoot;
    logger.debug('Using default project root', { 
      projectRoot: req.body.projectRoot 
    });
  }

  // Use project root from query or body
  const projectRoot = req.body.projectRoot || req.query.projectRoot;
  
  // Store in request for later use
  req.projectRoot = projectRoot;
  
  next();
}

/**
 * Request ID middleware
 */
export const requestId = (req, res, next) => {
  req.requestId = `${Date.now()}-${randomBytes(5).toString('hex')}`;
  res.setHeader('X-Request-ID', req.requestId);
  next();
}

/**
 * 错误处理中间件
 */
export const errorMiddleware = (error, req, res, next) => {
  logger.error('请求处理错误', {
    error: error.message,
    stack: error.stack,
    requestId: req.requestId,
    url: req.originalUrl,
    method: req.method
  });
  
  // 如果响应已经发送，则交给默认的Express错误处理器
  if (res.headersSent) {
    return next(error);
  }
  
  const status = error.status || error.statusCode || 500;
  const message = error.message || '服务器内部错误';
  
  res.status(status).json({
    success: false,
    error: error.code || 'internal_server_error',
    message: message,
    requestId: req.requestId,
    ...(config.server.env === 'development' && { 
      stack: error.stack,
      details: error.details 
    })
  });
}; 