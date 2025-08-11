# Models.dev Integration Specification

## Overview
This specification defines the integration of [models.dev](https://github.com/sst/models.dev) as the primary source for AI model information in Task Master, replacing the current hardcoded model list while maintaining full backward compatibility.

## Goals
1. **Dynamic Model Discovery**: Replace static model lists with live data from models.dev API
2. **Enhanced Model Information**: Provide richer model metadata (pricing, capabilities, context limits)
3. **Zero Breaking Changes**: Maintain existing CLI interface and behavior
4. **Graceful Degradation**: Fall back to static models if models.dev is unavailable
5. **Performance**: Cache models.dev data with appropriate TTL to avoid API rate limits

## Current State Analysis

### Existing Model Management
- Static model list in `scripts/modules/supported-models.json`
- `getAvailableModels()` function in `config-manager.js` returns hardcoded models
- CLI commands: `task-master models` shows current config and available models
- MCP tools expose model management via `models` tool

### Data Flow
```
supported-models.json → getAvailableModels() → CLI/MCP display → User selection
```

### Current Model Schema
```typescript
interface StaticModel {
  id: string;
  name: string;
  provider: string;
  swe_score?: number;
  cost_per_1m_tokens?: { input: number; output: number };
  allowed_roles: string[];
  max_tokens?: number;
  supported: boolean;
}
```

## Target State Design

### Enhanced Data Flow
```
models.dev API → ModelsDevService → ModelCache → getAvailableModels() → CLI/MCP display
                                      ↓
                                 Static Fallback
```

### New Model Schema (Enhanced)
```typescript
interface EnhancedModel {
  // Existing fields (backward compatibility)
  id: string;
  name: string;
  provider: string;
  swe_score?: number;
  cost_per_1m_tokens?: { input: number; output: number };
  allowed_roles: string[];
  max_tokens?: number;
  
  // New fields from models.dev
  source: 'static' | 'models.dev';
  reasoning?: boolean;
  tool_call?: boolean;
  modalities?: { input: string[]; output: string[] };
  context_length?: number;
  release_date?: string;
  documentation?: string;
  npm_package?: string;
  env_vars?: string[];
  last_updated?: string;
}
```

## Technical Specification

### 1. Models.dev API Integration

#### API Endpoint
- **URL**: `https://models.dev/api.json`
- **Method**: GET
- **Response**: JSON object with provider → models mapping

#### API Response Schema
```typescript
interface ModelsDevResponse {
  [providerId: string]: {
    name: string;           // Provider display name
    npm?: string;          // NPM package for this provider
    env: string[];         // Required environment variables
    doc?: string;          // Documentation URL
    models: {
      [modelId: string]: {
        name: string;
        cost?: { input: number; output: number };
        limit?: { context: number };
        reasoning?: boolean;
        tool_call?: boolean;
        modalities?: { input: string[]; output: string[] };
        release_date?: string;
        // ... other model-specific fields
      };
    };
  };
}
```

### 2. Service Layer Architecture

#### ModelsDevService
```typescript
class ModelsDevService {
  private apiUrl: string = 'https://models.dev/api.json';
  private cacheFile: string = '.taskmaster/models-cache.json';
  private cacheTimeout: number = 24 * 60 * 60 * 1000; // 24 hours

  async fetchModels(): Promise<ModelsDevResponse>
  async getProviders(): Promise<string[]>
  async getProviderModels(providerId: string): Promise<EnhancedModel[]>
  async searchModels(filters: SearchFilters): Promise<EnhancedModel[]>
  async clearCache(): Promise<void>
  async getCacheInfo(): Promise<CacheInfo>
}
```

#### ModelMerger
```typescript
class ModelMerger {
  mergeStaticAndDynamic(
    staticModels: StaticModel[], 
    dynamicModels: EnhancedModel[]
  ): EnhancedModel[]
  
  deduplicateModels(models: EnhancedModel[]): EnhancedModel[]
  normalizeModelFormat(model: any, source: 'static' | 'models.dev'): EnhancedModel
}
```

### 3. Integration Points

#### Enhanced getAvailableModels()
```typescript
async function getAvailableModels(): Promise<EnhancedModel[]> {
  try {
    // Load static models (existing logic)
    const staticModels = loadStaticModels();
    
    // Load dynamic models from models.dev
    const dynamicModels = await modelsDevService.fetchModels();
    
    // Merge and deduplicate
    return modelMerger.mergeStaticAndDynamic(staticModels, dynamicModels);
  } catch (error) {
    // Fallback to static models
    console.warn('models.dev unavailable, using static models:', error.message);
    return loadStaticModels();
  }
}
```

#### Backward Compatibility Strategy
1. **Interface Preservation**: All existing functions maintain same signatures
2. **Data Enhancement**: New fields are additive, existing fields remain unchanged
3. **Fallback Behavior**: Static models used when models.dev fails
4. **Performance**: Async loading with caching to prevent blocking

### 4. Caching Strategy

#### Cache Structure
```typescript
interface ModelCache {
  timestamp: number;
  ttl: number;
  data: ModelsDevResponse;
  fallback_used: boolean;
}
```

#### Cache Behavior
- **Location**: `.taskmaster/models-cache.json`
- **TTL**: 24 hours
- **Invalidation**: Manual refresh or cache expiry
- **Fallback**: Use stale cache if API fails, use static models if no cache

### 5. Error Handling

#### Failure Modes & Responses
1. **API Unavailable**: Use cached data if available, otherwise static models
2. **Invalid API Response**: Log warning, use static models
3. **Cache Corruption**: Rebuild cache, use static models during rebuild
4. **Network Timeout**: Use cached data, log warning

#### Error Logging Strategy
```typescript
// Non-blocking warnings for degraded functionality
console.warn('[TASK-MASTER] models.dev unavailable, using cached/static models');

// Debug logging for development
log.debug('models.dev cache hit/miss/refresh');
```

## Implementation Plan

### Phase 1: Core Service Layer
- [ ] Create `ModelsDevService` class
- [ ] Implement API fetching with caching
- [ ] Add error handling and fallback logic
- [ ] Create comprehensive unit tests

### Phase 2: Model Merging Logic
- [ ] Create `ModelMerger` class  
- [ ] Implement merge and deduplication algorithms
- [ ] Handle schema normalization between static/dynamic
- [ ] Add integration tests

### Phase 3: Config Manager Integration
- [ ] Update `getAvailableModels()` to use new services
- [ ] Ensure backward compatibility of return format
- [ ] Add performance optimizations (async/await)
- [ ] Create migration tests

### Phase 4: CLI Enhancement (Optional)
- [ ] Add cache management commands (refresh, status)
- [ ] Add enhanced model information display
- [ ] Maintain existing command interface
- [ ] Add user documentation

## Acceptance Criteria

### Functional Requirements
- [ ] All existing CLI commands work unchanged
- [ ] Models from models.dev appear in model lists
- [ ] Pricing information is more accurate and up-to-date
- [ ] System gracefully handles models.dev downtime
- [ ] Cache reduces API calls to reasonable levels

### Non-Functional Requirements
- [ ] No breaking changes to existing interfaces
- [ ] Performance impact < 100ms for cached operations
- [ ] Memory usage increase < 10MB for model data
- [ ] Test coverage > 90% for new code

### User Experience
- [ ] Users see more models without any configuration changes
- [ ] Model information is richer (pricing, capabilities)
- [ ] System remains responsive even during API calls
- [ ] Error states are handled gracefully

## Testing Strategy

### Unit Tests
- ModelsDevService API integration
- ModelMerger deduplication logic
- Error handling for all failure modes
- Cache management operations

### Integration Tests
- End-to-end model loading workflow
- CLI command compatibility
- MCP tool functionality
- Performance benchmarks

### Manual Testing
- API failure scenarios
- Cache corruption recovery
- Large model dataset handling
- Network timeout conditions

## Documentation Requirements

### Technical Documentation
- API integration guide
- Caching architecture overview
- Error handling patterns
- Performance characteristics

### User Documentation
- Updated CLI help text
- Model selection guide
- Troubleshooting common issues
- Migration notes (if any)

## Risk Assessment

### High Risk
- **API Dependency**: models.dev becoming unavailable
  - *Mitigation*: Robust caching and static fallback
  
### Medium Risk
- **Performance Impact**: Async operations affecting CLI speed
  - *Mitigation*: Intelligent caching and background updates

### Low Risk
- **Data Schema Changes**: models.dev changing their API format
  - *Mitigation*: Defensive parsing and schema validation

## Success Metrics

- **Functionality**: All existing tests pass
- **Performance**: Model loading time < 200ms (cached)
- **Reliability**: 99%+ success rate with fallback handling
- **Coverage**: 100% backward compatibility maintained

## Conclusion

This specification ensures that Task Master benefits from the rich, up-to-date model information available in models.dev while maintaining complete backward compatibility and robust error handling. The phased implementation approach minimizes risk while delivering incremental value.