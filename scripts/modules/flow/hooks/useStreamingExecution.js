import { useState, useEffect, useRef, useCallback } from 'react';

export function useStreamingExecution(executionId, options = {}) {
  const [messages, setMessages] = useState([]);
  const [currentStatus, setCurrentStatus] = useState('pending');
  const [currentProgress, setCurrentProgress] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  
  // Refs for cleanup management
  const isMountedRef = useRef(true);
  const unsubscribeRef = useRef(null);
  const streamIteratorRef = useRef(null);
  
  // Extract stable config values
  const maxMessages = options.maxMessages || 100;
  const messageFilter = options.messageFilter;
  const autoConnect = options.autoConnect !== false;

  const connectToStream = useCallback(async () => {
    if (!executionId || !isMountedRef.current) return;
    
    try {
      setError(null);
      setIsStreaming(true);
      
      // Use existing execution service - import dynamically to avoid circular deps
      const { executionService } = await import('../services/execution.service.js');
      
      // Check if execution exists
      try {
        const executionStatus = executionService.getExecutionStatus(executionId);
        setCurrentStatus(executionStatus.status);
        setCurrentProgress(executionStatus.progress);
      } catch (statusError) {
        // Execution might not exist yet, continue with streaming setup
        console.warn('Could not get initial execution status:', statusError.message);
      }
      
      // Start streaming using existing service
      const streamIterator = executionService.streamExecution(executionId);
      streamIteratorRef.current = streamIterator;
      
      // Process streaming messages
      (async () => {
        try {
          for await (const message of streamIterator) {
            if (!isMountedRef.current) break;
            
            // Apply message filter if specified
            if (messageFilter && !messageFilter(message)) {
              continue;
            }
            
            // Update messages with size limit
            setMessages(prev => {
              const newMessages = [...prev, message];
              return newMessages.slice(-maxMessages);
            });
            
            // Update status and progress based on message type
            switch (message.type) {
              case 'status':
                if (message.data.status) {
                  setCurrentStatus(message.data.status);
                }
                break;
              case 'progress':
                if (typeof message.data.progress === 'number') {
                  setCurrentProgress(message.data.progress);
                }
                break;
              case 'error':
                setError(message.data.error);
                break;
            }
          }
        } catch (streamError) {
          if (isMountedRef.current) {
            console.error('Streaming error:', streamError);
            setError(streamError.message);
          }
        } finally {
          if (isMountedRef.current) {
            setIsStreaming(false);
          }
        }
      })();
      
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Failed to connect to stream:', err);
        setError(err.message);
        setIsStreaming(false);
      }
    }
  }, [executionId, messageFilter, maxMessages]);

  const disconnectFromStream = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    if (streamIteratorRef.current) {
      // Clean up async iterator if possible
      if (streamIteratorRef.current.return) {
        streamIteratorRef.current.return();
      }
      streamIteratorRef.current = null;
    }
    
    setIsStreaming(false);
  }, []);

  // Effect for managing streaming connection
  useEffect(() => {
    isMountedRef.current = true;
    
    if (executionId && autoConnect) {
      connectToStream();
    }
    
    return () => {
      isMountedRef.current = false;
      disconnectFromStream();
    };
  }, [executionId, autoConnect, connectToStream, disconnectFromStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      disconnectFromStream();
    };
  }, [disconnectFromStream]);

  return {
    messages,
    currentStatus,
    currentProgress,
    isStreaming,
    error,
    connect: connectToStream,
    disconnect: disconnectFromStream
  };
} 