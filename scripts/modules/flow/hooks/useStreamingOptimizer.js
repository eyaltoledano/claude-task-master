import { useState, useEffect, useRef, useCallback } from 'react';

// Enhanced streaming buffer following VibeKit patterns
export function useStreamingOptimizer(streamId, options = {}) {
  const {
    maxMessages = 50,
    throttleMs = 100,
    chunkSize = 1024,
    compressionEnabled = true
  } = options;

  const [messages, setMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const buffer = useRef('');
  const lastUpdate = useRef(0);
  const compressionMap = useRef(new Map());

  // Compressed message storage for memory efficiency
  const compressMessage = useCallback((message) => {
    if (!compressionEnabled) return message;
    
    const key = JSON.stringify(message);
    if (compressionMap.current.has(key)) {
      return { compressed: true, ref: compressionMap.current.get(key) };
    }
    
    const id = compressionMap.current.size;
    compressionMap.current.set(key, id);
    return { compressed: true, ref: id, data: message };
  }, [compressionEnabled]);

  // Optimized message processing
  const processChunk = useCallback((chunk) => {
    const now = Date.now();
    if (now - lastUpdate.current < throttleMs) {
      buffer.current += chunk;
      return;
    }

    setIsProcessing(true);
    
    try {
      const fullData = buffer.current + chunk;
      buffer.current = '';
      lastUpdate.current = now;

      // Parse JSON messages from stream
      const lines = fullData.split('\n').filter(line => line.trim());
      const newMessages = [];

      lines.forEach(line => {
        try {
          const message = JSON.parse(line);
          newMessages.push(compressMessage({
            ...message,
            streamId,
            timestamp: now,
            id: `${streamId}-${now}-${Math.random()}`
          }));
        } catch (e) {
          // Handle non-JSON lines as raw text
          newMessages.push(compressMessage({
            type: 'raw',
            content: line,
            streamId,
            timestamp: now,
            id: `${streamId}-${now}-${Math.random()}`
          }));
        }
      });

      if (newMessages.length > 0) {
        setMessages(prev => {
          const combined = [...prev, ...newMessages];
          return combined.slice(-maxMessages); // Keep only recent messages
        });
      }
    } catch (error) {
      console.warn('Stream processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [streamId, throttleMs, maxMessages, compressMessage]);

  // Memory cleanup
  useEffect(() => {
    return () => {
      compressionMap.current.clear();
      buffer.current = '';
    };
  }, []);

  return {
    messages,
    processChunk,
    isProcessing,
    memoryUsage: messages.length + compressionMap.current.size
  };
} 