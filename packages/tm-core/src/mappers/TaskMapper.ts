import { Task, Subtask } from '../types/index.js'
import { Database, Tables } from '../types/database.types.js'

type TaskRow = Tables<'tasks'>
type DependencyRow = Tables<'task_dependencies'>

export class TaskMapper {
  /**
   * Maps database tasks to internal Task format
   */
  static mapDatabaseTasksToTasks(
    dbTasks: TaskRow[],
    dbDependencies: DependencyRow[]
  ): Task[] {
    if (!dbTasks || dbTasks.length === 0) {
      return []
    }

    // Group dependencies by task_id
    const dependenciesByTaskId = this.groupDependenciesByTaskId(dbDependencies)

    // Separate parent tasks and subtasks
    const parentTasks = dbTasks.filter(t => !t.parent_task_id)
    const subtasksByParentId = this.groupSubtasksByParentId(dbTasks)

    // Map parent tasks with their subtasks
    return parentTasks.map(taskRow => 
      this.mapDatabaseTaskToTask(
        taskRow, 
        subtasksByParentId.get(taskRow.id) || [],
        dependenciesByTaskId
      )
    )
  }

  /**
   * Maps a single database task to internal Task format
   */
  static mapDatabaseTaskToTask(
    dbTask: TaskRow, 
    dbSubtasks: TaskRow[],
    dependenciesByTaskId: Map<string, string[]>
  ): Task {
    // Map subtasks
    const subtasks: Subtask[] = dbSubtasks.map((subtask, index) => ({
      id: index + 1, // Use numeric ID for subtasks
      parentId: dbTask.id,
      title: subtask.title,
      description: subtask.description || '',
      status: this.mapStatus(subtask.status),
      priority: this.mapPriority(subtask.priority),
      dependencies: dependenciesByTaskId.get(subtask.id) || [],
      details: (subtask.metadata as any)?.details || '',
      testStrategy: (subtask.metadata as any)?.testStrategy || '',
      createdAt: subtask.created_at,
      updatedAt: subtask.updated_at,
      assignee: subtask.assignee_id || undefined,
      complexity: subtask.complexity ? this.mapComplexityToInternal(subtask.complexity) : undefined
    }))

    return {
      id: dbTask.display_id || dbTask.id, // Use display_id if available
      title: dbTask.title,
      description: dbTask.description || '',
      status: this.mapStatus(dbTask.status),
      priority: this.mapPriority(dbTask.priority),
      dependencies: dependenciesByTaskId.get(dbTask.id) || [],
      details: (dbTask.metadata as any)?.details || '',
      testStrategy: (dbTask.metadata as any)?.testStrategy || '',
      subtasks,
      createdAt: dbTask.created_at,
      updatedAt: dbTask.updated_at,
      assignee: dbTask.assignee_id || undefined,
      complexity: dbTask.complexity ? this.mapComplexityToInternal(dbTask.complexity) : undefined,
      effort: dbTask.estimated_hours || undefined,
      actualEffort: dbTask.actual_hours || undefined
    }
  }

  /**
   * Groups dependencies by task ID
   */
  private static groupDependenciesByTaskId(
    dependencies: DependencyRow[]
  ): Map<string, string[]> {
    const dependenciesByTaskId = new Map<string, string[]>()
    
    if (dependencies) {
      for (const dep of dependencies) {
        const deps = dependenciesByTaskId.get(dep.task_id) || []
        deps.push(dep.depends_on_task_id)
        dependenciesByTaskId.set(dep.task_id, deps)
      }
    }
    
    return dependenciesByTaskId
  }

  /**
   * Groups subtasks by their parent ID
   */
  private static groupSubtasksByParentId(
    tasks: TaskRow[]
  ): Map<string, TaskRow[]> {
    const subtasksByParentId = new Map<string, TaskRow[]>()
    
    for (const task of tasks) {
      if (task.parent_task_id) {
        const subtasks = subtasksByParentId.get(task.parent_task_id) || []
        subtasks.push(task)
        subtasksByParentId.set(task.parent_task_id, subtasks)
      }
    }

    // Sort subtasks by subtask_position for each parent
    for (const subtasks of subtasksByParentId.values()) {
      subtasks.sort((a, b) => a.subtask_position - b.subtask_position)
    }
    
    return subtasksByParentId
  }

  /**
   * Maps database status to internal status
   */
  private static mapStatus(status: Database['public']['Enums']['task_status']): Task['status'] {
    switch (status) {
      case 'todo': return 'pending'
      case 'in_progress': return 'in-progress'
      case 'done': return 'done'
      default: return 'pending'
    }
  }

  /**
   * Maps database priority to internal priority
   */
  private static mapPriority(priority: Database['public']['Enums']['task_priority']): Task['priority'] {
    switch (priority) {
      case 'urgent': return 'critical'
      default: return priority as Task['priority']
    }
  }

  /**
   * Maps numeric complexity to descriptive complexity
   */
  private static mapComplexityToInternal(complexity: number): Task['complexity'] {
    if (complexity <= 2) return 'simple'
    if (complexity <= 5) return 'moderate'
    if (complexity <= 8) return 'complex'
    return 'very-complex'
  }
}