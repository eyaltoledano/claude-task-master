/**
 * @fileoverview Workflow State Manager Testing
 * Tests for workflow orchestration, state persistence, and error recovery
 * Part of Phase 2.1: Background Service Testing
 */

import { EventEmitter } from 'events';

// Mock WorkflowStateManager class
class MockWorkflowStateManager extends EventEmitter {
	constructor(options = {}) {
		super();
		this.options = {
			persistenceInterval: 5000,
			maxWorkflowHistory: 1000,
			stateTimeout: 300000,
			maxRetryAttempts: 3,
			...options
		};
		this.workflows = new Map();
		this.workflowHistory = [];
		this.isActive = false;
		this.stats = {
			workflowsCreated: 0,
			workflowsCompleted: 0,
			stateTransitions: 0,
			persistenceOperations: 0,
			rollbackOperations: 0,
			errors: 0
		};
	}

	async start() {
		if (this.isActive) throw new Error('WorkflowStateManager already active');
		this.isActive = true;
		this.emit('manager:started');
		return { success: true, timestamp: Date.now() };
	}

	async stop() {
		if (!this.isActive) throw new Error('WorkflowStateManager not active');
		this.isActive = false;
		await this.persistState();
		this.emit('manager:stopped');
		return { success: true, timestamp: Date.now() };
	}

	async createWorkflow(workflowConfig) {
		if (!this.isActive) throw new Error('Manager not active');

		const { id, name, steps, initialData = {}, metadata = {} } = workflowConfig;

		if (this.workflows.has(id)) {
			throw new Error(`Workflow ${id} already exists`);
		}

		const workflow = {
			id,
			name,
			steps: steps.map((step, index) => ({
				id: step.id || `step_${index}`,
				name: step.name,
				type: step.type,
				config: step.config || {},
				status: 'pending',
				dependencies: step.dependencies || [],
				retryCount: 0,
				startedAt: null,
				completedAt: null,
				error: null,
				result: null
			})),
			status: 'created',
			currentStep: null,
			data: { ...initialData },
			metadata: {
				...metadata,
				createdAt: Date.now(),
				createdBy: metadata.createdBy || 'system'
			},
			history: [],
			checkpoints: []
		};

		this.workflows.set(id, workflow);
		this.stats.workflowsCreated++;

		this.addToHistory({
			workflowId: id,
			action: 'created',
			timestamp: Date.now(),
			details: { name, stepCount: steps.length }
		});
		this.emit('workflow:created', { workflowId: id, workflow });

		return { success: true, workflowId: id, workflow };
	}

	async startWorkflow(workflowId) {
		const workflow = this.workflows.get(workflowId);
		if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

		if (workflow.status !== 'created' && workflow.status !== 'paused') {
			throw new Error(`Cannot start workflow in status: ${workflow.status}`);
		}

		await this.transitionWorkflowState(workflowId, 'running');

		const nextStep = this.findNextExecutableStep(workflow);
		if (nextStep) {
			await this.executeStep(workflowId, nextStep.id);
		} else {
			await this.transitionWorkflowState(workflowId, 'completed');
		}

		return { success: true, workflowId, status: workflow.status };
	}

	async transitionWorkflowState(workflowId, newStatus, details = {}) {
		const workflow = this.workflows.get(workflowId);
		if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

		const oldStatus = workflow.status;
		workflow.status = newStatus;

		const transition = {
			workflowId,
			from: oldStatus,
			to: newStatus,
			timestamp: Date.now(),
			details
		};
		workflow.history.push(transition);
		this.addToHistory({
			workflowId,
			action: 'state_transition',
			timestamp: Date.now(),
			details: transition
		});

		this.stats.stateTransitions++;
		this.emit('workflow:state:changed', transition);

		if (newStatus === 'completed') {
			this.stats.workflowsCompleted++;
			workflow.metadata.completedAt = Date.now();
			this.emit('workflow:completed', { workflowId, workflow });
		}

		return transition;
	}

	async executeStep(workflowId, stepId) {
		const workflow = this.workflows.get(workflowId);
		if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

		const step = workflow.steps.find((s) => s.id === stepId);
		if (!step)
			throw new Error(`Step ${stepId} not found in workflow ${workflowId}`);

		if (!this.checkStepDependencies(workflow, step)) {
			throw new Error(`Dependencies not met for step ${stepId}`);
		}

		step.status = 'running';
		step.startedAt = Date.now();
		workflow.currentStep = stepId;

		this.emit('step:started', { workflowId, stepId, step });

		try {
			const result = await this.simulateStepExecution(workflow, step);

			step.status = 'completed';
			step.completedAt = Date.now();
			step.result = result;

			if (result.data) {
				workflow.data = { ...workflow.data, ...result.data };
			}

			this.emit('step:completed', { workflowId, stepId, step, result });

			const allStepsCompleted = workflow.steps.every(
				(s) => s.status === 'completed'
			);
			if (allStepsCompleted) {
				await this.transitionWorkflowState(workflowId, 'completed');
			} else {
				const nextStep = this.findNextExecutableStep(workflow);
				if (nextStep) {
					setImmediate(() => this.executeStep(workflowId, nextStep.id));
				}
			}

			return { success: true, stepId, result };
		} catch (error) {
			step.status = 'failed';
			step.error = error.message;
			step.completedAt = Date.now();

			this.stats.errors++;
			this.emit('step:failed', { workflowId, stepId, step, error });

			if (step.retryCount < this.options.maxRetryAttempts) {
				step.retryCount++;
				step.status = 'pending';
				step.startedAt = null;
				step.error = null;

				this.emit('step:retry', {
					workflowId,
					stepId,
					step,
					attempt: step.retryCount
				});

				setTimeout(() => {
					this.executeStep(workflowId, stepId);
				}, Math.pow(2, step.retryCount) * 1000);
			} else {
				await this.transitionWorkflowState(workflowId, 'failed', {
					failedStep: stepId,
					error: error.message
				});
			}

			throw error;
		}
	}

	async simulateStepExecution(workflow, step) {
		const executionTime = Math.random() * 200 + 50;
		await new Promise((resolve) => setTimeout(resolve, executionTime));

		switch (step.type) {
			case 'data_processing':
				return {
					type: 'data_processing',
					data: { processedItems: Math.floor(Math.random() * 100) + 1 },
					success: true
				};
			case 'api_call':
				if (step.config.shouldFail)
					throw new Error('Simulated API call failure');
				return {
					type: 'api_call',
					data: { response: { status: 200, data: 'API response data' } },
					success: true
				};
			case 'validation':
				const isValid = Math.random() > 0.2;
				if (!isValid) throw new Error('Validation failed');
				return {
					type: 'validation',
					data: { validationPassed: true },
					success: true
				};
			default:
				return { type: 'generic', data: { executed: true }, success: true };
		}
	}

	checkStepDependencies(workflow, step) {
		if (!step.dependencies || step.dependencies.length === 0) return true;
		return step.dependencies.every((depId) => {
			const depStep = workflow.steps.find((s) => s.id === depId);
			return depStep && depStep.status === 'completed';
		});
	}

	findNextExecutableStep(workflow) {
		return workflow.steps.find(
			(step) =>
				step.status === 'pending' && this.checkStepDependencies(workflow, step)
		);
	}

	async createCheckpoint(workflowId, checkpointName) {
		const workflow = this.workflows.get(workflowId);
		if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

		const checkpoint = {
			name: checkpointName,
			timestamp: Date.now(),
			workflowState: JSON.parse(JSON.stringify(workflow)),
			stepStates: workflow.steps.map((step) => ({ ...step }))
		};

		workflow.checkpoints.push(checkpoint);
		this.emit('checkpoint:created', { workflowId, checkpointName, checkpoint });

		return { success: true, checkpointName, checkpoint };
	}

	async rollbackToCheckpoint(workflowId, checkpointName) {
		const workflow = this.workflows.get(workflowId);
		if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

		const checkpoint = workflow.checkpoints.find(
			(cp) => cp.name === checkpointName
		);
		if (!checkpoint) throw new Error(`Checkpoint ${checkpointName} not found`);

		const restoredWorkflow = checkpoint.workflowState;
		restoredWorkflow.checkpoints = workflow.checkpoints;

		this.workflows.set(workflowId, restoredWorkflow);
		this.stats.rollbackOperations++;

		this.addToHistory({
			workflowId,
			action: 'rollback',
			timestamp: Date.now(),
			details: { checkpointName, checkpointTimestamp: checkpoint.timestamp }
		});
		this.emit('workflow:rollback', {
			workflowId,
			checkpointName,
			workflow: restoredWorkflow
		});

		return { success: true, workflowId, checkpointName };
	}

	async persistState() {
		if (!this.isActive) return;

		try {
			await new Promise((resolve) => setTimeout(resolve, 50));
			this.stats.persistenceOperations++;
			this.emit('state:persisted', {
				workflowCount: this.workflows.size,
				historyLength: this.workflowHistory.length
			});
		} catch (error) {
			this.stats.errors++;
			this.emit('state:persistence:failed', { error: error.message });
		}
	}

	addToHistory(entry) {
		this.workflowHistory.push(entry);
		if (this.workflowHistory.length > this.options.maxWorkflowHistory) {
			this.workflowHistory.shift();
		}
	}

	getWorkflow(workflowId) {
		return this.workflows.get(workflowId);
	}

	getAllWorkflows() {
		return Array.from(this.workflows.values());
	}

	getWorkflowsByStatus(status) {
		return Array.from(this.workflows.values()).filter(
			(w) => w.status === status
		);
	}

	getStats() {
		return {
			...this.stats,
			activeWorkflows: this.workflows.size,
			historyLength: this.workflowHistory.length
		};
	}

	async healthCheck() {
		return {
			status: this.isActive ? 'active' : 'inactive',
			activeWorkflows: this.workflows.size,
			workflowsByStatus: {
				created: this.getWorkflowsByStatus('created').length,
				running: this.getWorkflowsByStatus('running').length,
				completed: this.getWorkflowsByStatus('completed').length,
				failed: this.getWorkflowsByStatus('failed').length
			},
			timestamp: Date.now()
		};
	}
}

describe('WorkflowStateManager Service', () => {
	let manager;
	let eventLog;

	beforeEach(() => {
		manager = new MockWorkflowStateManager();
		eventLog = [];
		manager.on('manager:started', (data) =>
			eventLog.push({ event: 'manager:started', data })
		);
		manager.on('manager:stopped', (data) =>
			eventLog.push({ event: 'manager:stopped', data })
		);
		manager.on('workflow:created', (data) =>
			eventLog.push({ event: 'workflow:created', data })
		);
		manager.on('workflow:state:changed', (data) =>
			eventLog.push({ event: 'workflow:state:changed', data })
		);
		manager.on('workflow:completed', (data) =>
			eventLog.push({ event: 'workflow:completed', data })
		);
		manager.on('workflow:rollback', (data) =>
			eventLog.push({ event: 'workflow:rollback', data })
		);
		manager.on('step:started', (data) =>
			eventLog.push({ event: 'step:started', data })
		);
		manager.on('step:completed', (data) =>
			eventLog.push({ event: 'step:completed', data })
		);
		manager.on('step:failed', (data) =>
			eventLog.push({ event: 'step:failed', data })
		);
		manager.on('step:retry', (data) =>
			eventLog.push({ event: 'step:retry', data })
		);
		manager.on('checkpoint:created', (data) =>
			eventLog.push({ event: 'checkpoint:created', data })
		);
		manager.on('state:persisted', (data) =>
			eventLog.push({ event: 'state:persisted', data })
		);
	});

	afterEach(async () => {
		if (manager.isActive) await manager.stop();
	});

	describe('Manager Lifecycle', () => {
		test('should start manager successfully', async () => {
			const result = await manager.start();
			expect(result.success).toBe(true);
			expect(manager.isActive).toBe(true);
			expect(eventLog.some((e) => e.event === 'manager:started')).toBe(true);
		});

		test('should stop manager successfully', async () => {
			await manager.start();
			const result = await manager.stop();
			expect(result.success).toBe(true);
			expect(manager.isActive).toBe(false);
			expect(eventLog.some((e) => e.event === 'manager:stopped')).toBe(true);
		});

		test('should handle double start attempt', async () => {
			await manager.start();
			await expect(manager.start()).rejects.toThrow(
				'WorkflowStateManager already active'
			);
		});

		test('should perform health check', async () => {
			const healthBefore = await manager.healthCheck();
			expect(healthBefore.status).toBe('inactive');

			await manager.start();
			const healthAfter = await manager.healthCheck();
			expect(healthAfter.status).toBe('active');
			expect(healthAfter.activeWorkflows).toBe(0);
		});
	});

	describe('Workflow Creation and Management', () => {
		beforeEach(async () => {
			await manager.start();
		});

		test('should create workflow successfully', async () => {
			const workflowConfig = {
				id: 'test-workflow-1',
				name: 'Test Workflow',
				steps: [
					{ id: 'step1', name: 'Data Processing', type: 'data_processing' },
					{
						id: 'step2',
						name: 'Validation',
						type: 'validation',
						dependencies: ['step1']
					}
				],
				initialData: { input: 'test-data' },
				metadata: { createdBy: 'test-user' }
			};

			const result = await manager.createWorkflow(workflowConfig);

			expect(result.success).toBe(true);
			expect(result.workflowId).toBe('test-workflow-1');
			expect(result.workflow.status).toBe('created');
			expect(result.workflow.steps).toHaveLength(2);
			expect(manager.workflows.size).toBe(1);
			expect(eventLog.some((e) => e.event === 'workflow:created')).toBe(true);
		});

		test('should handle duplicate workflow creation', async () => {
			const workflowConfig = {
				id: 'duplicate-workflow',
				name: 'Duplicate Test',
				steps: [{ id: 'step1', name: 'Test Step', type: 'data_processing' }]
			};

			await manager.createWorkflow(workflowConfig);
			await expect(manager.createWorkflow(workflowConfig)).rejects.toThrow(
				'Workflow duplicate-workflow already exists'
			);
		});

		test('should get workflow by ID', async () => {
			const workflowConfig = {
				id: 'get-test-workflow',
				name: 'Get Test',
				steps: [{ id: 'step1', name: 'Test Step', type: 'data_processing' }]
			};

			await manager.createWorkflow(workflowConfig);
			const workflow = manager.getWorkflow('get-test-workflow');

			expect(workflow).toBeDefined();
			expect(workflow.id).toBe('get-test-workflow');
			expect(workflow.name).toBe('Get Test');
		});

		test('should get workflows by status', async () => {
			const configs = [
				{
					id: 'workflow-1',
					name: 'Workflow 1',
					steps: [{ id: 'step1', name: 'Step 1', type: 'data_processing' }]
				},
				{
					id: 'workflow-2',
					name: 'Workflow 2',
					steps: [{ id: 'step1', name: 'Step 1', type: 'validation' }]
				}
			];

			for (const config of configs) {
				await manager.createWorkflow(config);
			}

			await manager.startWorkflow('workflow-1');

			const createdWorkflows = manager.getWorkflowsByStatus('created');
			const runningWorkflows = manager.getWorkflowsByStatus('running');

			expect(createdWorkflows).toHaveLength(1);
			expect(runningWorkflows).toHaveLength(1);
			expect(createdWorkflows[0].id).toBe('workflow-2');
			expect(runningWorkflows[0].id).toBe('workflow-1');
		});
	});

	describe('Workflow Execution', () => {
		beforeEach(async () => {
			await manager.start();
		});

		test('should start and execute simple workflow', async () => {
			const workflowConfig = {
				id: 'simple-workflow',
				name: 'Simple Test',
				steps: [{ id: 'step1', name: 'Process Data', type: 'data_processing' }]
			};

			await manager.createWorkflow(workflowConfig);
			const result = await manager.startWorkflow('simple-workflow');

			expect(result.success).toBe(true);

			// Wait for step completion
			await new Promise((resolve) => {
				manager.once('workflow:completed', resolve);
			});

			const workflow = manager.getWorkflow('simple-workflow');
			expect(workflow.status).toBe('completed');
			expect(workflow.steps[0].status).toBe('completed');
			expect(eventLog.some((e) => e.event === 'step:started')).toBe(true);
			expect(eventLog.some((e) => e.event === 'step:completed')).toBe(true);
			expect(eventLog.some((e) => e.event === 'workflow:completed')).toBe(true);
		});

		test('should execute workflow with dependencies', async () => {
			const workflowConfig = {
				id: 'dependency-workflow',
				name: 'Dependency Test',
				steps: [
					{ id: 'step1', name: 'First Step', type: 'data_processing' },
					{
						id: 'step2',
						name: 'Second Step',
						type: 'validation',
						dependencies: ['step1']
					},
					{
						id: 'step3',
						name: 'Third Step',
						type: 'api_call',
						dependencies: ['step2']
					}
				]
			};

			await manager.createWorkflow(workflowConfig);
			await manager.startWorkflow('dependency-workflow');

			// Wait for completion
			await new Promise((resolve) => {
				manager.once('workflow:completed', resolve);
			});

			const workflow = manager.getWorkflow('dependency-workflow');
			expect(workflow.status).toBe('completed');

			workflow.steps.forEach((step) => {
				expect(step.status).toBe('completed');
				expect(step.completedAt).toBeDefined();
			});
		});

		test('should handle step failures and retries', async () => {
			const workflowConfig = {
				id: 'retry-workflow',
				name: 'Retry Test',
				steps: [
					{
						id: 'step1',
						name: 'Failing Step',
						type: 'api_call',
						config: { shouldFail: true }
					}
				]
			};

			await manager.createWorkflow(workflowConfig);
			await manager.startWorkflow('retry-workflow');

			// Wait for workflow to fail after retries
			await new Promise((resolve) => {
				manager.once('workflow:state:changed', (data) => {
					if (data.to === 'failed') resolve();
				});
			});

			const workflow = manager.getWorkflow('retry-workflow');
			expect(workflow.status).toBe('failed');
			expect(workflow.steps[0].retryCount).toBe(
				manager.options.maxRetryAttempts
			);
			expect(eventLog.filter((e) => e.event === 'step:retry')).toHaveLength(
				manager.options.maxRetryAttempts
			);
		});
	});

	describe('State Management and Persistence', () => {
		beforeEach(async () => {
			await manager.start();
		});

		test('should create and restore checkpoints', async () => {
			const workflowConfig = {
				id: 'checkpoint-workflow',
				name: 'Checkpoint Test',
				steps: [
					{ id: 'step1', name: 'First Step', type: 'data_processing' },
					{
						id: 'step2',
						name: 'Second Step',
						type: 'validation',
						dependencies: ['step1']
					}
				]
			};

			await manager.createWorkflow(workflowConfig);
			await manager.startWorkflow('checkpoint-workflow');

			// Wait for first step to complete
			await new Promise((resolve) => {
				manager.once('step:completed', resolve);
			});

			// Create checkpoint
			const checkpointResult = await manager.createCheckpoint(
				'checkpoint-workflow',
				'after-step1'
			);
			expect(checkpointResult.success).toBe(true);
			expect(eventLog.some((e) => e.event === 'checkpoint:created')).toBe(true);

			// Let workflow continue to completion
			await new Promise((resolve) => {
				manager.once('workflow:completed', resolve);
			});

			// Rollback to checkpoint
			const rollbackResult = await manager.rollbackToCheckpoint(
				'checkpoint-workflow',
				'after-step1'
			);
			expect(rollbackResult.success).toBe(true);

			const workflow = manager.getWorkflow('checkpoint-workflow');
			expect(workflow.steps[0].status).toBe('completed');
			expect(workflow.steps[1].status).toBe('pending');
			expect(eventLog.some((e) => e.event === 'workflow:rollback')).toBe(true);
		});

		test('should persist state', async () => {
			const workflowConfig = {
				id: 'persistence-workflow',
				name: 'Persistence Test',
				steps: [{ id: 'step1', name: 'Test Step', type: 'data_processing' }]
			};

			await manager.createWorkflow(workflowConfig);

			await manager.persistState();
			expect(eventLog.some((e) => e.event === 'state:persisted')).toBe(true);
		});

		test('should track statistics accurately', async () => {
			const workflowConfig = {
				id: 'stats-workflow',
				name: 'Stats Test',
				steps: [{ id: 'step1', name: 'Test Step', type: 'data_processing' }]
			};

			await manager.createWorkflow(workflowConfig);
			await manager.startWorkflow('stats-workflow');

			// Wait for completion
			await new Promise((resolve) => {
				manager.once('workflow:completed', resolve);
			});

			const stats = manager.getStats();

			expect(stats.workflowsCreated).toBe(1);
			expect(stats.workflowsCompleted).toBe(1);
			expect(stats.stateTransitions).toBeGreaterThan(0);
			expect(stats.activeWorkflows).toBe(1);
		});
	});

	describe('Error Handling and Edge Cases', () => {
		beforeEach(async () => {
			await manager.start();
		});

		test('should handle operations when manager not active', async () => {
			await manager.stop();

			await expect(
				manager.createWorkflow({
					id: 'test',
					name: 'test',
					steps: []
				})
			).rejects.toThrow('Manager not active');
		});

		test('should handle invalid workflow operations', async () => {
			await expect(manager.startWorkflow('nonexistent')).rejects.toThrow(
				'Workflow nonexistent not found'
			);
		});

		test('should handle checkpoint operations on nonexistent workflow', async () => {
			await expect(
				manager.createCheckpoint('nonexistent', 'test')
			).rejects.toThrow('Workflow nonexistent not found');

			await expect(
				manager.rollbackToCheckpoint('nonexistent', 'test')
			).rejects.toThrow('Workflow nonexistent not found');
		});

		test('should handle concurrent workflow operations', async () => {
			const workflowConfigs = [];
			for (let i = 1; i <= 3; i++) {
				workflowConfigs.push({
					id: `concurrent-workflow-${i}`,
					name: `Concurrent Workflow ${i}`,
					steps: [{ id: 'step1', name: 'Test Step', type: 'data_processing' }]
				});
			}

			const createResults = await Promise.all(
				workflowConfigs.map((config) => manager.createWorkflow(config))
			);

			expect(createResults).toHaveLength(3);
			createResults.forEach((result) => {
				expect(result.success).toBe(true);
			});

			const startResults = await Promise.all(
				workflowConfigs.map((config) => manager.startWorkflow(config.id))
			);

			expect(startResults).toHaveLength(3);
			startResults.forEach((result) => {
				expect(result.success).toBe(true);
			});
		});
	});
});
