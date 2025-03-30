import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('CLI Task Creation Integration Tests', () => {
  let cliPath;
  const tempTasksFile = path.join(__dirname, '../../fixtures/temp-tasks.json');
  
  beforeAll(async () => {
    cliPath = path.resolve(process.cwd(), 'bin/task-master.js');
    console.log('Resolved CLI Path:', cliPath);
  });

  beforeEach(() => {
    // Create a clean temp tasks file
    fs.writeFileSync(tempTasksFile, JSON.stringify({ meta: {}, tasks: [] }));
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(tempTasksFile)) {
      fs.unlinkSync(tempTasksFile);
    }
  });

  it('should create a new task with required fields', async function() {
    const title = 'Test Task';
    const description = 'Test Description';
    const priority = 'high';
    
    const absCliPath = path.resolve(process.cwd(), 'bin/task-master.js');
    const absTempFilePath = path.resolve(__dirname, '../../fixtures/temp-tasks.json');
    
    console.log('Current working directory:', process.cwd());
    console.log('Using CLI path:', './bin/task-master.js');
    // Escape spaces in paths for command execution
    const escapedCliPath = absCliPath.replace(/ /g, '\\ ');
    const escapedTempFilePath = absTempFilePath.replace(/ /g, '\\ ');
    
    const child = spawn(
      process.execPath,
      [
        '--experimental-vm-modules',
        escapedCliPath,
        'create',
        '--title', title,
        '--description', description,
        '--priority', priority,
        '--file', escapedTempFilePath
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_PATH: `"${path.join(process.cwd(), 'node_modules')}:${path.join(__dirname, '../../node_modules')}"`,
          NODE_OPTIONS: `--experimental-vm-modules --require "${path.join(process.cwd(), 'node_modules/dotenv/config')}"`
        },
        shell: true
      }
    );

    let output = '';
    let errorOutput = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    await new Promise((resolve, reject) => {
      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
        } else {
          resolve();
        }
      });
    });

    expect(output).toContain('Successfully created task');
    
    const tasksData = JSON.parse(fs.readFileSync(tempTasksFile));
    expect(tasksData.tasks).toHaveLength(1);
    expect(tasksData.tasks[0].title).toBe(title);
    expect(tasksData.tasks[0].description).toBe(description);
    expect(tasksData.tasks[0].priority).toBe(priority);
  });

  it('should fail when required fields are missing', () => {
    expect(() => {
      execSync('node ./bin/task-master.js create --file ./tests/fixtures/temp-tasks.json');
    }).toThrow();
  });
});