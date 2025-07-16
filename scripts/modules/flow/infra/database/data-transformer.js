import crypto from 'crypto';

export class DataTransformer {
  constructor() {
    this.subtaskIdRegex = /^(\d+)\.(\d+)$/; // Matches "5.2" format
  }

  /**
   * Convert tasks.json data to SQLite format
   * @param {Object} tasksJsonData - The complete tasks.json data structure
   * @returns {Object} - Object with tags, tasks, and dependencies arrays for SQLite
   */
  jsonToSqlite(tasksJsonData) {
    const tags = [];
    const tasks = [];
    const dependencies = [];
    
    // Handle both tagged and legacy format
    const tagsData = this._extractTagsData(tasksJsonData);
    
    for (const [tagName, tagData] of Object.entries(tagsData)) {
      // Create tag record
      const tag = {
        name: tagName,
        description: tagData.metadata?.description || `Tasks for ${tagName} context`,
        metadataJson: JSON.stringify(tagData.metadata || {}),
        createdAt: tagData.metadata?.created || new Date().toISOString(),
        updatedAt: tagData.metadata?.updated || new Date().toISOString()
      };
      tags.push(tag);
      
      // Process tasks for this tag
      if (tagData.tasks && Array.isArray(tagData.tasks)) {
        const { tasksForTag, dependenciesForTag } = this._processTasksForTag(
          tagData.tasks, 
          tagName
        );
        tasks.push(...tasksForTag);
        dependencies.push(...dependenciesForTag);
      }
    }
    
    return { tags, tasks, dependencies };
  }

  /**
   * Convert SQLite data back to tasks.json format
   * @param {Array} tags - Tags from database
   * @param {Array} tasks - Tasks from database  
   * @param {Array} dependencies - Dependencies from database
   * @returns {Object} - tasks.json formatted data
   */
  sqliteToJson(tags, tasks, dependencies) {
    const result = {};
    
    // Group tasks by tag
    const tasksByTag = this._groupTasksByTag(tasks);
    const dependenciesByTag = this._groupDependenciesByTag(dependencies);
    
    for (const tag of tags) {
      const tagTasks = tasksByTag[tag.name] || [];
      const tagDependencies = dependenciesByTag[tag.name] || [];
      
      // Reconstruct the JSON task structure
      const jsonTasks = this._reconstructJsonTasks(tagTasks, tagDependencies);
      
      result[tag.name] = {
        tasks: jsonTasks,
        metadata: {
          ...JSON.parse(tag.metadataJson || '{}'),
          created: tag.createdAt,
          updated: tag.updatedAt
        }
      };
    }
    
    return result;
  }

  /**
   * Calculate hash for change detection
   * @param {*} data - Any data to hash
   * @returns {string} - SHA-256 hash
   */
  calculateHash(data) {
    const normalized = this._normalizeForHashing(data);
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
  }

  /**
   * Validate data integrity between JSON and SQLite
   * @param {Object} jsonData - Original JSON data
   * @param {Object} sqliteData - Data from SQLite
   * @returns {Object} - Validation result with errors if any
   */
  validateDataIntegrity(jsonData, sqliteData) {
    const errors = [];
    
    try {
      // Convert SQLite back to JSON format for comparison
      const reconstructedJson = this.sqliteToJson(
        sqliteData.tags, 
        sqliteData.tasks, 
        sqliteData.dependencies
      );
      
      // Compare task counts per tag
      const originalTags = this._extractTagsData(jsonData);
      
      for (const [tagName, tagData] of Object.entries(originalTags)) {
        const originalTasks = tagData.tasks || [];
        const reconstructedTasks = reconstructedJson[tagName]?.tasks || [];
        
        if (originalTasks.length !== reconstructedTasks.length) {
          errors.push(`Tag "${tagName}": Task count mismatch. Original: ${originalTasks.length}, Reconstructed: ${reconstructedTasks.length}`);
        }
        
        // Check for missing tasks
        const originalIds = new Set(originalTasks.map(t => t.id));
        const reconstructedIds = new Set(reconstructedTasks.map(t => t.id));
        
        const missingInReconstructed = [...originalIds].filter(id => !reconstructedIds.has(id));
        const extraInReconstructed = [...reconstructedIds].filter(id => !originalIds.has(id));
        
        if (missingInReconstructed.length > 0) {
          errors.push(`Tag "${tagName}": Missing tasks in reconstructed data: ${missingInReconstructed.join(', ')}`);
        }
        
        if (extraInReconstructed.length > 0) {
          errors.push(`Tag "${tagName}": Extra tasks in reconstructed data: ${extraInReconstructed.join(', ')}`);
        }
      }
      
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // ============ PRIVATE HELPER METHODS ============

  _extractTagsData(tasksJsonData) {
    // Handle legacy format (direct tasks array)
    if (Array.isArray(tasksJsonData.tasks)) {
      return {
        master: {
          tasks: tasksJsonData.tasks,
          metadata: tasksJsonData.metadata || {}
        }
      };
    }
    
    // Handle tagged format
    const tagsData = {};
    for (const [key, value] of Object.entries(tasksJsonData)) {
      if (key !== 'metadata' && value.tasks) {
        tagsData[key] = value;
      }
    }
    
    return tagsData;
  }

  _processTasksForTag(tasks, tagName) {
    const tasksForTag = [];
    const dependenciesForTag = [];
    
    for (const task of tasks) {
      // Handle both regular tasks and subtasks
      const dbTask = this._convertTaskToDbFormat(task, tagName);
      tasksForTag.push(dbTask);
      
      // Process dependencies
      if (task.dependencies && Array.isArray(task.dependencies)) {
        for (const depId of task.dependencies) {
          dependenciesForTag.push({
            taskId: task.id,
            tagName: tagName,
            dependsOnTaskId: depId,
            dependsOnTagName: tagName // Assume same tag for now
          });
        }
      }
      
      // Process subtasks recursively
      if (task.subtasks && Array.isArray(task.subtasks)) {
        const { tasksForTag: subtasks, dependenciesForTag: subtaskDeps } = 
          this._processSubtasks(task.subtasks, task.id, tagName);
        tasksForTag.push(...subtasks);
        dependenciesForTag.push(...subtaskDeps);
      }
    }
    
    return { tasksForTag, dependenciesForTag };
  }

  _processSubtasks(subtasks, parentId, tagName) {
    const tasksForTag = [];
    const dependenciesForTag = [];
    
    for (const subtask of subtasks) {
      // Convert subtask ID format (e.g., "5.2" becomes task with parentTaskId)
      const subtaskId = typeof subtask.id === 'string' ? 
        this._parseSubtaskId(subtask.id) : subtask.id;
      
      const dbSubtask = {
        ...this._convertTaskToDbFormat(subtask, tagName),
        id: subtaskId,
        parentTaskId: parentId
      };
      tasksForTag.push(dbSubtask);
      
      // Process subtask dependencies
      if (subtask.dependencies && Array.isArray(subtask.dependencies)) {
        for (const depId of subtask.dependencies) {
          dependenciesForTag.push({
            taskId: subtaskId,
            tagName: tagName,
            dependsOnTaskId: depId,
            dependsOnTagName: tagName
          });
        }
      }
    }
    
    return { tasksForTag, dependenciesForTag };
  }

  _convertTaskToDbFormat(task, tagName) {
    return {
      id: task.id,
      title: task.title || '',
      description: task.description || '',
      status: task.status || 'pending',
      priority: task.priority || 'medium',
      details: task.details || '',
      testStrategy: task.testStrategy || '',
      createdAt: task.createdAt || new Date().toISOString(),
      updatedAt: task.updatedAt || new Date().toISOString()
    };
  }

  _parseSubtaskId(subtaskIdString) {
    const match = subtaskIdString.match(this.subtaskIdRegex);
    if (match) {
      return parseInt(match[2], 10); // Return the subtask number
    }
    return parseInt(subtaskIdString, 10); // Fallback to parsing as number
  }

  _formatSubtaskId(parentId, subtaskId) {
    return `${parentId}.${subtaskId}`;
  }

  _groupTasksByTag(tasks) {
    const grouped = {};
    for (const task of tasks) {
      const tagName = task.tagName || task.tag?.name;
      if (!grouped[tagName]) {
        grouped[tagName] = [];
      }
      grouped[tagName].push(task);
    }
    return grouped;
  }

  _groupDependenciesByTag(dependencies) {
    const grouped = {};
    for (const dep of dependencies) {
      const tagName = dep.tagName;
      if (!grouped[tagName]) {
        grouped[tagName] = [];
      }
      grouped[tagName].push(dep);
    }
    return grouped;
  }

  _reconstructJsonTasks(dbTasks, dbDependencies) {
    // Group tasks into parents and subtasks
    const parentTasks = dbTasks.filter(t => !t.parentTaskId);
    const subtasksByParent = {};
    
    for (const task of dbTasks.filter(t => t.parentTaskId)) {
      if (!subtasksByParent[task.parentTaskId]) {
        subtasksByParent[task.parentTaskId] = [];
      }
      subtasksByParent[task.parentTaskId].push(task);
    }
    
    // Create dependency map
    const dependencyMap = {};
    for (const dep of dbDependencies) {
      if (!dependencyMap[dep.taskId]) {
        dependencyMap[dep.taskId] = [];
      }
      dependencyMap[dep.taskId].push(dep.dependsOnTaskId);
    }
    
    // Reconstruct JSON format
    const jsonTasks = [];
    
    for (const parentTask of parentTasks) {
      const jsonTask = {
        id: parentTask.id,
        title: parentTask.title,
        description: parentTask.description,
        status: parentTask.status,
        priority: parentTask.priority,
        details: parentTask.details,
        testStrategy: parentTask.testStrategy,
        dependencies: dependencyMap[parentTask.id] || []
      };
      
      // Add subtasks if any
      const subtasks = subtasksByParent[parentTask.id];
      if (subtasks && subtasks.length > 0) {
        jsonTask.subtasks = subtasks.map(subtask => ({
          id: this._formatSubtaskId(parentTask.id, subtask.id),
          title: subtask.title,
          description: subtask.description,
          status: subtask.status,
          priority: subtask.priority,
          details: subtask.details,
          testStrategy: subtask.testStrategy,
          dependencies: dependencyMap[subtask.id] || []
        }));
      }
      
      jsonTasks.push(jsonTask);
    }
    
    return jsonTasks;
  }

  _normalizeForHashing(data) {
    // Create a normalized version for consistent hashing
    if (Array.isArray(data)) {
      return data.map(item => this._normalizeForHashing(item)).sort();
    }
    
    if (data && typeof data === 'object') {
      const normalized = {};
      const keys = Object.keys(data).sort();
      for (const key of keys) {
        normalized[key] = this._normalizeForHashing(data[key]);
      }
      return normalized;
    }
    
    return data;
  }
} 