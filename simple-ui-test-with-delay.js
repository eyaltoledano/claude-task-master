import puppeteer from 'puppeteer';

async function testUIWithDelay() {
	console.log('Testing Kanban UI with JavaScript execution...');

	let browser;
	try {
		browser = await puppeteer.launch({
			headless: true,
			args: ['--no-sandbox', '--disable-setuid-sandbox']
		});

		const page = await browser.newPage();

		// Enable console logging
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				console.error('Browser console error:', msg.text());
			} else if (msg.type() === 'log') {
				console.log('Browser console log:', msg.text());
			}
		});

		console.log('\n🌐 Navigating to kanban board...');
		await page.goto('http://localhost:3456', { waitUntil: 'networkidle0' });

		// Wait for kanban board to load
		await page.waitForSelector('.kanban-board', { timeout: 10000 });
		console.log('✓ Kanban board found');

		// Wait a bit for JavaScript to render cards
		console.log('⏳ Waiting for cards to render...');
		await page.waitForTimeout(3000);

		// Count the new card types
		const mainTaskCards = await page.$$('.main-task-card');
		const subtaskCards = await page.$$('.subtask-card');
		const totalCards = mainTaskCards.length + subtaskCards.length;

		console.log(`\n📋 Cards rendered:`);
		console.log(`   Main task cards: ${mainTaskCards.length}`);
		console.log(`   Subtask cards: ${subtaskCards.length}`);
		console.log(`   Total: ${totalCards}`);

		// Check columns for card distribution
		const columns = ['backlog', 'ready', 'in-progress', 'review', 'done'];
		for (const column of columns) {
			const columnCards = await page.$$(
				`[data-column="${column}"] .main-task-card, [data-column="${column}"] .subtask-card`
			);
			console.log(`   ${column}: ${columnCards.length} cards`);
		}

		// Check for error messages
		const errorContainer = await page.$('#error-container');
		if (errorContainer) {
			const isVisible = await errorContainer.isVisible();
			if (isVisible) {
				const errorText = await page.textContent('.error-message');
				console.error('❌ Error displayed:', errorText);
			}
		}

		if (totalCards > 0) {
			console.log('\n✅ Cards are being rendered with new design!');

			// Inspect first card
			const allCards = [...mainTaskCards, ...subtaskCards];
			if (allCards.length > 0) {
				const firstCard = allCards[0];
				const taskId = await firstCard.getAttribute('data-task-id');
				const isSubtask = await firstCard.evaluate((el) =>
					el.classList.contains('subtask-card')
				);

				console.log(`\n🎯 First card details:`);
				console.log(`   ID: ${taskId}`);
				console.log(`   Type: ${isSubtask ? 'Subtask' : 'Main Task'}`);

				// Check for badges
				const mainBadge = await firstCard.$('.main-task-badge');
				const parentBadge = await firstCard.$('.parent-task-badge');
				console.log(`   Main badge: ${mainBadge ? 'Yes' : 'No'}`);
				console.log(`   Parent badge: ${parentBadge ? 'Yes' : 'No'}`);
			}
		} else {
			console.log('\n❌ No cards found - checking for errors...');

			// Take screenshot for debugging
			await page.screenshot({ path: 'kanban-debug.png' });
			console.log('📸 Screenshot saved as kanban-debug.png');
		}
	} catch (error) {
		console.error('❌ Test failed:', error.message);
	} finally {
		if (browser) {
			await browser.close();
		}
	}
}

testUIWithDelay();
