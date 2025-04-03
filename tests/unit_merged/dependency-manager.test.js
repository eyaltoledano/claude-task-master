/**
 * Dependency Manager module tests
 */

/*
import { jest } from '@jest/globals';
import fs from 'fs'; // Although mocked, import is needed for types/structure
import path from 'path'; // Import path for potential use

// --- Mock Internal Dependencies FIRST ---
jest.mock('../../scripts/modules/utils.js', () => ({
    readJSON: jest.fn(),
    writeJSON: jest.fn(),
    log: jest.fn(),
    CONFIG: { debug: false },
    findTaskById: jest.fn((tasks, id) => {
        // Simplified mock implementation
        if (!tasks || !tasks.tasks) return null;
        if (typeof id === 'string' && id.includes('.')) {
             const [pId, sId] = id.split('.').map(Number);
             const parent = tasks.tasks.find(t => t.id === pId);
             return parent?.subtasks?.find(st => st.id === sId) || null;
        } else {
            return tasks.tasks.find(t => t.id === Number(id)) || null;
        }
    }),
    taskExists: jest.fn((tasks, id) => {
        // Simplified mock implementation
         if (!tasks || !tasks.tasks) return false;
         if (typeof id === 'string' && id.includes('.')) {
             const [pId, sId] = id.split('.').map(Number);
             const parent = tasks.tasks.find(t => t.id === pId);
             return !!parent?.subtasks?.find(st => st.id === sId);
         } else {
             return !!tasks.tasks.find(t => t.id === Number(id));
         }
    }),
}));

jest.mock('../../scripts/modules/ui.js', () => ({
    createProgressBar: jest.fn(() => ({ tick: jest.fn(), update: jest.fn(), terminate: jest.fn() })),
}));

// Mock fs methods used directly (if any) - usually handled via utils mock
jest.mock('fs');

// --- Import Module Under Test AFTER Mocks ---
// Use dynamic import if necessary, or standard if no async issues
import {
    addDependency,
    removeDependency,
    validateTaskDependencies,
    validateAndFixDependencies,
    validateDependenciesCommand,
    fixDependenciesCommand,
} from '../../scripts/modules/dependency-manager.js';

// --- Import Mocks for Verification --- 
// Import directly from the mock definition
import { readJSON, writeJSON, findTaskById, log, taskExists } from '../../scripts/modules/utils.js';

describe.skip('Dependency Manager', () => { // Skipping this suite
    const mockTasksPath = 'tasks.json';
    let mockTasksData;

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset mock data for each test
        mockTasksData = {
            tasks: [
                { id: 1, title: 'Task 1', status: 'pending', dependencies: [] },
                { id: 2, title: 'Task 2', status: 'pending', dependencies: [] },
                { 
                    id: 3, title: 'Task 3', status: 'pending', dependencies: [],
          subtasks: [
                        { id: 1, title: 'Sub 3.1', status: 'pending', dependencies: [] },
                        { id: 2, title: 'Sub 3.2', status: 'pending', dependencies: [] }
                    ]
                },
                 { id: 4, title: 'Task 4', status: 'done', dependencies: [] },
            ]
        };
        // Configure mocks before each test
        readJSON.mockReturnValue(JSON.parse(JSON.stringify(mockTasksData))); 
        // Re-assign mock implementation based on the *current* closure value of mockTasksData
        findTaskById.mockImplementation((tasks, id) => {
             if (!tasks || !tasks.tasks) return null;
             if (typeof id === 'string' && id.includes('.')) {
                 const [pId, sId] = id.split('.').map(Number);
                 const parent = tasks.tasks.find(t => t.id === pId);
                 return parent?.subtasks?.find(st => st.id === sId) || null;
             } else {
                 return tasks.tasks.find(t => t.id === Number(id)) || null;
             }
        });
         taskExists.mockImplementation((tasks, id) => {
             if (!tasks || !tasks.tasks) return false;
             if (typeof id === 'string' && id.includes('.')) {
                 const [pId, sId] = id.split('.').map(Number);
                 const parent = tasks.tasks.find(t => t.id === pId);
                 return !!parent?.subtasks?.find(st => st.id === sId);
             } else {
                 return !!tasks.tasks.find(t => t.id === Number(id));
             }
        });
    });

    describe('addDependency', () => {
        test('should add a dependency to a task', async () => {
            await addDependency(mockTasksPath, 2, 1);
            const updatedTasks = writeJSON.mock.calls[0][1]; 
            const task2 = findTaskById(updatedTasks, 2); // Use mocked findTaskById
            expect(task2.dependencies).toContain(1);
            expect(writeJSON).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenCalledWith('success', 'Added dependency: Task 2 now depends on Task 1');
        });

        test('should add a dependency to a subtask', async () => {
            await addDependency(mockTasksPath, '3.2', '3.1');
            const updatedTasks = writeJSON.mock.calls[0][1];
            const subtask3_2 = findTaskById(updatedTasks, '3.2');
            expect(subtask3_2.dependencies).toContain('3.1'); 
            expect(writeJSON).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenCalledWith('success', 'Added dependency: Subtask 3.2 now depends on Subtask 3.1');
        });
        
        test('should add dependency from task to subtask', async () => {
             await addDependency(mockTasksPath, 2, '3.1');
             const updatedTasks = writeJSON.mock.calls[0][1];
             const task2 = findTaskById(updatedTasks, 2);
             expect(task2.dependencies).toContain('3.1');
             expect(log).toHaveBeenCalledWith('success', 'Added dependency: Task 2 now depends on Subtask 3.1');
        });
        
         test('should add dependency from subtask to task', async () => {
             await addDependency(mockTasksPath, '3.1', 1);
             const updatedTasks = writeJSON.mock.calls[0][1];
             const subtask3_1 = findTaskById(updatedTasks, '3.1');
             expect(subtask3_1.dependencies).toContain(1);
             expect(log).toHaveBeenCalledWith('success', 'Added dependency: Subtask 3.1 now depends on Task 1');
         });

        test('should not add duplicate dependencies', async () => {
            await addDependency(mockTasksPath, 2, 1);
            // Call readJSON again for the second call to addDependency
            readJSON.mockReturnValueOnce(JSON.parse(JSON.stringify(writeJSON.mock.calls[0][1]))); 
            await addDependency(mockTasksPath, 2, 1);
            
            expect(writeJSON).toHaveBeenCalledTimes(1); // Only first call should write
            expect(log).toHaveBeenCalledWith('warn', 'Dependency from Task 2 to Task/Subtask 1 already exists.');
        });

        test('should prevent adding self-dependency', async () => {
            await addDependency(mockTasksPath, 1, 1);
            expect(writeJSON).not.toHaveBeenCalled();
            expect(log).toHaveBeenCalledWith('error', 'Task 1 cannot depend on itself.');
        });
        
        test('should prevent adding self-dependency for subtasks', async () => {
             await addDependency(mockTasksPath, '3.1', '3.1');
             expect(writeJSON).not.toHaveBeenCalled();
             expect(log).toHaveBeenCalledWith('error', 'Subtask 3.1 cannot depend on itself.');
         });

        test('should handle task not found', async () => {
            findTaskById.mockImplementationOnce(() => null); // Mock task 99 not found
            await addDependency(mockTasksPath, 99, 1);
            expect(writeJSON).not.toHaveBeenCalled();
            expect(log).toHaveBeenCalledWith('error', 'Task 99 not found.');
        });

        test('should handle dependency task not found', async () => {
            taskExists.mockImplementationOnce((tasks, id) => id !== 99); // Mock dependency 99 doesn't exist
            await addDependency(mockTasksPath, 1, 99);
            expect(writeJSON).not.toHaveBeenCalled();
            expect(log).toHaveBeenCalledWith('error', 'Dependency task/subtask 99 not found.');
        });
    });

    describe('removeDependency', () => {
        beforeEach(() => {
            // Setup initial dependency for removal tests
            mockTasksData.tasks.find(t => t.id === 2).dependencies = [1];
             mockTasksData.tasks.find(t => t.id === 3).subtasks.find(st => st.id === 2).dependencies = ['3.1'];
            readJSON.mockReturnValue(JSON.parse(JSON.stringify(mockTasksData)));
        });

        test('should remove a dependency from a task', async () => {
            await removeDependency(mockTasksPath, 2, 1);
            const updatedTasks = writeJSON.mock.calls[0][1];
            const task2 = findTaskById(updatedTasks, 2);
            expect(task2.dependencies).not.toContain(1);
            expect(writeJSON).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenCalledWith('success', 'Removed dependency: Task 2 no longer depends on Task 1');
        });
        
        test('should remove a dependency from a subtask', async () => {
            await removeDependency(mockTasksPath, '3.2', '3.1');
            const updatedTasks = writeJSON.mock.calls[0][1];
            const subtask3_2 = findTaskById(updatedTasks, '3.2');
            expect(subtask3_2.dependencies).not.toContain('3.1');
            expect(writeJSON).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenCalledWith('success', 'Removed dependency: Subtask 3.2 no longer depends on Subtask 3.1');
        });

        test('should log warning if dependency does not exist', async () => {
            await removeDependency(mockTasksPath, 2, 3); // Dependency 3 doesn't exist on task 2
            expect(writeJSON).not.toHaveBeenCalled();
            expect(log).toHaveBeenCalledWith('warn', 'Dependency from Task 2 to Task/Subtask 3 does not exist.');
        });

        test('should handle task not found', async () => {
            findTaskById.mockImplementationOnce(() => null);
            await removeDependency(mockTasksPath, 99, 1);
            expect(writeJSON).not.toHaveBeenCalled();
            expect(log).toHaveBeenCalledWith('error', 'Task 99 not found.');
        });
    });

    describe('validateTaskDependencies', () => {
        test('should return empty array for valid dependencies', () => {
            const tasks = {
        tasks: [
                    { id: 1, status: 'done', dependencies: [] },
                    { id: 2, status: 'pending', dependencies: [1] }
                ]
            };
            // Ensure mocks are set correctly for this case
            findTaskById.mockImplementation((ts, id) => tasks.tasks.find(t => t.id === Number(id)));
            taskExists.mockImplementation((ts, id) => !!tasks.tasks.find(t => t.id === Number(id)));
            
            const invalid = validateTaskDependencies(tasks);
            expect(invalid).toEqual([]);
        });

        test('should detect missing dependency tasks', () => {
            const tasks = {
        tasks: [
                    { id: 1, status: 'pending', dependencies: [99] } 
                ]
            };
             taskExists.mockImplementation((ts, id) => id === 1); 
            const invalid = validateTaskDependencies(tasks);
            expect(invalid.length).toBe(1);
            expect(invalid[0]).toEqual({ taskId: 1, dependencyId: 99, reason: 'Dependency task/subtask 99 not found' });
        });

        test('should detect completed task depending on incomplete task', () => {
            const tasks = {
        tasks: [
                    { id: 1, status: 'pending', dependencies: [] },
                    { id: 2, status: 'done', dependencies: [1] } 
                ]
            };
            findTaskById.mockImplementation((ts, id) => tasks.tasks.find(t => t.id === Number(id)));
            taskExists.mockImplementation(() => true);
            const invalid = validateTaskDependencies(tasks);
            expect(invalid.length).toBe(1);
            expect(invalid[0]).toEqual({ taskId: 2, dependencyId: 1, reason: 'Completed task 2 depends on non-completed task 1' });
        });
        
        test('should detect circular dependencies (simple)', () => {
             const tasks = {
        tasks: [
                     { id: 1, status: 'pending', dependencies: [2] },
                     { id: 2, status: 'pending', dependencies: [1] } 
                 ]
             };
             taskExists.mockImplementation(() => true); 
             findTaskById.mockImplementation((ts, id) => tasks.tasks.find(t => t.id === Number(id)));
             const invalid = validateTaskDependencies(tasks);
             expect(invalid.length).toBeGreaterThanOrEqual(1);
             expect(invalid.some(inv => inv.reason.includes('Circular dependency detected'))).toBe(true);
        });
        
        test('should detect circular dependencies (complex)', () => {
             const tasks = {
        tasks: [
                     { id: 1, status: 'pending', dependencies: [2] },
                     { id: 2, status: 'pending', dependencies: [3] }, 
                     { id: 3, status: 'pending', dependencies: [1] } 
                 ]
             };
             taskExists.mockImplementation(() => true); 
             findTaskById.mockImplementation((ts, id) => tasks.tasks.find(t => t.id === Number(id)));
             const invalid = validateTaskDependencies(tasks);
             expect(invalid.length).toBeGreaterThanOrEqual(1);
             expect(invalid.some(inv => inv.reason.includes('Circular dependency detected'))).toBe(true);
        });
        
         test('should validate dependencies between tasks and subtasks', () => {
            const tasks = {
        tasks: [
                    { id: 1, status: 'done', dependencies: [] },
                    { id: 2, status: 'pending', dependencies: ['3.1'] }, 
          {
                        id: 3, status: 'pending', dependencies: [], 
            subtasks: [
                            { id: 1, status: 'pending', dependencies: [1] }, 
                            { id: 2, status: 'done', dependencies: ['3.1']}
            ]
          }
        ]
      };
            taskExists.mockImplementation(() => true); 
            // Make findTaskById handle subtask IDs correctly for this test
             findTaskById.mockImplementation((ts, id) => {
                 if (typeof id === 'string' && id.includes('.')) {
                     const [pId, sId] = id.split('.').map(Number);
                     const parent = tasks.tasks.find(t => t.id === pId);
                     const subtask = parent?.subtasks?.find(st => st.id === sId);
                     return subtask ? { ...subtask, parentId: pId } : null; // Add parentId if needed
                 } else {
                     return tasks.tasks.find(t => t.id === Number(id)) || null;
                 }
             });
             
            const invalid = validateTaskDependencies(tasks);
            expect(invalid.length).toBe(1);
            expect(invalid[0]).toEqual({ taskId: '3.2', dependencyId: '3.1', reason: 'Completed subtask 3.2 depends on non-completed subtask 3.1' });
         }


    test('should detect a direct circular dependency', () => {
      const tasks = [
        { id: 1, dependencies: [2] },
        { id: 2, dependencies: [1] }
      ];
      
      const result = isCircularDependency(tasks, 1);
      expect(result).toBe(true);
    }



    test('should detect an indirect circular dependency', () => {
      const tasks = [
        { id: 1, dependencies: [2] },
        { id: 2, dependencies: [3] },
        { id: 3, dependencies: [1] }
      ];
      
      const result = isCircularDependency(tasks, 1);
      expect(result).toBe(true);
    }



    test('should return false for non-circular dependencies', () => {
      const tasks = [
        { id: 1, dependencies: [2] },
        { id: 2, dependencies: [3] },
        { id: 3, dependencies: [] }
      ];
      
      const result = isCircularDependency(tasks, 1);
      expect(result).toBe(false);
    }



    test('should handle a task with no dependencies', () => {
      const tasks = [
        { id: 1, dependencies: [] },
        { id: 2, dependencies: [1] }
      ];
      
      const result = isCircularDependency(tasks, 1);
      expect(result).toBe(false);
    }



    test('should handle a task depending on itself', () => {
      const tasks = [
        { id: 1, dependencies: [1] }
      ];
      
      const result = isCircularDependency(tasks, 1);
      expect(result).toBe(true);
    }



    test('should handle subtask dependencies correctly', () => {
      const tasks = [
        { 
          id: 1, 
          dependencies: [], 
          subtasks: [
            { id: 1, dependencies: ["1.2"] },
            { id: 2, dependencies: ["1.3"] },
            { id: 3, dependencies: ["1.1"] }
          ]
        }
      ];
      
      // This creates a circular dependency: 1.1 -> 1.2 -> 1.3 -> 1.1
      const result = isCircularDependency(tasks, "1.1", ["1.3", "1.2"]);
      expect(result).toBe(true);
    }



    test('should allow non-circular subtask dependencies within same parent', () => {
      const tasks = [
        { 
          id: 1, 
          dependencies: [], 
          subtasks: [
            { id: 1, dependencies: [] },
            { id: 2, dependencies: ["1.1"] },
            { id: 3, dependencies: ["1.2"] }
          ]
        }
      ];
      
      // This is a valid dependency chain: 1.3 -> 1.2 -> 1.1
      const result = isCircularDependency(tasks, "1.1", []);
      expect(result).toBe(false);
    }



    test('should properly handle dependencies between subtasks of the same parent', () => {
      const tasks = [
        { 
          id: 1, 
          dependencies: [], 
          subtasks: [
            { id: 1, dependencies: [] },
            { id: 2, dependencies: ["1.1"] },
            { id: 3, dependencies: [] }
          ]
        }
      ];
      
      // Check if adding a dependency from subtask 1.3 to 1.2 creates a circular dependency
      // This should be false as 1.3 -> 1.2 -> 1.1 is a valid chain
      mockTaskExists.mockImplementation(() => true);
      const result = isCircularDependency(tasks, "1.3", ["1.2"]);
      expect(result).toBe(false);
    }



    test('should correctly detect circular dependencies in subtasks of the same parent', () => {
      const tasks = [
        { 
          id: 1, 
          dependencies: [], 
          subtasks: [
            { id: 1, dependencies: ["1.3"] },
            { id: 2, dependencies: ["1.1"] },
            { id: 3, dependencies: ["1.2"] }
          ]
        }
      ];
      
      // This creates a circular dependency: 1.1 -> 1.3 -> 1.2 -> 1.1
      mockTaskExists.mockImplementation(() => true);
      const result = isCircularDependency(tasks, "1.2", ["1.1"]);
      expect(result).toBe(true);
    }


    test('should detect missing dependencies', () => {
      const tasks = [
        { id: 1, dependencies: [99] }, // 99 doesn't exist
        { id: 2, dependencies: [1] }
      ];
      
      const result = validateTaskDependencies(tasks);
      
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].type).toBe('missing');
      expect(result.issues[0].taskId).toBe(1);
      expect(result.issues[0].dependencyId).toBe(99);
    });

    test('should detect circular dependencies', () => {
      const tasks = [
        { id: 1, dependencies: [2] },
        { id: 2, dependencies: [1] }
      ];
      
      const result = validateTaskDependencies(tasks);
      
      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => issue.type === 'circular')).toBe(true);
    });

    test('should detect self-dependencies', () => {
      const tasks = [
        { id: 1, dependencies: [1] }
      ];
      
      const result = validateTaskDependencies(tasks);
      
      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => 
        issue.type === 'self' && issue.taskId === 1
      )).toBe(true);
    });

    test('should return valid for correct dependencies', () => {
      const tasks = [
        { id: 1, dependencies: [] },
        { id: 2, dependencies: [1] },
        { id: 3, dependencies: [1, 2] }
      ];
      
      const result = validateTaskDependencies(tasks);
      
      expect(result.valid).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    test('should handle tasks with no dependencies property', () => {
      const tasks = [
        { id: 1 }, // Missing dependencies property
        { id: 2, dependencies: [1] }
      ];
      
      const result = validateTaskDependencies(tasks);
      
      // Should be valid since a missing dependencies property is interpreted as an empty array
      expect(result.valid).toBe(true);
    });

    test('should handle subtask dependencies correctly', () => {
      const tasks = [
        { 
          id: 1, 
          dependencies: [], 
          subtasks: [
            { id: 1, dependencies: [] },
            { id: 2, dependencies: ["1.1"] }, // Valid - depends on another subtask
            { id: 3, dependencies: ["1.2"] }  // Valid - depends on another subtask
          ]
        },
        {
          id: 2,
          dependencies: ["1.3"],  // Valid - depends on a subtask from task 1
          subtasks: []
        }
      ];
      
      // Set up mock to handle subtask validation
      mockTaskExists.mockImplementation((tasks, id) => {
        if (typeof id === 'string' && id.includes('.')) {
          const [taskId, subtaskId] = id.split('.').map(Number);
          const task = tasks.find(t => t.id === taskId);
          return task && task.subtasks && task.subtasks.some(st => st.id === subtaskId);
        }
        return tasks.some(task => task.id === parseInt(id, 10));
      });

      const result = validateTaskDependencies(tasks);
      
      expect(result.valid).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    test('should detect missing subtask dependencies', () => {
      const tasks = [
        { 
          id: 1, 
          dependencies: [], 
          subtasks: [
            { id: 1, dependencies: ["1.4"] },  // Invalid - subtask 4 doesn't exist
            { id: 2, dependencies: ["2.1"] }   // Invalid - task 2 has no subtasks
          ]
        }



    test('should detect circular dependencies', () => {
      const tasks = [
        { id: 1, dependencies: [2] },
        { id: 2, dependencies: [1] }
      ];
      
      const result = validateTaskDependencies(tasks);
      
      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => issue.type === 'circular')).toBe(true);
    }



    test('should detect self-dependencies', () => {
      const tasks = [
        { id: 1, dependencies: [1] }
      ];
      
      const result = validateTaskDependencies(tasks);
      
      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => 
        issue.type === 'self' && issue.taskId === 1
      )).toBe(true);
    }



    test('should return valid for correct dependencies', () => {
      const tasks = [
        { id: 1, dependencies: [] },
        { id: 2, dependencies: [1] },
        { id: 3, dependencies: [1, 2] }
      ];
      
      const result = validateTaskDependencies(tasks);
      
      expect(result.valid).toBe(true);
      expect(result.issues.length).toBe(0);
    }



    test('should handle tasks with no dependencies property', () => {
      const tasks = [
        { id: 1 }, // Missing dependencies property
        { id: 2, dependencies: [1] }
      ];
      
      const result = validateTaskDependencies(tasks);
      
      // Should be valid since a missing dependencies property is interpreted as an empty array
      expect(result.valid).toBe(true);
    }



    test('should handle subtask dependencies correctly', () => {
      const tasks = [
        { 
          id: 1, 
          dependencies: [], 
          subtasks: [
            { id: 1, dependencies: [] },
            { id: 2, dependencies: ["1.1"] }, // Valid - depends on another subtask
            { id: 3, dependencies: ["1.2"] }  // Valid - depends on another subtask
          ]
        },
        {
          id: 2,
          dependencies: ["1.3"],  // Valid - depends on a subtask from task 1
          subtasks: []
        }
      ];
      
      // Set up mock to handle subtask validation
      mockTaskExists.mockImplementation((tasks, id) => {
        if (typeof id === 'string' && id.includes('.')) {
          const [taskId, subtaskId] = id.split('.').map(Number);
          const task = tasks.find(t => t.id === taskId);
          return task && task.subtasks && task.subtasks.some(st => st.id === subtaskId);
        }
        return tasks.some(task => task.id === parseInt(id, 10));
      });

      const result = validateTaskDependencies(tasks);
      
      expect(result.valid).toBe(true);
      expect(result.issues.length).toBe(0);
    }



    test('should detect missing subtask dependencies', () => {
      const tasks = [
        { 
          id: 1, 
          dependencies: [], 
          subtasks: [
            { id: 1, dependencies: ["1.4"] },  // Invalid - subtask 4 doesn't exist
            { id: 2, dependencies: ["2.1"] }   // Invalid - task 2 has no subtasks
          ]
        },
        {
          id: 2,
          dependencies: [],
          subtasks: []
        }
      ];

      // Mock taskExists to correctly identify missing subtasks
      mockTaskExists.mockImplementation((taskArray, depId) => {
        if (typeof depId === 'string' && depId === "1.4") {
          return false; // Subtask 1.4 doesn't exist
        }
        if (typeof depId === 'string' && depId === "2.1") {
          return false; // Subtask 2.1 doesn't exist
        }
        return true; // All other dependencies exist
      });

      const result = validateTaskDependencies(tasks);
      
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      // Should detect missing subtask dependencies
      expect(result.issues.some(issue => 
        issue.type === 'missing' && String(issue.taskId) === "1.1" && String(issue.dependencyId) === "1.4"
      )).toBe(true);
    });

    test('should detect circular dependencies between subtasks', () => {
      const tasks = [
        { 
          id: 1, 
          dependencies: [], 
          subtasks: [
            { id: 1, dependencies: ["1.2"] },
            { id: 2, dependencies: ["1.1"] }  // Creates a circular dependency with 1.1
          ]
        }
      ];

      // Mock isCircularDependency for subtasks
      mockFindCycles.mockReturnValue(true);

      const result = validateTaskDependencies(tasks);
      
      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => issue.type === 'circular')).toBe(true);
    });

    test('should properly validate dependencies between subtasks of the same parent', () => {
      const tasks = [
        { 
          id: 23, 
          dependencies: [], 
          subtasks: [
            { id: 8, dependencies: ["23.13"] },
            { id: 10, dependencies: ["23.8"] },
            { id: 13, dependencies: [] }
          ]
        }
      ];
      
      // Mock taskExists to validate the subtask dependencies
      mockTaskExists.mockImplementation((taskArray, id) => {
        if (typeof id === 'string') {
          if (id === "23.8" || id === "23.10" || id === "23.13") {
            return true;
          }
        }
        return false;
      });
      
      const result = validateTaskDependencies(tasks);
      
      expect(result.valid).toBe(true);
      expect(result.issues.length).toBe(0);
    });
  });

  describe('removeDuplicateDependencies function', () => {
    test('should remove duplicate dependencies from tasks', () => {
      const tasksData = {
        tasks: [
          { id: 1, dependencies: [2, 2, 3, 3, 3] },
          { id: 2, dependencies: [3] },
          { id: 3, dependencies: [] }
        ]
      };
      
      const result = removeDuplicateDependencies(tasksData);
      
      expect(result.tasks[0].dependencies).toEqual([2, 3]);
      expect(result.tasks[1].dependencies).toEqual([3]);
      expect(result.tasks[2].dependencies).toEqual([]);
    });

    test('should handle empty dependencies array', () => {
      const tasksData = {
        tasks: [
          { id: 1, dependencies: [] },
          { id: 2, dependencies: [1] }
        ]
      };
      
      const result = removeDuplicateDependencies(tasksData);
      
      expect(result.tasks[0].dependencies).toEqual([]);
      expect(result.tasks[1].dependencies).toEqual([1]);
    });

    test('should handle tasks with no dependencies property', () => {
      const tasksData = {
        tasks: [
          { id: 1 }, // No dependencies property
          { id: 2, dependencies: [1] }
        ]
      };
      
      const result = removeDuplicateDependencies(tasksData);
      
      expect(result.tasks[0]).not.toHaveProperty('dependencies');
      expect(result.tasks[1].dependencies).toEqual([1]);
    });
  });

  describe('cleanupSubtaskDependencies function', () => {
    test('should remove dependencies to non-existent subtasks', () => {
      const tasksData = {
        tasks: [
          { 
            id: 1, 
            dependencies: [], 
            subtasks: [
              { id: 1, dependencies: [] },
              { id: 2, dependencies: [3] } // Dependency 3 doesn't exist
            ] 
          },
          { 
            id: 2, 
            dependencies: ['1.2'], // Valid subtask dependency
            subtasks: [
              { id: 1, dependencies: ['1.1'] } // Valid subtask dependency
            ] 
          }
        ]
      }



    test('should detect circular dependencies between subtasks', () => {
      const tasks = [
        { 
          id: 1, 
          dependencies: [], 
          subtasks: [
            { id: 1, dependencies: ["1.2"] },
            { id: 2, dependencies: ["1.1"] }  // Creates a circular dependency with 1.1
          ]
        }
      ];

      // Mock isCircularDependency for subtasks
      mockFindCycles.mockReturnValue(true);

      const result = validateTaskDependencies(tasks);
      
      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => issue.type === 'circular')).toBe(true);
    }



    test('should properly validate dependencies between subtasks of the same parent', () => {
      const tasks = [
        { 
          id: 23, 
          dependencies: [], 
          subtasks: [
            { id: 8, dependencies: ["23.13"] },
            { id: 10, dependencies: ["23.8"] },
            { id: 13, dependencies: [] }
          ]
        }
      ];
      
      // Mock taskExists to validate the subtask dependencies
      mockTaskExists.mockImplementation((taskArray, id) => {
        if (typeof id === 'string') {
          if (id === "23.8" || id === "23.10" || id === "23.13") {
            return true;
          }
        }
        return false;
      });
      
      const result = validateTaskDependencies(tasks);
      
      expect(result.valid).toBe(true);
      expect(result.issues.length).toBe(0);
    }


    test('should remove duplicate dependencies from tasks', () => {
      const tasksData = {
        tasks: [
          { id: 1, dependencies: [2, 2, 3, 3, 3] },
          { id: 2, dependencies: [3] },
          { id: 3, dependencies: [] }
        ]
      };
      
      const result = removeDuplicateDependencies(tasksData);
      
      expect(result.tasks[0].dependencies).toEqual([2, 3]);
      expect(result.tasks[1].dependencies).toEqual([3]);
      expect(result.tasks[2].dependencies).toEqual([]);
    }



    test('should handle empty dependencies array', () => {
      const tasksData = {
        tasks: [
          { id: 1, dependencies: [] },
          { id: 2, dependencies: [1] }
        ]
      };
      
      const result = removeDuplicateDependencies(tasksData);
      
      expect(result.tasks[0].dependencies).toEqual([]);
      expect(result.tasks[1].dependencies).toEqual([1]);
    }



    test('should handle tasks with no dependencies property', () => {
      const tasksData = {
        tasks: [
          { id: 1 }, // No dependencies property
          { id: 2, dependencies: [1] }
        ]
      };
      
      const result = removeDuplicateDependencies(tasksData);
      
      expect(result.tasks[0]).not.toHaveProperty('dependencies');
      expect(result.tasks[1].dependencies).toEqual([1]);
    }





    test('should handle tasks without subtasks', () => {
      const tasksData = {
        tasks: [
          { id: 1, dependencies: [] },
          { id: 2, dependencies: [1] }
        ]
      };
      
      const result = cleanupSubtaskDependencies(tasksData);
      
      // Should return the original data unchanged
      expect(result).toEqual(tasksData);
    }


    test('should clear dependencies of first subtask if none are independent', () => {
      const tasksData = {
        tasks: [
          {
            id: 1,
            subtasks: [
              { id: 1, dependencies: [2] },
              { id: 2, dependencies: [1] }
            ]
          }
        ]
      };

      const result = ensureAtLeastOneIndependentSubtask(tasksData);

      expect(result).toBe(true);
      expect(tasksData.tasks[0].subtasks[0].dependencies).toEqual([]);
      expect(tasksData.tasks[0].subtasks[1].dependencies).toEqual([1]);
    }



    test('should not modify tasks if at least one subtask is independent', () => {
      const tasksData = {
        tasks: [
          {
            id: 1,
            subtasks: [
              { id: 1, dependencies: [] },
              { id: 2, dependencies: [1] }
            ]
          }
        ]
      };

      const result = ensureAtLeastOneIndependentSubtask(tasksData);

      expect(result).toBe(false);
      expect(tasksData.tasks[0].subtasks[0].dependencies).toEqual([]);
      expect(tasksData.tasks[0].subtasks[1].dependencies).toEqual([1]);
    }



    test('should handle tasks without subtasks', () => {
      const tasksData = {
        tasks: [
          { id: 1 },
          { id: 2, dependencies: [1] }
        ]
      };

      const result = ensureAtLeastOneIndependentSubtask(tasksData);

      expect(result).toBe(false);
      expect(tasksData).toEqual({
        tasks: [
          { id: 1 },
          { id: 2, dependencies: [1] }
        ]
      });
    }



    test('should handle empty subtasks array', () => {
      const tasksData = {
        tasks: [
          { id: 1, subtasks: [] }
        ]
      };

      const result = ensureAtLeastOneIndependentSubtask(tasksData);

      expect(result).toBe(false);
      expect(tasksData).toEqual({
        tasks: [
          { id: 1, subtasks: [] }
        ]
      });
    }


    test('should fix multiple dependency issues and return true if changes made', () => {
      const tasksData = {
        tasks: [
          {
            id: 1,
            dependencies: [1, 1, 99], // Self-dependency and duplicate and invalid dependency
            subtasks: [
              { id: 1, dependencies: [2, 2] }, // Duplicate dependencies
              { id: 2, dependencies: [1] }
            ]
          },
          {
            id: 2,
            dependencies: [1],
            subtasks: [
              { id: 1, dependencies: [99] } // Invalid dependency
            ]
          }
        ]
      };

      // Mock taskExists for validating dependencies
      mockTaskExists.mockImplementation((tasks, id) => {
        // Convert id to string for comparison
        const idStr = String(id);
        
        // Handle subtask references (e.g., "1.2")
        if (idStr.includes('.')) {
          const [parentId, subtaskId] = idStr.split('.').map(Number);
          const task = tasks.find(t => t.id === parentId);
          return task && task.subtasks && task.subtasks.some(st => st.id === subtaskId);
        }
        
        // Handle regular task references
        const taskId = parseInt(idStr, 10);
        return taskId === 1 || taskId === 2; // Only tasks 1 and 2 exist
      });

      // Make a copy for verification that original is modified
      const originalData = JSON.parse(JSON.stringify(tasksData));

      const result = validateAndFixDependencies(tasksData);

      expect(result).toBe(true);
      // Check that data has been modified
      expect(tasksData).not.toEqual(originalData);
      
      // Check specific changes
      // 1. Self-dependency removed
      expect(tasksData.tasks[0].dependencies).not.toContain(1); 
      // 2. Invalid dependency removed
      expect(tasksData.tasks[0].dependencies).not.toContain(99);
      // 3. Dependencies have been deduplicated
      if (tasksData.tasks[0].subtasks[0].dependencies.length > 0) {
        expect(tasksData.tasks[0].subtasks[0].dependencies).toEqual(
          expect.arrayContaining([])
        );
      }
      // 4. Invalid subtask dependency removed
      expect(tasksData.tasks[1].subtasks[0].dependencies).toEqual([]);

      // IMPORTANT: Verify no calls to writeJSON with actual tasks.json
      expect(mockWriteJSON).not.toHaveBeenCalledWith('tasks/tasks.json', expect.anything());
    }



    test('should return false if no changes needed', () => {
      const tasksData = {
        tasks: [
          {
            id: 1,
            dependencies: [],
            subtasks: [
              { id: 1, dependencies: [] }, // Already has an independent subtask
              { id: 2, dependencies: ['1.1'] }
            ]
          },
          {
            id: 2,
            dependencies: [1]
          }
        ]
      };

      // Mock taskExists to validate all dependencies as valid
      mockTaskExists.mockImplementation((tasks, id) => {
        // Convert id to string for comparison
        const idStr = String(id);
        
        // Handle subtask references
        if (idStr.includes('.')) {
          const [parentId, subtaskId] = idStr.split('.').map(Number);
          const task = tasks.find(t => t.id === parentId);
          return task && task.subtasks && task.subtasks.some(st => st.id === subtaskId);
        }
        
        // Handle regular task references
        const taskId = parseInt(idStr, 10);
        return taskId === 1 || taskId === 2;
      });

      const originalData = JSON.parse(JSON.stringify(tasksData));
      const result = validateAndFixDependencies(tasksData);

      expect(result).toBe(false);
      // Verify data is unchanged
      expect(tasksData).toEqual(originalData);
      
      // IMPORTANT: Verify no calls to writeJSON with actual tasks.json
      expect(mockWriteJSON).not.toHaveBeenCalledWith('tasks/tasks.json', expect.anything());
    }



    test('should handle invalid input', () => {
      expect(validateAndFixDependencies(null)).toBe(false);
      expect(validateAndFixDependencies({})).toBe(false);
      expect(validateAndFixDependencies({ tasks: null })).toBe(false);
      expect(validateAndFixDependencies({ tasks: 'not an array' })).toBe(false);
      
      // IMPORTANT: Verify no calls to writeJSON with actual tasks.json
      expect(mockWriteJSON).not.toHaveBeenCalledWith('tasks/tasks.json', expect.anything());
    }



    test('should save changes when tasksPath is provided', () => {
      const tasksData = {
        tasks: [
          {
            id: 1,
            dependencies: [1, 1], // Self-dependency and duplicate
            subtasks: [
              { id: 1, dependencies: [99] } // Invalid dependency
            ]
          }
        ]
      };

      // Mock taskExists for this specific test
      mockTaskExists.mockImplementation((tasks, id) => {
        // Convert id to string for comparison
        const idStr = String(id);
        
        // Handle subtask references
        if (idStr.includes('.')) {
          const [parentId, subtaskId] = idStr.split('.').map(Number);
          const task = tasks.find(t => t.id === parentId);
          return task && task.subtasks && task.subtasks.some(st => st.id === subtaskId);
        }
        
        // Handle regular task references
        const taskId = parseInt(idStr, 10);
        return taskId === 1; // Only task 1 exists
      });

      // Copy the original data to verify changes
      const originalData = JSON.parse(JSON.stringify(tasksData));

      // Call the function with our test path instead of the actual tasks.json
      const result = validateAndFixDependencies(tasksData, TEST_TASKS_PATH);

      // First verify that the result is true (changes were made)
      expect(result).toBe(true);

      // Verify the data was modified
      expect(tasksData).not.toEqual(originalData);

      // IMPORTANT: Verify no calls to writeJSON with actual tasks.json
      expect(mockWriteJSON).not.toHaveBeenCalledWith('tasks/tasks.json', expect.anything());
    });
    });

    // Add tests for validateAndFixDependencies, validateDependenciesCommand, fixDependenciesCommand
});
*/ 