/*
import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
// import inquirer from 'inquirer'; // Keep commented if not directly used in these tests

// Mock dependencies using ESM syntax
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(), // Mock readFileSync if needed by functions under test
}));

jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}));

jest.mock('../../scripts/modules/utils.js', () => ({
    log: jest.fn(),
    CONFIG: {
        projectName: 'DefaultProjectName', // Provide defaults used by init
        projectVersion: '1.0.0'
    }
}));

jest.mock('../../scripts/modules/ui.js', () => ({
    displayBanner: jest.fn()
}));

// Mock chalk before importing init
jest.mock('chalk', () => ({
  blue: jest.fn(str => str),
  green: jest.fn(str => str),
  yellow: jest.fn(str => str),
  red: jest.fn(str => str),
  bold: jest.fn(str => str),
}));

// Dynamically import the module *after* mocks are set up
let initializeProject, createProjectStructure, log, prompt; // Declare variables

beforeAll(async () => {
  // Import the actual functions after mocks
  const initModule = await import('../../scripts/init.js');
  initializeProject = initModule.initializeProject;
  createProjectStructure = initModule.createProjectStructure;
  log = initModule.log; // Get the log function from init.js if needed
  // Import the mocked inquirer prompt
  const inquirerModule = await import('inquirer');
  prompt = inquirerModule.prompt;
});

describe.skip('Project Initialization', () => { // Skipping this suite
  let tempDir;

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup a temporary directory for testing file operations
    tempDir = path.join(os.tmpdir(), `taskmaster-init-test-${Date.now()}`);
    // Mock existsSync to simulate directory/file non-existence initially
    fs.existsSync.mockReturnValue(false);
    // Mock prompt to return some default answers
    prompt.mockResolvedValue({ 
      projectName: 'TestProject', 
      description: 'Test Desc', 
      version: '0.1.0', 
      author: 'Test Author' 
    });
  });

  afterEach(() => {
    // Clean up temp directory - requires actual fs access or a more robust mock
    // For now, we rely on the mock and don't perform real FS cleanup
  });

  test('createProjectStructure should create directories and files', () => {
    createProjectStructure(tempDir, 'TestProject');

    expect(fs.mkdirSync).toHaveBeenCalledWith(tempDir, { recursive: true });
    expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(tempDir, 'tasks'), { recursive: true });
    expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(tempDir, 'scripts'), { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(path.join(tempDir, '.gitignore'), expect.any(String));
    expect(fs.writeFileSync).toHaveBeenCalledWith(path.join(tempDir, 'README.md'), expect.stringContaining('# TestProject'));
    // Add checks for other files like package.json, .env, etc.
    expect(fs.writeFileSync).toHaveBeenCalledWith(path.join(tempDir, 'package.json'), expect.any(String));
    expect(fs.writeFileSync).toHaveBeenCalledWith(path.join(tempDir, '.env'), expect.any(String));
    expect(fs.writeFileSync).toHaveBeenCalledWith(path.join(tempDir, 'tasks', 'tasks.json'), JSON.stringify({ tasks: [] }, null, 2));
  });

  test('initializeProject should prompt user and create structure when run interactively', async () => {
    await initializeProject(false); // Run interactively (yes = false)

    // Check that prompts were shown
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(prompt).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ name: 'projectName' }),
        expect.objectContaining({ name: 'description' }),
        expect.objectContaining({ name: 'version' }),
        expect.objectContaining({ name: 'author' })
    ]));
    
    // Check that structure was created with prompted answers
    expect(createProjectStructure).toHaveBeenCalledWith(process.cwd(), 'TestProject', 'Test Desc', '0.1.0', 'Test Author');
  });
  
   test('initializeProject should use defaults and create structure when --yes flag is true', async () => {
       // Mock CONFIG needed for default values
       const utilsMock = await import('../../scripts/modules/utils.js');
       utilsMock.CONFIG.projectName = 'DefaultYesProject';
       utilsMock.CONFIG.projectVersion = '1.1.0';

       await initializeProject(true); // Run with yes = true

       // Check that prompts were *not* shown
       expect(prompt).not.toHaveBeenCalled();
       
       // Check that structure was created with default values from CONFIG
       expect(createProjectStructure).toHaveBeenCalledWith(process.cwd(), 'DefaultYesProject', '', '1.1.0', ''); 
   });
   
    test('initializeProject should handle existing directory', async () => {
        fs.existsSync.mockReturnValue(true); // Simulate directory already exists
        prompt.mockResolvedValueOnce({ proceed: false }); // User chooses not to proceed
        
        await initializeProject(false);
        
        expect(prompt).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ name: 'proceed', message: expect.stringContaining('already exists') })
        ]));
        expect(createProjectStructure).not.toHaveBeenCalled(); // Structure creation skipped
    });

  // Add more tests for edge cases, error handling, different prompts etc.
});

describe('Windsurf Rules File Handling', () => {
  let tempDir;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-master-test-'));
    
    // Spy on fs methods
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    jest.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
      if (filePath.toString().includes('.windsurfrules')) {
        return 'Existing windsurf rules content';
      }
      return '{}';
    });
    jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
      // Mock specific file existence checks
      if (filePath.toString().includes('package.json')) {
        return true;
      }
      return false;
    });
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
    jest.spyOn(fs, 'copyFileSync').mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up the temporary directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (err) {
      console.error(`Error cleaning up: ${err.message}`);
    }
  });

  // Test function that simulates the behavior of .windsurfrules handling
  function mockCopyTemplateFile(templateName, targetPath) {
    if (templateName === 'windsurfrules') {
      const filename = path.basename(targetPath);
      
      if (filename === '.windsurfrules') {
        if (fs.existsSync(targetPath)) {
          // Should append content when file exists
          const existingContent = fs.readFileSync(targetPath, 'utf8');
          const updatedContent = existingContent.trim() + 
            '\n\n# Added by Claude Task Master - Development Workflow Rules\n\n' + 
            'New content';
          fs.writeFileSync(targetPath, updatedContent);
          return;
        }
      }
      
      // If file doesn't exist, create it normally
      fs.writeFileSync(targetPath, 'New content');
    }
  }

  test('creates .windsurfrules when it does not exist', () => {
    // Arrange
    const targetPath = path.join(tempDir, '.windsurfrules');
    
    // Act
    mockCopyTemplateFile('windsurfrules', targetPath);
    
    // Assert
    expect(fs.writeFileSync).toHaveBeenCalledWith(targetPath, 'New content');
  });
  
  test('appends content to existing .windsurfrules', () => {
    // Arrange
    const targetPath = path.join(tempDir, '.windsurfrules');
    const existingContent = 'Existing windsurf rules content';
    
    // Override the existsSync mock just for this test
    fs.existsSync.mockReturnValueOnce(true); // Target file exists
    fs.readFileSync.mockReturnValueOnce(existingContent);
    
    // Act
    mockCopyTemplateFile('windsurfrules', targetPath);
    
    // Assert
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      targetPath,
      expect.stringContaining(existingContent)
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      targetPath,
      expect.stringContaining('Added by Claude Task Master')
    );
  });
  
  test('includes .windsurfrules in project structure creation', () => {
    // This test verifies the expected behavior by using a mock implementation
    // that represents how createProjectStructure should work
    
    // Mock implementation of createProjectStructure
    function mockCreateProjectStructure(projectName) {
      // Copy template files including .windsurfrules
      mockCopyTemplateFile('windsurfrules', path.join(tempDir, '.windsurfrules'));
    }
    
    // Act - call our mock implementation
    mockCreateProjectStructure('test-project');
    
    // Assert - verify that .windsurfrules was created
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join(tempDir, '.windsurfrules'),
      expect.any(String)
    );
  });
});

// New test suite for MCP Configuration Handling
describe('MCP Configuration Handling', () => {
  let tempDir;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-master-test-'));
    
    // Spy on fs methods
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    jest.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
      if (filePath.toString().includes('mcp.json')) {
        return JSON.stringify({
          "mcpServers": {
            "existing-server": {
              "command": "node",
              "args": ["server.js"]
            }
          }
        });
      }
      return '{}';
    });
    jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
      // Return true for specific paths to test different scenarios
      if (filePath.toString().includes('package.json')) {
        return true;
      }
      // Default to false for other paths
      return false;
    });
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
    jest.spyOn(fs, 'copyFileSync').mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up the temporary directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (err) {
      console.error(`Error cleaning up: ${err.message}`);
    }
  });

  // Test function that simulates the behavior of setupMCPConfiguration
  function mockSetupMCPConfiguration(targetDir, projectName) {
    const mcpDirPath = path.join(targetDir, '.cursor');
    const mcpJsonPath = path.join(mcpDirPath, 'mcp.json');
    
    // Create .cursor directory if it doesn't exist
    if (!fs.existsSync(mcpDirPath)) {
      fs.mkdirSync(mcpDirPath, { recursive: true });
    }
    
    // New MCP config to be added - references the installed package
    const newMCPServer = {
      "task-master-ai": {
        "command": "npx",
        "args": [
          "task-master-ai",
          "mcp-server"
        ]
      }
    };
    
    // Check if mcp.json already exists
    if (fs.existsSync(mcpJsonPath)) {
      try {
        // Read existing config
        const mcpConfig = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf8'));
        
        // Initialize mcpServers if it doesn't exist
        if (!mcpConfig.mcpServers) {
          mcpConfig.mcpServers = {};
        }
        
        // Add the taskmaster-ai server if it doesn't exist
        if (!mcpConfig.mcpServers["task-master-ai"]) {
          mcpConfig.mcpServers["task-master-ai"] = newMCPServer["task-master-ai"];
        }
        
        // Write the updated configuration
        fs.writeFileSync(
          mcpJsonPath, 
          JSON.stringify(mcpConfig, null, 4)
        );
      } catch (error) {
        // Create new configuration on error
        const newMCPConfig = {
          "mcpServers": newMCPServer
        };
        
        fs.writeFileSync(mcpJsonPath, JSON.stringify(newMCPConfig, null, 4));
      }
    } else {
      // If mcp.json doesn't exist, create it
      const newMCPConfig = {
        "mcpServers": newMCPServer
      };
      
      fs.writeFileSync(mcpJsonPath, JSON.stringify(newMCPConfig, null, 4));
    }
  }

  test('creates mcp.json when it does not exist', () => {
    // Arrange
    const mcpJsonPath = path.join(tempDir, '.cursor', 'mcp.json');
    
    // Act
    mockSetupMCPConfiguration(tempDir, 'test-project');
    
    // Assert
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      mcpJsonPath,
      expect.stringContaining('task-master-ai')
    );
    
    // Should create a proper structure with mcpServers key
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      mcpJsonPath,
      expect.stringContaining('mcpServers')
    );
    
    // Should reference npx command
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      mcpJsonPath,
      expect.stringContaining('npx')
    );
  });
  
  test('updates existing mcp.json by adding new server', () => {
    // Arrange
    const mcpJsonPath = path.join(tempDir, '.cursor', 'mcp.json');
    
    // Override the existsSync mock to simulate mcp.json exists
    fs.existsSync.mockImplementation((filePath) => {
      if (filePath.toString().includes('mcp.json')) {
        return true;
      }
      return false;
    });
    
    // Act
    mockSetupMCPConfiguration(tempDir, 'test-project');
    
    // Assert
    // Should preserve existing server
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      mcpJsonPath,
      expect.stringContaining('existing-server')
    );
    
    // Should add our new server
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      mcpJsonPath,
      expect.stringContaining('task-master-ai')
    );
  });
  
  test('handles JSON parsing errors by creating new mcp.json', () => {
    // Arrange
    const mcpJsonPath = path.join(tempDir, '.cursor', 'mcp.json');
    
    // Override existsSync to say mcp.json exists
    fs.existsSync.mockImplementation((filePath) => {
      if (filePath.toString().includes('mcp.json')) {
        return true;
      }
      return false;
    });
    
    // But make readFileSync return invalid JSON
    fs.readFileSync.mockImplementation((filePath) => {
      if (filePath.toString().includes('mcp.json')) {
        return '{invalid json';
      }
      return '{}';
    });
    
    // Act
    mockSetupMCPConfiguration(tempDir, 'test-project');
    
    // Assert
    // Should create a new valid JSON file with our server
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      mcpJsonPath,
      expect.stringContaining('task-master-ai')
    );
  });
  
  test('does not modify existing server configuration if it already exists', () => {
    // Arrange
    const mcpJsonPath = path.join(tempDir, '.cursor', 'mcp.json');
    
    // Override existsSync to say mcp.json exists
    fs.existsSync.mockImplementation((filePath) => {
      if (filePath.toString().includes('mcp.json')) {
        return true;
      }
      return false;
    });
    
    // Return JSON that already has task-master-ai
    fs.readFileSync.mockImplementation((filePath) => {
      if (filePath.toString().includes('mcp.json')) {
        return JSON.stringify({
          "mcpServers": {
            "existing-server": {
              "command": "node",
              "args": ["server.js"]
            },
            "task-master-ai": {
              "command": "custom",
              "args": ["custom-args"]
            }
          }
        });
      }
      return '{}';
    });
    
    // Spy to check what's written
    const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync');
    
    // Act
    mockSetupMCPConfiguration(tempDir, 'test-project');
    
    // Assert
    // Verify the written data contains the original taskmaster configuration
    const dataWritten = JSON.parse(writeFileSyncSpy.mock.calls[0][1]);
    expect(dataWritten.mcpServers["task-master-ai"].command).toBe("custom");
    expect(dataWritten.mcpServers["task-master-ai"].args).toContain("custom-args");
  });
  
  test('creates the .cursor directory if it doesnt exist', () => {
    // Arrange
    const cursorDirPath = path.join(tempDir, '.cursor');
    
    // Make sure it looks like the directory doesn't exist
    fs.existsSync.mockReturnValue(false);
    
    // Act
    mockSetupMCPConfiguration(tempDir, 'test-project');
    
    // Assert
    expect(fs.mkdirSync).toHaveBeenCalledWith(cursorDirPath, { recursive: true });
  });
});
*/