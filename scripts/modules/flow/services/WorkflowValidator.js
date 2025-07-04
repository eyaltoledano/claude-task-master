/**
 * WorkflowValidator - Validate workflow readiness and patterns following dev_workflow.mdc
 * 
 * Ensures proper workflow patterns are followed:
 * - Task readiness for PR creation
 * - Subtask implementation pattern validation
 * - Git state validation
 * - Workflow step prerequisites
 */

import { log } from '../../utils.js';
import { DirectBackend } from '../backends/direct-backend.js';
import { execSync } from 'child_process';
import path from 'path';

const logger = {
    info: (msg) => log('info', msg),
    error: (msg) => log('error', msg),
    debug: (msg) => log('debug', msg),
    success: (msg) => log('success', msg)
};

export class WorkflowValidator {
    constructor() {
        this.backend = new DirectBackend();
    }

    /**
     * Validate if task is ready for PR creation
     */
    async validateTaskReadyForPR(taskId) {
        try {
            logger.debug(`Validating task ${taskId} readiness for PR creation`);

            const validationResults = {
                isReady: true,
                warnings: [],
                errors: [],
                suggestions: []
            };

            // Get task details
            const task = await this.backend.getTask(taskId);
            if (!task) {
                validationResults.isReady = false;
                validationResults.errors.push(`Task ${taskId} not found`);
                return validationResults;
            }

            // Check task status
            if (!['in-progress', 'done'].includes(task.status)) {
                validationResults.isReady = false;
                validationResults.errors.push(`Task status should be 'in-progress' or 'done', currently '${task.status}'`);
            }

            // Check if task has proper implementation details
            if (!task.details || task.details.trim().length < 50) {
                validationResults.warnings.push('Task has minimal implementation details. Consider adding more context.');
            }

            // Check subtasks if they exist
            if (task.subtasks && task.subtasks.length > 0) {
                const subtaskValidation = await this._validateSubtasksForPR(task.subtasks);
                validationResults.warnings.push(...subtaskValidation.warnings);
                validationResults.errors.push(...subtaskValidation.errors);
                
                if (subtaskValidation.hasBlockingIssues) {
                    validationResults.isReady = false;
                }
            }

            // Check for implementation patterns
            const patternValidation = await this.validateSubtaskImplementationPattern(taskId);
            if (!patternValidation.isValid) {
                validationResults.warnings.push(...patternValidation.warnings);
                if (patternValidation.hasRequiredIssues) {
                    validationResults.errors.push(...patternValidation.errors);
                    validationResults.isReady = false;
                }
            }

            // Generate suggestions
            this._generatePRReadinessSuggestions(validationResults, task);

            return validationResults;
        } catch (error) {
            logger.error(`Error validating task readiness for PR:`, error);
            return {
                isReady: false,
                errors: [`Validation error: ${error.message}`],
                warnings: [],
                suggestions: []
            };
        }
    }

    /**
     * Validate subtask implementation pattern following dev_workflow.mdc
     */
    async validateSubtaskImplementationPattern(subtaskId) {
        try {
            logger.debug(`Validating subtask ${subtaskId} implementation pattern`);

            const validation = {
                isValid: true,
                hasRequiredIssues: false,
                warnings: [],
                errors: [],
                phases: {
                    exploration: false,
                    implementation: false,
                    completion: false
                }
            };

            let task;
            if (subtaskId.includes('.')) {
                // This is a subtask - get the parent task and find the specific subtask
                const parentId = subtaskId.split('.')[0];
                const subtaskIndex = parseInt(subtaskId.split('.')[1]) - 1;
                
                const parentTask = await this.backend.getTask(parentId);
                if (!parentTask || !parentTask.subtasks || !parentTask.subtasks[subtaskIndex]) {
                    validation.isValid = false;
                    validation.errors.push(`Subtask ${subtaskId} not found`);
                    return validation;
                }
                
                task = parentTask.subtasks[subtaskIndex];
            } else {
                // This is a parent task
                task = await this.backend.getTask(subtaskId);
                if (!task) {
                    validation.isValid = false;
                    validation.errors.push(`Task ${subtaskId} not found`);
                    return validation;
                }
            }

            // Check for implementation phases in task details
            const details = task.details || '';
            
            // Look for exploration phase patterns
            if (details.includes('### Progress Update') || 
                details.includes('Exploration') || 
                details.includes('**Findings:**') ||
                details.includes('file paths') ||
                details.includes('proposed diffs')) {
                validation.phases.exploration = true;
            }

            // Look for implementation phase patterns
            if (details.includes('Implementation') || 
                details.includes('**Decisions Made:**') ||
                details.includes('Progress committed') ||
                details.includes('what worked') ||
                details.includes('what didn\'t work')) {
                validation.phases.implementation = true;
            }

            // Look for completion phase patterns
            if (details.includes('Implementation completed') || 
                details.includes('**Testing:**') ||
                details.includes('Summary') ||
                task.status === 'done') {
                validation.phases.completion = true;
            }

            // Generate warnings based on missing phases
            if (!validation.phases.exploration) {
                validation.warnings.push(`${subtaskId}: Missing exploration phase documentation. Consider logging initial research and planning.`);
            }

            if (!validation.phases.implementation && task.status === 'in-progress') {
                validation.warnings.push(`${subtaskId}: Missing implementation progress logs. Consider updating with findings and decisions.`);
            }

            if (!validation.phases.completion && task.status === 'done') {
                validation.warnings.push(`${subtaskId}: Missing completion summary. Consider adding final implementation notes.`);
            }

            // Determine if pattern is sufficiently followed
            const completedPhases = Object.values(validation.phases).filter(Boolean).length;
            if (completedPhases === 0) {
                validation.isValid = false;
                validation.hasRequiredIssues = true;
                validation.errors.push(`${subtaskId}: No implementation pattern detected. Please follow dev_workflow.mdc guidelines.`);
            }

            return validation;
        } catch (error) {
            logger.error(`Error validating subtask implementation pattern:`, error);
            return {
                isValid: false,
                hasRequiredIssues: true,
                errors: [`Pattern validation error: ${error.message}`],
                warnings: [],
                phases: { exploration: false, implementation: false, completion: false }
            };
        }
    }

    /**
     * Validate commit message format
     * @param {string} message - Commit message
     * @returns {Object} Validation result
     */
    validateCommitMessageFormat(message) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: []
        };

        // Check basic format: type(scope): description
        const basicFormatRegex = /^(feat|fix|docs|test|refactor|chore)\([^)]+\): .+/;
        if (!basicFormatRegex.test(message)) {
            validation.isValid = false;
            validation.errors.push('Commit message should follow format: type(scope): description');
            validation.suggestions.push('Example: feat(task-4): Complete subtask 4.1 - Initialize Express server');
            return validation;
        }

        // Check for task reference in scope
        const taskScopeRegex = /\(task-\d+\)/;
        if (!taskScopeRegex.test(message)) {
            validation.warnings.push('Consider including task reference in scope (e.g., task-4)');
        }

        // Check message length
        const firstLine = message.split('\n')[0];
        if (firstLine.length > 72) {
            validation.warnings.push('First line should be 72 characters or less');
        }

        // Check for body content on multi-line messages
        const lines = message.split('\n');
        if (lines.length > 1 && lines[1] !== '') {
            validation.warnings.push('Add blank line between subject and body');
        }

        // Check for required elements in subtask commits
        if (message.includes('subtask')) {
            const hasSubtaskDetails = message.includes('Subtask') && message.includes('Relates to Task');
            if (!hasSubtaskDetails) {
                validation.warnings.push('Subtask commits should include "Subtask X.Y:" and "Relates to Task X:" sections');
            }
        }

        return validation;
    }

    /**
     * Validate workflow prerequisites are met
     */
    async validateWorkflowPrerequisites(workflowType, context = {}) {
        try {
            logger.debug(`Validating prerequisites for ${workflowType} workflow`);

            const validation = {
                isReady: true,
                errors: [],
                warnings: [],
                prerequisites: {}
            };

            switch (workflowType) {
                case 'pr-creation':
                    return await this._validatePRPrerequisites(context, validation);
                
                case 'local-merge':
                    return await this._validateLocalMergePrerequisites(context, validation);
                
                default:
                    validation.isReady = false;
                    validation.errors.push(`Unknown workflow type: ${workflowType}`);
                    return validation;
            }
        } catch (error) {
            logger.error(`Error validating workflow prerequisites:`, error);
            return {
                isReady: false,
                errors: [`Prerequisites validation error: ${error.message}`],
                warnings: [],
                prerequisites: {}
            };
        }
    }

    /**
     * Generate workflow recommendations based on current state
     */
    async generateWorkflowRecommendations(taskId, currentState = {}) {
        try {
            const recommendations = {
                immediate: [],
                suggested: [],
                warnings: []
            };

            const task = await this.backend.getTask(taskId);
            if (!task) {
                recommendations.warnings.push(`Task ${taskId} not found`);
                return recommendations;
            }

            // Status-based recommendations
            switch (task.status) {
                case 'pending':
                    recommendations.immediate.push('Start implementation by setting status to in-progress');
                    recommendations.suggested.push('Create a worktree for isolated development');
                    break;
                
                case 'in-progress':
                    recommendations.immediate.push('Log implementation progress regularly');
                    recommendations.suggested.push('Commit progress incrementally following dev_workflow.mdc patterns');
                    break;
                
                case 'done':
                    recommendations.immediate.push('Consider creating PR or merging locally');
                    break;
            }

            // Git status recommendations
            if (currentState.hasUncommittedChanges) {
                recommendations.immediate.push('Commit current changes before proceeding');
            }

            // Pattern compliance recommendations
            const patternValidation = await this.validateSubtaskImplementationPattern(taskId);
            if (!patternValidation.phases.exploration) {
                recommendations.suggested.push('Document exploration findings and implementation plan');
            }
            if (!patternValidation.phases.implementation && task.status === 'in-progress') {
                recommendations.suggested.push('Log implementation progress with findings and decisions');
            }

            return recommendations;
        } catch (error) {
            logger.error(`Error generating workflow recommendations:`, error);
            return {
                immediate: [],
                suggested: [],
                warnings: [`Recommendations error: ${error.message}`]
            };
        }
    }

    // Private helper methods

    async _validateSubtasksForPR(subtasks) {
        const validation = {
            hasBlockingIssues: false,
            warnings: [],
            errors: []
        };

        let completedSubtasks = 0;
        for (const subtask of subtasks) {
            if (subtask.status === 'done') {
                completedSubtasks++;
            } else if (subtask.status === 'in-progress') {
                validation.warnings.push(`Subtask ${subtask.id} is still in progress`);
            } else if (subtask.status === 'pending') {
                validation.warnings.push(`Subtask ${subtask.id} hasn't been started`);
            }
        }

        const completionPercentage = (completedSubtasks / subtasks.length) * 100;
        if (completionPercentage < 80) {
            validation.hasBlockingIssues = true;
            validation.errors.push(`Only ${completionPercentage.toFixed(0)}% of subtasks completed. Consider completing more before PR.`);
        } else if (completionPercentage < 100) {
            validation.warnings.push(`${completionPercentage.toFixed(0)}% of subtasks completed. Some subtasks remain.`);
        }

        return validation;
    }

    _generatePRReadinessSuggestions(validationResults, task) {
        if (task.status === 'in-progress') {
            validationResults.suggestions.push('Consider marking task as done if implementation is complete');
        }

        if (!task.testStrategy) {
            validationResults.suggestions.push('Add test strategy to ensure quality');
        }

        if (validationResults.warnings.length > 0) {
            validationResults.suggestions.push('Address warnings to improve PR quality');
        }
    }

    async _validatePRPrerequisites(context, validation) {
        // Check GitHub CLI availability
        try {
            execSync('gh --version', { stdio: 'ignore' });
            validation.prerequisites.githubCli = true;
        } catch (error) {
            validation.isReady = false;
            validation.errors.push('GitHub CLI (gh) not available. Install it to create PRs.');
            validation.prerequisites.githubCli = false;
        }

        // Check for GitHub remote
        try {
            const remoteUrl = execSync('git remote get-url origin', { 
                cwd: context.worktreePath || process.cwd(),
                encoding: 'utf8' 
            }).trim();
            
            validation.prerequisites.githubRemote = remoteUrl.includes('github.com');
            if (!validation.prerequisites.githubRemote) {
                validation.isReady = false;
                validation.errors.push('Repository is not hosted on GitHub. Use local merge instead.');
            }
        } catch (error) {
            validation.isReady = false;
            validation.errors.push('No git remote origin found');
            validation.prerequisites.githubRemote = false;
        }

        // Check git status
        if (context.worktreePath) {
            try {
                const gitStatus = execSync('git status --porcelain', { 
                    cwd: context.worktreePath,
                    encoding: 'utf8' 
                }).trim();
                
                validation.prerequisites.cleanWorkingDirectory = gitStatus.length === 0;
                if (!validation.prerequisites.cleanWorkingDirectory) {
                    validation.warnings.push('Uncommitted changes detected. Commit before creating PR.');
                }
            } catch (error) {
                validation.warnings.push('Could not check git status');
            }
        }

        return validation;
    }

    async _validateLocalMergePrerequisites(context, validation) {
        // Check git status
        if (context.worktreePath) {
            try {
                const gitStatus = execSync('git status --porcelain', { 
                    cwd: context.worktreePath,
                    encoding: 'utf8' 
                }).trim();
                
                validation.prerequisites.cleanWorkingDirectory = gitStatus.length === 0;
                if (!validation.prerequisites.cleanWorkingDirectory) {
                    validation.isReady = false;
                    validation.errors.push('Uncommitted changes detected. Commit before merging.');
                }
            } catch (error) {
                validation.isReady = false;
                validation.errors.push('Could not check git status');
            }
        }

        // Check target branch exists
        const targetBranch = context.targetBranch || 'main';
        try {
            execSync(`git rev-parse --verify ${targetBranch}`, { 
                cwd: context.projectRoot || process.cwd(),
                stdio: 'ignore' 
            });
            validation.prerequisites.targetBranchExists = true;
        } catch (error) {
            validation.isReady = false;
            validation.errors.push(`Target branch '${targetBranch}' does not exist`);
            validation.prerequisites.targetBranchExists = false;
        }

        return validation;
    }
} 