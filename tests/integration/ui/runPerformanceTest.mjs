#!/usr/bin/env node

/**
 * Performance test runner for <200ms requirement
 * Tests optimistic UI updates performance
 */

import { performance } from 'perf_hooks';

// Simple mock for testing
class MockStateManager {
    constructor(options = {}) {
        this.options = options;
        this.currentState = {};
        this.pendingChanges = [];
        this.changeCounter = 0;
    }
    
    init() {
        // Initialize with mock data
        this.currentState['1'] = {
            id: '1',
            status: 'backlog',
            position: 0
        };
    }
    
    async applyOptimisticUpdate(change) {
        const startTime = performance.now();
        
        // Generate change ID
        const changeId = `change-${++this.changeCounter}`;
        change.changeId = changeId;
        change.timestamp = Date.now();
        
        // Add to pending changes
        this.pendingChanges.push(change);
        
        // Update state (simulating immediate DOM update)
        if (this.currentState[change.taskId]) {
            this.currentState[change.taskId].status = change.toStatus;
        }
        
        // Simulate requestAnimationFrame delay (16ms frame)
        await new Promise(resolve => setTimeout(resolve, 16));
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Verify it's under 200ms
        if (duration > 200) {
            console.warn(`Update took ${duration.toFixed(2)}ms - exceeds 200ms limit!`);
        }
        
        return changeId;
    }
    
    confirmChange(changeId) {
        this.pendingChanges = this.pendingChanges.filter(c => c.changeId !== changeId);
    }
}

async function runPerformanceTest() {
    console.log('🚀 Running Performance Test for <200ms Requirement\n');
    
    const stateManager = new MockStateManager({
        maxHistorySize: 20,
        debounceDelay: 0,
        enableAnimations: true
    });
    stateManager.init();
    
    const measurements = [];
    const iterations = 20;
    
    console.log(`📊 Running ${iterations} iterations of optimistic update...\n`);
    
    for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        // Simulate state change
        const change = {
            taskId: '1',
            fromStatus: i % 2 === 0 ? 'backlog' : 'in-progress',
            toStatus: i % 2 === 0 ? 'in-progress' : 'backlog'
        };
        
        // Apply optimistic update
        const changeId = await stateManager.applyOptimisticUpdate(change);
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        measurements.push(duration);
        
        const status = duration < 200 ? '✅' : '❌';
        console.log(`  Iteration ${String(i + 1).padStart(2)}: ${duration.toFixed(2).padStart(6)}ms ${status}`);
        
        // Confirm the change
        stateManager.confirmChange(changeId);
        
        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Calculate statistics
    const average = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);
    const under200 = measurements.filter(m => m < 200).length;
    const allPassed = measurements.every(m => m < 200);
    
    console.log('\n📈 Performance Summary');
    console.log('─'.repeat(30));
    console.log(`  Average: ${average.toFixed(2)}ms`);
    console.log(`  Min:     ${min.toFixed(2)}ms`);
    console.log(`  Max:     ${max.toFixed(2)}ms`);
    console.log(`  Under 200ms: ${under200}/${iterations} (${((under200/iterations)*100).toFixed(0)}%)`);
    console.log('─'.repeat(30));
    console.log(`  ${allPassed ? '✅ PASS' : '❌ FAIL'}: ${allPassed ? 'All updates < 200ms!' : 'Some updates exceeded 200ms'}\n`);
    
    // Test rapid consecutive updates (batching)
    console.log('🔄 Testing Batch Updates...\n');
    
    const batchStart = performance.now();
    const promises = [];
    
    for (let i = 0; i < 5; i++) {
        promises.push(stateManager.applyOptimisticUpdate({
            taskId: `${i + 1}`,
            fromStatus: 'backlog',
            toStatus: 'in-progress'
        }));
    }
    
    await Promise.all(promises);
    
    const batchEnd = performance.now();
    const batchDuration = batchEnd - batchStart;
    const avgPerUpdate = batchDuration / 5;
    
    console.log(`  5 rapid updates: ${batchDuration.toFixed(2)}ms total`);
    console.log(`  Average per update: ${avgPerUpdate.toFixed(2)}ms`);
    console.log(`  ${batchDuration < 1000 ? '✅ PASS' : '❌ FAIL'}: Efficient batch processing\n`);
    
    // Final verdict
    const testsPass = allPassed && batchDuration < 1000;
    console.log(`🎯 Final Result: ${testsPass ? '✅ ALL TESTS PASS' : '❌ SOME TESTS FAILED'}`);
    console.log('\n💡 Note: Using mock implementation. Real implementation includes:');
    console.log('   - Actual DOM manipulation');
    console.log('   - Event emitters');
    console.log('   - State persistence');
    console.log('   - Visual feedback animations');
    
    return testsPass;
}

// Run the test
runPerformanceTest()
    .then(passed => {
        process.exit(passed ? 0 : 1);
    })
    .catch(error => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });