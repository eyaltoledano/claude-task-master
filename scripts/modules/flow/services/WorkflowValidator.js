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

const logger = {
    info: (msg) => log('info', msg),
    error: (msg) => log('error', msg),
    debug: (msg) => log('debug', msg),
    success: (msg) => log('success', msg)
};

export class WorkflowValidator {
    constructor(directBackend, gitWorkflowManager) {
        this.directBackend = directBackend;
        this.gitWorkflowManager = gitWorkflowManager;
    }

    /**
     * Validate if task is ready for PR creation
     */
    async validateTaskReadyForPR(taskId, worktreePath) {
        try {
            logger.debug(`Validating task ${taskId} readiness for PR creation`);

            const validationResults = {
                ready: true,
                issues: [],
                warnings: []
            };

            // 1. Check if task has proper implementation details logged
            const taskResult = await this.directBackend.getTask(taskId);
            if (!taskResult.success) {
                validationResults.ready = false;
                validationResults.issues.push('Task not found or inaccessible');
                return validationResults;
            }

            const task = taskResult.data;

            // Check if task has sufficient details
            if (!task.details || task.details.trim().length < 50) {
                validationResults.warnings.push('Task has minimal implementation details logged');
            }

            // Check if task has subtasks with progress
            if (task.subtasks && task.subtasks.length > 0) {
                const hasProgressLogging = task.subtasks.some(subtask => 
                    subtask.details && subtask.details.includes('<info added on')
                );
                
                if (!hasProgressLogging) {
                    validationResults.warnings.push('Subtasks have minimal progress logging');
                }
            }

            // 2. Verify commits follow proper format
            if (worktreePath && this.gitWorkflowManager) {
                const gitStatus = await this.gitWorkflowManager.validateCommitReadiness(worktreePath);
                
                if (gitStatus.hasUncommittedChanges) {
                    validationResults.ready = false;
                    validationResults.issues.push('Worktree has uncommitted changes');
                }

                // Check recent commits for proper format
                try {
                    const commitValidation = await this.validateCommitMessages(worktreePath);
                    if (!commitValidation.allValid) {
                        validationResults.warnings.push('Some commits do not follow dev_workflow.mdc format');
                    }
                } catch (error) {
                    logger.debug('Could not validate commit messages:', error.message);
                }
            }

            // 3. Check task status
            if (!['in-progress', 'done'].includes(task.status)) {
                validationResults.ready = false;
                validationResults.issues.push(`Task status is '${task.status}', should be 'in-progress' or 'done'`);
            }

            return validationResults;

        } catch (error) {
            logger.error(`Error validating task readiness for PR:`, error);
            return {
                ready: false,
                issues: [`Validation error: ${error.message}`],
                warnings: []
            };
        }
    }

    /**
     * Validate subtask implementation pattern following dev_workflow.mdc
     */
    async validateSubtaskImplementationPattern(subtaskId) {
        try {
            logger.debug(`Validating subtask ${subtaskId} implementation pattern`);

            const validationResults = {
                valid: true,
                phases: {
                    exploration: false,
                    implementation: false,
                    completion: false
                },
                issues: [],
                suggestions: []
            };

            // Get subtask details
            const taskResult = await this.directBackend.getTask(subtaskId);
            if (!taskResult.success) {
                validationResults.valid = false;
                validationResults.issues.push('Subtask not found or inaccessible');
                return validationResults;
            }

            const subtask = taskResult.data;
            const details = subtask.details || '';

            // Check for exploration phase logging
            if (details.includes('exploration') || details.includes('planning') || details.includes('file paths')) {
                validationResults.phases.exploration = true;
            } else {
                validationResults.suggestions.push('Consider logging exploration phase with file paths and proposed changes');
            }

            // Check for implementation progress updates
            const progressEntries = (details.match(/<info added on/g) || []).length;
            if (progressEntries >= 2) {
                validationResults.phases.implementation = true;
            } else {
                validationResults.suggestions.push('Consider logging more implementation progress updates');
            }

            // Check for completion summary
            if (details.includes('completion') || details.includes('implemented') || subtask.status === 'done') {
                validationResults.phases.completion = true;
            } else if (subtask.status !== 'done') {
                validationResults.suggestions.push('Consider adding completion summary when marking subtask as done');
            }

            // Overall validation
            const completedPhases = Object.values(validationResults.phases).filter(Boolean).length;
            if (completedPhases < 2) {
                validationResults.valid = false;
                validationResults.issues.push('Subtask implementation pattern incomplete - missing key phases');
            }

            return validationResults;

        } catch (error) {
            logger.error(`Error validating subtask implementation pattern:`, error);
            return {
                valid: false,
                phases: { exploration: false, implementation: false, completion: false },
                issues: [`Validation error: ${error.message}`],
                suggestions: []
            };
        }
    }

    /**
     * Validate commit messages follow dev_workflow.mdc format
     */
    async validateCommitMessages(worktreePath) {
        try {
            const { execSync } = await import('child_process');
            
            // Get recent commits (last 10)
            const commits = execSync('git log --oneline -10', {
                cwd: worktreePath,
                encoding: 'utf8'
            }).trim().split('\n').filter(Boolean);

            const validationResults = {
                allValid: true,
                validCommits: 0,
                totalCommits: commits.length,
                issues: []
            };

            for (const commit of commits) {
                const [hash, ...messageParts] = commit.split(' ');
                const message = messageParts.join(' ');

                // Check for dev_workflow.mdc pattern: "type(task-X): description"
                const formatMatch = message.match(/^(feat|fix|docs|test|refactor|chore)\(task-\d+\):/);
                
                if (formatMatch) {
                    validationResults.validCommits++;
                } else {
                    validationResults.issues.push(`Commit ${hash}: "${message}" does not follow format`);
                }
            }

            if (validationResults.validCommits < validationResults.totalCommits * 0.8) {
                validationResults.allValid = false;
            }

            return validationResults;

        } catch (error) {
            logger.debug('Could not validate commit messages:', error.message);
            return {
                allValid: true, // Don't fail validation if we can't check
                validCommits: 0,
                totalCommits: 0,
                issues: []
            };
        }
    }

    /**
     * Validate workflow prerequisites are met
     */
    async validateWorkflowPrerequisites(workflowType, context = {}) {
        try {
            logger.debug(`Validating prerequisites for ${workflowType} workflow`);

            const validationResults = {
                ready: true,
                requirements: [],
                issues: []
            };

            switch (workflowType) {
                case 'pr-creation':
                    validationResults.requirements = [
                        'GitHub remote repository',
                        'GitHub CLI installed and authenticated',
                        'All changes committed',
                        'Task in appropriate status'
                    ];

                    // Check GitHub remote
                    if (!context.repoInfo?.isGitHub) {
                        validationResults.ready = false;
                        validationResults.issues.push('No GitHub remote repository detected');
                    }

                    // Check GitHub CLI
                    if (!context.repoInfo?.canCreatePR) {
                        validationResults.ready = false;
                        validationResults.issues.push('GitHub CLI not available or not authenticated');
                    }

                    break;

                case 'local-merge':
                    validationResults.requirements = [
                        'All changes committed',
                        'Target branch accessible',
                        'No merge conflicts expected'
                    ];

                    // Basic checks for local merge
                    if (context.gitStatus?.hasUncommittedChanges) {
                        validationResults.ready = false;
                        validationResults.issues.push('Uncommitted changes must be committed first');
                    }

                    break;

                default:
                    logger.debug(`Unknown workflow type: ${workflowType}`);
                    break;
            }

            return validationResults;

        } catch (error) {
            logger.error(`Error validating workflow prerequisites:`, error);
            return {
                ready: false,
                requirements: [],
                issues: [`Validation error: ${error.message}`]
            };
        }
    }

    /**
     * Generate workflow recommendations based on current state
     */
    async generateWorkflowRecommendations(taskId, worktreePath, repoInfo) {
        try {
            const recommendations = {
                nextSteps: [],
                improvements: [],
                warnings: []
            };

            // Validate task readiness
            const taskValidation = await this.validateTaskReadyForPR(taskId, worktreePath);
            
            if (!taskValidation.ready) {
                recommendations.nextSteps.push('Address task readiness issues before proceeding');
                recommendations.warnings.push(...taskValidation.issues);
            }

            // Repository-specific recommendations
            if (repoInfo?.isGitHub && repoInfo?.canCreatePR) {
                if (taskValidation.ready) {
                    recommendations.nextSteps.push('Ready to create pull request');
                }
            } else if (repoInfo?.hasRemote && !repoInfo?.isGitHub) {
                recommendations.nextSteps.push('Consider local merge workflow (non-GitHub remote)');
            } else {
                recommendations.nextSteps.push('Use local merge workflow (no remote repository)');
            }

            // Improvement suggestions
            if (taskValidation.warnings.length > 0) {
                recommendations.improvements.push(...taskValidation.warnings);
            }

            return recommendations;

        } catch (error) {
            logger.error(`Error generating workflow recommendations:`, error);
            return {
                nextSteps: ['Error generating recommendations'],
                improvements: [],
                warnings: [error.message]
            };
        }
    }
} 