import blessed from 'blessed';
import contrib from 'blessed-contrib';

function createMainDashboard(screen) {
	const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

	const agentActivity = grid.set(0, 0, 4, 6, contrib.line, {
		style: { line: 'yellow', text: 'green', baseline: 'black' },
		xLabelPadding: 3,
		xPadding: 5,
		showLegend: true,
		wholeNumbersOnly: false,
		label: 'Agent Activity (Requests/min)'
	});

	const sandboxStatus = grid.set(0, 6, 4, 3, contrib.donut, {
		label: 'Sandbox Status',
		radius: 8,
		arcWidth: 3,
		remainColor: 'black',
		yPadding: 2,
		data: [
			{ percent: 60, label: 'Active', color: 'green' },
			{ percent: 25, label: 'Starting', color: 'yellow' },
			{ percent: 10, label: 'Stopping', color: 'blue' },
			{ percent: 5, label: 'Failed', color: 'red' }
		]
	});

	const gitOps = grid.set(0, 9, 4, 3, contrib.bar, {
		label: 'Git Operations (Last Hour)',
		barWidth: 4,
		barSpacing: 6,
		xOffset: 0,
		maxHeight: 9
	});

	const requestLog = grid.set(4, 0, 4, 8, contrib.log, {
		fg: 'green',
		selectedFg: 'green',
		label: 'Live Agent Requests',
		height: '100%',
		tags: true,
		border: { type: 'line', fg: 'cyan' }
	});

	const metricsTable = grid.set(4, 8, 4, 4, contrib.table, {
		keys: true,
		fg: 'white',
		selectedFg: 'white',
		selectedBg: 'blue',
		interactive: true,
		label: 'Key Metrics',
		width: '30%',
		height: '30%',
		border: { type: 'line', fg: 'cyan' },
		columnSpacing: 3,
		columnWidth: [20, 12]
	});

	const errorGauge = grid.set(8, 0, 4, 3, contrib.gauge, {
		label: 'Error Rate %',
		stroke: 'green',
		fill: 'white',
		width: '100%',
		height: '100%',
		percent: 0
	});

	const responseTime = grid.set(8, 3, 2, 6, contrib.sparkline, {
		label: 'Response Time (ms)',
		tags: true,
		style: { fg: 'blue' }
	});

	const envHealth = grid.set(10, 3, 2, 6, contrib.lcd, {
		segmentWidth: 0.06,
		segmentInterval: 0.11,
		strokeWidth: 0.11,
		elements: 4,
		display: 3254,
		elementSpacing: 4,
		elementPadding: 2,
		color: 'green',
		label: 'Healthy Environments'
	});

	const statusMap = grid.set(8, 9, 4, 3, contrib.map, {
		label: 'Regional Status'
	});

	const updateDashboard = (telemetryData) => {
		// Implement updates based on telemetryData
		// For now, using sample data
		const sampleData = {
			timestamps: ['00:00', '00:05', '00:10', '00:15', '00:20'],
			codexRequests: [12, 15, 18, 14, 20],
			claudeRequests: [8, 10, 12, 11, 15],
			gitCommits: 45,
			gitPRs: 12,
			gitBranches: 8,
			totalRequests: '1,234',
			avgResponse: 342,
			activeSandboxes: '12',
			successRate: 98.5,
			cacheHitRate: 76.2,
			errorRate: 1.5,
			responseTimes: [320, 345, 310, 380, 342, 325, 360],
			healthyEnvironments: 12,
			latestRequest: `{green-fg}[${new Date().toISOString()}]{/green-fg} Agent: Codex | Action: Generate | Status: Success | Duration: 342ms`
		};

		agentActivity.setData([
			{
				title: 'Codex',
				x: sampleData.timestamps,
				y: sampleData.codexRequests,
				style: { line: 'yellow' }
			},
			{
				title: 'Claude',
				x: sampleData.timestamps,
				y: sampleData.claudeRequests,
				style: { line: 'cyan' }
			}
		]);

		gitOps.setData({
			titles: ['Commits', 'PRs', 'Branches'],
			data: [sampleData.gitCommits, sampleData.gitPRs, sampleData.gitBranches]
		});

		metricsTable.setData({
			headers: ['Metric', 'Value'],
			data: [
				['Total Requests', sampleData.totalRequests],
				['Avg Response', `${sampleData.avgResponse}ms`],
				['Active Sandboxes', sampleData.activeSandboxes],
				['Success Rate', `${sampleData.successRate}%`],
				['Cache Hit Rate', `${sampleData.cacheHitRate}%`]
			]
		});

		errorGauge.setPercent(sampleData.errorRate);

		responseTime.setData(['Avg Response Time'], [sampleData.responseTimes]);

		envHealth.setDisplay(sampleData.healthyEnvironments);

		if (sampleData.latestRequest) {
			requestLog.log(sampleData.latestRequest);
		}

		screen.render();
	};

	return {
		updateDashboard,
		components: {
			agentActivity,
			sandboxStatus,
			gitOps,
			requestLog,
			metricsTable,
			errorGauge,
			responseTime,
			envHealth,
			statusMap
		}
	};
}

export { createMainDashboard };
