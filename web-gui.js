import express from 'express';
import listTasks from './scripts/modules/task-manager/list-tasks.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
const port = 3000;

app.get('/api/tasks', async (req, res) => {
  try {
    const tasksData = await listTasks(
      'tasks/tasks.json',
      null, // statusFilter
      'scripts/task-complexity-report.json', // reportPath
      true, // withSubtasks
      'json' // outputFormat
    );
    res.status(200).json(tasksData);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      error: 'Failed to fetch tasks',
      details: error.message
    });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
