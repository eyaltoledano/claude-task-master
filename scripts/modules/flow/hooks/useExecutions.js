import { useState, useEffect, useRef, useCallback } from 'react';

export function useExecutions(options = {}) {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  
  // Prevent state updates after unmount
  const isMountedRef = useRef(true);
  const pollIntervalRef = useRef(null);
  
  // Extract config values to stable references
  const pollInterval = options.pollInterval || 2000;
  const maxRetries = options.maxRetries || 3;
  const statusFilter = options.statusFilter;

  const loadExecutions = useCallback(async (retryCount = 0) => {
    try {
      setConnectionStatus('loading');
      
      // Use existing execution service - import dynamically to avoid circular deps
      const { executionService } = await import('../services/execution.service.js');
      
      // Use existing execution service
      const filters = statusFilter ? { status: statusFilter } : {};
      const executionList = executionService.listExecutions(filters);
      
      if (isMountedRef.current) {
        setExecutions(executionList);
        setError(null);
        setConnectionStatus('connected');
        setLoading(false);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      
      console.error('Failed to load executions:', err);
      
      if (retryCount < maxRetries) {
        setConnectionStatus('retrying');
        setTimeout(() => loadExecutions(retryCount + 1), 1000 * (retryCount + 1));
      } else {
        setError(err.message);
        setConnectionStatus('error');
        setLoading(false);
      }
    }
  }, [statusFilter, maxRetries]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Initial load
    loadExecutions();
    
    // Set up polling
    pollIntervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        loadExecutions();
      }
    }, pollInterval);

    return () => {
      isMountedRef.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [loadExecutions, pollInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return { 
    executions, 
    loading, 
    error, 
    connectionStatus,
    refetch: () => loadExecutions()
  };
}

export function useStreamingExecution(executionId) {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('pending');

  useEffect(() => {
    if (!executionId) return;

    // Mock streaming messages for now
    const mockMessages = [
      { 
        id: 1,
        timestamp: new Date().toISOString(),
        type: 'INFO',
        data: { message: 'Execution started', level: 'info' }
      },
      {
        id: 2,
        timestamp: new Date(Date.now() - 5000).toISOString(),
        type: 'STATUS',
        data: { status: 'running', progress: 0.3 }
      }
    ];

    setMessages(mockMessages);
    setStatus('running');

    // TODO: Integrate with real streaming when available
    // const setupStream = async () => {
    //   const stream = await backend.streamExecution?.(executionId);
    //   // Process stream messages
    // };

    return () => {
      // Cleanup streaming connection
    };
  }, [executionId]);

  return { messages, status };
} 