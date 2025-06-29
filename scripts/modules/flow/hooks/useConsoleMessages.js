import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook for capturing and displaying console output
 * Based on Gemini CLI's useConsoleMessages implementation
 */
export function useConsoleMessages(options = {}) {
  const {
    maxMessages = 100,
    captureTypes = ['log', 'warn', 'error', 'info'],
    includeStackTrace = false,
    filterDuplicates = true,
  } = options;

  const [messages, setMessages] = useState([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const originalMethods = useRef({});
  const messageCountRef = useRef(0);

  const addMessage = useCallback((type, args, timestamp = new Date()) => {
    const message = {
      id: ++messageCountRef.current,
      type,
      content: args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' '),
      timestamp,
      stack: includeStackTrace ? new Error().stack : null,
    };

    setMessages(prev => {
      // Filter duplicates if enabled
      if (filterDuplicates) {
        const duplicate = prev.find(msg => 
          msg.type === message.type && 
          msg.content === message.content &&
          timestamp - msg.timestamp < 1000 // Within 1 second
        );
        if (duplicate) return prev;
      }

      // Keep only the latest maxMessages
      const newMessages = [...prev, message];
      return newMessages.length > maxMessages 
        ? newMessages.slice(-maxMessages)
        : newMessages;
    });
  }, [maxMessages, includeStackTrace, filterDuplicates]);

  const startCapturing = useCallback(() => {
    if (isCapturing) return;

    // Store original console methods
    captureTypes.forEach(type => {
      if (console[type]) {
        originalMethods.current[type] = console[type];
        console[type] = (...args) => {
          // Call original method first
          originalMethods.current[type](...args);
          // Then capture the message
          addMessage(type, args);
        };
      }
    });

    setIsCapturing(true);
  }, [isCapturing, captureTypes, addMessage]);

  const stopCapturing = useCallback(() => {
    if (!isCapturing) return;

    // Restore original console methods
    captureTypes.forEach(type => {
      if (originalMethods.current[type]) {
        console[type] = originalMethods.current[type];
        delete originalMethods.current[type];
      }
    });

    setIsCapturing(false);
  }, [isCapturing, captureTypes]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    messageCountRef.current = 0;
  }, []);

  const getMessagesByType = useCallback((type) => {
    return messages.filter(msg => msg.type === type);
  }, [messages]);

  const getRecentMessages = useCallback((count = 10) => {
    return messages.slice(-count);
  }, [messages]);

  // Auto cleanup on unmount
  useEffect(() => {
    return () => {
      if (isCapturing) {
        stopCapturing();
      }
    };
  }, [isCapturing, stopCapturing]);

  return {
    messages,
    messageCount: messages.length,
    isCapturing,
    startCapturing,
    stopCapturing,
    clearMessages,
    getMessagesByType,
    getRecentMessages,
    // Utility functions
    hasErrors: messages.some(msg => msg.type === 'error'),
    hasWarnings: messages.some(msg => msg.type === 'warn'),
    errorCount: messages.filter(msg => msg.type === 'error').length,
    warningCount: messages.filter(msg => msg.type === 'warn').length,
  };
}

/**
 * Message formatting utilities
 */
export const MessageFormatters = {
  /**
   * Format message for display in terminal
   */
  formatForTerminal: (message) => {
    const timestamp = message.timestamp.toLocaleTimeString();
    const typeIcon = getTypeIcon(message.type);
    return `${timestamp} ${typeIcon} ${message.content}`;
  },

  /**
   * Format message with color based on type
   */
  formatWithColor: (message, theme) => {
    const color = getTypeColor(message.type, theme);
    return {
      ...message,
      formattedContent: `${color}${message.content}${theme.reset || ''}`,
    };
  },

  /**
   * Group messages by type
   */
  groupByType: (messages) => {
    return messages.reduce((groups, message) => {
      if (!groups[message.type]) {
        groups[message.type] = [];
      }
      groups[message.type].push(message);
      return groups;
    }, {});
  },
};

function getTypeIcon(type) {
  const icons = {
    log: 'ℹ',
    info: 'ℹ',
    warn: '⚠',
    error: '❌',
  };
  return icons[type] || '•';
}

function getTypeColor(type, theme) {
  if (!theme) return '';
  
  const colors = {
    log: theme.text || '',
    info: theme.info || theme.blue || '',
    warn: theme.warning || theme.yellow || '',
    error: theme.error || theme.red || '',
  };
  return colors[type] || '';
} 