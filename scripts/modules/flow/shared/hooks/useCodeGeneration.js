import { useState, useCallback, useMemo } from 'react';
import { AgentsConfigManager } from '../config/managers/agents-config-manager.js';

export const useCodeGeneration = () => {
  const [isCodeGenerationActive, setIsCodeGenerationActive] = useState(false);
  const [codeGenerationResult, setCodeGenerationResult] = useState(null);
  const [availableAgents, setAvailableAgents] = useState([]);
  const [isAgentsLoaded, setIsAgentsLoaded] = useState(false);

  const configService = useMemo(() => new AgentsConfigManager(), []);

  const initializeCodeGeneration = useCallback(async () => {
    try {
      if (!isAgentsLoaded) {
        const agents = await configService.getConfiguredAgents();
        setAvailableAgents(agents);
        setIsAgentsLoaded(true);
      }
      return availableAgents.length > 0;
    } catch (error) {
      console.error('Failed to initialize code generation:', error);
      return false;
    }
  }, [isAgentsLoaded, availableAgents.length, configService]);

  const startCodeGeneration = useCallback((subtask) => {
    setIsCodeGenerationActive(true);
    setCodeGenerationResult(null);
  }, []);

  const completeCodeGeneration = useCallback((result) => {
    setCodeGenerationResult(result);
    setIsCodeGenerationActive(false);
  }, []);

  const cancelCodeGeneration = useCallback(() => {
    setIsCodeGenerationActive(false);
    setCodeGenerationResult(null);
  }, []);

  const canStartCodeGeneration = useCallback((subtask) => {
    // Check if subtask is suitable for code generation
    if (!subtask || subtask.status === 'done') {
      return { canStart: false, reason: 'Subtask is already completed' };
    }

    if (availableAgents.length === 0) {
      return { canStart: false, reason: 'No AI agents configured with API keys' };
    }

    // Check if PR already exists
    // This would integrate with the PR tracking system
    // For now, we'll just check if the subtask has been marked as having a PR
    
    return { canStart: true, reason: null };
  }, [availableAgents.length]);

  const getCodeGenerationStatus = useCallback(async (subtask) => {
    try {
      // Check if there's an existing PR for this subtask
      const existingPR = await configService.getPRForSubtask(subtask.id);
      
      if (existingPR) {
        return {
          hasPR: true,
          prNumber: existingPR.prNumber,
          prUrl: existingPR.prUrl,
          agent: existingPR.agent,
          status: existingPR.status
        };
      }

      return {
        hasPR: false,
        canGenerate: canStartCodeGeneration(subtask).canStart
      };
    } catch (error) {
      return {
        hasPR: false,
        canGenerate: false,
        error: error.message
      };
    }
  }, [canStartCodeGeneration, configService]);

  const getAgentStatistics = useCallback(async () => {
    try {
      return await configService.getStatistics();
    } catch (error) {
      return null;
    }
  }, [configService]);

  return {
    // State
    isCodeGenerationActive,
    codeGenerationResult,
    availableAgents,
    isAgentsLoaded,

    // Actions
    initializeCodeGeneration,
    startCodeGeneration,
    completeCodeGeneration,
    cancelCodeGeneration,

    // Utilities
    canStartCodeGeneration,
    getCodeGenerationStatus,
    getAgentStatistics
  };
}; 