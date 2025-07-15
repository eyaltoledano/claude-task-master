import React from 'react';
import { Box, Text } from 'ink';
import { useServices } from '../../contexts/ServiceContext.js';

/**
 * Base error boundary component
 * @class
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { 
      hasError: true,
      error 
    };
  }

  componentDidCatch(error, errorInfo) {
    const { onError, logger } = this.props;
    
    // Log error details
    if (logger) {
      logger.error('ErrorBoundary caught error:', {
        error: error.toString(),
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        props: this.props.name ? { boundaryName: this.props.name } : undefined
      });
    } else {
      console.error('ErrorBoundary caught error:', error, errorInfo);
    }

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }

    // Update state with error details
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      const { fallback: Fallback, children, showDetails = false } = this.props;
      
      // Use custom fallback if provided
      if (Fallback) {
        return (
          <Fallback 
            error={this.state.error}
            errorInfo={this.state.errorInfo}
            onReset={this.handleReset}
          />
        );
      }

      // Default error UI
      return (
        <Box flexDirection="column" padding={1}>
          <Text color="red" bold>⚠️  An error occurred</Text>
          <Text color="red">{this.state.error?.message || 'Unknown error'}</Text>
          
          {showDetails && this.state.error?.stack && (
            <Box marginTop={1} flexDirection="column">
              <Text color="gray" dimColor>Stack trace:</Text>
              <Text color="gray" dimColor wrap="wrap">
                {this.state.error.stack}
              </Text>
            </Box>
          )}
          
          {this.props.allowReset && (
            <Box marginTop={1}>
              <Text color="yellow">Press 'r' to retry</Text>
            </Box>
          )}
        </Box>
      );
    }

    return this.props.children;
  }
}

/**
 * Error boundary with logger integration
 */
export const ErrorBoundaryWithLogger = ({ children, ...props }) => {
  const services = useServices();
  const logger = services?.logger;
  return (
    <ErrorBoundary logger={logger} {...props}>
      {children}
    </ErrorBoundary>
  );
};

/**
 * Default error fallback component
 */
export const DefaultErrorFallback = ({ error, errorInfo, onReset }) => (
  <Box flexDirection="column" padding={1}>
    <Text color="red" bold>⚠️  Something went wrong</Text>
    <Text color="red">{error?.message || 'An unexpected error occurred'}</Text>
    
    <Box marginTop={1}>
      <Text color="gray">Please try restarting the application.</Text>
    </Box>
    
    {onReset && (
      <Box marginTop={1}>
        <Text color="yellow">Press 'r' to retry</Text>
      </Box>
    )}
  </Box>
); 