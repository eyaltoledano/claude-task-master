import { chromium } from 'playwright';

async function testKanbanUI() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    // Listen to console messages from the start
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error('Browser console error:', msg.text());
        } else if (msg.type() === 'log') {
            console.log('Browser console log:', msg.text());
        }
    });
    
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
        
        // Check if any task cards are rendered (new design uses different classes)
        const mainTaskCards = await page.$$('.main-task-card');
        const subtaskCards = await page.$$('.subtask-card');
        const totalCards = mainTaskCards.length + subtaskCards.length;
        console.log(`\n📋 Total cards rendered: ${totalCards}`);
        console.log(`   Main task cards: ${mainTaskCards.length}`);
        console.log(`   Subtask cards: ${subtaskCards.length}`);
        
        // Get all cards for inspection
        const allCards = [...mainTaskCards, ...subtaskCards];
        
        if (allCards.length > 0) {
            // Inspect first task card
            const firstCard = allCards[0];
            const taskId = await firstCard.getAttribute('data-task-id');
            
            // Check card type and get appropriate title
            const isSubtask = await firstCard.evaluate(el => el.classList.contains('subtask-card'));
            const titleSelector = isSubtask ? '.subtask-title' : '.task-title';
            const taskTitle = await firstCard.$eval(titleSelector, el => el.textContent);
            
            console.log(`\n🎯 First task:`);
            console.log(`   ID: ${taskId}`);
            console.log(`   Type: ${isSubtask ? 'Subtask' : 'Main Task'}`);
            console.log(`   Title: ${taskTitle}`);
            
            // Check for badges
            const mainBadge = await firstCard.$('.main-task-badge');
            const parentBadge = await firstCard.$('.parent-task-badge');
            console.log(`   Main badge: ${mainBadge ? 'Yes' : 'No'}`);
            console.log(`   Parent badge: ${parentBadge ? 'Yes' : 'No'}`);
        }
        
        
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