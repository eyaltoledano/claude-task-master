import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';

/**
 * Dependency Analysis Service - Analyzes task relationships and readiness
 * Provides real-time dependency analysis with readiness scoring
 */
export class DependencyAnalysisService extends EventEmitter {
	constructor(options = {}) {
		super();
		
		this.projectRoot = options.projectRoot || process.cwd();
		this.config = {
			// Readiness scoring weights
			weights: {
				dependency: 0.8,    // Dependencies satisfied
				complexity: 0.6,    // Manageable complexity  
				context: 0.9,       // Related to recent work
				priority: 0.7       // Business priority
			},
			// Analysis settings
			realTimeUpdates: true,
			cacheResults: true,
			maxAnalysisTime: 5000, // 5 seconds max
			...options
		};
		
		// Internal state
		this.dependencyGraph = null;
		this.readinessScores = new Map();
		this.analysisCache = new Map();
		this.lastAnalysis = null;
		this.complexityReport = null;
		
		// Performance tracking
		this.stats = {
			analysisCount: 0,
			cacheHits: 0,
			averageAnalysisTime: 0,
			lastAnalysisTime: 0
		};
	}

	/**
	 * Initialize the service and load complexity data
	 */
	async initialize() {
		try {
			// Load existing complexity report if available
			await this.loadComplexityReport();
			
			console.log('🔍 Dependency Analysis Service initialized');
			return { success: true };
		} catch (error) {
			console.error('Failed to initialize dependency analysis:', error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Load complexity report from Phase 4
	 */
	async loadComplexityReport() {
		try {
			const reportPath = path.join(this.projectRoot, '.taskmaster', 'reports', 'task-complexity-report.json');
			const reportData = await fs.readFile(reportPath, 'utf8');
			this.complexityReport = JSON.parse(reportData);
			console.log('📊 Loaded complexity report for dependency analysis');
		} catch (error) {
			console.log('📊 No complexity report found, will use default complexity scoring');
			this.complexityReport = null;
		}
	}

	/**
	 * Analyze dependencies for all tasks across all tags
	 */
	async analyzeDependencies(tasksData, options = {}) {
		const startTime = Date.now();
		
		try {
			// Create cache key
			const cacheKey = this.createCacheKey(tasksData, options);
			
			// Check cache if enabled
			if (this.config.cacheResults && this.analysisCache.has(cacheKey)) {
				this.stats.cacheHits++;
				return this.analysisCache.get(cacheKey);
			}

			// Build dependency graph
			const graph = this.buildDependencyGraph(tasksData);
			
			// Calculate readiness scores
			const readinessScores = await this.calculateReadinessScores(tasksData, graph);
			
			// Find critical path
			const criticalPath = this.findCriticalPath(graph);
			
			// Detect bottlenecks
			const bottlenecks = this.detectBottlenecks(graph);
			
			// Find ready tasks
			const readyTasks = this.findReadyTasks(tasksData, graph, readinessScores);
			
			// Detect circular dependencies
			const circularDependencies = this.detectCircularDependencies(graph);
			
			const analysisTime = Date.now() - startTime;
			
			const result = {
				success: true,
				timestamp: new Date().toISOString(),
				analysisTime,
				graph: {
					nodes: graph.nodes.length,
					edges: graph.edges.length,
					components: graph.components || 1
				},
				readinessScores,
				criticalPath,
				bottlenecks,
				readyTasks,
				circularDependencies,
				insights: this.generateInsights(graph, readinessScores, criticalPath, bottlenecks),
				recommendations: this.generateRecommendations(readyTasks, bottlenecks)
			};

			// Cache result
			if (this.config.cacheResults) {
				this.analysisCache.set(cacheKey, result);
			}

			// Update stats
			this.updateStats(analysisTime);
			this.lastAnalysis = result;
			this.dependencyGraph = graph;

			// Emit analysis complete event
			this.emit('analysis:complete', result);

			return result;

		} catch (error) {
			const analysisTime = Date.now() - startTime;
			console.error('Dependency analysis failed:', error);
			
			return {
				success: false,
				error: error.message,
				analysisTime,
				timestamp: new Date().toISOString()
			};
		}
	}

	/**
	 * Build dependency graph from tasks data
	 */
	buildDependencyGraph(tasksData) {
		const nodes = [];
		const edges = [];
		const nodeMap = new Map();

		// Collect all tasks from all tags
		const allTasks = [];
		
		if (tasksData.tags) {
			// New tagged format
			for (const [tagName, tagData] of Object.entries(tasksData.tags)) {
				if (tagData.tasks) {
					for (const task of tagData.tasks) {
						allTasks.push({ ...task, tag: tagName });
					}
				}
			}
		} else if (tasksData.tasks) {
			// Legacy format
			allTasks.push(...tasksData.tasks.map(task => ({ ...task, tag: 'master' })));
		}

		// Create nodes
		for (const task of allTasks) {
			const node = {
				id: task.id,
				title: task.title,
				status: task.status,
				priority: task.priority || 'medium',
				tag: task.tag,
				complexity: this.getTaskComplexity(task.id),
				subtasks: task.subtasks || []
			};
			
			nodes.push(node);
			nodeMap.set(task.id, node);

			// Add subtask nodes
			if (task.subtasks) {
				for (const subtask of task.subtasks) {
					const subtaskNode = {
						id: subtask.id,
						title: subtask.title,
						status: subtask.status,
						priority: subtask.priority || task.priority || 'medium',
						tag: task.tag,
						parent: task.id,
						isSubtask: true,
						complexity: this.getTaskComplexity(subtask.id)
					};
					
					nodes.push(subtaskNode);
					nodeMap.set(subtask.id, subtaskNode);
				}
			}
		}

		// Create edges from dependencies
		for (const task of allTasks) {
			if (task.dependencies && task.dependencies.length > 0) {
				for (const depId of task.dependencies) {
					if (nodeMap.has(depId)) {
						edges.push({
							from: depId,
							to: task.id,
							type: 'dependency'
						});
					}
				}
			}

			// Add parent-child edges for subtasks
			if (task.subtasks) {
				for (const subtask of task.subtasks) {
					edges.push({
						from: task.id,
						to: subtask.id,
						type: 'parent-child'
					});

					// Add subtask dependencies
					if (subtask.dependencies) {
						for (const depId of subtask.dependencies) {
							if (nodeMap.has(depId)) {
								edges.push({
									from: depId,
									to: subtask.id,
									type: 'dependency'
								});
							}
						}
					}
				}
			}
		}

		return {
			nodes,
			edges,
			nodeMap,
			timestamp: new Date().toISOString()
		};
	}

	/**
	 * Calculate readiness scores for all tasks
	 */
	async calculateReadinessScores(tasksData, graph) {
		const scores = new Map();

		for (const node of graph.nodes) {
			const score = await this.scoreTaskReadiness(node, graph);
			scores.set(node.id, score);
		}

		return scores;
	}

	/**
	 * Score individual task readiness
	 */
	async scoreTaskReadiness(task, graph) {
		try {
			// Skip completed or cancelled tasks
			if (task.status === 'done' || task.status === 'cancelled') {
				return {
					totalScore: 0,
					dependencyScore: 0,
					complexityScore: 0,
					contextScore: 0,
					priorityScore: 0,
					reason: `Task is ${task.status}`
				};
			}

			// Calculate individual scores
			const dependencyScore = this.calculateDependencyScore(task, graph);
			const complexityScore = this.calculateComplexityScore(task);
			const contextScore = await this.calculateContextScore(task);
			const priorityScore = this.calculatePriorityScore(task);

			// Calculate weighted total
			const weights = this.config.weights;
			const totalScore = (
				dependencyScore * weights.dependency +
				complexityScore * weights.complexity +
				contextScore * weights.context +
				priorityScore * weights.priority
			) / (weights.dependency + weights.complexity + weights.context + weights.priority);

			return {
				totalScore: Math.round(totalScore * 100) / 100,
				dependencyScore: Math.round(dependencyScore * 100) / 100,
				complexityScore: Math.round(complexityScore * 100) / 100,
				contextScore: Math.round(contextScore * 100) / 100,
				priorityScore: Math.round(priorityScore * 100) / 100,
				factors: {
					dependencies: this.getDependencyStatus(task, graph),
					complexity: this.getTaskComplexity(task.id),
					priority: task.priority
				}
			};

		} catch (error) {
			console.error(`Error scoring task ${task.id}:`, error);
			return {
				totalScore: 0,
				error: error.message
			};
		}
	}

	/**
	 * Calculate dependency satisfaction score (0-1)
	 */
	calculateDependencyScore(task, graph) {
		const dependencies = this.getTaskDependencies(task, graph);
		
		if (dependencies.length === 0) {
			return 1.0; // No dependencies = fully ready
		}

		const completedDeps = dependencies.filter(dep => 
			dep.status === 'done' || dep.status === 'completed'
		).length;

		return completedDeps / dependencies.length;
	}

	/**
	 * Calculate complexity manageability score (0-1)
	 */
	calculateComplexityScore(task) {
		const complexity = this.getTaskComplexity(task.id);
		
		// Convert complexity (1-10) to manageability score (1-0)
		// Lower complexity = higher manageability score
		return Math.max(0, (10 - complexity) / 9);
	}

	/**
	 * Calculate context relevance score (0-1)
	 */
	async calculateContextScore(task) {
		// For now, use simple heuristics
		// In future, could analyze git commits, active branches, etc.
		
		let score = 0.5; // Base score
		
		// Higher score for higher priority tasks
		if (task.priority === 'high') score += 0.3;
		else if (task.priority === 'medium') score += 0.1;
		
		// Higher score for tasks in active development
		if (task.status === 'in-progress') score += 0.4;
		else if (task.status === 'pending') score += 0.2;
		
		return Math.min(1.0, score);
	}

	/**
	 * Calculate priority score (0-1)
	 */
	calculatePriorityScore(task) {
		const priorityMap = {
			'high': 1.0,
			'medium': 0.6,
			'low': 0.3
		};
		
		return priorityMap[task.priority] || 0.5;
	}

	/**
	 * Get task complexity from complexity report or default
	 */
	getTaskComplexity(taskId) {
		if (this.complexityReport && this.complexityReport.tasks) {
			const taskAnalysis = this.complexityReport.tasks.find(t => t.id === taskId);
			if (taskAnalysis) {
				return taskAnalysis.complexityScore || 5;
			}
		}
		
		// Default complexity for tasks without analysis
		return 5;
	}

	/**
	 * Get task dependencies from graph
	 */
	getTaskDependencies(task, graph) {
		const dependencies = [];
		
		for (const edge of graph.edges) {
			if (edge.to === task.id && edge.type === 'dependency') {
				const depNode = graph.nodeMap.get(edge.from);
				if (depNode) {
					dependencies.push(depNode);
				}
			}
		}
		
		return dependencies;
	}

	/**
	 * Get dependency status for task
	 */
	getDependencyStatus(task, graph) {
		const dependencies = this.getTaskDependencies(task, graph);
		const total = dependencies.length;
		const completed = dependencies.filter(dep => dep.status === 'done').length;
		const pending = dependencies.filter(dep => dep.status === 'pending').length;
		const inProgress = dependencies.filter(dep => dep.status === 'in-progress').length;
		
		return {
			total,
			completed,
			pending,
			inProgress,
			blocked: total - completed - pending - inProgress
		};
	}

	/**
	 * Find critical path through dependency graph
	 */
	findCriticalPath(graph) {
		// Simple critical path: longest path through dependencies
		const paths = [];
		const visited = new Set();
		
		// Find all leaf nodes (no outgoing dependency edges)
		const leafNodes = graph.nodes.filter(node => {
			return !graph.edges.some(edge => edge.from === node.id && edge.type === 'dependency');
		});
		
		// Calculate longest path to each leaf
		for (const leaf of leafNodes) {
			const path = this.findLongestPathTo(leaf, graph, visited);
			if (path.length > 0) {
				paths.push(path);
			}
		}
		
		// Return the longest path
		const criticalPath = paths.reduce((longest, current) => 
			current.length > longest.length ? current : longest, []);
		
		return {
			path: criticalPath,
			length: criticalPath.length,
			estimatedDuration: this.estimatePathDuration(criticalPath)
		};
	}

	/**
	 * Find longest path to a node
	 */
	findLongestPathTo(node, graph, visited = new Set()) {
		if (visited.has(node.id)) {
			return []; // Avoid cycles
		}
		
		visited.add(node.id);
		
		const dependencies = this.getTaskDependencies(node, graph);
		
		if (dependencies.length === 0) {
			visited.delete(node.id);
			return [node];
		}
		
		let longestPath = [];
		
		for (const dep of dependencies) {
			const path = this.findLongestPathTo(dep, graph, visited);
			if (path.length > longestPath.length) {
				longestPath = path;
			}
		}
		
		visited.delete(node.id);
		return [...longestPath, node];
	}

	/**
	 * Estimate duration for a path
	 */
	estimatePathDuration(path) {
		// Simple estimation based on complexity
		let totalComplexity = 0;
		
		for (const node of path) {
			totalComplexity += this.getTaskComplexity(node.id);
		}
		
		// Rough estimate: 1 day per complexity point
		return {
			complexityPoints: totalComplexity,
			estimatedDays: Math.ceil(totalComplexity / 2), // Assume 2 complexity points per day
			confidence: 'low' // Mark as low confidence since it's a simple heuristic
		};
	}

	/**
	 * Detect bottleneck tasks
	 */
	detectBottlenecks(graph) {
		const bottlenecks = [];
		
		for (const node of graph.nodes) {
			// Count how many tasks depend on this one
			const dependentCount = graph.edges.filter(edge => 
				edge.from === node.id && edge.type === 'dependency'
			).length;
			
			// Consider high complexity or many dependents as bottlenecks
			const complexity = this.getTaskComplexity(node.id);
			
			if (dependentCount >= 3 || complexity >= 8 || (dependentCount >= 2 && complexity >= 6)) {
				bottlenecks.push({
					task: node,
					dependentCount,
					complexity,
					severity: this.calculateBottleneckSeverity(dependentCount, complexity),
					reason: this.getBottleneckReason(dependentCount, complexity)
				});
			}
		}
		
		// Sort by severity
		bottlenecks.sort((a, b) => b.severity - a.severity);
		
		return bottlenecks;
	}

	/**
	 * Calculate bottleneck severity score
	 */
	calculateBottleneckSeverity(dependentCount, complexity) {
		return (dependentCount * 0.6) + (complexity * 0.4);
	}

	/**
	 * Get bottleneck reason description
	 */
	getBottleneckReason(dependentCount, complexity) {
		if (dependentCount >= 3 && complexity >= 8) {
			return 'High complexity with many dependents';
		} else if (dependentCount >= 3) {
			return 'Many tasks depend on this one';
		} else if (complexity >= 8) {
			return 'High complexity task';
		} else {
			return 'Moderate complexity with multiple dependents';
		}
	}

	/**
	 * Find tasks ready for execution
	 */
	findReadyTasks(tasksData, graph, readinessScores) {
		const readyTasks = [];
		
		for (const node of graph.nodes) {
			// Skip completed, cancelled, or in-progress tasks
			if (['done', 'cancelled', 'in-progress'].includes(node.status)) {
				continue;
			}
			
			const score = readinessScores.get(node.id);
			if (score && score.dependencyScore === 1.0) { // All dependencies satisfied
				readyTasks.push({
					task: node,
					readinessScore: score.totalScore,
					factors: score.factors
				});
			}
		}
		
		// Sort by readiness score (highest first)
		readyTasks.sort((a, b) => b.readinessScore - a.readinessScore);
		
		return readyTasks;
	}

	/**
	 * Detect circular dependencies
	 */
	detectCircularDependencies(graph) {
		const visited = new Set();
		const recursionStack = new Set();
		const cycles = [];
		
		for (const node of graph.nodes) {
			if (!visited.has(node.id)) {
				this.detectCyclesFromNode(node, graph, visited, recursionStack, [], cycles);
			}
		}
		
		return cycles;
	}

	/**
	 * DFS to detect cycles from a specific node
	 */
	detectCyclesFromNode(node, graph, visited, recursionStack, path, cycles) {
		visited.add(node.id);
		recursionStack.add(node.id);
		path.push(node);
		
		// Get all nodes this one depends on
		const dependencies = this.getTaskDependencies(node, graph);
		
		for (const dep of dependencies) {
			if (!visited.has(dep.id)) {
				this.detectCyclesFromNode(dep, graph, visited, recursionStack, path, cycles);
			} else if (recursionStack.has(dep.id)) {
				// Found a cycle
				const cycleStart = path.findIndex(n => n.id === dep.id);
				const cycle = path.slice(cycleStart).map(n => ({
					id: n.id,
					title: n.title
				}));
				cycles.push(cycle);
			}
		}
		
		recursionStack.delete(node.id);
		path.pop();
	}

	/**
	 * Generate insights from analysis
	 */
	generateInsights(graph, readinessScores, criticalPath, bottlenecks) {
		const insights = [];
		
		// Graph structure insights
		const totalTasks = graph.nodes.length;
		const completedTasks = graph.nodes.filter(n => n.status === 'done').length;
		const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
		
		insights.push({
			type: 'progress',
			message: `Project is ${Math.round(progress)}% complete (${completedTasks}/${totalTasks} tasks)`,
			data: { progress, completedTasks, totalTasks }
		});
		
		// Critical path insights
		if (criticalPath.length > 0) {
			insights.push({
				type: 'critical-path',
				message: `Critical path has ${criticalPath.length} tasks, estimated ${criticalPath.estimatedDuration.estimatedDays} days`,
				data: criticalPath
			});
		}
		
		// Bottleneck insights
		if (bottlenecks.length > 0) {
			insights.push({
				type: 'bottlenecks',
				message: `Found ${bottlenecks.length} potential bottlenecks`,
				data: bottlenecks.slice(0, 3) // Top 3 bottlenecks
			});
		}
		
		// Readiness insights
		const readyCount = Array.from(readinessScores.values())
			.filter(score => score.dependencyScore === 1.0 && score.totalScore > 0.5).length;
		
		if (readyCount > 0) {
			insights.push({
				type: 'ready-tasks',
				message: `${readyCount} tasks are ready for execution`,
				data: { readyCount }
			});
		}
		
		return insights;
	}

	/**
	 * Generate recommendations
	 */
	generateRecommendations(readyTasks, bottlenecks) {
		const recommendations = [];
		
		// Task execution recommendations
		if (readyTasks.length > 0) {
			const topTask = readyTasks[0];
			recommendations.push({
				type: 'next-task',
				priority: 'high',
				message: `Start with "${topTask.task.title}" (readiness score: ${topTask.readinessScore})`,
				action: 'start-task',
				data: topTask
			});
		}
		
		// Bottleneck recommendations
		if (bottlenecks.length > 0) {
			const topBottleneck = bottlenecks[0];
			recommendations.push({
				type: 'bottleneck',
				priority: 'medium',
				message: `Consider breaking down "${topBottleneck.task.title}" to reduce project risk`,
				action: 'expand-task',
				data: topBottleneck
			});
		}
		
		// Parallel work recommendations
		const parallelTasks = readyTasks.filter((task, index) => index < 3 && task.readinessScore > 0.7);
		if (parallelTasks.length > 1) {
			recommendations.push({
				type: 'parallel-work',
				priority: 'medium',
				message: `${parallelTasks.length} tasks can be worked on in parallel`,
				action: 'parallel-execution',
				data: parallelTasks
			});
		}
		
		return recommendations;
	}

	/**
	 * Create cache key for analysis results
	 */
	createCacheKey(tasksData, options) {
		const dataHash = JSON.stringify(tasksData);
		const optionsHash = JSON.stringify(options);
		return `${dataHash}-${optionsHash}`.substring(0, 50);
	}

	/**
	 * Update performance statistics
	 */
	updateStats(analysisTime) {
		this.stats.analysisCount++;
		this.stats.lastAnalysisTime = analysisTime;
		this.stats.averageAnalysisTime = 
			(this.stats.averageAnalysisTime * (this.stats.analysisCount - 1) + analysisTime) / this.stats.analysisCount;
	}

	/**
	 * Clear analysis cache
	 */
	clearCache() {
		this.analysisCache.clear();
		this.readinessScores.clear();
		console.log('🧹 Dependency analysis cache cleared');
	}

	/**
	 * Get analysis statistics
	 */
	getStats() {
		return {
			...this.stats,
			cacheSize: this.analysisCache.size,
			lastAnalysisTimestamp: this.lastAnalysis?.timestamp,
			graphNodes: this.dependencyGraph?.nodes?.length || 0,
			graphEdges: this.dependencyGraph?.edges?.length || 0
		};
	}

	/**
	 * Get current dependency graph
	 */
	getDependencyGraph() {
		return this.dependencyGraph;
	}

	/**
	 * Get readiness scores
	 */
	getReadinessScores() {
		return this.readinessScores;
	}

	/**
	 * Update configuration
	 */
	updateConfig(newConfig) {
		this.config = { ...this.config, ...newConfig };
		
		// Clear cache if weights changed
		if (newConfig.weights) {
			this.clearCache();
		}
		
		this.emit('config:updated', this.config);
	}
} 