# Task Template Importing System - Product Requirements Document

<context>
# Overview  
The Task Template Importing system enables seamless integration of external task templates into the Task Master CLI through automatic file discovery. This system allows users to drop task template files into the tasks directory and immediately access them as new tag contexts without manual import commands or configuration. The solution addresses the need for multi-project task management, team collaboration through shared templates, and clean separation between permanent tasks and temporary project contexts.

# Core Features  
## Silent Task Template Discovery
- **What it does**: Automatically scans for `tasks_*.json` files in the tasks directory during tag operations
- **Why it's important**: Eliminates friction in adding new task contexts and enables zero-configuration workflow
- **How it works**: File pattern matching extracts tag names from filenames and validates against internal tag keys

## External Tag Resolution System
- **What it does**: Provides fallback mechanism to external files when tags are not found in main tasks.json
- **Why it's important**: Maintains clean separation between core tasks and project-specific templates
- **How it works**: Tag resolution logic checks external files as secondary source while preserving main file precedence

## Read-Only External Tag Access
- **What it does**: Allows viewing and switching to external tags while preventing modifications
- **Why it's important**: Protects template integrity and prevents accidental changes to shared templates
- **How it works**: All task modifications route to main tasks.json regardless of current tag context

## Tag Precedence Management
- **What it does**: Ensures main tasks.json tags override external files with same tag names
- **Why it's important**: Prevents conflicts and maintains data integrity
- **How it works**: Priority system where main file tags take precedence over external file tags

# User Experience  
## User Personas
- **Solo Developer**: Manages multiple projects with different task contexts
- **Team Lead**: Shares standardized task templates across team members
- **Project Manager**: Organizes tasks by project phases or feature branches

## Key User Flows
### Template Addition Flow
1. User receives or creates a `tasks_projectname.json` file
2. User drops file into `.taskmaster/tasks/` directory
3. Tag becomes immediately available via `task-master use-tag projectname`
4. User can list, view, and switch to external tag without configuration

### Template Usage Flow
1. User runs `task-master tags` to see available tags including external ones
2. External tags display with `(imported)` indicator
3. User switches to external tag with `task-master use-tag projectname`
4. User can view tasks but modifications are routed to main tasks.json

## UI/UX Considerations
- External tags clearly marked with `(imported)` suffix in listings
- Visual indicators distinguish between main and external tags
- Error messages guide users when external files are malformed
- Read-only warnings when attempting to modify external tag contexts
</context>

<PRD>
# Technical Architecture  
## System Components
1. **External File Discovery Engine**
   - File pattern scanner for `tasks_*.json` files
   - Tag name extraction from filenames using regex
   - Dynamic tag registry combining main and external sources
   - Error handling for malformed external files

2. **Enhanced Tag Resolution System**
   - Fallback mechanism to external files when tags not found in main tasks.json
   - Precedence management ensuring main file tags override external files
   - Read-only access enforcement for external tags
   - Tag metadata preservation during discovery operations

3. **Silent Discovery Integration**
   - Automatic scanning during tag-related operations
   - Seamless integration with existing tag management functions
   - Zero-configuration workflow requiring no manual import commands
   - Dynamic tag availability without restart requirements

## Data Models

### External Task File Structure
```json
{
  "meta": {
    "projectName": "External Project Name",
    "version": "1.0.0",
    "templateSource": "external",
    "createdAt": "ISO-8601 timestamp"
  },
  "tags": {
    "projectname": {
      "meta": {
        "name": "Project Name",
        "description": "Project description",
        "createdAt": "ISO-8601 timestamp"
      },
      "tasks": [
        // Array of task objects
      ]
    },
    "master": {
      // This section is ignored to prevent conflicts
    }
  }
}
```

### Enhanced Tag Registry Model
```json
{
  "mainTags": [
    {
      "name": "master",
      "source": "main",
      "taskCount": 150,
      "isActive": true
    }
  ],
  "externalTags": [
    {
      "name": "projectname",
      "source": "external",
      "filename": "tasks_projectname.json",
      "taskCount": 25,
      "isReadOnly": true
    }
  ]
}
```

## APIs and Integrations
1. **File System Discovery API**
   - Directory scanning with pattern matching
   - JSON file validation and parsing
   - Error handling for corrupted or malformed files
   - File modification time tracking for cache invalidation

2. **Enhanced Tag Management API**
   - `scanForExternalTaskFiles(projectRoot)` - Discover external template files
   - `getExternalTagsFromFiles(projectRoot)` - Extract tag names from external files
   - `readExternalTagData(projectRoot, tagName)` - Read specific external tag data
   - `getAvailableTags(projectRoot)` - Combined main and external tag listing

3. **Tag Resolution Enhancement**
   - Modified `readJSON()` with external file fallback
   - Enhanced `tags()` function with external tag display
   - Updated `useTag()` function supporting external tag switching
   - Read-only enforcement for external tag operations

## Infrastructure Requirements
1. **File System Access**
   - Read permissions for tasks directory
   - JSON parsing capabilities
   - Pattern matching and regex support
   - Error handling for file system operations

2. **Backward Compatibility**
   - Existing tag operations continue unchanged
   - Main tasks.json structure preserved
   - No breaking changes to current workflows
   - Graceful degradation when external files unavailable

# Development Roadmap  
## Phase 1: Core External File Discovery (Foundation)
1. **External File Scanner Implementation**
   - Create `scanForExternalTaskFiles()` function in utils.js
   - Implement file pattern matching for `tasks_*.json` files
   - Add error handling for file system access issues
   - Test with various filename patterns and edge cases

2. **Tag Name Extraction System**
   - Implement `getExternalTagsFromFiles()` function
   - Create regex pattern for extracting tag names from filenames
   - Add validation to ensure tag names match internal tag key format
   - Handle special characters and invalid filename patterns

3. **External Tag Data Reader**
   - Create `readExternalTagData()` function
   - Implement JSON parsing with error handling
   - Add validation for required tag structure
   - Ignore 'master' key in external files to prevent conflicts

## Phase 2: Tag Resolution Enhancement (Core Integration)
1. **Enhanced Tag Registry**
   - Implement `getAvailableTags()` function combining main and external sources
   - Create tag metadata structure including source information
   - Add deduplication logic prioritizing main tags over external
   - Implement caching mechanism for performance optimization

2. **Modified readJSON Function**
   - Add external file fallback when tag not found in main tasks.json
   - Maintain precedence rule: main tasks.json overrides external files
   - Preserve existing error handling and validation patterns
   - Ensure read-only access for external tags

3. **Tag Listing Enhancement**
   - Update `tags()` function to display external tags with `(imported)` indicator
   - Show external tag metadata and task counts
   - Maintain current tag highlighting and sorting functionality
   - Add visual distinction between main and external tags

## Phase 3: User Interface Integration (User Experience)
1. **Tag Switching Enhancement**
   - Update `useTag()` function to support external tag switching
   - Add read-only warnings when switching to external tags
   - Update state.json with external tag context information
   - Maintain current tag switching behavior for main tags

2. **Error Handling and User Feedback**
   - Implement comprehensive error messages for malformed external files
   - Add user guidance for proper external file structure
   - Create warnings for read-only operations on external tags
   - Ensure graceful degradation when external files are corrupted

3. **Documentation and Help Integration**
   - Update command help text to include external tag information
   - Add examples of external file structure and usage
   - Create troubleshooting guide for common external file issues
   - Document file naming conventions and best practices

## Phase 4: Advanced Features and Optimization (Enhancement)
1. **Performance Optimization**
   - Implement file modification time caching
   - Add lazy loading for external tag data
   - Optimize file scanning for directories with many files
   - Create efficient tag resolution caching mechanism

2. **Advanced External File Features**
   - Support for nested external file directories
   - Batch external file validation and reporting
   - External file metadata display and management
   - Integration with version control ignore patterns

3. **Team Collaboration Features**
   - Shared external file validation
   - External file conflict detection and resolution
   - Team template sharing guidelines and documentation
   - Integration with git workflows for template management

# Logical Dependency Chain
## Foundation Layer (Must Be Built First)
1. **External File Scanner** 
   - Core requirement for all other functionality
   - Provides the discovery mechanism for external template files
   - Must handle file system access and pattern matching reliably

2. **Tag Name Extraction**
   - Depends on file scanner functionality
   - Required for identifying available external tags
   - Must validate tag names against internal format requirements

3. **External Tag Data Reader**
   - Depends on tag name extraction
   - Provides access to external tag content
   - Must handle JSON parsing and validation safely

## Integration Layer (Builds on Foundation)
4. **Enhanced Tag Registry**
   - Depends on all foundation components
   - Combines main and external tag sources
   - Required for unified tag management across the system

5. **Modified readJSON Function**
   - Depends on enhanced tag registry
   - Provides fallback mechanism for tag resolution
   - Critical for maintaining backward compatibility

6. **Tag Listing Enhancement**
   - Depends on enhanced tag registry
   - Provides user visibility into external tags
   - Required for user discovery of available templates

## User Experience Layer (Completes the Feature)
7. **Tag Switching Enhancement**
   - Depends on modified readJSON and tag listing
   - Enables user interaction with external tags
   - Must enforce read-only access properly

8. **Error Handling and User Feedback**
   - Can be developed in parallel with other UX components
   - Enhances reliability and user experience
   - Should be integrated throughout development process

9. **Documentation and Help Integration**
   - Should be developed alongside implementation
   - Required for user adoption and proper usage
   - Can be completed in parallel with advanced features

## Optimization Layer (Performance and Advanced Features)
10. **Performance Optimization**
    - Can be developed after core functionality is stable
    - Improves user experience with large numbers of external files
    - Not blocking for initial release

11. **Advanced External File Features**
    - Can be developed independently after core features
    - Enhances power user workflows
    - Optional for initial release

12. **Team Collaboration Features**
    - Depends on stable core functionality
    - Enhances team workflows and template sharing
    - Can be prioritized based on user feedback

# Risks and Mitigations  
## Technical Challenges

### File System Performance
**Risk**: Scanning for external files on every tag operation could impact performance with large directories.
**Mitigation**: 
- Implement file modification time caching to avoid unnecessary rescans
- Use lazy loading for external tag data - only read when accessed
- Add configurable limits on number of external files to scan
- Optimize file pattern matching with efficient regex patterns

### External File Corruption
**Risk**: Malformed or corrupted external JSON files could break tag operations.
**Mitigation**:
- Implement robust JSON parsing with comprehensive error handling
- Add file validation before attempting to parse external files
- Gracefully skip corrupted files and continue with valid ones
- Provide clear error messages guiding users to fix malformed files

### Tag Name Conflicts
**Risk**: External files might contain tag names that conflict with main tasks.json tags.
**Mitigation**:
- Implement strict precedence rule: main tasks.json always overrides external files
- Add warnings when external tags are ignored due to conflicts
- Document naming conventions to avoid common conflicts
- Provide validation tools to check for potential conflicts

## MVP Definition

### Core Feature Scope
**Risk**: Including too many advanced features could delay the core functionality.
**Mitigation**:
- Define MVP as basic external file discovery + tag switching
- Focus on the silent discovery mechanism as the primary value proposition
- Defer advanced features like nested directories and batch operations
- Ensure each phase delivers complete, usable functionality

### User Experience Complexity
**Risk**: The read-only nature of external tags might confuse users.
**Mitigation**:
- Provide clear visual indicators for external tags in all interfaces
- Add explicit warnings when users attempt to modify external tag contexts
- Document the read-only behavior and its rationale clearly
- Consider future enhancement for external tag modification workflows

### Backward Compatibility
**Risk**: Changes to tag resolution logic might break existing workflows.
**Mitigation**:
- Maintain existing tag operations unchanged for main tasks.json
- Add external file support as enhancement, not replacement
- Test thoroughly with existing task structures and workflows
- Provide migration path if any breaking changes are necessary

## Resource Constraints

### Development Complexity
**Risk**: Integration with existing tag management system could be complex.
**Mitigation**:
- Phase implementation to minimize risk of breaking existing functionality
- Create comprehensive test suite covering both main and external tag scenarios
- Use feature flags to enable/disable external file support during development
- Implement thorough error handling to prevent system failures

### File System Dependencies
**Risk**: Different operating systems might handle file operations differently.
**Mitigation**:
- Use Node.js built-in file system APIs for cross-platform compatibility
- Test on multiple operating systems (Windows, macOS, Linux)
- Handle file path separators and naming conventions properly
- Add fallback mechanisms for file system access issues

### User Adoption
**Risk**: Users might not understand or adopt the external file template system.
**Mitigation**:
- Create clear documentation with practical examples
- Provide sample external template files for common use cases
- Integrate help and guidance directly into the CLI interface
- Gather user feedback early and iterate on the user experience

# Appendix  
## External File Naming Convention

### Filename Pattern
- **Format**: `tasks_[tagname].json`
- **Examples**: `tasks_feature-auth.json`, `tasks_v2-migration.json`, `tasks_project-alpha.json`
- **Validation**: Tag name must match internal tag key format (alphanumeric, hyphens, underscores)

### File Structure Requirements
```json
{
  "meta": {
    "projectName": "Required: Human-readable project name",
    "version": "Optional: Template version",
    "templateSource": "Optional: Source identifier",
    "createdAt": "Optional: ISO-8601 timestamp"
  },
  "tags": {
    "[tagname]": {
      "meta": {
        "name": "Required: Tag display name",
        "description": "Optional: Tag description",
        "createdAt": "Optional: ISO-8601 timestamp"
      },
      "tasks": [
        // Required: Array of task objects following standard task structure
      ]
    }
  }
}
```

## Implementation Functions Specification

### Core Discovery Functions
```javascript
// Scan tasks directory for external template files
function scanForExternalTaskFiles(projectRoot) {
  // Returns: Array of external file paths
}

// Extract tag names from external filenames
function getExternalTagsFromFiles(projectRoot) {
  // Returns: Array of external tag names
}

// Read specific external tag data
function readExternalTagData(projectRoot, tagName) {
  // Returns: Tag data object or null if not found
}

// Get combined main and external tags
function getAvailableTags(projectRoot) {
  // Returns: Combined tag registry with metadata
}
```

### Integration Points
```javascript
// Enhanced readJSON with external fallback
function readJSON(projectRoot, tag = null) {
  // Modified to check external files when tag not found in main
}

// Enhanced tags listing with external indicators
function tags(projectRoot, options = {}) {
  // Modified to display external tags with (imported) suffix
}

// Enhanced tag switching with external support
function useTag(projectRoot, tagName) {
  // Modified to support switching to external tags (read-only)
}
```

## Error Handling Specifications

### File System Errors
- **ENOENT**: External file not found - gracefully skip and continue
- **EACCES**: Permission denied - warn user and continue with available files
- **EISDIR**: Directory instead of file - skip and continue scanning

### JSON Parsing Errors
- **SyntaxError**: Malformed JSON - skip file and log warning with filename
- **Missing required fields**: Skip file and provide specific error message
- **Invalid tag structure**: Skip file and guide user to correct format

### Tag Conflict Resolution
- **Duplicate tag names**: Main tasks.json takes precedence, log warning
- **Invalid tag names**: Skip external file and provide naming guidance
- **Master key in external**: Ignore master key, process other tags normally
</PRD> 