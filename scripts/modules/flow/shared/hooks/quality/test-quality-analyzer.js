#!/usr/bin/env node

import { CodeQualityAnalyzer } from './code-quality-analyzer.js';
import { formatForConsole } from './quality-insights-formatter.js';

/**
 * Simple test for the code quality analyzer
 */
async function testQualityAnalyzer() {
	console.log('🧪 Testing Code Quality Analyzer...\n');

	const analyzer = new CodeQualityAnalyzer();

	// Mock test data
	const mockChanges = [
		{
			path: 'src/components/TodoList.jsx',
			status: 'M',
			content: `import React, { useState, useEffect } from 'react';

// TODO: Add proper error handling
export function TodoList({ todos, onToggle, onDelete }) {
	const [filter, setFilter] = useState('all');
	
	// Complex function with high complexity
	const processItems = (items) => {
		if (!items) return [];
		
		let result = [];
		for (let i = 0; i < items.length; i++) {
			if (items[i].completed && filter === 'active') {
				continue;
			} else if (!items[i].completed && filter === 'completed') {
				continue;
			} else if (filter === 'all' || 
					  (filter === 'active' && !items[i].completed) ||
					  (filter === 'completed' && items[i].completed)) {
				if (items[i].text.length > 0) {
					result.push({
						...items[i],
						displayText: items[i].text.trim()
					});
				}
			}
		}
		return result;
	};

	const filteredTodos = processItems(todos);
	
	return (
		<div className="todo-list">
			<div className="filters">
				<button onClick={() => setFilter('all')}>All</button>
				<button onClick={() => setFilter('active')}>Active</button>
				<button onClick={() => setFilter('completed')}>Completed</button>
			</div>
			{filteredTodos.map(todo => (
				<div key={todo.id} className="todo-item">
					<input 
						type="checkbox" 
						checked={todo.completed}
						onChange={() => onToggle(todo.id)}
					/>
					<span>{todo.displayText}</span>
					<button onClick={() => onDelete(todo.id)}>Delete</button>
				</div>
			))}
		</div>
	);
}`,
			size: 1200
		},
		{
			path: 'src/utils/helpers.js',
			status: 'A',
			content: `// Simple utility functions
export const formatDate = (date) => {
	return new Date(date).toLocaleDateString();
};

export const validateEmail = (email) => {
	const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return regex.test(email);
};

export const debounce = (func, wait) => {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
};`,
			size: 400
		}
	];

	// Mock task
	const mockTask = {
		id: '5.2',
		title: 'Implement Todo List Component',
		description: 'Create a React component for displaying and filtering todos',
		details:
			'Should include filtering, toggle functionality, and delete capability',
		isSubtask: true
	};

	// Test individual file analysis
	console.log('📁 Testing individual file analysis...');
	for (const change of mockChanges) {
		const fileAnalysis = await analyzer.analyzeFile(change, mockTask);
		console.log(`\n${change.path}:`);
		console.log(`  Language: ${fileAnalysis.language}`);
		console.log(`  Lines: ${fileAnalysis.metrics.linesOfCode}`);
		console.log(
			`  Complexity: ${fileAnalysis.metrics.complexity?.cyclomaticComplexity} (${fileAnalysis.metrics.complexity?.complexityLevel})`
		);

		if (fileAnalysis.jsMetrics) {
			console.log(`  Functions: ${fileAnalysis.jsMetrics.functionCount}`);
			console.log(`  Imports: ${fileAnalysis.jsMetrics.importCount}`);
			console.log(`  TODOs: ${fileAnalysis.jsMetrics.todoComments}`);
		}
	}

	// Test aggregate analysis
	console.log('\n📊 Testing aggregate analysis...');
	const mockAnalysis = {
		hasChanges: true,
		fileCount: mockChanges.length,
		totalLines: mockChanges.reduce(
			(sum, c) => sum + c.content.split('\n').length,
			0
		),
		analysisTime: 45,
		timestamp: new Date().toISOString(),
		files: []
	};

	// Analyze each file
	for (const change of mockChanges) {
		const fileAnalysis = await analyzer.analyzeFile(change, mockTask);
		mockAnalysis.files.push(fileAnalysis);
	}

	// Calculate aggregate metrics
	mockAnalysis.aggregateMetrics = analyzer.calculateAggregateMetrics(
		mockAnalysis.files
	);

	// Mock task alignment
	mockAnalysis.taskAlignment = {
		keywordCoverage: 0.75,
		foundKeywords: ['todo', 'component', 'react', 'filtering'],
		missedKeywords: ['toggle'],
		relevantFileRatio: 1.0,
		implementationScope: 'medium'
	};

	// Mock lint results (no actual Biome run)
	mockAnalysis.lintResults = {
		available: true,
		filesChecked: 2,
		issues: [
			{
				severity: 'warning',
				message:
					'Prefer const over let for variables that are never reassigned',
				file: 'src/components/TodoList.jsx',
				line: 15
			}
		],
		errorCount: 0,
		warningCount: 1
	};

	// Calculate overall score
	mockAnalysis.overallScore = analyzer.calculateOverallScore(mockAnalysis);

	// Test formatting
	console.log('\n🎨 Testing quality report formatting...');
	const consoleOutput = formatForConsole(mockAnalysis);
	console.log('\n' + consoleOutput);

	console.log('\n✅ Quality analyzer test completed!');
	console.log(`\nOverall Score: ${mockAnalysis.overallScore}/10`);
	console.log(`Files Analyzed: ${mockAnalysis.fileCount}`);
	console.log(`Total Lines: ${mockAnalysis.aggregateMetrics.totalLinesOfCode}`);
	console.log(
		`Average Complexity: ${mockAnalysis.aggregateMetrics.averageComplexity.toFixed(1)}`
	);
}

// Run the test
testQualityAnalyzer().catch(console.error);
