/**
 * Workflow State Manager for Claude Code Automation
 * Manages complex workflow states, transitions, and rollback capabilities
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

export class WorkflowStateManager extends EventEmitter {
	constructor(config = {}) {
		super();
		
		this.config = {
			persistState: config.persistState !== false,
			stateFile: config.stateFile || '.taskmaster/workflow-state.json',
			maxHistorySize: config.maxHistorySize || 50,
			enableRollback: config.enableRollback !== false,
			...config
		};

		// Workflow states
		this.activeWorkflows = new Map();
		this.workflowHistory = [];
		this.stateTransitions = new Map();
		
		// State persistence
		this.persistenceTimer = null;
		this.isDirty = false;
	}

	/**
	 * Start a new workflow
	 */
	async startWorkflow(workflowId, initialState = {}) {
		const workflow = {
			id: workflowId,
			state: 'initialized',
			startTime: Date.now(),
			currentPhase: null,
			phases: [],
			data: { ...initialState },
			checkpoints: [],
			errors: [],
			metadata: {
				version: '1.0.0',
				createdBy: 'claude-code-automation',
				...initialState.metadata
			}
		};

		this.activeWorkflows.set(workflowId, workflow);
		this.recordStateTransition(workflowId, null, 'initialized');
		
		await this.persistStateIfNeeded();
		
		this.emit('workflow:started', { workflowId, workflow });
		return workflow;
	}

	/**
	 * Transition workflow to a new state
	 */
	async transitionWorkflow(workflowId, newState, phaseData = {}) {
		const workflow = this.activeWorkflows.get(workflowId);
		if (!workflow) {
			throw new Error(`Workflow ${workflowId} not found`);
		}

		const previousState = workflow.state;
		
		// Validate state transition
		if (!this.isValidTransition(previousState, newState)) {
			throw new Error(`Invalid state transition from ${previousState} to ${newState}`);
		}

		// Create checkpoint before transition
		await this.createCheckpoint(workflowId, `Before transition to ${newState}`);

		// Update workflow state
		workflow.state = newState;
		workflow.lastTransition = Date.now();
		
		// Add phase if provided
		if (phaseData.phaseName) {
			const phase = {
				name: phaseData.phaseName,
				state: newState,
				startTime: Date.now(),
				data: phaseData.data || {},
				result: null,
				error: null
			};
			workflow.phases.push(phase);
			workflow.currentPhase = phase;
		}

		// Record transition
		this.recordStateTransition(workflowId, previousState, newState);
		
		await this.persistStateIfNeeded();
		
		this.emit('workflow:state-changed', { 
			workflowId, 
			previousState, 
			newState, 
			workflow 
		});

		return workflow;
	}

	/**
	 * Complete current phase with result
	 */
	async completePhase(workflowId, result, nextState = null) {
		const workflow = this.activeWorkflows.get(workflowId);
		if (!workflow || !workflow.currentPhase) {
			throw new Error(`No active phase for workflow ${workflowId}`);
		}

		// Complete current phase
		workflow.currentPhase.endTime = Date.now();
		workflow.currentPhase.duration = workflow.currentPhase.endTime - workflow.currentPhase.startTime;
		workflow.currentPhase.result = result;
		workflow.currentPhase.state = 'completed';

		// Transition to next state if provided
		if (nextState) {
			await this.transitionWorkflow(workflowId, nextState);
		}

		await this.persistStateIfNeeded();
		
		this.emit('workflow:phase-completed', { 
			workflowId, 
			phase: workflow.currentPhase,
			result 
		});

		return workflow;
	}

	/**
	 * Fail current phase with error
	 */
	async failPhase(workflowId, error, shouldRollback = false) {
		const workflow = this.activeWorkflows.get(workflowId);
		if (!workflow) {
			throw new Error(`Workflow ${workflowId} not found`);
		}

		// Record error
		const errorRecord = {
			timestamp: Date.now(),
			phase: workflow.currentPhase?.name,
			state: workflow.state,
			error: error.message,
			stack: error.stack
		};
		workflow.errors.push(errorRecord);

		// Update current phase if exists
		if (workflow.currentPhase) {
			workflow.currentPhase.endTime = Date.now();
			workflow.currentPhase.duration = workflow.currentPhase.endTime - workflow.currentPhase.startTime;
			workflow.currentPhase.error = errorRecord;
			workflow.currentPhase.state = 'failed';
		}

		// Transition to failed state
		await this.transitionWorkflow(workflowId, 'failed');

		// Perform rollback if requested
		if (shouldRollback && this.config.enableRollback) {
			await this.rollbackToLastCheckpoint(workflowId);
		}

		await this.persistStateIfNeeded();
		
		this.emit('workflow:phase-failed', { 
			workflowId, 
			error: errorRecord,
			workflow 
		});

		return workflow;
	}

	/**
	 * Create a checkpoint for rollback
	 */
	async createCheckpoint(workflowId, description = '') {
		const workflow = this.activeWorkflows.get(workflowId);
		if (!workflow) {
			throw new Error(`Workflow ${workflowId} not found`);
		}

		const checkpoint = {
			id: `checkpoint-${Date.now()}`,
			timestamp: Date.now(),
			description,
			state: workflow.state,
			data: JSON.parse(JSON.stringify(workflow.data)),
			phaseCount: workflow.phases.length
		};

		workflow.checkpoints.push(checkpoint);
		
		// Keep only recent checkpoints
		if (workflow.checkpoints.length > 10) {
			workflow.checkpoints = workflow.checkpoints.slice(-10);
		}

		await this.persistStateIfNeeded();
		
		this.emit('workflow:checkpoint-created', { workflowId, checkpoint });
		return checkpoint;
	}

	/**
	 * Rollback to last checkpoint
	 */
	async rollbackToLastCheckpoint(workflowId) {
		const workflow = this.activeWorkflows.get(workflowId);
		if (!workflow || workflow.checkpoints.length === 0) {
			throw new Error(`No checkpoints available for workflow ${workflowId}`);
		}

		const lastCheckpoint = workflow.checkpoints[workflow.checkpoints.length - 1];
		
		// Restore state from checkpoint
		workflow.state = lastCheckpoint.state;
		workflow.data = JSON.parse(JSON.stringify(lastCheckpoint.data));
		
		// Remove phases after checkpoint
		workflow.phases = workflow.phases.slice(0, lastCheckpoint.phaseCount);
		workflow.currentPhase = workflow.phases[workflow.phases.length - 1] || null;

		// Record rollback
		this.recordStateTransition(workflowId, 'failed', lastCheckpoint.state, 'rollback');

		await this.persistStateIfNeeded();
		
		this.emit('workflow:rolled-back', { 
			workflowId, 
			checkpoint: lastCheckpoint,
			workflow 
		});

		return workflow;
	}

	/**
	 * Complete workflow
	 */
	async completeWorkflow(workflowId, finalResult = {}) {
		const workflow = this.activeWorkflows.get(workflowId);
		if (!workflow) {
			throw new Error(`Workflow ${workflowId} not found`);
		}

		// Complete current phase if active
		if (workflow.currentPhase && workflow.currentPhase.state !== 'completed') {
			await this.completePhase(workflowId, finalResult);
		}

		// Update workflow
		workflow.state = 'completed';
		workflow.endTime = Date.now();
		workflow.duration = workflow.endTime - workflow.startTime;
		workflow.finalResult = finalResult;

		// Move to history
		this.workflowHistory.push({
			...workflow,
			completedAt: Date.now()
		});

		// Keep history size manageable
		if (this.workflowHistory.length > this.config.maxHistorySize) {
			this.workflowHistory = this.workflowHistory.slice(-this.config.maxHistorySize);
		}

		// Remove from active workflows
		this.activeWorkflows.delete(workflowId);

		await this.persistStateIfNeeded();
		
		this.emit('workflow:completed', { workflowId, workflow, finalResult });
		return workflow;
	}

	/**
	 * Validate state transition
	 */
	isValidTransition(fromState, toState) {
		const validTransitions = {
			'initialized': ['running', 'failed'],
			'running': ['phase-1', 'phase-2', 'phase-3', 'phase-4', 'phase-5', 'completed', 'failed'],
			'phase-1': ['phase-2', 'completed', 'failed'],
			'phase-2': ['phase-3', 'completed', 'failed'],
			'phase-3': ['phase-4', 'completed', 'failed'],
			'phase-4': ['phase-5', 'completed', 'failed'],
			'phase-5': ['completed', 'failed'],
			'failed': ['running', 'completed'], // Allow recovery
			'completed': [] // Terminal state
		};

		return validTransitions[fromState]?.includes(toState) || false;
	}

	/**
	 * Record state transition
	 */
	recordStateTransition(workflowId, fromState, toState, type = 'normal') {
		const transition = {
			workflowId,
			fromState,
			toState,
			type,
			timestamp: Date.now()
		};

		this.stateTransitions.set(`${workflowId}-${Date.now()}`, transition);
		this.isDirty = true;
	}

	/**
	 * Get workflow status
	 */
	getWorkflowStatus(workflowId) {
		const workflow = this.activeWorkflows.get(workflowId);
		if (!workflow) {
			// Check history
			const historical = this.workflowHistory.find(w => w.id === workflowId);
			return historical || null;
		}

		return {
			...workflow,
			isActive: true,
			progress: this.calculateProgress(workflow),
			estimatedTimeRemaining: this.estimateTimeRemaining(workflow)
		};
	}

	/**
	 * Calculate workflow progress
	 */
	calculateProgress(workflow) {
		const totalPhases = 5; // Based on our 5-phase system
		const completedPhases = workflow.phases.filter(p => p.state === 'completed').length;
		return Math.round((completedPhases / totalPhases) * 100);
	}

	/**
	 * Estimate time remaining
	 */
	estimateTimeRemaining(workflow) {
		if (workflow.phases.length === 0) return null;

		const completedPhases = workflow.phases.filter(p => p.state === 'completed');
		if (completedPhases.length === 0) return null;

		const avgPhaseTime = completedPhases.reduce((sum, p) => sum + (p.duration || 0), 0) / completedPhases.length;
		const remainingPhases = 5 - completedPhases.length;
		
		return remainingPhases * avgPhaseTime;
	}

	/**
	 * Persist state to disk
	 */
	async persistStateIfNeeded() {
		if (!this.config.persistState || !this.isDirty) return;

		try {
			const stateData = {
				activeWorkflows: Array.from(this.activeWorkflows.entries()),
				workflowHistory: this.workflowHistory.slice(-10), // Keep recent history
				stateTransitions: Array.from(this.stateTransitions.entries()).slice(-100),
				timestamp: Date.now()
			};

			await fs.writeFile(this.config.stateFile, JSON.stringify(stateData, null, 2));
			this.isDirty = false;
		} catch (error) {
			console.warn('Failed to persist workflow state:', error.message);
		}
	}

	/**
	 * Load state from disk
	 */
	async loadPersistedState() {
		if (!this.config.persistState) return;

		try {
			const data = await fs.readFile(this.config.stateFile, 'utf8');
			const stateData = JSON.parse(data);

			// Restore active workflows
			this.activeWorkflows = new Map(stateData.activeWorkflows || []);
			this.workflowHistory = stateData.workflowHistory || [];
			this.stateTransitions = new Map(stateData.stateTransitions || []);

			this.emit('state:loaded', { 
				activeWorkflows: this.activeWorkflows.size,
				historySize: this.workflowHistory.length 
			});
		} catch (error) {
			// File doesn't exist or is corrupted, start fresh
			console.log('No persisted workflow state found, starting fresh');
		}
	}

	/**
	 * Get all active workflows
	 */
	getActiveWorkflows() {
		return Array.from(this.activeWorkflows.values());
	}

	/**
	 * Get workflow history
	 */
	getWorkflowHistory(limit = 10) {
		return this.workflowHistory.slice(-limit);
	}

	/**
	 * Clean up completed workflows and old history
	 */
	async cleanup() {
		// Remove old history
		const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
		this.workflowHistory = this.workflowHistory.filter(w => w.completedAt > cutoffTime);

		// Clean up old state transitions
		const oldTransitions = Array.from(this.stateTransitions.entries())
			.filter(([key, transition]) => transition.timestamp < cutoffTime);
		
		for (const [key] of oldTransitions) {
			this.stateTransitions.delete(key);
		}

		await this.persistStateIfNeeded();
		
		this.emit('cleanup:completed', { 
			removedHistory: oldTransitions.length,
			currentHistory: this.workflowHistory.length 
		});
	}
}

export default WorkflowStateManager; 