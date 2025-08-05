/**
 * Unit tests for Error Boundary System
 * Tests component error handling, recovery, and graceful degradation
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';

describe('Error Boundary System', () => {
    let dom;
    let document;
    let window;
    let ErrorBoundary;
    let mockToast;
    
    beforeEach(() => {
        // Set up DOM environment
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div id="app">
                    <div class="component" data-component="userList">
                        <h2>User List</h2>
                        <ul class="user-list"></ul>
                    </div>
                    <div class="component" data-component="taskBoard">
                        <h2>Task Board</h2>
                        <div class="task-container"></div>
                    </div>
                </div>
            </body>
            </html>
        `, {
            url: 'http://localhost:3000',
            pretendToBeVisual: true
        });
        
        document = dom.window.document;
        window = dom.window;
        
        // Set up globals
        global.document = document;
        global.window = window;
        global.console = {
            ...console,
            error: jest.fn(),
            warn: jest.fn(),
            log: jest.fn()
        };
        
        // Mock toast notifications
        mockToast = {
            error: jest.fn(),
            warning: jest.fn(),
            info: jest.fn()
        };
        global.toast = mockToast;
        
        // Mock performance
        global.performance = {
            now: jest.fn(() => Date.now())
        };
    });
    
    afterEach(() => {
        jest.restoreAllMocks();
    });
    
    // Helper to load the ErrorBoundary
    const loadErrorBoundary = async () => {
        // Import the actual implementation
        const module = await import('../../../src/ui/client/js/components/errorBoundary.js');
        return module.default;
    };
    
    describe('Component Wrapping', () => {
        it('should wrap a component with error boundary', async () => {
            ErrorBoundary = await loadErrorBoundary();
            const boundary = new ErrorBoundary();
            
            const component = document.querySelector('[data-component="userList"]');
            const id = boundary.wrap(component, 'UserList');
            
            expect(id).toBeDefined();
            expect(component.getAttribute('data-error-boundary')).toBe(id);
            expect(boundary.componentStates.has(id)).toBe(true);
        });
        
        it('should accept selector string or element', async () => {
            ErrorBoundary = await loadErrorBoundary();
            const boundary = new ErrorBoundary();
            
            // Test with selector
            const id1 = boundary.wrap('[data-component="userList"]', 'UserList');
            expect(id1).toBeDefined();
            
            // Test with element
            const element = document.querySelector('[data-component="taskBoard"]');
            const id2 = boundary.wrap(element, 'TaskBoard');
            expect(id2).toBeDefined();
        });
        
        it('should throw error for non-existent selector', async () => {
            ErrorBoundary = await loadErrorBoundary();
            const boundary = new ErrorBoundary();
            
            expect(() => {
                boundary.wrap('.non-existent', 'Test');
            }).toThrow('Element not found');
        });
    });
    
    describe('Error Handling', () => {
        it('should catch errors in render function', async () => {
            ErrorBoundary = await loadErrorBoundary();
            const boundary = new ErrorBoundary();
            
            const errorFn = () => {
                throw new Error('Render error');
            };
            
            const component = document.querySelector('[data-component="userList"]');
            const id = boundary.wrap(component, 'UserList', errorFn);
            
            const state = boundary.componentStates.get(id);
            expect(state.errorCount).toBe(1);
            expect(state.lastError.message).toBe('Render error');
        });
        
        it('should show fallback UI on error', async () => {
            ErrorBoundary = await loadErrorBoundary();
            const boundary = new ErrorBoundary({ fallbackUI: true });
            
            const component = document.querySelector('[data-component="userList"]');
            const errorFn = () => {
                throw new Error('Component failed');
            };
            
            boundary.wrap(component, 'UserList', errorFn);
            
            const fallback = component.querySelector('.error-boundary-fallback');
            expect(fallback).toBeTruthy();
            expect(fallback.textContent).toContain('Something went wrong');
            expect(fallback.textContent).toContain('UserList');
        });
        
        it('should show error details in debug mode', async () => {
            ErrorBoundary = await loadErrorBoundary();
            const boundary = new ErrorBoundary({ 
                fallbackUI: true,
                showErrorDetails: true 
            });
            
            const component = document.querySelector('[data-component="userList"]');
            const error = new Error('Detailed error');
            error.stack = 'Error: Detailed error\n    at test.js:123';
            
            boundary.wrap(component, 'UserList', () => {
                throw error;
            });
            
            const details = component.querySelector('details');
            expect(details).toBeTruthy();
            expect(details.textContent).toContain('Detailed error');
        });
        
        it('should log errors when enabled', async () => {
            ErrorBoundary = await loadErrorBoundary();
            const boundary = new ErrorBoundary({ logErrors: true });
            
            const component = document.querySelector('[data-component="userList"]');
            boundary.wrap(component, 'UserList', () => {
                throw new Error('Logged error');
            });
            
            expect(console.error).toHaveBeenCalledWith(
                'Error in component UserList:',
                expect.any(Error)
            );
        });
        
        it('should show toast notification on error', async () => {
            ErrorBoundary = await loadErrorBoundary();
            const boundary = new ErrorBoundary();
            
            const component = document.querySelector('[data-component="userList"]');
            boundary.wrap(component, 'UserList', () => {
                throw new Error('Toast error');
            });
            
            expect(mockToast.error).toHaveBeenCalledWith(
                'Error in UserList. Click to retry.',
                expect.objectContaining({
                    duration: 0,
                    actions: expect.arrayContaining([
                        expect.objectContaining({
                            label: 'Retry'
                        })
                    ])
                })
            );
        });
    });
    
    describe('Recovery Mechanisms', () => {
        it('should retry component on button click', async () => {
            ErrorBoundary = await loadErrorBoundary();
            const boundary = new ErrorBoundary();
            
            let attemptCount = 0;
            const retryFn = (element) => {
                attemptCount++;
                if (attemptCount === 1) {
                    throw new Error('First attempt failed');
                }
                element.innerHTML = '<p>Success!</p>';
            };
            
            const component = document.querySelector('[data-component="userList"]');
            boundary.wrap(component, 'UserList', retryFn);
            
            expect(attemptCount).toBe(1);
            
            const retryBtn = component.querySelector('.retry-button');
            expect(retryBtn).toBeTruthy();
            
            retryBtn.click();
            
            expect(attemptCount).toBe(2);
            expect(component.textContent).toContain('Success!');
            expect(mockToast.info).toHaveBeenCalledWith('UserList reloaded successfully');
        });
        
        it('should reset error count on successful retry', async () => {
            ErrorBoundary = await loadErrorBoundary();
            const boundary = new ErrorBoundary();
            
            let shouldFail = true;
            const component = document.querySelector('[data-component="userList"]');
            const id = boundary.wrap(component, 'UserList', () => {
                if (shouldFail) {
                    throw new Error('Failed');
                }
            });
            
            let state = boundary.componentStates.get(id);
            expect(state.errorCount).toBe(1);
            
            shouldFail = false;
            boundary.retry(id);
            
            state = boundary.componentStates.get(id);
            expect(state.errorCount).toBe(0);
            expect(state.lastError).toBe(null);
        });
        
        it('should handle retry failures', async () => {
            ErrorBoundary = await loadErrorBoundary();
            const boundary = new ErrorBoundary();
            
            const component = document.querySelector('[data-component="userList"]');
            const id = boundary.wrap(component, 'UserList', () => {
                throw new Error('Always fails');
            });
            
            const initialErrorCount = boundary.componentStates.get(id).errorCount;
            
            boundary.retry(id);
            
            const newErrorCount = boundary.componentStates.get(id).errorCount;
            expect(newErrorCount).toBe(initialErrorCount + 1);
        });
    });
    
    describe('Global Error Handling', () => {
        it('should attach global error handlers', async () => {
            ErrorBoundary = await loadErrorBoundary();
            const boundary = new ErrorBoundary();
            
            const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
            
            boundary.attachGlobalHandlers();
            
            expect(addEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function), true);
            expect(addEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
        });
        
        it('should handle window errors', async () => {
            ErrorBoundary = await loadErrorBoundary();
            const boundary = new ErrorBoundary({ logErrors: true });
            boundary.attachGlobalHandlers();
            
            const errorEvent = new window.ErrorEvent('error', {
                error: new Error('Window error'),
                message: 'Window error occurred',
                filename: 'test.js',
                lineno: 10,
                colno: 5
            });
            
            window.dispatchEvent(errorEvent);
            
            expect(console.error).toHaveBeenCalledWith('Uncaught error:', expect.any(Error));
        });
        
        it('should handle unhandled promise rejections', async () => {
            ErrorBoundary = await loadErrorBoundary();
            const boundary = new ErrorBoundary();
            boundary.attachGlobalHandlers();
            
            const promiseEvent = new window.Event('unhandledrejection');
            promiseEvent.reason = new Error('Promise rejected');
            
            window.dispatchEvent(promiseEvent);
            
            expect(console.error).toHaveBeenCalledWith(
                'Unhandled promise rejection:',
                expect.any(Error)
            );
            expect(mockToast.error).toHaveBeenCalledWith('An unexpected error occurred');
        });
        
        it('should detach handlers on destroy', async () => {
            ErrorBoundary = await loadErrorBoundary();
            const boundary = new ErrorBoundary();
            
            const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
            
            boundary.attachGlobalHandlers();
            boundary.destroy();
            
            expect(removeEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function), true);
            expect(removeEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
        });
    });
    
    describe('Error Statistics', () => {
        it('should track error statistics', async () => {
            ErrorBoundary = await loadErrorBoundary();
            const boundary = new ErrorBoundary();
            
            // Create some errors
            boundary.wrap('[data-component="userList"]', 'UserList', () => {
                throw new Error('Error 1');
            });
            
            boundary.wrap('[data-component="taskBoard"]', 'TaskBoard', () => {
                throw new Error('Error 2');
            });
            
            const stats = boundary.getErrorStats();
            
            expect(stats.totalErrors).toBe(2);
            expect(stats.componentErrors.UserList).toBe(1);
            expect(stats.componentErrors.TaskBoard).toBe(1);
            expect(stats.components).toHaveLength(2);
        });
        
        it('should reset all components with errors', async () => {
            ErrorBoundary = await loadErrorBoundary();
            const boundary = new ErrorBoundary();
            
            let userListFixed = false;
            let taskBoardFixed = false;
            
            boundary.wrap('[data-component="userList"]', 'UserList', (el) => {
                if (!userListFixed) {
                    throw new Error('UserList error');
                }
                el.innerHTML = '<p>UserList OK</p>';
            });
            
            boundary.wrap('[data-component="taskBoard"]', 'TaskBoard', (el) => {
                if (!taskBoardFixed) {
                    throw new Error('TaskBoard error');
                }
                el.innerHTML = '<p>TaskBoard OK</p>';
            });
            
            // Fix the components
            userListFixed = true;
            taskBoardFixed = true;
            
            // Reset all
            boundary.reset();
            
            const stats = boundary.getErrorStats();
            expect(stats.totalErrors).toBe(0);
            
            expect(document.querySelector('[data-component="userList"]').textContent).toContain('UserList OK');
            expect(document.querySelector('[data-component="taskBoard"]').textContent).toContain('TaskBoard OK');
        });
    });
    
    describe('Custom Error Handlers', () => {
        it('should call custom error handler', async () => {
            const onError = jest.fn();
            
            ErrorBoundary = await loadErrorBoundary();
            const boundary = new ErrorBoundary({ onError });
            
            const error = new Error('Custom handler test');
            boundary.wrap('[data-component="userList"]', 'UserList', () => {
                throw error;
            });
            
            expect(onError).toHaveBeenCalledWith(error, 'UserList');
        });
    });
    
    describe('State Preservation', () => {
        it('should maintain component state during errors', async () => {
            ErrorBoundary = await loadErrorBoundary();
            const boundary = new ErrorBoundary();
            
            const component = document.querySelector('[data-component="userList"]');
            const originalContent = '<ul><li>User 1</li><li>User 2</li></ul>';
            component.innerHTML = originalContent;
            
            const id = boundary.wrap(component, 'UserList');
            
            // Simulate error
            boundary.handleComponentError(id, new Error('State test'));
            
            // Verify original content is preserved
            const state = boundary.componentStates.get(id);
            expect(state.originalContent).toBe(originalContent);
            
            // Retry should restore original content
            boundary.retry(id);
            expect(component.innerHTML).toBe(originalContent);
        });
    });
});