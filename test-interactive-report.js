#!/usr/bin/env node

/**
 * test-interactive-report.js
 * 
 * Test script to demonstrate the interactive report features in the terminal
 */

import { 
  renderInteractiveComplexityReport, 
  renderInteractiveTaskList 
} from './scripts/modules/markdown-renderer.js';
import inquirer from 'inquirer';
import chalk from 'chalk';

// Sample complexity report data for testing
const sampleComplexityReport = {
  metadata: {
    generatedAt: new Date().toISOString(),
    taskCount: 12,
    model: "claude-3-haiku-20240307"
  },
  complexityAnalysis: [
    {
      taskId: "1",
      taskTitle: "Set up project structure and dependencies",
      complexityScore: 3,
      recommendedSubtasks: 3,
      reasoning: "This is a standard setup task that involves creating directories, initializing configuration files, and adding basic dependencies. It's relatively straightforward for experienced developers.",
      expansionCommand: "task-master expand --id=1 --num=3"
    },
    {
      taskId: "2",
      taskTitle: "Implement core authentication system",
      complexityScore: 9,
      recommendedSubtasks: 5,
      reasoning: "Authentication implementation requires handling user credentials securely, implementing various authentication strategies (email/password, OAuth, etc.), managing session tokens, and handling edge cases like password resets and account recovery. This has security implications and requires careful testing.",
      expansionCommand: "task-master expand --id=2 --num=5 --research"
    },
    {
      taskId: "3",
      taskTitle: "Develop RESTful API endpoints",
      complexityScore: 6,
      recommendedSubtasks: 4,
      reasoning: "Creating RESTful endpoints involves designing request/response formats, implementing proper HTTP status code handling, input validation, error handling, and documentation. The complexity is moderate as the task requires careful API design but follows established patterns.",
      expansionCommand: "task-master expand --id=3 --num=4"
    },
    {
      taskId: "4", 
      taskTitle: "Build front-end UI components",
      complexityScore: 7,
      recommendedSubtasks: 5,
      reasoning: "UI components require implementation of responsive design, state management, user interactions, accessibility considerations, and cross-browser compatibility. The complexity comes from ensuring a consistent and user-friendly experience across different devices and browsers.",
      expansionCommand: "task-master expand --id=4 --num=5"
    },
    {
      taskId: "5",
      taskTitle: "Implement data visualization module",
      complexityScore: 8,
      recommendedSubtasks: 5,
      reasoning: "Data visualization requires processing complex datasets, implementing charting libraries, creating interactive visualizations, optimizing performance for large datasets, and ensuring accessibility. This is complex due to the need for both technical implementation and design considerations.",
      expansionCommand: "task-master expand --id=5 --num=5 --research"
    },
    {
      taskId: "6",
      taskTitle: "Add documentation",
      complexityScore: 4,
      recommendedSubtasks: 3,
      reasoning: "Documentation involves creating user guides, API documentation, and developer documentation. While comprehensive, this follows standard documentation practices.",
      expansionCommand: "task-master expand --id=6 --num=3"
    },
    {
      taskId: "7",
      taskTitle: "Implement search functionality",
      complexityScore: 7,
      recommendedSubtasks: 4,
      reasoning: "Search implementation requires indexing data, query parsing, relevance ranking, and performance optimization. The complexity comes from handling different search patterns and ensuring fast results.",
      expansionCommand: "task-master expand --id=7 --num=4"
    },
    {
      taskId: "8",
      taskTitle: "Configure and deploy to production",
      complexityScore: 6,
      recommendedSubtasks: 4,
      reasoning: "Deployment involves setting up CI/CD pipelines, configuring environments, implementing monitoring, and ensuring security. This requires coordination of various services and infrastructure components.",
      expansionCommand: "task-master expand --id=8 --num=4"
    },
    {
      taskId: "9",
      taskTitle: "Write automated tests",
      complexityScore: 5,
      recommendedSubtasks: 3,
      reasoning: "Testing involves setting up the test framework, writing unit tests, integration tests, and possibly end-to-end tests. This is moderately complex due to the need for comprehensive test coverage.",
      expansionCommand: "task-master expand --id=9 --num=3"
    },
    {
      taskId: "10",
      taskTitle: "Implement real-time notification system",
      complexityScore: 8,
      recommendedSubtasks: 5,
      reasoning: "Real-time notifications require setting up WebSockets, handling connection states, managing notification delivery and storage, and ensuring cross-device synchronization. This is complex due to the stateful nature of real-time connections and handling offline scenarios.",
      expansionCommand: "task-master expand --id=10 --num=5 --research"
    },
    {
      taskId: "11",
      taskTitle: "Setup basic error logging",
      complexityScore: 3,
      recommendedSubtasks: 2,
      reasoning: "Basic error logging involves configuring a logging library and setting up error handlers. This is a relatively straightforward task.",
      expansionCommand: "task-master expand --id=11 --num=2"
    },
    {
      taskId: "12",
      taskTitle: "Implement user profile management",
      complexityScore: 5,
      recommendedSubtasks: 3,
      reasoning: "User profile management involves creating profile edit forms, handling avatar uploads, managing privacy settings, and ensuring data validation. This is of moderate complexity.",
      expansionCommand: "task-master expand --id=12 --num=3"
    }
  ]
};

// Sample tasks data for testing task list
const sampleTasks = [
  {
    id: "1",
    title: "Set up project structure and dependencies",
    status: "done",
    priority: "high",
    description: "Create the initial project structure and install necessary dependencies.",
    details: "1. Initialize npm project with package.json\n2. Set up directory structure (src, tests, docs)\n3. Install core dependencies (express, react, etc.)\n4. Configure ESLint and Prettier\n5. Set up basic scripts in package.json",
    testStrategy: "Verify that the project structure is created and all dependencies can be installed correctly.",
    subtasks: [
      {
        id: 1,
        title: "Initialize npm project",
        status: "done",
        description: "Run npm init and create package.json with initial configuration."
      },
      {
        id: 2,
        title: "Set up directory structure",
        status: "done",
        description: "Create src, tests, and docs directories with placeholder files."
      },
      {
        id: 3,
        title: "Install dependencies",
        status: "done",
        description: "Install and configure all required dependencies."
      }
    ]
  },
  {
    id: "2",
    title: "Implement core authentication system",
    status: "in-progress",
    priority: "high",
    dependencies: ["1"],
    description: "Create authentication system with JWT tokens for session management.",
    details: "1. Set up user model in database\n2. Implement registration endpoint\n3. Implement login endpoint with JWT token generation\n4. Create middleware for JWT verification\n5. Implement password reset functionality",
    testStrategy: "Write unit tests for all authentication endpoints. Test with valid and invalid credentials. Verify token generation and validation.",
    subtasks: [
      {
        id: 1,
        title: "Set up user model",
        status: "done",
        description: "Create user schema with username, email, password fields."
      },
      {
        id: 2,
        title: "Implement registration endpoint",
        status: "done",
        description: "Create endpoint for user registration with validation."
      },
      {
        id: 3,
        title: "Implement login endpoint",
        status: "in-progress",
        description: "Create login endpoint with JWT token generation."
      },
      {
        id: 4,
        title: "Create middleware for JWT verification",
        status: "pending",
        description: "Implement middleware to verify JWT tokens."
      },
      {
        id: 5,
        title: "Implement password reset",
        status: "pending",
        description: "Create password reset functionality with email notification."
      }
    ]
  },
  {
    id: "3",
    title: "Develop RESTful API endpoints",
    status: "pending",
    priority: "medium",
    dependencies: ["1", "2"],
    description: "Implement RESTful API endpoints for core application functionality.",
    details: "1. Define API routes and controllers\n2. Implement CRUD operations for primary resources\n3. Add request validation\n4. Implement error handling\n5. Document API endpoints",
    testStrategy: "Create integration tests for each endpoint. Verify responses for valid and invalid requests.",
    subtasks: []
  },
  {
    id: "4",
    title: "Build front-end UI components",
    status: "pending",
    priority: "medium",
    dependencies: ["1"],
    description: "Create reusable UI components for the front-end application.",
    details: "1. Set up component library\n2. Create layout components\n3. Implement form components\n4. Design navigation elements\n5. Build data display components",
    testStrategy: "Write unit tests for components. Test rendering and interaction.",
    subtasks: []
  },
  {
    id: "5",
    title: "Implement data visualization module",
    status: "blocked",
    priority: "low",
    dependencies: ["3", "4"],
    description: "Create interactive data visualizations for analytics dashboard.",
    details: "1. Research charting libraries\n2. Implement data processing utilities\n3. Create chart components\n4. Add interactive features\n5. Optimize for performance",
    testStrategy: "Test with sample datasets. Verify rendering and interactivity.",
    subtasks: []
  }
];

/**
 * Simple interactive demo that allows users to switch between demos and interact with them
 */
async function runInteractiveDemo() {
  console.clear();
  console.log(chalk.bold.cyan('\n=== Interactive Report Demo ===\n'));
  console.log(chalk.yellow('This demo shows the new interactive reporting features in Task Master.\n'));
  
  // Define demo options
  const demoOptions = [
    {
      name: '1. Interactive Complexity Report',
      value: 'complexity'
    },
    {
      name: '2. Interactive Task List',
      value: 'tasks'
    },
    {
      name: '3. Task List (Grouped by Status)',
      value: 'grouped-tasks'
    },
    new inquirer.Separator(),
    {
      name: '4. Exit Demo',
      value: 'exit'
    }
  ];
  
  // Keep track of active reports to clean up properly
  let activeReport = null;
  
  // Keep the demo running until user chooses to exit
  let running = true;
  while (running) {
    // Clean up any active report
    if (activeReport) {
      activeReport.stop();
      activeReport = null;
    }
    
    console.clear();
    console.log(chalk.bold.cyan('\n=== Interactive Report Demo ===\n'));
    
    // Ask user which demo to run
    const { demoChoice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'demoChoice',
        message: 'Select a demo to run:',
        choices: demoOptions
      }
    ]);
    
    if (demoChoice === 'exit') {
      console.log(chalk.green('\nThanks for trying the interactive report demos!\n'));
      running = false;
      continue;
    }
    
    // Run selected demo
    switch (demoChoice) {
      case 'complexity':
        console.clear();
        console.log(chalk.cyan('\nLoading Interactive Complexity Report...\n'));
        activeReport = renderInteractiveComplexityReport(sampleComplexityReport);
        
        // Wait for user to press a key to return to menu
        await inquirer.prompt([
          {
            type: 'input',
            name: 'continue',
            message: 'Press Enter to return to demo menu...'
          }
        ]);
        break;
        
      case 'tasks':
        console.clear();
        console.log(chalk.cyan('\nLoading Interactive Task List...\n'));
        activeReport = renderInteractiveTaskList(sampleTasks, {
          showSubtasks: true,
          groupByStatus: false
        });
        
        // Wait for user to press a key to return to menu
        await inquirer.prompt([
          {
            type: 'input',
            name: 'continue',
            message: 'Press Enter to return to demo menu...'
          }
        ]);
        break;
        
      case 'grouped-tasks':
        console.clear();
        console.log(chalk.cyan('\nLoading Grouped Interactive Task List...\n'));
        activeReport = renderInteractiveTaskList(sampleTasks, {
          showSubtasks: true,
          groupByStatus: true
        });
        
        // Wait for user to press a key to return to menu
        await inquirer.prompt([
          {
            type: 'input',
            name: 'continue',
            message: 'Press Enter to return to demo menu...'
          }
        ]);
        break;
        
      default:
        console.log(chalk.red('\nInvalid demo option selected.\n'));
        break;
    }
  }
}

// Run the demo when executed directly
runInteractiveDemo().catch(error => {
  console.error('Error running interactive demo:', error);
  process.exit(1);
}); 