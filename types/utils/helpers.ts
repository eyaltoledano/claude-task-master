/**
 * TypeScript utility types and type guards
 */

import type { Task, Subtask } from '../models/task.js';

/**
 * Type guard to check if an object is a Task
 */
export function isTask(item: Task | Subtask): item is Task {
  return 'priority' in item;
}

/**
 * Type guard to check if an object is a Subtask
 */
export function isSubtask(item: Task | Subtask): item is Subtask {
  return 'taskId' in item && !('priority' in item);
}

/**
 * Type for functions that can be either sync or async
 */
export type MaybeAsync<T> = T | Promise<T>;

/**
 * Extract the resolved type from a Promise
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/**
 * Make specific properties optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make specific properties required
 */
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Create a Result success
 */
export function Ok<T>(data: T): Result<T> {
  return { success: true, data };
}

/**
 * Create a Result error
 */
export function Err<E = Error>(error: E): Result<never, E> {
  return { success: false, error };
}