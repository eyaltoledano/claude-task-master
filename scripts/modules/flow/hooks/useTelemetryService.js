import { useState, useEffect, useCallback } from 'react';

export function useTelemetryService(config = {}) {
  const [isEnabled, setIsEnabled] = useState(config.enabled || false);
  const [telemetryQueue, setTelemetryQueue] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Following VibeKit's telemetry patterns
  const trackEvent = useCallback((eventType, data) => {
    if (!isEnabled) return;

    const event = {
      type: eventType,
      data,
      timestamp: Date.now(),
      sessionId: config.sessionId,
      userId: config.userId,
      version: config.version
    };

    setTelemetryQueue(prev => [...prev.slice(-99), event]); // Keep last 100 events
  }, [isEnabled, config]);

  const trackError = useCallback((error, context = {}) => {
    trackEvent('ERROR', {
      message: error.message,
      stack: error.stack,
      context,
      severity: 'error'
    });
  }, [trackEvent]);

  const trackPerformance = useCallback((metrics) => {
    trackEvent('PERFORMANCE', metrics);
  }, [trackEvent]);

  // Flush telemetry data (non-blocking)
  useEffect(() => {
    if (telemetryQueue.length === 0) return;

    const flushData = async () => {
      try {
        if (config.endpoint) {
          setConnectionStatus('connecting');
          await fetch(config.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(telemetryQueue)
          });
          setConnectionStatus('connected');
          setTelemetryQueue([]);
        }
      } catch (error) {
        setConnectionStatus('error');
        console.warn('Telemetry upload failed:', error);
      }
    };

    const timeoutId = setTimeout(flushData, 10000); // Flush every 10 seconds
    return () => clearTimeout(timeoutId);
  }, [telemetryQueue, config.endpoint]);

  return {
    trackEvent,
    trackError,
    trackPerformance,
    isEnabled,
    setIsEnabled,
    connectionStatus,
    queueSize: telemetryQueue.length
  };
} 