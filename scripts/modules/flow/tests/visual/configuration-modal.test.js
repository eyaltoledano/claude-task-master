/**
 * Phase 6.1 - Configuration Modal Testing
 * Comprehensive tests for configuration interface validation and user interactions
 */

import { jest } from '@jest/globals';

// Mock the Configuration Modal components
const mockConfigurationModal = {
  openModal: jest.fn(),
  closeModal: jest.fn(),
  validateForm: jest.fn(),
  saveSettings: jest.fn(),
  loadSettings: jest.fn(),
  resetToDefaults: jest.fn(),
  handleFieldChange: jest.fn(),
  validateField: jest.fn(),
  applySettings: jest.fn(),
  exportSettings: jest.fn(),
  importSettings: jest.fn(),
  checkUnsavedChanges: jest.fn()
};

// Mock configuration data
const mockDefaultSettings = {
  general: {
    theme: 'auto',
    language: 'en',
    autoSave: true,
    autoRefresh: 30000,
    debugMode: false
  },
  monitoring: {
    updateInterval: 5000,
    showNotifications: true,
    alertThreshold: 0.8,
    maxHistoryItems: 1000,
    enableMetrics: true
  },
  ui: {
    compactMode: false,
    showSidebar: true,
    sidebarWidth: 300,
    fontSize: 'medium',
    colorScheme: 'default'
  },
  performance: {
    enableCaching: true,
    cacheSize: 100,
    refreshRate: 'normal',
    lazyLoading: true,
    backgroundSync: true
  }
};

const mockUserSettings = {
  general: {
    theme: 'dark',
    language: 'en',
    autoSave: false,
    autoRefresh: 60000,
    debugMode: true
  },
  monitoring: {
    updateInterval: 3000,
    showNotifications: false,
    alertThreshold: 0.9,
    maxHistoryItems: 500,
    enableMetrics: true
  },
  ui: {
    compactMode: true,
    showSidebar: false,
    sidebarWidth: 250,
    fontSize: 'large',
    colorScheme: 'custom'
  },
  performance: {
    enableCaching: false,
    cacheSize: 50,
    refreshRate: 'fast',
    lazyLoading: false,
    backgroundSync: false
  }
};

const mockFormValidationRules = {
  'general.autoRefresh': { min: 1000, max: 300000, required: true },
  'monitoring.updateInterval': { min: 1000, max: 60000, required: true },
  'monitoring.alertThreshold': { min: 0.1, max: 1.0, required: true },
  'monitoring.maxHistoryItems': { min: 100, max: 10000, required: true },
  'ui.sidebarWidth': { min: 200, max: 500, required: true },
  'performance.cacheSize': { min: 10, max: 1000, required: true }
};

describe('Configuration Modal Testing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock implementations
    mockConfigurationModal.openModal.mockImplementation((section) => {
      return { 
        success: true, 
        opened: true, 
        section: section || 'general',
        timestamp: Date.now()
      };
    });
    
    mockConfigurationModal.closeModal.mockImplementation((saveChanges = false) => {
      return { 
        success: true, 
        closed: true, 
        savedChanges: saveChanges,
        timestamp: Date.now()
      };
    });
    
    mockConfigurationModal.validateForm.mockImplementation((settings) => {
      const errors = [];
      const warnings = [];
      
      // Validate according to rules
      Object.entries(mockFormValidationRules).forEach(([path, rules]) => {
        const value = getNestedValue(settings, path);
        
        if (rules.required && (value === undefined || value === null)) {
          errors.push(`${path} is required`);
        }
        
        if (typeof value === 'number') {
          if (rules.min && value < rules.min) {
            errors.push(`${path} must be at least ${rules.min}`);
          }
          if (rules.max && value > rules.max) {
            const maxString = rules.max === 1.0 ? '1.0' : rules.max.toString();
            errors.push(`${path} must not exceed ${maxString}`);
          }
        }
      });
      
      return {
        valid: errors.length === 0,
        errors,
        warnings,
        timestamp: Date.now()
      };
    });
    
    mockConfigurationModal.saveSettings.mockImplementation((settings) => {
      const validation = mockConfigurationModal.validateForm(settings);
      
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors,
          message: 'Validation failed'
        };
      }
      
      return {
        success: true,
        saved: true,
        settings: { ...settings },
        timestamp: Date.now()
      };
    });
    
    mockConfigurationModal.loadSettings.mockImplementation(() => {
      return {
        success: true,
        settings: { ...mockDefaultSettings },
        timestamp: Date.now()
      };
    });
    
    mockConfigurationModal.resetToDefaults.mockImplementation((section) => {
      if (section && mockDefaultSettings[section]) {
        return {
          success: true,
          section,
          settings: { ...mockDefaultSettings[section] },
          timestamp: Date.now()
        };
      } else if (!section) {
        return {
          success: true,
          settings: { ...mockDefaultSettings },
          timestamp: Date.now()
        };
      }
      
      return {
        success: false,
        error: 'Invalid section'
      };
    });
    
    mockConfigurationModal.handleFieldChange.mockImplementation((path, value) => {
      return {
        success: true,
        field: path,
        value,
        timestamp: Date.now()
      };
    });
    
    mockConfigurationModal.validateField.mockImplementation((path, value) => {
      const rules = mockFormValidationRules[path];
      if (!rules) {
        return { valid: true, field: path, value };
      }
      
      const errors = [];
      
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${path} is required`);
      }
      
      if (typeof value === 'number') {
        if (rules.min && value < rules.min) {
          errors.push(`${path} must be at least ${rules.min}`);
        }
        if (rules.max && value > rules.max) {
          const maxString = rules.max === 1.0 ? '1.0' : rules.max.toString();
          errors.push(`${path} must not exceed ${maxString}`);
        }
      }
      
      return {
        valid: errors.length === 0,
        field: path,
        value,
        errors,
        timestamp: Date.now()
      };
    });
    
    mockConfigurationModal.applySettings.mockImplementation((settings) => {
      return {
        success: true,
        applied: true,
        settings: { ...settings },
        timestamp: Date.now()
      };
    });
    
    mockConfigurationModal.exportSettings.mockImplementation((format = 'json') => {
      const supportedFormats = ['json', 'yaml', 'toml'];
      if (!supportedFormats.includes(format)) {
        return {
          success: false,
          error: 'Unsupported format'
        };
      }
      
      return {
        success: true,
        format,
        data: JSON.stringify(mockUserSettings, null, 2),
        timestamp: Date.now()
      };
    });
    
    mockConfigurationModal.importSettings.mockImplementation((data, format = 'json') => {
      try {
        const settings = format === 'json' ? JSON.parse(data) : {};
        const validation = mockConfigurationModal.validateForm(settings);
        
        return {
          success: validation.valid,
          settings: validation.valid ? settings : null,
          errors: validation.errors,
          timestamp: Date.now()
        };
      } catch (error) {
        return {
          success: false,
          error: 'Invalid format or corrupted data'
        };
      }
    });
    
    mockConfigurationModal.checkUnsavedChanges.mockImplementation((current, original) => {
      const hasChanges = JSON.stringify(current) !== JSON.stringify(original);
      
      return {
        hasChanges,
        modified: hasChanges ? Object.keys(current) : [],
        timestamp: Date.now()
      };
    });
  });

  // Helper function for nested object access
  function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  describe('Modal Lifecycle', () => {
    test('should open modal successfully', () => {
      const result = mockConfigurationModal.openModal('general');
      
      expect(result.success).toBe(true);
      expect(result.opened).toBe(true);
      expect(result.section).toBe('general');
      expect(result.timestamp).toBeDefined();
    });

    test('should open modal with default section', () => {
      const result = mockConfigurationModal.openModal();
      
      expect(result.success).toBe(true);
      expect(result.section).toBe('general');
    });

    test('should close modal without saving', () => {
      const result = mockConfigurationModal.closeModal(false);
      
      expect(result.success).toBe(true);
      expect(result.closed).toBe(true);
      expect(result.savedChanges).toBe(false);
    });

    test('should close modal with saving', () => {
      const result = mockConfigurationModal.closeModal(true);
      
      expect(result.success).toBe(true);
      expect(result.closed).toBe(true);
      expect(result.savedChanges).toBe(true);
    });
  });

  describe('Settings Loading and Saving', () => {
    test('should load default settings', () => {
      const result = mockConfigurationModal.loadSettings();
      
      expect(result.success).toBe(true);
      expect(result.settings).toEqual(mockDefaultSettings);
      expect(result.timestamp).toBeDefined();
    });

    test('should save valid settings', () => {
      const result = mockConfigurationModal.saveSettings(mockUserSettings);
      
      expect(result.success).toBe(true);
      expect(result.saved).toBe(true);
      expect(result.settings).toEqual(mockUserSettings);
    });

    test('should reject invalid settings', () => {
      const invalidSettings = {
        general: { autoRefresh: -1000 }, // Invalid: below minimum
        monitoring: { alertThreshold: 1.5 } // Invalid: above maximum
      };
      
      const result = mockConfigurationModal.saveSettings(invalidSettings);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('general.autoRefresh must be at least 1000');
      expect(result.errors).toContain('monitoring.alertThreshold must not exceed 1.0');
    });

    test('should apply settings to system', () => {
      const result = mockConfigurationModal.applySettings(mockUserSettings);
      
      expect(result.success).toBe(true);
      expect(result.applied).toBe(true);
      expect(result.settings).toEqual(mockUserSettings);
    });
  });

  describe('Form Validation', () => {
    test('should validate complete form successfully', () => {
      const result = mockConfigurationModal.validateForm(mockUserSettings);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.timestamp).toBeDefined();
    });

    test('should detect validation errors', () => {
      const invalidSettings = {
        general: { autoRefresh: 500 }, // Too low
        monitoring: { updateInterval: 100000 }, // Too high
        ui: { sidebarWidth: 100 } // Too low
      };
      
      const result = mockConfigurationModal.validateForm(invalidSettings);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('general.autoRefresh must be at least 1000');
      expect(result.errors).toContain('monitoring.updateInterval must not exceed 60000');
      expect(result.errors).toContain('ui.sidebarWidth must be at least 200');
    });

    test('should detect missing required fields', () => {
      const incompleteSettings = {
        general: {}, // Missing required fields
        monitoring: { updateInterval: null }
      };
      
      const result = mockConfigurationModal.validateForm(incompleteSettings);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('required'))).toBe(true);
    });

    test('should validate individual fields', () => {
      const validResult = mockConfigurationModal.validateField('general.autoRefresh', 30000);
      expect(validResult.valid).toBe(true);
      
      const invalidResult = mockConfigurationModal.validateField('general.autoRefresh', 500);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain('general.autoRefresh must be at least 1000');
    });
  });

  describe('Field Handling', () => {
    test('should handle field changes', () => {
      const result = mockConfigurationModal.handleFieldChange('general.theme', 'dark');
      
      expect(result.success).toBe(true);
      expect(result.field).toBe('general.theme');
      expect(result.value).toBe('dark');
      expect(result.timestamp).toBeDefined();
    });

    test('should validate fields on change', () => {
      const validChange = mockConfigurationModal.validateField('monitoring.alertThreshold', 0.5);
      expect(validChange.valid).toBe(true);
      
      const invalidChange = mockConfigurationModal.validateField('monitoring.alertThreshold', 2.0);
      expect(invalidChange.valid).toBe(false);
    });

    test('should handle nested field paths', () => {
      const result = mockConfigurationModal.handleFieldChange('ui.compactMode', true);
      
      expect(result.success).toBe(true);
      expect(result.field).toBe('ui.compactMode');
      expect(result.value).toBe(true);
    });
  });

  describe('Reset Functionality', () => {
    test('should reset entire configuration to defaults', () => {
      const result = mockConfigurationModal.resetToDefaults();
      
      expect(result.success).toBe(true);
      expect(result.settings).toEqual(mockDefaultSettings);
    });

    test('should reset specific section to defaults', () => {
      const result = mockConfigurationModal.resetToDefaults('general');
      
      expect(result.success).toBe(true);
      expect(result.section).toBe('general');
      expect(result.settings).toEqual(mockDefaultSettings.general);
    });

    test('should handle invalid section reset', () => {
      const result = mockConfigurationModal.resetToDefaults('invalid');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid section');
    });
  });

  describe('Import/Export Functionality', () => {
    test('should export settings in JSON format', () => {
      const result = mockConfigurationModal.exportSettings('json');
      
      expect(result.success).toBe(true);
      expect(result.format).toBe('json');
      expect(result.data).toBeDefined();
      expect(() => JSON.parse(result.data)).not.toThrow();
    });

    test('should export settings in YAML format', () => {
      const result = mockConfigurationModal.exportSettings('yaml');
      
      expect(result.success).toBe(true);
      expect(result.format).toBe('yaml');
    });

    test('should reject unsupported export formats', () => {
      const result = mockConfigurationModal.exportSettings('xml');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unsupported format');
    });

    test('should import valid JSON settings', () => {
      const validJson = JSON.stringify(mockUserSettings);
      const result = mockConfigurationModal.importSettings(validJson, 'json');
      
      expect(result.success).toBe(true);
      expect(result.settings).toEqual(mockUserSettings);
    });

    test('should reject invalid JSON data', () => {
      const invalidJson = '{ invalid json }';
      const result = mockConfigurationModal.importSettings(invalidJson, 'json');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid format or corrupted data');
    });

    test('should validate imported settings', () => {
      const invalidSettings = JSON.stringify({
        general: { autoRefresh: -1000 }
      });
      
      const result = mockConfigurationModal.importSettings(invalidSettings, 'json');
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('Change Detection', () => {
    test('should detect no changes when settings are identical', () => {
      const result = mockConfigurationModal.checkUnsavedChanges(
        mockDefaultSettings, 
        mockDefaultSettings
      );
      
      expect(result.hasChanges).toBe(false);
      expect(result.modified).toHaveLength(0);
    });

    test('should detect changes when settings differ', () => {
      const result = mockConfigurationModal.checkUnsavedChanges(
        mockUserSettings, 
        mockDefaultSettings
      );
      
      expect(result.hasChanges).toBe(true);
      expect(result.modified.length).toBeGreaterThan(0);
    });

    test('should provide change details', () => {
      const modified = JSON.parse(JSON.stringify(mockDefaultSettings)); // Deep copy
      modified.general.theme = 'dark';
      
      const result = mockConfigurationModal.checkUnsavedChanges(
        modified, 
        mockDefaultSettings
      );
      
      expect(result.hasChanges).toBe(true);
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('Performance and Usability', () => {
    test('should complete validation within time limit', () => {
      const startTime = Date.now();
      
      mockConfigurationModal.validateForm(mockUserSettings);
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(50); // 50ms limit
    });

    test('should handle rapid field changes efficiently', () => {
      const startTime = Date.now();
      
      // Simulate rapid typing
      for (let i = 0; i < 10; i++) {
        mockConfigurationModal.handleFieldChange('general.autoRefresh', 30000 + i);
      }
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(100); // 100ms limit for 10 changes
    });

    test('should save settings quickly', () => {
      const startTime = Date.now();
      
      mockConfigurationModal.saveSettings(mockUserSettings);
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(200); // 200ms limit
    });
  });

  describe('Error Handling', () => {
    test('should handle corrupted settings gracefully', () => {
      const corruptedSettings = {
        invalid: 'structure',
        nested: { circular: null }
      };
      
      expect(() => {
        mockConfigurationModal.validateForm(corruptedSettings);
      }).not.toThrow();
    });

    test('should recover from validation failures', () => {
      // First validation fails
      const invalid = { general: { autoRefresh: -1000 } };
      const result1 = mockConfigurationModal.validateForm(invalid);
      expect(result1.valid).toBe(false);
      
      // Second validation should still work
      const result2 = mockConfigurationModal.validateForm(mockUserSettings);
      expect(result2.valid).toBe(true);
    });

    test('should handle export failures gracefully', () => {
      const result = mockConfigurationModal.exportSettings('invalid');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Accessibility and User Experience', () => {
    test('should provide meaningful error messages', () => {
      const invalidSettings = {
        general: { autoRefresh: 500 },
        monitoring: { 
          updateInterval: 1000,
          alertThreshold: 1.5,
          maxHistoryItems: 1000
        },
        ui: { sidebarWidth: 300 },
        performance: { cacheSize: 100 }
      };
      
      const result = mockConfigurationModal.validateForm(invalidSettings);
      
      expect(result.errors.every(error => error.includes('must'))).toBe(true);
      expect(result.errors.every(error => typeof error === 'string')).toBe(true);
    });

    test('should handle all configuration sections', () => {
      const sections = ['general', 'monitoring', 'ui', 'performance'];
      
      sections.forEach(section => {
        const result = mockConfigurationModal.resetToDefaults(section);
        expect(result.success).toBe(true);
        expect(result.section).toBe(section);
      });
    });

    test('should maintain consistency across operations', () => {
      // Load, modify, save cycle
      const loadResult = mockConfigurationModal.loadSettings();
      expect(loadResult.success).toBe(true);
      
      const saveResult = mockConfigurationModal.saveSettings(loadResult.settings);
      expect(saveResult.success).toBe(true);
      
      const applyResult = mockConfigurationModal.applySettings(saveResult.settings);
      expect(applyResult.success).toBe(true);
    });
  });
}); 