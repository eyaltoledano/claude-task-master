export default {
  extends: ['../../.eslintrc.js'],
  overrides: [
    {
      // Core layer restrictions - cannot import from infrastructure or ui
      files: ['core/**/*.js', 'core/**/*.jsx'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['../infra/**', '../../infra/**'],
                message: 'Core layer cannot import from infrastructure layer'
              },
              {
                group: ['../ui/**', '../../ui/**'],
                message: 'Core layer cannot import from UI layer'
              }
            ]
          }
        ]
      }
    },
    {
      // Infrastructure layer restrictions - cannot import from ui
      files: ['infra/**/*.js', 'infra/**/*.jsx'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['../ui/**', '../../ui/**'],
                message: 'Infrastructure layer cannot import from UI layer'
              }
            ]
          }
        ]
      }
    },
    {
      // UI layer restrictions - cannot import from infrastructure (except config)
      files: ['ui/**/*.js', 'ui/**/*.jsx'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['../infra/**', '../../infra/**'],
                message: 'UI layer should not directly import from infrastructure layer'
              }
            ]
          }
        ]
      }
    },
    {
      // Enforce barrel imports - no deep imports
      files: ['**/*.js', '**/*.jsx'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/core/*/**', '**/infra/*/**', '**/ui/*/**', '**/app/*/**'],
                message: 'Use barrel imports (index.js) instead of deep imports'
              }
            ]
          }
        ]
      }
    }
  ]
}; 