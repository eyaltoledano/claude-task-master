import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text, Spacer } from 'ink';
import { useAppContext } from '../../../app/index-root.jsx';
import { DependencyAnalysisService } from '../services/DependencyAnalysisService.js';

/**
 * Dependency Visualizer Screen - Interactive dependency graph visualization
 * Uses D3.js concepts adapted for terminal UI with Ink
 */
export function DependencyVisualizerScreen({ onBack, projectRoot }) {
	const { backend } = useAppContext();
	const [analysisData, setAnalysisData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [selectedNode, setSelectedNode] = useState(null);
	const [viewMode, setViewMode] = useState('overview'); // overview, critical-path, bottlenecks, ready-tasks
	const [autoRefresh, setAutoRefresh] = useState(true);

	const analysisService = useRef(null);
	const refreshInterval = useRef(null);

	// Initialize analysis service
	useEffect(() => {
		const initService = async () => {
			try {
				analysisService.current = new DependencyAnalysisService({
					projectRoot
				});
				await analysisService.current.initialize();

				// Load initial analysis
				await performAnalysis();

				// Set up auto-refresh if enabled
				if (autoRefresh) {
					startAutoRefresh();
				}
			} catch (err) {
				setError(`Failed to initialize: ${err.message}`);
				setLoading(false);
			}
		};

		initService();

		// Cleanup on unmount
		return () => {
			if (refreshInterval.current) {
				clearInterval(refreshInterval.current);
			}
		};
	}, [projectRoot, autoRefresh]);

	// Perform dependency analysis
	const performAnalysis = useCallback(async () => {
		if (!analysisService.current) return;

		try {
			setLoading(true);

			// Get tasks data from backend
			const tasksResult = await backend.getTasks();
			if (!tasksResult.success) {
				throw new Error(tasksResult.error || 'Failed to load tasks');
			}

			// Run analysis
			const analysis = await analysisService.current.analyzeDependencies(
				tasksResult.data
			);

			if (analysis.success) {
				setAnalysisData(analysis);
				setError(null);
			} else {
				setError(analysis.error || 'Analysis failed');
			}
		} catch (err) {
			setError(`Analysis error: ${err.message}`);
		} finally {
			setLoading(false);
		}
	}, [backend]);

	// Start auto-refresh
	const startAutoRefresh = useCallback(() => {
		if (refreshInterval.current) {
			clearInterval(refreshInterval.current);
		}

		refreshInterval.current = setInterval(() => {
			performAnalysis();
		}, 10000); // Refresh every 10 seconds
	}, [performAnalysis]);

	// Handle keyboard input
	const handleInput = useCallback(
		(input, key) => {
			if (key.escape) {
				onBack();
				return;
			}

			switch (input.toLowerCase()) {
				case 'r':
					performAnalysis();
					break;
				case 'a':
					setAutoRefresh(!autoRefresh);
					break;
				case '1':
					setViewMode('overview');
					break;
				case '2':
					setViewMode('critical-path');
					break;
				case '3':
					setViewMode('bottlenecks');
					break;
				case '4':
					setViewMode('ready-tasks');
					break;
				case 'c':
					setSelectedNode(null);
					break;
			}
		},
		[onBack, autoRefresh, performAnalysis]
	);

	// Set up input handling
	useEffect(() => {
		const handleKeyPress = (str, key) => {
			handleInput(str, key);
		};

		process.stdin.on('keypress', handleKeyPress);
		return () => {
			process.stdin.removeListener('keypress', handleKeyPress);
		};
	}, [handleInput]);

	// Render loading state
	if (loading && !analysisData) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold color="blue">
					🔍 Dependency Analysis
				</Text>
				<Text>Loading dependency analysis...</Text>
			</Box>
		);
	}

	// Render error state
	if (error && !analysisData) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold color="red">
					❌ Analysis Error
				</Text>
				<Text>{error}</Text>
				<Text color="gray">Press 'r' to retry, ESC to go back</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" height="100%">
			{/* Header */}
			<Box flexDirection="row" paddingX={1} paddingY={0}>
				<Text bold color="blue">
					🔍 Dependency Analysis
				</Text>
				<Spacer />
				<Text color="gray">
					{loading
						? '⟳ Refreshing...'
						: `Updated: ${new Date(analysisData.timestamp).toLocaleTimeString()}`}
				</Text>
			</Box>

			{/* Controls */}
			<Box
				flexDirection="row"
				paddingX={1}
				borderStyle="single"
				borderColor="gray"
			>
				<Text color="yellow">1:</Text>
				<Text color={viewMode === 'overview' ? 'green' : 'gray'}>Overview</Text>
				<Text> | </Text>
				<Text color="yellow">2:</Text>
				<Text color={viewMode === 'critical-path' ? 'green' : 'gray'}>
					Critical Path
				</Text>
				<Text> | </Text>
				<Text color="yellow">3:</Text>
				<Text color={viewMode === 'bottlenecks' ? 'green' : 'gray'}>
					Bottlenecks
				</Text>
				<Text> | </Text>
				<Text color="yellow">4:</Text>
				<Text color={viewMode === 'ready-tasks' ? 'green' : 'gray'}>
					Ready Tasks
				</Text>
				<Spacer />
				<Text color="yellow">r:</Text>
				<Text color="gray">Refresh</Text>
				<Text> | </Text>
				<Text color="yellow">a:</Text>
				<Text color={autoRefresh ? 'green' : 'gray'}>Auto-refresh</Text>
			</Box>

			{/* Main content */}
			<Box flexDirection="row" flexGrow={1}>
				{/* Graph visualization area */}
				<Box flexDirection="column" flexGrow={1} paddingX={1}>
					{viewMode === 'overview' && <OverviewView data={analysisData} />}
					{viewMode === 'critical-path' && (
						<CriticalPathView data={analysisData} />
					)}
					{viewMode === 'bottlenecks' && (
						<BottlenecksView data={analysisData} />
					)}
					{viewMode === 'ready-tasks' && <ReadyTasksView data={analysisData} />}
				</Box>

				{/* Side panel */}
				<Box
					flexDirection="column"
					width={40}
					borderLeft
					borderColor="gray"
					paddingX={1}
				>
					<SidePanel data={analysisData} selectedNode={selectedNode} />
				</Box>
			</Box>

			{/* Footer */}
			<Box paddingX={1} borderTop borderColor="gray">
				<Text color="gray">ESC: Back | c: Clear selection</Text>
				{error && (
					<>
						<Text> | </Text>
						<Text color="red">Error: {error}</Text>
					</>
				)}
			</Box>
		</Box>
	);
}

/**
 * Overview visualization - shows graph structure and key metrics
 */
function OverviewView({ data }) {
	const { graph, insights, readinessScores } = data;

	return (
		<Box flexDirection="column">
			<Text bold color="cyan">
				📊 Project Overview
			</Text>

			{/* Graph metrics */}
			<Box flexDirection="row" marginY={1}>
				<Box flexDirection="column" marginRight={4}>
					<Text bold>Graph Structure</Text>
					<Text>Tasks: {graph.nodes}</Text>
					<Text>Dependencies: {graph.edges}</Text>
					<Text>Components: {graph.components}</Text>
				</Box>

				<Box flexDirection="column">
					<Text bold>Analysis Performance</Text>
					<Text>Analysis time: {data.analysisTime}ms</Text>
					<Text>Cache hits: {data.cacheHits || 0}</Text>
				</Box>
			</Box>

			{/* Key insights */}
			<Box flexDirection="column" marginY={1}>
				<Text bold color="green">
					💡 Key Insights
				</Text>
				{insights.map((insight, index) => (
					<Box key={`${insight.type}-${index}`} marginLeft={2}>
						<Text color="yellow">• </Text>
						<Text>{insight.message}</Text>
					</Box>
				))}
			</Box>

			{/* ASCII Graph representation */}
			<Box flexDirection="column" marginY={1}>
				<Text bold color="magenta">
					🎯 Task Readiness Heatmap
				</Text>
				<ReadinessHeatmap
					readinessScores={readinessScores}
					graph={data.dependencyGraph || { nodes: [] }}
				/>
			</Box>
		</Box>
	);
}

/**
 * Critical path visualization
 */
function CriticalPathView({ data }) {
	const { criticalPath } = data;

	return (
		<Box flexDirection="column">
			<Text bold color="red">
				🎯 Critical Path Analysis
			</Text>

			{criticalPath.path.length > 0 ? (
				<Box flexDirection="column" marginY={1}>
					<Text>Path Length: {criticalPath.length} tasks</Text>
					<Text>
						Estimated Duration: {criticalPath.estimatedDuration.estimatedDays}{' '}
						days
					</Text>
					<Text>
						Complexity Points: {criticalPath.estimatedDuration.complexityPoints}
					</Text>

					<Box flexDirection="column" marginTop={1}>
						<Text bold>Critical Path Tasks:</Text>
						{criticalPath.path.map((task, index) => (
							<Box key={task.id} flexDirection="row" marginLeft={2}>
								<Text color="yellow">{index + 1}. </Text>
								<Text
									color={
										task.status === 'done'
											? 'green'
											: task.status === 'in-progress'
												? 'yellow'
												: 'white'
									}
								>
									{task.title}
								</Text>
								<Text color="gray">
									{' '}
									(ID: {task.id}, Status: {task.status})
								</Text>
							</Box>
						))}
					</Box>
				</Box>
			) : (
				<Text color="gray">No critical path found</Text>
			)}
		</Box>
	);
}

/**
 * Bottlenecks visualization
 */
function BottlenecksView({ data }) {
	const { bottlenecks } = data;

	return (
		<Box flexDirection="column">
			<Text bold color="red">
				🚧 Bottleneck Analysis
			</Text>

			{bottlenecks.length > 0 ? (
				<Box flexDirection="column" marginY={1}>
					<Text>Found {bottlenecks.length} potential bottlenecks</Text>

					{bottlenecks.map((bottleneck, index) => (
						<Box
							key={bottleneck.task.id}
							flexDirection="column"
							marginTop={1}
							borderStyle="single"
							borderColor="red"
							padding={1}
						>
							<Text bold color="red">
								#{index + 1} {bottleneck.task.title}
							</Text>
							<Text>Severity: {bottleneck.severity.toFixed(1)}/10</Text>
							<Text>Dependents: {bottleneck.dependentCount} tasks</Text>
							<Text>Complexity: {bottleneck.complexity}/10</Text>
							<Text color="yellow">Reason: {bottleneck.reason}</Text>
							<Text color="gray">
								Status: {bottleneck.task.status} | Priority:{' '}
								{bottleneck.task.priority}
							</Text>
						</Box>
					))}
				</Box>
			) : (
				<Text color="green">✅ No bottlenecks detected</Text>
			)}
		</Box>
	);
}

/**
 * Ready tasks visualization
 */
function ReadyTasksView({ data }) {
	const { readyTasks } = data;

	return (
		<Box flexDirection="column">
			<Text bold color="green">
				🚀 Ready for Execution
			</Text>

			{readyTasks.length > 0 ? (
				<Box flexDirection="column" marginY={1}>
					<Text>{readyTasks.length} tasks ready for execution</Text>

					{readyTasks.map((readyTask, index) => (
						<Box
							key={readyTask.task.id}
							flexDirection="column"
							marginTop={1}
							borderStyle="single"
							borderColor="green"
							padding={1}
						>
							<Text bold color="green">
								#{index + 1} {readyTask.task.title}
							</Text>
							<Text>
								Readiness Score: {(readyTask.readinessScore * 100).toFixed(0)}%
							</Text>
							<Text>Dependencies: ✅ All satisfied</Text>
							<Text>
								Complexity: {readyTask.factors?.complexity || 'Unknown'}/10
							</Text>
							<Text>Priority: {readyTask.task.priority}</Text>
							<Text color="gray">
								Status: {readyTask.task.status} | Tag: {readyTask.task.tag}
							</Text>
						</Box>
					))}
				</Box>
			) : (
				<Text color="yellow">⏳ No tasks ready for execution</Text>
			)}
		</Box>
	);
}

/**
 * Side panel with detailed information
 */
function SidePanel({ data, selectedNode }) {
	const { recommendations, circularDependencies } = data;

	return (
		<Box flexDirection="column">
			<Text bold color="blue">
				📋 Analysis Summary
			</Text>

			{/* Recommendations */}
			<Box flexDirection="column" marginY={1}>
				<Text bold color="green">
					💡 Recommendations
				</Text>
				{recommendations.length > 0 ? (
					recommendations.map((rec, index) => (
						<Box
							key={`${rec.type}-${rec.priority}-${index}`}
							flexDirection="column"
							marginTop={1}
							borderStyle="single"
							borderColor="green"
							padding={1}
						>
							<Text bold color="green">
								{rec.type.toUpperCase()}
							</Text>
							<Text>{rec.message}</Text>
							<Text color="gray">Priority: {rec.priority}</Text>
						</Box>
					))
				) : (
					<Text color="gray">No recommendations available</Text>
				)}
			</Box>

			{/* Circular dependencies */}
			{circularDependencies.length > 0 && (
				<Box flexDirection="column" marginY={1}>
					<Text bold color="red">
						⚠️ Circular Dependencies
					</Text>
					{circularDependencies.map((cycle, index) => (
						<Box
							key={`cycle-${cycle.map((t) => t.id).join('-')}-${index}`}
							flexDirection="column"
							marginTop={1}
							borderStyle="single"
							borderColor="red"
							padding={1}
						>
							<Text bold color="red">
								Cycle #{index + 1}
							</Text>
							{cycle.map((task, taskIndex) => (
								<Text key={task.id} color="yellow">
									{taskIndex + 1}. {task.title} (ID: {task.id})
								</Text>
							))}
						</Box>
					))}
				</Box>
			)}

			{/* Selected node details */}
			{selectedNode && (
				<Box flexDirection="column" marginY={1}>
					<Text bold color="cyan">
						🔍 Selected Task
					</Text>
					<Box borderStyle="single" borderColor="cyan" padding={1}>
						<Text bold>{selectedNode.title}</Text>
						<Text>ID: {selectedNode.id}</Text>
						<Text>Status: {selectedNode.status}</Text>
						<Text>Priority: {selectedNode.priority}</Text>
						<Text>Tag: {selectedNode.tag}</Text>
					</Box>
				</Box>
			)}
		</Box>
	);
}

/**
 * ASCII readiness heatmap visualization
 */
function ReadinessHeatmap({ readinessScores, graph }) {
	const nodes = graph.nodes || [];

	// Group nodes by readiness score ranges
	const scoreRanges = {
		high: [], // 0.8-1.0
		medium: [], // 0.5-0.8
		low: [], // 0.2-0.5
		blocked: [] // 0.0-0.2
	};

	for (const node of nodes) {
		const score = readinessScores.get(node.id);
		if (!score || score.totalScore === 0) {
			scoreRanges.blocked.push(node);
		} else if (score.totalScore >= 0.8) {
			scoreRanges.high.push(node);
		} else if (score.totalScore >= 0.5) {
			scoreRanges.medium.push(node);
		} else {
			scoreRanges.low.push(node);
		}
	}

	return (
		<Box flexDirection="column" marginLeft={2}>
			<Box flexDirection="row">
				<Text color="green">🟢 High ({scoreRanges.high.length}): </Text>
				<Text>
					{scoreRanges.high
						.slice(0, 3)
						.map((n) => n.id)
						.join(', ')}
				</Text>
				{scoreRanges.high.length > 3 && (
					<Text color="gray"> +{scoreRanges.high.length - 3} more</Text>
				)}
			</Box>

			<Box flexDirection="row">
				<Text color="yellow">🟡 Medium ({scoreRanges.medium.length}): </Text>
				<Text>
					{scoreRanges.medium
						.slice(0, 3)
						.map((n) => n.id)
						.join(', ')}
				</Text>
				{scoreRanges.medium.length > 3 && (
					<Text color="gray"> +{scoreRanges.medium.length - 3} more</Text>
				)}
			</Box>

			<Box flexDirection="row">
				<Text color="red">🔴 Low ({scoreRanges.low.length}): </Text>
				<Text>
					{scoreRanges.low
						.slice(0, 3)
						.map((n) => n.id)
						.join(', ')}
				</Text>
				{scoreRanges.low.length > 3 && (
					<Text color="gray"> +{scoreRanges.low.length - 3} more</Text>
				)}
			</Box>

			<Box flexDirection="row">
				<Text color="gray">⚫ Blocked ({scoreRanges.blocked.length}): </Text>
				<Text>
					{scoreRanges.blocked
						.slice(0, 3)
						.map((n) => n.id)
						.join(', ')}
				</Text>
				{scoreRanges.blocked.length > 3 && (
					<Text color="gray"> +{scoreRanges.blocked.length - 3} more</Text>
				)}
			</Box>
		</Box>
	);
}
