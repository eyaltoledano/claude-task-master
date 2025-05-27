/**
 * Core task-related types for claude-task-master
 */

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dependencies: string[];
  subtasks?: Subtask[];
  createdAt?: Date;
  updatedAt?: Date;
  completedAt?: Date;
  
  // Optional fields that may be added during processing
  complexity?: number;
  estimatedHours?: number;
  actualHours?: number;
  assignee?: string;
  tags?: string[];
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  description: string;
  status: TaskStatus;
  dependencies: string[];
  createdAt?: Date;
  updatedAt?: Date;
  completedAt?: Date;
}

export interface TasksFile {
  version: string;
  tasks: Task[];
  metadata?: {
    projectName?: string;
    createdAt: string;
    updatedAt: string;
    totalTasks: number;
    completedTasks: number;
  };
}