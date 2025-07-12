# Task Master Prompt Template Testing

This directory contains comprehensive testing tools for Task Master's centralized prompt template system.

## Interactive Menu System (Recommended)

The test script now includes an interactive menu system for easy testing and exploration:

```bash
node prompt-test.js
```

### Menu Features

**Main Menu Options:**
1. **Test specific prompt template** - Choose individual templates and variants
2. **Run all tests** - Execute the full test suite 
3. **Toggle full prompt display** - Switch between preview and full prompt output (default: ON)
4. **Generate HTML report** - Create a professional HTML report and open in browser
5. **Exit** - Close the application

**Template Selection:**
- Choose from 8 available prompt templates
- See available variants for each template
- Test individual variants or all variants at once

**Interactive Flow:**
- Select template → Select variant → View results → Choose next action
- Easy navigation back to previous menus
- Color-coded output for better readability

## Batch Mode Options

### Run All Tests (Batch)
```bash
node prompt-test.js --batch
```
Runs all tests non-interactively and exits with appropriate status code.

### Generate HTML Report
```bash
node prompt-test.js --html
```
Generates a professional HTML report with all test results and full prompt content. The report includes:
- **Test summary dashboard** with pass/fail statistics at the top
- **Compact single-line format** - Each template shows: `template: [variant ✓] [variant ✗] - x/y passed`
- **Individual pass/fail badges** - Visual ✓/✗ indicators for each variant test result
- **Template status summary** - Shows x/y passed count at the end of each line
- **Separate error condition section** - Tests for missing parameters, invalid variants, nonexistent templates
- **Alphabetically sorted** - Templates and variants are sorted for predictable ordering
- **Space-efficient layout** - Optimized for developer review with minimal vertical space
- **Two-section layout**: 
  1. **Prompt Templates** - Real template variants testing
  2. **Error Condition Tests** - Error handling validation (empty-prompt, missing-parameters, invalid-variant, etc.)
  3. **Detailed Content** - Full system and user prompts below
- **Full prompt content** displayed without scrolling (no truncation)
- **Professional styling** with clear visual hierarchy and responsive design
- **Automatic browser opening** (cross-platform)

Reports are saved to `tests/manual/prompts/output/` with timestamps.

### Legacy Full Test Mode
```bash
node prompt-test.js --full
```
Runs all tests and shows sample full prompts for verification.

### Help
```bash
node prompt-test.js --help
```
Shows usage information and examples.

## Test Coverage

The comprehensive test suite covers:

## Test Coverage Summary

**Total Test Cases: 23** (18 functional + 5 error condition tests)

### Templates with Research Conditional Content
These templates have `useResearch` or `research` parameters that modify prompt content:
- **add-task** (default, research variants)
- **analyze-complexity** (default, research variants)  
- **parse-prd** (default, research variants)
- **update-subtask** (default, research variants)
- **update-task** (default, append, research variants)

### Templates with Legitimate Separate Variants
These templates have genuinely different prompts for different use cases:
- **expand-task** (default, research, complexity-report variants) - Three sophisticated strategies with advanced parameter support
- **research** (low, medium, high detail level variants)

### Single Variant Templates
These templates only have one variant because research mode only changes AI role, not prompt content:
- **update-tasks** (default variant only)

### Prompt Templates (8 total)
- **add-task** (default, research variants)
- **expand-task** (default, research, complexity-report variants) - Enhanced with sophisticated parameter support and context handling
- **analyze-complexity** (default variant)
- **research** (low, medium, high detail variants)
- **parse-prd** (default variant) - Enhanced with sophisticated numTasks conditional logic
- **update-subtask** (default variant with `useResearch` conditional content)
- **update-task** (default, append variants; research uses `useResearch` conditional content)
- **update-tasks** (default variant with `useResearch` conditional content)

### Test Scenarios (27 total)
- 16 valid template/variant combinations (including enhanced expand-task with new parameter support)
- 4 conditional logic validation tests (testing new gt/gte helper functions)
- 7 error condition tests (nonexistent variants, templates, missing params, invalid detail levels)

### Validation
- Parameter schema compliance
- Template loading success/failure
- Error handling for invalid inputs
- Realistic test data for each template type
- **Output content validation** for conditional logic (NEW)

#### Conditional Logic Testing (NEW)
The test suite now includes specific validation for the new `gt` (greater than) and `gte` (greater than or equal) helper functions:

**Helper Function Tests:**
- `conditional-zero-tasks`: Validates `numTasks = 0` produces "an appropriate number of" text
- `conditional-positive-tasks`: Validates `numTasks = 5` produces "approximately 5" text  
- `conditional-zero-subtasks`: Validates `subtaskCount = 0` produces "an appropriate number of" text
- `conditional-positive-subtasks`: Validates `subtaskCount = 3` produces "exactly 3" text

These tests use the new `validateOutput` function to verify that conditional template logic produces the expected rendered content, ensuring our helper functions work correctly beyond just successful template loading.

## Output Modes

### Preview Mode (Default)
Shows truncated prompts (200 characters) for quick overview:
```
System Prompt Preview:
You are an AI assistant helping with task management...

User Prompt Preview:  
Create a new task based on the following description...

Tip: Use option 3 in main menu to toggle full prompt display
```

### Full Mode
Shows complete system and user prompts for detailed verification:
```
System Prompt:
[Complete system prompt content]

User Prompt:
[Complete user prompt content]
```

## Test Data

Each template uses realistic test data:

- **Tasks**: Complete task objects with proper IDs, titles, descriptions
- **Context**: Simulated project context and gathered information
- **Parameters**: Properly formatted parameters matching each template's schema
- **Research**: Sample queries and detail levels for research prompts

## Error Testing

The test suite includes error condition validation:
- Nonexistent template variants
- Invalid template names
- Missing required parameters
- Malformed parameter data

## Exit Codes (Batch Mode)

- **0**: All tests passed
- **1**: One or more tests failed

## Use Cases

### Development Workflow
1. **Template Development**: Test new templates interactively
2. **Variant Testing**: Verify all variants work correctly
3. **Parameter Validation**: Ensure parameter schemas are working
4. **Regression Testing**: Run batch tests after changes

### Manual Verification
1. **Prompt Review**: Human verification of generated prompts
2. **Parameter Exploration**: See how different parameters affect output
3. **Context Testing**: Verify context inclusion and formatting

### CI/CD Integration
```bash
# In CI pipeline
node tests/manual/prompts/prompt-test.js --batch
```

The interactive menu makes it easy to explore and verify prompt templates during development, while batch mode enables automated testing in CI/CD pipelines.

## 🎯 Purpose

- **Verify all 8 prompt templates** work correctly with the prompt manager
- **Test multiple variants** for each prompt (default, research, complexity-report, etc.)
- **Show full generated prompts** for human verification and debugging
- **Test error conditions** and parameter validation
- **Provide realistic sample data** for each prompt type

## 📁 Files

- `prompt-test.js` - Main test script
- `output/` - Generated HTML reports (when using --html flag or menu option)

## 🎯 Use Cases

### For Developers
- **Verify prompt changes** don't break existing functionality
- **Test new prompt variants** before deployment
- **Debug prompt generation** issues with full output
- **Validate parameter schemas** work correctly

### For QA
- **Regression testing** after prompt template changes
- **Verification of prompt outputs** match expectations
- **Parameter validation testing** for robustness
- **Cross-variant consistency** checking

### For Documentation
- **Reference for prompt usage** with realistic examples
- **Parameter requirements** demonstration
- **Variant differences** visualization
- **Expected output formats** examples

## ⚠️ Important Notes

1. **Real Prompt Manager**: This test uses the actual prompt manager, not mocks
2. **Parameter Accuracy**: All parameters match the exact schema requirements of each prompt template
3. **Variant Coverage**: Tests all documented variants for each prompt type
4. **Sample Data**: Uses realistic project scenarios, not dummy data
5. **Exit Codes**: Returns exit code 1 if any tests fail, 0 if all pass

## 🔄 Maintenance

When adding new prompt templates or variants:

1. Add sample data to the `sampleData` object
2. Include realistic parameters matching the prompt's schema
3. Test all documented variants
4. Verify with the `--full` flag that prompts generate correctly
5. Update this README with new coverage information

This test suite should be run whenever:
- Prompt templates are modified
- New variants are added
- Parameter schemas change
- Prompt manager logic is updated
- Before major releases 