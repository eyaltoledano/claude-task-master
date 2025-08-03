# TaskCard Component Implementation Guide

## Overview

This guide outlines the implementation requirements for the TaskCard component based on the comprehensive test suite in `taskCard.test.js`. The tests follow TDD methodology and define the expected behavior for task 109: [Kanban Board] Task Card Component System.

## Required Implementation Features

### 1. Core Component Structure

The TaskCard component must implement these static methods:

```javascript
class TaskCard {
    // Main card creation method
    static create(task) { /* ... */ }
    
    // Priority system
    static getPriorityColor(priority) { /* ... */ }
    
    // Badge systems
    static createParentTaskBadge(task) { /* ... */ }
    static createComplexityBadge(complexityScore) { /* ... */ }
    static createAIModelTag(aiModel) { /* ... */ }
    static createDependencyIndicator(dependencyCount) { /* ... */ }
    
    // Progress tracking
    static createProgressBar(task) { /* ... */ }
    
    // Text handling
    static truncateDescription(description, maxLength = 120) { /* ... */ }
    
    // Validation and cleanup
    static validateTask(task) { /* ... */ }
    static cleanup(element) { /* ... */ }
    static remove(cardElement) { /* ... */ }
    static focus(cardElement) { /* ... */ }
}
```

### 2. Priority Color Coding System

**Required Colors:**
- **Critical**: `#dc3545` (Red)
- **High**: `#fd7e14` (Orange)  
- **Medium**: `#0d6efd` (Blue)
- **Low**: `#198754` (Green)

**Implementation:**
- Apply color via CSS custom properties or direct styling
- Add priority class to card element
- Default to medium priority if not specified

### 3. Badge System Requirements

#### Parent Task Badges
- Only show for tasks with subtasks
- Display subtask count: `"Parent (4)"`
- Generate unique colors based on task ID
- Use color palette: `['#6f42c1', '#dc3545', '#fd7e14', '#198754', '#0d6efd', '#6610f2']`

#### Complexity Score Badges
- Scale: 1-10
- Classification:
  - Low (1-3): `.complexity-low`
  - Medium (4-6): `.complexity-medium` 
  - High (7-10): `.complexity-high`
- Include ARIA labels: `"Complexity: X out of 10"`

#### AI Model Assignment Tags
- Display AI model name (e.g., "claude-3-sonnet")
- Include `data-ai-model` attribute
- Accessible labels

#### Dependency Count Indicators
- Show count as "X deps"
- Only display if dependencies exist
- Include tooltip: "This task has X dependencies"

### 4. Description Truncation and Expansion

**Requirements:**
- Default max length: 120 characters
- Truncate at word boundaries
- Add "..." for truncated text
- Return object: `{ text, isTruncated, originalText? }`
- Handle edge cases (null, undefined, empty strings)

### 5. Progress Bar Implementation

**For Parent Tasks Only:**
- Calculate: `(completedSubtasks / totalSubtasks) * 100`
- Include ARIA attributes:
  - `role="progressbar"`
  - `aria-valuenow="50"`
  - `aria-valuemin="0"`
  - `aria-valuemax="100"`
  - `aria-label="Progress: 2 of 4 subtasks completed"`

### 6. Card Type Variants

**Main Task Cards:**
- `data-card-type="main"`
- No subtasks or subtasks array empty

**Parent Task Cards:**
- `data-card-type="parent"`
- Has subtasks array with length > 0
- Include progress bar
- Show parent task badge

### 7. Accessibility Requirements

**ARIA Attributes:**
```html
<div class="task-card"
     role="option"
     tabindex="0"
     draggable="true"
     aria-grabbed="false"
     aria-label="Task: {title}"
     data-task-id="{id}"
     data-priority="{priority}"
     data-card-type="{type}">
```

**Focus Management:**
- Support keyboard navigation
- Implement focus() method
- Handle tab order properly

### 8. Performance Requirements

**Bulk Operations:**
- Handle 500+ cards efficiently
- Complete in under 1 second
- Maintain memory efficiency
- Support rapid successive operations

**Memory Management:**
- Implement cleanup() method
- Clear event listeners: `element._listeners = null`
- Clear observers: `element._observers = null`
- Handle removal animations

### 9. CSS Classes Required

```css
/* Base classes */
.task-card { /* Basic card styling */ }
.task-card.glassmorphism { /* Glassmorphism effects */ }

/* Priority classes */
.task-card.priority-critical { /* Red border/accent */ }
.task-card.priority-high { /* Orange border/accent */ }
.task-card.priority-medium { /* Blue border/accent */ }
.task-card.priority-low { /* Green border/accent */ }

/* Badge classes */
.parent-task-badge { /* Parent task indicator */ }
.complexity-badge { /* Base complexity styling */ }
.complexity-badge.complexity-low { /* Green */ }
.complexity-badge.complexity-medium { /* Yellow */ }
.complexity-badge.complexity-high { /* Red */ }
.ai-model-tag { /* AI model labels */ }
.dependency-indicator { /* Dependency counts */ }

/* Progress bars */
.progress-bar-container { /* Progress wrapper */ }
.progress-bar { /* Actual progress bar */ }

/* Animation classes */
.task-card.slide-in { /* Entry animation */ }
.task-card.slide-out { /* Exit animation */ }
```

### 10. Validation Rules

**Required Fields:**
- `id` (string, non-empty)
- `title` (string, non-empty after trim)

**Valid Values:**
- `status`: `['backlog', 'ready', 'in-progress', 'review', 'done']`
- `priority`: `['low', 'medium', 'high', 'critical']`
- `complexityScore`: `1-10` (integer)

**Error Handling:**
- Return `{ valid: boolean, errors: string[] }`
- Graceful degradation for missing optional fields
- Console warnings for invalid data

### 11. DOM Structure

```html
<div class="task-card glassmorphism priority-high" 
     data-task-id="task-123" 
     data-priority="high"
     data-card-type="parent"
     role="option"
     tabindex="0"
     draggable="true"
     aria-grabbed="false"
     aria-label="Task: Implement authentication system">
  
  <!-- Task Header -->
  <div class="task-header">
    <h3 class="task-title">Implement authentication system</h3>
    <span class="task-id">#123</span>
  </div>
  
  <!-- Badge Section -->
  <div class="task-badges">
    <span class="parent-task-badge">Parent (4)</span>
    <span class="complexity-badge complexity-high">7</span>
    <span class="ai-model-tag">claude-3-sonnet</span>
    <span class="dependency-indicator">2 deps</span>
  </div>
  
  <!-- Task Body -->
  <div class="task-body">
    <p class="task-description">Create a comprehensive auth system...</p>
  </div>
  
  <!-- Progress Bar (parent tasks only) -->
  <div class="progress-bar-container">
    <div class="progress-bar" 
         style="width: 50%"
         role="progressbar"
         aria-valuenow="50"
         aria-valuemin="0"
         aria-valuemax="100"
         aria-label="Progress: 2 of 4 subtasks completed"></div>
  </div>
  
  <!-- Task Footer -->
  <div class="task-footer">
    <div class="task-tags">
      <span class="task-tag">backend</span>
      <span class="task-tag">security</span>
    </div>
    <div class="task-meta">
      <span class="task-assignee">JD</span>
      <span class="task-due-date">Jan 15</span>
    </div>
  </div>
</div>
```

## Test Coverage Areas

The test suite validates:

1. ✅ **Component Initialization** (12 tests)
2. ✅ **Priority Color Coding** (4 tests)  
3. ✅ **Badge Systems** (15 tests)
4. ✅ **Description Handling** (5 tests)
5. ✅ **Progress Calculations** (4 tests)
6. ✅ **Card Type Variants** (4 tests)
7. ✅ **Dependency Display** (4 tests)
8. ✅ **Accessibility** (6 tests)
9. ✅ **Performance** (4 tests)
10. ✅ **Memory Cleanup** (5 tests)
11. ✅ **Validation & Errors** (10 tests)
12. ✅ **Edge Cases** (8 tests)

**Total: 81 test cases across 12 categories**

## Integration Points

The TaskCard component must integrate with:

1. **Kanban Board**: Card placement and movement
2. **Drag & Drop System**: Event handling
3. **Task Data API**: Data fetching and updates
4. **CSS Framework**: Styling and animations
5. **Accessibility Tools**: Screen readers and keyboard nav

## Development Approach

1. **Start with Tests**: The test suite is already complete
2. **Implement Core Structure**: Basic card creation first
3. **Add Badge Systems**: One badge type at a time
4. **Implement Interactions**: Drag, drop, expand/collapse
5. **Optimize Performance**: Bulk operations and memory
6. **Polish Accessibility**: ARIA labels and keyboard support

## Running Tests

```bash
# Run the specific test file
npm test tests/unit/ui/client/components/taskCard.test.js

# Run with coverage
npm test tests/unit/ui/client/components/taskCard.test.js --coverage

# Watch mode during development
npm test tests/unit/ui/client/components/taskCard.test.js --watch
```

This comprehensive test suite ensures the TaskCard component will be robust, accessible, and performant when implemented according to these specifications.