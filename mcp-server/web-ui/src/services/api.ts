// Basic types - ideally share these with the backend or generate them
export interface TaskSummary {
  id: string;
  title: string;
  status: string;
  priority: string;
  dependencies: string[] | string; // CLI output might be string, JSON should be array
}

export interface TaskDetail extends TaskSummary {
  description?: string;
  implementationDetails?: string;
  testStrategy?: string;
  subtasks?: any[]; // Define more strictly later
}

const API_BASE_URL = '/api'; // Use relative path

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
    throw new Error(errorData?.error || `HTTP error! status: ${response.status}`);
  }
  
  // First try to parse as JSON
  try {
    return await response.json() as Promise<T>;
  } catch (error) {
    // If JSON parsing fails, try to parse the text response
    const text = await response.text();
    
    // If the response is empty, return an empty result based on the expected type
    if (!text.trim()) {
      return (Array.isArray([] as unknown as T) ? [] : {}) as T;
    }
    
    // Try to extract JSON from the text response (in case it's wrapped in other text)
    try {
      // Look for JSON-like content in the text
      const jsonMatch = text.match(/\[.*\]|\{.*\}/s);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
    } catch (jsonError) {
      console.error('Failed to extract JSON from text response:', jsonError);
    }
    
    // If we're expecting an array, try to parse the text as a list of items
    if (Array.isArray([] as unknown as T)) {
      // Split by lines and filter out empty lines
      const lines = text.split('\n').filter(line => line.trim());
      
      // Try to extract task information from each line
      const tasks = lines.map(line => {
        // Example format: "1: Install backend deps (done) [high]"
        const match = line.match(/(\d+):\s+(.*?)\s+\((.*?)\)\s+\[(.*?)\]/);
        if (match) {
          const [, id, title, status, priority] = match;
          return {
            id,
            title,
            status,
            priority,
            dependencies: [] // Can't easily extract from this format
          } as unknown as T;
        }
        return null;
      }).filter(Boolean);
      
      if (tasks.length > 0) {
        return tasks as unknown as T;
      }
    }
    
    // If all parsing attempts fail, throw an error
    throw new Error(`Failed to parse response: ${text}`);
  }
}

export async function getTasks(status?: string): Promise<TaskSummary[]> {
  console.log('Attempting to fetch tasks directly from tasks.json');
  try {
    // Fetch tasks.json directly relative to the public directory
    // Assuming tasks.json is copied or linked to the public folder during build/dev
    const response = await fetch('/tasks.json');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}, Failed to fetch /tasks.json`);
    }
    
    const data = await response.json();
    
    if (!data.tasks || !Array.isArray(data.tasks)) {
      throw new Error('Invalid tasks.json format - tasks array not found');
    }
    
    console.log(`Successfully loaded ${data.tasks.length} tasks from tasks.json`);
    
    // Convert tasks to the required format for the dashboard
    let tasks: TaskSummary[] = data.tasks.map((task: any) => ({
      id: String(task.id),
      title: task.title,
      status: task.status,
      priority: task.priority,
      dependencies: task.dependencies ? task.dependencies.map(String) : []
    }));
    
    // Apply status filter if provided
    if (status) {
      tasks = tasks.filter(task => task.status === status);
    }
    
    return tasks;
    
  } catch (error) {
    console.error('Error fetching or parsing tasks.json:', error);
    // Return empty array if fetching/parsing fails
    return [];
  }
}

export async function getTaskById(id: string): Promise<TaskDetail | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`);
    
    // Handle 404 case
    if (response.status === 404) {
      console.warn(`Task with ID ${id} not found`);
      return null;
    }
    
    console.debug(`Fetch /api/tasks/${id} status:`, response.status);
    
    return await handleResponse<TaskDetail>(response);
  } catch (error) {
    console.error(`Error fetching task ${id}:`, error);
    
    // For development/fallback, return a placeholder task
    // In a production environment, you might want to rethrow the error
    console.warn(`Falling back to placeholder task data for ID ${id}`);
    
    // Return a placeholder task based on the ID
    const placeholderTasks = await getTasks();
    const task = placeholderTasks.find(t => t.id === id);
    
    if (task) {
      return {
        ...task,
        description: `Description for task ${id}`,
        implementationDetails: `Implementation details for task ${id}`,
        testStrategy: `Test strategy for task ${id}`
      };
    }
    
    return null;
  }
}

// Add functions for other endpoints (next, setStatus) later