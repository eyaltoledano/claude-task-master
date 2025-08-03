/**
 * TaskCard Component - Subtask-First Design
 * 
 * Creates both main task cards and subtask cards with parent context
 * Supports the new TaskMaster Kanban design focusing on granular subtask tracking
 */
class TaskCard {
    /**
     * Create a task card element (main task or subtask)
     * @param {Object} task - Task data object
     * @param {Object} parentTask - Parent task object (for subtasks)
     * @returns {HTMLElement|null} - Task card element or null if invalid
     */
    static create(task, parentTask = null) {
        if (!task || !task.id) {
            console.error('Invalid task data provided to TaskCard.create');
            return null;
        }

        const isSubtask = !!parentTask;
        const card = document.createElement('div');
        card.className = isSubtask ? 'subtask-card' : 'main-task-card';
        card.setAttribute('data-task-id', task.id);
        card.setAttribute('draggable', 'true');
        card.setAttribute('role', 'listitem');
        card.setAttribute('tabindex', '0');
        
        // Set priority
        const priority = task.priority || 'medium';
        card.setAttribute('data-priority', priority);
        card.classList.add(`priority-${priority}`);
        
        // For subtasks, add parent task coloring
        if (isSubtask && parentTask) {
            const parentColorIndex = this.getParentColorIndex(parentTask.id);
            card.classList.add(`parent-task-${parentColorIndex}`);
            card.setAttribute('data-parent-id', parentTask.id);
        }
        
        // Create card badges
        if (isSubtask) {
            const parentBadge = this.createParentBadge(parentTask);
            if (parentBadge) card.appendChild(parentBadge);
        } else {
            const mainBadge = this.createMainTaskBadge(task);
            if (mainBadge) card.appendChild(mainBadge);
        }
        
        // Create card content
        const header = this.createTaskHeader(task, parentTask);
        const description = this.createTaskDescription(task);
        const parentProgress = isSubtask ? this.createParentProgress(parentTask) : null;
        const meta = this.createTaskMeta(task, parentTask);
        const footer = this.createTaskFooter(task);
        
        if (header) card.appendChild(header);
        if (description) card.appendChild(description);
        if (parentProgress) card.appendChild(parentProgress);
        if (meta) card.appendChild(meta);
        if (footer) card.appendChild(footer);
        
        // Set ARIA attributes
        const taskType = isSubtask ? 'Subtask' : 'Task';
        card.setAttribute('aria-label', `${taskType}: ${task.title}`);
        card.setAttribute('aria-grabbed', 'false');
        
        return card;
    }

    /**
     * Create main task badge (top-right corner)
     * @param {Object} task - Task data
     * @returns {HTMLElement} - Badge element
     */
    static createMainTaskBadge(task) {
        const badge = document.createElement('div');
        badge.className = 'main-task-badge';
        badge.textContent = `Task# ${this.formatTaskId(task.id)}`;
        badge.setAttribute('title', `Main Task ID: ${task.id}`);
        return badge;
    }

    /**
     * Create parent task badge (top-left corner for subtasks)
     * @param {Object} parentTask - Parent task data
     * @returns {HTMLElement} - Badge element
     */
    static createParentBadge(parentTask) {
        if (!parentTask) return null;
        
        const badge = document.createElement('div');
        badge.className = 'parent-task-badge';
        const colorIndex = this.getParentColorIndex(parentTask.id);
        badge.classList.add(`parent-${colorIndex}`);
        badge.textContent = `Task# ${this.formatTaskId(parentTask.id)}`;
        badge.setAttribute('title', `Parent: ${parentTask.title}`);
        
        // Make badge clickable to highlight related tasks
        badge.style.cursor = 'pointer';
        badge.addEventListener('click', (e) => {
            e.stopPropagation();
            this.highlightRelatedTasks(parentTask.id);
        });
        
        return badge;
    }

    /**
     * Create task header with title and ID badge (matches artifact exactly)
     * @param {Object} task - Task data
     * @param {Object} parentTask - Parent task object (for subtasks)
     * @returns {HTMLElement} - Header element
     */
    static createTaskHeader(task, parentTask = null) {
        const header = document.createElement('div');
        header.className = 'task-header';
        
        // Task title
        const title = document.createElement('div');
        title.className = (parentTask != null) ? 'subtask-title' : 'task-title';
        title.textContent = task.title || 'Untitled Task';
        
        // Task ID badge
        const taskId = document.createElement('div');
        taskId.className = 'task-id';
        taskId.textContent =  this.formatTaskId(task.id);
        
        header.appendChild(title);
        header.appendChild(taskId);
        
        return header;
    }

    /**
     * Create task description element
     * @param {Object} task - Task data
     * @returns {HTMLElement|null} - Description element or null
     */
    static createTaskDescription(task) {
        if (!task.description) return null;
        
        const description = document.createElement('div');
        description.className = 'task-description';
        
        const truncated = this.truncateDescription(task.description, 120);
        description.textContent = truncated.text;
        
        if (truncated.isTruncated) {
            description.classList.add('truncated');
            description.setAttribute('data-full-text', task.description);
            description.setAttribute('data-truncated-text', truncated.text);
            description.style.cursor = 'pointer';
            description.setAttribute('title', 'Click to expand/collapse');
            
            description.addEventListener('click', (e) => {
                e.stopPropagation();
                const isExpanded = description.classList.contains('expanded');
                if (isExpanded) {
                    description.textContent = truncated.text;
                    description.classList.remove('expanded');
                } else {
                    description.textContent = task.description;
                    description.classList.add('expanded');
                }
            });
        }
        
        return description;
    }

    /**
     * Create parent progress indicator for subtasks
     * @param {Object} parentTask - Parent task data
     * @returns {HTMLElement|null} - Progress element or null
     */
    static createParentProgress(parentTask) {
        if (!parentTask || !parentTask.subtasks) return null;
        
        const progress = document.createElement('div');
        progress.className = 'parent-progress';
        
        // Calculate progress
        const total = parentTask.subtasks.length;
        const completed = parentTask.subtasks.filter(st => st.status === 'done').length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        // Progress text
        const text = document.createElement('div');
        text.textContent = `Parent: ${parentTask.title} (${completed}/${total} subtasks)`;
        progress.appendChild(text);
        
        // Progress bar
        const bar = document.createElement('div');
        bar.className = 'parent-progress-bar';
        
        const fill = document.createElement('div');
        fill.className = 'parent-progress-fill';
        const colorIndex = this.getParentColorIndex(parentTask.id);
        fill.classList.add(`parent-${colorIndex}`);
        fill.style.width = `${percentage}%`;
        
        bar.appendChild(fill);
        progress.appendChild(bar);
        
        return progress;
    }

    /**
     * Create task meta information badges
     * @param {Object} task - Task data
     * @param {Object} parentTask - Parent task (for context)
     * @returns {HTMLElement} - Meta container
     */
    static createTaskMeta(task, parentTask) {
        const meta = document.createElement('div');
        meta.className = 'task-meta';
        
        // Status badge - show current status
        const status = task.status || 'pending';
        const statusTag = document.createElement('span');
        statusTag.className = `meta-tag status-tag status-${status}`;
        
        // Format status text
        const statusText = status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ');
        statusTag.textContent = statusText;
        meta.appendChild(statusTag);
        
        // Complexity badge
        if (task.complexity) {
            const complexity = document.createElement('span');
            complexity.className = 'meta-tag complexity';
            complexity.textContent = `Complexity: ${task.complexity}/10`;
            meta.appendChild(complexity);
        }
        
        // AI model badge
        if (task.aiModel) {
            const aiModel = document.createElement('span');
            aiModel.className = 'meta-tag ai-model';
            aiModel.textContent = task.aiModel;
            meta.appendChild(aiModel);
        }
        
        // Dependency indicator
        if (task.dependencies && task.dependencies.length > 0) {
            const deps = document.createElement('span');
            deps.className = 'meta-tag dependency-indicator';
            
            // Format dependencies for display - keep them as is, no automatic sibling conversion
            const formattedDeps = task.dependencies.map(dep => String(dep)).join(' ');
            
            deps.textContent = `Depends on: ${formattedDeps}`;
            deps.setAttribute('title', `Dependencies: ${task.dependencies.join(', ')}`);
            meta.appendChild(deps);
        }
        
        // Parent context for subtasks
        if (parentTask) {
            const context = document.createElement('span');
            context.className = 'meta-tag parent-context';
            context.textContent = `Part of T-${this.formatTaskId(parentTask.id)}`;
            meta.appendChild(context);
        }
        
        return meta.children.length > 0 ? meta : null;
    }

    /**
     * Create task footer with dependencies and time estimate
     * @param {Object} task - Task data
     * @returns {HTMLElement} - Footer element
     */
    static createTaskFooter(task) {
        const footer = document.createElement('div');
        footer.className = 'task-footer';
        
        // Dependencies
        const dependencies = document.createElement('div');
        dependencies.className = 'dependencies';
        
        if (task.dependencies && task.dependencies.length > 0) {
            task.dependencies.forEach(depId => {
                const depLink = document.createElement('div');
                depLink.className = 'dependency-link';
                
                // Check if dependency is completed (simplified - would need actual status)
                const isReady = task.dependencyStatus && task.dependencyStatus[depId] === 'done';
                if (isReady) {
                    depLink.classList.add('ready');
                    depLink.textContent = '✓';
                    depLink.setAttribute('title', `Dependency ${depId} completed`);
                } else {
                    depLink.classList.add('blocked');
                    depLink.textContent = '!';
                    depLink.setAttribute('title', `Depends on ${depId}`);
                }
                
                dependencies.appendChild(depLink);
            });
        }
        
        // Time estimate
        const timeEstimate = document.createElement('div');
        timeEstimate.className = 'time-estimate';
        
        // Calculate estimate based on complexity or use provided estimate
        const hours = task.estimatedHours || (task.complexity ? task.complexity * 0.5 : 2);
        timeEstimate.textContent = `⏱️ ~${hours}h`;
        
        footer.appendChild(dependencies);
        footer.appendChild(timeEstimate);
        
        return footer;
    }

    /**
     * Get parent color index for consistent coloring
     * @param {string|number} parentId - Parent task ID
     * @returns {number} - Color index (1-4)
     */
    static getParentColorIndex(parentId) {
        // Convert to string and extract numeric part
        const idStr = String(parentId);
        const numericPart = parseInt(idStr.replace(/\D/g, '')) || 0;
        
        // Return 1-4 for parent color classes
        return (numericPart % 4) + 1;
    }

    /**
     * Highlight related tasks with same parent
     * @param {string|number} parentId - Parent task ID
     */
    static highlightRelatedTasks(parentId) {
        // Remove previous highlights
        document.querySelectorAll('.task-highlight').forEach(card => {
            card.classList.remove('task-highlight');
        });
        
        // Highlight all tasks with same parent
        document.querySelectorAll(`[data-parent-id="${parentId}"]`).forEach(card => {
            card.classList.add('task-highlight');
            setTimeout(() => {
                card.classList.remove('task-highlight');
            }, 2000);
        });
    }

    /**
     * Format task ID for display
     */
    static formatTaskId(id) {
        if (!id) return '';
        
        // Convert to string to handle numeric IDs
        const idStr = String(id);
        
        // If ID contains a period (subtask ID like "1.2"), show only the part after the period
        if (idStr.includes('.')) {
            return idStr.split('.').pop();
        }
        
        // If ID is a UUID or long string, show last part
        if (idStr.includes('-')) {
            return idStr.split('-').pop().slice(0, 6);
        }
        
        // If ID starts with 'task-', remove prefix
        if (idStr.startsWith('task-')) {
            return idStr.replace('task-', '');
        }
        
        // For regular numeric IDs, return as-is (no padding)
        return idStr;
    }

    /**
     * Truncate description with word boundaries
     * @param {string} description - Description text
     * @param {number} maxLength - Maximum length
     * @returns {Object} - Object with text and isTruncated flag
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
     * Create a task card from task data (determines type automatically)
     * @param {Object} task - Task data
     * @param {Array} allTasks - All tasks for finding parent
     * @returns {HTMLElement|Array} - Card element(s)
     */
    static createFromTask(task, allTasks = []) {
        // Check if this is a main task with subtasks
        if (task.subtasks && task.subtasks.length > 0) {
            // Return array of subtask cards
            return task.subtasks.map(subtask => {
                return this.create(subtask, task);
            });
        }
        
        // Check if this is a subtask by looking for parent
        const parentTask = allTasks.find(t => 
            t.subtasks && t.subtasks.some(st => st.id === task.id)
        );
        
        if (parentTask) {
            // This is a subtask, create with parent context
            return this.create(task, parentTask);
        }
        
        // This is a main task without subtasks
        return this.create(task, null);
    }

    /**
     * Update an existing task card
     * @param {HTMLElement} cardElement - Existing card element
     * @param {Object} task - Updated task data
     * @param {Object} parentTask - Parent task (for subtasks)
     */
    static update(cardElement, task, parentTask = null) {
        if (!cardElement || !task) {
            console.error('Invalid parameters provided to TaskCard.update');
            return;
        }

        // Create new card with updated data
        const newCard = this.create(task, parentTask);
        if (!newCard) return;

        // Preserve state classes
        const preservedClasses = ['dragging', 'keyboard-selected', 'task-highlight'];
        const currentClasses = cardElement.className.split(' ');
        const classesToKeep = currentClasses.filter(cls => preservedClasses.includes(cls));

        // Replace content but keep state
        cardElement.innerHTML = newCard.innerHTML;
        cardElement.className = newCard.className;
        classesToKeep.forEach(cls => cardElement.classList.add(cls));

        // Update attributes
        Array.from(newCard.attributes).forEach(attr => {
            cardElement.setAttribute(attr.name, attr.value);
        });
    }

    /**
     * Remove a task card with animation
     * @param {HTMLElement} cardElement - Card to remove
     * @returns {Promise} - Resolves when removal is complete
     */
    static async remove(cardElement) {
        if (!cardElement) return;

        // Add removal animation
        cardElement.classList.add('slide-out');
        
        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Remove from DOM
        cardElement.remove();
    }

    /**
     * Clean up all event listeners and references
     * @param {HTMLElement} cardElement - Card element to clean
     */
    static cleanup(cardElement) {
        if (!cardElement) return;

        // Remove all event listeners by cloning
        const newCard = cardElement.cloneNode(true);
        cardElement.parentNode?.replaceChild(newCard, cardElement);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskCard;
}