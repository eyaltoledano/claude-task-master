# TaskCard Component Tests

## Overview

This directory contains comprehensive unit tests for the TaskCard component system, following Test-Driven Development (TDD) methodology.

## Test File Structure

### `taskCard.test.js`

Comprehensive test suite covering:

1. **Component Initialization and Structure**
   - Valid task card element creation
   - Proper DOM structure
   - Accessibility attributes
   - Error handling for invalid inputs

2. **Priority Color Coding System**
   - Critical (Red): `#dc3545`
   - High (Orange): `#fd7e14`
   - Medium (Blue): `#0d6efd`
   - Low (Green): `#198754`

3. **Badge System Testing**
   - Parent task badges with unique colors
   - Complexity score badges (1-10 scale)
   - AI model assignment tags
   - Dependency count indicators

4. **Description Management**
   - Text truncation at word boundaries
   - Expand/collapse functionality
   - Handling of various text lengths

5. **Progress Bar Calculations**
   - Accurate percentage calculations
   - Subtask completion tracking
   - Accessibility attributes

6. **Card Type Variants**
   - Main task cards
   - Parent task cards (with subtasks)
   - Subtask identification

7. **Accessibility Features**
   - ARIA labels and roles
   - Keyboard navigation support
   - Screen reader compatibility
   - Focus management

8. **Performance Testing**
   - Bulk card creation (100-500 cards)
   - Memory efficiency validation
   - Rapid successive operations

9. **Memory Cleanup**
   - Event listener cleanup
   - Observer reference cleanup
   - Prevention of memory leaks

10. **Edge Cases and Error Handling**
    - Invalid task data
    - Special characters
    - Circular references
    - Extremely long content

## Features Tested

### Core Component Features
- ✅ Task card creation and structure
- ✅ Priority-based color coding
- ✅ Dual card types (main/parent)
- ✅ Glassmorphism CSS effects
- ✅ ARIA accessibility

### Badge Systems
- ✅ Parent task badges with unique colors
- ✅ Complexity score badges (1-10 scale)
- ✅ AI model assignment tags
- ✅ Dependency count indicators

### Interactive Features
- ✅ Description truncation/expansion
- ✅ Progress bars for parent tasks
- ✅ Drag and drop support
- ✅ Keyboard navigation

### Performance & Quality
- ✅ Bulk operations (500+ cards)
- ✅ Memory leak prevention
- ✅ Error handling
- ✅ Input validation

## Running Tests

```bash
# Run all component tests
npm test tests/unit/ui/client/components/

# Run specific TaskCard tests
npm test tests/unit/ui/client/components/taskCard.test.js

# Run with coverage
npm test tests/unit/ui/client/components/taskCard.test.js --coverage
```

## Test Data Structure

The tests use comprehensive mock task objects with:

```javascript
{
  id: 'task-123',
  title: 'Implement authentication system',
  description: 'Comprehensive auth system...',
  status: 'in-progress',
  priority: 'high', // critical, high, medium, low
  complexityScore: 7, // 1-10
  aiModel: 'claude-3-sonnet',
  dependencies: ['task-100', 'task-101'],
  subtasks: [...], // Array of subtask objects
  tags: ['backend', 'security'],
  assignee: 'john.doe',
  dueDate: '2024-01-15',
  createdAt: '2024-01-01'
}
```

## Mocking Strategy

- **DOM Environment**: Complete DOM mocking with createElement, querySelector, etc.
- **Component Class**: MockTaskCard implementation for isolated testing
- **Event System**: Jest mocks for event listeners and handlers
- **Performance**: Timing-based assertions for bulk operations

## Coverage Goals

- **Functions**: 95%+
- **Lines**: 95%+
- **Branches**: 90%+
- **Statements**: 95%+

## Implementation Requirements

Based on these tests, the actual TaskCard component should implement:

1. **Static Methods**:
   - `create(task)` - Main card creation
   - `getPriorityColor(priority)` - Color mapping
   - `createParentTaskBadge(task)` - Parent badges
   - `createComplexityBadge(score)` - Complexity badges
   - `createAIModelTag(model)` - AI model tags
   - `createDependencyIndicator(count)` - Dependency indicators
   - `createProgressBar(task)` - Progress calculation
   - `truncateDescription(text, maxLength)` - Text handling
   - `validateTask(task)` - Input validation
   - `cleanup(element)` - Memory management

2. **CSS Classes Required**:
   - `.task-card` - Base card styling
   - `.priority-{level}` - Priority colors
   - `.parent-task-badge` - Parent indicators
   - `.complexity-badge` - Complexity scores
   - `.ai-model-tag` - AI model tags
   - `.dependency-indicator` - Dependency counts
   - `.progress-bar-container` - Progress bars
   - `.glassmorphism` - Visual effects

3. **Accessibility Attributes**:
   - `role="option"`
   - `aria-grabbed="false"`
   - `aria-label` descriptions
   - `tabindex="0"`
   - Progress bar ARIA attributes

## Future Enhancements

Tests are designed to accommodate future features:
- Animation testing framework
- Touch gesture support
- Real-time updates
- Collaborative editing
- Custom themes
- Plugin system