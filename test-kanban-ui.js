import { chromium } from 'playwright';

async function testKanbanUI() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    try {
        console.log('Navigating to http://localhost:3456...');
        await page.goto('http://localhost:3456', { waitUntil: 'networkidle' });
        
        // Wait for the kanban board to load
        await page.waitForSelector('.kanban-board', { timeout: 5000 });
        console.log('✓ Kanban board loaded');
        
        // Check for error messages
        const errorContainer = await page.$('#error-container');
        if (errorContainer) {
            const isVisible = await errorContainer.isVisible();
            if (isVisible) {
                const errorText = await page.textContent('.error-message');
                console.error('❌ Error displayed:', errorText);
            }
        }
        
        // Count tasks in each column
        const columns = ['backlog', 'ready', 'in-progress', 'review', 'done'];
        
        for (const column of columns) {
            const tasksInColumn = await page.$$(`[data-column="${column}"] .task-card`);
            console.log(`📊 ${column}: ${tasksInColumn.length} tasks`);
        }
        
        // Check if any task cards are rendered
        const taskCards = await page.$$('.task-card');
        console.log(`\n📋 Total task cards rendered: ${taskCards.length}`);
        
        if (taskCards.length > 0) {
            // Inspect first task card
            const firstCard = taskCards[0];
            const taskId = await firstCard.getAttribute('data-task-id');
            const taskTitle = await page.textContent(`[data-task-id="${taskId}"] .task-title`);
            console.log(`\n🎯 First task:`);
            console.log(`   ID: ${taskId}`);
            console.log(`   Title: ${taskTitle}`);
            
            // Check for badges
            const badges = await firstCard.$$('.task-badges span');
            console.log(`   Badges: ${badges.length}`);
        }
        
        // Check console for errors
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.error('Browser console error:', msg.text());
            }
        });
        
        // Wait a bit to see the UI
        console.log('\n👀 Keeping browser open for inspection...');
        await page.waitForTimeout(30000); // Keep open for 30 seconds
        
    } catch (error) {
        console.error('Test failed:', error);
        
        // Take a screenshot on error
        await page.screenshot({ path: 'kanban-error.png' });
        console.log('Screenshot saved as kanban-error.png');
    } finally {
        await browser.close();
    }
}

testKanbanUI().catch(console.error);