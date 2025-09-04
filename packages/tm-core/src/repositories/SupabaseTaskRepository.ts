import { SupabaseClient } from '@supabase/supabase-js'
import { Task } from '../types/index.js'
import { Database } from '../types/database.types.js'
import { TaskMapper } from '../mappers/TaskMapper.js'

export class SupabaseTaskRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async getTasks(accountId: string): Promise<Task[]> {
    // Get all tasks for the account
    const { data: tasksData, error: tasksError } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('account_id', accountId)
      .order('position', { ascending: true })

    if (tasksError) {
      throw new Error(`Failed to fetch tasks: ${tasksError.message}`)
    }

    if (!tasksData || tasksData.length === 0) {
      return []
    }

    // Get all dependencies for these tasks
    const taskIds = tasksData.map(t => t.id)
    const { data: depsData, error: depsError } = await this.supabase
      .from('task_dependencies')
      .select('*')
      .eq('account_id', accountId)
      .in('task_id', taskIds)

    if (depsError) {
      throw new Error(`Failed to fetch task dependencies: ${depsError.message}`)
    }

    // Use mapper to convert to internal format
    return TaskMapper.mapDatabaseTasksToTasks(tasksData, depsData || [])
  }

  async getTask(accountId: string, taskId: string): Promise<Task | null> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('account_id', accountId)
      .eq('id', taskId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      throw new Error(`Failed to fetch task: ${error.message}`)
    }

    // Get dependencies for this task
    const { data: depsData } = await this.supabase
      .from('task_dependencies')
      .select('*')
      .eq('task_id', taskId)

    // Get subtasks if this is a parent task
    const { data: subtasksData } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('parent_task_id', taskId)
      .order('subtask_position', { ascending: true })

    // Create dependency map
    const dependenciesByTaskId = new Map<string, string[]>()
    if (depsData) {
      dependenciesByTaskId.set(taskId, depsData.map(d => d.depends_on_task_id))
    }

    // Use mapper to convert single task
    return TaskMapper.mapDatabaseTaskToTask(data, subtasksData || [], dependenciesByTaskId)
  }
}