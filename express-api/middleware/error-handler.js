import { createLogger } from '../utils/logger.js';

const logger = createLogger('error-handler');

export function errorHandler(error, req, res, next) {
    // 记录错误
    logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        ip: req.ip
    });

    // 确定错误状态码
    let statusCode = 500;
    let errorMessage = 'Internal server error';

    if (error.name === 'ValidationError') {
        statusCode = 400;
        errorMessage = error.message;
    } else if (error.name === 'NotFoundError') {
        statusCode = 404;
        errorMessage = error.message;
    } else if (error.name === 'UnauthorizedError') {
        statusCode = 401;
        errorMessage = error.message;
    } else if (error.name === 'ForbiddenError') {
        statusCode = 403;
        errorMessage = error.message;
    } else if (error.statusCode) {
        statusCode = error.statusCode;
        errorMessage = error.message;
    }

    // 发送错误响应
    res.status(statusCode).json({
        success: false,
        error: {
            code: error.code || 'INTERNAL_ERROR',
            message: errorMessage,
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        },
        requestId: req.requestId,
        timestamp: new Date().toISOString()
    });
}

export class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NotFoundError';
    }
}

export class UnauthorizedError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UnauthorizedError';
    }
}

export class ForbiddenError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ForbiddenError';
    }
}
