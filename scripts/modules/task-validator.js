import { z } from 'zod';
import { taskSchema, tasksFileSchema } from '../schemas/zod-schemas.js';

// Internal helper function to format a single Zod issue
function formatZodIssue(issue) {
  const path = issue.path.join('.') || 'root';
  // Zod messages are usually quite good (e.g., "Expected string, received number")
  // We can add more customization here if specific issue codes need more user-friendly messages.
  // For example:
  // if (issue.code === 'invalid_type') {
  //   return `Path: ${path} - Issue: Expected type '${issue.expected}', but received '${issue.received}'`;
  // }
  // if (issue.code === 'unrecognized_keys') {
  //    return `Path: ${path} - Issue: Unrecognized key(s) '${issue.keys.join(', ')}' found in object.`;
  // }
  return `Path: ${path} - Issue: ${issue.message}`;
}

/**
 * Formats a ZodError object into an array of user-friendly strings.
 * Each string represents a single validation issue.
 * @param {z.ZodError} zodError - The ZodError object.
 * @returns {string[] | null} An array of formatted error strings, or null if no issues.
 */
export function formatZodError(zodError) {
  if (!zodError || !zodError.issues || zodError.issues.length === 0) {
    return null;
  }
  return zodError.issues.map(issue => formatZodIssue(issue));
}

/**
 * Validates a task object against the taskSchema.
 * @param {object} taskObject - The task object to validate.
 * @returns {{ isValid: boolean, errors: string[] | null, data: object | null }} Validation result.
 *          `errors` is an array of formatted error strings if invalid.
 *          `data` is the parsed (and potentially transformed/defaulted) task data if valid.
 */
export function validateTask(taskObject) {
  const result = taskSchema.safeParse(taskObject);
  if (result.success) {
    return { isValid: true, errors: null, data: result.data };
  } else {
    return { isValid: false, errors: formatZodError(result.error), data: null };
  }
}

/**
 * Validates the entire tasks file content against the tasksFileSchema.
 * @param {object} tasksFileObject - The tasks file content (as a JavaScript object).
 * @returns {{ isValid: boolean, errors: string[] | null, data: object | null }} Validation result.
 */
export function validateTasksFile(tasksFileObject) {
  const result = tasksFileSchema.safeParse(tasksFileObject);
  if (result.success) {
    return { isValid: true, errors: null, data: result.data };
  } else {
    return { isValid: false, errors: formatZodError(result.error), data: null };
  }
}

/**
 * Validates an array of task objects.
 * @param {object[]} tasksArray - The array of task objects to validate.
 * @returns {{ isValid: boolean, errors: string[] | null, data: object[] | null }} Validation result.
 */
export function validateTasksArray(tasksArray) {
  const arraySchema = z.array(taskSchema);
  const result = arraySchema.safeParse(tasksArray);
  if (result.success) {
    return { isValid: true, errors: null, data: result.data };
  } else {
    return { isValid: false, errors: formatZodError(result.error), data: null };
  }
}
