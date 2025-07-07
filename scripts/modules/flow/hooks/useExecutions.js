import { useState, useEffect } from 'react';
import { useAppContext } from '../index.jsx';

export function useExecutions() {
  const { backend } = useAppContext();
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // eslint-disable-next-line
  useEffect(() => {
    const loadExecutions = async () => {
      try {
        setLoading(true);
        // Use existing backend to get execution data
        // For now, create mock data that represents task executions
        const mockExecutions = [
          {
            id: 'exec_001',
            taskId: 'task_001',
            status: 'running',
            provider: 'e2b',
            progress: 0.65,
            duration: 45000,
            startTime: new Date(Date.now() - 45000).toISOString()
          },
          {
            id: 'exec_002', 
            taskId: 'task_005',
            status: 'completed',
            provider: 'modal',
            progress: 1.0,
            duration: 32000,
            startTime: new Date(Date.now() - 120000).toISOString()
          },
          {
            id: 'exec_003',
            taskId: 'task_003',
            status: 'failed',
            provider: 'fly',
            progress: 0.3,
            duration: 15000,
            startTime: new Date(Date.now() - 300000).toISOString(),
            error: 'Connection timeout'
          }
        ];
        
        // If backend has execution listing capability, use it
        if (backend.listExecutions) {
          const result = await backend.listExecutions();
          setExecutions(result.executions || mockExecutions);
        } else {
          setExecutions(mockExecutions);
        }
      } catch (err) {
        setError(err.message);
        // Fallback to empty array on error
        setExecutions([]);
      } finally {
        setLoading(false);
      }
    };

    loadExecutions();
    
    // Poll for updates every 2 seconds
    const interval = setInterval(loadExecutions, 2000);
    return () => clearInterval(interval);
  }, []);

  return { executions, loading, error };
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