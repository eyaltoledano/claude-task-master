import {
  parsePRD,
  createTask,
  readTask,
  updateTask,
  deleteTask,
  listTasks,
  setTaskStatus,
  updateSingleTaskStatus,
  expandTask,
  expandAllTasks,
  addTask,
  findNextTask,
  analyzeTaskComplexity,
  Task
} from './index';

export function initTaskMaster() {
  return {
    'task-master.init': {
      command: 'task-master.init',
      title: 'Initialize Task Master',
      handler: () => {
        console.log('Task Master initialized');
        return {
          version: '1.0.0',
          status: 'ready'
        };
      }
    },
    'task-master.create': {
      command: 'task-master.create',
      title: 'Create Task',
      handler: (task: Task) => createTask(task)
    },
    'task-master.read': {
      command: 'task-master.read',
      title: 'Read Task',
      handler: (taskId: number) => readTask(taskId)
    },
    'task-master.update': {
      command: 'task-master.update',
      title: 'Update Task',
      handler: (task: Task) => updateTask(task)
    },
    'task-master.delete': {
      command: 'task-master.delete',
      title: 'Delete Task',
      handler: (taskId: number) => deleteTask(taskId)
    },
    'task-master.list': {
      command: 'task-master.list',
      title: 'List Tasks',
      handler: () => listTasks()
    },
    'task-master.set-status': {
      command: 'task-master.set-status',
      title: 'Set Task Status',
      handler: (taskId: number, status: 'pending' | 'in-progress' | 'done' | 'deferred') => 
        setTaskStatus(taskId, status)
    },
    'task-master.expand': {
      command: 'task-master.expand',
      title: 'Expand Task',
      handler: (taskId: number, numSubtasks: number = 3) => 
        expandTask(taskId, numSubtasks)
    },
    'task-master.expand-all': {
      command: 'task-master.expand-all',
      title: 'Expand All Tasks',
      handler: (numSubtasks: number = 3, useResearch: boolean = false) => 
        expandAllTasks(numSubtasks, useResearch)
    },
    'task-master.add': {
      command: 'task-master.add',
      title: 'Add Task',
      handler: (prompt: string, dependencies: number[] = [], priority: 'medium' | 'high' | 'low' = 'medium') => 
        addTask(prompt, dependencies, priority)
    },
    'task-master.next': {
      command: 'task-master.next',
      title: 'Find Next Task',
      handler: () => {
        return listTasks().then(tasks => {
          if (!tasks || !Array.isArray(tasks)) {
            throw new Error('No tasks available');
          }
          return findNextTask(tasks);
        });
      }
    },
    'task-master.analyze': {
      command: 'task-master.analyze',
      title: 'Analyze Task Complexity',
      handler: () => analyzeTaskComplexity()
    },
    'task-master.parse-prd': {
      command: 'task-master.parse-prd',
      title: 'Parse PRD',
      handler: (prdPath: string) => parsePRD(prdPath)
    }
  };
}