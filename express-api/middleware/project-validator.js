import { createLogger } from '../utils/logger.js';
import { ValidationError, NotFoundError } from './error-handler.js';

const logger = createLogger('project-validator');

export async function projectValidator(req, res, next) {
    try {
        const { projectId } = req.params;
        
        // 验证项目ID格式
        if (!projectId || !/^[a-zA-Z0-9_-]+$/.test(projectId)) {
            throw new ValidationError('Invalid project ID format. Must contain only letters, numbers, hyphens, and underscores.');
        }

        // 验证项目ID长度
        if (projectId.length < 1 || projectId.length > 50) {
            throw new ValidationError('Project ID must be between 1 and 50 characters long.');
        }

        // 确保项目存在
        const projectManager = req.projectManager;
        try {
            const project = await projectManager.ensureProject(projectId);
            req.project = project;
            
            logger.debug('Project validation passed', {
                projectId,
                requestId: req.requestId
            });
            
            next();
        } catch (error) {
            if (error.message.includes('not found')) {
                throw new NotFoundError(`Project ${projectId} not found`);
            }
            throw error;
        }
        
    } catch (error) {
        next(error);
    }
}
