/**
 * TaskCard - Component for rendering individual task cards
 * Handles task display, interactions, and accessibility
 */
class TaskCard {
    /**
     * Create a task card element
     */
    static create(task) {
        if (!task || !task.id) {
            console.error('Invalid task data provided to TaskCard.create');
            return null;
        }

        // Create main card element
        const card = document.createElement('div');
        card.className = 'task-card';
        card.setAttribute('data-task-id', task.id);
        card.setAttribute('data-priority', task.priority || 'medium');
        card.setAttribute('draggable', 'true');
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'option');
        card.setAttribute('aria-grabbed', 'false');
        card.setAttribute('aria-label', `Task: ${task.title}`);

        // Add priority indicator for screen readers
        const priorityText = this.getPriorityText(task.priority);
        if (priorityText) {
            card.setAttribute('aria-describedby', `task-${task.id}-priority`);
        }

        // Build card content
        card.appendChild(this.createTaskHeader(task));
        card.appendChild(this.createTaskBody(task));
        card.appendChild(this.createTaskFooter(task));

        // Add priority description for screen readers
        if (priorityText) {
            const priorityDescription = document.createElement('span');
            priorityDescription.id = `task-${task.id}-priority`;
            priorityDescription.className = 'sr-only';
            priorityDescription.textContent = `Priority: ${priorityText}`;
            card.appendChild(priorityDescription);
        }

        // Add animation class for new tasks
        if (task.isNew) {
            card.classList.add('slide-in');
            // Remove animation class after animation completes
            setTimeout(() => {
                card.classList.remove('slide-in');
            }, 200);
        }

        return card;
    }

    /**
     * Create task header with title and ID
     */
    static createTaskHeader(task) {
        const header = document.createElement('div');
        header.className = 'task-header';

        // Task title
        const title = document.createElement('h3');
        title.className = 'task-title';
        title.textContent = task.title || 'Untitled Task';

        // Task ID
        const taskId = document.createElement('span');
        taskId.className = 'task-id';
        taskId.textContent = `#${this.formatTaskId(task.id)}`;
        taskId.setAttribute('aria-hidden', 'true'); // Hide from screen readers as it's visual only

        header.appendChild(title);
        header.appendChild(taskId);

        return header;
    }

    /**
     * Create task body with description
     */
    static createTaskBody(task) {
        const body = document.createElement('div');
        body.className = 'task-body';

        if (task.description) {
            const description = document.createElement('p');
            description.className = 'task-description';
            description.textContent = task.description;
            body.appendChild(description);
        }

        return body;
    }

    /**
     * Create task footer with metadata
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
        
        // If ID is a UUID or long string, show last part
        if (id.includes('-')) {
            return id.split('-').pop().slice(0, 6);
        }
        
        // If ID starts with 'task-', remove prefix
        if (id.startsWith('task-')) {
            return id.replace('task-', '');
        }
        
        return id;
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
     * Get priority text for accessibility
     */
    static getPriorityText(priority) {
        const priorityMap = {
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
     * Validate task data structure
     */
    static validateTask(task) {
        if (!task || typeof task !== 'object') {
            return { valid: false, errors: ['Task must be an object'] };
        }

        const errors = [];

        if (!task.id) {
            errors.push('Task must have an ID');
        }

        if (!task.title || typeof task.title !== 'string' || !task.title.trim()) {
            errors.push('Task must have a non-empty title');
        }

        const validStatuses = ['backlog', 'ready', 'in-progress', 'review', 'done'];
        if (task.status && !validStatuses.includes(task.status)) {
            errors.push(`Invalid status: ${task.status}. Must be one of: ${validStatuses.join(', ')}`);
        }

        const validPriorities = ['low', 'medium', 'high'];
        if (task.priority && !validPriorities.includes(task.priority)) {
            errors.push(`Invalid priority: ${task.priority}. Must be one of: ${validPriorities.join(', ')}`);
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

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskCard;
}