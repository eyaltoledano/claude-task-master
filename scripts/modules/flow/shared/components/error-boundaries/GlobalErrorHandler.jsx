import React, { useEffect } from 'react';
import { Box, Text } from 'ink';
import { useServices } from '../../contexts/ServiceContext.js';

/**
 * Global error handler component
 * Captures uncaught errors and unhandled promise rejections
 */
export const GlobalErrorHandler = ({ children }) => {
  const services = useServices();
  const logger = services?.logger;

  useEffect(() => {
    // Handle uncaught errors
    const handleError = (event) => {
      event.preventDefault();
      
      logger.error('Uncaught error:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack || event.error
      });

      // Could also update UI state here to show error
    };

    // Handle unhandled promise rejections
    const handleRejection = (event) => {
      event.preventDefault();
      
      logger.error('Unhandled promise rejection:', {
        reason: event.reason,
        promise: event.promise,
        stack: event.reason?.stack
      });

      // Could also update UI state here to show error
    };

    // Add global error handlers
    if (typeof window !== 'undefined') {
      window.addEventListener('error', handleError);
      window.addEventListener('unhandledrejection', handleRejection);
    } else {
      // Node.js environment
      process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception:', {
          message: error.message,
          stack: error.stack
        });
      });

      process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled rejection:', {
          reason,
          promise
        });
      });
    }

    // Cleanup
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('error', handleError);
        window.removeEventListener('unhandledrejection', handleRejection);
      }
    };
  }, [logger]);

  return <>{children}</>;
};

/**
 * Error reporter for sending errors to external services
 */
export class ErrorReporter {
  constructor(options = {}) {
    this.endpoint = options.endpoint;
    this.apiKey = options.apiKey;
    this.environment = options.environment || 'development';
    this.metadata = options.metadata || {};
    this.enabled = options.enabled ?? true;
  }

  /**
   * Report an error to external service
   */
  async report(error, context = {}) {
    if (!this.enabled || !this.endpoint) {
      return;
    }

    try {
      const errorData = {
        message: error.message,
        stack: error.stack,
        type: error.name,
        timestamp: new Date().toISOString(),
        environment: this.environment,
        context: {
          ...this.metadata,
          ...context
        }
      };

      // In a real implementation, this would send to an error tracking service
      // For now, just log it
      console.log('Error report:', errorData);

      // Example: Send to error tracking service
      // await fetch(this.endpoint, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${this.apiKey}`
      //   },
      //   body: JSON.stringify(errorData)
      // });
    } catch (reportError) {
      // Don't throw if reporting fails
      console.error('Failed to report error:', reportError);
    }
  }
}

/**
 * Hook for error reporting
 */
export const useErrorReporter = () => {
  const services = useServices();
  const logger = services?.logger;
  
  const reporter = React.useMemo(() => {
    return new ErrorReporter({
      enabled: process.env.NODE_ENV === 'production',
      environment: process.env.NODE_ENV,
      metadata: {
        app: 'task-master-flow',
        version: process.env.npm_package_version
      }
    });
  }, []);

  const reportError = React.useCallback((error, context) => {
    // Log locally
    logger.error('Error reported:', { error, context });
    
    // Report to external service
    reporter.report(error, context);
  }, [logger, reporter]);

  return { reportError };
}; 