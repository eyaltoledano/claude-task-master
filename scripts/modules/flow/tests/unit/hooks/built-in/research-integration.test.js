/**
 * @fileoverview Research Integration Hook Tests
 * Tests for research integration hook including research operations,
 * data integration, and analysis features.
 *
 * @author Claude (Task Master Flow Testing Phase 2.2)
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock ResearchIntegrationHook class
class MockResearchIntegrationHook extends EventEmitter {
	constructor(options = {}) {
		super();
		this.config = {
			enableAutomaticResearch: options.enableAutomaticResearch !== false,
			enableDataAnalysis: options.enableDataAnalysis !== false,
			enableReportGeneration: options.enableReportGeneration !== false,
			researchTimeout: options.researchTimeout || 30000,
			maxConcurrentResearch: options.maxConcurrentResearch || 3,
			...options
		};
		this.researchSessions = new Map();
		this.researchCache = new Map();
		this.statistics = {
			totalResearchRequests: 0,
			completedResearch: 0,
			failedResearch: 0,
			cacheHits: 0,
			cacheMisses: 0,
			averageResearchTime: 0,
			totalResearchTime: 0
		};
		this.isActive = false;
		this.activeResearchers = 0;
	}

	async activate() {
		this.isActive = true;
		this.emit('hookActivated');
		return true;
	}

	async deactivate() {
		this.isActive = false;
		// Cancel active research
		for (const [sessionId, session] of this.researchSessions) {
			if (session.status === 'active') {
				session.status = 'cancelled';
			}
		}
		this.emit('hookDeactivated');
		return true;
	}

	async execute(context = {}) {
		if (!this.isActive) {
			throw new Error('Hook not active');
		}

		const action = context.action || 'research';

		switch (action) {
			case 'research':
				return await this.performResearch(context);
			case 'analyze':
				return await this.analyzeData(context);
			case 'report':
				return await this.generateReport(context);
			case 'cache':
				return await this.manageCacheOperation(context);
			default:
				throw new Error(`Unknown action: ${action}`);
		}
	}

	async performResearch(context) {
		const sessionId = `research-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		this.statistics.totalResearchRequests++;

		try {
			if (!context.query) {
				throw new Error('Research query is required');
			}

			if (this.activeResearchers >= this.config.maxConcurrentResearch) {
				throw new Error('Maximum concurrent research limit reached');
			}

			this.activeResearchers++;

			const session = {
				id: sessionId,
				query: context.query,
				type: context.type || 'general',
				priority: context.priority || 'normal',
				status: 'active',
				startTime: new Date(),
				metadata: context.metadata || {},
				results: null,
				error: null
			};

			this.researchSessions.set(sessionId, session);

			this.emit('researchStarted', {
				sessionId,
				query: context.query,
				type: context.type
			});

			// Check cache first
			const cacheKey = this.generateCacheKey(context.query, context.type);
			if (this.researchCache.has(cacheKey)) {
				this.statistics.cacheHits++;
				const cachedResult = this.researchCache.get(cacheKey);

				session.status = 'completed';
				session.endTime = new Date();
				session.results = cachedResult;
				session.fromCache = true;

				const researchTime = session.endTime - session.startTime;
				this.updateStatistics(true, researchTime); // Update statistics for cache hits too

				this.emit('researchCompleted', {
					sessionId,
					fromCache: true,
					results: cachedResult,
					researchTime
				});

				return {
					success: true,
					sessionId,
					results: cachedResult,
					fromCache: true,
					message: 'Research completed from cache'
				};
			}

			this.statistics.cacheMisses++;

			// Perform actual research
			const researchResult = await this.conductResearch(context);

			session.status = 'completed';
			session.endTime = new Date();
			session.results = researchResult;

			const researchTime = session.endTime - session.startTime;
			this.updateStatistics(true, researchTime);

			// Cache the results
			this.researchCache.set(cacheKey, researchResult);

			this.emit('researchCompleted', {
				sessionId,
				fromCache: false,
				results: researchResult,
				researchTime
			});

			return {
				success: true,
				sessionId,
				results: researchResult,
				fromCache: false,
				researchTime,
				message: 'Research completed successfully'
			};
		} catch (error) {
			const session = this.researchSessions.get(sessionId);
			if (session) {
				session.status = 'failed';
				session.endTime = new Date();
				session.error = error.message;
			}

			const researchTime = session ? session.endTime - session.startTime : 0;
			this.updateStatistics(false, researchTime);

			this.emit('researchFailed', {
				sessionId,
				error: error.message,
				researchTime
			});

			throw error;
		} finally {
			if (this.activeResearchers > 0) {
				this.activeResearchers--;
			}
		}
	}

	async conductResearch(context) {
		// Mock research implementation
		const researchTypes = {
			technical: this.performTechnicalResearch,
			market: this.performMarketResearch,
			academic: this.performAcademicResearch,
			general: this.performGeneralResearch
		};

		const researchFunction =
			researchTypes[context.type] || researchTypes['general'];
		return await researchFunction.call(this, context);
	}

	async performTechnicalResearch(context) {
		// Mock technical research
		await new Promise((resolve) =>
			setTimeout(resolve, 200 + Math.random() * 300)
		);

		return {
			type: 'technical',
			query: context.query,
			sources: [
				{
					name: 'Technical Documentation',
					url: 'https://docs.example.com',
					relevance: 0.9
				},
				{
					name: 'Stack Overflow',
					url: 'https://stackoverflow.com/q/12345',
					relevance: 0.8
				},
				{
					name: 'GitHub Issues',
					url: 'https://github.com/example/repo/issues/123',
					relevance: 0.7
				}
			],
			findings: [
				'Best practices for implementation',
				'Common pitfalls to avoid',
				'Performance considerations'
			],
			recommendations: [
				'Use established patterns',
				'Implement proper error handling',
				'Add comprehensive tests'
			],
			confidence: 0.85,
			generatedAt: new Date()
		};
	}

	async performMarketResearch(context) {
		// Mock market research
		await new Promise((resolve) =>
			setTimeout(resolve, 300 + Math.random() * 400)
		);

		return {
			type: 'market',
			query: context.query,
			marketData: {
				size: '$2.5B',
				growth: '15% YoY',
				competitors: ['Competitor A', 'Competitor B', 'Competitor C']
			},
			trends: [
				'Increasing demand for automation',
				'Shift towards cloud-based solutions',
				'Focus on user experience'
			],
			opportunities: [
				'Underserved market segments',
				'Emerging technology adoption',
				'Partnership possibilities'
			],
			confidence: 0.78,
			generatedAt: new Date()
		};
	}

	async performAcademicResearch(context) {
		// Mock academic research
		await new Promise((resolve) =>
			setTimeout(resolve, 400 + Math.random() * 500)
		);

		return {
			type: 'academic',
			query: context.query,
			papers: [
				{
					title: 'Research Paper 1',
					authors: ['Author A', 'Author B'],
					year: 2023,
					citations: 45
				},
				{
					title: 'Research Paper 2',
					authors: ['Author C'],
					year: 2022,
					citations: 78
				},
				{
					title: 'Research Paper 3',
					authors: ['Author D', 'Author E'],
					year: 2023,
					citations: 23
				}
			],
			keyFindings: [
				'Novel approach shows 20% improvement',
				'Traditional methods have limitations',
				'Future research directions identified'
			],
			methodologies: [
				'Experimental design',
				'Statistical analysis',
				'Comparative study'
			],
			confidence: 0.92,
			generatedAt: new Date()
		};
	}

	async performGeneralResearch(context) {
		// Mock general research
		await new Promise((resolve) =>
			setTimeout(resolve, 150 + Math.random() * 250)
		);

		return {
			type: 'general',
			query: context.query,
			summary: `Research summary for: ${context.query}`,
			keyPoints: ['Key finding 1', 'Key finding 2', 'Key finding 3'],
			sources: [
				{ name: 'Source 1', type: 'article', relevance: 0.8 },
				{ name: 'Source 2', type: 'blog', relevance: 0.7 },
				{ name: 'Source 3', type: 'documentation', relevance: 0.9 }
			],
			confidence: 0.75,
			generatedAt: new Date()
		};
	}

	async analyzeData(context) {
		if (!context.data) {
			throw new Error('Data is required for analysis');
		}

		const analysisResult = {
			dataType: this.detectDataType(context.data),
			statistics: this.calculateStatistics(context.data),
			patterns: this.identifyPatterns(context.data),
			insights: this.generateInsights(context.data),
			recommendations: this.generateRecommendations(context.data),
			confidence: 0.8,
			analyzedAt: new Date()
		};

		this.emit('dataAnalyzed', {
			dataSize: Array.isArray(context.data)
				? context.data.length
				: Object.keys(context.data).length,
			analysisType: analysisResult.dataType,
			insights: analysisResult.insights.length
		});

		return {
			success: true,
			analysis: analysisResult,
			message: 'Data analysis completed'
		};
	}

	detectDataType(data) {
		if (Array.isArray(data)) {
			return data.every((item) => typeof item === 'number')
				? 'numerical_array'
				: 'mixed_array';
		} else if (typeof data === 'object') {
			return 'object';
		} else {
			return typeof data;
		}
	}

	calculateStatistics(data) {
		if (Array.isArray(data) && data.every((item) => typeof item === 'number')) {
			const sum = data.reduce((a, b) => a + b, 0);
			const mean = sum / data.length;
			const sortedData = [...data].sort((a, b) => a - b);
			const median = sortedData[Math.floor(sortedData.length / 2)];

			return {
				count: data.length,
				sum,
				mean,
				median,
				min: Math.min(...data),
				max: Math.max(...data)
			};
		}

		return {
			count: Array.isArray(data) ? data.length : Object.keys(data).length,
			type: this.detectDataType(data)
		};
	}

	identifyPatterns(data) {
		// Mock pattern identification
		return [
			'Increasing trend detected',
			'Seasonal variations observed',
			'Outliers identified'
		];
	}

	generateInsights(data) {
		// Mock insight generation
		return [
			'Data shows consistent growth pattern',
			'Peak activity occurs during specific periods',
			'Quality metrics are within acceptable range'
		];
	}

	generateRecommendations(data) {
		// Mock recommendation generation
		return [
			'Continue current approach',
			'Monitor outliers closely',
			'Consider additional data sources'
		];
	}

	async generateReport(context) {
		if (!context.sessionId && !context.data) {
			throw new Error('Session ID or data is required for report generation');
		}

		let reportData;

		if (context.sessionId) {
			const session = this.researchSessions.get(context.sessionId);
			if (!session) {
				throw new Error(`Research session ${context.sessionId} not found`);
			}
			reportData = session.results;
		} else {
			reportData = context.data;
		}

		const report = {
			id: `report-${Date.now()}`,
			title: context.title || 'Research Report',
			generatedAt: new Date(),
			data: reportData,
			summary: this.generateSummary(reportData),
			sections: this.generateReportSections(reportData),
			metadata: {
				format: context.format || 'json',
				version: '1.0',
				generator: 'ResearchIntegrationHook'
			}
		};

		this.emit('reportGenerated', {
			reportId: report.id,
			title: report.title,
			sections: report.sections.length
		});

		return {
			success: true,
			report,
			message: 'Report generated successfully'
		};
	}

	generateSummary(data) {
		if (!data) return 'No data available for summary';

		return (
			`Research completed with ${data.confidence ? Math.round(data.confidence * 100) : 'unknown'}% confidence. ` +
			`Generated ${data.keyPoints?.length || data.findings?.length || 0} key findings.`
		);
	}

	generateReportSections(data) {
		const sections = [
			{ title: 'Executive Summary', content: this.generateSummary(data) }
		];

		if (data.findings) {
			sections.push({ title: 'Key Findings', content: data.findings });
		}

		if (data.keyPoints) {
			sections.push({ title: 'Key Points', content: data.keyPoints });
		}

		if (data.recommendations) {
			sections.push({
				title: 'Recommendations',
				content: data.recommendations
			});
		}

		if (data.sources) {
			sections.push({ title: 'Sources', content: data.sources });
		}

		return sections;
	}

	async manageCacheOperation(context) {
		const operation = context.operation || 'status';

		switch (operation) {
			case 'status':
				return {
					success: true,
					cache: {
						size: this.researchCache.size,
						hitRate:
							this.statistics.totalResearchRequests > 0
								? (this.statistics.cacheHits /
										this.statistics.totalResearchRequests) *
									100
								: 0,
						entries: Array.from(this.researchCache.keys())
					}
				};

			case 'clear':
				const clearedCount = this.researchCache.size;
				this.researchCache.clear();
				this.emit('cacheCleared', { clearedCount });
				return {
					success: true,
					message: `Cleared ${clearedCount} cache entries`
				};

			case 'invalidate':
				if (!context.key) {
					throw new Error('Cache key is required for invalidation');
				}
				const existed = this.researchCache.delete(context.key);
				return {
					success: true,
					invalidated: existed,
					message: existed ? 'Cache entry invalidated' : 'Cache entry not found'
				};

			default:
				throw new Error(`Unknown cache operation: ${operation}`);
		}
	}

	generateCacheKey(query, type) {
		return `${type || 'general'}:${Buffer.from(query).toString('base64')}`;
	}

	updateStatistics(success, researchTime) {
		if (success) {
			this.statistics.completedResearch++;
			this.statistics.totalResearchTime += researchTime;
			this.statistics.averageResearchTime =
				this.statistics.totalResearchTime / this.statistics.completedResearch;
		} else {
			this.statistics.failedResearch++;
		}
	}

	getResearchSession(sessionId) {
		return this.researchSessions.get(sessionId);
	}

	listResearchSessions(filter = {}) {
		const sessions = Array.from(this.researchSessions.values());

		if (filter.status) {
			return sessions.filter((session) => session.status === filter.status);
		}

		if (filter.type) {
			return sessions.filter((session) => session.type === filter.type);
		}

		return sessions;
	}

	getStatistics() {
		return {
			...this.statistics,
			activeSessions: this.activeResearchers,
			totalSessions: this.researchSessions.size,
			cacheSize: this.researchCache.size,
			successRate:
				this.statistics.totalResearchRequests > 0
					? (this.statistics.completedResearch /
							this.statistics.totalResearchRequests) *
						100
					: 0,
			cacheHitRate:
				this.statistics.totalResearchRequests > 0
					? (this.statistics.cacheHits /
							this.statistics.totalResearchRequests) *
						100
					: 0,
			isActive: this.isActive
		};
	}

	async cleanup() {
		this.researchSessions.clear();
		this.researchCache.clear();
		this.activeResearchers = 0;
		this.statistics = {
			totalResearchRequests: 0,
			completedResearch: 0,
			failedResearch: 0,
			cacheHits: 0,
			cacheMisses: 0,
			averageResearchTime: 0,
			totalResearchTime: 0
		};
		this.emit('hookCleanedUp');
	}
}

describe('Research Integration Hook', () => {
	let researchHook;

	beforeEach(async () => {
		researchHook = new MockResearchIntegrationHook();
		await researchHook.activate();
	});

	afterEach(async () => {
		if (researchHook.isActive) {
			await researchHook.deactivate();
		}
		await researchHook.cleanup();
	});

	describe('Hook Activation', () => {
		test('should activate successfully', async () => {
			const newHook = new MockResearchIntegrationHook();
			await newHook.activate();

			expect(newHook.isActive).toBe(true);

			await newHook.deactivate();
		});

		test('should emit activation events', async () => {
			const activatedSpy = jest.fn();
			const deactivatedSpy = jest.fn();

			const newHook = new MockResearchIntegrationHook();
			newHook.on('hookActivated', activatedSpy);
			newHook.on('hookDeactivated', deactivatedSpy);

			await newHook.activate();
			await newHook.deactivate();

			expect(activatedSpy).toHaveBeenCalled();
			expect(deactivatedSpy).toHaveBeenCalled();
		});
	});

	describe('Research Operations', () => {
		test('should perform general research successfully', async () => {
			const context = {
				action: 'research',
				query: 'What are the best practices for API design?',
				type: 'general'
			};

			const result = await researchHook.execute(context);

			expect(result.success).toBe(true);
			expect(result.sessionId).toBeDefined();
			expect(result.results.type).toBe('general');
			expect(result.results.query).toBe(context.query);
			expect(result.fromCache).toBe(false);
		});

		test('should perform technical research', async () => {
			const context = {
				action: 'research',
				query: 'How to implement OAuth 2.0?',
				type: 'technical'
			};

			const result = await researchHook.execute(context);

			expect(result.success).toBe(true);
			expect(result.results.type).toBe('technical');
			expect(result.results.sources).toBeDefined();
			expect(result.results.findings).toBeDefined();
			expect(result.results.recommendations).toBeDefined();
		});

		test('should perform market research', async () => {
			const context = {
				action: 'research',
				query: 'AI market trends 2024',
				type: 'market'
			};

			const result = await researchHook.execute(context);

			expect(result.success).toBe(true);
			expect(result.results.type).toBe('market');
			expect(result.results.marketData).toBeDefined();
			expect(result.results.trends).toBeDefined();
			expect(result.results.opportunities).toBeDefined();
		});

		test('should perform academic research', async () => {
			const context = {
				action: 'research',
				query: 'Machine learning algorithms comparison',
				type: 'academic'
			};

			const result = await researchHook.execute(context);

			expect(result.success).toBe(true);
			expect(result.results.type).toBe('academic');
			expect(result.results.papers).toBeDefined();
			expect(result.results.keyFindings).toBeDefined();
			expect(result.results.methodologies).toBeDefined();
		});

		test('should emit research lifecycle events', async () => {
			const startedSpy = jest.fn();
			const completedSpy = jest.fn();

			researchHook.on('researchStarted', startedSpy);
			researchHook.on('researchCompleted', completedSpy);

			const context = {
				action: 'research',
				query: 'Test query',
				type: 'general'
			};

			await researchHook.execute(context);

			expect(startedSpy).toHaveBeenCalledWith({
				sessionId: expect.any(String),
				query: 'Test query',
				type: 'general'
			});

			expect(completedSpy).toHaveBeenCalledWith({
				sessionId: expect.any(String),
				fromCache: false,
				results: expect.any(Object),
				researchTime: expect.any(Number)
			});
		});

		test('should reject research without query', async () => {
			const context = { action: 'research' };

			await expect(researchHook.execute(context)).rejects.toThrow(
				'Research query is required'
			);
		});

		test('should respect concurrent research limits', async () => {
			const limitedHook = new MockResearchIntegrationHook({
				maxConcurrentResearch: 1
			});
			await limitedHook.activate();

			// Start first research (should succeed)
			const research1 = limitedHook.execute({
				action: 'research',
				query: 'Query 1'
			});

			// Start second research immediately (should fail)
			await expect(
				limitedHook.execute({
					action: 'research',
					query: 'Query 2'
				})
			).rejects.toThrow('Maximum concurrent research limit reached');

			await research1; // Wait for first to complete
			await limitedHook.deactivate();
		});
	});

	describe('Research Caching', () => {
		test('should cache research results', async () => {
			const context = {
				action: 'research',
				query: 'Caching test query',
				type: 'general'
			};

			// First request (cache miss)
			const result1 = await researchHook.execute(context);
			expect(result1.fromCache).toBe(false);

			// Second request (cache hit)
			const result2 = await researchHook.execute(context);
			expect(result2.fromCache).toBe(true);
			expect(result2.results).toEqual(result1.results);
		});

		test('should track cache statistics', async () => {
			const context = {
				action: 'research',
				query: 'Cache stats test',
				type: 'general'
			};

			await researchHook.execute(context); // Cache miss
			await researchHook.execute(context); // Cache hit
			await researchHook.execute({ ...context, query: 'Different query' }); // Cache miss

			const stats = researchHook.getStatistics();

			expect(stats.cacheHits).toBe(1);
			expect(stats.cacheMisses).toBe(2);
			expect(stats.cacheHitRate).toBeCloseTo(33.33, 1);
		});

		test('should manage cache operations', async () => {
			// Add some cached data
			await researchHook.execute({
				action: 'research',
				query: 'Cache management test',
				type: 'general'
			});

			// Check cache status
			const statusResult = await researchHook.execute({
				action: 'cache',
				operation: 'status'
			});

			expect(statusResult.success).toBe(true);
			expect(statusResult.cache.size).toBe(1);
			expect(statusResult.cache.entries).toHaveLength(1);

			// Clear cache
			const clearResult = await researchHook.execute({
				action: 'cache',
				operation: 'clear'
			});

			expect(clearResult.success).toBe(true);
			expect(clearResult.message).toContain('Cleared 1 cache entries');
		});

		test('should invalidate specific cache entries', async () => {
			const context = {
				action: 'research',
				query: 'Invalidation test',
				type: 'general'
			};

			await researchHook.execute(context);

			const cacheKey = researchHook.generateCacheKey(
				context.query,
				context.type
			);

			const invalidateResult = await researchHook.execute({
				action: 'cache',
				operation: 'invalidate',
				key: cacheKey
			});

			expect(invalidateResult.success).toBe(true);
			expect(invalidateResult.invalidated).toBe(true);
		});
	});

	describe('Data Analysis', () => {
		test('should analyze numerical array data', async () => {
			const context = {
				action: 'analyze',
				data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
			};

			const result = await researchHook.execute(context);

			expect(result.success).toBe(true);
			expect(result.analysis.dataType).toBe('numerical_array');
			expect(result.analysis.statistics.count).toBe(10);
			expect(result.analysis.statistics.mean).toBe(5.5);
			expect(result.analysis.statistics.median).toBe(6);
			expect(result.analysis.patterns).toBeDefined();
			expect(result.analysis.insights).toBeDefined();
			expect(result.analysis.recommendations).toBeDefined();
		});

		test('should analyze object data', async () => {
			const context = {
				action: 'analyze',
				data: {
					users: 1000,
					revenue: 50000,
					conversion: 0.05
				}
			};

			const result = await researchHook.execute(context);

			expect(result.success).toBe(true);
			expect(result.analysis.dataType).toBe('object');
			expect(result.analysis.statistics.count).toBe(3);
		});

		test('should emit dataAnalyzed event', async () => {
			const eventSpy = jest.fn();
			researchHook.on('dataAnalyzed', eventSpy);

			const context = {
				action: 'analyze',
				data: [1, 2, 3, 4, 5]
			};

			await researchHook.execute(context);

			expect(eventSpy).toHaveBeenCalledWith({
				dataSize: 5,
				analysisType: 'numerical_array',
				insights: expect.any(Number)
			});
		});

		test('should reject analysis without data', async () => {
			const context = { action: 'analyze' };

			await expect(researchHook.execute(context)).rejects.toThrow(
				'Data is required for analysis'
			);
		});
	});

	describe('Report Generation', () => {
		test('should generate report from research session', async () => {
			// First perform research
			const researchResult = await researchHook.execute({
				action: 'research',
				query: 'Report test query',
				type: 'technical'
			});

			// Then generate report
			const reportResult = await researchHook.execute({
				action: 'report',
				sessionId: researchResult.sessionId,
				title: 'Technical Research Report'
			});

			expect(reportResult.success).toBe(true);
			expect(reportResult.report.id).toBeDefined();
			expect(reportResult.report.title).toBe('Technical Research Report');
			expect(reportResult.report.data).toEqual(researchResult.results);
			expect(reportResult.report.sections).toBeDefined();
			expect(reportResult.report.summary).toBeDefined();
		});

		test('should generate report from provided data', async () => {
			const data = {
				findings: ['Finding 1', 'Finding 2'],
				recommendations: ['Recommendation 1'],
				confidence: 0.9
			};

			const reportResult = await researchHook.execute({
				action: 'report',
				data,
				title: 'Custom Data Report'
			});

			expect(reportResult.success).toBe(true);
			expect(reportResult.report.title).toBe('Custom Data Report');
			expect(reportResult.report.data).toEqual(data);
		});

		test('should emit reportGenerated event', async () => {
			const eventSpy = jest.fn();
			researchHook.on('reportGenerated', eventSpy);

			const data = { findings: ['Test finding'] };

			await researchHook.execute({
				action: 'report',
				data,
				title: 'Event Test Report'
			});

			expect(eventSpy).toHaveBeenCalledWith({
				reportId: expect.any(String),
				title: 'Event Test Report',
				sections: expect.any(Number)
			});
		});

		test('should reject report generation without session or data', async () => {
			const context = { action: 'report' };

			await expect(researchHook.execute(context)).rejects.toThrow(
				'Session ID or data is required for report generation'
			);
		});
	});

	describe('Session Management', () => {
		test('should track research sessions', async () => {
			const result = await researchHook.execute({
				action: 'research',
				query: 'Session tracking test',
				type: 'general'
			});

			const session = researchHook.getResearchSession(result.sessionId);

			expect(session).toBeDefined();
			expect(session.id).toBe(result.sessionId);
			expect(session.query).toBe('Session tracking test');
			expect(session.status).toBe('completed');
			expect(session.startTime).toBeInstanceOf(Date);
			expect(session.endTime).toBeInstanceOf(Date);
		});

		test('should list research sessions with filters', async () => {
			await researchHook.execute({
				action: 'research',
				query: 'Test query 1',
				type: 'technical'
			});

			await researchHook.execute({
				action: 'research',
				query: 'Test query 2',
				type: 'market'
			});

			const allSessions = researchHook.listResearchSessions();
			const technicalSessions = researchHook.listResearchSessions({
				type: 'technical'
			});
			const completedSessions = researchHook.listResearchSessions({
				status: 'completed'
			});

			expect(allSessions).toHaveLength(2);
			expect(technicalSessions).toHaveLength(1);
			expect(completedSessions).toHaveLength(2);
		});
	});

	describe('Statistics and Monitoring', () => {
		test('should track comprehensive statistics', async () => {
			// Perform multiple research operations
			await researchHook.execute({
				action: 'research',
				query: 'Stats test 1',
				type: 'general'
			});

			await researchHook.execute({
				action: 'research',
				query: 'Stats test 1', // Same query for cache hit
				type: 'general'
			});

			const stats = researchHook.getStatistics();

			expect(stats.totalResearchRequests).toBe(2);
			expect(stats.completedResearch).toBe(2);
			expect(stats.cacheHits).toBe(1);
			expect(stats.successRate).toBe(100);
			expect(stats.cacheHitRate).toBe(50);
			expect(stats.averageResearchTime).toBeGreaterThan(0);
		});

		test('should track failed research', async () => {
			try {
				await researchHook.execute({ action: 'research' }); // Missing query
			} catch (error) {
				// Expected to fail
			}

			const stats = researchHook.getStatistics();

			expect(stats.totalResearchRequests).toBe(1);
			expect(stats.failedResearch).toBe(1);
			expect(stats.successRate).toBe(0);
		});
	});

	describe('Error Handling', () => {
		test('should reject execution when hook not active', async () => {
			await researchHook.deactivate();

			await expect(
				researchHook.execute({ action: 'research' })
			).rejects.toThrow('Hook not active');
		});

		test('should reject unknown actions', async () => {
			await expect(researchHook.execute({ action: 'unknown' })).rejects.toThrow(
				'Unknown action: unknown'
			);
		});

		test('should emit researchFailed event on errors', async () => {
			const eventSpy = jest.fn();
			researchHook.on('researchFailed', eventSpy);

			try {
				await researchHook.execute({ action: 'research' }); // Missing query
			} catch (error) {
				// Expected to fail
			}

			expect(eventSpy).toHaveBeenCalledWith({
				sessionId: expect.any(String),
				error: 'Research query is required',
				researchTime: expect.any(Number)
			});
		});
	});

	describe('Performance and Cleanup', () => {
		test('should handle multiple concurrent research requests', async () => {
			// Temporarily increase the concurrent research limit for this test
			const originalLimit = researchHook.config.maxConcurrentResearch;
			researchHook.config.maxConcurrentResearch = 10;

			const requests = [];

			for (let i = 0; i < 5; i++) {
				requests.push(
					researchHook.execute({
						action: 'research',
						query: `Concurrent query ${i}`,
						type: 'general'
					})
				);
			}

			const results = await Promise.all(requests);

			expect(results).toHaveLength(5);
			expect(results.every((r) => r.success)).toBe(true);

			// Restore original limit
			researchHook.config.maxConcurrentResearch = originalLimit;
		});

		test('should complete research within time limits', async () => {
			const startTime = Date.now();

			await researchHook.execute({
				action: 'research',
				query: 'Performance test query',
				type: 'technical'
			});

			const researchTime = Date.now() - startTime;

			expect(researchTime).toBeLessThan(1000); // Should complete within 1 second
		});

		test('should cleanup hook state', async () => {
			await researchHook.execute({
				action: 'research',
				query: 'Cleanup test',
				type: 'general'
			});

			expect(researchHook.researchSessions.size).toBe(1);
			expect(researchHook.researchCache.size).toBe(1);

			await researchHook.cleanup();

			expect(researchHook.researchSessions.size).toBe(0);
			expect(researchHook.researchCache.size).toBe(0);
			expect(researchHook.getStatistics().totalResearchRequests).toBe(0);
		});

		test('should emit hookCleanedUp event', async () => {
			const eventSpy = jest.fn();
			researchHook.on('hookCleanedUp', eventSpy);

			await researchHook.cleanup();

			expect(eventSpy).toHaveBeenCalled();
		});
	});
});
