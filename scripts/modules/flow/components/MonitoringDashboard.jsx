/**
 * Real-Time Monitoring Dashboard for Claude Code Workflow Automation
 * Provides comprehensive visibility into system health and performance
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, Spacer } from 'ink';
import { useTheme } from '../contexts/ThemeContext.jsx';

export const MonitoringDashboard = ({ 
	serviceMesh, 
	workflowStateManager, 
	prMonitoringService,
	cleanupService,
	refreshInterval = 2000 
}) => {
	const { theme } = useTheme();
	const [metrics, setMetrics] = useState({
		services: {},
		workflows: [],
		prMonitoring: {},
		system: {},
		performance: {}
	});
	const [lastUpdate, setLastUpdate] = useState(Date.now());

	// Real-time metrics collection
	useEffect(() => {
		const collectMetrics = async () => {
			try {
				const newMetrics = {
					services: serviceMesh?.getServiceMetrics() || {},
					workflows: workflowStateManager?.getActiveWorkflows() || [],
					workflowHistory: workflowStateManager?.getWorkflowHistory(5) || [],
					prMonitoring: prMonitoringService?.getStats() || {},
					system: await getSystemMetrics(),
					performance: await getPerformanceMetrics(),
					timestamp: Date.now()
				};

				setMetrics(newMetrics);
				setLastUpdate(Date.now());
			} catch (error) {
				console.warn('Failed to collect metrics:', error.message);
			}
		};

		// Initial collection
		collectMetrics();

		// Set up interval
		const interval = setInterval(collectMetrics, refreshInterval);

		return () => clearInterval(interval);
	}, [serviceMesh, workflowStateManager, prMonitoringService, refreshInterval]);

	const formatUptime = (startTime) => {
		const uptime = Date.now() - startTime;
		const seconds = Math.floor(uptime / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		
		if (hours > 0) return `${hours}h ${minutes % 60}m`;
		if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
		return `${seconds}s`;
	};

	const getHealthColor = (healthy) => {
		return healthy ? theme.success : theme.error;
	};

	const getStatusIcon = (status) => {
		switch (status) {
			case 'healthy':
			case 'completed':
			case 'success':
				return '✅';
			case 'warning':
			case 'running':
			case 'in-progress':
				return '⚠️';
			case 'error':
			case 'failed':
			case 'unhealthy':
				return '❌';
			default:
				return '⚫';
		}
	};

	return (
		<Box flexDirection="column" padding={1}>
			{/* Header */}
			<Box flexDirection="row" marginBottom={1}>
				<Text color={theme.primary} bold>
					🔍 Real-Time Monitoring Dashboard
				</Text>
				<Spacer />
				<Text color={theme.muted}>
					Last updated: {new Date(lastUpdate).toLocaleTimeString()}
				</Text>
			</Box>

			{/* System Overview */}
			<Box flexDirection="row" marginBottom={1}>
				<Box flexDirection="column" width="50%">
					<Text color={theme.secondary} bold>📊 System Overview</Text>
					<Box marginLeft={2}>
						<Text>
							Uptime: {formatUptime(metrics.system.startTime || Date.now())}
						</Text>
						<Text>
							CPU: {(metrics.performance.cpu || 0).toFixed(1)}%
						</Text>
						<Text>
							Memory: {Math.round((metrics.performance.memory || 0) / 1024 / 1024)}MB
						</Text>
						<Text>
							Active Workflows: {metrics.workflows.length}
						</Text>
					</Box>
				</Box>

				<Box flexDirection="column" width="50%">
					<Text color={theme.secondary} bold>🔧 Service Health</Text>
					<Box marginLeft={2}>
						{Object.entries(metrics.services).map(([serviceName, serviceData]) => (
							<Text key={serviceName}>
								{getStatusIcon(serviceData.service?.healthy ? 'healthy' : 'unhealthy')} 
								{serviceName}: {serviceData.service?.healthy ? 'Healthy' : 'Unhealthy'}
							</Text>
						))}
						{Object.keys(metrics.services).length === 0 && (
							<Text color={theme.muted}>No services registered</Text>
						)}
					</Box>
				</Box>
			</Box>

			{/* Active Workflows */}
			<Box flexDirection="column" marginBottom={1}>
				<Text color={theme.secondary} bold>🚀 Active Workflows</Text>
				<Box marginLeft={2}>
					{metrics.workflows.length > 0 ? (
						metrics.workflows.map((workflow) => (
							<Box key={workflow.id} flexDirection="row" marginBottom={0}>
								<Text width={20}>
									{getStatusIcon(workflow.state)} {workflow.id}
								</Text>
								<Text width={15}>
									{workflow.state}
								</Text>
								<Text width={15}>
									Phase: {workflow.currentPhase?.name || 'None'}
								</Text>
								<Text>
									Duration: {formatUptime(workflow.startTime)}
								</Text>
							</Box>
						))
					) : (
						<Text color={theme.muted}>No active workflows</Text>
					)}
				</Box>
			</Box>

			{/* Recent Workflow History */}
			<Box flexDirection="column" marginBottom={1}>
				<Text color={theme.secondary} bold>📜 Recent Completions</Text>
				<Box marginLeft={2}>
					{metrics.workflowHistory.length > 0 ? (
						metrics.workflowHistory.map((workflow) => (
							<Box key={workflow.id} flexDirection="row" marginBottom={0}>
								<Text width={20}>
									{getStatusIcon(workflow.state)} {workflow.id}
								</Text>
								<Text width={15}>
									{workflow.state}
								</Text>
								<Text width={15}>
									Duration: {workflow.duration ? `${Math.round(workflow.duration / 1000)}s` : 'N/A'}
								</Text>
								<Text>
									Completed: {new Date(workflow.completedAt).toLocaleTimeString()}
								</Text>
							</Box>
						))
					) : (
						<Text color={theme.muted}>No recent completions</Text>
					)}
				</Box>
			</Box>

			{/* PR Monitoring Status */}
			<Box flexDirection="column" marginBottom={1}>
				<Text color={theme.secondary} bold>📋 PR Monitoring</Text>
				<Box marginLeft={2}>
					<Text>
						Monitored PRs: {metrics.prMonitoring.monitoredPRs || 0}
					</Text>
					<Text>
						Auto-Merge Eligible: {metrics.prMonitoring.autoMergeEligible || 0}
					</Text>
					<Text>
						Failed Checks: {metrics.prMonitoring.failedChecks || 0}
					</Text>
					<Text>
						Recent Merges: {metrics.prMonitoring.recentMerges || 0}
					</Text>
				</Box>
			</Box>

			{/* Service Performance Metrics */}
			<Box flexDirection="column" marginBottom={1}>
				<Text color={theme.secondary} bold>⚡ Performance Metrics</Text>
				<Box marginLeft={2}>
					{Object.entries(metrics.services).map(([serviceName, serviceData]) => {
						const serviceMetrics = serviceData.metrics;
						if (!serviceMetrics || serviceMetrics.requests === 0) return null;

						const successRate = ((serviceMetrics.successes / serviceMetrics.requests) * 100).toFixed(1);
						const avgResponseTime = serviceMetrics.averageResponseTime.toFixed(0);

						return (
							<Box key={serviceName} flexDirection="row" marginBottom={0}>
								<Text width={20}>{serviceName}:</Text>
								<Text width={15}>
									{serviceMetrics.requests} reqs
								</Text>
								<Text width={15}>
									{successRate}% success
								</Text>
								<Text>
									{avgResponseTime}ms avg
								</Text>
							</Box>
						);
					})}
				</Box>
			</Box>

			{/* Circuit Breaker Status */}
			<Box flexDirection="column" marginBottom={1}>
				<Text color={theme.secondary} bold>🔌 Circuit Breakers</Text>
				<Box marginLeft={2}>
					{Object.entries(metrics.services).map(([serviceName, serviceData]) => {
						const circuitBreaker = serviceData.circuitBreaker;
						if (!circuitBreaker) return null;

						const stateColor = circuitBreaker.state === 'closed' ? theme.success :
							circuitBreaker.state === 'open' ? theme.error : theme.warning;

						return (
							<Box key={serviceName} flexDirection="row" marginBottom={0}>
								<Text width={20}>{serviceName}:</Text>
								<Text color={stateColor} width={15}>
									{circuitBreaker.state.toUpperCase()}
								</Text>
								<Text>
									Failures: {circuitBreaker.failureCount}
								</Text>
							</Box>
						);
					})}
				</Box>
			</Box>

			{/* Footer */}
			<Box flexDirection="row" marginTop={1} paddingTop={1} borderStyle="single" borderTop>
				<Text color={theme.muted}>
					Press 'r' to refresh • Press 'q' to quit monitoring
				</Text>
			</Box>
		</Box>
	);
};

// Helper function to get system metrics
async function getSystemMetrics() {
	try {
		const process = await import('process');
		return {
			startTime: Date.now() - (process.uptime() * 1000),
			nodeVersion: process.version,
			platform: process.platform,
			arch: process.arch
		};
	} catch (error) {
		return {};
	}
}

// Helper function to get performance metrics
async function getPerformanceMetrics() {
	try {
		const process = await import('process');
		const memoryUsage = process.memoryUsage();
		const cpuUsage = process.cpuUsage();

		return {
			memory: memoryUsage.heapUsed,
			memoryTotal: memoryUsage.heapTotal,
			cpu: 0, // CPU calculation would need more complex implementation
			uptime: process.uptime()
		};
	} catch (error) {
		return {};
	}
}

export default MonitoringDashboard; 