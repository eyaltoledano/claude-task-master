import http from 'http';

function makeRequest(url) {
	return new Promise((resolve, reject) => {
		const req = http.get(url, (res) => {
			let data = '';
			res.on('data', (chunk) => {
				data += chunk;
			});
			res.on('end', () => {
				resolve(data);
			});
		});
		req.on('error', reject);
		req.setTimeout(5000, () => {
			req.destroy();
			reject(new Error('Request timeout'));
		});
	});
}

async function testUI() {
	console.log('Testing Kanban UI...');

	try {
		// Test API endpoint
		console.log('\n📡 Testing API endpoint...');
		const apiResponse = await makeRequest('http://localhost:3456/api/tasks');
		const tasks = JSON.parse(apiResponse);
		console.log(`✓ API returned ${tasks.tasks.length} tasks`);

		// Test main page
		console.log('\n🌐 Testing main page...');
		const htmlResponse = await makeRequest('http://localhost:3456');

		// Check for new card types in the static HTML (won't be there initially)
		const mainTaskCards = (htmlResponse.match(/main-task-card/g) || []).length;
		const subtaskCards = (htmlResponse.match(/subtask-card/g) || []).length;

		console.log(`📋 Cards found in static HTML:`);
		console.log(`   Main task cards: ${mainTaskCards}`);
		console.log(`   Subtask cards: ${subtaskCards}`);
		console.log(`   Total: ${mainTaskCards + subtaskCards}`);

		// Check for JavaScript files
		const hasKanbanJS = htmlResponse.includes('js/kanban.js');
		const hasTaskCardJS = htmlResponse.includes('js/components/taskCard.js');

		console.log(`\n🔧 JavaScript files referenced:`);
		console.log(`   kanban.js: ${hasKanbanJS ? '✓' : '✗'}`);
		console.log(`   taskCard.js: ${hasTaskCardJS ? '✓' : '✗'}`);

		// Check for CSS files
		const hasMainCSS = htmlResponse.includes('css/main.css');
		const hasKanbanCSS = htmlResponse.includes('css/kanban.css');
		const hasTaskCardCSS = htmlResponse.includes('css/components/taskCard.css');

		console.log(`\n🎨 CSS files referenced:`);
		console.log(`   main.css: ${hasMainCSS ? '✓' : '✗'}`);
		console.log(`   kanban.css: ${hasKanbanCSS ? '✓' : '✗'}`);
		console.log(`   taskCard.css: ${hasTaskCardCSS ? '✓' : '✗'}`);

		// Check if the kanban board structure exists
		const hasKanbanBoard = htmlResponse.includes('kanban-board');
		const hasColumns = htmlResponse.includes('data-column');

		console.log(`\n📊 Board structure:`);
		console.log(`   Kanban board: ${hasKanbanBoard ? '✓' : '✗'}`);
		console.log(`   Columns: ${hasColumns ? '✓' : '✗'}`);

		console.log('\n✅ UI test completed');
	} catch (error) {
		console.error('❌ Test failed:', error.message);
	}
}

testUI();
