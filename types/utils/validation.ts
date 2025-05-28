/**
 * Validation utility types and functions for claude-task-master
 */

import type { Task, Subtask, TaskStatus, TaskPriority } from '../models/task.js';

/**
 * Type for validation errors
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Type for validation results
 */
export type ValidationResult<T> = 
  | { valid: true; data: T }
  | { valid: false; errors: ValidationError[] };

/**
 * Type guard to check if a value is a valid TaskStatus
 */
export function isValidTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && 
    ['pending', 'in_progress', 'completed', 'cancelled'].includes(value);
}

/**
 * Type guard to check if a value is a valid TaskPriority
 */
export function isValidTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === 'string' && 
    ['low', 'medium', 'high'].includes(value);
}

/**
 * Type guard to check if an ID is valid (string format)
 */
export function isValidId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard to check if dependency array is valid
 */
export function isValidDependencies(value: unknown): value is string[] {
  return Array.isArray(value) && 
    value.every(dep => typeof dep === 'string' && dep.length > 0);
}

/**
 * Validate a Task object
 */
export function validateTask(data: unknown): ValidationResult<Task> {
  const errors: ValidationError[] = [];
  
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: [{ field: 'task', message: 'Task must be an object' }] };
  }
  
  const task = data as Record<string, unknown>;
  
  // Required fields
  if (!isValidId(task.id)) {
    errors.push({ field: 'id', message: 'Task ID must be a non-empty string', value: task.id });
  }
  
  if (typeof task.title !== 'string' || task.title.length === 0) {
    errors.push({ field: 'title', message: 'Task title must be a non-empty string', value: task.title });
  }
  
  if (typeof task.description !== 'string') {
    errors.push({ field: 'description', message: 'Task description must be a string', value: task.description });
  }
  
  if (!isValidTaskStatus(task.status)) {
    errors.push({ field: 'status', message: 'Invalid task status', value: task.status });
  }
  
  if (!isValidTaskPriority(task.priority)) {
    errors.push({ field: 'priority', message: 'Invalid task priority', value: task.priority });
  }
  
  if (!isValidDependencies(task.dependencies)) {
    errors.push({ field: 'dependencies', message: 'Dependencies must be an array of strings', value: task.dependencies });
  }
  
  // Optional fields
  if (task.subtasks !== undefined && !Array.isArray(task.subtasks)) {
    errors.push({ field: 'subtasks', message: 'Subtasks must be an array', value: task.subtasks });
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return { valid: true, data: task as unknown as Task };
}

/**
 * Validate a Subtask object
 */
export function validateSubtask(data: unknown): ValidationResult<Subtask> {
  const errors: ValidationError[] = [];
  
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: [{ field: 'subtask', message: 'Subtask must be an object' }] };
  }
  
  const subtask = data as Record<string, unknown>;
  
  // Required fields
  if (!isValidId(subtask.id)) {
    errors.push({ field: 'id', message: 'Subtask ID must be a non-empty string', value: subtask.id });
  }
  
  if (!isValidId(subtask.taskId)) {
    errors.push({ field: 'taskId', message: 'Task ID must be a non-empty string', value: subtask.taskId });
  }
  
  if (typeof subtask.title !== 'string' || subtask.title.length === 0) {
    errors.push({ field: 'title', message: 'Subtask title must be a non-empty string', value: subtask.title });
  }
  
  if (typeof subtask.description !== 'string') {
    errors.push({ field: 'description', message: 'Subtask description must be a string', value: subtask.description });
  }
  
  if (!isValidTaskStatus(subtask.status)) {
    errors.push({ field: 'status', message: 'Invalid subtask status', value: subtask.status });
  }
  
  if (!isValidDependencies(subtask.dependencies)) {
    errors.push({ field: 'dependencies', message: 'Dependencies must be an array of strings', value: subtask.dependencies });
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return { valid: true, data: subtask as unknown as Subtask };
}

/**
 * Type for ID validation results
 */
export interface IdValidation {
  isValid: boolean;
  isMainTask: boolean;
  isSubtask: boolean;
  isSubSubtask: boolean;
  level: number;
  parts: string[];
  parent?: string;
}

/**
 * Parse and validate a task/subtask ID
 */
export function parseTaskId(id: string): IdValidation {
  const parts = id.split('.');
  const isValid = parts.every(part => /^\d+$/.test(part) && parseInt(part) > 0);
  
  return {
    isValid,
    isMainTask: parts.length === 1,
    isSubtask: parts.length === 2,
    isSubSubtask: parts.length === 3,
    level: parts.length,
    parts,
    parent: parts.length > 1 ? parts.slice(0, -1).join('.') : undefined
  };
}

/**
 * Check if one task depends on another (direct or transitive)
 */
export function hasDependency(task: Task | Subtask, targetId: string, allTasks: Map<string, Task | Subtask>): boolean {
  const visited = new Set<string>();
  
  function checkDeps(currentId: string): boolean {
    if (visited.has(currentId)) return false;
    visited.add(currentId);
    
    const current = allTasks.get(currentId);
    if (!current) return false;
    
    if (current.dependencies.includes(targetId)) return true;
    
    return current.dependencies.some(depId => checkDeps(depId));
  }
  
  return checkDeps(task.id);
}

/**
 * Helper for DFS traversal in circular dependency detection
 */
function dfsTraversal(
  id: string, 
  path: string[], 
  visited: Set<string>, 
  stack: Set<string>, 
  taskMap: Map<string, Task | Subtask>,
  cycles: string[]
): boolean {
  if (stack.has(id)) {
    const cycleStart = path.indexOf(id);
    const cycle = path.slice(cycleStart).concat(id);
    cycles.push(`Circular dependency: ${cycle.join(' -> ')}`);
    return true;
  }
  
  if (visited.has(id)) return false;
  
  visited.add(id);
  stack.add(id);
  
  const current = taskMap.get(id);
  if (current) {
    for (const depId of current.dependencies) {
      if (dfsTraversal(depId, [...path, id], visited, stack, taskMap, cycles)) {
        return true;
      }
    }
  }
  
  stack.delete(id);
  return false;
}

/**
 * Detect circular dependencies
 */
export function findCircularDependencies(tasks: Array<Task | Subtask>): string[] {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const cycles: string[] = [];
  
  for (const task of tasks) {
    const visited = new Set<string>();
    const stack = new Set<string>();
    dfsTraversal(task.id, [], visited, stack, taskMap, cycles);
  }
  
  // Remove duplicates
  const uniqueCycles: string[] = [];
  const seen = new Set<string>();
  for (const cycle of cycles) {
    if (!seen.has(cycle)) {
      seen.add(cycle);
      uniqueCycles.push(cycle);
    }
  }
  
  return uniqueCycles;
}