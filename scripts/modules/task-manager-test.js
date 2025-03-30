import { readJSON, writeJSON, log } from './utils.js';

export async function addTask(tasksPath, title, description = title, dependencies = [], priority = 'medium') {
  // Handle placeholder API key case first
  if (process.env.ANTHROPIC_API_KEY === 'placeholder-api-key') {
    let data = { tasks: [] };
    try {
      data = readJSON(tasksPath) || { tasks: [] };
    } catch (err) {
      log('warn', `Creating new tasks file at ${tasksPath}`);
    }

    const newTaskId = data.tasks.length > 0 ? Math.max(...data.tasks.map(t => t.id)) + 1 : 1;
    
    const newTask = {
      id: newTaskId,
      title: title,
      description: description,
      status: 'pending',
      priority: priority,
      dependencies: dependencies,
      createdAt: new Date().toISOString()
    };
    
    data.tasks.push(newTask);
    writeJSON(tasksPath, data);
    log('success', `Created task #${newTaskId} (placeholder mode)`);
    return newTaskId;
  }

  throw new Error("Real API key required for AI-powered task creation");
}