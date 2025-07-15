import React from 'react';
import { Box, Text } from 'ink';
import { ErrorBoundary } from './ErrorBoundary.jsx';

/**
 * Error boundary specifically for service initialization failures
 */
export const ServiceErrorBoundary = ({ children, serviceName }) => {
  const handleServiceError = (error, errorInfo) => {
    // Could send telemetry or special handling for service errors
    console.error(`Service error in ${serviceName}:`, error);
  };

  return (
    <ErrorBoundary
      name={`ServiceErrorBoundary-${serviceName}`}
      onError={handleServiceError}
      fallback={ServiceErrorFallback}
      allowReset
    >
      {children}
    </ErrorBoundary>
  );
};

/**
 * Service-specific error fallback
 */
const ServiceErrorFallback = ({ error, onReset }) => (
  <Box flexDirection="column" padding={1}>
    <Text color="red" bold>⚠️  Service Error</Text>
    <Text color="red">Failed to initialize services</Text>
    
    <Box marginTop={1} flexDirection="column">
      <Text color="yellow">Error: {error?.message || 'Unknown service error'}</Text>
      
      {error?.code && (
        <Text color="gray">Code: {error.code}</Text>
      )}
    </Box>
    
    <Box marginTop={1} flexDirection="column">
      <Text color="gray">Possible solutions:</Text>
      <Text color="gray">• Check your configuration</Text>
      <Text color="gray">• Ensure all dependencies are installed</Text>
      <Text color="gray">• Verify network connectivity</Text>
    </Box>
    
    {onReset && (
      <Box marginTop={1}>
        <Text color="yellow" bold>Press 'r' to retry initialization</Text>
      </Box>
    )}
  </Box>
);

/**
 * Error boundary for async operations
 */
export class AsyncErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      isRetrying: false
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const { onError } = this.props;
    if (onError) {
      onError(error, errorInfo);
    }
  }

  handleRetry = async () => {
    const { onRetry } = this.props;
    
    this.setState({ isRetrying: true });
    
    try {
      if (onRetry) {
        await onRetry();
      }
      this.setState({ 
        hasError: false, 
        error: null,
        isRetrying: false 
      });
    } catch (error) {
      this.setState({ 
        error,
        isRetrying: false 
      });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <AsyncErrorFallback
          error={this.state.error}
          isRetrying={this.state.isRetrying}
          onRetry={this.handleRetry}
          canRetry={!!this.props.onRetry}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Async operation error fallback
 */
const AsyncErrorFallback = ({ error, isRetrying, onRetry, canRetry }) => (
  <Box flexDirection="column" padding={1}>
    <Text color="red" bold>⚠️  Operation Failed</Text>
    <Text color="red">{error?.message || 'The operation could not be completed'}</Text>
    
    {isRetrying ? (
      <Box marginTop={1}>
        <Text color="yellow">Retrying...</Text>
      </Box>
    ) : (
      canRetry && (
        <Box marginTop={1}>
          <Text color="yellow">Press 'r' to retry</Text>
        </Box>
      )
    )}
  </Box>
); 