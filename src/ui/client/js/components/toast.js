/**
 * Toast Notification System
 * Provides flexible toast notifications with queue management and accessibility
 * 
 * @module ToastManager
 */

class ToastManager {
    /**
     * Create a new ToastManager instance
     * @param {Object} options - Configuration options
     * @param {string} options.position - Position of toast container (default: 'top-right')
     * @param {number} options.maxToasts - Maximum number of toasts to display (default: 5)
     * @param {number} options.defaultDuration - Default duration in ms (default: 5000)
     * @param {number} options.animationDuration - Animation duration in ms (default: 300)
     */
    constructor(options = {}) {
        this.options = {
            position: 'top-right',
            maxToasts: 5,
            defaultDuration: 5000,
            animationDuration: 300,
            ...options
        };
        
        this.toasts = [];
        this.container = null;
        this.init();
    }
    
    /**
     * Initialize the toast container
     * @private
     */
    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = `toast-container toast-${this.options.position}`;
            this.container.setAttribute('role', 'region');
            this.container.setAttribute('aria-live', 'polite');
            this.container.setAttribute('aria-label', 'Notifications');
            document.body.appendChild(this.container);
        }
    }
    
    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - Type of notification ('success', 'error', 'warning', 'info')
     * @param {Object} options - Additional options
     * @param {number} options.duration - Duration in ms (0 for persistent)
     * @param {Array} options.actions - Action buttons configuration
     * @param {boolean} options.showProgress - Show progress bar (default: true)
     * @returns {number} Toast ID for reference
     */
    show(message, type = 'info', options = {}) {
        const toast = {
            id: Date.now() + Math.random(),
            message,
            type,
            duration: options.duration !== undefined ? options.duration : this.options.defaultDuration,
            actions: options.actions || [],
            showProgress: options.showProgress !== false,
            ...options
        };
        
        // Queue management - remove oldest if at limit
        if (this.toasts.length >= this.options.maxToasts) {
            this.dismiss(this.toasts[0].id);
        }
        
        this.toasts.push(toast);
        this.render(toast);
        
        // Set up auto-dismiss timer
        if (toast.duration > 0) {
            toast.timeoutId = setTimeout(() => {
                this.dismiss(toast.id);
            }, toast.duration);
        }
        
        return toast.id;
    }
    
    /**
     * Render a toast element
     * @private
     * @param {Object} toast - Toast configuration
     */
    render(toast) {
        const element = document.createElement('div');
        element.className = `toast toast-${toast.type}`;
        element.setAttribute('role', 'alert');
        element.setAttribute('data-toast-id', toast.id);
        
        // Create toast content wrapper
        const content = document.createElement('div');
        content.className = 'toast-content';
        
        // Icon based on type
        const icon = document.createElement('span');
        icon.className = 'toast-icon';
        icon.innerHTML = this.getIconForType(toast.type);
        content.appendChild(icon);
        
        // Message
        const message = document.createElement('span');
        message.className = 'toast-message';
        message.textContent = toast.message;
        content.appendChild(message);
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.setAttribute('aria-label', 'Close notification');
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => this.dismiss(toast.id);
        content.appendChild(closeBtn);
        
        element.appendChild(content);
        
        // Actions
        if (toast.actions.length > 0) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'toast-actions';
            
            toast.actions.forEach(action => {
                const btn = document.createElement('button');
                btn.className = 'toast-action';
                btn.textContent = action.label;
                btn.onclick = () => {
                    action.handler();
                    if (action.dismissOnClick !== false) {
                        this.dismiss(toast.id);
                    }
                };
                actionsDiv.appendChild(btn);
            });
            
            element.appendChild(actionsDiv);
        }
        
        // Progress bar
        if (toast.duration > 0 && toast.showProgress) {
            const progress = document.createElement('div');
            progress.className = 'toast-progress';
            const bar = document.createElement('div');
            bar.className = 'toast-progress-bar';
            bar.style.animationDuration = `${toast.duration}ms`;
            progress.appendChild(bar);
            element.appendChild(progress);
        }
        
        // Add to container
        this.container.appendChild(element);
        
        // Trigger show animation
        requestAnimationFrame(() => {
            element.classList.add('toast-show');
        });
        
        toast.element = element;
    }
    
    /**
     * Get icon HTML for notification type
     * @private
     * @param {string} type - Notification type
     * @returns {string} Icon HTML
     */
    getIconForType(type) {
        const icons = {
            success: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
            error: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
            warning: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
            info: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>'
        };
        
        return icons[type] || icons.info;
    }
    
    /**
     * Dismiss a toast by ID
     * @param {number} id - Toast ID to dismiss
     */
    dismiss(id) {
        const index = this.toasts.findIndex(t => t.id === id);
        if (index === -1) return;
        
        const toast = this.toasts[index];
        
        // Clear timeout if exists
        if (toast.timeoutId) {
            clearTimeout(toast.timeoutId);
        }
        
        // Animate out
        if (toast.element) {
            toast.element.classList.remove('toast-show');
            toast.element.classList.add('toast-hide');
            
            // Remove after animation
            setTimeout(() => {
                if (toast.element && toast.element.parentNode) {
                    toast.element.remove();
                }
            }, this.options.animationDuration);
        }
        
        // Remove from array
        this.toasts.splice(index, 1);
    }
    
    /**
     * Dismiss all toasts
     */
    dismissAll() {
        // Create a copy to avoid mutation during iteration
        [...this.toasts].forEach(toast => {
            this.dismiss(toast.id);
        });
    }
    
    /**
     * Update an existing toast
     * @param {number} id - Toast ID to update
     * @param {Object} updates - Properties to update
     */
    update(id, updates) {
        const toast = this.toasts.find(t => t.id === id);
        if (!toast) return;
        
        // Update message if provided
        if (updates.message && toast.element) {
            const messageEl = toast.element.querySelector('.toast-message');
            if (messageEl) {
                messageEl.textContent = updates.message;
            }
        }
        
        // Update other properties
        Object.assign(toast, updates);
    }
    
    /**
     * Show success toast
     * @param {string} message - Success message
     * @param {Object} options - Additional options
     * @returns {number} Toast ID
     */
    success(message, options = {}) {
        return this.show(message, 'success', options);
    }
    
    /**
     * Show error toast
     * @param {string} message - Error message
     * @param {Object} options - Additional options
     * @returns {number} Toast ID
     */
    error(message, options = {}) {
        return this.show(message, 'error', options);
    }
    
    /**
     * Show warning toast
     * @param {string} message - Warning message
     * @param {Object} options - Additional options
     * @returns {number} Toast ID
     */
    warning(message, options = {}) {
        return this.show(message, 'warning', options);
    }
    
    /**
     * Show info toast
     * @param {string} message - Info message
     * @param {Object} options - Additional options
     * @returns {number} Toast ID
     */
    info(message, options = {}) {
        return this.show(message, 'info', options);
    }
}

// Create singleton instance for easy access
let toastInstance = null;

/**
 * Get or create the global toast instance
 * @param {Object} options - Configuration options
 * @returns {ToastManager} Toast manager instance
 */
export function getToastManager(options = {}) {
    if (!toastInstance) {
        toastInstance = new ToastManager(options);
    }
    return toastInstance;
}

// Convenience methods for global instance
export const toast = {
    show: (message, type, options) => getToastManager().show(message, type, options),
    success: (message, options) => getToastManager().success(message, options),
    error: (message, options) => getToastManager().error(message, options),
    warning: (message, options) => getToastManager().warning(message, options),
    info: (message, options) => getToastManager().info(message, options),
    dismiss: (id) => getToastManager().dismiss(id),
    dismissAll: () => getToastManager().dismissAll(),
    update: (id, updates) => getToastManager().update(id, updates)
};

export default ToastManager;