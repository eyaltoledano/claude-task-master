/**
 * Task Enhancer - Enriches tasks with parent task information
 * 
 * This service takes a list of tasks and enhances subtasks with their parent
 * task information, providing better context for content generation.
 */

export class TaskEnhancer {
  constructor(backend) {
    this.backend = backend;
  }

  async enhanceTasks(tasks) {
    // Extract logic from direct-backend.js prepareClaudeContext()
    // Process each task and add parent information for subtasks
    
    return await Promise.all(
      tasks.map(async (task) => {
        const isSubtask = task.isSubtask || String(task.id).includes('.');
        
        if (isSubtask && !task.parentTask) {
          // Extract parent ID from subtask ID (e.g., "5.2" -> "5")
          const [parentId] = String(task.id).split('.');
          
          try {
            const parentTask = await this.backend.getTask(parentId);
            
            if (parentTask) {
              return {
                ...task,
                isSubtask: true,
                parentTask: {
                  id: parentTask.id,
                  title: parentTask.title,
                  description: parentTask.description,
                  details: parentTask.details,
                  testStrategy: parentTask.testStrategy || parentTask.test_strategy,
                  status: parentTask.status
                }
              };
            }
          } catch (error) {
            console.warn(`Could not load parent task for subtask ${task.id}:`, error.message);
          }
        }
        
        // Return task as-is if it's not a subtask or already has parent info
        return {
          ...task,
          isSubtask
        };
      })
    );
  }

  /**
   * Organize tasks by hierarchy for better context presentation
   */
  organizeTaskHierarchy(enhancedTasks) {
    const organized = {
      parentTasks: [],
      standaloneSubtasks: [],
      taskGroups: new Map()
    };

    enhancedTasks.forEach(task => {
      if (task.isSubtask) {
        const parentId = String(task.id).split('.')[0];
        
        if (task.parentTask) {
          // Group with parent
          if (!organized.taskGroups.has(parentId)) {
            organized.taskGroups.set(parentId, {
              parent: task.parentTask,
              subtasks: []
            });
          }
          organized.taskGroups.get(parentId).subtasks.push(task);
        } else {
          // Orphaned subtask
          organized.standaloneSubtasks.push(task);
        }
      } else {
        // Parent task or standalone task
        organized.parentTasks.push(task);
      }
    });

    return organized;
  }

  /**
   * Extract key information from task for context building
   */
  extractTaskKeywords(task) {
    const text = `${task.title} ${task.description} ${task.details || ''}`;
    
    // Extract potential file names, component names, etc.
    const filePattern = /([a-zA-Z0-9\-_/]+\.(js|jsx|ts|tsx|json|md|css|scss))/gi;
    const componentPattern = /\b([A-Z][a-zA-Z0-9]*(?:Component|Service|Manager|Handler)?)\b/g;
    const actionPattern = /\b(implement|create|add|update|modify|fix|refactor|test)\s+([a-zA-Z\s]+)/gi;
    
    const files = [...text.matchAll(filePattern)].map(match => match[1]);
    const components = [...text.matchAll(componentPattern)].map(match => match[1]);
    const actions = [...text.matchAll(actionPattern)].map(match => ({
      action: match[1],
      target: match[2].trim()
    }));
    
    return {
      files,
      components,
      actions,
      keywords: this.extractKeywords(text)
    };
  }

  extractKeywords(text) {
    // Simple keyword extraction
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    // Filter out common words
    const stopWords = new Set(['this', 'that', 'with', 'from', 'they', 'will', 'have', 'been', 'were', 'said', 'each', 'which', 'their', 'time', 'would', 'there', 'could', 'should']);
    
    return [...new Set(words.filter(word => !stopWords.has(word)))];
  }
} 