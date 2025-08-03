/**
 * TaskCard Component System - Comprehensive Implementation
 * 
 * Features:
 * - Component initialization and structure
 * - Priority color coding system  
 * - Badge systems (parent task, complexity, AI model)
 * - Description truncation and expansion
 * - Progress bar calculations
 * - Card type variants (main vs subtask)
 * - Dependency count display
 * - Accessibility features
 * - Performance optimization
 * - Memory cleanup
 * - Glassmorphism effects
 */
class TaskCard {
    /**
     * Create a task card element with full feature support
     * @param {Object} task - Task data object
     * @returns {HTMLElement|null} - Task card element or null if invalid
     */
    static create(task) {
        if (!task || !task.id) {
            console.error('Invalid task data provided to TaskCard.create');
            return null;
        }

        // Validate task structure
        const validation = this.validateTask(task);
        if (!validation.valid) {
            console.warn('Task validation failed:', validation.errors);
            // Continue with creation but log issues
        }

        // Create main card element
        const card = document.createElement('div');
        card.className = 'task-card glassmorphism';
        
        // Set core attributes
        card.setAttribute('data-task-id', task.id);
        card.setAttribute('data-priority', task.priority || 'medium');
        card.setAttribute('data-card-type', task.subtasks?.length > 0 ? 'parent' : 'main');
        card.setAttribute('draggable', 'true');
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'option');
        card.setAttribute('aria-grabbed', 'false');
        card.setAttribute('aria-label', `Task: ${task.title}`);

        // Add priority class for styling
        if (task.priority) {
            card.classList.add(`priority-${task.priority}`);
        }

        // Build card content structure
        card.appendChild(this.createTaskHeader(task));
        card.appendChild(this.createTaskBody(task));
        card.appendChild(this.createTaskFooter(task));

        // Add progress bar for parent tasks
        if (task.subtasks && task.subtasks.length > 0) {
            const progressBar = this.createProgressBar(task);
            if (progressBar) {
                card.appendChild(progressBar);
            }
        }

        // Add priority description for screen readers
        const priorityText = this.getPriorityText(task.priority);
        if (priorityText) {
            const priorityDescription = document.createElement('span');
            priorityDescription.id = `task-${task.id}-priority`;
            priorityDescription.className = 'sr-only';
            priorityDescription.textContent = `Priority: ${priorityText}`;
            card.appendChild(priorityDescription);
            card.setAttribute('aria-describedby', `task-${task.id}-priority`);
        }

        // Add animation class for new tasks
        if (task.isNew) {
            card.classList.add('slide-in');
            setTimeout(() => {
                card.classList.remove('slide-in');
            }, 200);
        }

        return card;
    }

    /**
     * Create task header with title, ID, and badges
     * @param {Object} task - Task data object
     * @returns {HTMLElement} - Header element
     */
    static createTaskHeader(task) {
        const header = document.createElement('div');
        header.className = 'task-header';

        // Title and ID container
        const titleContainer = document.createElement('div');
        titleContainer.className = 'task-title-container';

        // Task title
        const title = document.createElement('h3');
        title.className = 'task-title';
        title.textContent = task.title || 'Untitled Task';

        // Task ID
        const taskId = document.createElement('span');
        taskId.className = 'task-id';
        taskId.textContent = `#${this.formatTaskId(task.id)}`;
        taskId.setAttribute('aria-hidden', 'true');

        titleContainer.appendChild(title);
        titleContainer.appendChild(taskId);
        header.appendChild(titleContainer);

        // Badges container
        const badgesContainer = document.createElement('div');
        badgesContainer.className = 'task-badges';

        // Parent task badge
        const parentBadge = this.createParentTaskBadge(task);
        if (parentBadge) {
            badgesContainer.appendChild(parentBadge);
        }

        // Complexity badge
        const complexityBadge = this.createComplexityBadge(task.complexityScore);
        if (complexityBadge) {
            badgesContainer.appendChild(complexityBadge);
        }

        // AI model tag
        const aiModelTag = this.createAIModelTag(task.aiModel);
        if (aiModelTag) {
            badgesContainer.appendChild(aiModelTag);
        }

        // Dependency indicator
        const dependencyIndicator = this.createDependencyIndicator(
            task.dependencies ? task.dependencies.length : 0
        );
        if (dependencyIndicator) {
            badgesContainer.appendChild(dependencyIndicator);
        }

        if (badgesContainer.children.length > 0) {
            header.appendChild(badgesContainer);
        }

        return header;
    }

    /**
     * Create task body with description (with truncation support)
     * @param {Object} task - Task data object
     * @returns {HTMLElement} - Body element
     */
    static createTaskBody(task) {
        const body = document.createElement('div');
        body.className = 'task-body';

        if (task.description) {
            const description = document.createElement('p');
            description.className = 'task-description';
            
            // Handle description truncation
            const truncated = this.truncateDescription(task.description);
            description.textContent = truncated.text;
            
            // Add expand functionality for truncated descriptions
            if (truncated.isTruncated) {
                description.classList.add('truncated');
                description.setAttribute('data-full-text', truncated.originalText);
                description.setAttribute('data-truncated-text', truncated.text);
                description.style.cursor = 'pointer';
                description.setAttribute('title', 'Click to expand/collapse');
                
                // Add click handler for expansion
                description.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isExpanded = description.classList.contains('expanded');
                    if (isExpanded) {
                        description.textContent = description.getAttribute('data-truncated-text');
                        description.classList.remove('expanded');
                    } else {
                        description.textContent = description.getAttribute('data-full-text');
                        description.classList.add('expanded');
                    }
                });
            }
            
            body.appendChild(description);
        }

        return body;
    }

    /**
     * Create task footer with metadata and tags
     * @param {Object} task - Task data object
     * @returns {HTMLElement} - Footer element
     */
    static createTaskFooter(task) {
        const footer = document.createElement('div');
        footer.className = 'task-footer';

        // Tags section
        if (task.tags && task.tags.length > 0) {
            const tagsContainer = this.createTaskTags(task.tags);
            footer.appendChild(tagsContainer);
        }

        // Metadata section
        const metaContainer = this.createTaskMeta(task);
        if (metaContainer.children.length > 0) {
            footer.appendChild(metaContainer);
        }

        return footer;
    }

    /**
     * Create task tags
     */
    static createTaskTags(tags) {
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'task-tags';
        tagsContainer.setAttribute('aria-label', 'Task tags');

        tags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'task-tag';
            tagElement.textContent = tag;
            tagElement.setAttribute('aria-label', `Tag: ${tag}`);
            tagsContainer.appendChild(tagElement);
        });

        return tagsContainer;
    }

    /**
     * Create task metadata (assignee, due date, etc.)
     */
    static createTaskMeta(task) {
        const metaContainer = document.createElement('div');
        metaContainer.className = 'task-meta';

        // Assignee
        if (task.assignee) {
            const assignee = this.createAssignee(task.assignee);
            metaContainer.appendChild(assignee);
        }

        // Due date
        if (task.dueDate) {
            const dueDate = this.createDueDate(task.dueDate);
            metaContainer.appendChild(dueDate);
        }

        // Created date (relative)
        if (task.createdAt) {
            const createdDate = this.createCreatedDate(task.createdAt);
            metaContainer.appendChild(createdDate);
        }

        return metaContainer;
    }

    /**
     * Create assignee element
     */
    static createAssignee(assignee) {
        const assigneeElement = document.createElement('div');
        assigneeElement.className = 'task-assignee';
        
        if (typeof assignee === 'string') {
            // Simple name assignee
            assigneeElement.textContent = this.getInitials(assignee);
            assigneeElement.setAttribute('aria-label', `Assigned to ${assignee}`);
            assigneeElement.setAttribute('title', `Assigned to ${assignee}`);
        } else if (assignee.name) {
            // Object with name and potentially avatar
            assigneeElement.textContent = this.getInitials(assignee.name);
            assigneeElement.setAttribute('aria-label', `Assigned to ${assignee.name}`);
            assigneeElement.setAttribute('title', `Assigned to ${assignee.name}`);
            
            if (assignee.avatar) {
                // Replace text with image if avatar is available
                const img = document.createElement('img');
                img.src = assignee.avatar;
                img.alt = assignee.name;
                img.className = 'assignee-avatar';
                assigneeElement.innerHTML = '';
                assigneeElement.appendChild(img);
            }
        }

        return assigneeElement;
    }

    /**
     * Create due date element
     */
    static createDueDate(dueDate) {
        const dueDateElement = document.createElement('span');
        dueDateElement.className = 'task-due-date';
        
        const date = new Date(dueDate);
        const now = new Date();
        const diffTime = date.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Format date
        const formattedDate = this.formatDate(date);
        dueDateElement.textContent = formattedDate;
        dueDateElement.setAttribute('title', `Due: ${date.toLocaleDateString()}`);

        // Add status classes and screen reader text
        if (diffDays < 0) {
            dueDateElement.classList.add('overdue');
            dueDateElement.setAttribute('aria-label', `Overdue: ${formattedDate}`);
        } else if (diffDays <= 2) {
            dueDateElement.classList.add('due-soon');
            dueDateElement.setAttribute('aria-label', `Due soon: ${formattedDate}`);
        } else {
            dueDateElement.setAttribute('aria-label', `Due: ${formattedDate}`);
        }

        return dueDateElement;
    }

    /**
     * Create created date element
     */
    static createCreatedDate(createdAt) {
        const createdElement = document.createElement('span');
        createdElement.className = 'task-created';
        
        const date = new Date(createdAt);
        const relativeTime = this.getRelativeTime(date);
        
        createdElement.textContent = relativeTime;
        createdElement.setAttribute('title', `Created: ${date.toLocaleString()}`);
        createdElement.setAttribute('aria-label', `Created ${relativeTime}`);

        return createdElement;
    }

    /**
     * Update an existing task card
     */
    static update(cardElement, task) {
        if (!cardElement || !task) {
            console.error('Invalid parameters provided to TaskCard.update');
            return;
        }

        // Update attributes
        cardElement.setAttribute('data-task-id', task.id);
        cardElement.setAttribute('data-priority', task.priority || 'medium');
        cardElement.setAttribute('aria-label', `Task: ${task.title}`);

        // Update content
        const newCard = this.create(task);
        if (newCard) {
            cardElement.innerHTML = newCard.innerHTML;
            
            // Copy classes but preserve state classes
            const preservedClasses = ['dragging', 'keyboard-selected', 'slide-in', 'slide-out'];
            const newClasses = newCard.className.split(' ');
            const currentClasses = cardElement.className.split(' ');
            
            const classesToKeep = currentClasses.filter(cls => preservedClasses.includes(cls));
            cardElement.className = [...newClasses, ...classesToKeep].join(' ');
        }
    }

    /**
     * Animate card removal
     */
    static async remove(cardElement) {
        if (!cardElement) return;

        return new Promise((resolve) => {
            cardElement.classList.add('slide-out');
            
            cardElement.addEventListener('animationend', () => {
                if (cardElement.parentNode) {
                    cardElement.parentNode.removeChild(cardElement);
                }
                resolve();
            }, { once: true });

            // Fallback if animation doesn't fire
            setTimeout(() => {
                if (cardElement.parentNode) {
                    cardElement.parentNode.removeChild(cardElement);
                }
                resolve();
            }, 300);
        });
    }

    /**
     * Get initials from a name
     */
    static getInitials(name) {
        if (!name) return '?';
        
        return name
            .split(' ')
            .map(word => word.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('');
    }

    /**
     * Format task ID for display
     */
    static formatTaskId(id) {
        if (!id) return '';
        
        // Convert to string to handle numeric IDs
        const idStr = String(id);
        
        // If ID is a UUID or long string, show last part
        if (idStr.includes('-')) {
            return idStr.split('-').pop().slice(0, 6);
        }
        
        // If ID starts with 'task-', remove prefix
        if (idStr.startsWith('task-')) {
            return idStr.replace('task-', '');
        }
        
        return idStr;
    }

    /**
     * Format date for display
     */
    static formatDate(date) {
        const now = new Date();
        const diffTime = date.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Tomorrow';
        } else if (diffDays === -1) {
            return 'Yesterday';
        } else if (diffDays > 1 && diffDays <= 7) {
            return `${diffDays} days`;
        } else if (diffDays < -1 && diffDays >= -7) {
            return `${Math.abs(diffDays)} days ago`;
        } else {
            return date.toLocaleDateString(undefined, { 
                month: 'short', 
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
        }
    }

    /**
     * Get relative time string
     */
    static getRelativeTime(date) {
        const now = new Date();
        const diffTime = now.getTime() - date.getTime();
        const diffMinutes = Math.floor(diffTime / (1000 * 60));
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMinutes < 1) {
            return 'Just now';
        } else if (diffMinutes < 60) {
            return `${diffMinutes}m ago`;
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else if (diffDays < 7) {
            return `${diffDays}d ago`;
        } else {
            return date.toLocaleDateString(undefined, { 
                month: 'short', 
                day: 'numeric'
            });
        }
    }

    /**
     * Get priority color for styling
     * @param {string} priority - Priority level
     * @returns {string} - Color hex code
     */
    static getPriorityColor(priority) {
        const colorMap = {
            'critical': '#dc3545', // Red
            'high': '#fd7e14',     // Orange  
            'medium': '#0d6efd',   // Blue
            'low': '#198754'       // Green
        };
        return colorMap[priority] || colorMap.medium;
    }

    /**
     * Create parent task badge
     * @param {Object} task - Task data object
     * @returns {HTMLElement|null} - Badge element or null
     */
    static createParentTaskBadge(task) {
        if (!task.subtasks || task.subtasks.length === 0) return null;
        
        const badge = document.createElement('span');
        badge.className = 'parent-task-badge';
        badge.textContent = `Parent (${task.subtasks.length})`;
        badge.style.backgroundColor = this.getParentBadgeColor(task.id);
        badge.style.color = '#fff';
        badge.setAttribute('aria-label', `Parent task with ${task.subtasks.length} subtasks`);
        badge.setAttribute('title', `This task has ${task.subtasks.length} subtasks`);
        
        return badge;
    }

    /**
     * Get unique color for parent task badge
     * @param {string|number} taskId - Task ID
     * @returns {string} - Color hex code
     */
    static getParentBadgeColor(taskId) {
        const colors = ['#6f42c1', '#dc3545', '#fd7e14', '#198754', '#0d6efd', '#6610f2'];
        // Convert to string to handle numeric IDs
        const idStr = String(taskId);
        const hash = idStr.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);
        return colors[Math.abs(hash) % colors.length];
    }

    /**
     * Create complexity score badge
     * @param {number} complexityScore - Complexity score (1-10)
     * @returns {HTMLElement|null} - Badge element or null
     */
    static createComplexityBadge(complexityScore) {
        if (!complexityScore || complexityScore < 1 || complexityScore > 10) return null;

        let badgeClass = 'complexity-low';
        if (complexityScore >= 7) badgeClass = 'complexity-high';
        else if (complexityScore >= 4) badgeClass = 'complexity-medium';

        const badge = document.createElement('span');
        badge.className = `complexity-badge ${badgeClass}`;
        badge.textContent = complexityScore.toString();
        badge.setAttribute('aria-label', `Complexity: ${complexityScore} out of 10`);
        badge.setAttribute('title', `Complexity Score: ${complexityScore}/10`);
        
        return badge;
    }

    /**
     * Create AI model assignment tag
     * @param {string} aiModel - AI model name
     * @returns {HTMLElement|null} - Tag element or null
     */
    static createAIModelTag(aiModel) {
        if (!aiModel) return null;

        const tag = document.createElement('span');
        tag.className = 'ai-model-tag';
        tag.textContent = aiModel;
        tag.setAttribute('aria-label', `AI Model: ${aiModel}`);
        tag.setAttribute('data-ai-model', aiModel);
        tag.setAttribute('title', `Assigned to AI model: ${aiModel}`);
        
        return tag;
    }

    /**
     * Create dependency count indicator
     * @param {number} dependencyCount - Number of dependencies
     * @returns {HTMLElement|null} - Indicator element or null
     */
    static createDependencyIndicator(dependencyCount) {
        if (!dependencyCount || dependencyCount === 0) return null;

        const indicator = document.createElement('span');
        indicator.className = 'dependency-indicator';
        indicator.textContent = `${dependencyCount} deps`;
        indicator.setAttribute('aria-label', `${dependencyCount} dependencies`);
        indicator.setAttribute('title', `This task has ${dependencyCount} dependencies`);
        
        return indicator;
    }

    /**
     * Create progress bar for parent tasks
     * @param {Object} task - Task data object
     * @returns {HTMLElement|null} - Progress bar container or null
     */
    static createProgressBar(task) {
        if (!task.subtasks || task.subtasks.length === 0) return null;

        const completedSubtasks = task.subtasks.filter(st => st.status === 'done').length;
        const progress = (completedSubtasks / task.subtasks.length) * 100;

        const container = document.createElement('div');
        container.className = 'progress-bar-container';
        
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        progressBar.style.width = `${progress}%`;
        progressBar.setAttribute('aria-valuenow', progress.toString());
        progressBar.setAttribute('aria-valuemin', '0');
        progressBar.setAttribute('aria-valuemax', '100');
        progressBar.setAttribute('role', 'progressbar');
        progressBar.setAttribute('aria-label', `Progress: ${completedSubtasks} of ${task.subtasks.length} subtasks completed`);
        
        const progressText = document.createElement('span');
        progressText.className = 'progress-text';
        progressText.textContent = `${completedSubtasks}/${task.subtasks.length}`;
        progressText.setAttribute('aria-hidden', 'true');
        
        container.appendChild(progressBar);
        container.appendChild(progressText);
        
        return container;
    }

    /**
     * Truncate description text with word boundary awareness
     * @param {string} description - Description text
     * @param {number} maxLength - Maximum length (default: 120)
     * @returns {Object} - Object with text, isTruncated, and originalText
     */
    static truncateDescription(description, maxLength = 120) {
        if (description === null || description === undefined) {
            return { text: undefined, isTruncated: false };
        }
        
        if (description === '') {
            return { text: '', isTruncated: false };
        }
        
        if (description.length <= maxLength) {
            return { text: description, isTruncated: false };
        }

        // Truncate at word boundary
        let truncated = description.slice(0, maxLength).trim();
        const lastSpace = truncated.lastIndexOf(' ');
        
        // Ensure we truncate at word boundary if there's a space
        if (lastSpace > 0 && lastSpace > maxLength - 20) {
            truncated = truncated.slice(0, lastSpace);
        }

        return { 
            text: truncated + ' ...', // Always add space before ellipsis
            isTruncated: true,
            originalText: description
        };
    }

    /**
     * Get priority text for accessibility
     * @param {string} priority - Priority level
     * @returns {string|null} - Priority text or null
     */
    static getPriorityText(priority) {
        const priorityMap = {
            'critical': 'Critical priority',
            'high': 'High priority',
            'medium': 'Medium priority',
            'low': 'Low priority'
        };
        
        return priorityMap[priority] || null;
    }

    /**
     * Get task card element by ID
     */
    static getById(taskId) {
        return document.querySelector(`[data-task-id="${taskId}"]`);
    }

    /**
     * Get all task card elements
     */
    static getAll() {
        return document.querySelectorAll('.task-card');
    }

    /**
     * Get task cards in a specific column
     */
    static getByColumn(columnId) {
        const column = document.querySelector(`[data-column="${columnId}"]`);
        return column ? column.querySelectorAll('.task-card') : [];
    }

    /**
     * Check if task card is currently being dragged
     */
    static isDragging(cardElement) {
        return cardElement && cardElement.classList.contains('dragging');
    }

    /**
     * Check if task card is selected for keyboard navigation
     */
    static isSelected(cardElement) {
        return cardElement && cardElement.classList.contains('keyboard-selected');
    }

    /**
     * Set focus on task card
     */
    static focus(cardElement) {
        if (cardElement && typeof cardElement.focus === 'function') {
            cardElement.focus();
        }
    }

    /**
     * Create a placeholder card for loading states
     */
    static createPlaceholder() {
        const card = document.createElement('div');
        card.className = 'task-card task-card-placeholder';
        card.setAttribute('aria-hidden', 'true');
        
        const header = document.createElement('div');
        header.className = 'task-header';
        
        const title = document.createElement('div');
        title.className = 'task-title placeholder-text';
        title.style.width = '70%';
        title.style.height = '1.2em';
        title.style.backgroundColor = '#e9ecef';
        title.style.borderRadius = '3px';
        
        const id = document.createElement('div');
        id.className = 'task-id placeholder-text';
        id.style.width = '30px';
        id.style.height = '1em';
        id.style.backgroundColor = '#e9ecef';
        id.style.borderRadius = '3px';
        
        header.appendChild(title);
        header.appendChild(id);
        
        const body = document.createElement('div');
        body.className = 'task-body';
        
        const description = document.createElement('div');
        description.className = 'placeholder-text';
        description.style.width = '90%';
        description.style.height = '2.4em';
        description.style.backgroundColor = '#e9ecef';
        description.style.borderRadius = '3px';
        
        body.appendChild(description);
        
        card.appendChild(header);
        card.appendChild(body);
        
        return card;
    }

    /**
     * Cleanup event listeners and references for memory management
     * @param {HTMLElement} cardElement - Card element to cleanup
     */
    static cleanup(cardElement) {
        if (cardElement) {
            // Clear custom properties used for memory tracking
            cardElement._listeners = null;
            cardElement._observers = null;
            
            // Remove event listeners if they exist
            const description = cardElement.querySelector('.task-description.truncated');
            if (description && description._clickHandler) {
                description.removeEventListener('click', description._clickHandler);
                description._clickHandler = null;
            }
        }
    }

    /**
     * Validate task data structure comprehensively
     * @param {Object} task - Task data object
     * @returns {Object} - Validation result with valid flag and errors array
     */
    static validateTask(task) {
        const errors = [];
        
        if (!task || typeof task !== 'object') {
            errors.push('Task must be an object');
            return { valid: false, errors };
        }

        if (!task.id) errors.push('Task must have an ID');
        if (!task.title || typeof task.title !== 'string' || !task.title.trim()) {
            errors.push('Task must have a non-empty title');
        }

        const validStatuses = ['backlog', 'ready', 'in-progress', 'review', 'done'];
        if (task.status && !validStatuses.includes(task.status)) {
            errors.push(`Invalid status: ${task.status}`);
        }

        const validPriorities = ['low', 'medium', 'high', 'critical'];
        if (task.priority && !validPriorities.includes(task.priority)) {
            errors.push(`Invalid priority: ${task.priority}`);
        }

        if (task.complexityScore && (task.complexityScore < 1 || task.complexityScore > 10)) {
            errors.push('Complexity score must be between 1 and 10');
        }

        if (task.tags && !Array.isArray(task.tags)) {
            errors.push('Tags must be an array');
        }

        if (task.dueDate) {
            const date = new Date(task.dueDate);
            if (isNaN(date.getTime())) {
                errors.push('Invalid due date format');
            }
        }

        return { valid: errors.length === 0, errors };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskCard;
}