// EXAMPLE 1: REFACTORING THE MOCK-BASED TEST PATTERN

// BEFORE: Testing a mock function, not the actual implementation
describe('Windsurf Rules File Handling - BEFORE', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-master-test-'));
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    jest.spyOn(fs, 'existsSync').mockImplementation(() => false);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (err) {
      console.error(`Error cleaning up: ${err.message}`);
    }
  });

  // Mock function that simulates the actual implementation
  function mockCopyTemplateFile(templateName, targetPath) {
    if (templateName === 'windsurfrules') {
      fs.writeFileSync(targetPath, 'New content');
    }
  }

  test('creates .windsurfrules when it does not exist', () => {
    // Arrange
    const targetPath = path.join(tempDir, '.windsurfrules');

    // Act - calling the mock function!
    mockCopyTemplateFile('windsurfrules', targetPath);

    // Assert
    expect(fs.writeFileSync).toHaveBeenCalledWith(targetPath, 'New content');
  });
});

// AFTER: Testing the actual implementation with proper dependency injection
// First, modify the implementation to support testing:
export function copyTemplateFile(templateName, targetPath, deps = { fs, path }) {
  const { fs, path } = deps;
  
  // Implementation with injectable dependencies
  if (templateName === 'windsurfrules') {
    const filename = path.basename(targetPath);
    
    if (filename === '.windsurfrules' && fs.existsSync(targetPath)) {
      const existingContent = fs.readFileSync(targetPath, 'utf8');
      const updatedContent = existingContent.trim() +
        '\n\n# Added by Claude Task Master - Development Workflow Rules\n\n' +
        'New content';
      fs.writeFileSync(targetPath, updatedContent);
      return;
    }
    
    fs.writeFileSync(targetPath, 'New content');
  }
}

// Then, test the actual implementation with controlled dependencies
describe('Windsurf Rules File Handling - AFTER', () => {
  // Using memfs for file system simulation
  import { fs as memfs, vol } from 'memfs';
  
  beforeEach(() => {
    // Reset the virtual file system
    vol.reset();
  });
  
  test('creates .windsurfrules when it does not exist', () => {
    // Arrange
    const targetPath = '/project/.windsurfrules';
    
    // Setup virtual file system state
    vol.fromJSON({
      '/project': null // Directory exists
    });
    
    // Act - call the actual implementation with memfs
    copyTemplateFile('windsurfrules', targetPath, { fs: memfs, path });
    
    // Assert - check the actual file was created in virtual fs
    expect(memfs.existsSync(targetPath)).toBe(true);
    expect(memfs.readFileSync(targetPath, 'utf8')).toBe('New content');
  });
  
  test('appends content to existing .windsurfrules', () => {
    // Arrange
    const targetPath = '/project/.windsurfrules';
    const existingContent = 'Existing windsurf rules content';
    
    // Setup virtual file system with existing file
    vol.fromJSON({
      '/project/.windsurfrules': existingContent
    });
    
    // Act - call the actual implementation with memfs
    copyTemplateFile('windsurfrules', targetPath, { fs: memfs, path });
    
    // Assert - check the file was updated correctly
    expect(memfs.existsSync(targetPath)).toBe(true);
    expect(memfs.readFileSync(targetPath, 'utf8')).toContain(existingContent);
    expect(memfs.readFileSync(targetPath, 'utf8')).toContain('Added by Claude Task Master');
  });
});

// EXAMPLE 2: REFACTORING THE TASKMASTER DIRECTORY TESTS

// BEFORE: Using unstable APIs and complex mocking
describe('Initialization Directory Structure (.taskmaster/) - BEFORE', () => {
  let tempDir;
  let mkdirSyncSpy;
  let writeFileSyncSpy;
  let existsSyncSpy;
  let readFileSyncSpy;

  // Complex unstable mocking setup
  jest.unstable_mockModule('path', () => ({
      ...jest.requireActual('path'),
      join: jest.fn((...args) => args.join('/')),
      resolve: jest.fn((...args) => args.join('/')),
      dirname: jest.fn((p) => p.substring(0, p.lastIndexOf('/')) || '/'),
      basename: jest.fn((p) => p.substring(p.lastIndexOf('/') + 1)),
  }));

  jest.unstable_mockModule('../../scripts/modules/utils.js', () => ({
      isSilentMode: jest.fn().mockReturnValue(true),
      log: jest.fn(),
  }));

  jest.unstable_mockModule('../../mcp-server/src/core/utils/path-utils.js', () => ({
      TASKMASTER_BASE_PATH: '.taskmaster/',
  }));

  let initializeProject;

  beforeAll(async () => {
      // Dynamically import after mocks
      const initModule = await import('../../scripts/init.js');
      initializeProject = initModule.initializeProject;
  });

  beforeEach(() => {
      jest.clearAllMocks();
      fs.__clearMock();
      mkdirSyncSpy = fs.mkdirSync;
      writeFileSyncSpy = fs.writeFileSync;
      existsSyncSpy = fs.existsSync;
      readFileSyncSpy = fs.readFileSync;
      tempDir = '/mock/init/target';
      process.cwd = jest.fn().mockReturnValue(tempDir);
      
      // Setup mock files
      const assetsDir = path.join(__dirname, '..', 'assets');
      const examplePrdSourcePath = path.join(assetsDir, 'example_prd.txt');
      fs.__setMockFiles({
          [examplePrdSourcePath]: 'Mock PRD Content'
      });
      fs.__setMockDirectories(['/', path.dirname(assetsDir), assetsDir]);
  });

  afterEach(() => {
      try {
          fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (err) {
          console.error(`Error cleaning up init test dir: ${err.message}`);
      }
      jest.restoreAllMocks();
  });

  test('should create .taskmaster/ directory during initialization', async () => {
      // Arrange: Ensure target directory exists in mock fs
      fs.__setMockDirectories(['/', '/mock', '/mock/init', tempDir]);

      // Act
      await initializeProject({ yes: true });

      // Assert based on mock internal state
      const expectedTaskmasterDir = path.join(tempDir, '.taskmaster/');
      expect(fs.__getMockDirectories()).toContain(expectedTaskmasterDir);
  });
});

// AFTER: Using proper integration testing approach
describe('Initialization Directory Structure (.taskmaster/) - AFTER', () => {
  let tempDir;
  
  beforeEach(async () => {
    // Create a real temporary directory for testing
    tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'taskmaster-test-')
    );
  });
  
  afterEach(async () => {
    // Clean up the temporary directory
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });
  
  test('should create .taskmaster directory during initialization', async () => {
    // Arrange - set up test environment
    const projectDir = path.join(tempDir, 'project');
    await fs.promises.mkdir(projectDir, { recursive: true });
    
    // Create a minimal package.json to simulate a project
    await fs.promises.writeFile(
      path.join(projectDir, 'package.json'),
      JSON.stringify({ name: "test-project" })
    );
    
    // Override process.cwd for the test
    const originalCwd = process.cwd;
    process.cwd = jest.fn().mockReturnValue(projectDir);
    
    try {
      // Act - run the real initialization function
      const { initializeProject } = require('../../scripts/init');
      await initializeProject({ yes: true, skipInstall: true });
      
      // Assert - check actual file system for expected directories
      const taskmasterDir = path.join(projectDir, '.taskmaster');
      const scriptsDir = path.join(taskmasterDir, 'scripts');
      const tasksDir = path.join(taskmasterDir, 'tasks');
      
      expect(fs.existsSync(taskmasterDir)).toBe(true);
      expect(fs.existsSync(scriptsDir)).toBe(true);
      expect(fs.existsSync(tasksDir)).toBe(true);
      
      // Check that example_prd.txt was copied
      expect(fs.existsSync(path.join(scriptsDir, 'example_prd.txt'))).toBe(true);
    } finally {
      // Restore original cwd
      process.cwd = originalCwd;
    }
  });
});

// EXAMPLE 3: E2E TEST FOR CLI COMMANDS

// Create a proper E2E test for the init command
describe('Task Master CLI E2E Tests', () => {
  let tempDir;
  
  beforeEach(async () => {
    // Create a real temporary directory for testing
    tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'taskmaster-e2e-')
    );
  });
  
  afterEach(async () => {
    // Clean up the temporary directory
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });
  
  // Helper function to execute CLI commands
  async function execCLI(args, options = {}) {
    const cliPath = path.resolve(__dirname, '../../bin/task-master.js');
    const cwd = options.cwd || tempDir;
    
    return new Promise((resolve) => {
      exec(`node ${cliPath} ${args.join(' ')}`, { cwd }, (error, stdout, stderr) => {
        resolve({
          exitCode: error ? error.code : 0,
          stdout,
          stderr
        });
      });
    });
  }
  
  test('init command should create .taskmaster directory structure', async () => {
    // Arrange - create an empty project directory
    const projectDir = path.join(tempDir, 'project');
    await fs.promises.mkdir(projectDir, { recursive: true });
    
    // Create a minimal package.json
    await fs.promises.writeFile(
      path.join(projectDir, 'package.json'),
      JSON.stringify({ name: "test-project" })
    );
    
    // Act - run the actual CLI command
    const result = await execCLI(['init', '--yes', '--skip-install'], { cwd: projectDir });
    
    // Assert - verify the command succeeded
    expect(result.exitCode).toBe(0);
    
    // Verify the directory structure was created
    const taskmasterDir = path.join(projectDir, '.taskmaster');
    const scriptsDir = path.join(taskmasterDir, 'scripts');
    const tasksDir = path.join(taskmasterDir, 'tasks');
    
    expect(fs.existsSync(taskmasterDir)).toBe(true);
    expect(fs.existsSync(scriptsDir)).toBe(true);
    expect(fs.existsSync(tasksDir)).toBe(true);
    
    // Verify example_prd.txt was copied
    expect(fs.existsSync(path.join(scriptsDir, 'example_prd.txt'))).toBe(true);
  });
  
  test('get-tasks command should read from .taskmaster directory', async () => {
    // Arrange - setup a project with task files
    const projectDir = path.join(tempDir, 'tasks-project');
    await fs.promises.mkdir(path.join(projectDir, '.taskmaster', 'tasks'), { recursive: true });
    
    // Create a tasks.json file
    const tasksData = {
      tasks: [
        { id: 1, title: "Task 1", status: "pending" },
        { id: 2, title: "Task 2", status: "done" }
      ]
    };
    
    await fs.promises.writeFile(
      path.join(projectDir, '.taskmaster', 'tasks', 'tasks.json'),
      JSON.stringify(tasksData, null, 2)
    );
    
    // Act - run the get-tasks command
    const result = await execCLI(['get-tasks'], { cwd: projectDir });
    
    // Assert - check the output includes the tasks
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Task 1');
    expect(result.stdout).toContain('Task 2');
    expect(result.stdout).toContain('pending');
    expect(result.stdout).toContain('done');
  });
});

// EXAMPLE 4: UNIT TEST WITH PROPER DEPENDENCY INJECTION

// First, modify the implementation to be testable:
// path-utils.js
export function findTasksJsonPath(args, log, deps = { fs, path }) {
  const { fs, path } = deps;
  const dirPath = args.projectRoot || process.cwd();
  
  // Default paths to check, including .taskmaster paths
  const possiblePaths = [
    path.join(dirPath, 'tasks.json'),
    path.join(dirPath, 'tasks', 'tasks.json'),
    path.join(dirPath, '.taskmaster', 'tasks.json'),
    path.join(dirPath, '.taskmaster', 'tasks', 'tasks.json')
  ];
  
  // Check each path
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      log.info(`Found tasks file at: ${filePath}`);
      return filePath;
    }
  }
  
  log.error('No tasks.json file found in common locations');
  throw new Error('Tasks file not found. Run "task-master init" to create a new project.');
}

// Now write a proper unit test:
describe('findTasksJsonPath - Unit Tests', () => {
  test('should find tasks.json in root directory', () => {
    // Arrange
    const mockFs = {
      existsSync: jest.fn(path => path === '/project/tasks.json')
    };
    
    const mockPath = {
      join: jest.fn((...args) => args.join('/'))
    };
    
    const mockLog = {
      info: jest.fn(),
      error: jest.fn()
    };
    
    const args = { projectRoot: '/project' };
    
    // Act
    const result = findTasksJsonPath(args, mockLog, { fs: mockFs, path: mockPath });
    
    // Assert
    expect(result).toBe('/project/tasks.json');
    expect(mockFs.existsSync).toHaveBeenCalledWith('/project/tasks.json');
    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining('/project/tasks.json'));
  });
  
  test('should find tasks.json in .taskmaster directory', () => {
    // Arrange
    const mockFs = {
      existsSync: jest.fn(path => path === '/project/.taskmaster/tasks.json')
    };
    
    const mockPath = {
      join: jest.fn((...args) => args.join('/'))
    };
    
    const mockLog = {
      info: jest.fn(),
      error: jest.fn()
    };
    
    const args = { projectRoot: '/project' };
    
    // Act
    const result = findTasksJsonPath(args, mockLog, { fs: mockFs, path: mockPath });
    
    // Assert
    expect(result).toBe('/project/.taskmaster/tasks.json');
    expect(mockFs.existsSync).toHaveBeenCalledWith('/project/.taskmaster/tasks.json');
    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining('/project/.taskmaster/tasks.json'));
  });
  
  test('should throw error when no tasks file found', () => {
    // Arrange
    const mockFs = {
      existsSync: jest.fn(() => false)
    };
    
    const mockPath = {
      join: jest.fn((...args) => args.join('/'))
    };
    
    const mockLog = {
      info: jest.fn(),
      error: jest.fn()
    };
    
    const args = { projectRoot: '/project' };
    
    // Act & Assert
    expect(() => {
      findTasksJsonPath(args, mockLog, { fs: mockFs, path: mockPath });
    }).toThrow('Tasks file not found');
    expect(mockLog.error).toHaveBeenCalled();
  });
});
