import { z } from 'zod';

// Forward declaration for the recursive task schema
let taskSchema;

const statusEnum = z.enum([
  "pending",
  "in-progress",
  "done",
  "review",
  "deferred",
  "cancelled"
]);

const priorityEnum = z.enum(["high", "medium", "low"]);

// Define the main task schema structure, initially without subtasks
const baseTaskSchema = z.object({
  id: z.number().int().positive('Task ID must be a positive integer'),
  title: z.string().min(1, 'Task title cannot be empty'),
  description: z.string(),
  status: statusEnum,
  dependencies: z.array(z.number().int()).default([]),
  priority: priorityEnum.default("medium"),
  details: z.string().optional(),
  testStrategy: z.string().optional(),
  previousStatus: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
  parentTaskId: z.number().int().positive('parentTaskId must be a positive integer').optional(),
  // subtasks will be added using z.lazy to handle recursion
});

// Define the task schema with recursive subtasks
taskSchema = baseTaskSchema.extend({
  subtasks: z.array(z.lazy(() => taskSchema)).default([])
});

const tagMetadataSchema = z.object({
  created: z.string().datetime({ message: "Invalid datetime string for 'created', expected ISO 8601 format" }),
  updated: z.string().datetime({ message: "Invalid datetime string for 'updated', expected ISO 8601 format" }),
  description: z.string()
});

const tagObjectSchema = z.object({
  tasks: z.array(taskSchema),
  metadata: tagMetadataSchema
});

// Schema for the entire tasks.json file (an object with tag names as keys)
const tasksFileSchema = z.record(z.string().min(1, 'Tag name cannot be empty'), tagObjectSchema);

export {
  taskSchema,
  tasksFileSchema,
  statusEnum, // Exporting enums might be useful for other parts of the application
  priorityEnum
};
